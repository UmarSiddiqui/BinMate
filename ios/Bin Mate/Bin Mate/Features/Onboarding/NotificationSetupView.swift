import SwiftUI

/// Step 3 of onboarding: explain push notifications and request APNs permission.
struct NotificationSetupView: View {

    @ObservedObject var viewModel: OnboardingViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: BinMateTheme.Spacing.lg) {
            header
            notificationPreview
            explanation
            Spacer()
            actions
        }
        .padding(.horizontal, BinMateTheme.Spacing.lg)
        .padding(.top, BinMateTheme.Spacing.xl)
    }

    // MARK: - Header

    private var header: some View {
        VStack(alignment: .leading, spacing: BinMateTheme.Spacing.sm) {
            Text("STEP 3 OF 3")
                .font(BinMateTheme.Typography.label)
                .foregroundColor(BinMateTheme.Colors.lime)
                .kerning(1.5)
            Text("Never miss a bin day.")
                .font(BinMateTheme.Typography.heading1)
                .foregroundColor(BinMateTheme.Colors.textPrimary)
            Text("We'll remind you the evening before collection day.")
                .font(BinMateTheme.Typography.body)
                .foregroundColor(BinMateTheme.Colors.textSecondary)
        }
    }

    // MARK: - Mock notification preview

    private var notificationPreview: some View {
        HStack(spacing: BinMateTheme.Spacing.md) {
            ZStack {
                RoundedRectangle(cornerRadius: BinMateTheme.Radius.sm)
                    .fill(BinMateTheme.Colors.lime)
                    .frame(width: 40, height: 40)
                Image(systemName: BinMateTheme.Symbols.bins)
                    .foregroundColor(BinMateTheme.Colors.bgBase)
                    .font(.system(size: 18, weight: .semibold))
            }
            .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: BinMateTheme.Spacing.xs) {
                HStack {
                    Text("BinMate")
                        .font(BinMateTheme.Typography.bodySmall.weight(.semibold))
                        .foregroundColor(BinMateTheme.Colors.textPrimary)
                    Spacer()
                    Text("6:00 pm")
                        .font(BinMateTheme.Typography.caption)
                        .foregroundColor(BinMateTheme.Colors.textMuted)
                }
                Text("Bins out tonight")
                    .font(BinMateTheme.Typography.bodySmall.weight(.semibold))
                    .foregroundColor(BinMateTheme.Colors.textPrimary)
                Text("General + Recycling due out by 6am tomorrow.")
                    .font(BinMateTheme.Typography.caption)
                    .foregroundColor(BinMateTheme.Colors.textSecondary)
                    .lineLimit(2)
            }
        }
        .padding(BinMateTheme.Spacing.md)
        .background(BinMateTheme.Colors.bgRaised)
        .clipShape(RoundedRectangle(cornerRadius: BinMateTheme.Radius.lg))
        .overlay {
            RoundedRectangle(cornerRadius: BinMateTheme.Radius.lg)
                .stroke(BinMateTheme.Colors.borderDefault)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Example notification: Bins out tonight. General and Recycling due out by 6am tomorrow.")
    }

    // MARK: - Feature bullets

    private var explanation: some View {
        VStack(alignment: .leading, spacing: BinMateTheme.Spacing.sm) {
            featureBullet(icon: "clock.fill",
                          text: "Reminder at 6pm the evening before — adjust anytime in Settings.")
            featureBullet(icon: "calendar.badge.exclamationmark",
                          text: "Automatically adjusts for WA public holidays.")
            featureBullet(icon: "bell.slash",
                          text: "No spam. One notification per collection day, nothing else.")
        }
    }

    private func featureBullet(icon: String, text: String) -> some View {
        HStack(alignment: .top, spacing: BinMateTheme.Spacing.sm) {
            Image(systemName: icon)
                .foregroundColor(BinMateTheme.Colors.lime)
                .frame(width: 20)
                .padding(.top, 1)
                .accessibilityHidden(true)
            Text(text)
                .font(BinMateTheme.Typography.body)
                .foregroundColor(BinMateTheme.Colors.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: - Actions

    private var actions: some View {
        VStack(spacing: BinMateTheme.Spacing.sm) {
            Button {
                HapticFeedback.impact(.medium)
                Task { await viewModel.requestNotificationPermission() }
            } label: {
                HStack {
                    Image(systemName: BinMateTheme.Symbols.bell)
                        .accessibilityHidden(true)
                    Text("Turn on reminders")
                        .font(BinMateTheme.Typography.heading3)
                }
                .foregroundColor(BinMateTheme.Colors.bgBase)
                .frame(maxWidth: .infinity)
                .padding(BinMateTheme.Spacing.md)
                .background(BinMateTheme.Colors.lime)
                .clipShape(RoundedRectangle(cornerRadius: BinMateTheme.Radius.md))
            }
            .accessibilityLabel("Turn on bin day reminders")

            Button {
                viewModel.skipNotifications()
            } label: {
                Text("Maybe later")
                    .font(BinMateTheme.Typography.body)
                    .foregroundColor(BinMateTheme.Colors.textMuted)
                    .padding(.vertical, BinMateTheme.Spacing.sm)
            }
            .accessibilityLabel("Skip notifications for now")
            .padding(.bottom, BinMateTheme.Spacing.lg)
        }
    }
}
