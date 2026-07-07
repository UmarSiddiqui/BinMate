import Combine
import CoreLocation
import Foundation
import OSLog

/// Manages user location and sorted site list for SitesView.
@MainActor
final class SitesViewModel: NSObject, ObservableObject {

    @Published var userLocation: CLLocation?
    @Published var locationDenied = false
    @Published var isLocating = false

    private let locationManager = CLLocationManager()
    private var locationTimeoutTask: Task<Void, Never>?

    override init() {
        super.init()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyKilometer
    }

    /// Sites sorted by distance from userLocation, or in default order if unavailable.
    var sortedSites: [WasteSite] {
        guard let origin = userLocation else { return WasteSite.perthSites }
        return WasteSite.perthSites.sorted { $0.distance(from: origin) < $1.distance(from: origin) }
    }

    /// Distance string for a site, or nil if location is unavailable.
    func distanceLabel(for site: WasteSite) -> String? {
        userLocation.map { site.distanceString(from: $0) }
    }

    /// Request location access and trigger a one-shot location update.
    func requestLocation() {
        switch locationManager.authorizationStatus {
        case .notDetermined:
            locationManager.requestWhenInUseAuthorization()
        case .authorizedWhenInUse, .authorizedAlways:
            startLocating()
        case .denied, .restricted:
            locationDenied = true
        @unknown default:
            break
        }
    }

    private func startLocating() {
        isLocating = true
        locationManager.requestLocation()
        locationTimeoutTask?.cancel()
        locationTimeoutTask = Task {
            try? await Task.sleep(nanoseconds: 10_000_000_000)
            guard !Task.isCancelled else { return }
            isLocating = false
        }
    }

    private func stopLocating() {
        isLocating = false
        locationTimeoutTask?.cancel()
        locationTimeoutTask = nil
    }
}

// MARK: - CLLocationManagerDelegate

extension SitesViewModel: CLLocationManagerDelegate {

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        Task { @MainActor in
            switch manager.authorizationStatus {
            case .authorizedWhenInUse, .authorizedAlways:
                self.locationDenied = false
                self.startLocating()
            case .denied, .restricted:
                self.locationDenied = true
                self.stopLocating()
            default:
                break
            }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        Task { @MainActor in
            self.userLocation = locations.last
            self.stopLocating()
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: any Error) {
        Logger.app.error("SitesViewModel location error: \(error.localizedDescription)")
        Task { @MainActor in
            self.stopLocating()
        }
    }
}
