import SwiftUI

/// Coloured pill label for a bin collection type.
/// Used across HeroCollectionCard, UpcomingScheduleList, and CouncilConfirmView.
struct BinTypePill: View {

    let type: BinType

    /// When true (e.g. on the lime hero card) the pill renders dark-on-light.
    var inverted: Bool = false

    /// When true, shows the bin name next to the icon (used on the hero card
    /// where icon-only pills are too small to identify at a glance).
    var showsLabel: Bool = false

    private enum Metrics {
        static let iconSize: CGFloat = 28
        static let labeledIconSize: CGFloat = 32
    }

    var body: some View {
        HStack(spacing: BinMateTheme.Spacing.xs) {
            Image(type.iconAssetName)
                .resizable()
                .renderingMode(.original)
                .scaledToFit()
                .frame(width: iconSize, height: iconSize)
            if showsLabel {
                Text(type.displayName)
                    .font(BinMateTheme.Typography.bodySmall.weight(.semibold))
                    .foregroundColor(labelColor)
                    .lineLimit(1)
            }
        }
        .padding(BinMateTheme.Spacing.xs)
        .padding(.trailing, showsLabel ? BinMateTheme.Spacing.sm : 0)
        .background(backgroundColor)
        .clipShape(Capsule())
        .accessibilityLabel(type.displayName)
    }

    // MARK: - Private

    private var iconSize: CGFloat {
        showsLabel ? Metrics.labeledIconSize : Metrics.iconSize
    }

    private var labelColor: Color {
        inverted ? BinMateTheme.Colors.bgBase : BinMateTheme.Colors.textPrimary
    }

    private var typeColor: Color {
        switch type {
        case .general:    return BinMateTheme.Colors.binRed
        case .recycling:  return BinMateTheme.Colors.binYellow
        case .greenWaste: return BinMateTheme.Colors.binGreen
        case .fogo:       return BinMateTheme.Colors.lime
        }
    }

    private var backgroundColor: Color {
        inverted ? BinMateTheme.Colors.bgBase.opacity(0.22) : typeColor.opacity(0.12)
    }
}
