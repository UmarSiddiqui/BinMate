import SwiftUI

/// Home header — today's date plus the active house. Tapping the location opens
/// a switcher menu listing every saved address, so multi-house users can flip
/// between schedules without visiting Settings.
struct HomeHeaderView: View {

    @EnvironmentObject private var appState: AppState

    /// Invoked when the user picks "Add another address" from the menu.
    let onAddAddress: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: BinMateTheme.Spacing.xs) {
            Text(todayLabel)
                .font(BinMateTheme.Typography.label)
                .foregroundColor(BinMateTheme.Colors.textMuted)
                .kerning(1.5)

            Menu {
                menuContent
            } label: {
                locationLabel
            }
            .accessibilityLabel(switcherAccessibilityLabel)
        }
    }

    // MARK: - Menu

    @ViewBuilder
    private var menuContent: some View {
        if let current = currentLabel {
            Button {} label: {
                Label(current, systemImage: "checkmark")
            }
            .disabled(true)
        }

        ForEach(appState.additionalAddresses) { address in
            Button {
                withAnimation(BinMateTheme.Animation.default) {
                    appState.makePrimary(address)
                }
                HapticFeedback.impact(.light)
            } label: {
                Label(address.suburb, systemImage: "house")
            }
        }

        if appState.additionalAddresses.count + 1 < AppState.maxSavedAddresses {
            Divider()

            Button(action: onAddAddress) {
                Label("Add another address", systemImage: "plus.circle")
            }
        }
    }

    // MARK: - Label

    private var locationLabel: some View {
        HStack(spacing: BinMateTheme.Spacing.xs) {
            if let suburb = appState.primarySuburb?.sanitizedSuburb, !suburb.isEmpty {
                Text(suburb)
                    .font(BinMateTheme.Typography.heading2)
                    .foregroundColor(BinMateTheme.Colors.textPrimary)
                Text("·")
                    .font(BinMateTheme.Typography.heading2)
                    .foregroundColor(BinMateTheme.Colors.textMuted)
            }
            if let council = appState.primaryCouncilName, !council.isEmpty {
                Text(shortCouncilName(council))
                    .font(BinMateTheme.Typography.heading2)
                    .foregroundColor(BinMateTheme.Colors.textSecondary)
                    .lineLimit(1)
            }
            Image(systemName: "chevron.down")
                .font(BinMateTheme.Typography.bodySmall)
                .foregroundColor(BinMateTheme.Colors.lime)
                .accessibilityHidden(true)
        }
    }

    // MARK: - Helpers

    private var currentLabel: String? {
        appState.primarySuburb?.sanitizedSuburb
    }

    private var switcherAccessibilityLabel: String {
        let suburb = currentLabel ?? "No address"
        return "Current address \(suburb). Double tap to switch address."
    }

    private var todayLabel: String {
        let f = DateFormatter()
        f.dateFormat = "EEEE, d MMM"
        return f.string(from: Date()).uppercased()
    }

    /// Strips "City of" / "Town of" / "Shire of" for compact display.
    private func shortCouncilName(_ name: String) -> String {
        let prefixes = ["City of ", "Town of ", "Shire of "]
        for prefix in prefixes where name.hasPrefix(prefix) {
            return String(name.dropFirst(prefix.count))
        }
        return name
    }
}
