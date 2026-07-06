import CoreLocation
import Foundation
import OSLog

// MARK: - Protocol

/// Network client for the BinMate backend API.
/// Use BinMateAPIProtocol in ViewModels and services so they remain testable.
protocol BinMateAPIProtocol {
    /// Register an address and return the resolved zone + upcoming collections.
    /// Pass `coordinate` when available (resolved via MapKit) to skip Nominatim geocoding on the backend,
    /// which avoids road-centroid precision issues for councils that use point-in-polygon lookups.
    func registerAddress(_ address: String, pushToken: String?, coordinate: CLLocationCoordinate2D?) async throws -> RegisterAddressResponse

    /// Fetch the upcoming collection schedule for a zone.
    func fetchSchedule(zoneId: String, from: Date, count: Int) async throws -> [Collection]

    /// Store or update the APNs push token for a user on the backend.
    func updatePushToken(userId: String, pushToken: String, notificationHour: Int?) async throws
}

// MARK: - Response types

/// Payload returned by POST /api/v1/register-address.
struct RegisterAddressResponse: Decodable {
    let zoneId: String
    let councilName: String
    let nextCollections: [Collection]
}

// MARK: - Implementation

/// URLSession-backed implementation of BinMateAPIProtocol.
/// Inject BinMateAPI.shared in production; swap for a mock in tests.
final class BinMateAPI: BinMateAPIProtocol {

    // MARK: - Singleton

    static let shared = BinMateAPI()

    // MARK: - Private state

    private let baseURL: URL
    private let session: URLSession
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    // MARK: - Init

    init(session: URLSession = .shared) {
        guard let url = URL(string: Configuration.apiBaseURL) else {
            fatalError("Invalid API_BASE_URL: \(Configuration.apiBaseURL)")
        }
        self.baseURL = url
        self.session = session
    }

    // MARK: - Public API

    func registerAddress(_ address: String, pushToken: String?, coordinate: CLLocationCoordinate2D?) async throws -> RegisterAddressResponse {
        struct Body: Encodable {
            let address: String
            let pushToken: String?
            let lat: Double?
            let lng: Double?
        }
        return try await post(
            path: "/api/v1/register-address",
            body: Body(
                address: address,
                pushToken: pushToken,
                lat: coordinate?.latitude,
                lng: coordinate?.longitude
            )
        )
    }

    func fetchSchedule(zoneId: String, from: Date, count: Int = 20) async throws -> [Collection] {
        let url = try scheduleURL(zoneId: zoneId, from: from, count: count)
        let response: ScheduleResponse = try await get(url: url)
        return response.collections
    }

    func updatePushToken(userId: String, pushToken: String, notificationHour: Int?) async throws {
        struct Body: Encodable { let userId: String; let pushToken: String; let notificationHour: Int? }
        let _: OKResponse = try await put(
            path: "/api/v1/push-token",
            body: Body(userId: userId, pushToken: pushToken, notificationHour: notificationHour)
        )
    }

    // MARK: - Private helpers

    private func scheduleURL(zoneId: String, from: Date, count: Int) throws -> URL {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withFullDate]
        guard var components = URLComponents(
            url: baseURL.appendingPathComponent("/api/v1/schedule"),
            resolvingAgainstBaseURL: false
        ) else { throw BinMateError.networkUnavailable }
        components.queryItems = [
            URLQueryItem(name: "zoneId", value: zoneId),
            URLQueryItem(name: "from",   value: formatter.string(from: from)),
            URLQueryItem(name: "count",  value: String(count))
        ]
        guard let url = components.url else { throw BinMateError.networkUnavailable }
        return url
    }

    private func post<Body: Encodable, Response: Decodable>(path: String, body: Body) async throws -> Response {
        var request = makeRequest(path: path, method: "POST")
        request.httpBody = try encoder.encode(body)
        return try await execute(request)
    }

    private func put<Body: Encodable, Response: Decodable>(path: String, body: Body) async throws -> Response {
        var request = makeRequest(path: path, method: "PUT")
        request.httpBody = try encoder.encode(body)
        return try await execute(request)
    }

    private func get<Response: Decodable>(url: URL) async throws -> Response {
        let request = makeRequest(url: url, method: "GET")
        return try await execute(request)
    }

    private func makeRequest(path: String, method: String) -> URLRequest {
        makeRequest(url: baseURL.appendingPathComponent(path), method: method)
    }

    private func makeRequest(url: URL, method: String) -> URLRequest {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("BinMate/1.0 iOS", forHTTPHeaderField: "User-Agent")
        return request
    }

    private func execute<Response: Decodable>(_ request: URLRequest) async throws -> Response {
        do {
            let (data, urlResponse) = try await session.data(for: request)
            guard let http = urlResponse as? HTTPURLResponse else {
                throw BinMateError.networkUnavailable
            }
            Logger.network.debug("\(request.httpMethod ?? "?") \(request.url?.path ?? "") → \(http.statusCode)")
            guard 200...299 ~= http.statusCode else {
                Logger.network.error("API \(http.statusCode): \(request.url?.path ?? "")")
                throw apiError(for: http.statusCode)
            }
            return try decoder.decode(Response.self, from: data)
        } catch let err as BinMateError {
            throw err
        } catch let urlErr as URLError {
            throw networkError(from: urlErr)
        } catch {
            Logger.network.error("Request failed: \(error.localizedDescription)")
            throw BinMateError.unknown(error)
        }
    }

    private func apiError(for statusCode: Int) -> BinMateError {
        switch statusCode {
        case 404, 422: return .addressNotFound
        default:       return .scheduleUnavailable
        }
    }

    private func networkError(from urlError: URLError) -> BinMateError {
        switch urlError.code {
        case .notConnectedToInternet, .networkConnectionLost, .timedOut:
            return .networkUnavailable
        default:
            return .unknown(urlError)
        }
    }
}

// MARK: - Private response types

private struct ScheduleResponse: Decodable {
    let collections: [Collection]
}

private struct OKResponse: Decodable {
    let ok: Bool
}
