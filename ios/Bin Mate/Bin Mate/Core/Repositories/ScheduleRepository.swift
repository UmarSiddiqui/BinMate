import CoreData
import OSLog

// MARK: - Protocol

/// Provides upcoming collection schedule for a zone, backed by a CoreData cache.
protocol ScheduleRepositoryProtocol {
    /// Returns the next `count` collections from cache if fresh, otherwise fetches from API.
    func upcoming(for zoneId: String, count: Int) async throws -> [Collection]

    /// Force-refreshes the cache from the API and returns the latest schedule.
    func refresh(for zoneId: String, count: Int) async throws -> [Collection]
}

// MARK: - Implementation

/// Fetches schedules from the backend API and caches them in CoreData.
/// Cache TTL is 7 days — zone schedules are annual and rarely change.
///
/// Not `@MainActor` at class level; only `cachedZone` pins to main actor because
/// `viewContext` is main-thread-bound. This keeps `static let shared` nonisolated
/// so Views can reference it without actor-isolation warnings.
final class ScheduleRepository: ScheduleRepositoryProtocol {

    // MARK: - Singleton

    nonisolated static let shared = ScheduleRepository()

    // MARK: - Dependencies

    private let api: BinMateAPIProtocol
    private let store: CoreDataStack

    /// 7 days — zone schedules are set annually and only change if the council re-scrapes.
    private let cacheTTL: TimeInterval = 7 * 24 * 3600

    // MARK: - Init

    init(api: BinMateAPIProtocol = BinMateAPI.shared, store: CoreDataStack = .shared) {
        self.api = api
        self.store = store
    }

    // MARK: - ScheduleRepositoryProtocol

    func upcoming(for zoneId: String, count: Int = 20) async throws -> [Collection] {
        // Read viewContext on main actor; convert to [Collection] (Sendable) before crossing.
        let cached: [Collection] = await MainActor.run {
            guard let zone = cachedZone(zoneId: zoneId), zone.expiresAt > Date() else {
                return []
            }
            Logger.persistence.debug("Cache hit — zone \(zoneId)")
            return zone.orderedCollections.prefix(count).compactMap { $0.toCollection() }
        }
        if !cached.isEmpty { return cached }
        Logger.persistence.debug("Cache miss — fetching zone \(zoneId) from API")
        return try await refresh(for: zoneId, count: count)
    }

    func refresh(for zoneId: String, count: Int = 20) async throws -> [Collection] {
        let schedule = try await api.fetchSchedule(zoneId: zoneId, from: Date(), count: count)
        writeCache(zoneId: zoneId, collections: schedule)
        return schedule
    }

    // MARK: - Private — reads (main actor, viewContext is main-thread-bound)

    @MainActor
    private func cachedZone(zoneId: String) -> ZoneEntity? {
        let request = ZoneEntity.fetchRequest()
        request.predicate = NSPredicate(format: "zoneId == %@", zoneId)
        request.fetchLimit = 1
        return try? store.viewContext.fetch(request).first
    }

    // MARK: - Private — writes (background context)

    private func writeCache(zoneId: String, collections: [Collection]) {
        let ttl = cacheTTL
        store.performBackgroundTask { ctx in
            Self.upsertZone(zoneId: zoneId, collections: collections, ttl: ttl, in: ctx)
        }
    }

    private static func upsertZone(
        zoneId: String,
        collections: [Collection],
        ttl: TimeInterval,
        in ctx: NSManagedObjectContext
    ) {
        let request = ZoneEntity.fetchRequest()
        request.predicate = NSPredicate(format: "zoneId == %@", zoneId)
        if let existing = try? ctx.fetch(request).first {
            ctx.delete(existing)
        }

        let zone = ZoneEntity(context: ctx)
        zone.zoneId      = zoneId
        zone.councilName = ""
        zone.cachedAt    = Date()
        zone.expiresAt   = Date(timeIntervalSinceNow: ttl)

        for c in collections {
            let entity = CollectionEntity(context: ctx)
            entity.date             = c.date
            entity.dayOfWeek        = c.dayOfWeek
            entity.isHolidayShifted = c.isHolidayShifted
            entity.originalDate     = c.originalDate
            entity.eventType        = c.eventType.rawValue
            entity.typesJSON        = encodedTypes(c.types)
            entity.zone             = zone
        }
    }

    private static func encodedTypes(_ types: [BinType]) -> String {
        let raw = types.map(\.rawValue)
        guard
            let data = try? JSONEncoder().encode(raw),
            let str  = String(data: data, encoding: .utf8)
        else { return "[]" }
        return str
    }
}
