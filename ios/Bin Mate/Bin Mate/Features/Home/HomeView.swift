import SwiftUI

/// Primary tab — shows the date/location header, hero card, and upcoming schedule.
struct HomeView: View {

    @EnvironmentObject private var appState: AppState
    @StateObject private var viewModel = HomeViewModel(repository: ScheduleRepository.shared)

    private enum Metrics {
        static let dashboardChipHeight: CGFloat = 70
        static let dashboardIconSize: CGFloat = 30
        static let dashboardSymbolSize: CGFloat = 13
        static let dashboardValueScale: CGFloat = 0.82
    }

    var body: some View {
        NavigationStack {
            ZStack {
                BinMateTheme.Colors.bgBase.ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: BinMateTheme.Spacing.lg) {
                        header

                        if viewModel.isLoading && viewModel.collections.isEmpty {
                            skeletonHeroCard
                        } else if !viewModel.isLoading && viewModel.collections.isEmpty
                                    && viewModel.error == nil {
                            emptyState
                        } else {
                            HeroCollectionCard(
                                title: viewModel.heroTitle,
                                subtitle: viewModel.heroSubtitle,
                                types: viewModel.heroCollection?.types ?? [],
                                isActive: viewModel.heroCollection != nil
                            )
                        }

                        if !viewModel.listCollections.isEmpty {
                            sectionHeader("Upcoming")
                            UpcomingScheduleList(collections: viewModel.listCollections)
                        }

                        dashboardStrip

                        if let err = viewModel.error, err.isUserFacing {
                            errorBanner(err)
                        }

                        // Bottom breathing room above tab bar
                        Color.clear.frame(height: BinMateTheme.Spacing.xl)
                    }
                    .padding(.horizontal, BinMateTheme.Spacing.lg)
                    .padding(.top, BinMateTheme.Spacing.md)
                }
                .refreshable {
                    await viewModel.refresh(
                        zoneId: appState.primaryZoneId ?? "",
                        suburb: appState.primarySuburb ?? ""
                    )
                }
            }
            .navigationBarHidden(true)
            .task {
                await viewModel.loadSchedule(
                    zoneId: appState.primaryZoneId ?? "",
                    suburb: appState.primarySuburb ?? ""
                )
            }
        }
    }

    // MARK: - Dashboard strip

    private var dashboardStrip: some View {
        HStack(spacing: BinMateTheme.Spacing.sm) {
            dashboardChip(
                title: "Next bin",
                value: viewModel.nextKerbsideSummary,
                icon: BinMateTheme.Symbols.calendar,
                foreground: BinMateTheme.Colors.lime,
                background: BinMateTheme.Colors.limeFaint
            )

            NavigationLink {
                BulkCollectionView(
                    viewModel: BulkCollectionViewModel(
                        councilName: appState.primaryCouncilName ?? "",
                        vergeCollections: viewModel.vergeCollections
                    )
                )
            } label: {
                dashboardChip(
                    title: "Bulk",
                    value: viewModel.bulkCollectionSummary,
                    icon: BinMateTheme.Symbols.verge,
                    foreground: BinMateTheme.Colors.amber,
                    background: BinMateTheme.Colors.amberFaint,
                    showsDisclosure: true
                )
            }
            .buttonStyle(.plain)
        }
    }

    private func dashboardChip(
        title: String,
        value: String,
        icon: String,
        foreground: Color,
        background: Color,
        showsDisclosure: Bool = false
    ) -> some View {
        HStack(spacing: BinMateTheme.Spacing.sm) {
            BinMateIconBadge(
                systemName: icon,
                foreground: foreground,
                background: background,
                size: Metrics.dashboardIconSize,
                symbolSize: Metrics.dashboardSymbolSize
            )

            VStack(alignment: .leading, spacing: 2) {
                Text(title.uppercased())
                    .font(BinMateTheme.Typography.label)
                    .foregroundColor(BinMateTheme.Colors.textMuted)
                    .lineLimit(1)
                Text(value)
                    .font(BinMateTheme.Typography.bodySmall)
                    .foregroundColor(BinMateTheme.Colors.textPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(Metrics.dashboardValueScale)
            }

            Spacer(minLength: 0)

            if showsDisclosure {
                Image(systemName: BinMateTheme.Symbols.next)
                    .font(.caption2)
                    .foregroundColor(BinMateTheme.Colors.textMuted)
                    .accessibilityHidden(true)
            }
        }
        .frame(maxWidth: .infinity, minHeight: Metrics.dashboardChipHeight, alignment: .leading)
        .padding(.horizontal, BinMateTheme.Spacing.sm)
        .background(BinMateTheme.Colors.bgRaised)
        .clipShape(RoundedRectangle(cornerRadius: BinMateTheme.Radius.lg))
        .overlay {
            RoundedRectangle(cornerRadius: BinMateTheme.Radius.lg)
                .stroke(BinMateTheme.Colors.borderSubtle)
        }
    }

    // MARK: - Section header

    private func sectionHeader(_ title: String) -> some View {
        HStack {
            Text(title.uppercased())
                .font(BinMateTheme.Typography.label)
                .foregroundColor(BinMateTheme.Colors.textMuted)
                .kerning(1.1)
            Spacer()
        }
        .padding(.top, BinMateTheme.Spacing.xs)
    }

    // MARK: - Header

    private var header: some View {
        VStack(alignment: .leading, spacing: BinMateTheme.Spacing.xs) {
            Text(todayLabel)
                .font(BinMateTheme.Typography.label)
                .foregroundColor(BinMateTheme.Colors.textMuted)
                .kerning(1.5)

            HStack(spacing: BinMateTheme.Spacing.xs) {
                if let suburb = appState.primarySuburb, !suburb.isEmpty {
                    Text(suburb)
                        .font(BinMateTheme.Typography.heading2)
                        .foregroundColor(BinMateTheme.Colors.textPrimary)
                    Text("·")
                        .font(BinMateTheme.Typography.heading2)
                        .foregroundColor(BinMateTheme.Colors.textMuted)
                }
                if let council = appState.primaryCouncilName, !council.isEmpty {
                    Text(shortCouncilName(council))
                        .font(BinMateTheme.Typography.heading2)
                        .foregroundColor(BinMateTheme.Colors.textSecondary)
                        .lineLimit(1)
                }
            }
        }
    }

    // MARK: - Skeleton (initial load placeholder)

    private var skeletonHeroCard: some View {
        SkeletonView(cornerRadius: BinMateTheme.Radius.card)
            .frame(height: 120)
            .accessibilityLabel("Loading schedule")
    }

    // MARK: - Empty state (loaded but no collections)

    private var emptyState: some View {
        VStack(spacing: BinMateTheme.Spacing.md) {
            BinMateIconBadge(
                systemName: "calendar.badge.exclamationmark",
                foreground: BinMateTheme.Colors.textMuted,
                background: BinMateTheme.Colors.bgSurface,
                size: 64,
                symbolSize: 28
            )
            Text("No schedule loaded")
                .font(BinMateTheme.Typography.heading3)
                .foregroundColor(BinMateTheme.Colors.textPrimary)
            Text("Pull down to refresh, or check your internet connection.")
                .font(BinMateTheme.Typography.body)
                .foregroundColor(BinMateTheme.Colors.textSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(BinMateTheme.Spacing.xl)
        .background(BinMateTheme.Colors.bgRaised)
        .clipShape(RoundedRectangle(cornerRadius: BinMateTheme.Radius.card))
    }

    // MARK: - Error banner

    private func errorBanner(_ err: BinMateError) -> some View {
        HStack(spacing: BinMateTheme.Spacing.sm) {
            BinMateIconBadge(
                systemName: "exclamationmark.triangle.fill",
                foreground: BinMateTheme.Colors.amber,
                background: BinMateTheme.Colors.bgSurface,
                size: 24,
                symbolSize: 12
            )
            Text(err.errorDescription ?? "Couldn't load schedule")
                .font(BinMateTheme.Typography.bodySmall)
                .foregroundColor(BinMateTheme.Colors.amber)
        }
        .padding(BinMateTheme.Spacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(BinMateTheme.Colors.amberFaint)
        .clipShape(RoundedRectangle(cornerRadius: BinMateTheme.Radius.md))
    }

    // MARK: - Helpers

    private var todayLabel: String {
        let f = DateFormatter()
        f.dateFormat = "EEEE, d MMM"
        return f.string(from: Date()).uppercased()
    }

    /// Strips "City of" / "Town of" / "Shire of" for compact display.
    private func shortCouncilName(_ name: String) -> String {
        let prefixes = ["City of ", "Town of ", "Shire of "]
        for prefix in prefixes where name.hasPrefix(prefix) {
            return String(name.dropFirst(prefix.count))
        }
        return name
    }
}
