import OSLog

extension Logger {
    /// Subsystem for all BinMate loggers. Constant avoids Bundle.main (MainActor) so logs
    /// can be written from nonisolated contexts (e.g. UNUserNotificationCenterDelegate).
    private static let subsystem = "app.binmate.ios"

    /// General app events
    static let app = Logger(subsystem: subsystem, category: "App")
    /// Network / API calls
    static let network = Logger(subsystem: subsystem, category: "Network")
    /// Notification service
    static let notifications = Logger(subsystem: subsystem, category: "Notifications")
    /// RevenueCat / subscription events
    static let purchases = Logger(subsystem: subsystem, category: "Purchases")
    /// CoreData / local persistence
    static let persistence = Logger(subsystem: subsystem, category: "Persistence")
}
