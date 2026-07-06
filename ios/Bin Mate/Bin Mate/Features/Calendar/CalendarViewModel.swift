import Combine
import OSLog

/// Loads the full annual schedule and indexes it by date for calendar display.
@MainActor
final class CalendarViewModel: ObservableObject {

    // MARK: - Published state

    @Published var isLoading = false
    @Published var error: BinMateError?

    /// ISO date string of the tapped day — drives the detail bottom sheet.
    @Published var selectedDate: String?

    // MARK: - Data

    /// Collections indexed by ISO date string for O(1) day lookups.
    private(set) var byDate: [String: [Collection]] = [:]

    // MARK: - Dependencies

    private let repository: ScheduleRepositoryProtocol

    init(repository: ScheduleRepositoryProtocol = ScheduleRepository.shared) {
        self.repository = repository
    }

    // MARK: - Load

    /// Fetches ~12 months of upcoming collections and indexes them by date.
    func load(zoneId: String) async {
        guard !zoneId.isEmpty else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            let all = try await repository.upcoming(for: zoneId, count: 200)
            byDate = Dictionary(grouping: all, by: \.date)
        } catch let err as BinMateError {
            error = err
        } catch {
            self.error = .unknown(error)
        }
    }

    // MARK: - Date queries

    /// All collections on a given ISO date.
    func collections(on date: String) -> [Collection] { byDate[date] ?? [] }

    /// Deduplicated bin types present on a date, used to render colour dots.
    func dotTypes(on date: String) -> [BinType] {
        let types = collections(on: date).flatMap(\.types)
        return Array(Set(types)).sorted(by: { $0.rawValue < $1.rawValue })
    }

    /// True if any collection on this date was shifted due to a WA public holiday.
    func isHolidayShifted(on date: String) -> Bool {
        collections(on: date).contains(where: \.isHolidayShifted)
    }

    /// True if any collection on this date is a verge pickup.
    func hasVerge(on date: String) -> Bool {
        collections(on: date).contains(where: { $0.eventType == .verge })
    }

    // MARK: - Month list

    /// 12 months starting from the current month (1st of each).
    var months: [Date] {
        var comps = Calendar.current.dateComponents([.year, .month], from: Date())
        comps.day = 1
        guard let start = Calendar.current.date(from: comps) else { return [] }
        return (0..<12).compactMap {
            Calendar.current.date(byAdding: .month, value: $0, to: start)
        }
    }

    // MARK: - Sheet data

    var selectedCollections: [Collection] {
        guard let d = selectedDate else { return [] }
        return collections(on: d)
    }
}
