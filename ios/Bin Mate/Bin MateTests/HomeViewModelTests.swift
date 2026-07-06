import XCTest
@testable import Bin_Mate

@MainActor
final class HomeViewModelTests: XCTestCase {

    func testDashboardSummaryShowsNextKerbsideAndBulkStatus() async throws {
        let collections = [
            makeCollection(daysFromToday: 3, types: [.general], eventType: .kerbside),
            makeCollection(daysFromToday: 10, types: [], eventType: .verge)
        ]
        let viewModel = HomeViewModel(repository: MockScheduleRepository(collections: collections))

        await viewModel.loadSchedule(zoneId: "zone-1", suburb: "Subiaco")

        XCTAssertEqual(viewModel.nextKerbsideSummary, "In 3 days")
        XCTAssertEqual(viewModel.bulkCollectionSummary, "Next bulk in 10 days")
    }

    private func makeCollection(
        daysFromToday: Int,
        types: [BinType],
        eventType: Collection.EventType
    ) -> Collection {
        let date = Calendar.current.date(
            byAdding: .day,
            value: daysFromToday,
            to: Calendar.current.startOfDay(for: Date())
        ) ?? Date()
        let iso = Self.isoFormatter.string(from: date)
        let day = Self.dayFormatter.string(from: date)
        return Collection(
            date: iso,
            dayOfWeek: day,
            types: types,
            isHolidayShifted: false,
            originalDate: nil,
            eventType: eventType
        )
    }

    private static let isoFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_AU")
        return formatter
    }()

    private static let dayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE"
        formatter.locale = Locale(identifier: "en_AU")
        return formatter
    }()
}

private struct MockScheduleRepository: ScheduleRepositoryProtocol {
    let collections: [Collection]

    func upcoming(for zoneId: String, count: Int) async throws -> [Collection] {
        Array(collections.prefix(count))
    }

    func refresh(for zoneId: String, count: Int) async throws -> [Collection] {
        Array(collections.prefix(count))
    }
}
