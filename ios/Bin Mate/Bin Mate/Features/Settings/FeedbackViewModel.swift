import Combine
import Foundation
import OSLog

/// Drives FeedbackSheet — validates input and submits to the backend.
@MainActor
final class FeedbackViewModel: ObservableObject {

    // MARK: - Published

    @Published var category: FeedbackCategory = .missedBin
    @Published var message = ""
    @Published private(set) var isSending = false
    @Published private(set) var isSent = false
    @Published private(set) var error: BinMateError?

    // MARK: - Validation

    /// Minimum characters required before the message can be sent (matches backend).
    private static let minimumMessageLength = 3

    var canSubmit: Bool {
        message.trimmingCharacters(in: .whitespacesAndNewlines).count >= Self.minimumMessageLength
    }

    // MARK: - Dependencies

    private let api: BinMateAPIProtocol

    init(api: BinMateAPIProtocol = BinMateAPI.shared) {
        self.api = api
    }

    // MARK: - Actions

    /// Submits the feedback with optional zone context. No user identity is sent.
    func submit(zoneId: String?) async {
        guard canSubmit, !isSending else { return }
        isSending = true
        error = nil
        defer { isSending = false }

        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String
        do {
            try await api.submitFeedback(
                category: category.rawValue,
                message: message.trimmingCharacters(in: .whitespacesAndNewlines),
                zoneId: zoneId,
                appVersion: version
            )
            isSent = true
            Logger.app.info("Feedback submitted (\(self.category.rawValue))")
        } catch let err as BinMateError {
            error = err
        } catch {
            self.error = .unknown(error)
        }
    }
}
