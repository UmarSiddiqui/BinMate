import SwiftUI

/// Primary tab — shows the date/location header, hero card, and upcoming schedule.
struct HomeView: View {

    @EnvironmentObject private var appState: AppState
    @StateObject private var viewModel = HomeViewModel(repository: ScheduleRepository.shared)

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
                            UpcomingScheduleList(collections: viewModel.listCollections)
                        }

                        bulkCollectionCard

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

    // MARK: - Bulk collection entry card

    private var bulkCollectionCard: some View {
        NavigationLink {
            BulkCollectionView(
                viewModel: BulkCollectionViewModel(
                    councilName: appState.primaryCouncilName ?? "",
                    vergeCollections: viewModel.vergeCollections
                )
            )
        } label: {
            HStack(spacing: BinMateTheme.Spacing.md) {
                BinMateIconBadge(
                    systemName: BinMateTheme.Symbols.verge,
                    foreground: BinMateTheme.Colors.amber,
                    background: BinMateTheme.Colors.amberFaint
                )

                VStack(alignment: .leading, spacing: 2) {
                    Text("Bulk Collection")
                        .font(BinMateTheme.Typography.body)
                        .foregroundColor(BinMateTheme.Colors.textPrimary)
                    Text(bulkCollectionSubtitle)
                        .font(BinMateTheme.Typography.bodySmall)
                        .foregroundColor(BinMateTheme.Colors.textSecondary)
                }

                Spacer()

                Image(systemName: BinMateTheme.Symbols.next)
                    .font(.caption)
                    .foregroundColor(BinMateTheme.Colors.textMuted)
            }
            .padding(BinMateTheme.Spacing.md)
            .background(BinMateTheme.Colors.bgRaised)
            .clipShape(RoundedRectangle(cornerRadius: BinMateTheme.Radius.lg))
        }
        .buttonStyle(.plain)
    }

    private var bulkCollectionSubtitle: String {
        if viewModel.vergeCollections.isEmpty { return "On demand — tap to request" }
        let first = viewModel.vergeCollections[0]
        return "Next: \(first.dayOfWeek), \(first.date)"
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
