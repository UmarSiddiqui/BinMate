import SwiftUI

/// Button style for tappable cards/chips — subtle scale + dim on press.
/// Respects Reduce Motion by falling back to opacity-only feedback.
struct PressableCardStyle: ButtonStyle {

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private enum Metrics {
        static let pressedScale: CGFloat = 0.97
        static let pressedOpacity: CGFloat = 0.85
    }

    // Explicit `ButtonStyleConfiguration` — the app's own `Configuration` type shadows
    // the `ButtonStyle.Configuration` typealias.
    func makeBody(configuration: ButtonStyleConfiguration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed && !reduceMotion ? Metrics.pressedScale : 1)
            .opacity(configuration.isPressed ? Metrics.pressedOpacity : 1)
            .animation(BinMateTheme.Animation.default, value: configuration.isPressed)
    }
}

extension ButtonStyle where Self == PressableCardStyle {
    /// Convenience accessor — `.buttonStyle(.pressableCard)`.
    static var pressableCard: PressableCardStyle { PressableCardStyle() }
}
