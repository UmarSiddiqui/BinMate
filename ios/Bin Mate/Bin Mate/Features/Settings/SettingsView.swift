import SwiftUI

/// Settings screen — address management, notification preferences, and app info.
struct SettingsView: View {

    @EnvironmentObject private var appState: AppState
    @StateObject private var viewModel = SettingsViewModel()

    @State private var showResetConfirm   = false
    @State private var showBinGuide       = false
    @State private var showAddAddress     = false
    @State private var showFeedback       = false

    var body: some View {
        NavigationStack {
            List {
                addressSection
                additionalAddressesSection
                notificationsSection
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
        .sheet(isPresented: $showBinGuide) { NavigationStack { BinGuideView() } }
        .sheet(isPresented: $showFeedback) { FeedbackSheet() }
        .sheet(isPresented: $showAddAddress) {
            AdditionalAddressSheet { result in
                appState.addAdditionalAddress(
                    zoneId: result.zoneId,
                    councilName: result.councilName,
                    suburb: result.suburb
                )
            }
        }
    }

    // MARK: - Address

    private var addressSection: some View {
        Section("Address") {
            if let suburb = appState.primarySuburb,
               let council = appState.primaryCouncilName,
               let zoneId = appState.primaryZoneId {
                HStack {
                    VStack(alignment: .leading, spacing: BinMateTheme.Spacing.xs) {
                        Text(suburb)
                            .font(BinMateTheme.Typography.body)
                            .foregroundStyle(BinMateTheme.Colors.textPrimary)
                        Text(council)
                            .font(BinMateTheme.Typography.bodySmall)
                            .foregroundStyle(BinMateTheme.Colors.textSecondary)
                    }
                    Spacer()
                    reminderToggle(zoneId: zoneId, suburb: suburb)
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

    /// Bell toggle controlling reminders for one house. Muted zones are dropped
    /// from the backend sync, so the nightly cron skips them.
    private func reminderToggle(zoneId: String, suburb: String) -> some View {
        let isOn = appState.remindersEnabled(forZone: zoneId)
        return HStack(spacing: BinMateTheme.Spacing.sm) {
            Image(systemName: isOn ? BinMateTheme.Symbols.bell : "bell.slash")
                .font(BinMateTheme.Typography.bodySmall)
                .foregroundStyle(isOn ? BinMateTheme.Colors.lime : BinMateTheme.Colors.textMuted)
                .accessibilityHidden(true)
            Toggle(isOn: Binding(
                get: { appState.remindersEnabled(forZone: zoneId) },
                set: { appState.setReminders(enabled: $0, forZone: zoneId) }
            )) { EmptyView() }
            .labelsHidden()
            .tint(BinMateTheme.Colors.lime)
        }
        .accessibilityLabel("Bin reminders for \(suburb)")
    }

    // MARK: - Additional addresses

    private var additionalAddressesSection: some View {
        Section {
            ForEach(appState.additionalAddresses) { address in
                HStack {
                    Button {
                        appState.makePrimary(address)
                    } label: {
                        VStack(alignment: .leading, spacing: BinMateTheme.Spacing.xs) {
                            Text(address.suburb)
                                .font(BinMateTheme.Typography.body)
                                .foregroundStyle(BinMateTheme.Colors.textPrimary)
                            Text(address.councilName)
                                .font(BinMateTheme.Typography.bodySmall)
                                .foregroundStyle(BinMateTheme.Colors.textSecondary)
                            Text("Tap to switch")
                                .font(BinMateTheme.Typography.label)
                                .foregroundStyle(BinMateTheme.Colors.lime)
                        }
                    }
                    .buttonStyle(.plain)
                    Spacer()
                    reminderToggle(zoneId: address.zoneId, suburb: address.suburb)
                }
                .swipeActions {
                    Button("Remove", role: .destructive) {
                        appState.removeAdditionalAddress(address)
                    }
                }
            }

            if appState.additionalAddresses.count + 1 < AppState.maxSavedAddresses {
                Button { showAddAddress = true } label: {
                    Label("Add address", systemImage: "plus.circle")
                        .foregroundStyle(BinMateTheme.Colors.lime)
                }
            }
        } header: {
            Text("Additional Addresses")
        } footer: {
            Text("Use the bell to mute reminders per address (max \(AppState.maxSavedAddresses) addresses). Only suburb, council, and zone are saved — street addresses are not stored.")
        }
    }

    // MARK: - Notifications

    private var notificationsSection: some View {
        Section("Notifications") {
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

    private var aboutSection: some View {
        Section("About") {
            Button { showBinGuide = true } label: {
                Label("Bin guide", systemImage: "info.circle")
                    .foregroundStyle(BinMateTheme.Colors.textPrimary)
            }
            Button { showFeedback = true } label: {
                Label("Send feedback", systemImage: "bubble.left.and.exclamationmark.bubble.right")
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
