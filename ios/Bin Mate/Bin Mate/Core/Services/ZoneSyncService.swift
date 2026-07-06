import Foundation
import OSLog

/// Keeps the backend's `user_zones` table in sync with the addresses saved on-device,
/// so the nightly reminder cron covers every saved house (CLAUDE.md §8).
///
/// Call `requestSync()` after any address change (AppState) or when the APNs token
/// arrives (NotificationService). The zone list is provided by
/// `AppState.persistedZoneSyncEntries()` so this service never duplicates storage keys.
@MainActor
final class ZoneSyncService {

    // MARK: - Singleton

    static let shared = ZoneSyncService()

    // MARK: - Dependencies

    private let api: BinMateAPIProtocol
    private let keychain: KeychainServiceProtocol

    /// In-flight sync — cancelled and replaced when a newer request arrives,
    /// so rapid address edits collapse into one backend call.
    private var syncTask: Task<Void, Never>?

    // MARK: - Init

    init(
        api: BinMateAPIProtocol = BinMateAPI.shared,
        keychain: KeychainServiceProtocol = KeychainService.shared
    ) {
        self.api = api
        self.keychain = keychain
    }

    // MARK: - Actions

    /// Push the current set of saved zones to the backend. Safe to call repeatedly.
    /// No-ops until a push token exists — reminders are impossible without one.
    func requestSync() {
        syncTask?.cancel()
        syncTask = Task { await sync() }
    }

    // MARK: - Private

    private func sync() async {
        guard let pushToken = keychain.retrievePushToken() else {
            Logger.notifications.debug("Zone sync deferred — no push token yet")
            return
        }
        let zones = AppState.persistedZoneSyncEntries()
        do {
            let userId = try await api.syncUserZones(
                pushToken: pushToken,
                userId: keychain.retrieveUserId(),
                zones: zones
            )
            guard !Task.isCancelled else { return }
            keychain.storeUserId(userId)
            Logger.notifications.info("Synced \(zones.count) zone(s) for reminders")
        } catch {
            Logger.notifications.error("Zone sync failed: \(error.localizedDescription)")
        }
    }
}
