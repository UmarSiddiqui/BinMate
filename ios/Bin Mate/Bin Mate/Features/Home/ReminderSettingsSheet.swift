import SwiftUI

/// Compact reminder settings popup — opened from the hero card bell button.
/// Reuses SettingsViewModel so behaviour matches the Settings screen exactly.
struct ReminderSettingsSheet: View {

    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel = SettingsViewModel()

    var body: some View {
        NavigationStack {
            ZStack {
                BinMateTheme.Colors.bgBase.ignoresSafeArea()

                VStack(spacing: BinMateTheme.Spacing.sm) {
                    toggleRow
                    if viewModel.notificationsEnabled {
                        hourRow
                        testRow
                    }
                    Spacer()
                }
                .padding(BinMateTheme.Spacing.lg)
            }
            .navigationTitle("Reminders")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                        .foregroundStyle(BinMateTheme.Colors.textSecondary)
                }
            }
        }
        .preferredColorScheme(.dark)
        .task { await viewModel.refreshNotificationStatus() }
        .alert("Enable in Settings", isPresented: $viewModel.showOpenSettingsAlert) {
            Button("Open Settings") { viewModel.openSystemSettings() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Notification access is off. Open Settings to enable bin day reminders.")
        }
    }

    // MARK: - Rows

    private var toggleRow: some View {
        HStack(spacing: BinMateTheme.Spacing.sm) {
            BinMateIconBadge(
                systemName: BinMateTheme.Symbols.bell,
                foreground: BinMateTheme.Colors.lime,
                background: BinMateTheme.Colors.limeFaint,
                size: 32,
                symbolSize: 14
            )
            Text("Bin day reminders")
                .font(BinMateTheme.Typography.body)
                .foregroundColor(BinMateTheme.Colors.textPrimary)
            Spacer()
            Toggle("", isOn: Binding(
                get: { viewModel.notificationsEnabled },
                set: { _ in Task { await viewModel.handleNotificationsToggle() } }
            ))
            .labelsHidden()
            .tint(BinMateTheme.Colors.lime)
            .accessibilityLabel("Bin day reminders")
        }
        .padding(BinMateTheme.Spacing.md)
        .background(BinMateTheme.Colors.bgRaised)
        .clipShape(RoundedRectangle(cornerRadius: BinMateTheme.Radius.lg))
    }

    private var hourRow: some View {
        HStack(spacing: BinMateTheme.Spacing.sm) {
            BinMateIconBadge(
                systemName: BinMateTheme.Symbols.clock,
                foreground: BinMateTheme.Colors.teal,
                background: BinMateTheme.Colors.tealFaint,
                size: 32,
                symbolSize: 14
            )
            Text("Remind me at")
                .font(BinMateTheme.Typography.body)
                .foregroundColor(BinMateTheme.Colors.textPrimary)
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
        .padding(BinMateTheme.Spacing.md)
        .background(BinMateTheme.Colors.bgRaised)
        .clipShape(RoundedRectangle(cornerRadius: BinMateTheme.Radius.lg))
    }

    private var testRow: some View {
        Button { viewModel.sendTestNotification() } label: {
            HStack(spacing: BinMateTheme.Spacing.sm) {
                BinMateIconBadge(
                    systemName: "bell.badge",
                    foreground: BinMateTheme.Colors.amber,
                    background: BinMateTheme.Colors.amberFaint,
                    size: 32,
                    symbolSize: 14
                )
                Text("Send test notification")
                    .font(BinMateTheme.Typography.body)
                    .foregroundColor(BinMateTheme.Colors.lime)
                Spacer()
                if viewModel.testNotificationSent {
                    Image(systemName: BinMateTheme.Symbols.checkmark)
                        .font(BinMateTheme.Typography.bodySmall)
                        .foregroundColor(BinMateTheme.Colors.lime)
                        .accessibilityHidden(true)
                }
            }
            .padding(BinMateTheme.Spacing.md)
            .background(BinMateTheme.Colors.bgRaised)
            .clipShape(RoundedRectangle(cornerRadius: BinMateTheme.Radius.lg))
        }
        .buttonStyle(.pressableCard)
        .accessibilityLabel(viewModel.testNotificationSent
                            ? "Test notification sent"
                            : "Send test notification")
    }
}
