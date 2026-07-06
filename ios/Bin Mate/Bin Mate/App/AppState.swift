import Combine
import Foundation
import OSLog

/// Global app state persisted in UserDefaults.
/// Holds onboarding completion and the user's primary zone — never stores raw addresses (CLAUDE.md §9).
@MainActor
final class AppState: ObservableObject {

    // MARK: - Published

    @Published private(set) var isOnboardingComplete: Bool
    @Published private(set) var primaryZoneId: String?
    @Published private(set) var primarySuburb: String?
    @Published private(set) var primaryCouncilName: String?

    /// Incremented each time a notification is delivered. Used to trigger App Store review request.
    @Published var notificationReceivedCount: Int

    // MARK: - UserDefaults keys

    private enum Keys {
        static let onboardingComplete = "appstate.onboarding_complete"
        static let primaryZoneId      = "appstate.zone_id"
        static let primarySuburb      = "appstate.suburb"
        static let primaryCouncilName = "appstate.council_name"
        static let notificationCount  = "appstate.notification_count"
    }

    // MARK: - Init

    init() {
        let d = UserDefaults.standard
        isOnboardingComplete    = d.bool(forKey: Keys.onboardingComplete)
        primaryZoneId           = d.string(forKey: Keys.primaryZoneId)
        primarySuburb           = d.string(forKey: Keys.primarySuburb)
        primaryCouncilName      = d.string(forKey: Keys.primaryCouncilName)
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

    /// Clears address data and restarts onboarding flow. Called from Settings "Change address".
    func resetAddress() {
        primaryZoneId        = nil
        primarySuburb        = nil
        primaryCouncilName   = nil
        isOnboardingComplete = false
        let d = UserDefaults.standard
        d.removeObject(forKey: Keys.primaryZoneId)
        d.removeObject(forKey: Keys.primarySuburb)
        d.removeObject(forKey: Keys.primaryCouncilName)
        d.removeObject(forKey: Keys.onboardingComplete)
        Logger.app.info("Address reset — returning to onboarding")
    }

    /// Increments the notification received count and persists it.
    func recordNotificationReceived() {
        notificationReceivedCount += 1
        UserDefaults.standard.set(notificationReceivedCount, forKey: Keys.notificationCount)
    }
}
