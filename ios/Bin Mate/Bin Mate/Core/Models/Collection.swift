import Foundation

/// A single bin collection event returned from the BinMate API.
struct Collection: Decodable, Identifiable, Hashable {

    /// ISO 8601 date string, e.g. "2026-03-19".
    let date: String

    /// Display day name, e.g. "Wednesday".
    let dayOfWeek: String

    /// Which bin types are collected on this date.
    let types: [BinType]

    /// True if this date was shifted forward due to a WA public holiday.
    let isHolidayShifted: Bool

    /// Original date before holiday shift (ISO 8601). Nil if not shifted.
    let originalDate: String?

    /// The kind of collection event.
    let eventType: EventType

    /// Stable identifier for use in SwiftUI lists.
    var id: String { "\(date)_\(eventType.rawValue)" }

    // MARK: - Nested types

    enum EventType: String, Decodable, Hashable {
        case kerbside
        case verge
        case ewaste
        case greenWasteDrop = "green_waste_drop"
    }
}

// MARK: - BinType

/// The bin colour/stream for a collection event.
enum BinType: String, Decodable, Hashable {
    case general
    case recycling
    case greenWaste = "green_waste"
    case fogo

    /// Human-readable label shown in the UI.
    var displayName: String {
        switch self {
        case .general:    return "General"
        case .recycling:  return "Recycling"
        case .greenWaste: return "Green Waste"
        case .fogo:       return "FOGO"
        }
    }

    /// Asset catalog icon name for this bin type.
    var iconAssetName: String {
        switch self {
        case .general:    return "BinGeneralIcon"
        case .recycling:  return "BinRecyclingIcon"
        case .greenWaste: return "BinGreenWasteIcon"
        case .fogo:       return "BinFogoIcon"
        }
    }
}
