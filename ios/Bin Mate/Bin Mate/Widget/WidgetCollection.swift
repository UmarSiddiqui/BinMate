import Foundation

/// Lightweight, Codable representation of a single collection event.
/// Shared between the main BinMate app and the BinMateWidget extension
/// via the App Group UserDefaults container.
struct WidgetCollection: Codable {
    /// ISO 8601 date string, e.g. "2026-03-20".
    let date: String
    /// Display day name, e.g. "Friday".
    let dayOfWeek: String
    /// Bin type raw values: "general" | "recycling" | "green_waste" | "fogo".
    let types: [String]
    /// True when this is a verge collection rather than a kerbside collection.
    let isVerge: Bool
}
