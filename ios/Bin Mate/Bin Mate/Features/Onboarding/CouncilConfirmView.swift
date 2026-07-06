import SwiftUI

/// Step 2 of onboarding: confirm the detected council and preview the first collection.
struct CouncilConfirmView: View {

    @ObservedObject var viewModel: OnboardingViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: BinMateTheme.Spacing.lg) {
            header
            councilCard
            if let first = viewModel.resolvedResponse?.nextCollections.first {
                nextCollectionCard(first)
            }
            Spacer()
            actions
        }
        .padding(.horizontal, BinMateTheme.Spacing.lg)
        .padding(.top, BinMateTheme.Spacing.xl)
    }

    // MARK: - Header

    private var header: some View {
        VStack(alignment: .leading, spacing: BinMateTheme.Spacing.sm) {
            Text("STEP 2 OF 3")
                .font(BinMateTheme.Typography.label)
                .foregroundColor(BinMateTheme.Colors.lime)
                .kerning(1.5)
            Text("Is this your council?")
                .font(BinMateTheme.Typography.heading1)
                .foregroundColor(BinMateTheme.Colors.textPrimary)
        }
    }

    // MARK: - Council card

    private var councilCard: some View {
        HStack(spacing: BinMateTheme.Spacing.md) {
            ZStack {
                Circle()
                    .fill(BinMateTheme.Colors.limeFaint)
                    .frame(width: 48, height: 48)
                Image(systemName: BinMateTheme.Symbols.location)
                    .foregroundColor(BinMateTheme.Colors.lime)
            }
            .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: BinMateTheme.Spacing.xs) {
                Text(viewModel.resolvedResponse?.councilName ?? "")
                    .font(BinMateTheme.Typography.heading3)
                    .foregroundColor(BinMateTheme.Colors.textPrimary)
                if !viewModel.resolvedSuburb.isEmpty {
                    Text("\(viewModel.resolvedSuburb) · WA")
                        .font(BinMateTheme.Typography.body)
                        .foregroundColor(BinMateTheme.Colors.textSecondary)
                }
            }

            Spacer()

            Image(systemName: "checkmark.circle.fill")
                .foregroundColor(BinMateTheme.Colors.lime)
                .font(.title2)
                .accessibilityHidden(true)
        }
        .padding(BinMateTheme.Spacing.md)
        .background(BinMateTheme.Colors.bgRaised)
        .clipShape(RoundedRectangle(cornerRadius: BinMateTheme.Radius.card))
        .overlay {
            RoundedRectangle(cornerRadius: BinMateTheme.Radius.card)
                .stroke(BinMateTheme.Colors.limeBorder)
        }
    }

    // MARK: - Next collection preview

    private func nextCollectionCard(_ collection: Collection) -> some View {
        VStack(alignment: .leading, spacing: BinMateTheme.Spacing.sm) {
            Text("NEXT COLLECTION")
                .font(BinMateTheme.Typography.label)
                .foregroundColor(BinMateTheme.Colors.textMuted)
                .kerning(1.5)

            HStack(spacing: BinMateTheme.Spacing.sm) {
                VStack(alignment: .leading, spacing: BinMateTheme.Spacing.xs) {
                    Text(formattedDate(collection.date))
                        .font(BinMateTheme.Typography.heading3)
                        .foregroundColor(BinMateTheme.Colors.textPrimary)
                    Text(collection.dayOfWeek)
                        .font(BinMateTheme.Typography.bodySmall)
                        .foregroundColor(BinMateTheme.Colors.textSecondary)
                }

                Spacer()

                HStack(spacing: BinMateTheme.Spacing.xs) {
                    ForEach(collection.types, id: \.self) { type in
                        binTypePill(type)
                    }
                }
            }
        }
        .padding(BinMateTheme.Spacing.md)
        .background(BinMateTheme.Colors.bgRaised)
        .clipShape(RoundedRectangle(cornerRadius: BinMateTheme.Radius.card))
        .overlay {
            RoundedRectangle(cornerRadius: BinMateTheme.Radius.card)
                .stroke(BinMateTheme.Colors.borderSubtle)
        }
    }

    private func binTypePill(_ type: BinType) -> some View {
        Text(type.displayName)
            .font(BinMateTheme.Typography.label)
            .foregroundColor(binColor(type))
            .kerning(0.5)
            .padding(.horizontal, BinMateTheme.Spacing.sm)
            .padding(.vertical, BinMateTheme.Spacing.xs)
            .background(binColor(type).opacity(0.12))
            .clipShape(Capsule())
    }

    private func binColor(_ type: BinType) -> Color {
        switch type {
        case .general:    return BinMateTheme.Colors.binRed
        case .recycling:  return BinMateTheme.Colors.binYellow
        case .greenWaste: return BinMateTheme.Colors.binGreen
        case .fogo:       return BinMateTheme.Colors.lime
        }
    }

    // MARK: - Actions

    private var actions: some View {
        VStack(spacing: BinMateTheme.Spacing.sm) {
            Button {
                HapticFeedback.impact(.medium)
                viewModel.confirmAddress()
            } label: {
                HStack {
                    Text("That's me")
                        .font(BinMateTheme.Typography.heading3)
                    Image(systemName: BinMateTheme.Symbols.next)
                        .accessibilityHidden(true)
                }
                .foregroundColor(BinMateTheme.Colors.bgBase)
                .frame(maxWidth: .infinity)
                .padding(BinMateTheme.Spacing.md)
                .background(BinMateTheme.Colors.lime)
                .clipShape(RoundedRectangle(cornerRadius: BinMateTheme.Radius.md))
            }
            .accessibilityLabel("Confirm this is my council")
            .accessibilityHint("Proceeds to notification setup")

            Button {
                viewModel.tryDifferentAddress()
            } label: {
                Text("Try a different address")
                    .font(BinMateTheme.Typography.body)
                    .foregroundColor(BinMateTheme.Colors.textSecondary)
                    .padding(.vertical, BinMateTheme.Spacing.sm)
            }
            .accessibilityLabel("Try a different address")
            .padding(.bottom, BinMateTheme.Spacing.lg)
        }
    }

    // MARK: - Helpers

    private func formattedDate(_ isoDate: String) -> String {
        let parser = DateFormatter()
        parser.dateFormat = "yyyy-MM-dd"
        let display = DateFormatter()
        display.dateFormat = "d MMM"
        guard let date = parser.date(from: isoDate) else { return isoDate }
        return display.string(from: date)
    }
}
