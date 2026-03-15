import OSLog

extension Logger {
    private static let subsystem = Bundle.main.bundleIdentifier ?? "app.binmate.ios"

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
