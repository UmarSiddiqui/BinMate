import Combine
import OSLog
import RevenueCat

/// Manages RevenueCat entitlements and subscription state.
/// Inject as @EnvironmentObject and observe `isPremium` throughout the app.
@MainActor
final class EntitlementService: ObservableObject {

    // MARK: - Singleton

    static let shared = EntitlementService()

    // MARK: - Published state

    @Published private(set) var isPremium = false
    @Published private(set) var isLoading = false
    @Published private(set) var customerInfo: CustomerInfo?

    // MARK: - Constants

    private let entitlementId = "Bin Mate Pro"

    // MARK: - Init

    private init() {}

    // MARK: - Lifecycle

    /// Call once on app launch to start listening for customer info updates.
    func start() {
        Task { await refresh() }
        listenForUpdates()
    }

    // MARK: - Refresh

    /// Fetch latest customer info from RevenueCat.
    func refresh() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let info = try await Purchases.shared.customerInfo()
            apply(info)
        } catch {
            Logger.purchases.error("Failed to fetch customer info: \(error.localizedDescription)")
        }
    }

    // MARK: - Purchase

    /// Purchase a specific package from the current offering.
    func purchase(package pkg: Package) async throws {
        isLoading = true
        defer { isLoading = false }
        do {
            let result = try await Purchases.shared.purchase(package: pkg)
            apply(result.customerInfo)
        } catch let error as ErrorCode where error == .purchaseCancelledError {
            throw BinMateError.purchaseCancelled
        } catch {
            Logger.purchases.error("Purchase failed: \(error.localizedDescription)")
            throw BinMateError.purchaseFailed(error.localizedDescription)
        }
    }

    // MARK: - Restore

    /// Restore prior purchases.
    func restorePurchases() async throws {
        isLoading = true
        defer { isLoading = false }
        do {
            let info = try await Purchases.shared.restorePurchases()
            apply(info)
        } catch {
            Logger.purchases.error("Restore failed: \(error.localizedDescription)")
            throw BinMateError.purchaseFailed(error.localizedDescription)
        }
    }

    // MARK: - Private

    private func apply(_ info: CustomerInfo) {
        customerInfo = info
        isPremium    = info.entitlements[entitlementId]?.isActive == true
        Logger.purchases.debug("Entitlement '\(self.entitlementId)': \(self.isPremium ? "ACTIVE" : "inactive")")
    }

    /// Subscribe to RevenueCat's async stream for real-time updates (e.g. webhook-triggered changes).
    private func listenForUpdates() {
        Task {
            for await info in Purchases.shared.customerInfoStream {
                await MainActor.run { apply(info) }
            }
        }
    }
}
