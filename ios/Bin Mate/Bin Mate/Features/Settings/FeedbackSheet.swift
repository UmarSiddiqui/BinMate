import SwiftUI

/// Feedback category options shown in the picker. Raw values match the backend enum.
enum FeedbackCategory: String, CaseIterable, Identifiable {
    case missedBin      = "missed_bin"
    case wrongSchedule  = "wrong_schedule"
    case ui             = "ui"
    case featureRequest = "feature_request"
    case other          = "other"

    var id: String { rawValue }

    /// Human-readable picker label.
    var displayName: String {
        switch self {
        case .missedBin:      return "Missed bin"
        case .wrongSchedule:  return "Wrong schedule"
        case .ui:             return "App design"
        case .featureRequest: return "Feature request"
        case .other:          return "Something else"
        }
    }
}

/// Sheet for submitting anonymous feedback — missed bins, wrong data, ideas.
/// Present from SettingsView. Sends to POST /api/v1/feedback with zone context only (no PII).
struct FeedbackSheet: View {

    @EnvironmentObject private var appState: AppState
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel = FeedbackViewModel()

    private enum Metrics {
        static let messageMinHeight: CGFloat = 120
    }

    var body: some View {
        NavigationStack {
            ZStack {
                BinMateTheme.Colors.bgBase.ignoresSafeArea()

                if viewModel.isSent {
                    sentState
                } else {
                    form
                }
            }
            .navigationTitle("Send feedback")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                        .foregroundStyle(BinMateTheme.Colors.textSecondary)
                }
            }
        }
        .preferredColorScheme(.dark)
    }

    // MARK: - Form

    private var form: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: BinMateTheme.Spacing.lg) {
                categoryPicker
                messageField
                if let err = viewModel.error {
                    errorRow(err)
                }
                submitButton
                Text("Feedback is anonymous. Only your suburb's zone is included so we can check the schedule.")
                    .font(BinMateTheme.Typography.caption)
                    .foregroundColor(BinMateTheme.Colors.textMuted)
            }
            .padding(BinMateTheme.Spacing.lg)
        }
    }

    private var categoryPicker: some View {
        VStack(alignment: .leading, spacing: BinMateTheme.Spacing.sm) {
            Text("WHAT'S IT ABOUT?")
                .font(BinMateTheme.Typography.label)
                .foregroundColor(BinMateTheme.Colors.textMuted)
                .kerning(1.1)

            VStack(spacing: BinMateTheme.Spacing.xs) {
                ForEach(FeedbackCategory.allCases) { category in
                    categoryRow(category)
                }
            }
        }
    }

    private func categoryRow(_ category: FeedbackCategory) -> some View {
        let isSelected = viewModel.category == category
        return Button {
            viewModel.category = category
        } label: {
            HStack {
                Text(category.displayName)
                    .font(BinMateTheme.Typography.body)
                    .foregroundColor(BinMateTheme.Colors.textPrimary)
                Spacer()
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .foregroundColor(isSelected
                                     ? BinMateTheme.Colors.lime
                                     : BinMateTheme.Colors.textMuted)
                    .accessibilityHidden(true)
            }
            .padding(BinMateTheme.Spacing.md)
            .background(BinMateTheme.Colors.bgRaised)
            .clipShape(RoundedRectangle(cornerRadius: BinMateTheme.Radius.md))
            .overlay {
                RoundedRectangle(cornerRadius: BinMateTheme.Radius.md)
                    .stroke(isSelected
                            ? BinMateTheme.Colors.limeBorder
                            : BinMateTheme.Colors.borderSubtle)
            }
        }
        .buttonStyle(.pressableCard)
        .accessibilityLabel("\(category.displayName)\(isSelected ? ", selected" : "")")
    }

    private var messageField: some View {
        VStack(alignment: .leading, spacing: BinMateTheme.Spacing.sm) {
            Text("TELL US MORE")
                .font(BinMateTheme.Typography.label)
                .foregroundColor(BinMateTheme.Colors.textMuted)
                .kerning(1.1)

            TextEditor(text: $viewModel.message)
                .font(BinMateTheme.Typography.body)
                .foregroundColor(BinMateTheme.Colors.textPrimary)
                .scrollContentBackground(.hidden)
                .padding(BinMateTheme.Spacing.sm)
                .frame(minHeight: Metrics.messageMinHeight)
                .background(BinMateTheme.Colors.bgSurface)
                .clipShape(RoundedRectangle(cornerRadius: BinMateTheme.Radius.md))
                .overlay {
                    RoundedRectangle(cornerRadius: BinMateTheme.Radius.md)
                        .stroke(BinMateTheme.Colors.borderSubtle)
                }
                .accessibilityLabel("Feedback message")
        }
    }

    private var submitButton: some View {
        Button {
            HapticFeedback.impact(.medium)
            Task { await viewModel.submit(zoneId: appState.primaryZoneId) }
        } label: {
            HStack {
                if viewModel.isSending {
                    ProgressView()
                        .tint(BinMateTheme.Colors.bgBase)
                } else {
                    Text("Send feedback")
                        .font(BinMateTheme.Typography.heading3)
                }
            }
            .foregroundColor(BinMateTheme.Colors.bgBase)
            .frame(maxWidth: .infinity)
            .padding(BinMateTheme.Spacing.md)
            .background(viewModel.canSubmit
                        ? AnyShapeStyle(BinMateTheme.Gradients.heroActive)
                        : AnyShapeStyle(BinMateTheme.Colors.bgInset))
            .clipShape(RoundedRectangle(cornerRadius: BinMateTheme.Radius.md))
        }
        .buttonStyle(.pressableCard)
        .disabled(!viewModel.canSubmit || viewModel.isSending)
        .accessibilityLabel("Send feedback")
    }

    private func errorRow(_ err: BinMateError) -> some View {
        HStack(spacing: BinMateTheme.Spacing.sm) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.caption)
                .foregroundColor(BinMateTheme.Colors.amber)
            Text(err.errorDescription ?? "Couldn't send feedback. Try again.")
                .font(BinMateTheme.Typography.bodySmall)
                .foregroundColor(BinMateTheme.Colors.amber)
        }
        .padding(BinMateTheme.Spacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(BinMateTheme.Colors.amberFaint)
        .clipShape(RoundedRectangle(cornerRadius: BinMateTheme.Radius.md))
    }

    // MARK: - Sent state

    private var sentState: some View {
        VStack(spacing: BinMateTheme.Spacing.md) {
            BinMateIconBadge(
                systemName: BinMateTheme.Symbols.checkmark,
                foreground: BinMateTheme.Colors.lime,
                background: BinMateTheme.Colors.limeFaint,
                size: 64,
                symbolSize: 28
            )
            Text("Thanks — got it")
                .font(BinMateTheme.Typography.heading3)
                .foregroundColor(BinMateTheme.Colors.textPrimary)
            Text("Your feedback helps keep schedules accurate for everyone.")
                .font(BinMateTheme.Typography.body)
                .foregroundColor(BinMateTheme.Colors.textSecondary)
                .multilineTextAlignment(.center)
            Button("Done") { dismiss() }
                .font(BinMateTheme.Typography.body)
                .foregroundColor(BinMateTheme.Colors.lime)
                .padding(.top, BinMateTheme.Spacing.sm)
        }
        .padding(BinMateTheme.Spacing.xl)
    }
}
