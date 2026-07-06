import MapKit
import SwiftUI

/// Onboarding Step 1 — address search field with MapKit autocomplete.
struct AddressEntryView: View {

    @ObservedObject var viewModel: OnboardingViewModel

    var body: some View {
        VStack(spacing: 0) {
            // Header
            VStack(alignment: .leading, spacing: BinMateTheme.Spacing.sm) {
                Text("WHERE DO\nYOU LIVE?")
                    .font(BinMateTheme.Typography.display)
                    .foregroundColor(BinMateTheme.Colors.textPrimary)
                    .lineSpacing(4)

                Text("Enter your street address to find your bin collection schedule.")
                    .font(BinMateTheme.Typography.body)
                    .foregroundColor(BinMateTheme.Colors.textSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, BinMateTheme.Spacing.lg)
            .padding(.top, BinMateTheme.Spacing.xl)
            .padding(.bottom, BinMateTheme.Spacing.lg)

            // Search field
            HStack(spacing: BinMateTheme.Spacing.sm) {
                Image(systemName: BinMateTheme.Symbols.location)
                    .font(.body)
                    .foregroundColor(viewModel.addressInput.isEmpty
                                     ? BinMateTheme.Colors.textMuted
                                     : BinMateTheme.Colors.lime)

                TextField("e.g. 14 Smith Street, Subiaco", text: $viewModel.addressInput)
                    .font(BinMateTheme.Typography.body)
                    .foregroundColor(BinMateTheme.Colors.textPrimary)
                    .tint(BinMateTheme.Colors.lime)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.words)

                if !viewModel.addressInput.isEmpty {
                    Button {
                        viewModel.addressInput = ""
                    } label: {
                        Image(systemName: BinMateTheme.Symbols.dismiss)
                            .font(.caption)
                            .foregroundColor(BinMateTheme.Colors.textMuted)
                    }
                    .accessibilityLabel("Clear address")
                }
            }
            .padding(BinMateTheme.Spacing.md)
            .background(BinMateTheme.Colors.bgSurface)
            .clipShape(RoundedRectangle(cornerRadius: BinMateTheme.Radius.md))
            .overlay(
                RoundedRectangle(cornerRadius: BinMateTheme.Radius.md)
                    .strokeBorder(
                        viewModel.addressInput.isEmpty
                            ? BinMateTheme.Colors.borderSubtle
                            : BinMateTheme.Colors.limeBorder,
                        lineWidth: 1
                    )
            )
            .padding(.horizontal, BinMateTheme.Spacing.lg)

            // Loading / error / suggestions
            Group {
                if viewModel.isLoading {
                    loadingRow
                } else if let err = viewModel.error {
                    errorRow(err)
                } else if !viewModel.suggestions.isEmpty {
                    suggestionsStack
                }
            }
            .padding(.top, BinMateTheme.Spacing.sm)

            Spacer()
        }
    }

    // MARK: - Loading row

    private var loadingRow: some View {
        HStack(spacing: BinMateTheme.Spacing.sm) {
            ProgressView()
                .tint(BinMateTheme.Colors.lime)
                .scaleEffect(0.85)
            Text("Finding your address…")
                .font(BinMateTheme.Typography.bodySmall)
                .foregroundColor(BinMateTheme.Colors.textSecondary)
        }
        .padding(.horizontal, BinMateTheme.Spacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Error row

    private func errorRow(_ err: BinMateError) -> some View {
        HStack(spacing: BinMateTheme.Spacing.sm) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.caption)
                .foregroundColor(BinMateTheme.Colors.amber)
            Text(err.errorDescription ?? "Couldn't find that address. Try again.")
                .font(BinMateTheme.Typography.bodySmall)
                .foregroundColor(BinMateTheme.Colors.amber)
        }
        .padding(BinMateTheme.Spacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(BinMateTheme.Colors.amberFaint)
        .clipShape(RoundedRectangle(cornerRadius: BinMateTheme.Radius.md))
        .padding(.horizontal, BinMateTheme.Spacing.lg)
    }

    // MARK: - Suggestions

    private var suggestionsStack: some View {
        VStack(spacing: 0) {
            ForEach(viewModel.suggestions.prefix(5), id: \.self) { suggestion in
                SuggestionRow(suggestion: suggestion)
                    .onTapGesture {
                        Task { await viewModel.selectSuggestion(suggestion) }
                    }
            }
        }
        .background(BinMateTheme.Colors.bgRaised)
        .clipShape(RoundedRectangle(cornerRadius: BinMateTheme.Radius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: BinMateTheme.Radius.lg)
                .strokeBorder(BinMateTheme.Colors.borderSubtle, lineWidth: 1)
        )
        .padding(.horizontal, BinMateTheme.Spacing.lg)
    }
}

// MARK: - Suggestion row

private struct SuggestionRow: View {

    let suggestion: MKLocalSearchCompletion

    var body: some View {
        HStack(spacing: BinMateTheme.Spacing.sm) {
            Image(systemName: BinMateTheme.Symbols.location)
                .font(.caption)
                .foregroundColor(BinMateTheme.Colors.textMuted)
                .frame(width: 20)

            VStack(alignment: .leading, spacing: 2) {
                Text(suggestion.title)
                    .font(BinMateTheme.Typography.body)
                    .foregroundColor(BinMateTheme.Colors.textPrimary)
                    .lineLimit(1)

                if !suggestion.subtitle.isEmpty {
                    Text(suggestion.subtitle)
                        .font(BinMateTheme.Typography.bodySmall)
                        .foregroundColor(BinMateTheme.Colors.textSecondary)
                        .lineLimit(1)
                }
            }

            Spacer()
        }
        .padding(.horizontal, BinMateTheme.Spacing.md)
        .padding(.vertical, BinMateTheme.Spacing.sm)
        .contentShape(Rectangle())
    }
}
