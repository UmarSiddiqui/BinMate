import SwiftUI

/// Full-year calendar view — 12 month grids with bin type dot indicators per day.
struct CalendarView: View {

    @EnvironmentObject private var appState: AppState
    @StateObject private var viewModel = CalendarViewModel()

    // MARK: - Body

    var body: some View {
        ZStack {
            BinMateTheme.Colors.bgBase.ignoresSafeArea()

            ScrollView {
                LazyVStack(alignment: .leading, spacing: BinMateTheme.Spacing.xl) {
                    ForEach(viewModel.months, id: \.self) { month in
                        MonthSectionView(
                            month: month,
                            dotTypes: viewModel.dotTypes(on:),
                            hasVerge: viewModel.hasVerge(on:),
                            isShifted: viewModel.isHolidayShifted(on:),
                            selectedDate: $viewModel.selectedDate
                        )
                    }
                    Color.clear.frame(height: BinMateTheme.Spacing.xl)
                }
                .padding(.horizontal, BinMateTheme.Spacing.md)
                .padding(.top, BinMateTheme.Spacing.md)
            }

            if viewModel.isLoading {
                ProgressView().tint(BinMateTheme.Colors.lime)
            }
        }
        .sheet(isPresented: Binding(
            get: { viewModel.selectedDate != nil },
            set: { if !$0 { viewModel.selectedDate = nil } }
        )) {
            if let date = viewModel.selectedDate {
                DayDetailSheet(date: date, collections: viewModel.selectedCollections)
                    .presentationDetents([.medium])
            }
        }
        .task {
            await viewModel.load(zoneId: appState.primaryZoneId ?? "")
        }
    }
}

// MARK: - Month section

private struct MonthSectionView: View {

    let month: Date
    let dotTypes: (String) -> [BinType]
    let hasVerge: (String) -> Bool
    let isShifted: (String) -> Bool
    @Binding var selectedDate: String?

    private let cal = Calendar.current
    private let dayLabels = ["M", "T", "W", "T", "F", "S", "S"]
    private let columns = Array(repeating: GridItem(.flexible(), spacing: 2), count: 7)

    var body: some View {
        VStack(alignment: .leading, spacing: BinMateTheme.Spacing.sm) {
            Text(monthTitle)
                .font(BinMateTheme.Typography.heading3)
                .foregroundColor(BinMateTheme.Colors.textPrimary)
                .padding(.bottom, BinMateTheme.Spacing.xs)

            LazyVGrid(columns: columns, spacing: 2) {
                ForEach(dayLabels.indices, id: \.self) { i in
                    Text(dayLabels[i])
                        .font(BinMateTheme.Typography.label)
                        .foregroundColor(BinMateTheme.Colors.textMuted)
                        .frame(maxWidth: .infinity)
                        .padding(.bottom, BinMateTheme.Spacing.xs)
                }

                ForEach(0..<startOffset, id: \.self) { _ in
                    Color.clear.frame(height: dayCellHeight)
                }

                ForEach(1...daysInMonth, id: \.self) { day in
                    let iso = isoString(for: day)
                    let dots = dotTypes(iso)
                    DayCell(
                        day: day,
                        dots: dots,
                        isVerge: hasVerge(iso),
                        isShifted: isShifted(iso),
                        isToday: isToday(day),
                        isSelected: selectedDate == iso
                    )
                    .onTapGesture {
                        if !dots.isEmpty || hasVerge(iso) {
                            selectedDate = iso
                        }
                    }
                }
            }
        }
    }

    // MARK: - Helpers

    private var monthTitle: String {
        let f = DateFormatter(); f.dateFormat = "MMMM yyyy"
        return f.string(from: month).uppercased()
    }

    private var daysInMonth: Int {
        cal.range(of: .day, in: .month, for: month)?.count ?? 30
    }

    private var startOffset: Int {
        let wd = cal.component(.weekday, from: month) // 1=Sun … 7=Sat
        return (wd - 2 + 7) % 7
    }

    private let dayCellHeight: CGFloat = 58

    private func isoString(for day: Int) -> String {
        var comps = cal.dateComponents([.year, .month], from: month)
        comps.day = day
        guard let date = cal.date(from: comps) else { return "" }
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
        return f.string(from: date)
    }

    private func isToday(_ day: Int) -> Bool {
        var comps = cal.dateComponents([.year, .month], from: month)
        comps.day = day
        guard let date = cal.date(from: comps) else { return false }
        return cal.isDateInToday(date)
    }
}

// MARK: - Day cell

private struct DayCell: View {

    let day: Int
    let dots: [BinType]
    let isVerge: Bool
    let isShifted: Bool
    let isToday: Bool
    let isSelected: Bool

    private let iconSize: CGFloat = 14
    private let ringSize: CGFloat = 30

    var body: some View {
        VStack(spacing: 3) {
            ZStack {
                if isSelected {
                    Circle().fill(BinMateTheme.Colors.lime).frame(width: ringSize, height: ringSize)
                } else if isToday {
                    Circle().stroke(BinMateTheme.Colors.lime, lineWidth: 1.5).frame(width: ringSize, height: ringSize)
                }

                HStack(spacing: 1) {
                    Text("\(day)")
                        .font(BinMateTheme.Typography.body)
                        .foregroundColor(dayNumberColor)
                    if isShifted {
                        Image(systemName: "arrow.right")
                            .font(.system(size: 7, weight: .bold))
                            .foregroundColor(BinMateTheme.Colors.teal)
                            .accessibilityHidden(true)
                    }
                }
            }

            HStack(spacing: 2) {
                if dots.isEmpty && isVerge {
                    Circle().fill(BinMateTheme.Colors.amber).frame(width: 5, height: 5)
                } else {
                    ForEach(Array(dots.prefix(3)), id: \.self) { type in
                        Image(type.iconAssetName)
                            .resizable()
                            .renderingMode(.original)
                            .scaledToFit()
                            .frame(height: iconSize)
                    }
                }
            }
            .frame(height: iconSize)
            .accessibilityHidden(true)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 58)
        .accessibilityLabel(accessibilityText)
    }

    private var dayNumberColor: Color {
        if isSelected { return BinMateTheme.Colors.bgBase }
        if isVerge    { return BinMateTheme.Colors.amber }
        if dots.isEmpty && !isVerge { return BinMateTheme.Colors.textMuted }
        return BinMateTheme.Colors.textPrimary
    }

    private var accessibilityText: String {
        if isVerge  { return "Day \(day), verge collection" }
        if !dots.isEmpty { return "Day \(day), bin collection" }
        return "Day \(day)"
    }
}
