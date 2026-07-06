import Foundation

/// Constants and accessor for the App Group shared UserDefaults container.
/// Identical copy lives in the main app at Bin Mate/Widget/WidgetSharedDefaults.swift.
enum WidgetSharedDefaults {

    /// App Group identifier — must match in both targets' entitlements.
    static let suiteName = "group.app.binmate"

    enum Keys {
        /// The user's primary suburb name (String).
        static let suburb = "widget_suburb"
        /// JSON-encoded [WidgetCollection] — next upcoming collections.
        static let nextCollections = "widget_next_collections"
    }

    /// Returns the shared App Group UserDefaults, falling back to standard if unavailable.
    static var shared: UserDefaults {
        UserDefaults(suiteName: suiteName) ?? .standard
    }
}
