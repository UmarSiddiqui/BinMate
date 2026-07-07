import ActivityKit
import SwiftUI
import WidgetKit

/// Lock Screen and Dynamic Island presentation for the next collection.
@available(iOSApplicationExtension 16.1, *)
struct BinMateLiveActivity: Widget {

    var body: some WidgetConfiguration {
        ActivityConfiguration(for: BinMateActivityAttributes.self) { context in
            BinMateLockScreenActivityView(state: context.state)
                .activityBackgroundTint(WidgetColors.bgBase)
                .activitySystemActionForegroundColor(WidgetColors.lime)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    BinMateActivityBinDots(types: context.state.binTypes, size: 9)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(dateLabel(context.state.collectionDate))
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(WidgetColors.lime)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(context.state.title)
                            .font(.headline)
                            .foregroundStyle(WidgetColors.textPrimary)
                            .lineLimit(1)
                        Text(context.state.subtitle)
                            .font(.caption)
                            .foregroundStyle(WidgetColors.textSecondary)
                            .lineLimit(1)
                    }
                }
            } compactLeading: {
                Image(systemName: "trash")
                    .foregroundStyle(WidgetColors.lime)
            } compactTrailing: {
                BinMateActivityBinDots(types: context.state.binTypes, size: 6)
            } minimal: {
                Image(systemName: "trash")
                    .foregroundStyle(WidgetColors.lime)
            }
        }
    }
}

@available(iOSApplicationExtension 16.1, *)
private struct BinMateLockScreenActivityView: View {

    let state: BinMateActivityAttributes.ContentState

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(state.title)
                    .font(.headline)
                    .foregroundStyle(WidgetColors.textPrimary)
                    .lineLimit(1)
                Text(state.subtitle)
                    .font(.subheadline)
                    .foregroundStyle(WidgetColors.textSecondary)
                    .lineLimit(1)
                if !state.suburb.isEmpty {
                    Text(state.suburb.uppercased())
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(WidgetColors.textMuted)
                        .lineLimit(1)
                }
            }

            Spacer(minLength: 0)
            BinMateActivityBinDots(types: state.binTypes, size: 12)
        }
        .padding()
    }
}

private struct BinMateActivityBinDots: View {

    let types: [String]
    let size: CGFloat

    var body: some View {
        HStack(spacing: 4) {
            ForEach(Array(types.prefix(3)), id: \.self) { type in
                Circle()
                    .fill(dotColor(type))
                    .frame(width: size, height: size)
            }
        }
    }
}
