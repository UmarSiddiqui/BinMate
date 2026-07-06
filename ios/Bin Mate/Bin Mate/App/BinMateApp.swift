import StoreKit
import SwiftUI

@main
struct BinMateApp: App {

    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    @StateObject private var appState           = AppState()

    init() {
        // Initialise early so UNUserNotificationCenterDelegate is registered before
        // the system delivers any pending notifications at launch.
        _ = NotificationService.shared
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(appState)
                .preferredColorScheme(.dark) // BinMate is dark-mode only
        }
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
            OnboardingView()
        }
    }
}

// MARK: - Main tab bar (placeholder)

/// Tab indices — keep in sync with TabView order.
private enum Tab: Int {
    case home = 0, calendar, sites, settings
}

private struct MainTabView: View {

    @EnvironmentObject private var appState: AppState
    @Environment(\.requestReview) private var requestReview
    @State private var selectedTab: Tab = .home

    /// The number of notifications after which we request an App Store review.
    private static let reviewTriggerCount = 3

    var body: some View {
        TabView(selection: $selectedTab) {
            HomeView()
                .tabItem { Label("Home", systemImage: BinMateTheme.Symbols.home) }
                .tag(Tab.home)

            CalendarView()
                .tabItem { Label("Calendar", systemImage: BinMateTheme.Symbols.calendar) }
                .tag(Tab.calendar)

            SitesView()
                .tabItem { Label("Sites", systemImage: BinMateTheme.Symbols.sites) }
                .tag(Tab.sites)

            SettingsView()
                .tabItem { Label("Settings", systemImage: BinMateTheme.Symbols.settings) }
                .tag(Tab.settings)
        }
        .tint(BinMateTheme.Colors.lime)
        .onReceive(NotificationCenter.default.publisher(for: .binMateNotificationTapped)) { _ in
            // Notification tap always opens the Home tab.
            selectedTab = .home
        }
        .onReceive(NotificationCenter.default.publisher(for: .binMateNotificationDelivered)) { _ in
            appState.notificationReceivedCount += 1
            if appState.notificationReceivedCount == Self.reviewTriggerCount {
                requestReview()
            }
        }
    }
}
