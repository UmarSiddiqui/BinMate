import CoreData

// MARK: - CouncilEntity

/// CoreData entity for cached council metadata.
@objc(CouncilEntity)
final class CouncilEntity: NSManagedObject {
    @NSManaged var councilId: String
    @NSManaged var name: String
    @NSManaged var zones: NSSet

    static func fetchRequest() -> NSFetchRequest<CouncilEntity> {
        NSFetchRequest<CouncilEntity>(entityName: "CouncilEntity")
    }
}

// MARK: - ZoneEntity

/// CoreData entity for a cached collection zone and its schedule TTL.
@objc(ZoneEntity)
final class ZoneEntity: NSManagedObject {
    @NSManaged var zoneId: String
    @NSManaged var councilName: String
    @NSManaged var cachedAt: Date
    @NSManaged var expiresAt: Date
    @NSManaged var council: CouncilEntity?
    @NSManaged var collections: NSSet

    static func fetchRequest() -> NSFetchRequest<ZoneEntity> {
        NSFetchRequest<ZoneEntity>(entityName: "ZoneEntity")
    }

    /// Typed, date-sorted access to the cached collection entries.
    var orderedCollections: [CollectionEntity] {
        (collections.allObjects as? [CollectionEntity] ?? [])
            .sorted { $0.date < $1.date }
    }
}

// MARK: - CollectionEntity

/// CoreData entity for a single cached collection event.
@objc(CollectionEntity)
final class CollectionEntity: NSManagedObject {
    @NSManaged var date: String
    @NSManaged var dayOfWeek: String
    /// JSON-encoded array of BinType raw values, e.g. `["general","recycling"]`.
    @NSManaged var typesJSON: String
    @NSManaged var isHolidayShifted: Bool
    @NSManaged var originalDate: String?
    @NSManaged var eventType: String
    @NSManaged var zone: ZoneEntity?

    static func fetchRequest() -> NSFetchRequest<CollectionEntity> {
        NSFetchRequest<CollectionEntity>(entityName: "CollectionEntity")
    }

    /// Convert the cached entity back to the API Collection model.
    /// Returns nil only if stored data is corrupt (should never happen in practice).
    func toCollection() -> Collection? {
        guard
            let rawTypes = try? JSONDecoder().decode([String].self, from: Data(typesJSON.utf8)),
            let eventTypeValue = Collection.EventType(rawValue: eventType)
        else { return nil }

        let binTypes = rawTypes.compactMap(BinType.init(rawValue:))

        return Collection(
            date: date,
            dayOfWeek: dayOfWeek,
            types: binTypes,
            isHolidayShifted: isHolidayShifted,
            originalDate: originalDate,
            eventType: eventTypeValue
        )
    }
}
