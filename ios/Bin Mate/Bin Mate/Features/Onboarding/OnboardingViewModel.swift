import Combine
import MapKit
import OSLog
import SwiftUI

// MARK: - ViewModel

/// Drives all three onboarding steps. Views observe published state and call
/// the action methods — they never access AppState directly.
@MainActor
final class OnboardingViewModel: ObservableObject {

    // MARK: - Step

    enum Step { case address, confirm, notifications }

    // MARK: - Published state

    @Published var step: Step = .address

    /// Text in the address search field. Drives MKLocalSearchCompleter.
    @Published var addressInput: String = "" {
        didSet { refreshCompleter() }
    }

    @Published var suggestions: [MKLocalSearchCompletion] = []
    @Published var resolvedResponse: RegisterAddressResponse?
    @Published var resolvedSuburb: String = ""
    @Published var isLoading = false
    @Published var error: BinMateError?

    /// Flips to true when the user completes Step 3.
    /// `OnboardingView` observes this and calls `AppState.completeOnboarding`.
    @Published var isComplete = false

    /// Prevents the addressInput didSet from re-querying the completer mid-resolution.
    private var isResolvingAddress = false

    // MARK: - MapKit completer

    private let completer = MKLocalSearchCompleter()
    private let completerDelegate = CompleterDelegate()

    /// Limit autocomplete to Perth metro area so results stay relevant.
    private static let perthRegion = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: -31.9505, longitude: 115.8605),
        span: MKCoordinateSpan(latitudeDelta: 2.0, longitudeDelta: 2.0)
    )

    // MARK: - Dependencies

    private let api: BinMateAPIProtocol

    // MARK: - Init

    init(api: BinMateAPIProtocol = BinMateAPI.shared) {
        self.api = api
        completer.delegate = completerDelegate
        completer.region = Self.perthRegion
        completer.resultTypes = .address
        completerDelegate.onUpdate = { [weak self] results in
            self?.suggestions = results
        }
    }

    // MARK: - Step 1: Address

    /// Called when the user taps a suggestion row.
    func selectSuggestion(_ completion: MKLocalSearchCompletion) async {
        // Clear suggestions first — prevents the addressInput didSet from re-querying
        // the completer and making the list reappear during address resolution.
        suggestions = []
        isResolvingAddress = true
        defer { isResolvingAddress = false }

        resolvedSuburb = completion.subtitle.components(separatedBy: " ").first ?? ""

        // Resolve the completion to precise MapKit coordinates so we avoid Nominatim
        // road-centroid issues (e.g. Stirling API uses point-in-polygon against parcels).
        let request = MKLocalSearch.Request(completion: completion)
        let search = MKLocalSearch(request: request)
        if let mapItem = try? await search.start().mapItems.first {
            let coord = mapItem.placemark.coordinate
            addressInput = mapItem.placemark.name ?? completion.title
            let fullAddress = "\(completion.title), \(completion.subtitle)"
            await resolveAddress(fullAddress, coordinate: coord)
        } else {
            // MKLocalSearch failed — unit addresses (e.g. "14S/125 Herdsman Pde") are
            // not always indexed individually. Try the parent building address to get
            // coordinates; all units share the same lat/lng.
            let buildingTitle = strippingUnitPrefix(from: completion.title)
            var coord: CLLocationCoordinate2D? = nil
            if buildingTitle != completion.title {
                let buildingReq = MKLocalSearch.Request()
                buildingReq.naturalLanguageQuery = "\(buildingTitle), \(completion.subtitle)"
                buildingReq.region = Self.perthRegion
                if let item = try? await MKLocalSearch(request: buildingReq).start().mapItems.first {
                    coord = item.placemark.coordinate
                }
            }
            addressInput = completion.title
            let fullAddress = "\(completion.title), \(completion.subtitle)"
            await resolveAddress(fullAddress, coordinate: coord)
        }
    }

    // MARK: - Step 2: Confirm

    /// User confirmed the detected council — advance to notifications step.
    func confirmAddress() {
        withAnimation(BinMateTheme.Animation.slow) { step = .notifications }
    }

    /// User wants to try again — return to address entry.
    func tryDifferentAddress() {
        resolvedResponse = nil
        error = nil
        withAnimation(BinMateTheme.Animation.slow) { step = .address }
    }

    // MARK: - Step 3: Notifications

    /// Request APNs permission then complete onboarding.
    func requestNotificationPermission() async {
        do {
            try await NotificationService.shared.requestPermission()
        } catch {
            Logger.notifications.error("Permission error: \(error.localizedDescription)")
        }
        completeOnboarding()
    }

    /// Skip notifications and complete onboarding.
    func skipNotifications() {
        completeOnboarding()
    }

    // MARK: - Private

    private func resolveAddress(_ address: String, coordinate: CLLocationCoordinate2D?) async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            resolvedResponse = try await api.registerAddress(address, pushToken: nil, coordinate: coordinate)
            withAnimation(BinMateTheme.Animation.slow) { step = .confirm }
        } catch let err as BinMateError {
            error = err
        } catch {
            self.error = .unknown(error)
        }
    }

    private func completeOnboarding() {
        isComplete = true
    }

    /// Strip an Australian unit prefix from a street address component.
    /// "14S/125 Herdsman Pde" → "125 Herdsman Pde"
    /// Returns the original string unchanged if no slash prefix is found.
    private func strippingUnitPrefix(from address: String) -> String {
        guard let slashIndex = address.firstIndex(of: "/") else { return address }
        return String(address[address.index(after: slashIndex)...])
            .trimmingCharacters(in: .whitespaces)
    }

    private func refreshCompleter() {
        guard !isResolvingAddress else { return }
        completer.queryFragment = addressInput
        if addressInput.isEmpty { suggestions = [] }
    }
}

// MARK: - MKLocalSearchCompleter delegate adapter

/// Bridges the Objective-C delegate callbacks to a Swift closure.
private final class CompleterDelegate: NSObject, MKLocalSearchCompleterDelegate {

    var onUpdate: ([MKLocalSearchCompletion]) -> Void = { _ in }

    func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
        onUpdate(completer.results)
    }

    func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
        Logger.network.debug("Address completer error: \(error.localizedDescription)")
        onUpdate([])
    }
}
