import SwiftUI

/// Vertically stacked list of upcoming collection events, up to 8 rows.
struct UpcomingScheduleList: View {

    let collections: [Collection]

    var body: some View {
        VStack(alignment: .leading, spacing: BinMateTheme.Spacing.sm) {
            Text("UPCOMING")
                .font(BinMateTheme.Typography.label)
                .foregroundColor(BinMateTheme.Colors.textMuted)
                .kerning(1.5)

            VStack(spacing: 0) {
                ForEach(Array(collections.enumerated()), id: \.offset) { index, collection in
                    CollectionRow(collection: collection)
                    if index < collections.count - 1 {
                        Divider()
                            .background(BinMateTheme.Colors.borderSubtle)
                            .padding(.leading, 68)
                    }
                }
            }
            .background(BinMateTheme.Colors.bgRaised)
            .clipShape(RoundedRectangle(cornerRadius: BinMateTheme.Radius.card))
        }
    }
}

// MARK: - Row

private struct CollectionRow: View {

    let collection: Collection

    private var isVerge: Bool { collection.eventType == .verge }

    var body: some View {
        HStack(alignment: .center, spacing: BinMateTheme.Spacing.md) {
            dateColumn
            contentColumn
            Spacer()
        }
        .padding(.vertical, BinMateTheme.Spacing.sm + BinMateTheme.Spacing.xs)
        .padding(.horizontal, BinMateTheme.Spacing.md)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(rowAccessibilityLabel)
    }

    private var rowAccessibilityLabel: String {
        var parts: [String] = [collection.dayOfWeek, longDate(collection.date)]
        let typeNames = collection.types.map(\.displayName)
        if !typeNames.isEmpty { parts.append(typeNames.joined(separator: " and ")) }
        if isVerge { parts.append("verge collection") }
        if collection.isHolidayShifted { parts.append("date shifted due to public holiday") }
        return parts.joined(separator: ", ")
    }

    private func longDate(_ isoDate: String) -> String {
        guard let date = isoParser.date(from: isoDate) else { return isoDate }
        let f = DateFormatter()
        f.dateFormat = "d MMMM"
        return f.string(from: date)
    }

    // MARK: - Date column

    private var dateColumn: some View {
        VStack(spacing: BinMateTheme.Spacing.xs) {
            BinMateIconBadge(
                systemName: eventIconName,
                foreground: eventIconForeground,
                background: eventIconBackground,
                size: 24,
                symbolSize: 10
            )
            Text(dayAbbrev(collection.dayOfWeek))
                .font(BinMateTheme.Typography.label)
                .foregroundColor(isVerge ? BinMateTheme.Colors.amber : BinMateTheme.Colors.textMuted)
                .kerning(0.5)
            Text(dayNumber(collection.date))
                .font(BinMateTheme.Typography.heading3)
                .foregroundColor(isVerge ? BinMateTheme.Colors.amber : BinMateTheme.Colors.textPrimary)
        }
        .frame(width: 44, alignment: .center)
    }

    // MARK: - Content column

    private var contentColumn: some View {
        VStack(alignment: .leading, spacing: BinMateTheme.Spacing.xs) {
            // Bin type pills + optional verge badge
            HStack(spacing: BinMateTheme.Spacing.xs) {
                ForEach(collection.types, id: \.self) { type in
                    BinTypePill(type: type)
                }
                if isVerge { vergePill }
                if collection.isHolidayShifted { holidayBadge }
            }

            // Struck-through original date when holiday-shifted
            if collection.isHolidayShifted, let original = collection.originalDate {
                Text(shortDate(original))
                    .font(BinMateTheme.Typography.caption)
                    .foregroundColor(BinMateTheme.Colors.textMuted)
                    .strikethrough(true, color: BinMateTheme.Colors.textMuted)
            }
        }
    }

    // MARK: - Supplementary pills

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

    private var holidayBadge: some View {
        Image(systemName: "arrow.right.circle")
            .font(BinMateTheme.Typography.bodySmall)
            .foregroundColor(BinMateTheme.Colors.teal)
            .accessibilityHidden(true)
    }

    // MARK: - Date helpers

    private func dayAbbrev(_ dayOfWeek: String) -> String {
        String(dayOfWeek.prefix(3)).uppercased()
    }

    private func dayNumber(_ isoDate: String) -> String {
        guard let date = isoParser.date(from: isoDate) else { return "" }
        let f = DateFormatter()
        f.dateFormat = "d"
        return f.string(from: date)
    }

    private func shortDate(_ isoDate: String) -> String {
        guard let date = isoParser.date(from: isoDate) else { return isoDate }
        let f = DateFormatter()
        f.dateFormat = "d MMM"
        return f.string(from: date)
    }

    private let isoParser: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    private var eventIconName: String {
        switch collection.eventType {
        case .kerbside: return BinMateTheme.Symbols.bins
        case .verge: return BinMateTheme.Symbols.verge
        case .ewaste: return BinMateTheme.Symbols.ewaste
        case .greenWasteDrop: return BinMateTheme.Symbols.greenDrop
        }
    }

    private var eventIconForeground: Color {
        switch collection.eventType {
        case .kerbside: return BinMateTheme.Colors.lime
        case .verge: return BinMateTheme.Colors.amber
        case .ewaste: return BinMateTheme.Colors.teal
        case .greenWasteDrop: return BinMateTheme.Colors.binGreen
        }
    }

    private var eventIconBackground: Color {
        switch collection.eventType {
        case .kerbside: return BinMateTheme.Colors.limeFaint
        case .verge: return BinMateTheme.Colors.amberFaint
        case .ewaste: return BinMateTheme.Colors.tealFaint
        case .greenWasteDrop: return BinMateTheme.Colors.binGreen.opacity(0.12)
        }
    }
}
