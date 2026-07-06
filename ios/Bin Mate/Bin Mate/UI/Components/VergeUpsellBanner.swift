import SwiftUI

/// Gentle amber banner shown on Home when a free user has a verge collection in their upcoming
/// schedule. Tapping the CTA presents the paywall. Dismissible — stored in AppStorage.
struct VergeUpsellBanner: View {

    @AppStorage("vergeUpsellDismissed") private var isDismissed = false
    @State private var showPaywall = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        if !isDismissed {
            bannerContent
                .transition(.opacity)
                .binMatePaywall(isPresented: $showPaywall)
        }
    }

    // MARK: - Layout

    private var bannerContent: some View {
        HStack(alignment: .top, spacing: 0) {
            accentBar
            HStack(alignment: .top, spacing: BinMateTheme.Spacing.md) {
                iconView
                textContent
                Spacer()
                dismissButton
            }
            .padding(BinMateTheme.Spacing.md)
        }
        .background(BinMateTheme.Colors.bgRaised)
        .clipShape(RoundedRectangle(cornerRadius: BinMateTheme.Radius.card))
        .overlay(
            RoundedRectangle(cornerRadius: BinMateTheme.Radius.card)
                .stroke(BinMateTheme.Colors.borderDefault, lineWidth: 1)
        )
    }

    // MARK: - Subviews

    private var accentBar: some View {
        Rectangle()
            .fill(BinMateTheme.Colors.amber)
            .frame(width: 3)
            .accessibilityHidden(true)
    }

    private var iconView: some View {
        Image(systemName: "calendar.badge.exclamationmark")
            .font(.system(size: 22))
            .foregroundColor(BinMateTheme.Colors.amber)
            .frame(width: 44, height: 44)
            .background(BinMateTheme.Colors.amberFaint)
            .clipShape(RoundedRectangle(cornerRadius: BinMateTheme.Radius.md))
            .accessibilityHidden(true)
    }

    private var textContent: some View {
        VStack(alignment: .leading, spacing: BinMateTheme.Spacing.xs) {
            Text("Verge collection coming up")
                .font(BinMateTheme.Typography.heading3)
                .foregroundColor(BinMateTheme.Colors.textPrimary)
            Text("Get a heads up 3 days out and the day before. Upgrade to Premium.")
                .font(BinMateTheme.Typography.bodySmall)
                .foregroundColor(BinMateTheme.Colors.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
            ctaButton
        }
    }

    private var ctaButton: some View {
        Button("Get Premium") {
            showPaywall = true
        }
        .font(BinMateTheme.Typography.label)
        .foregroundColor(BinMateTheme.Colors.bgBase)
        .padding(.horizontal, BinMateTheme.Spacing.md)
        .padding(.vertical, BinMateTheme.Spacing.xs)
        .background(BinMateTheme.Colors.amber)
        .clipShape(Capsule())
        .padding(.top, BinMateTheme.Spacing.xs)
        .accessibilityLabel("Get Premium to receive verge collection notifications")
    }

    private var dismissButton: some View {
        Button {
            withAnimation(reduceMotion ? nil : BinMateTheme.Animation.default) {
                isDismissed = true
            }
        } label: {
            Image(systemName: BinMateTheme.Symbols.dismiss)
                .font(.system(size: 13))
                .foregroundColor(BinMateTheme.Colors.textMuted)
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .accessibilityLabel("Dismiss")
    }
}
