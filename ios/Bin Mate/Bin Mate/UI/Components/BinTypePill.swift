import SwiftUI

/// Coloured pill label for a bin collection type.
/// Used across HeroCollectionCard, UpcomingScheduleList, and CouncilConfirmView.
struct BinTypePill: View {

    let type: BinType

    /// When true (e.g. on the lime hero card) the pill renders dark-on-light.
    var inverted: Bool = false

    var body: some View {
        HStack(spacing: BinMateTheme.Spacing.xs) {
            Image(type.iconAssetName)
                .resizable()
                .renderingMode(.original)
                .scaledToFit()
                .frame(width: 20, height: 20)
            Text(type.displayName)
                .font(BinMateTheme.Typography.label)
                .kerning(0.5)
        }
        .foregroundColor(foregroundColor)
        .padding(.horizontal, BinMateTheme.Spacing.sm)
        .padding(.vertical, BinMateTheme.Spacing.xs)
        .background(backgroundColor)
        .clipShape(Capsule())
    }

    // MARK: - Private

    private var typeColor: Color {
        switch type {
        case .general:    return BinMateTheme.Colors.binRed
        case .recycling:  return BinMateTheme.Colors.binYellow
        case .greenWaste: return BinMateTheme.Colors.binGreen
        case .fogo:       return BinMateTheme.Colors.lime
        }
    }

    private var foregroundColor: Color {
        inverted ? BinMateTheme.Colors.bgBase : typeColor
    }

    private var backgroundColor: Color {
        inverted ? BinMateTheme.Colors.bgBase.opacity(0.22) : typeColor.opacity(0.12)
    }
}
