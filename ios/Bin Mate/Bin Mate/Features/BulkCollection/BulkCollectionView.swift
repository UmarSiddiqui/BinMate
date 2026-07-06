import SwiftUI

/// Full-screen detail view for verge / bulk hard waste collection.
struct BulkCollectionView: View {

    @ObservedObject var viewModel: BulkCollectionViewModel
    @Environment(\.openURL) private var openURL

    var body: some View {
        ZStack {
            BinMateTheme.Colors.bgBase.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: BinMateTheme.Spacing.lg) {
                    statusCard
                    requestCard
                    if !viewModel.futureVerge.isEmpty { upcomingDatesSection }
                    allowedItemsSection
                    notAcceptedSection
                    councilDisclaimerNote
                    Color.clear.frame(height: BinMateTheme.Spacing.xl)
                }
                .padding(.horizontal, BinMateTheme.Spacing.lg)
                .padding(.top, BinMateTheme.Spacing.md)
            }
        }
        .navigationTitle("Bulk Collection")
        .navigationBarTitleDisplayMode(.large)
    }

    // MARK: - Status card

    private var statusCard: some View {
        VStack(alignment: .leading, spacing: BinMateTheme.Spacing.sm) {
            Text(viewModel.isOnDemand ? "ON DEMAND" : "NEXT COLLECTION")
                .font(BinMateTheme.Typography.label)
                .foregroundColor(BinMateTheme.Colors.amber)
                .kerning(1.5)

            Text(viewModel.nextDateLabel)
                .font(BinMateTheme.Typography.heading2)
                .foregroundColor(BinMateTheme.Colors.textPrimary)

            if let next = viewModel.nextVerge, next.isHolidayShifted {
                holidayShiftNote(original: next.originalDate)
            }

            Text(statusDescription)
                .font(BinMateTheme.Typography.bodySmall)
                .foregroundColor(BinMateTheme.Colors.textSecondary)
        }
        .padding(BinMateTheme.Spacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(BinMateTheme.Colors.amberFaint)
        .overlay(
            RoundedRectangle(cornerRadius: BinMateTheme.Radius.card)
                .stroke(BinMateTheme.Colors.amber.opacity(0.25), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: BinMateTheme.Radius.card))
    }

    private var statusDescription: String {
        viewModel.isOnDemand
            ? "\(viewModel.councilName) offers on-demand verge collection — request it when you're ready."
            : "\(viewModel.councilName) schedules annual verge collections."
    }

    private func holidayShiftNote(original: String?) -> some View {
        HStack(spacing: BinMateTheme.Spacing.xs) {
            Image(systemName: "calendar.badge.exclamationmark")
                .font(.caption)
                .accessibilityHidden(true)
            Text("Date shifted due to public holiday" + (original.map { " (was \($0))" } ?? ""))
                .font(BinMateTheme.Typography.caption)
        }
        .foregroundColor(BinMateTheme.Colors.amber)
    }

    // MARK: - Request card

    private var requestCard: some View {
        VStack(alignment: .leading, spacing: BinMateTheme.Spacing.sm) {
            Text("REQUEST COLLECTION")
                .font(BinMateTheme.Typography.label)
                .foregroundColor(BinMateTheme.Colors.textMuted)
                .kerning(1.5)

            Button {
                if let url = viewModel.requestURL { openURL(url) }
            } label: {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Book via Council Website")
                            .font(BinMateTheme.Typography.body)
                            .foregroundColor(BinMateTheme.Colors.textPrimary)
                        Text(viewModel.councilName)
                            .font(BinMateTheme.Typography.bodySmall)
                            .foregroundColor(BinMateTheme.Colors.textSecondary)
                    }
                    Spacer()
                    Image(systemName: BinMateTheme.Symbols.externalLink)
                        .foregroundColor(
                            viewModel.requestURL != nil
                                ? BinMateTheme.Colors.lime
                                : BinMateTheme.Colors.textDisabled
                        )
                }
                .padding(BinMateTheme.Spacing.md)
                .background(BinMateTheme.Colors.bgRaised)
                .clipShape(RoundedRectangle(cornerRadius: BinMateTheme.Radius.lg))
            }
            .disabled(viewModel.requestURL == nil)
        }
    }

    // MARK: - Upcoming dates

    private var upcomingDatesSection: some View {
        VStack(alignment: .leading, spacing: BinMateTheme.Spacing.sm) {
            Text("UPCOMING DATES")
                .font(BinMateTheme.Typography.label)
                .foregroundColor(BinMateTheme.Colors.textMuted)
                .kerning(1.5)

            VStack(spacing: 1) {
                ForEach(viewModel.futureVerge) { collection in
                    HStack {
                        Text(collection.dayOfWeek)
                            .font(BinMateTheme.Typography.body)
                            .foregroundColor(BinMateTheme.Colors.textPrimary)
                        Spacer()
                        Text(collection.date)
                            .font(BinMateTheme.Typography.data)
                            .foregroundColor(BinMateTheme.Colors.textSecondary)
                    }
                    .padding(.vertical, BinMateTheme.Spacing.sm)
                    .padding(.horizontal, BinMateTheme.Spacing.md)
                    .background(BinMateTheme.Colors.bgRaised)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: BinMateTheme.Radius.lg))
        }
    }

    // MARK: - Allowed items

    private static let allowedItems: [(String, String)] = [
        ("Furniture & whitegoods", "chair"),
        ("Timber & fencing", "square.split.2x2"),
        ("Garden cuttings", "leaf"),
        ("Metal & scrap", "hammer"),
        ("Mattresses", "bed.double"),
        ("Cardboard (flattened)", "archivebox"),
    ]

    private var allowedItemsSection: some View {
        VStack(alignment: .leading, spacing: BinMateTheme.Spacing.sm) {
            Text("TYPICALLY ACCEPTED")
                .font(BinMateTheme.Typography.label)
                .foregroundColor(BinMateTheme.Colors.textMuted)
                .kerning(1.5)

            LazyVGrid(
                columns: [GridItem(.flexible()), GridItem(.flexible())],
                spacing: BinMateTheme.Spacing.sm
            ) {
                ForEach(Self.allowedItems, id: \.0) { name, icon in
                    HStack(spacing: BinMateTheme.Spacing.xs) {
                        Image(systemName: icon)
                            .font(.caption)
                            .foregroundColor(BinMateTheme.Colors.lime)
                            .frame(width: 16)
                            .accessibilityHidden(true)
                        Text(name)
                            .font(BinMateTheme.Typography.bodySmall)
                            .foregroundColor(BinMateTheme.Colors.textSecondary)
                        Spacer()
                    }
                }
            }
            .padding(BinMateTheme.Spacing.md)
            .background(BinMateTheme.Colors.bgRaised)
            .clipShape(RoundedRectangle(cornerRadius: BinMateTheme.Radius.lg))
        }
    }

    // MARK: - Not accepted

    private static let notAccepted = [
        "Hazardous waste (paint, chemicals, asbestos)",
        "Motor vehicle tyres or batteries",
        "Loose soil, sand, or gravel",
        "Building / demolition materials",
        "Commercial quantities of waste",
    ]

    private var notAcceptedSection: some View {
        VStack(alignment: .leading, spacing: BinMateTheme.Spacing.sm) {
            Text("NOT ACCEPTED")
                .font(BinMateTheme.Typography.label)
                .foregroundColor(BinMateTheme.Colors.textMuted)
                .kerning(1.5)

            VStack(alignment: .leading, spacing: BinMateTheme.Spacing.xs) {
                ForEach(Self.notAccepted, id: \.self) { item in
                    HStack(alignment: .top, spacing: BinMateTheme.Spacing.xs) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.caption)
                            .foregroundColor(BinMateTheme.Colors.red)
                            .padding(.top, 2)
                            .accessibilityHidden(true)
                        Text(item)
                            .font(BinMateTheme.Typography.bodySmall)
                            .foregroundColor(BinMateTheme.Colors.textSecondary)
                    }
                }
            }
            .padding(BinMateTheme.Spacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(BinMateTheme.Colors.bgRaised)
            .clipShape(RoundedRectangle(cornerRadius: BinMateTheme.Radius.lg))
        }
    }

    // MARK: - Disclaimer

    private var councilDisclaimerNote: some View {
        Text("Accepted items and rules vary by council. Always confirm with your council's website before placing items out.")
            .font(BinMateTheme.Typography.caption)
            .foregroundColor(BinMateTheme.Colors.textMuted)
            .multilineTextAlignment(.leading)
    }
}
