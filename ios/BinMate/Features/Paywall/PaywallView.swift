import SwiftUI
import RevenueCat
import RevenueCatUI

/// Full-screen paywall using RevenueCat's native PaywallView.
/// Offerings and paywall design are configured in the RevenueCat dashboard.
///
/// Products configured:
///   - monthly  → $1.49/month with 7-day free trial
///   - yearly   → $9.99/year with 7-day free trial (default selected)
///   - lifetime → one-time purchase
struct BinMatePaywallView: View {

    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var entitlementService: EntitlementService

    var body: some View {
        PaywallView()
            .onPurchaseCompleted { customerInfo in
                handleSuccess(customerInfo)
            }
            .onRestoreCompleted { customerInfo in
                handleSuccess(customerInfo)
            }
            // Tint the RevenueCat paywall CTA to BinMate lime
            .tint(BinMateTheme.Colors.lime)
    }

    // MARK: - Private

    private func handleSuccess(_ customerInfo: CustomerInfo) {
        Task { await entitlementService.refresh() }
        dismiss()
    }
}

// MARK: - Paywall presentation modifier

/// Convenience modifier: present the paywall as a sheet.
struct PaywallSheetModifier: ViewModifier {
    @Binding var isPresented: Bool

    func body(content: Content) -> some View {
        content.sheet(isPresented: $isPresented) {
            BinMatePaywallView()
        }
    }
}

extension View {
    /// Present BinMate's paywall as a sheet.
    func binMatePaywall(isPresented: Binding<Bool>) -> some View {
        modifier(PaywallSheetModifier(isPresented: isPresented))
    }
}
