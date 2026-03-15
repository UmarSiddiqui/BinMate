import Foundation

/// All app-level errors. ViewModels catch and publish these — never expose raw `Error` to UI.
enum BinMateError: LocalizedError {
    case networkUnavailable
    case addressNotFound
    case councilUnsupported(String)
    case scheduleUnavailable
    case purchaseFailed(String)
    case purchaseCancelled
    case unknown(Error)

    var errorDescription: String? {
        switch self {
        case .networkUnavailable:
            return "No internet connection"
        case .addressNotFound:
            return "Couldn't find that address"
        case .councilUnsupported(let name):
            return "\(name) isn't supported yet"
        case .scheduleUnavailable:
            return "Schedule temporarily unavailable"
        case .purchaseFailed(let reason):
            return "Purchase failed: \(reason)"
        case .purchaseCancelled:
            return nil // Don't show an error when user cancels — it's intentional
        case .unknown:
            return "Something went wrong"
        }
    }

    /// True if this error should be displayed to the user.
    var isUserFacing: Bool {
        if case .purchaseCancelled = self { return false }
        return true
    }
}
