import Combine
import Foundation
import OSLog

/// Saved non-primary address metadata. Never store raw street address.
struct SavedAddress: Identifiable, Codable, Equatable {
    let zoneId: String
    let suburb: String
    let councilName: String

    var id: String { zoneId }
}

/// Global app state persisted in UserDefaults.
/// Holds onboarding completion and the user's primary zone — never stores raw addresses (CLAUDE.md §9).
@MainActor
final class AppState: ObservableObject {

    // MARK: - Published

    @Published private(set) var isOnboardingComplete: Bool
    @Published private(set) var primaryZoneId: String?
    @Published private(set) var primarySuburb: String?
    @Published private(set) var primaryCouncilName: String?
    @Published private(set) var additionalAddresses: [SavedAddress]

    /// Zones the user has muted bin reminders for. Muted zones stay saved and
    /// switchable — they're just excluded from the backend reminder sync.
    @Published private(set) var mutedZoneIds: Set<String>

    /// Incremented each time a notification is delivered. Used to trigger App Store review request.
    @Published var notificationReceivedCount: Int

    // MARK: - UserDefaults keys

    private enum Keys {
        static let onboardingComplete = "appstate.onboarding_complete"
        static let primaryZoneId      = "appstate.zone_id"
        static let primarySuburb      = "appstate.suburb"
        static let primaryCouncilName = "appstate.council_name"
        static let additionalAddresses = "appstate.additional_addresses"
        static let mutedZoneIds       = "appstate.muted_zone_ids"
        static let notificationCount  = "appstate.notification_count"
    }

    /// Backend caps zone subscriptions per device (user_zones sync endpoint).
    static let maxSavedAddresses = 5

    // MARK: - Init

    init() {
        let d = UserDefaults.standard
        isOnboardingComplete    = d.bool(forKey: Keys.onboardingComplete)
        primaryZoneId           = d.string(forKey: Keys.primaryZoneId)
        primarySuburb           = d.string(forKey: Keys.primarySuburb)
        primaryCouncilName      = d.string(forKey: Keys.primaryCouncilName)
        additionalAddresses     = Self.loadAdditionalAddresses(from: d)
        mutedZoneIds            = Self.loadMutedZoneIds(from: d)
        notificationReceivedCount = d.integer(forKey: Keys.notificationCount)
    }

    // MARK: - Actions

    /// Marks onboarding complete and persists the user's primary zone.
    /// Called by OnboardingView once all three steps finish.
    func completeOnboarding(zoneId: String, councilName: String, suburb: String) {
        let cleanSuburb      = suburb.sanitizedSuburb
        primaryZoneId        = zoneId
        primaryCouncilName   = councilName
        primarySuburb        = cleanSuburb
        isOnboardingComplete = true
        let d = UserDefaults.standard
        d.set(zoneId,       forKey: Keys.primaryZoneId)
        d.set(councilName,  forKey: Keys.primaryCouncilName)
        d.set(cleanSuburb,  forKey: Keys.primarySuburb)
        d.set(true,        forKey: Keys.onboardingComplete)
        Logger.app.info("Onboarding complete — zone \(zoneId)")
        ZoneSyncService.shared.requestSync()
    }

    /// Saves an additional address zone. Existing zones are not duplicated,
    /// and the total is capped at `maxSavedAddresses` (backend sync limit).
    func addAdditionalAddress(zoneId: String, councilName: String, suburb: String) {
        guard zoneId != primaryZoneId else { return }
        guard additionalAddresses.count + 1 < Self.maxSavedAddresses else { return }
        let address = SavedAddress(zoneId: zoneId, suburb: suburb.sanitizedSuburb, councilName: councilName)
        if !additionalAddresses.contains(address) {
            additionalAddresses.append(address)
            persistAdditionalAddresses()
            ZoneSyncService.shared.requestSync()
        }
    }

    /// Promotes a saved address to primary and keeps the old primary as additional.
    func makePrimary(_ address: SavedAddress) {
        let previous = currentPrimaryAddress
        primaryZoneId = address.zoneId
        primarySuburb = address.suburb
        primaryCouncilName = address.councilName

        additionalAddresses.removeAll { $0.zoneId == address.zoneId }
        if let previous, !additionalAddresses.contains(previous) {
            additionalAddresses.append(previous)
        }
        persistPrimaryAddress()
        persistAdditionalAddresses()
        ZoneSyncService.shared.requestSync()
    }

    /// Removes an additional saved address.
    func removeAdditionalAddress(_ address: SavedAddress) {
        additionalAddresses.removeAll { $0.zoneId == address.zoneId }
        mutedZoneIds.remove(address.zoneId)
        persistAdditionalAddresses()
        persistMutedZoneIds()
        ZoneSyncService.shared.requestSync()
    }

    /// Returns whether bin reminders are on for a zone.
    func remindersEnabled(forZone zoneId: String) -> Bool {
        !mutedZoneIds.contains(zoneId)
    }

    /// Mutes or unmutes bin reminders for one saved house and re-syncs the backend.
    func setReminders(enabled: Bool, forZone zoneId: String) {
        if enabled {
            mutedZoneIds.remove(zoneId)
        } else {
            mutedZoneIds.insert(zoneId)
        }
        persistMutedZoneIds()
        ZoneSyncService.shared.requestSync()
        Logger.app.info("Reminders \(enabled ? "enabled" : "muted") for zone \(zoneId)")
    }

    /// Clears address data and restarts onboarding flow. Called from Settings "Change address".
    func resetAddress() {
        primaryZoneId        = nil
        primarySuburb        = nil
        primaryCouncilName   = nil
        additionalAddresses  = []
        mutedZoneIds         = []
        isOnboardingComplete = false
        let d = UserDefaults.standard
        d.removeObject(forKey: Keys.primaryZoneId)
        d.removeObject(forKey: Keys.primarySuburb)
        d.removeObject(forKey: Keys.primaryCouncilName)
        d.removeObject(forKey: Keys.additionalAddresses)
        d.removeObject(forKey: Keys.mutedZoneIds)
        d.removeObject(forKey: Keys.onboardingComplete)
        Logger.app.info("Address reset — returning to onboarding")
        ZoneSyncService.shared.requestSync()
    }

    /// Increments the notification received count and persists it.
    func recordNotificationReceived() {
        notificationReceivedCount += 1
        UserDefaults.standard.set(notificationReceivedCount, forKey: Keys.notificationCount)
    }

    // MARK: - Zone sync source

    /// Zone entries for backend reminder sync, built from persisted state so
    /// ZoneSyncService can run even before an AppState instance exists
    /// (e.g. when the APNs token arrives at launch). Primary zone comes first;
    /// muted zones are excluded so the cron never notifies them.
    static func persistedZoneSyncEntries() -> [UserZoneSyncEntry] {
        let d = UserDefaults.standard
        let muted = loadMutedZoneIds(from: d)
        var entries: [UserZoneSyncEntry] = []
        if let zoneId = d.string(forKey: Keys.primaryZoneId) {
            let label = d.string(forKey: Keys.primarySuburb) ?? "Home"
            entries.append(UserZoneSyncEntry(zoneId: zoneId, addressLabel: label, isPrimary: true))
        }
        entries += loadAdditionalAddresses(from: d).map {
            UserZoneSyncEntry(zoneId: $0.zoneId, addressLabel: $0.suburb, isPrimary: false)
        }
        return entries.filter { !muted.contains($0.zoneId) }
    }

    // MARK: - Persistence

    private var currentPrimaryAddress: SavedAddress? {
        guard let zoneId = primaryZoneId,
              let suburb = primarySuburb,
              let councilName = primaryCouncilName else { return nil }
        return SavedAddress(zoneId: zoneId, suburb: suburb, councilName: councilName)
    }

    private func persistPrimaryAddress() {
        let d = UserDefaults.standard
        d.set(primaryZoneId, forKey: Keys.primaryZoneId)
        d.set(primaryCouncilName, forKey: Keys.primaryCouncilName)
        d.set(primarySuburb, forKey: Keys.primarySuburb)
    }

    private func persistAdditionalAddresses() {
        guard let data = try? JSONEncoder().encode(additionalAddresses) else { return }
        UserDefaults.standard.set(data, forKey: Keys.additionalAddresses)
    }

    private static func loadAdditionalAddresses(from defaults: UserDefaults) -> [SavedAddress] {
        guard let data = defaults.data(forKey: Keys.additionalAddresses),
              let addresses = try? JSONDecoder().decode([SavedAddress].self, from: data) else {
            return []
        }
        return addresses
    }

    private func persistMutedZoneIds() {
        guard let data = try? JSONEncoder().encode(Array(mutedZoneIds)) else { return }
        UserDefaults.standard.set(data, forKey: Keys.mutedZoneIds)
    }

    private static func loadMutedZoneIds(from defaults: UserDefaults) -> Set<String> {
        guard let data = defaults.data(forKey: Keys.mutedZoneIds),
              let ids = try? JSONDecoder().decode([String].self, from: data) else {
            return []
        }
        return Set(ids)
    }
}
