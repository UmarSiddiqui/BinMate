import AVKit
import SwiftUI

/// Full-screen animated splash shown once at launch.
/// Plays SplashAnimation.mp4, then calls `onFinished` to transition to app content.
struct SplashView: View {

    let onFinished: () -> Void

    @State private var player: AVPlayer? = nil
    @State private var opacity: Double = 1.0

    private static let videoName = "SplashAnimation"
    private static let fadeDuration: Double = 0.5
    private static let videoDuration: Double = 5.0

    var body: some View {
        ZStack {
            BinMateTheme.Colors.bgBase
                .ignoresSafeArea()

            if let player {
                VideoPlayerView(player: player)
                    .ignoresSafeArea()
                    .aspectRatio(contentMode: .fill)
            }
        }
        .opacity(opacity)
        .onAppear { startPlayback() }
    }

    private func startPlayback() {
        guard let url = Bundle.main.url(
            forResource: Self.videoName,
            withExtension: "mp4"
        ) else {
            // Video missing — skip splash
            onFinished()
            return
        }

        let item = AVPlayerItem(url: url)
        let avPlayer = AVPlayer(playerItem: item)
        avPlayer.isMuted = true
        avPlayer.play()
        player = avPlayer

        DispatchQueue.main.asyncAfter(
            deadline: .now() + Self.videoDuration - Self.fadeDuration
        ) {
            withAnimation(.easeInOut(duration: Self.fadeDuration)) {
                opacity = 0
            }
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + Self.videoDuration) {
            onFinished()
        }
    }
}

// MARK: - UIViewRepresentable wrapper

private struct VideoPlayerView: UIViewRepresentable {
    let player: AVPlayer

    func makeUIView(context: Context) -> PlayerUIView {
        let view = PlayerUIView()
        view.playerLayer.player = player
        view.playerLayer.videoGravity = .resizeAspectFill
        return view
    }

    func updateUIView(_ uiView: PlayerUIView, context: Context) {}
}

private final class PlayerUIView: UIView {
    override class var layerClass: AnyClass { AVPlayerLayer.self }
    var playerLayer: AVPlayerLayer { layer as! AVPlayerLayer }

    override func layoutSubviews() {
        super.layoutSubviews()
        playerLayer.frame = bounds
    }
}
