import WidgetKit
import SwiftUI

@main
struct BinMateWidgetBundle: WidgetBundle {
    var body: some Widget {
        BinMateWidget()
        if #available(iOSApplicationExtension 16.1, *) {
            BinMateLiveActivity()
        }
    }
}

/// BinMateWidget — shows the next bin collection day in small and medium sizes.
struct BinMateWidget: Widget {

    static let kind = "BinMateWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: Self.kind, provider: BinMateWidgetProvider()) { entry in
            BinMateWidgetEntryView(entry: entry)
                .modifier(WidgetBackgroundModifier(color: WidgetColors.bgBase))
        }
        .configurationDisplayName("BinMate")
        .description("See your next bin collection day.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// MARK: - Background modifier (iOS 16 / 17 compat)

struct WidgetBackgroundModifier: ViewModifier {
    let color: Color
    func body(content: Content) -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            content.containerBackground(color, for: .widget)
        } else {
            content
                .background(color)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}
