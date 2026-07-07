import SwiftUI

/// The primary home screen card. Lime background when a collection is imminent;
/// dark card with empty-state copy when nothing is due today or tomorrow.
struct HeroCollectionCard: View {

    let title: String
    let subtitle: String
    let types: [BinType]

    /// True when there is a collection today or tomorrow (drives lime vs dark style).
    let isActive: Bool

    /// Called when the bell badge is tapped — opens reminder settings.
    var onBellTap: (() -> Void)? = nil

    private enum Metrics {
        static let cardMinimumHeight: CGFloat = 168
        static let titleScale: CGFloat = 0.78
        static let iconSize: CGFloat = 46
        static let symbolSize: CGFloat = 20
    }

    var body: some View {
        VStack(alignment: .leading, spacing: BinMateTheme.Spacing.lg) {
            titleRow
            VStack(alignment: .leading, spacing: BinMateTheme.Spacing.sm) {
                if !types.isEmpty { typePills }
                subtitleRow
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(BinMateTheme.Spacing.lg)
        .frame(minHeight: Metrics.cardMinimumHeight, alignment: .leading)
        .background {
            if isActive {
                BinMateTheme.Gradients.heroActive
            } else {
                ZStack {
                    BinMateTheme.Colors.bgRaised
                    BinMateTheme.Gradients.cardSheen
                }
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: BinMateTheme.Radius.card))
        .overlay {
            RoundedRectangle(cornerRadius: BinMateTheme.Radius.card)
                .stroke(isActive ? BinMateTheme.Colors.bgBase.opacity(0.08)
                                  : BinMateTheme.Colors.borderSubtle)
        }
        .shadow(
            color: isActive ? BinMateTheme.Shadows.glowLimeColor : BinMateTheme.Shadows.cardColor,
            radius: isActive ? BinMateTheme.Shadows.glowLimeRadius : BinMateTheme.Shadows.cardRadius,
            y: isActive ? BinMateTheme.Shadows.glowLimeYOffset : BinMateTheme.Shadows.cardYOffset
        )
    }

    // MARK: - Sub-views

    private var titleRow: some View {
        HStack(alignment: .top, spacing: BinMateTheme.Spacing.md) {
            Text(title)
                .font(BinMateTheme.Typography.display)
                .foregroundColor(isActive
                                 ? BinMateTheme.Colors.bgBase
                                 : BinMateTheme.Colors.textPrimary)
                .lineLimit(2)
                .minimumScaleFactor(Metrics.titleScale)
            Spacer()
            Button {
                onBellTap?()
            } label: {
                BinMateIconBadge(
                    systemName: isActive ? BinMateTheme.Symbols.binsOut : BinMateTheme.Symbols.bins,
                    foreground: isActive ? BinMateTheme.Colors.bgBase.opacity(0.72) : BinMateTheme.Colors.textMuted,
                    background: isActive ? BinMateTheme.Colors.bgBase.opacity(0.12) : BinMateTheme.Colors.bgSurface,
                    size: Metrics.iconSize,
                    symbolSize: Metrics.symbolSize
                )
            }
            .buttonStyle(.pressableCard)
            .disabled(onBellTap == nil)
            .accessibilityLabel("Reminder settings")
        }
    }

    private var typePills: some View {
        HStack(spacing: BinMateTheme.Spacing.sm) {
            ForEach(types, id: \.self) { type in
                BinTypePill(type: type, inverted: isActive, showsLabel: true)
                    .fixedSize()
            }
            Spacer(minLength: 0)
        }
    }

    private var subtitleRow: some View {
        Text(subtitle)
            .font(BinMateTheme.Typography.bodyLarge)
            .foregroundColor(isActive
                             ? BinMateTheme.Colors.bgBase.opacity(0.65)
                             : BinMateTheme.Colors.textSecondary)
            .lineLimit(2)
    }
}
