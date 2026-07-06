import SwiftUI

/// Gives the tab bar a solid brand background so it matches `bgBase`
/// instead of the system's translucent default.
private struct BrandTabBarBackground: ViewModifier {
    func body(content: Content) -> some View {
        content
            .toolbarBackground(BinMateTheme.Colors.bgBase, for: .tabBar)
            .toolbarBackground(.visible, for: .tabBar)
    }
}

extension View {
    /// Applies the BinMate solid tab bar background. Use on every top-level tab view.
    func brandTabBarBackground() -> some View {
        modifier(BrandTabBarBackground())
    }
}
