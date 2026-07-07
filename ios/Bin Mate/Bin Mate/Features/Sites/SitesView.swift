import MapKit
import SwiftUI

/// Tab view listing nearby Perth waste transfer stations and drop-off points.
struct SitesView: View {

    @StateObject private var viewModel = SitesViewModel()
    @State private var displayMode: DisplayMode = .list

    /// Initial map region centred on Perth metro.
    @State private var mapRegion = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: -31.95, longitude: 115.86),
        span: MKCoordinateSpan(latitudeDelta: 0.9, longitudeDelta: 0.9)
    )

    private enum DisplayMode: String, CaseIterable {
        case list = "List"
        case map  = "Map"
    }

    var body: some View {
        NavigationStack {
            ZStack {
                BinMateTheme.Colors.bgBase.ignoresSafeArea()

                VStack(spacing: 0) {
                    modePicker
                    Divider().background(BinMateTheme.Colors.borderSubtle)

                    if displayMode == .list {
                        sitesList
                    } else {
                        sitesMap
                    }
                }
            }
            .navigationTitle("Drop-off Sites")
            .navigationBarTitleDisplayMode(.large)
            .onAppear { viewModel.requestLocation() }
        }
    }

    // MARK: - Segment picker

    private var modePicker: some View {
        Picker("Display", selection: $displayMode) {
            ForEach(DisplayMode.allCases, id: \.self) { mode in
                Text(mode.rawValue).tag(mode)
            }
        }
        .pickerStyle(.segmented)
        .padding(.horizontal, BinMateTheme.Spacing.lg)
        .padding(.vertical, BinMateTheme.Spacing.sm)
    }

    // MARK: - List

    private var sitesList: some View {
        ScrollView {
            VStack(spacing: BinMateTheme.Spacing.sm) {
                if viewModel.locationDenied {
                    locationDeniedBanner
                } else if viewModel.isLocating {
                    locationLoadingNote
                }

                ForEach(viewModel.sortedSites) { site in
                    NavigationLink {
                        SiteDetailView(site: site, userLocation: viewModel.userLocation)
                    } label: {
                        SiteListCard(
                            site: site,
                            distanceLabel: viewModel.distanceLabel(for: site)
                        )
                    }
                    .buttonStyle(.plain)
                }

                staticDataNote
                Color.clear.frame(height: BinMateTheme.Spacing.xl)
            }
            .padding(.horizontal, BinMateTheme.Spacing.lg)
            .padding(.top, BinMateTheme.Spacing.md)
        }
    }

    // MARK: - Map

    private var sitesMap: some View {
        Map(coordinateRegion: $mapRegion, annotationItems: viewModel.sortedSites) { site in
            MapAnnotation(coordinate: site.coordinate) {
                mapPin(for: site)
            }
        }
        .ignoresSafeArea(edges: .bottom)
        .onChange(of: viewModel.userLocation) { location in
            guard let location else { return }
            withAnimation(BinMateTheme.Animation.slow) {
                mapRegion.center = location.coordinate
                mapRegion.span = MKCoordinateSpan(latitudeDelta: 0.5, longitudeDelta: 0.5)
            }
        }
    }

    private func mapPin(for site: WasteSite) -> some View {
        VStack(spacing: 2) {
            ZStack {
                Circle()
                    .fill(BinMateTheme.Colors.lime)
                    .frame(width: 32, height: 32)
                Image(systemName: BinMateTheme.Symbols.verge)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(BinMateTheme.Colors.bgBase)
                    .accessibilityHidden(true)
            }
            Text(site.name.components(separatedBy: " ").prefix(2).joined(separator: " "))
                .font(BinMateTheme.Typography.caption)
                .foregroundColor(BinMateTheme.Colors.textPrimary)
                .padding(.horizontal, 4)
                .padding(.vertical, 2)
                .background(BinMateTheme.Colors.bgRaised.opacity(0.85))
                .clipShape(RoundedRectangle(cornerRadius: BinMateTheme.Radius.sm))
        }
    }

    // MARK: - Banners

    private var locationDeniedBanner: some View {
        HStack(spacing: BinMateTheme.Spacing.sm) {
            Image(systemName: "location.slash.fill")
                .foregroundColor(BinMateTheme.Colors.amber)
                .accessibilityHidden(true)
            Text("Enable location in Settings to sort sites by distance.")
                .font(BinMateTheme.Typography.bodySmall)
                .foregroundColor(BinMateTheme.Colors.amber)
        }
        .padding(BinMateTheme.Spacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(BinMateTheme.Colors.amberFaint)
        .clipShape(RoundedRectangle(cornerRadius: BinMateTheme.Radius.md))
    }

    private var locationLoadingNote: some View {
        HStack(spacing: BinMateTheme.Spacing.xs) {
            ProgressView()
                .scaleEffect(0.75)
                .tint(BinMateTheme.Colors.textMuted)
            Text("Getting your location…")
                .font(BinMateTheme.Typography.bodySmall)
                .foregroundColor(BinMateTheme.Colors.textMuted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, BinMateTheme.Spacing.xs)
    }

    private var staticDataNote: some View {
        Text("Site details are approximate. Always check the facility website before travelling.")
            .font(BinMateTheme.Typography.caption)
            .foregroundColor(BinMateTheme.Colors.textMuted)
            .multilineTextAlignment(.center)
            .padding(.top, BinMateTheme.Spacing.sm)
    }
}

// MARK: - Site list card

private struct SiteListCard: View {

    let site: WasteSite
    let distanceLabel: String?

    var body: some View {
        HStack(spacing: BinMateTheme.Spacing.md) {
            typeIcon

            VStack(alignment: .leading, spacing: 2) {
                Text(site.name)
                    .font(BinMateTheme.Typography.body)
                    .foregroundColor(BinMateTheme.Colors.textPrimary)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                Text(site.operator_)
                    .font(BinMateTheme.Typography.bodySmall)
                    .foregroundColor(BinMateTheme.Colors.textSecondary)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                if let label = distanceLabel {
                    Text(label)
                        .font(BinMateTheme.Typography.data)
                        .foregroundColor(BinMateTheme.Colors.lime)
                }
                Image(systemName: BinMateTheme.Symbols.next)
                    .font(.caption)
                    .foregroundColor(BinMateTheme.Colors.textMuted)
            }
        }
        .padding(BinMateTheme.Spacing.md)
        .background(BinMateTheme.Colors.bgRaised)
        .clipShape(RoundedRectangle(cornerRadius: BinMateTheme.Radius.lg))
    }

    private var typeIcon: some View {
        ZStack {
            Circle()
                .fill(BinMateTheme.Colors.limeFaint)
                .frame(width: 40, height: 40)
            Image(systemName: siteSymbol)
                .font(.system(size: 16))
                .foregroundColor(BinMateTheme.Colors.lime)
                .accessibilityHidden(true)
        }
    }

    private var siteSymbol: String {
        switch site.siteType {
        case .transferStation:  return "building.2"
        case .recyclingCentre:  return BinMateTheme.Symbols.recycling
        case .eWasteDrop:       return "desktopcomputer"
        case .greenWasteDrop:   return BinMateTheme.Symbols.garden
        }
    }
}
