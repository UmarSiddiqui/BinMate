import SwiftUI

/// Primary tab — shows the date/location header, hero card, and upcoming schedule.
struct HomeView: View {

    @EnvironmentObject private var appState: AppState
    @StateObject private var viewModel = HomeViewModel(repository: ScheduleRepository.shared)
    @State private var showReminderSettings = false
    @State private var showAddAddress = false

    private enum Metrics {
        static let dashboardChipHeight: CGFloat = 70
        static let dashboardIconSize: CGFloat = 30
        static let dashboardSymbolSize: CGFloat = 13
        static let dashboardValueScale: CGFloat = 0.82
        static let emptyStateArtHeight: CGFloat = 70
    }

    var body: some View {
        NavigationStack {
            ZStack {
                BinMateTheme.Colors.bgBase.ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: BinMateTheme.Spacing.lg) {
                        HomeHeaderView(onAddAddress: { showAddAddress = true })

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
                                isActive: viewModel.heroCollection != nil,
                                onBellTap: { showReminderSettings = true }
                            )
                        }

                        if !viewModel.listCollections.isEmpty {
                            sectionHeader("Upcoming", showsViewAll: true)
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
            // Re-runs on launch and whenever the user switches house.
            .task(id: appState.primaryZoneId) {
                await viewModel.loadSchedule(
                    zoneId: appState.primaryZoneId ?? "",
                    suburb: appState.primarySuburb ?? ""
                )
            }
            .sheet(isPresented: $showAddAddress) {
                AdditionalAddressSheet { result in
                    appState.addAdditionalAddress(
                        zoneId: result.zoneId,
                        councilName: result.councilName,
                        suburb: result.suburb
                    )
                }
            }
            .sheet(isPresented: $showReminderSettings) {
                ReminderSettingsSheet()
                    .presentationDetents([.medium])
                    .presentationDragIndicator(.visible)
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
            .buttonStyle(.pressableCard)
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

    private func sectionHeader(_ title: String, showsViewAll: Bool = false) -> some View {
        HStack {
            Text(title.uppercased())
                .font(BinMateTheme.Typography.label)
                .foregroundColor(BinMateTheme.Colors.textMuted)
                .kerning(1.1)
            Spacer()
            if showsViewAll {
                Button {
                    NotificationCenter.default.post(name: .binMateShowCalendar, object: nil)
                } label: {
                    HStack(spacing: BinMateTheme.Spacing.xs) {
                        Text("View all")
                            .font(BinMateTheme.Typography.bodySmall)
                        Image(systemName: BinMateTheme.Symbols.next)
                            .font(.caption2)
                            .accessibilityHidden(true)
                    }
                    .foregroundColor(BinMateTheme.Colors.lime)
                }
                .accessibilityLabel("View full schedule in Calendar")
            }
        }
        .padding(.top, BinMateTheme.Spacing.xs)
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
            Image("BinMascot")
                .resizable()
                .scaledToFit()
                .frame(height: Metrics.emptyStateArtHeight)
                .accessibilityHidden(true)
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

}
