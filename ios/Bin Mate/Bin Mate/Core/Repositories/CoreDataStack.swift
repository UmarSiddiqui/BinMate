import CoreData
import OSLog

/// Manages the NSPersistentContainer and provides access to managed object contexts.
/// The model is built programmatically so no .xcdatamodeld file is required.
final class CoreDataStack {

    // MARK: - Singleton

    static let shared = CoreDataStack()
    private init() {}

    // MARK: - Container

    lazy var container: NSPersistentContainer = {
        let container = NSPersistentContainer(name: "BinMate", managedObjectModel: Self.makeModel())
        container.loadPersistentStores { _, error in
            if let error {
                Logger.persistence.critical("CoreData load failed: \(error.localizedDescription)")
                fatalError("CoreData: \(error)")
            }
        }
        container.viewContext.automaticallyMergesChangesFromParent = true
        container.viewContext.mergePolicy = NSMergeByPropertyObjectTrumpMergePolicy
        return container
    }()

    /// Main-thread context for UI reads.
    var viewContext: NSManagedObjectContext { container.viewContext }

    /// New private-queue context for background writes.
    func backgroundContext() -> NSManagedObjectContext {
        let ctx = container.newBackgroundContext()
        ctx.mergePolicy = NSMergeByPropertyObjectTrumpMergePolicy
        return ctx
    }

    /// Saves a context, logging any error. No-op if there are no changes.
    func save(_ context: NSManagedObjectContext) {
        guard context.hasChanges else { return }
        do {
            try context.save()
        } catch {
            Logger.persistence.error("CoreData save failed: \(error.localizedDescription)")
        }
    }

    /// Runs a block on a background context. Called from MainActor; work is performed off main thread.
    func performBackgroundTask(_ block: @escaping (NSManagedObjectContext) -> Void) {
        container.performBackgroundTask { ctx in
            ctx.mergePolicy = NSMergeByPropertyObjectTrumpMergePolicy
            block(ctx)
            if ctx.hasChanges {
                do {
                    try ctx.save()
                } catch {
                    Logger.persistence.error("CoreData background save failed: \(error.localizedDescription)")
                }
            }
        }
    }

    // MARK: - Programmatic model

    static func makeModel() -> NSManagedObjectModel {
        let model = NSManagedObjectModel()

        let council    = makeCouncilEntity()
        let zone       = makeZoneEntity()
        let collection = makeCollectionEntity()

        wireRelationships(council: council, zone: zone, collection: collection)

        model.entities = [council, zone, collection]
        return model
    }

    // MARK: - Entity factories

    private static func makeCouncilEntity() -> NSEntityDescription {
        let e = NSEntityDescription()
        e.name = "CouncilEntity"
        e.managedObjectClassName = "CouncilEntity"
        e.properties = [
            attr("councilId", type: .stringAttributeType),
            attr("name",      type: .stringAttributeType)
        ]
        return e
    }

    private static func makeZoneEntity() -> NSEntityDescription {
        let e = NSEntityDescription()
        e.name = "ZoneEntity"
        e.managedObjectClassName = "ZoneEntity"
        e.properties = [
            attr("zoneId",      type: .stringAttributeType),
            attr("councilName", type: .stringAttributeType),
            attr("cachedAt",    type: .dateAttributeType),
            attr("expiresAt",   type: .dateAttributeType)
        ]
        return e
    }

    private static func makeCollectionEntity() -> NSEntityDescription {
        let e = NSEntityDescription()
        e.name = "CollectionEntity"
        e.managedObjectClassName = "CollectionEntity"
        e.properties = [
            attr("date",             type: .stringAttributeType),
            attr("dayOfWeek",        type: .stringAttributeType),
            attr("typesJSON",        type: .stringAttributeType),
            attr("isHolidayShifted", type: .booleanAttributeType),
            attr("originalDate",     type: .stringAttributeType, optional: true),
            attr("eventType",        type: .stringAttributeType)
        ]
        return e
    }

    // MARK: - Relationships

    private static func wireRelationships(
        council: NSEntityDescription,
        zone: NSEntityDescription,
        collection: NSEntityDescription
    ) {
        // ZoneEntity ↔ CollectionEntity (one-to-many, cascade delete)
        let zoneToCollections = rel("collections", dest: collection, toMany: true,  delete: .cascadeDeleteRule)
        let collectionToZone  = rel("zone",        dest: zone,       toMany: false, delete: .nullifyDeleteRule)
        zoneToCollections.inverseRelationship = collectionToZone
        collectionToZone.inverseRelationship  = zoneToCollections
        zone.properties       += [zoneToCollections]
        collection.properties += [collectionToZone]

        // CouncilEntity ↔ ZoneEntity (one-to-many, cascade delete)
        let councilToZones = rel("zones",   dest: zone,    toMany: true,  delete: .cascadeDeleteRule)
        let zoneToCouncil  = rel("council", dest: council, toMany: false, delete: .nullifyDeleteRule)
        councilToZones.inverseRelationship = zoneToCouncil
        zoneToCouncil.inverseRelationship  = councilToZones
        council.properties += [councilToZones]
        zone.properties    += [zoneToCouncil]
    }

    // MARK: - Helpers

    private static func attr(
        _ name: String,
        type: NSAttributeType,
        optional: Bool = false
    ) -> NSAttributeDescription {
        let a = NSAttributeDescription()
        a.name = name
        a.attributeType = type
        a.isOptional = optional
        return a
    }

    private static func rel(
        _ name: String,
        dest: NSEntityDescription,
        toMany: Bool,
        delete: NSDeleteRule
    ) -> NSRelationshipDescription {
        let r = NSRelationshipDescription()
        r.name = name
        r.destinationEntity = dest
        r.minCount = 0
        r.maxCount = toMany ? 0 : 1  // 0 = unlimited (to-many)
        r.deleteRule = delete
        r.isOptional = true
        return r
    }
}
