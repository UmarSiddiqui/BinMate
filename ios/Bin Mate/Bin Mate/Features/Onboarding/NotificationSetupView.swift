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
            Text("Never miss a bin day.")
                .font(BinMateTheme.Typography.heading1)
                .foregroundColor(BinMateTheme.Colors.textPrimary)
            Text("Evening reminders, automatically adjusted for public holidays.")
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

    // MARK: - Feature icons

    private var explanation: some View {
        HStack(spacing: BinMateTheme.Spacing.lg) {
            featureIcon(icon: "clock.fill", label: "6pm reminder")
            featureIcon(icon: "calendar.badge.exclamationmark", label: "Holiday aware")
            featureIcon(icon: "bell.slash", label: "No spam")
        }
        .frame(maxWidth: .infinity)
        .padding(BinMateTheme.Spacing.md)
        .background(BinMateTheme.Colors.bgRaised)
        .clipShape(RoundedRectangle(cornerRadius: BinMateTheme.Radius.lg))
    }

    private func featureIcon(icon: String, label: String) -> some View {
        VStack(spacing: BinMateTheme.Spacing.xs) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(BinMateTheme.Colors.lime)
                .frame(width: 32, height: 32)
            Text(label)
                .font(BinMateTheme.Typography.caption)
                .foregroundColor(BinMateTheme.Colors.textSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
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
                .background(BinMateTheme.Gradients.heroActive)
                .clipShape(RoundedRectangle(cornerRadius: BinMateTheme.Radius.md))
                .shadow(
                    color: BinMateTheme.Shadows.glowLimeColor,
                    radius: BinMateTheme.Shadows.glowLimeRadius,
                    y: BinMateTheme.Shadows.glowLimeYOffset
                )
            }
            .buttonStyle(.pressableCard)
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
