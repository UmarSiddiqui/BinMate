import ActivityKit
import Foundation

/// ActivityKit payload for the next kerbside bin collection.
@available(iOS 16.1, *)
struct BinMateActivityAttributes: ActivityAttributes {

    /// Dynamic state rendered on the Lock Screen and Dynamic Island.
    struct ContentState: Codable, Hashable {
        /// Short headline, e.g. "Bins out tonight".
        let title: String
        /// Supporting text, e.g. "Friday 10 July".
        let subtitle: String
        /// ISO 8601 collection date.
        let collectionDate: String
        /// Raw bin type values: "general", "recycling", "green_waste", "fogo".
        let binTypes: [String]
        /// User-facing suburb label only; never contains a street address.
        let suburb: String
    }

    /// Stable key for the user's primary zone.
    let zoneId: String
}
