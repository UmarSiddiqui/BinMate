import SwiftUI

/// Root container for the 3-step onboarding flow.
/// Owns the ViewModel and routes completed state back to AppState.
struct OnboardingView: View {

    @EnvironmentObject private var appState: AppState
    @StateObject private var viewModel = OnboardingViewModel()
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack {
            BinMateTheme.Colors.bgBase.ignoresSafeArea()

            VStack(spacing: 0) {
                progressIndicator
                    .padding(.top, BinMateTheme.Spacing.xl)

                stepContent
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .onChange(of: viewModel.isComplete) { complete in
            guard complete, let response = viewModel.resolvedResponse else { return }
            appState.completeOnboarding(
                zoneId:      response.zoneId,
                councilName: response.councilName,
                suburb:      viewModel.resolvedSuburb
            )
        }
    }

    // MARK: - Progress dots

    private var progressIndicator: some View {
        HStack(spacing: BinMateTheme.Spacing.sm) {
            ForEach(0..<3, id: \.self) { index in
                Capsule()
                    .fill(index == currentStepIndex
                          ? BinMateTheme.Colors.lime
                          : BinMateTheme.Colors.bgInset)
                    .frame(width: index == currentStepIndex ? 24 : 8, height: 8)
                    .animation(reduceMotion ? nil : BinMateTheme.Animation.default, value: viewModel.step)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Step \(currentStepIndex + 1) of 3")
    }

    private var currentStepIndex: Int {
        switch viewModel.step {
        case .address:       return 0
        case .confirm:       return 1
        case .notifications: return 2
        }
    }

    // MARK: - Step routing

    @ViewBuilder
    private var stepContent: some View {
        let transition: AnyTransition = reduceMotion ? .opacity : .push(from: .trailing)
        switch viewModel.step {
        case .address:
            AddressEntryView(viewModel: viewModel)
                .transition(transition)
        case .confirm:
            CouncilConfirmView(viewModel: viewModel)
                .transition(transition)
        case .notifications:
            NotificationSetupView(viewModel: viewModel)
                .transition(transition)
        }
    }
}
