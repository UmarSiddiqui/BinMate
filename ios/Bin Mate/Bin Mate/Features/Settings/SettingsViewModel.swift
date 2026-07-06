import Combine
import Foundation
import OSLog
import UIKit
import UserNotifications

/// Manages state and side-effects for the Settings screen.
@MainActor
final class SettingsViewModel: ObservableObject {

    // MARK: - Constants

    /// Valid notification reminder hours — 4 pm to 10 pm AWST.
    static let notificationHours: [Int] = Array(16...22)

    // MARK: - Published state

    @Published private(set) var authorizationStatus: UNAuthorizationStatus = .notDetermined

    @Published var notificationsOptedOut: Bool {
        didSet { UserDefaults.standard.set(notificationsOptedOut, forKey: Keys.notificationsOptedOut) }
    }

    @Published var notificationHour: Int {
        didSet { UserDefaults.standard.set(notificationHour, forKey: Keys.notificationHour) }
    }

    @Published private(set) var isSavingHour        = false
    @Published var showOpenSettingsAlert             = false
    @Published private(set) var testNotificationSent = false

    // MARK: - Computed

    /// True when the system has granted permission and the user hasn't locally opted out.
    var notificationsEnabled: Bool {
        (authorizationStatus == .authorized || authorizationStatus == .provisional)
            && !notificationsOptedOut
    }

    // MARK: - Dependencies

    private let notificationService: NotificationService
    private let api: BinMateAPIProtocol
    private let keychain: KeychainServiceProtocol

    // MARK: - Init

    init(
        notificationService: NotificationService = .shared,
        api: BinMateAPIProtocol = BinMateAPI.shared,
        keychain: KeychainServiceProtocol = KeychainService.shared
    ) {
        self.notificationService = notificationService
        self.api     = api
        self.keychain = keychain

        let defaults = UserDefaults.standard
        self.notificationsOptedOut = defaults.bool(forKey: Keys.notificationsOptedOut)
        let saved = defaults.integer(forKey: Keys.notificationHour)
        self.notificationHour = saved == 0 ? 18 : saved   // default 6 pm
    }

    // MARK: - Lifecycle

    /// Re-read the current system authorisation status. Call on view appear and foreground.
    func refreshNotificationStatus() async {
        await notificationService.refreshStatus()
        authorizationStatus = notificationService.authorizationStatus
    }

    // MARK: - Notifications toggle

    /// Handle the user tapping the notifications toggle.
    func handleNotificationsToggle() async {
        switch authorizationStatus {
        case .authorized, .provisional:
            notificationsOptedOut.toggle()
            if !notificationsOptedOut { await syncCurrentHour() }

        case .denied:
            showOpenSettingsAlert = true

        case .notDetermined:
            do {
                try await notificationService.requestPermission()
                authorizationStatus = notificationService.authorizationStatus
                notificationsOptedOut = false
            } catch {
                Logger.notifications.error("Permission request failed: \(error.localizedDescription)")
            }

        @unknown default:
            break
        }
    }

    // MARK: - Notification hour

    /// Sync the selected reminder hour to the backend.
    func saveNotificationHour() async {
        guard let userId = keychain.retrieveUserId(),
              let token  = keychain.retrievePushToken() else { return }
        isSavingHour = true
        defer { isSavingHour = false }
        do {
            try await api.updatePushToken(userId: userId, pushToken: token, notificationHour: notificationHour)
            Logger.notifications.info("Notification hour updated: \(self.notificationHour):00")
        } catch {
            Logger.notifications.error("Failed to update notification hour: \(error.localizedDescription)")
        }
    }

    // MARK: - Test notification

    /// Schedule a local notification to fire in 3 seconds as a preview.
    func sendTestNotification() {
        let content       = UNMutableNotificationContent()
        content.title     = "Bins out tonight"
        content.body      = "Your general waste and recycling bins go out tomorrow morning."
        content.sound     = .default
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 3, repeats: false)
        let request = UNNotificationRequest(
            identifier: "binmate.test.\(UUID().uuidString)",
            content:    content,
            trigger:    trigger
        )
        UNUserNotificationCenter.current().add(request) { error in
            if let error {
                Logger.notifications.error("Test notification error: \(error.localizedDescription)")
            }
        }
        testNotificationSent = true
        Task {
            try? await Task.sleep(nanoseconds: 4_000_000_000)
            testNotificationSent = false
        }
    }

    // MARK: - System settings

    /// Open the iOS Settings app to the BinMate notification preferences page.
    func openSystemSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
        UIApplication.shared.open(url)
    }

    // MARK: - Formatting

    /// Format an hour integer as a 12-hour time string — e.g. 18 → "6:00 PM".
    static func formatHour(_ hour: Int) -> String {
        var components  = DateComponents()
        components.hour = hour
        components.minute = 0
        let date      = Calendar.current.date(from: components) ?? Date()
        let formatter = DateFormatter()
        formatter.dateFormat = "h:00 a"
        return formatter.string(from: date)
    }

    // MARK: - Private

    private func syncCurrentHour() async {
        guard let userId = keychain.retrieveUserId(),
              let token  = keychain.retrievePushToken() else { return }
        do {
            try await api.updatePushToken(userId: userId, pushToken: token, notificationHour: notificationHour)
        } catch {
            Logger.notifications.error("Token sync failed: \(error.localizedDescription)")
        }
    }

    // MARK: - Keys

    private enum Keys {
        static let notificationsOptedOut = "notifications_opted_out"
        static let notificationHour      = "notification_hour"
    }
}
