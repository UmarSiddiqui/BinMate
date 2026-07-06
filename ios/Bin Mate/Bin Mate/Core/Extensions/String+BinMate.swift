import Foundation

extension String {
    /// Removes stray punctuation and whitespace from both ends of a suburb name,
    /// e.g. "Wembley," → "Wembley". Suburb names never begin or end with punctuation.
    var sanitizedSuburb: String {
        trimmingCharacters(in: .whitespacesAndNewlines.union(.punctuationCharacters))
    }
}
