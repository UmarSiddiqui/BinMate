import Combine
import Foundation
import UserNotifications
import UIKit
import OSLog

// MARK: - Protocol

/// Manages APNs authorisation, push token lifecycle, and notification delivery.
protocol NotificationServiceProtocol {
    /// Request notification authorisation. Shows the system prompt if status is .notDetermined.
    func requestPermission() async throws

    /// Called by AppDelegate when APNs registration succeeds.
    func handleDeviceToken(_ data: Data) async

    /// Called by AppDelegate when APNs registration fails.
    func handleRegistrationFailure(_ error: Error)

    /// Re-reads and publishes the current authorisation status.
    func refreshStatus() async
}

// MARK: - Implementation

/// Wraps UNUserNotificationCenter and manages the token → Keychain → backend sync pipeline.
/// Acts as UNUserNotificationCenterDelegate for foreground delivery and deeplink routing.
@MainActor
final class NotificationService: NSObject, ObservableObject {

    // MARK: - Singleton

    nonisolated static let shared: NotificationService = MainActor.assumeIsolated { NotificationService() }

    // MARK: - Categories & actions

    /// Category for bin day reminders — carries the snooze action.
    /// Backend pushes must set `aps.category` to this value.
    nonisolated static let binReminderCategory = "BIN_REMINDER"

    /// Action identifier for "Remind me in 1 hour".
    nonisolated static let snoozeActionIdentifier = "SNOOZE_1H"

    /// Snooze delay in seconds (1 hour).
    private static let snoozeInterval: TimeInterval = 3600

    // MARK: - Published state

    @Published private(set) var authorizationStatus: UNAuthorizationStatus = .notDetermined

    // MARK: - Dependencies

    private let keychain: KeychainServiceProtocol

    // MARK: - Init

    init(keychain: KeychainServiceProtocol = KeychainService.shared) {
        self.keychain = keychain
        super.init()
        let center = UNUserNotificationCenter.current()
        center.delegate = self
        registerCategories(with: center)
    }

    /// Registers the bin reminder category so reminders offer a snooze action.
    private func registerCategories(with center: UNUserNotificationCenter) {
        let snooze = UNNotificationAction(
            identifier: Self.snoozeActionIdentifier,
            title: "Remind me in 1 hour",
            options: []
        )
        let reminder = UNNotificationCategory(
            identifier: Self.binReminderCategory,
            actions: [snooze],
            intentIdentifiers: [],
            options: []
        )
        center.setNotificationCategories([reminder])
    }

    /// Re-schedules a copy of the given notification content after the snooze interval.
    private func scheduleSnooze(from content: UNNotificationContent) {
        guard let copy = content.mutableCopy() as? UNMutableNotificationContent else { return }
        let trigger = UNTimeIntervalNotificationTrigger(
            timeInterval: Self.snoozeInterval,
            repeats: false
        )
        let request = UNNotificationRequest(
            identifier: "binmate.snooze.\(UUID().uuidString)",
            content: copy,
            trigger: trigger
        )
        UNUserNotificationCenter.current().add(request) { error in
            if let error {
                Logger.notifications.error("Snooze scheduling failed: \(error.localizedDescription)")
            } else {
                Logger.notifications.info("Reminder snoozed for 1 hour")
            }
        }
    }

    // MARK: - Permission

    /// Requests .alert / .badge / .sound authorisation and registers with APNs if granted.
    func requestPermission() async throws {
        let center = UNUserNotificationCenter.current()
        let granted = try await center.requestAuthorization(options: [.alert, .badge, .sound])
        await refreshStatus()
        Logger.notifications.info("Notification permission \(granted ? "granted" : "denied")")
        if granted {
            UIApplication.shared.registerForRemoteNotifications()
        }
    }

    /// Re-reads the current UNAuthorizationStatus and publishes it.
    func refreshStatus() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        authorizationStatus = settings.authorizationStatus
    }

    // MARK: - Token lifecycle

    /// Converts the raw APNs token data to a hex string, stores it in Keychain,
    /// and syncs every saved zone to the backend so reminders can start flowing.
    func handleDeviceToken(_ data: Data) async {
        let token = data.map { String(format: "%02.2hhx", $0) }.joined()
        keychain.storePushToken(token)
        Logger.notifications.info("APNs token stored in Keychain")
        ZoneSyncService.shared.requestSync()
    }

    /// Logs APNs registration failure. Non-fatal — the app functions without push.
    func handleRegistrationFailure(_ error: Error) {
        Logger.notifications.error("APNs registration failed: \(error.localizedDescription)")
    }

}

// MARK: - UNUserNotificationCenterDelegate

extension NotificationService: UNUserNotificationCenterDelegate {

    /// Deliver notifications while the app is foregrounded (show banner + play sound).
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // Count delivered reminders so the app review prompt can fire after the 3rd.
        NotificationCenter.default.post(name: .binMateNotificationDelivered, object: nil)
        completionHandler([.banner, .sound, .badge])
    }

    /// Handle the user tapping a push notification — post an app-internal deeplink event.
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        // "Remind me in 1 hour" — reschedule locally, don't open the app.
        if response.actionIdentifier == Self.snoozeActionIdentifier {
            scheduleSnooze(from: response.notification.request.content)
            completionHandler()
            return
        }

        Logger.notifications.debug("Notification tapped: \(response.notification.request.identifier)")
        NotificationCenter.default.post(
            name: .binMateNotificationTapped,
            object: nil,
            userInfo: response.notification.request.content.userInfo
        )
        completionHandler()
    }
}
