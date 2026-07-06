import Combine
import Foundation
import OSLog

/// Maps council names to their verge/bulk collection request or info page.
private let councilVergeURLs: [String: String] = [
    "City of Armadale":     "https://www.armadale.wa.gov.au/bins-waste",
    "City of Bayswater":    "https://www.bayswater.wa.gov.au/residents/waste-and-recycling",
    "City of Belmont":      "https://www.belmont.wa.gov.au/services/waste-and-recycling",
    "City of Canning":      "https://www.canning.wa.gov.au/your-community/waste-and-recycling",
    "City of Cockburn":     "https://www.cockburn.wa.gov.au/residents/waste-and-recycling",
    "City of Fremantle":    "https://www.fremantle.wa.gov.au/residents/waste",
    "City of Gosnells":     "https://www.gosnells.wa.gov.au/Residents/Bins_and_waste",
    "City of Joondalup":    "https://www.joondalup.wa.gov.au/residents/rubbish-and-recycling",
    "City of Kalamunda":    "https://www.kalamunda.wa.gov.au/residents/bins-waste",
    "City of Kwinana":      "https://www.kwinana.wa.gov.au/residents/sustainability-and-waste",
    "City of Melville":     "https://www.melville.wa.gov.au/council/waste-and-recycling",
    "City of Mundaring":    "https://www.mundaring.wa.gov.au/Residents/Recycling-and-waste",
    "City of Nedlands":     "https://www.nedlands.wa.gov.au/our-services/waste-and-recycling",
    "City of Perth":        "https://www.perth.wa.gov.au/bins-and-waste/kerbside-bin-services/verge-collection",
    "City of Rockingham":   "https://www.rockingham.wa.gov.au/residents/waste-and-recycling",
    "City of South Perth":  "https://www.southperth.wa.gov.au/residents/rubbish-and-recycling",
    "City of Stirling":     "https://www.stirling.wa.gov.au/residents/waste-and-recycling/verge-collection",
    "City of Subiaco":      "https://www.subiaco.wa.gov.au/residents/waste-and-recycling",
    "City of Swan":         "https://www.swan.wa.gov.au/residents/waste-recycling/verge-collection",
    "City of Vincent":      "https://www.vincent.wa.gov.au/residents/waste-and-recycling",
    "City of Wanneroo":     "https://www.wanneroo.wa.gov.au/rubbish",
    "Town of Cambridge":    "https://www.cambridge.wa.gov.au/residents/waste-and-recycling",
    "Town of Claremont":    "https://www.claremont.wa.gov.au/residents/waste-recycling",
    "Town of Cottesloe":    "https://www.cottesloe.wa.gov.au/residents/rubbish",
    "Town of Victoria Park": "https://www.victoriapark.wa.gov.au/waste-recycling",
    "Shire of Kalamunda":   "https://www.kalamunda.wa.gov.au/residents/bins-waste",
    "Shire of Mundaring":   "https://www.mundaring.wa.gov.au/Residents/Recycling-and-waste",
]

/// Drives BulkCollectionView — exposes verge schedule and council request URL.
@MainActor
final class BulkCollectionViewModel: ObservableObject {

    let councilName: String
    let vergeCollections: [Collection]

    init(councilName: String, vergeCollections: [Collection]) {
        self.councilName = councilName
        self.vergeCollections = vergeCollections
    }

    /// First upcoming verge collection, if any are scheduled.
    var nextVerge: Collection? { vergeCollections.first }

    /// True when the council provides no scheduled dates (on-demand model).
    var isOnDemand: Bool { vergeCollections.isEmpty }

    /// All future verge collections beyond the next one.
    var futureVerge: [Collection] { Array(vergeCollections.dropFirst()) }

    /// Formatted display label for the next verge date, or "On demand".
    var nextDateLabel: String {
        guard let next = nextVerge,
              let date = dateParser.date(from: next.date) else { return "On demand" }
        return dateDisplay.string(from: date)
    }

    /// Council's verge request or info page, if known.
    var requestURL: URL? {
        guard let raw = councilVergeURLs[councilName] else { return nil }
        return URL(string: raw)
    }

    // MARK: - Private

    private let dateParser: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    private let dateDisplay: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "EEEE d MMMM yyyy"
        return f
    }()
}
