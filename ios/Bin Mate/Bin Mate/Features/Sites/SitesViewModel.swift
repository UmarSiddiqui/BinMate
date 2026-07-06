import Combine
import CoreLocation
import Foundation
import OSLog

/// Manages user location and sorted site list for SitesView.
@MainActor
final class SitesViewModel: NSObject, ObservableObject {

    @Published var userLocation: CLLocation?
    @Published var locationDenied = false

    private let locationManager = CLLocationManager()

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
            locationManager.requestLocation()
        case .denied, .restricted:
            locationDenied = true
        @unknown default:
            break
        }
    }
}

// MARK: - CLLocationManagerDelegate

extension SitesViewModel: CLLocationManagerDelegate {

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        Task { @MainActor in
            switch manager.authorizationStatus {
            case .authorizedWhenInUse, .authorizedAlways:
                self.locationDenied = false
                manager.requestLocation()
            case .denied, .restricted:
                self.locationDenied = true
            default:
                break
            }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        Task { @MainActor in
            self.userLocation = locations.last
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: any Error) {
        Logger.app.error("SitesViewModel location error: \(error.localizedDescription)")
    }
}
