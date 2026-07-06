import MapKit
import SwiftUI

/// Full detail screen for a single waste drop-off site.
struct SiteDetailView: View {

    let site: WasteSite
    let userLocation: CLLocation?

    @Environment(\.openURL) private var openURL

    var body: some View {
        ZStack {
            BinMateTheme.Colors.bgBase.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: BinMateTheme.Spacing.lg) {
                    headerCard
                    if site.accessNote != nil { accessNoteBanner }
                    actionsRow
                    if !site.operatingHours.isEmpty { hoursSection }
                    acceptedSection
                    Color.clear.frame(height: BinMateTheme.Spacing.xl)
                }
                .padding(.horizontal, BinMateTheme.Spacing.lg)
                .padding(.top, BinMateTheme.Spacing.md)
            }
        }
        .navigationTitle(site.name)
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Header card

    private var headerCard: some View {
        VStack(alignment: .leading, spacing: BinMateTheme.Spacing.sm) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: BinMateTheme.Spacing.xs) {
                    Text(site.siteType.rawValue.uppercased())
                        .font(BinMateTheme.Typography.label)
                        .foregroundColor(BinMateTheme.Colors.lime)
                        .kerning(1.5)
                    Text(site.operator_)
                        .font(BinMateTheme.Typography.bodySmall)
                        .foregroundColor(BinMateTheme.Colors.textSecondary)
                }
                Spacer()
                if let label = distanceLabel {
                    Text(label)
                        .font(BinMateTheme.Typography.data)
                        .foregroundColor(BinMateTheme.Colors.lime)
                }
            }

            Divider().background(BinMateTheme.Colors.borderSubtle)

            HStack(alignment: .top, spacing: BinMateTheme.Spacing.xs) {
                Image(systemName: BinMateTheme.Symbols.location)
                    .font(.caption)
                    .foregroundColor(BinMateTheme.Colors.textMuted)
                    .padding(.top, 2)
                    .accessibilityHidden(true)
                Text(site.address)
                    .font(BinMateTheme.Typography.bodySmall)
                    .foregroundColor(BinMateTheme.Colors.textSecondary)
            }
        }
        .padding(BinMateTheme.Spacing.lg)
        .background(BinMateTheme.Colors.bgRaised)
        .clipShape(RoundedRectangle(cornerRadius: BinMateTheme.Radius.card))
    }

    // MARK: - Access note banner

    private var accessNoteBanner: some View {
        HStack(alignment: .top, spacing: BinMateTheme.Spacing.sm) {
            Image(systemName: "info.circle.fill")
                .foregroundColor(BinMateTheme.Colors.teal)
                .accessibilityHidden(true)
            Text(site.accessNote ?? "")
                .font(BinMateTheme.Typography.bodySmall)
                .foregroundColor(BinMateTheme.Colors.teal)
        }
        .padding(BinMateTheme.Spacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(BinMateTheme.Colors.tealFaint)
        .clipShape(RoundedRectangle(cornerRadius: BinMateTheme.Radius.md))
    }

    // MARK: - Actions

    private var actionsRow: some View {
        HStack(spacing: BinMateTheme.Spacing.sm) {
            directionsButton
            if site.phone != nil { phoneButton }
            if site.websiteURL != nil { websiteButton }
        }
    }

    private var directionsButton: some View {
        Button {
            openDirections()
        } label: {
            HStack(spacing: BinMateTheme.Spacing.xs) {
                Image(systemName: BinMateTheme.Symbols.directions)
                    .accessibilityHidden(true)
                Text("Directions")
            }
            .font(BinMateTheme.Typography.body)
            .foregroundColor(BinMateTheme.Colors.bgBase)
            .frame(maxWidth: .infinity)
            .padding(.vertical, BinMateTheme.Spacing.sm)
            .background(BinMateTheme.Colors.lime)
            .clipShape(RoundedRectangle(cornerRadius: BinMateTheme.Radius.md))
        }
    }

    private var phoneButton: some View {
        Button {
            guard let phone = site.phone,
                  let url = URL(string: "tel:\(phone.filter(\.isNumber))") else { return }
            openURL(url)
        } label: {
            Image(systemName: "phone.fill")
                .font(.system(size: 16))
                .foregroundColor(BinMateTheme.Colors.textPrimary)
                .frame(width: 44, height: 36)
                .background(BinMateTheme.Colors.bgRaised)
                .clipShape(RoundedRectangle(cornerRadius: BinMateTheme.Radius.md))
        }
        .accessibilityLabel("Call \(site.name)")
    }

    private var websiteButton: some View {
        Button {
            guard let url = site.websiteURL else { return }
            openURL(url)
        } label: {
            Image(systemName: BinMateTheme.Symbols.externalLink)
                .font(.system(size: 16))
                .foregroundColor(BinMateTheme.Colors.textPrimary)
                .frame(width: 44, height: 36)
                .background(BinMateTheme.Colors.bgRaised)
                .clipShape(RoundedRectangle(cornerRadius: BinMateTheme.Radius.md))
        }
        .accessibilityLabel("Visit \(site.name) website")
    }

    // MARK: - Hours

    private var hoursSection: some View {
        VStack(alignment: .leading, spacing: BinMateTheme.Spacing.sm) {
            Text("OPENING HOURS")
                .font(BinMateTheme.Typography.label)
                .foregroundColor(BinMateTheme.Colors.textMuted)
                .kerning(1.5)

            VStack(spacing: 1) {
                ForEach(site.operatingHours, id: \.days) { row in
                    HStack {
                        Text(row.days)
                            .font(BinMateTheme.Typography.body)
                            .foregroundColor(BinMateTheme.Colors.textPrimary)
                        Spacer()
                        Text(row.hours ?? "Closed")
                            .font(BinMateTheme.Typography.data)
                            .foregroundColor(
                                row.hours != nil
                                    ? BinMateTheme.Colors.textSecondary
                                    : BinMateTheme.Colors.red
                            )
                    }
                    .padding(.vertical, BinMateTheme.Spacing.sm)
                    .padding(.horizontal, BinMateTheme.Spacing.md)
                    .background(BinMateTheme.Colors.bgRaised)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: BinMateTheme.Radius.lg))

            if let note = site.closedNote {
                Text(note)
                    .font(BinMateTheme.Typography.caption)
                    .foregroundColor(BinMateTheme.Colors.textMuted)
            }
        }
    }

    // MARK: - Accepted types

    private var acceptedSection: some View {
        VStack(alignment: .leading, spacing: BinMateTheme.Spacing.sm) {
            Text("ACCEPTED WASTE")
                .font(BinMateTheme.Typography.label)
                .foregroundColor(BinMateTheme.Colors.textMuted)
                .kerning(1.5)

            FlowLayout(spacing: BinMateTheme.Spacing.xs) {
                ForEach(site.accepted, id: \.self) { waste in
                    Text(waste.rawValue)
                        .font(BinMateTheme.Typography.label)
                        .foregroundColor(BinMateTheme.Colors.lime)
                        .padding(.horizontal, BinMateTheme.Spacing.sm)
                        .padding(.vertical, 4)
                        .background(BinMateTheme.Colors.limeFaint)
                        .overlay(
                            RoundedRectangle(cornerRadius: BinMateTheme.Radius.sm)
                                .stroke(BinMateTheme.Colors.limeBorder, lineWidth: 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: BinMateTheme.Radius.sm))
                }
            }
        }
    }

    // MARK: - Helpers

    private var distanceLabel: String? {
        userLocation.map { site.distanceString(from: $0) }
    }

    private func openDirections() {
        let placemark = MKPlacemark(coordinate: site.coordinate)
        let mapItem = MKMapItem(placemark: placemark)
        mapItem.name = site.name
        mapItem.openInMaps(launchOptions: [
            MKLaunchOptionsDirectionsModeKey: MKLaunchOptionsDirectionsModeDriving
        ])
    }
}

// MARK: - FlowLayout (wrapping tag cloud)

/// Simple left-to-right wrapping layout for tag pills.
private struct FlowLayout: Layout {

    let spacing: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let rows = computeRows(proposal: proposal, subviews: subviews)
        let height = rows.map { $0.map { $0.height }.max() ?? 0 }.reduce(0) { $0 + $1 + spacing } - spacing
        return CGSize(width: proposal.width ?? 0, height: max(height, 0))
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let rows = computeRows(proposal: proposal, subviews: subviews)
        var y = bounds.minY
        for row in rows {
            var x = bounds.minX
            let rowHeight = row.map(\.height).max() ?? 0
            for item in row {
                item.place(at: CGPoint(x: x, y: y), proposal: .unspecified)
                x += item.width + spacing
            }
            y += rowHeight + spacing
        }
    }

    private struct ItemSize {
        let subview: LayoutSubview
        let width: CGFloat
        let height: CGFloat
        func place(at point: CGPoint, proposal: ProposedViewSize) {
            subview.place(at: point, proposal: proposal)
        }
    }

    private func computeRows(proposal: ProposedViewSize, subviews: Subviews) -> [[ItemSize]] {
        let maxWidth = proposal.width ?? .infinity
        var rows: [[ItemSize]] = [[]]
        var rowWidth: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            let item = ItemSize(subview: subview, width: size.width, height: size.height)
            if rowWidth + size.width > maxWidth, !rows[rows.endIndex - 1].isEmpty {
                rows.append([item])
                rowWidth = size.width + spacing
            } else {
                rows[rows.endIndex - 1].append(item)
                rowWidth += size.width + spacing
            }
        }
        return rows
    }
}
