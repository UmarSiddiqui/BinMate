import SwiftUI
import WidgetKit

// MARK: - Inline colour tokens (widget target has no access to main app's BinMateTheme)

enum WidgetColors {
    static let bgBase        = Color(red: 0.051, green: 0.059, blue: 0.071) // #0D0F12
    static let bgRaised      = Color(red: 0.102, green: 0.114, blue: 0.133) // #1A1D22
    static let lime          = Color(red: 0.722, green: 0.941, blue: 0.290) // #B8F04A
    static let textPrimary   = Color(red: 0.941, green: 0.949, blue: 0.961) // #F0F2F5
    static let textSecondary = Color(red: 0.608, green: 0.639, blue: 0.678) // #9BA3AD
    static let textMuted     = Color(red: 0.420, green: 0.455, blue: 0.502) // #6B7480
    static let amber         = Color(red: 0.961, green: 0.651, blue: 0.137) // #F5A623
    static let binRed        = Color(red: 0.827, green: 0.184, blue: 0.184) // #D32F2F
    static let binYellow     = Color(red: 0.961, green: 0.902, blue: 0.259) // #F5E642
    static let binGreen      = Color(red: 0.298, green: 0.686, blue: 0.314) // #4CAF50
    static let divider       = Color.white.opacity(0.07)
}

// MARK: - Entry view dispatcher

/// Routes to the correct layout based on widget family.
struct BinMateWidgetEntryView: View {

    @Environment(\.widgetFamily) private var family
    let entry: BinMateEntry

    var body: some View {
        switch family {
        case .systemSmall:  SmallWidgetView(entry: entry)
        case .systemMedium: MediumWidgetView(entry: entry)
        default:            SmallWidgetView(entry: entry)
        }
    }
}

// MARK: - Small widget

private struct SmallWidgetView: View {

    let entry: BinMateEntry
    private var next: WidgetCollection? { entry.nextCollections.first }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {

            // Header row
            headerRow
                .padding(.bottom, 8)

            Spacer(minLength: 0)

            if let c = next {
                collectionContent(c)
            } else {
                nothingDue
            }

            Spacer(minLength: 0)

            // Suburb footer
            if !entry.suburb.isEmpty {
                Text(entry.suburb.uppercased())
                    .font(.custom("DM Mono", size: 9).weight(.medium))
                    .foregroundStyle(WidgetColors.textMuted)
                    .kerning(0.5)
                    .lineLimit(1)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityLabel)
    }

    private var headerRow: some View {
        HStack(spacing: 4) {
            Image(systemName: "trash")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(WidgetColors.lime)
            Text("BINMATE")
                .font(.custom("DM Mono", size: 9).weight(.medium))
                .foregroundStyle(WidgetColors.lime)
                .kerning(0.8)
        }
    }

    private func collectionContent(_ c: WidgetCollection) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(dateLabel(c.date))
                .font(.custom("Syne", size: 14).weight(.bold))
                .foregroundStyle(WidgetColors.textPrimary)
                .lineLimit(1)

            // Coloured dots
            HStack(spacing: 3) {
                ForEach(Array(c.types.prefix(3)), id: \.self) { type in
                    Circle()
                        .fill(dotColor(type))
                        .frame(width: 8, height: 8)
                }
                if c.isVerge {
                    Circle().fill(WidgetColors.amber).frame(width: 8, height: 8)
                }
            }

            Text(binLabel(c.types, isVerge: c.isVerge))
                .font(.custom("DM Sans", size: 12))
                .foregroundStyle(WidgetColors.textSecondary)
                .lineLimit(2)
        }
    }

    private var nothingDue: some View {
        Text("Nothing\ndue this week")
            .font(.custom("Syne", size: 14).weight(.bold))
            .foregroundStyle(WidgetColors.textSecondary)
            .lineLimit(2)
    }

    private var accessibilityLabel: String {
        guard let c = next else { return "BinMate — no bins due this week" }
        return "BinMate — \(dateLabel(c.date)): \(binLabel(c.types, isVerge: c.isVerge))"
    }
}

// MARK: - Medium widget

private struct MediumWidgetView: View {

    let entry: BinMateEntry
    private var displayCollections: [WidgetCollection] { Array(entry.nextCollections.prefix(3)) }
    private var next: WidgetCollection? { entry.nextCollections.first }

    var body: some View {
        HStack(spacing: 0) {
            // Left pane — hero
            heroPart
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)

            // Divider
            Rectangle()
                .fill(WidgetColors.divider)
                .frame(width: 1)

            // Right pane — upcoming rows
            upcomingList
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }

    private var heroPart: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 4) {
                Image(systemName: "trash")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(WidgetColors.lime)
                Text("BINMATE")
                    .font(.custom("DM Mono", size: 9).weight(.medium))
                    .foregroundStyle(WidgetColors.lime)
                    .kerning(0.8)
            }
            .padding(.bottom, 8)

            Spacer(minLength: 0)

            if let c = next {
                VStack(alignment: .leading, spacing: 4) {
                    Text(dateLabel(c.date))
                        .font(.custom("Syne", size: 14).weight(.bold))
                        .foregroundStyle(WidgetColors.textPrimary)
                        .lineLimit(1)
                    HStack(spacing: 3) {
                        ForEach(Array(c.types.prefix(3)), id: \.self) { t in
                            Circle().fill(dotColor(t)).frame(width: 8, height: 8)
                        }
                        if c.isVerge {
                            Circle().fill(WidgetColors.amber).frame(width: 8, height: 8)
                        }
                    }
                    Text(binLabel(c.types, isVerge: c.isVerge))
                        .font(.custom("DM Sans", size: 12))
                        .foregroundStyle(WidgetColors.textSecondary)
                        .lineLimit(2)
                }
            } else {
                Text("Nothing\ndue this week")
                    .font(.custom("Syne", size: 14).weight(.bold))
                    .foregroundStyle(WidgetColors.textSecondary)
            }

            Spacer(minLength: 0)

            if !entry.suburb.isEmpty {
                Text(entry.suburb.uppercased())
                    .font(.custom("DM Mono", size: 9).weight(.medium))
                    .foregroundStyle(WidgetColors.textMuted)
                    .kerning(0.5)
                    .lineLimit(1)
            }
        }
        .padding(14)
    }

    private var upcomingList: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(displayCollections.indices, id: \.self) { i in
                UpcomingRowView(collection: displayCollections[i])
                if i < displayCollections.count - 1 {
                    Divider()
                        .background(WidgetColors.divider)
                        .padding(.leading, 8)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 10)
    }
}

// MARK: - Upcoming row (medium widget)

private struct UpcomingRowView: View {

    let collection: WidgetCollection

    var body: some View {
        HStack(spacing: 8) {
            // Date column
            VStack(spacing: 1) {
                Text(String(collection.dayOfWeek.prefix(3)).uppercased())
                    .font(.custom("DM Mono", size: 8).weight(.medium))
                    .foregroundStyle(WidgetColors.textMuted)
                Text(dayNumber(collection.date))
                    .font(.custom("Syne", size: 14).weight(.bold))
                    .foregroundStyle(WidgetColors.textPrimary)
            }
            .frame(width: 32, alignment: .center)

            // Dots
            HStack(spacing: 3) {
                ForEach(Array(collection.types.prefix(3)), id: \.self) { type in
                    Circle().fill(dotColor(type)).frame(width: 7, height: 7)
                }
                if collection.isVerge {
                    Circle().fill(WidgetColors.amber).frame(width: 7, height: 7)
                }
            }

            Spacer()
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(collection.dayOfWeek): \(binLabel(collection.types, isVerge: collection.isVerge))")
    }
}

// MARK: - Shared helpers

func dateLabel(_ isoDate: String) -> String {
    let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
    guard let date = f.date(from: isoDate) else { return isoDate }
    let cal = Calendar.current
    if cal.isDateInToday(date)    { return "Today" }
    if cal.isDateInTomorrow(date) { return "Tomorrow" }
    let d = DateFormatter(); d.dateFormat = "EEE d MMM"
    return d.string(from: date)
}

func dayNumber(_ isoDate: String) -> String {
    let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
    guard let date = f.date(from: isoDate) else { return "" }
    let d = DateFormatter(); d.dateFormat = "d"
    return d.string(from: date)
}

func dotColor(_ type: String) -> Color {
    switch type {
    case "general":     return WidgetColors.binRed
    case "recycling":   return WidgetColors.binYellow
    case "green_waste": return WidgetColors.binGreen
    case "fogo":        return WidgetColors.lime
    default:            return WidgetColors.textMuted
    }
}

func binLabel(_ types: [String], isVerge: Bool) -> String {
    var names = types.map { t -> String in
        switch t {
        case "general":     return "General"
        case "recycling":   return "Recycling"
        case "green_waste": return "Green Waste"
        case "fogo":        return "FOGO"
        default:            return t.capitalized
        }
    }
    if isVerge { names.append("Verge") }
    return names.joined(separator: " + ")
}
