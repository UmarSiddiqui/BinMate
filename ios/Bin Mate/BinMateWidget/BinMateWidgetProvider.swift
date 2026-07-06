import WidgetKit
import Foundation

/// WidgetKit timeline entry carrying the data needed to render BinMateWidget.
struct BinMateEntry: TimelineEntry {
    let date: Date
    let suburb: String
    let nextCollections: [WidgetCollection]
    let isPlaceholder: Bool
}

/// Provides timeline entries by reading from the shared App Group UserDefaults.
struct BinMateWidgetProvider: TimelineProvider {

    nonisolated func placeholder(in context: Context) -> BinMateEntry {
        BinMateEntry(
            date: Date(),
            suburb: "Scarborough",
            nextCollections: [
                WidgetCollection(
                    date: tomorrowISO(),
                    dayOfWeek: "Friday",
                    types: ["general", "recycling"],
                    isVerge: false
                )
            ],
            isPlaceholder: true
        )
    }

    nonisolated func getSnapshot(in context: Context, completion: @escaping (BinMateEntry) -> Void) {
        completion(context.isPreview ? placeholder(in: context) : loadEntry())
    }

    nonisolated func getTimeline(in context: Context, completion: @escaping (Timeline<BinMateEntry>) -> Void) {
        let entry = loadEntry()
        // Refresh nightly at 17:05 AWST (09:05 UTC) — 5 min after the nightly cron
        let next = nextRefreshDate()
        completion(Timeline(entries: [entry], policy: .after(next)))
    }

    // MARK: - Private

    nonisolated private func loadEntry() -> BinMateEntry {
        let defaults = WidgetSharedDefaults.shared
        let suburb = defaults.string(forKey: WidgetSharedDefaults.Keys.suburb) ?? ""
        let data = defaults.data(forKey: WidgetSharedDefaults.Keys.nextCollections) ?? Data()
        let all = (try? JSONDecoder().decode([WidgetCollection].self, from: data)) ?? []
        let upcoming = upcomingOnly(all)
        return BinMateEntry(date: Date(), suburb: suburb, nextCollections: upcoming, isPlaceholder: false)
    }

    nonisolated private func upcomingOnly(_ collections: [WidgetCollection]) -> [WidgetCollection] {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        let today = Calendar.current.startOfDay(for: Date())
        return collections.filter { c in
            guard let d = f.date(from: c.date) else { return false }
            return d >= today
        }
    }

    nonisolated private func nextRefreshDate() -> Date {
        var comps = Calendar.current.dateComponents(
            in: TimeZone(identifier: "Australia/Perth")!,
            from: Date()
        )
        comps.hour = 17
        comps.minute = 5
        comps.second = 0
        guard var next = Calendar.current.date(from: comps) else {
            return Date().addingTimeInterval(3600)
        }
        if next <= Date() {
            next = Calendar.current.date(byAdding: .day, value: 1, to: next) ?? next
        }
        return next
    }

    nonisolated private func tomorrowISO() -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: Date()) ?? Date()
        return f.string(from: tomorrow)
    }
}
