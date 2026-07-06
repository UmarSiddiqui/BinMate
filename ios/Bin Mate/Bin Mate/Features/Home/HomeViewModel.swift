import Combine
import Foundation
import OSLog

/// Drives HomeView — loads the upcoming schedule and computes derived display state.
@MainActor
final class HomeViewModel: ObservableObject {

    // MARK: - Published

    @Published private(set) var collections: [Collection] = []
    @Published private(set) var isLoading = false
    @Published private(set) var error: BinMateError?

    // MARK: - Derived display state

    /// First upcoming kerbside collection (today or tomorrow) — nil when nothing is imminent.
    /// When non-nil the HeroCollectionCard renders with a lime background.
    var heroCollection: Collection? {
        guard let first = kerbside.first else { return nil }
        guard let days = daysUntil(first.date) else { return nil }
        return days <= 1 ? first : nil
    }

    /// Main headline for the hero card.
    var heroTitle: String {
        guard let first = kerbside.first else { return "All quiet" }
        guard let days = daysUntil(first.date) else { return first.dayOfWeek }
        switch days {
        case 0:  return "Today"
        case 1:  return "Bins out tonight"
        default: return first.dayOfWeek
        }
    }

    /// Supporting text beneath the hero headline.
    var heroSubtitle: String {
        guard let first = kerbside.first else { return "No upcoming kerbside collections" }
        guard let days = daysUntil(first.date) else { return first.date }
        switch days {
        case 0:  return "Bins collected today"
        case 1:  return "Put bins out before 6 am tomorrow"
        default:
            let label = relativeLabel(days: days)
            return "\(label) · \(formattedDate(first.date))"
        }
    }

    /// Kerbside collections shown in the upcoming list (everything after hero, up to 8 items).
    var listCollections: [Collection] {
        var all = kerbside
        if heroCollection != nil { all = Array(all.dropFirst()) }
        return Array(all.prefix(8))
    }

    /// Upcoming verge / bulk collection events.
    var vergeCollections: [Collection] {
        collections.filter { $0.eventType == .verge }
    }

    var hasUpcomingVerge: Bool { !vergeCollections.isEmpty }

    // MARK: - Private

    private let repository: ScheduleRepositoryProtocol

    private var kerbside: [Collection] {
        collections.filter { $0.eventType == .kerbside }
    }

    // MARK: - Init

    init(repository: ScheduleRepositoryProtocol = ScheduleRepository.shared) {
        self.repository = repository
    }

    // MARK: - Actions

    func loadSchedule(zoneId: String, suburb: String) async {
        guard !zoneId.isEmpty else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            collections = try await repository.upcoming(for: zoneId, count: 20)
            Logger.app.debug("Loaded \(self.collections.count) collections for zone \(zoneId)")
        } catch let err as BinMateError {
            error = err
        } catch {
            self.error = .unknown(error)
        }
    }

    func refresh(zoneId: String, suburb: String) async {
        guard !zoneId.isEmpty else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            collections = try await repository.refresh(for: zoneId, count: 20)
        } catch let err as BinMateError {
            error = err
        } catch {
            self.error = .unknown(error)
        }
    }

    // MARK: - Date helpers

    /// Returns the number of calendar days between today and the given ISO date string.
    private func daysUntil(_ isoDate: String) -> Int? {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_AU")
        guard let date = f.date(from: isoDate) else { return nil }
        let cal = Calendar.current
        let start = cal.startOfDay(for: Date())
        let end   = cal.startOfDay(for: date)
        return cal.dateComponents([.day], from: start, to: end).day
    }

    private func formattedDate(_ isoDate: String) -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_AU")
        guard let date = f.date(from: isoDate) else { return isoDate }
        let out = DateFormatter()
        out.dateFormat = "d MMM"
        out.locale = Locale(identifier: "en_AU")
        return out.string(from: date)
    }

    private func relativeLabel(days: Int) -> String {
        switch days {
        case 2:  return "In 2 days"
        case 3:  return "In 3 days"
        case 4:  return "In 4 days"
        case 5:  return "In 5 days"
        case 6:  return "In 6 days"
        case 7:  return "In a week"
        default: return "In \(days) days"
        }
    }
}
