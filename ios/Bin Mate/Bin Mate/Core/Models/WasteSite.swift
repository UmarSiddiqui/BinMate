import CoreLocation
import Foundation

/// Category of a waste drop-off facility.
enum SiteType: String {
    case transferStation = "Transfer Station"
    case recyclingCentre = "Recycling Centre"
    case eWasteDrop      = "E-Waste Drop-off"
    case greenWasteDrop  = "Green Waste Drop-off"
}

/// Material category accepted at a site.
enum AcceptedWaste: String, Hashable, CaseIterable {
    case general    = "General"
    case recycling  = "Recycling"
    case greenWaste = "Green Waste"
    case eWaste     = "E-Waste"
    case hazardous  = "Hazardous"
    case tyres      = "Tyres"
    case metal      = "Metal"
    case batteries  = "Batteries"
    case furniture  = "Furniture"
    case asbestos   = "Asbestos"
    case oil        = "Motor Oil"
}

/// Opening hours for a group of days.
struct OperatingHours {
    /// Day range label, e.g. "Mon – Fri" or "Sunday".
    let days: String
    /// Time range, e.g. "8:00 am – 4:00 pm". nil means Closed.
    let hours: String?
}

/// A physical waste transfer station or recycling centre in the Perth metro area.
struct WasteSite: Identifiable {
    let id: String
    let name: String
    /// Managing authority, e.g. "City of Cockburn", "WMRC".
    let operator_: String
    let address: String
    let coordinate: CLLocationCoordinate2D
    let siteType: SiteType
    let accepted: [AcceptedWaste]
    let operatingHours: [OperatingHours]
    /// Public holiday / seasonal closure note.
    let closedNote: String?
    /// Access restriction, e.g. "City of Wanneroo residents only".
    let accessNote: String?
    let phone: String?
    let websiteURL: URL?

    /// Straight-line distance in metres from the given origin.
    func distance(from origin: CLLocation) -> CLLocationDistance {
        CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)
            .distance(from: origin)
    }

    /// Human-readable distance string, e.g. "3.4 km" or "850 m".
    func distanceString(from origin: CLLocation) -> String {
        let metres = distance(from: origin)
        if metres < 1_000 { return "\(Int(metres)) m" }
        return String(format: "%.1f km", metres / 1_000)
    }
}

// MARK: - Static Perth metropolitan facility data

extension WasteSite {

    /// All Perth metro waste facilities. Coordinates are approximate.
    /// Source: Individual council and regional body websites (verified March 2026).
    static let perthSites: [WasteSite] = [

        // MARK: Inner / West

        WasteSite(
            id: "wmrc-shenton",
            name: "West Metro Recycling Centre",
            operator_: "Western Metropolitan Regional Council (WMRC)",
            address: "60 Lemnos Street (enter via Brockway Road), Shenton Park WA 6008",
            coordinate: CLLocationCoordinate2D(latitude: -31.957, longitude: 115.793),
            siteType: .transferStation,
            accepted: [.general, .recycling, .greenWaste, .eWaste, .hazardous, .tyres, .metal, .batteries, .asbestos],
            operatingHours: [
                OperatingHours(days: "Mon – Fri",        hours: "7:30 am – 4:00 pm"),
                OperatingHours(days: "Sat – Sun",        hours: "8:00 am – 4:00 pm"),
                OperatingHours(days: "Public Holidays",  hours: "7:30 am – 2:00 pm"),
            ],
            closedNote: "Closed Good Friday, Christmas Day, New Year's Day. Last entry 10 min before closing.",
            accessNote: nil,
            phone: "(08) 9384 6711",
            websiteURL: URL(string: "https://www.wmrc.wa.gov.au/recycling-disposal/west-metro-recycling-centre/")
        ),

        WasteSite(
            id: "fremantle-recycling",
            name: "Fremantle Recycling Centre",
            operator_: "City of Fremantle",
            address: "19A Montreal Street, Fremantle WA 6160",
            coordinate: CLLocationCoordinate2D(latitude: -32.057, longitude: 115.748),
            siteType: .recyclingCentre,
            accepted: [.recycling, .greenWaste, .eWaste, .hazardous, .tyres, .metal, .batteries, .furniture],
            operatingHours: [
                OperatingHours(days: "Friday",    hours: "12:00 pm – 4:00 pm"),
                OperatingHours(days: "Sat – Sun", hours: "8:00 am – 4:00 pm"),
                OperatingHours(days: "Mon – Thu", hours: nil),
            ],
            closedNote: "Closed Mon – Thu and Public Holidays.",
            accessNote: nil,
            phone: "(08) 9432 9999",
            websiteURL: URL(string: "https://www.fremantle.wa.gov.au/waste-and-environment/fremantle-recycling-centre/")
        ),

        WasteSite(
            id: "southperth-como",
            name: "South Perth Recycling Centre",
            operator_: "City of South Perth",
            address: "199 Thelma Street (cnr Hayman Road), Como WA 6152",
            coordinate: CLLocationCoordinate2D(latitude: -31.992, longitude: 115.861),
            siteType: .recyclingCentre,
            accepted: [.recycling, .greenWaste, .eWaste, .metal, .oil],
            operatingHours: [
                OperatingHours(days: "Wed – Sun",  hours: "8:00 am – 2:00 pm"),
                OperatingHours(days: "Mon – Tue",  hours: nil),
            ],
            closedNote: "Closed Mon, Tue, and Public Holidays. Last entry 1:45 pm weekends.",
            accessNote: "City of South Perth ratepayer vouchers required (6 entries per year via rates notice).",
            phone: "(08) 9474 0777",
            websiteURL: URL(string: "https://southperth.wa.gov.au/community/facilities/recycling-centre")
        ),

        // MARK: North

        WasteSite(
            id: "mrc-tamala",
            name: "Tamala Park Regional Facility",
            operator_: "Mindarie Regional Council (MRC)",
            address: "1700 Marmion Avenue, Tamala Park WA 6030",
            coordinate: CLLocationCoordinate2D(latitude: -31.707, longitude: 115.722),
            siteType: .transferStation,
            accepted: [.general, .recycling, .greenWaste, .eWaste, .hazardous, .metal, .batteries],
            operatingHours: [
                OperatingHours(days: "Mon – Sun", hours: "8:00 am – 4:45 pm"),
            ],
            closedNote: "Closed Christmas Day, New Year's Day, Good Friday.",
            accessNote: nil,
            phone: "(08) 9306 6303",
            websiteURL: URL(string: "https://www.mrc.wa.gov.au/tamala-park/disposal/plan-your-visit.aspx")
        ),

        WasteSite(
            id: "wanneroo-wangara",
            name: "Wangara Recycling Facility",
            operator_: "City of Wanneroo",
            address: "70 Motivation Drive, Wangara WA 6065",
            coordinate: CLLocationCoordinate2D(latitude: -31.789, longitude: 115.827),
            siteType: .recyclingCentre,
            accepted: [.recycling, .greenWaste, .eWaste, .metal, .batteries, .oil],
            operatingHours: [
                OperatingHours(days: "Weekdays",          hours: nil),
                OperatingHours(days: "Sat – Sun & PH",   hours: "8:00 am – 4:45 pm"),
            ],
            closedNote: "Closed weekdays, Good Friday, Christmas Day, New Year's Day.",
            accessNote: "City of Wanneroo residents only. 4 free green waste trailer loads per year via rates voucher.",
            phone: "(08) 9405 5000",
            websiteURL: URL(string: "https://www.wanneroo.wa.gov.au/wastefacilities")
        ),

        WasteSite(
            id: "stirling-balcatta",
            name: "Balcatta Recycling Centre",
            operator_: "City of Stirling",
            address: "238 Balcatta Road, Balcatta WA 6021",
            coordinate: CLLocationCoordinate2D(latitude: -31.848, longitude: 115.820),
            siteType: .recyclingCentre,
            accepted: [.general, .recycling, .hazardous, .tyres, .batteries],
            operatingHours: [
                OperatingHours(days: "Mon – Sat", hours: "7:30 am – 4:00 pm"),
                OperatingHours(days: "Sunday",    hours: "8:00 am – 4:00 pm"),
            ],
            closedNote: "Closed Christmas Day, New Year's Day, Good Friday.",
            accessNote: nil,
            phone: "(08) 9205 8555",
            websiteURL: URL(string: "https://www.stirling.wa.gov.au/waste-and-environment/waste-and-recycling/recycling-and-hazardous-waste-disposal")
        ),

        // MARK: East

        WasteSite(
            id: "emrc-baywaste",
            name: "Baywaste Transfer Station",
            operator_: "EMRC on behalf of City of Bayswater",
            address: "271 Collier Road (cnr Tonkin Highway), Bayswater WA 6053",
            coordinate: CLLocationCoordinate2D(latitude: -31.913, longitude: 115.930),
            siteType: .transferStation,
            accepted: [.general, .eWaste, .tyres, .batteries, .recycling],
            operatingHours: [
                OperatingHours(days: "Mon – Fri", hours: "7:30 am – 4:00 pm"),
                OperatingHours(days: "Sat – Sun", hours: "10:00 am – 4:00 pm"),
            ],
            closedNote: "Closed Good Friday, Christmas Day, New Year's Day.",
            accessNote: "City of Bayswater and Town of Bassendean residents only. Tip pass required.",
            phone: "1800 855 955",
            websiteURL: URL(string: "https://www.bayswater.wa.gov.au/baywaste")
        ),

        WasteSite(
            id: "emrc-redhill",
            name: "Red Hill Waste Management Facility",
            operator_: "Eastern Metropolitan Regional Council (EMRC)",
            address: "1094 Toodyay Road, Red Hill WA 6071",
            coordinate: CLLocationCoordinate2D(latitude: -31.804, longitude: 116.185),
            siteType: .transferStation,
            accepted: [.general, .recycling, .greenWaste, .eWaste, .hazardous, .tyres, .metal, .batteries, .furniture, .asbestos],
            operatingHours: [
                OperatingHours(days: "Mon – Sat", hours: "8:00 am – 4:00 pm"),
                OperatingHours(days: "Sunday",    hours: "10:00 am – 4:00 pm"),
            ],
            closedNote: "Closed Good Friday, Christmas Day, New Year's Day.",
            accessNote: nil,
            phone: "(08) 6219 7333",
            websiteURL: URL(string: "https://www.emrc.org.au/about-us/what-we-do/our-facilities/red-hill-waste-management-facility.aspx")
        ),

        // MARK: South

        WasteSite(
            id: "cockburn-henderson",
            name: "Henderson Waste Recovery Park",
            operator_: "City of Cockburn",
            address: "920 Rockingham Road, Henderson WA 6166",
            coordinate: CLLocationCoordinate2D(latitude: -32.131, longitude: 115.773),
            siteType: .transferStation,
            accepted: [.general, .recycling, .greenWaste, .eWaste, .hazardous, .tyres, .metal, .batteries, .furniture, .asbestos],
            operatingHours: [
                OperatingHours(days: "Mon – Sun", hours: "8:00 am – 4:00 pm"),
            ],
            closedNote: "Closed Christmas Day, New Year's Day, Good Friday.",
            accessNote: nil,
            phone: "(08) 9411 3444",
            websiteURL: URL(string: "https://www.cockburn.wa.gov.au/Environment-and-Waste/Rubbish-Waste-and-Recycling/Henderson-Waste-Recovery-Park")
        ),

        WasteSite(
            id: "canning-ranford",
            name: "Ranford Road Transfer Station",
            operator_: "City of Canning",
            address: "81 Ranford Road, Canning Vale WA 6155",
            coordinate: CLLocationCoordinate2D(latitude: -32.088, longitude: 115.918),
            siteType: .transferStation,
            accepted: [.general, .recycling, .greenWaste, .eWaste, .hazardous],
            operatingHours: [
                OperatingHours(days: "Mon – Sun", hours: "8:00 am – 4:30 pm"),
            ],
            closedNote: "Closed Christmas Day, New Year's Day, Good Friday. Last entry 4:15 pm.",
            accessNote: nil,
            phone: "1300 422 664",
            websiteURL: URL(string: "https://www.canning.wa.gov.au/residents/waste-and-recycling/ranford-road-resource-recovery-and-waste-transfer-station/")
        ),

        WasteSite(
            id: "rrc-armadale",
            name: "Armadale Landfill & Recycling Facility",
            operator_: "Rivers Regional Council",
            address: "145 Hopkinson Road (enter via Gloaming Way), Hilbert WA 6112",
            coordinate: CLLocationCoordinate2D(latitude: -32.162, longitude: 115.997),
            siteType: .transferStation,
            accepted: [.general, .recycling, .greenWaste, .eWaste, .hazardous, .tyres, .metal, .batteries, .furniture],
            operatingHours: [
                OperatingHours(days: "Mon – Sun", hours: "8:00 am – 4:45 pm"),
            ],
            closedNote: "Closed New Year's Day, Good Friday, Christmas Day. Closes noon on Christmas Eve and New Year's Eve. No commercial loads after 4:00 pm.",
            accessNote: nil,
            phone: "(08) 9394 5124",
            websiteURL: URL(string: "https://www.rrc.wa.gov.au/products/Armadale-Landfill-and-Recycling-Facility")
        ),
    ]
}
