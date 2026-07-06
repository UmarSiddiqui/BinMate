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

    // MARK: - Published state

    @Published private(set) var authorizationStatus: UNAuthorizationStatus = .notDetermined

    // MARK: - Dependencies

    private let keychain: KeychainServiceProtocol
    private let api: BinMateAPIProtocol

    // MARK: - Init

    init(
        keychain: KeychainServiceProtocol = KeychainService.shared,
        api: BinMateAPIProtocol = BinMateAPI.shared
    ) {
        self.keychain = keychain
        self.api = api
        super.init()
        UNUserNotificationCenter.current().delegate = self
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
    /// and syncs it to the backend if a user ID is already available.
    func handleDeviceToken(_ data: Data) async {
        let token = data.map { String(format: "%02.2hhx", $0) }.joined()
        keychain.storePushToken(token)
        Logger.notifications.info("APNs token stored in Keychain")
        await syncTokenToBackend(token)
    }

    /// Logs APNs registration failure. Non-fatal — the app functions without push.
    func handleRegistrationFailure(_ error: Error) {
        Logger.notifications.error("APNs registration failed: \(error.localizedDescription)")
    }

    // MARK: - Private

    private func syncTokenToBackend(_ token: String) async {
        guard let userId = keychain.retrieveUserId() else {
            // User hasn't completed onboarding yet. Token will sync after user ID is assigned.
            Logger.notifications.debug("Deferring token sync — no user ID yet")
            return
        }
        do {
            try await api.updatePushToken(userId: userId, pushToken: token, notificationHour: nil)
            Logger.notifications.info("Push token synced to backend")
        } catch {
            Logger.notifications.error("Token sync failed: \(error.localizedDescription)")
        }
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
        Logger.notifications.debug("Notification tapped: \(response.notification.request.identifier)")
        NotificationCenter.default.post(
            name: .binMateNotificationTapped,
            object: nil,
            userInfo: response.notification.request.content.userInfo
        )
        completionHandler()
    }
}
