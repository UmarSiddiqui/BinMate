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
            Image(systemName: accepted ? "checkmark" : "xmark")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(accepted ? BinMateTheme.Colors.lime : BinMateTheme.Colors.red)
                .frame(width: 20)
                .accessibilityHidden(true)
            Text(text)
                .font(BinMateTheme.Typography.body)
                .foregroundStyle(BinMateTheme.Colors.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.vertical, BinMateTheme.Spacing.xs)
        .accessibilityLabel("\(text), \(accepted ? "accepted" : "not accepted")")
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
