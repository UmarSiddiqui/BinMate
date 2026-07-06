import SwiftUI

/// Full-year calendar view — 12 month grids with bin type dot indicators per day.
/// Free tier: dots visible for the next 7 days only; locked cells beyond that.
struct CalendarView: View {

    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var entitlementService: EntitlementService
    @StateObject private var viewModel = CalendarViewModel()
    @State private var showPaywall = false

    // MARK: - Free tier helpers

    /// The last date free users can see collection dots (today + 7 days).
    private static let freeDayWindow = 7
    private static let isoFormatter: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; return f
    }()

    private var freeWindowDate: Date {
        Calendar.current.date(byAdding: .day, value: Self.freeDayWindow, to: Date()) ?? Date()
    }

    private func isLocked(_ iso: String) -> Bool {
        guard !entitlementService.isPremium else { return false }
        guard let date = Self.isoFormatter.date(from: iso) else { return false }
        return date > freeWindowDate
    }

    // MARK: - Body

    var body: some View {
        ZStack {
            BinMateTheme.Colors.bgBase.ignoresSafeArea()

            ScrollView {
                LazyVStack(alignment: .leading, spacing: BinMateTheme.Spacing.xl) {
                    if !entitlementService.isPremium {
                        freeTierBanner
                            .padding(.horizontal, BinMateTheme.Spacing.md)
                    }

                    ForEach(viewModel.months, id: \.self) { month in
                        MonthSectionView(
                            month: month,
                            dotTypes: viewModel.dotTypes(on:),
                            hasVerge: viewModel.hasVerge(on:),
                            isShifted: viewModel.isHolidayShifted(on:),
                            isLocked: isLocked,
                            onLockedTap: { showPaywall = true },
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
        .binMatePaywall(isPresented: $showPaywall)
        .task {
            await viewModel.load(zoneId: appState.primaryZoneId ?? "")
        }
    }

    // MARK: - Free tier banner

    private var freeTierBanner: some View {
        HStack(spacing: BinMateTheme.Spacing.sm) {
            VStack(alignment: .leading, spacing: BinMateTheme.Spacing.xs) {
                Text("Showing next 7 days")
                    .font(BinMateTheme.Typography.heading3)
                    .foregroundStyle(BinMateTheme.Colors.textPrimary)
                Text("Premium unlocks the full year.")
                    .font(BinMateTheme.Typography.bodySmall)
                    .foregroundStyle(BinMateTheme.Colors.textSecondary)
            }
            Spacer()
            Button { showPaywall = true } label: {
                Text("Upgrade")
                    .font(BinMateTheme.Typography.label)
                    .foregroundStyle(BinMateTheme.Colors.bgBase)
                    .padding(.horizontal, BinMateTheme.Spacing.md)
                    .padding(.vertical, BinMateTheme.Spacing.sm)
                    .background(BinMateTheme.Colors.lime)
                    .clipShape(Capsule())
            }
            .accessibilityLabel("Upgrade to Premium to unlock the full year calendar")
        }
        .padding(BinMateTheme.Spacing.md)
        .background(BinMateTheme.Colors.bgRaised)
        .clipShape(RoundedRectangle(cornerRadius: BinMateTheme.Radius.card))
        .overlay(
            RoundedRectangle(cornerRadius: BinMateTheme.Radius.card)
                .strokeBorder(BinMateTheme.Colors.limeBorder, lineWidth: 1)
        )
    }
}

// MARK: - Month section

private struct MonthSectionView: View {

    let month: Date
    let dotTypes: (String) -> [BinType]
    let hasVerge: (String) -> Bool
    let isShifted: (String) -> Bool
    let isLocked: (String) -> Bool
    let onLockedTap: () -> Void
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
                    let locked = isLocked(iso)
                    DayCell(
                        day: day,
                        dots: dots,
                        isVerge: hasVerge(iso),
                        isShifted: isShifted(iso),
                        isToday: isToday(day),
                        isSelected: selectedDate == iso,
                        isLocked: locked
                    )
                    .onTapGesture {
                        if locked {
                            onLockedTap()
                        } else if !dots.isEmpty || hasVerge(iso) {
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
    let isLocked: Bool

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
                    if isLocked {
                        Image(systemName: "lock.fill")
                            .font(.system(size: 7, weight: .bold))
                            .foregroundColor(BinMateTheme.Colors.textDisabled)
                            .accessibilityHidden(true)
                    } else if isShifted {
                        Image(systemName: "arrow.right")
                            .font(.system(size: 7, weight: .bold))
                            .foregroundColor(BinMateTheme.Colors.teal)
                            .accessibilityHidden(true)
                    }
                }
            }

            // Bin icons hidden for locked cells
            HStack(spacing: 2) {
                if !isLocked {
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
            }
            .frame(height: iconSize)
            .accessibilityHidden(true)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 58)
        .accessibilityLabel(accessibilityText)
    }

    private var dayNumberColor: Color {
        if isLocked   { return BinMateTheme.Colors.textDisabled }
        if isSelected { return BinMateTheme.Colors.bgBase }
        if isVerge    { return BinMateTheme.Colors.amber }
        if dots.isEmpty && !isVerge { return BinMateTheme.Colors.textMuted }
        return BinMateTheme.Colors.textPrimary
    }

    private var accessibilityText: String {
        if isLocked { return "Day \(day), locked — upgrade to Premium to view" }
        if isVerge  { return "Day \(day), verge collection" }
        if !dots.isEmpty { return "Day \(day), bin collection" }
        return "Day \(day)"
    }
}
