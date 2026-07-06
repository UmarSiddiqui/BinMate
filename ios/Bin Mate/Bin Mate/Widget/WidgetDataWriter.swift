import Foundation
import WidgetKit
import OSLog

/// Persists upcoming collection data to the App Group UserDefaults container
/// so the BinMateWidget can render without launching the main app.
enum WidgetDataWriter {

    /// Write suburb + next 5 collections to the shared App Group defaults,
    /// then signal WidgetKit to reload the widget timeline.
    static func write(suburb: String, collections: [Collection]) {
        let defaults = WidgetSharedDefaults.shared
        defaults.set(suburb, forKey: WidgetSharedDefaults.Keys.suburb)

        let widgetCollections = collections.prefix(5).map { c in
            WidgetCollection(
                date: c.date,
                dayOfWeek: c.dayOfWeek,
                types: c.types.map(\.rawValue),
                isVerge: c.eventType == .verge
            )
        }

        if let data = try? JSONEncoder().encode(Array(widgetCollections)) {
            defaults.set(data, forKey: WidgetSharedDefaults.Keys.nextCollections)
        }

        WidgetCenter.shared.reloadTimelines(ofKind: "BinMateWidget")
        Logger.app.debug("Widget data written — \(widgetCollections.count) collections for \(suburb)")
    }
}
