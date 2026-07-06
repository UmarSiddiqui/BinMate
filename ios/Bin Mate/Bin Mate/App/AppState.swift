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

    /// Incremented each time a notification is delivered. Used to trigger App Store review request.
    @Published var notificationReceivedCount: Int

    // MARK: - UserDefaults keys

    private enum Keys {
        static let onboardingComplete = "appstate.onboarding_complete"
        static let primaryZoneId      = "appstate.zone_id"
        static let primarySuburb      = "appstate.suburb"
        static let primaryCouncilName = "appstate.council_name"
        static let additionalAddresses = "appstate.additional_addresses"
        static let notificationCount  = "appstate.notification_count"
    }

    // MARK: - Init

    init() {
        let d = UserDefaults.standard
        isOnboardingComplete    = d.bool(forKey: Keys.onboardingComplete)
        primaryZoneId           = d.string(forKey: Keys.primaryZoneId)
        primarySuburb           = d.string(forKey: Keys.primarySuburb)
        primaryCouncilName      = d.string(forKey: Keys.primaryCouncilName)
        additionalAddresses     = Self.loadAdditionalAddresses(from: d)
        notificationReceivedCount = d.integer(forKey: Keys.notificationCount)
    }

    // MARK: - Actions

    /// Marks onboarding complete and persists the user's primary zone.
    /// Called by OnboardingView once all three steps finish.
    func completeOnboarding(zoneId: String, councilName: String, suburb: String) {
        primaryZoneId        = zoneId
        primaryCouncilName   = councilName
        primarySuburb        = suburb
        isOnboardingComplete = true
        let d = UserDefaults.standard
        d.set(zoneId,      forKey: Keys.primaryZoneId)
        d.set(councilName, forKey: Keys.primaryCouncilName)
        d.set(suburb,      forKey: Keys.primarySuburb)
        d.set(true,        forKey: Keys.onboardingComplete)
        Logger.app.info("Onboarding complete — zone \(zoneId)")
    }

    /// Saves an additional address zone. Existing zones are not duplicated.
    func addAdditionalAddress(zoneId: String, councilName: String, suburb: String) {
        guard zoneId != primaryZoneId else { return }
        let address = SavedAddress(zoneId: zoneId, suburb: suburb, councilName: councilName)
        if !additionalAddresses.contains(address) {
            additionalAddresses.append(address)
            persistAdditionalAddresses()
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
    }

    /// Removes an additional saved address.
    func removeAdditionalAddress(_ address: SavedAddress) {
        additionalAddresses.removeAll { $0.zoneId == address.zoneId }
        persistAdditionalAddresses()
    }

    /// Clears address data and restarts onboarding flow. Called from Settings "Change address".
    func resetAddress() {
        primaryZoneId        = nil
        primarySuburb        = nil
        primaryCouncilName   = nil
        additionalAddresses  = []
        isOnboardingComplete = false
        let d = UserDefaults.standard
        d.removeObject(forKey: Keys.primaryZoneId)
        d.removeObject(forKey: Keys.primarySuburb)
        d.removeObject(forKey: Keys.primaryCouncilName)
        d.removeObject(forKey: Keys.additionalAddresses)
        d.removeObject(forKey: Keys.onboardingComplete)
        Logger.app.info("Address reset — returning to onboarding")
    }

    /// Increments the notification received count and persists it.
    func recordNotificationReceived() {
        notificationReceivedCount += 1
        UserDefaults.standard.set(notificationReceivedCount, forKey: Keys.notificationCount)
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
}
