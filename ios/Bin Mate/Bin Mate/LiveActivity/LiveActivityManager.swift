import ActivityKit
import Foundation
import OSLog

/// Starts, updates, and ends the BinMate Live Activity on compatible devices.
@MainActor
enum LiveActivityManager {

    /// Sync the Live Activity with the next kerbside collection.
    static func sync(
        collections: [Collection],
        zoneId: String,
        suburb: String,
        title: String,
        subtitle: String
    ) async {
        // 16.2: ActivityContent + content-based request/update APIs.
        guard #available(iOS 16.2, *) else { return }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        guard let next = nextKerbsideCollection(from: collections), !zoneId.isEmpty else {
            await endActivities()
            return
        }

        let state = BinMateActivityAttributes.ContentState(
            title: title,
            subtitle: subtitle,
            collectionDate: next.date,
            binTypes: next.types.map(\.rawValue),
            suburb: suburb
        )

        if let existing = Activity<BinMateActivityAttributes>.activities.first(
            where: { $0.attributes.zoneId == zoneId }
        ) {
            await existing.update(ActivityContent(state: state, staleDate: nil))
            return
        }

        await endActivities()
        do {
            _ = try Activity.request(
                attributes: BinMateActivityAttributes(zoneId: zoneId),
                content: ActivityContent(state: state, staleDate: nil),
                pushType: nil
            )
        } catch {
            Logger.app.error("Live Activity request failed: \(error.localizedDescription)")
        }
    }

    /// End all BinMate Live Activities.
    static func endActivities() async {
        guard #available(iOS 16.2, *) else { return }
        for activity in Activity<BinMateActivityAttributes>.activities {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
    }

    private static func nextKerbsideCollection(from collections: [Collection]) -> Collection? {
        collections.first { collection in
            collection.eventType == .kerbside && daysUntil(collection.date) != nil
        }
    }

    private static func daysUntil(_ isoDate: String) -> Int? {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_AU")
        guard let date = formatter.date(from: isoDate) else { return nil }
        let start = Calendar.current.startOfDay(for: Date())
        let end = Calendar.current.startOfDay(for: date)
        guard let days = Calendar.current.dateComponents([.day], from: start, to: end).day else {
            return nil
        }
        return days >= 0 ? days : nil
    }
}
