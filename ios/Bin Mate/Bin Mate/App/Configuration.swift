import Foundation

/// App configuration values. In production these are injected via Config.xcconfig → Info.plist.
/// For local development the fallback values are used.
///
/// Setup for production:
///   1. Duplicate `Config.example.xcconfig` → `Config.xcconfig` (gitignored)
///   2. Fill in real values in `Config.xcconfig`
///   3. Link Config.xcconfig to your target in Xcode project settings
enum Configuration {

    // MARK: - RevenueCat

    /// Public RevenueCat API key. Use your test key locally; production key in Config.xcconfig.
    static var revenueCatAPIKey: String {
        value(forKey: "REVENUECAT_API_KEY", fallback: "test_oPScHsCPlTsGZedsKOJpkWVRXhn")
    }

    // MARK: - Backend API

    /// BinMate backend base URL.
    static var apiBaseURL: String {
        value(forKey: "API_BASE_URL", fallback: "https://binmate-api.onrender.com")
    }

    // MARK: - Sentry

    static var sentryDSN: String {
        value(forKey: "SENTRY_DSN", fallback: "")
    }

    // MARK: - Private

    private static func value(forKey key: String, fallback: String) -> String {
        guard
            let v = Bundle.main.infoDictionary?[key] as? String,
            !v.isEmpty
        else { return fallback }
        return v
    }
}
