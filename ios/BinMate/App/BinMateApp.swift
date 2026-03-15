import SwiftUI
import RevenueCat

@main
struct BinMateApp: App {

    @StateObject private var appState         = AppState()
    @StateObject private var entitlementService = EntitlementService.shared

    init() {
        configureRevenueCat()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(appState)
                .environmentObject(entitlementService)
                .preferredColorScheme(.dark) // BinMate is dark-mode only
        }
    }

    // MARK: - RevenueCat

    private func configureRevenueCat() {
        #if DEBUG
        Purchases.logLevel = .debug
        #endif
        Purchases.configure(withAPIKey: Configuration.revenueCatAPIKey)
        entitlementService.start()
    }
}

// MARK: - Root routing view

/// Routes between Onboarding and the main tab bar based on AppState.
private struct RootView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        if appState.isOnboardingComplete {
            MainTabView()
        } else {
            // TODO Phase 3.2: Replace with OnboardingView()
            Text("Onboarding")
                .foregroundColor(BinMateTheme.Colors.textPrimary)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(BinMateTheme.Colors.bgBase)
        }
    }
}

// MARK: - Main tab bar (placeholder)

private struct MainTabView: View {
    var body: some View {
        TabView {
            // TODO Phase 3.3: HomeView()
            Text("Home")
                .tabItem { Label("Home", systemImage: BinMateTheme.Symbols.home) }

            // TODO Phase 3.4: CalendarView()
            Text("Calendar")
                .tabItem { Label("Calendar", systemImage: BinMateTheme.Symbols.calendar) }

            // TODO Phase 3.5: SettingsView()
            Text("Settings")
                .tabItem { Label("Settings", systemImage: BinMateTheme.Symbols.settings) }
        }
        .tint(BinMateTheme.Colors.lime)
    }
}
