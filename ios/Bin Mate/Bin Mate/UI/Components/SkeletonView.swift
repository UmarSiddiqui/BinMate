import SwiftUI

/// Animated shimmer placeholder used while data is loading.
/// Drop it in wherever a real view would appear — same frame, same corner radius.
struct SkeletonView: View {

    var cornerRadius: CGFloat = BinMateTheme.Radius.md

    @State private var shimmerOffset: CGFloat = -1
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        GeometryReader { geo in
            RoundedRectangle(cornerRadius: cornerRadius)
                .fill(BinMateTheme.Colors.bgRaised)
                .overlay {
                    if !reduceMotion {
                        LinearGradient(
                            colors: [
                                .clear,
                                BinMateTheme.Colors.bgSurface.opacity(0.6),
                                .clear
                            ],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                        .offset(x: shimmerOffset * geo.size.width)
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
        }
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.linear(duration: 1.2).repeatForever(autoreverses: false)) {
                shimmerOffset = 1.5
            }
        }
    }
}
