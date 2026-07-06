import SwiftUI

/// Brand-styled circular icon badge used for key callouts and list affordances.
struct BinMateIconBadge: View {

    let systemName: String
    let foreground: Color
    let background: Color

    var size: CGFloat = 40
    var symbolSize: CGFloat = 16

    var body: some View {
        ZStack {
            Circle()
                .fill(background)
                .frame(width: size, height: size)
            Image(systemName: systemName)
                .font(.system(size: symbolSize, weight: .semibold))
                .foregroundColor(foreground)
                .accessibilityHidden(true)
        }
    }
}
