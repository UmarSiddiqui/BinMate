import SwiftUI

// MARK: - Bin lid type

/// Represents a Perth bin lid type — maps directly to physical bin lid colours.
enum BinLid: String, CaseIterable, Identifiable {
    case red    = "red"
    case yellow = "yellow"
    case green  = "green"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .red:    return "Red lid"
        case .yellow: return "Yellow lid"
        case .green:  return "Lime green lid"
        }
    }

    var subtitle: String {
        switch self {
        case .red:    return "General waste"
        case .yellow: return "Recycling"
        case .green:  return "Garden organics"
        }
    }

    /// Exact bin lid colour — from BinMateTheme, matching Perth physical lids.
    var color: Color {
        switch self {
        case .red:    return BinMateTheme.Colors.binRed
        case .yellow: return BinMateTheme.Colors.binYellow
        case .green:  return BinMateTheme.Colors.binGreen
        }
    }

    var sfSymbol: String {
        switch self {
        case .red:    return BinMateTheme.Symbols.bins
        case .yellow: return BinMateTheme.Symbols.recycling
        case .green:  return BinMateTheme.Symbols.garden
        }
    }
}

// MARK: - Data models

/// Content for a single bin lid — accepted and rejected items.
struct BinLidContent {
    let lid: BinLid
    let accepted: [String]
    let rejected: [String]
}

/// Flat accepted item used for A–Z search results.
struct BinSearchResult: Identifiable {
    let id = UUID()
    let item: String
    let lid: BinLid
}

// MARK: - Perth standard guide data

/// Perth standard bin guide content.
/// Source: WA Waste Authority guidelines and the majority of Perth council rules.
/// Individual council rules may vary — always check your specific council.
enum BinGuideData {

    static let all: [BinLidContent] = [redLid, yellowLid, greenLid]

    static let redLid = BinLidContent(
        lid: .red,
        accepted: [
            "Food scraps (if no green lid service)",
            "Contaminated or greasy packaging",
            "Polystyrene foam",
            "Nappies and hygiene items",
            "Broken ceramics and crockery",
            "Soft plastics (wrapped in a bag)",
            "Pet waste and kitty litter",
            "Vacuum cleaner bags",
            "Broken glass (wrapped in newspaper)",
            "Non-recyclable plastic packaging",
            "Waxed cardboard",
            "Small rubber items",
        ],
        rejected: [
            "Recyclables — use yellow lid",
            "Garden waste — use green lid (if available)",
            "Batteries — hardware store drop-off",
            "Chemicals and paint — hazardous waste event",
            "Electronics (e-waste) — council drop-off",
            "Tyres",
            "Gas cylinders",
            "Liquids and oils",
            "Medical sharps",
        ]
    )

    static let yellowLid = BinLidContent(
        lid: .yellow,
        accepted: [
            "Cardboard boxes (flat and dry)",
            "Newspapers and magazines",
            "Paper and junk mail",
            "Glass bottles and jars (rinsed)",
            "Rigid plastic containers 1–7 (rinsed)",
            "Milk and juice cartons",
            "Steel and aluminium cans",
            "Aluminium foil trays (rinsed)",
            "Aerosol cans (empty)",
            "Pizza boxes (clean and dry)",
            "Egg cartons (cardboard only)",
            "Bottle caps and tin lids",
        ],
        rejected: [
            "Soft plastics and plastic bags",
            "Food waste — use red or green lid",
            "Polystyrene foam",
            "Nappies and sanitary items",
            "Clothing and textiles",
            "Broken glass",
            "Batteries",
            "Electronics",
            "Greasy or food-soiled paper",
            "Takeaway coffee cups",
            "Straws and cutlery",
        ]
    )

    static let greenLid = BinLidContent(
        lid: .green,
        accepted: [
            "Grass clippings",
            "Leaves and bark",
            "Small branches (under 100mm diameter)",
            "Flowers and plants",
            "Fruit and vegetable scraps",
            "Coffee grounds and paper filters",
            "Tea bags (paper only, not plastic mesh)",
            "Egg shells",
            "Bread and cereals (FOGO councils)",
            "Meat and fish scraps (FOGO councils)",
            "Dairy items (FOGO councils)",
            "Food-soiled paper and cardboard (FOGO councils)",
        ],
        rejected: [
            "Plastic bags (including 'compostable')",
            "Soil and rocks",
            "Treated or painted timber",
            "Weeds with seeds or bulbs",
            "Pet waste or kitty litter",
            "Palm fronds",
            "Metal items",
            "Liquids",
            "Nappies",
        ]
    )

    /// Flat accepted-items list used for A–Z search — only items with a clear bin destination.
    static let searchIndex: [BinSearchResult] = all.flatMap { content in
        content.accepted.map { BinSearchResult(item: $0, lid: content.lid) }
    }
}
