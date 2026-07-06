import Foundation
import Security
import OSLog

// MARK: - Protocol

/// Secure storage for sensitive values — push token and user ID.
/// Protocol allows swapping in a mock during unit tests.
protocol KeychainServiceProtocol {
    /// Persist an APNs device token string.
    func storePushToken(_ token: String)

    /// Retrieve the stored push token, or nil if not yet set.
    func retrievePushToken() -> String?

    /// Delete the stored push token.
    func deletePushToken()

    /// Persist the BinMate user UUID.
    func storeUserId(_ id: String)

    /// Retrieve the stored user UUID, or nil if not yet set.
    func retrieveUserId() -> String?

    /// Delete all stored keychain items (used on address reset).
    func clear()
}

// MARK: - Implementation

/// Security framework-backed implementation of KeychainServiceProtocol.
final class KeychainService: KeychainServiceProtocol {

    // MARK: - Singleton

    static let shared = KeychainService()
    private init() {}

    // MARK: - Push token

    func storePushToken(_ token: String) { store(token, forKey: .pushToken) }
    func retrievePushToken() -> String?  { retrieve(forKey: .pushToken) }
    func deletePushToken()               { delete(forKey: .pushToken) }

    // MARK: - User ID

    func storeUserId(_ id: String)  { store(id, forKey: .userId) }
    func retrieveUserId() -> String? { retrieve(forKey: .userId) }

    // MARK: - Clear all

    /// Wipes all BinMate keychain entries. Call when the user resets their address.
    func clear() { Key.allCases.forEach { delete(forKey: $0) } }

    // MARK: - Keys

    private enum Key: String, CaseIterable {
        case pushToken = "app.binmate.push_token"
        case userId    = "app.binmate.user_id"
    }

    // MARK: - Private helpers

    private func store(_ value: String, forKey key: Key) {
        guard let data = value.data(using: .utf8) else { return }
        let base: [CFString: Any] = [
            kSecClass:          kSecClassGenericPassword,
            kSecAttrAccount:    key.rawValue,
            kSecAttrAccessible: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]
        // Attempt update first; fall back to add if the item doesn't exist yet.
        let updateStatus = SecItemUpdate(base as CFDictionary, [kSecValueData: data] as CFDictionary)
        guard updateStatus == errSecItemNotFound else { return }

        var addQuery = base
        addQuery[kSecValueData] = data
        let addStatus = SecItemAdd(addQuery as CFDictionary, nil)
        if addStatus != errSecSuccess {
            Logger.persistence.error("Keychain write failed [\(key.rawValue)]: OSStatus \(addStatus)")
        }
    }

    private func retrieve(forKey key: Key) -> String? {
        let query: [CFString: Any] = [
            kSecClass:       kSecClassGenericPassword,
            kSecAttrAccount: key.rawValue,
            kSecReturnData:  true,
            kSecMatchLimit:  kSecMatchLimitOne
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess,
              let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private func delete(forKey key: Key) {
        let query: [CFString: Any] = [
            kSecClass:       kSecClassGenericPassword,
            kSecAttrAccount: key.rawValue
        ]
        SecItemDelete(query as CFDictionary)
    }
}
