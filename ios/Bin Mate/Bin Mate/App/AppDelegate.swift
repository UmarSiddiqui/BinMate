import UIKit
import OSLog

/// UIApplicationDelegate registered via @UIApplicationDelegateAdaptor in BinMateApp.
/// Sole responsibility: bridge UIKit APNs callbacks to NotificationService.
/// @MainActor matches UIKit's guarantee that these methods run on the main thread.
@MainActor
final class AppDelegate: NSObject, UIApplicationDelegate {

    /// Forward the APNs device token to NotificationService for storage and backend sync.
    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        Task {
            await NotificationService.shared.handleDeviceToken(deviceToken)
        }
    }

    /// Log registration failures. Non-fatal — app works without push.
    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        Task { @MainActor in
            NotificationService.shared.handleRegistrationFailure(error)
        }
    }
}
