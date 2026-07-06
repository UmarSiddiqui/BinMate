import SwiftUI

/// Bottom sheet shown when the user taps a collection day in CalendarView.
struct DayDetailSheet: View {

    let date: String
    let collections: [Collection]

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Drag handle
            // Note: background set here (not via .presentationBackground) to support iOS 16.0
            Capsule()
                .fill(BinMateTheme.Colors.borderDefault)
                .frame(width: 36, height: 4)
                .frame(maxWidth: .infinity)
                .padding(.top, BinMateTheme.Spacing.sm)
                .padding(.bottom, BinMateTheme.Spacing.md)

            // Date heading
            Text(formattedDate)
                .font(BinMateTheme.Typography.heading2)
                .foregroundColor(BinMateTheme.Colors.textPrimary)
                .padding(.horizontal, BinMateTheme.Spacing.lg)
                .padding(.bottom, BinMateTheme.Spacing.md)

            Divider()
                .background(BinMateTheme.Colors.borderSubtle)

            // Collection rows
            ScrollView {
                VStack(spacing: 0) {
                    ForEach(Array(collections.enumerated()), id: \.offset) { index, collection in
                        CollectionDetailRow(collection: collection)
                        if index < collections.count - 1 {
                            Divider()
                                .background(BinMateTheme.Colors.borderSubtle)
                                .padding(.horizontal, BinMateTheme.Spacing.lg)
                        }
                    }
                }
            }

            Spacer()
        }
        .background(BinMateTheme.Colors.bgRaised.ignoresSafeArea())
    }

    // MARK: - Helpers

    private var formattedDate: String {
        let parser = DateFormatter()
        parser.dateFormat = "yyyy-MM-dd"
        guard let d = parser.date(from: date) else { return date }
        let display = DateFormatter()
        display.dateFormat = "EEEE, d MMMM"
        return display.string(from: d)
    }
}

// MARK: - Row

private struct CollectionDetailRow: View {

    let collection: Collection

    var body: some View {
        VStack(alignment: .leading, spacing: BinMateTheme.Spacing.xs) {
            // Bin type pills + event badge
            HStack(spacing: BinMateTheme.Spacing.xs) {
                ForEach(collection.types, id: \.self) { type in
                    BinTypePill(type: type)
                }
                if collection.eventType == .verge      { vergePill }
                if collection.eventType == .ewaste     { eWastePill }
            }

            // Holiday shift note
            if collection.isHolidayShifted, let original = collection.originalDate {
                HStack(spacing: BinMateTheme.Spacing.xs) {
                    Image(systemName: "arrow.right.circle.fill")
                        .foregroundColor(BinMateTheme.Colors.teal)
                        .font(BinMateTheme.Typography.bodySmall)
                        .accessibilityHidden(true)
                    Text("Shifted from \(shortDate(original)) due to public holiday")
                        .font(BinMateTheme.Typography.bodySmall)
                        .foregroundColor(BinMateTheme.Colors.teal)
                }
            }
        }
        .padding(.horizontal, BinMateTheme.Spacing.lg)
        .padding(.vertical, BinMateTheme.Spacing.md)
    }

    // MARK: - Event badges

    private var vergePill: some View {
        Text("VERGE")
            .font(BinMateTheme.Typography.label)
            .foregroundColor(BinMateTheme.Colors.amber)
            .kerning(0.5)
            .padding(.horizontal, BinMateTheme.Spacing.sm)
            .padding(.vertical, BinMateTheme.Spacing.xs)
            .background(BinMateTheme.Colors.amberFaint)
            .clipShape(Capsule())
    }

    private var eWastePill: some View {
        Text("E-WASTE")
            .font(BinMateTheme.Typography.label)
            .foregroundColor(BinMateTheme.Colors.teal)
            .kerning(0.5)
            .padding(.horizontal, BinMateTheme.Spacing.sm)
            .padding(.vertical, BinMateTheme.Spacing.xs)
            .background(BinMateTheme.Colors.tealFaint)
            .clipShape(Capsule())
    }

    // MARK: - Helpers

    private func shortDate(_ iso: String) -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        guard let d = f.date(from: iso) else { return iso }
        let display = DateFormatter()
        display.dateFormat = "d MMM"
        return display.string(from: d)
    }
}
