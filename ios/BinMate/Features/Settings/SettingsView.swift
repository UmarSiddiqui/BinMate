import SwiftUI
import RevenueCatUI

/// Settings screen — address, notifications, subscription management.
/// Full implementation: Phase 3.5
struct SettingsView: View {

    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var entitlementService: EntitlementService

    @State private var showPaywall        = false
    @State private var showCustomerCenter = false

    var body: some View {
        NavigationStack {
            List {
                // ── Address ──────────────────────────────────────────────
                Section("Address") {
                    if let suburb = appState.primarySuburb,
                       let council = appState.primaryCouncilName {
                        LabeledContent(suburb, value: council)
                    }
                    Button("Change address") {
                        appState.resetAddress()
                    }
                    .foregroundColor(BinMateTheme.Colors.lime)
                }

                // ── Notifications ─────────────────────────────────────────
                // TODO Phase 3.5: notification toggle + time picker

                // ── Subscription ──────────────────────────────────────────
                Section("Subscription") {
                    if entitlementService.isPremium {
                        LabeledContent("Plan", value: "BinMate Premium")
                        Button("Manage subscription") {
                            showCustomerCenter = true
                        }
                        .foregroundColor(BinMateTheme.Colors.lime)
                    } else {
                        Button("Upgrade to Premium") {
                            showPaywall = true
                        }
                        .foregroundColor(BinMateTheme.Colors.lime)
                    }
                }

                // ── About ──────────────────────────────────────────────────
                Section("About") {
                    LabeledContent(
                        "Version",
                        value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "–"
                    )
                    Link("Privacy policy", destination: URL(string: "https://binmate.app/privacy")!)
                    Link("Support", destination: URL(string: "https://binmate.app/support")!)
                }
            }
            .navigationTitle("Settings")
            .scrollContentBackground(.hidden)
            .background(BinMateTheme.Colors.bgBase)
        }
        // RevenueCat paywall sheet
        .binMatePaywall(isPresented: $showPaywall)
        // RevenueCat Customer Center — manage subscription, get support, request refunds
        .sheet(isPresented: $showCustomerCenter) {
            CustomerCenterView()
        }
    }
}
