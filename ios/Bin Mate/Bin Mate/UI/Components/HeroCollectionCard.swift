import SwiftUI

/// The primary home screen card. Lime background when a collection is imminent;
/// dark card with empty-state copy when nothing is due today or tomorrow.
struct HeroCollectionCard: View {

    let title: String
    let subtitle: String
    let types: [BinType]

    /// True when there is a collection today or tomorrow (drives lime vs dark style).
    let isActive: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: BinMateTheme.Spacing.md) {
            titleRow
            if !types.isEmpty { typePills }
            subtitleRow
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(BinMateTheme.Spacing.lg)
        .background(isActive ? BinMateTheme.Colors.lime : BinMateTheme.Colors.bgRaised)
        .clipShape(RoundedRectangle(cornerRadius: BinMateTheme.Radius.card))
        .overlay {
            if !isActive {
                RoundedRectangle(cornerRadius: BinMateTheme.Radius.card)
                    .stroke(BinMateTheme.Colors.borderSubtle)
            }
        }
    }

    // MARK: - Sub-views

    private var titleRow: some View {
        HStack {
            Text(title.uppercased())
                .font(BinMateTheme.Typography.heading2)
                .foregroundColor(isActive
                                 ? BinMateTheme.Colors.bgBase
                                 : BinMateTheme.Colors.textPrimary)
            Spacer()
            BinMateIconBadge(
                systemName: isActive ? BinMateTheme.Symbols.binsOut : BinMateTheme.Symbols.bins,
                foreground: isActive ? BinMateTheme.Colors.bgBase.opacity(0.72) : BinMateTheme.Colors.textMuted,
                background: isActive ? BinMateTheme.Colors.bgBase.opacity(0.12) : BinMateTheme.Colors.bgSurface,
                size: 34,
                symbolSize: 15
            )
        }
    }

    private var typePills: some View {
        HStack(spacing: BinMateTheme.Spacing.xs) {
            ForEach(types, id: \.self) { type in
                BinTypePill(type: type, inverted: isActive)
            }
        }
    }

    private var subtitleRow: some View {
        Text(subtitle)
            .font(BinMateTheme.Typography.body)
            .foregroundColor(isActive
                             ? BinMateTheme.Colors.bgBase.opacity(0.65)
                             : BinMateTheme.Colors.textSecondary)
    }
}
