import UIKit

/// Lightweight wrapper around UIImpactFeedbackGenerator for primary CTA haptics.
enum HapticFeedback {

    /// Medium impact — used on primary action buttons.
    static func impact(_ style: UIImpactFeedbackGenerator.FeedbackStyle = .medium) {
        let generator = UIImpactFeedbackGenerator(style: style)
        generator.impactOccurred()
    }

    /// Notification feedback — success, warning, or error outcomes.
    static func notification(_ type: UINotificationFeedbackGenerator.FeedbackType) {
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(type)
    }
}
