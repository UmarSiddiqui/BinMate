import Foundation

/// Notification names used for app-internal events.
/// In a separate file to avoid MainActor inference from NotificationService.
extension Notification.Name {
    /// Posted when the user taps a BinMate push notification.
    /// Observe in RootView to handle deeplink routing.
    static let binMateNotificationTapped = Notification.Name("app.binmate.notificationTapped")

    /// Posted when a BinMate notification is delivered (foreground or background).
    /// Used to increment the notification count for the App Store review prompt.
    static let binMateNotificationDelivered = Notification.Name("app.binmate.notificationDelivered")
}
