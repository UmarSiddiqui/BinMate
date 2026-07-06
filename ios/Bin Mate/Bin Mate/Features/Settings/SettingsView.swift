import SwiftUI
import RevenueCatUI

/// Settings screen — address management, notification preferences, subscription, and app info.
struct SettingsView: View {

    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var entitlementService: EntitlementService
    @StateObject private var viewModel = SettingsViewModel()

    @State private var showPaywall        = false
    @State private var showCustomerCenter = false
    @State private var showResetConfirm   = false
    @State private var showBinGuide       = false

    var body: some View {
        NavigationStack {
            List {
                addressSection
                additionalAddressesSection
                notificationsSection
                subscriptionSection
                aboutSection
            }
            .navigationTitle("Settings")
            .scrollContentBackground(.hidden)
            .background(BinMateTheme.Colors.bgBase)
            .task { await viewModel.refreshNotificationStatus() }
            .alert("Enable in Settings", isPresented: $viewModel.showOpenSettingsAlert) {
                Button("Open Settings") { viewModel.openSystemSettings() }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Notification access is off. Open Settings to enable bin day reminders.")
            }
            .alert("Change address?", isPresented: $showResetConfirm) {
                Button("Change", role: .destructive) { appState.resetAddress() }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("This will take you back to address setup.")
            }
        }
        .binMatePaywall(isPresented: $showPaywall)
        .sheet(isPresented: $showCustomerCenter) { CustomerCenterView() }
        .sheet(isPresented: $showBinGuide) { NavigationStack { BinGuideView() } }
    }

    // MARK: - Address

    private var addressSection: some View {
        Section("Address") {
            if let suburb = appState.primarySuburb,
               let council = appState.primaryCouncilName {
                VStack(alignment: .leading, spacing: BinMateTheme.Spacing.xs) {
                    Text(suburb)
                        .font(BinMateTheme.Typography.body)
                        .foregroundStyle(BinMateTheme.Colors.textPrimary)
                    Text(council)
                        .font(BinMateTheme.Typography.bodySmall)
                        .foregroundStyle(BinMateTheme.Colors.textSecondary)
                }
                .padding(.vertical, BinMateTheme.Spacing.xs)
            } else {
                Text("No address set")
                    .foregroundStyle(BinMateTheme.Colors.textMuted)
            }
            Button("Change address") { showResetConfirm = true }
                .foregroundStyle(BinMateTheme.Colors.lime)
        }
    }

    // MARK: - Additional addresses (Premium-gated)

    private var additionalAddressesSection: some View {
        Section {
            if entitlementService.isPremium {
                HStack {
                    Label("Add address", systemImage: "plus.circle")
                        .foregroundStyle(BinMateTheme.Colors.lime)
                    Spacer()
                    Text("Coming soon")
                        .font(BinMateTheme.Typography.bodySmall)
                        .foregroundStyle(BinMateTheme.Colors.textMuted)
                }
            } else {
                Button { showPaywall = true } label: {
                    HStack {
                        Image(systemName: "lock.fill")
                            .foregroundStyle(BinMateTheme.Colors.lime)
                        Text("Add a second address")
                            .foregroundStyle(BinMateTheme.Colors.textPrimary)
                        Spacer()
                        Text("Premium")
                            .font(BinMateTheme.Typography.label)
                            .foregroundStyle(BinMateTheme.Colors.lime)
                    }
                }
            }
        } header: {
            Text("Additional Addresses")
        }
    }

    // MARK: - Notifications

    private var notificationsSection: some View {
        Section("Notifications") {
            if entitlementService.isPremium {
                Toggle(isOn: Binding(
                    get: { viewModel.notificationsEnabled },
                    set: { _ in Task { await viewModel.handleNotificationsToggle() } }
                )) {
                    Label("Bin day reminders", systemImage: BinMateTheme.Symbols.bell)
                }
                .tint(BinMateTheme.Colors.lime)

                if viewModel.notificationsEnabled {
                    hourPickerRow
                    testNotificationRow
                }
            } else {
                // Free tier — push notifications are a Premium feature
                Button { showPaywall = true } label: {
                    HStack {
                        Label("Bin day reminders", systemImage: BinMateTheme.Symbols.bell)
                            .foregroundStyle(BinMateTheme.Colors.textPrimary)
                        Spacer()
                        Text("Premium")
                            .font(BinMateTheme.Typography.label)
                            .foregroundStyle(BinMateTheme.Colors.lime)
                    }
                }
                .accessibilityLabel("Bin day reminders, Premium feature — tap to upgrade")
            }
        }
    }

    private var hourPickerRow: some View {
        HStack {
            Label("Remind me at", systemImage: BinMateTheme.Symbols.clock)
                .foregroundStyle(BinMateTheme.Colors.textPrimary)
            Spacer()
            Picker("Reminder time", selection: $viewModel.notificationHour) {
                ForEach(SettingsViewModel.notificationHours, id: \.self) { hour in
                    Text(SettingsViewModel.formatHour(hour)).tag(hour)
                }
            }
            .pickerStyle(.menu)
            .tint(BinMateTheme.Colors.lime)
            .accessibilityLabel("Reminder time")
            .onChange(of: viewModel.notificationHour) { _ in
                Task { await viewModel.saveNotificationHour() }
            }
            if viewModel.isSavingHour {
                ProgressView()
                    .tint(BinMateTheme.Colors.lime)
                    .scaleEffect(0.8)
            }
        }
    }

    private var testNotificationRow: some View {
        Button { viewModel.sendTestNotification() } label: {
            HStack {
                Label("Send test notification", systemImage: "bell.badge")
                    .foregroundStyle(BinMateTheme.Colors.lime)
                Spacer()
                if viewModel.testNotificationSent {
                    Image(systemName: "checkmark")
                        .font(BinMateTheme.Typography.bodySmall)
                        .foregroundStyle(BinMateTheme.Colors.lime)
                        .accessibilityHidden(true)
                }
            }
        }
        .accessibilityLabel(viewModel.testNotificationSent
                            ? "Test notification sent"
                            : "Send test notification")
    }

    // MARK: - Subscription

    private var subscriptionSection: some View {
        Section("Subscription") {
            if entitlementService.isPremium {
                LabeledContent("Plan", value: "BinMate Premium")
                Button("Manage subscription") { showCustomerCenter = true }
                    .foregroundStyle(BinMateTheme.Colors.lime)
            } else {
                Button("Upgrade to Premium") { showPaywall = true }
                    .foregroundStyle(BinMateTheme.Colors.lime)
                Button("Restore Purchases") {
                    Task { try? await entitlementService.restorePurchases() }
                }
                .foregroundStyle(BinMateTheme.Colors.textSecondary)
            }
        }
    }

    // MARK: - About

    private var aboutSection: some View {
        Section("About") {
            Button { showBinGuide = true } label: {
                Label("Bin guide", systemImage: "info.circle")
                    .foregroundStyle(BinMateTheme.Colors.textPrimary)
            }
            LabeledContent(
                "Version",
                value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "–"
            )
            Link("Privacy policy", destination: URL(string: "https://binmate.app/privacy")!)
                .foregroundStyle(BinMateTheme.Colors.lime)
            Link("Contact support", destination: URL(string: "mailto:contact@binmate.app")!)
                .foregroundStyle(BinMateTheme.Colors.lime)
        }
    }
}
