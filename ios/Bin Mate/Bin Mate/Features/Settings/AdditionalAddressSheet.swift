import SwiftUI

/// Result saved for an additional address. Excludes raw street address by design.
struct AdditionalAddressResult {
    let zoneId: String
    let councilName: String
    let suburb: String
}

/// Adds another collection zone using the same address resolver as onboarding.
struct AdditionalAddressSheet: View {

    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel = OnboardingViewModel()

    let onSave: (AdditionalAddressResult) -> Void

    var body: some View {
        NavigationStack {
            ZStack {
                BinMateTheme.Colors.bgBase.ignoresSafeArea()

                switch viewModel.step {
                case .address:
                    AddressEntryView(viewModel: viewModel)
                case .confirm:
                    confirmationView
                case .notifications:
                    confirmationView
                }
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(BinMateTheme.Colors.textSecondary)
                }
            }
        }
    }

    private var confirmationView: some View {
        VStack(alignment: .leading, spacing: BinMateTheme.Spacing.lg) {
            Text("Add this address?")
                .font(BinMateTheme.Typography.heading1)
                .foregroundColor(BinMateTheme.Colors.textPrimary)

            VStack(alignment: .leading, spacing: BinMateTheme.Spacing.xs) {
                Text(viewModel.resolvedResponse?.councilName ?? "")
                    .font(BinMateTheme.Typography.heading3)
                    .foregroundColor(BinMateTheme.Colors.textPrimary)
                Text(suburbLabel)
                    .font(BinMateTheme.Typography.body)
                    .foregroundColor(BinMateTheme.Colors.textSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(BinMateTheme.Spacing.md)
            .background(BinMateTheme.Colors.bgRaised)
            .clipShape(RoundedRectangle(cornerRadius: BinMateTheme.Radius.card))

            Spacer()

            Button {
                saveAddress()
            } label: {
                Text("Add address")
                    .font(BinMateTheme.Typography.heading3)
                    .foregroundColor(BinMateTheme.Colors.bgBase)
                    .frame(maxWidth: .infinity)
                    .padding(BinMateTheme.Spacing.md)
                    .background(BinMateTheme.Colors.lime)
                    .clipShape(RoundedRectangle(cornerRadius: BinMateTheme.Radius.md))
            }

            Button {
                viewModel.tryDifferentAddress()
            } label: {
                Text("Try a different address")
                    .font(BinMateTheme.Typography.body)
                    .foregroundColor(BinMateTheme.Colors.textSecondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, BinMateTheme.Spacing.sm)
            }
        }
        .padding(.horizontal, BinMateTheme.Spacing.lg)
        .padding(.top, BinMateTheme.Spacing.xl)
    }

    private var suburbLabel: String {
        viewModel.resolvedSuburb.isEmpty ? "WA" : "\(viewModel.resolvedSuburb) · WA"
    }

    private func saveAddress() {
        guard let response = viewModel.resolvedResponse else { return }
        onSave(
            AdditionalAddressResult(
                zoneId: response.zoneId,
                councilName: response.councilName,
                suburb: viewModel.resolvedSuburb.isEmpty ? response.councilName : viewModel.resolvedSuburb
            )
        )
        dismiss()
    }
}
