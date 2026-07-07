import SwiftUI

/// Reference guide — what goes in each Perth bin lid.
/// Present this view inside a NavigationStack (e.g. as a sheet from SettingsView).
struct BinGuideView: View {

    @State private var selectedLid: BinLid = .red
    @State private var searchText = ""
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var searchResults: [BinSearchResult] {
        guard !searchText.isEmpty else { return [] }
        let q = searchText.lowercased()
        return BinGuideData.searchIndex
            .filter { $0.item.lowercased().contains(q) }
            .sorted { $0.item < $1.item }
    }

    var body: some View {
        VStack(spacing: 0) {
            searchBar
            if searchText.isEmpty {
                hero
                lidSelector
                Divider().background(BinMateTheme.Colors.borderSubtle)
                binContentList
            } else {
                searchResultsList
            }
        }
        .navigationTitle("Bin Guide")
        .navigationBarTitleDisplayMode(.inline)
        .background(BinMateTheme.Colors.bgBase)
    }

    // MARK: - Hero

    private var hero: some View {
        Image("BinGuideHero")
            .resizable()
            .scaledToFill()
            .frame(maxWidth: .infinity)
            .frame(height: 180)
            .clipped()
            .overlay(
                LinearGradient(
                    colors: [.clear, BinMateTheme.Colors.bgBase],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
            .accessibilityHidden(true)
    }

    // MARK: - Search bar

    private var searchBar: some View {
        HStack(spacing: BinMateTheme.Spacing.sm) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(BinMateTheme.Colors.textMuted)
                .accessibilityHidden(true)
            TextField("What goes where?", text: $searchText)
                .font(BinMateTheme.Typography.body)
                .foregroundStyle(BinMateTheme.Colors.textPrimary)
                .autocorrectionDisabled()
            if !searchText.isEmpty {
                Button {
                    searchText = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(BinMateTheme.Colors.textMuted)
                }
                .accessibilityLabel("Clear search")
            }
        }
        .padding(BinMateTheme.Spacing.sm + BinMateTheme.Spacing.xs) // 12pt
        .background(BinMateTheme.Colors.bgSurface)
        .clipShape(RoundedRectangle(cornerRadius: BinMateTheme.Radius.md))
        .padding(.horizontal, BinMateTheme.Spacing.md)
        .padding(.vertical, BinMateTheme.Spacing.sm)
    }

    // MARK: - Lid selector

    private var lidSelector: some View {
        HStack(spacing: BinMateTheme.Spacing.sm) {
            ForEach(BinLid.allCases) { lid in
                lidTab(lid)
            }
        }
        .padding(.horizontal, BinMateTheme.Spacing.md)
        .padding(.bottom, BinMateTheme.Spacing.sm)
    }

    private func lidTab(_ lid: BinLid) -> some View {
        let isSelected = lid == selectedLid
        return Button {
            if reduceMotion {
                selectedLid = lid
            } else {
                withAnimation(BinMateTheme.Animation.default) { selectedLid = lid }
            }
        } label: {
            VStack(spacing: BinMateTheme.Spacing.xs) {
                ZStack {
                    Circle()
                        .fill(lid.color)
                        .frame(width: 32, height: 32)
                    if isSelected {
                        Circle()
                            .strokeBorder(Color.white.opacity(0.35), lineWidth: 2)
                            .frame(width: 32, height: 32)
                    }
                }
                .shadow(color: isSelected ? lid.color.opacity(0.5) : .clear, radius: 8)
                Text(lid.subtitle)
                    .font(BinMateTheme.Typography.bodySmall)
                    .foregroundStyle(
                        isSelected ? BinMateTheme.Colors.textPrimary : BinMateTheme.Colors.textMuted
                    )
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, BinMateTheme.Spacing.sm)
            .background(isSelected ? BinMateTheme.Colors.bgRaised : Color.clear)
            .clipShape(RoundedRectangle(cornerRadius: BinMateTheme.Radius.md))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(lid.displayName), \(lid.subtitle)\(isSelected ? ", selected" : "")")
    }

    // MARK: - Bin content list

    private var binContentList: some View {
        let content = BinGuideData.all.first { $0.lid == selectedLid } ?? BinGuideData.redLid
        return List {
            Section {
                ForEach(content.accepted, id: \.self) { item in
                    itemRow(item, accepted: true)
                }
            } header: {
                Label("Goes in", systemImage: "checkmark.circle.fill")
                    .foregroundStyle(BinMateTheme.Colors.lime)
            }
            Section {
                ForEach(content.rejected, id: \.self) { item in
                    itemRow(item, accepted: false)
                }
            } header: {
                Label("Not in this bin", systemImage: "xmark.circle.fill")
                    .foregroundStyle(BinMateTheme.Colors.red)
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
    }

    private func itemRow(_ text: String, accepted: Bool) -> some View {
        HStack(spacing: BinMateTheme.Spacing.sm) {
            itemIcon(for: text, accepted: accepted)
            Text(text)
                .font(BinMateTheme.Typography.body)
                .foregroundStyle(BinMateTheme.Colors.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.vertical, BinMateTheme.Spacing.xs)
        .accessibilityLabel("\(text), \(accepted ? "accepted" : "not accepted")")
    }

    @ViewBuilder
    private func itemIcon(for text: String, accepted: Bool) -> some View {
        let lower = text.lowercased()
        let assetName = Self.iconAssetName(for: lower)
        if let name = assetName {
            Image(name)
                .resizable()
                .scaledToFill()
                .frame(width: 28, height: 28)
                .clipShape(RoundedRectangle(cornerRadius: 6))
                .accessibilityHidden(true)
        } else {
            Image(systemName: accepted ? "checkmark" : "xmark")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(accepted ? BinMateTheme.Colors.lime : BinMateTheme.Colors.red)
                .frame(width: 28, height: 28)
                .accessibilityHidden(true)
        }
    }

    private static func iconAssetName(for lower: String) -> String? {
        let map: [(keywords: [String], asset: String)] = [
            (["batter"],                              "bin_icon_batteries"),
            (["food scrap", "food waste", "fruit and veg", "meat", "dairy", "bread", "cereal"], "bin_icon_food_scraps"),
            (["cardboard", "newspaper", "magazine", "paper", "junk mail", "pizza box", "egg carton", "carton", "recyclable"], "bin_icon_cardboard"),
            (["glass bottle", "glass jar", "broken glass"], "bin_icon_glass"),
            (["rigid plastic", "plastic container", "plastic tub", "plastic bottle", "non-recyclable plastic", "packaging"], "bin_icon_plastic"),
            (["soft plastic", "plastic bag", "cling", "greasy", "contaminated"], "bin_icon_soft_plastics"),
            (["steel", "aluminium", "aerosol", "tin can", "bottle cap", "foil tray", "metal item", "metal can"], "bin_icon_cans"),
            (["electronic", "e-waste", "ewaste", "circuit"],  "bin_icon_electronics"),
            (["grass", "leaves", "leaf", "branch", "flower", "plant", "bark", "garden", "weed", "palm"], "bin_icon_garden"),
            (["chemical", "paint", "oil", "liquid", "solvent"], "bin_icon_chemicals"),
            (["napp", "hygiene", "sanitary", "sharps", "cotton pad", "vacuum cleaner"], "bin_icon_nappies"),
            (["coffee", "tea bag", "egg shell"],               "bin_icon_coffee"),
            (["polystyrene", "styrofoam", "foam"],             "bin_icon_polystyrene"),
            (["pet waste", "kitty litter", "cat litter", "dog waste", "paw"], "bin_icon_pet_waste"),
            (["clothing", "textile", "fabric", "t-shirt", "shirt", "sock"], "bin_icon_clothing"),
            (["tyre", "tire", "rubber item"],                  "bin_icon_tyres"),
            (["straw", "cutlery", "fork", "spoon", "knife"],   "bin_icon_straws"),
            (["ceramic", "crockery", "porcelain", "plate", "cup"],  "bin_icon_ceramics"),
            (["gas cylinder", "gas bottle", "cylinder"],       "bin_icon_gas"),
        ]
        return map.first { pair in pair.keywords.contains { lower.contains($0) } }?.asset
    }

    // MARK: - Search results

    private var searchResultsList: some View {
        Group {
            if searchResults.isEmpty {
                emptySearchState
            } else {
                List(searchResults) { result in
                    searchResultRow(result)
                }
                .listStyle(.insetGrouped)
                .scrollContentBackground(.hidden)
            }
        }
    }

    private var emptySearchState: some View {
        VStack(spacing: BinMateTheme.Spacing.md) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 36))
                .foregroundStyle(BinMateTheme.Colors.textMuted)
                .accessibilityHidden(true)
            Text("Nothing found for \"\(searchText)\"")
                .font(BinMateTheme.Typography.body)
                .foregroundStyle(BinMateTheme.Colors.textMuted)
            Text("Try a different word, or check your council's website.")
                .font(BinMateTheme.Typography.bodySmall)
                .foregroundStyle(BinMateTheme.Colors.textMuted)
                .multilineTextAlignment(.center)
        }
        .padding(BinMateTheme.Spacing.xl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func searchResultRow(_ result: BinSearchResult) -> some View {
        HStack(spacing: BinMateTheme.Spacing.md) {
            Circle()
                .fill(result.lid.color)
                .frame(width: 14, height: 14)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(result.item)
                    .font(BinMateTheme.Typography.body)
                    .foregroundStyle(BinMateTheme.Colors.textPrimary)
                Text("Goes in \(result.lid.displayName)")
                    .font(BinMateTheme.Typography.bodySmall)
                    .foregroundStyle(BinMateTheme.Colors.textSecondary)
            }
        }
        .padding(.vertical, BinMateTheme.Spacing.xs)
        .accessibilityLabel("\(result.item) — goes in the \(result.lid.displayName)")
    }
}
