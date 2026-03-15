import SwiftUI

/// Global app state shared across all features via @EnvironmentObject.
@MainActor
final class AppState: ObservableObject {

    // MARK: - Onboarding

    @Published var isOnboardingComplete: Bool {
        didSet { UserDefaults.standard.set(isOnboardingComplete, forKey: Keys.onboardingComplete) }
    }

    // MARK: - Zone / Council

    /// The user's primary zone ID — stored in UserDefaults, resolved during onboarding.
    @Published var primaryZoneId: String? {
        didSet { UserDefaults.standard.set(primaryZoneId, forKey: Keys.primaryZoneId) }
    }

    @Published var primaryCouncilName: String? {
        didSet { UserDefaults.standard.set(primaryCouncilName, forKey: Keys.primaryCouncilName) }
    }

    @Published var primarySuburb: String? {
        didSet { UserDefaults.standard.set(primarySuburb, forKey: Keys.primarySuburb) }
    }

    // MARK: - Init

    init() {
        let defaults = UserDefaults.standard
        self.isOnboardingComplete = defaults.bool(forKey: Keys.onboardingComplete)
        self.primaryZoneId        = defaults.string(forKey: Keys.primaryZoneId)
        self.primaryCouncilName   = defaults.string(forKey: Keys.primaryCouncilName)
        self.primarySuburb        = defaults.string(forKey: Keys.primarySuburb)
    }

    // MARK: - Actions

    /// Called after onboarding completes successfully.
    func completeOnboarding(zoneId: String, councilName: String, suburb: String) {
        primaryZoneId     = zoneId
        primaryCouncilName = councilName
        primarySuburb     = suburb
        isOnboardingComplete = true
    }

    /// Reset all state — used if the user changes their address.
    func resetAddress() {
        primaryZoneId      = nil
        primaryCouncilName = nil
        primarySuburb      = nil
        isOnboardingComplete = false
    }

    // MARK: - Keys

    private enum Keys {
        static let onboardingComplete = "onboarding_complete"
        static let primaryZoneId      = "primary_zone_id"
        static let primaryCouncilName = "primary_council_name"
        static let primarySuburb      = "primary_suburb"
    }
}
