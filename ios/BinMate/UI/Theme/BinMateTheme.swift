import SwiftUI

/// BinMate design token system. All UI values must come from here — never hardcode colours, spacing, or fonts.
enum BinMateTheme {

    // MARK: - Colors

    enum Colors {
        // Brand
        static let lime       = Color(hex: "#B8F04A") // Primary action — CTAs, active states
        static let limeDim    = Color(hex: "#8EC438") // Lime hover/pressed state
        static let limeFaint  = Color(hex: "#B8F04A").opacity(0.10)
        static let limeBorder = Color(hex: "#B8F04A").opacity(0.22)

        // Backgrounds
        static let bgBase     = Color(hex: "#0D0F12") // App background — deepest layer
        static let bgRaised   = Color(hex: "#1A1D22") // Cards, panels
        static let bgSurface  = Color(hex: "#22262D") // Input fields, secondary surfaces
        static let bgInset    = Color(hex: "#2B3038") // Inset elements, pressed states

        // Borders
        static let borderSubtle  = Color.white.opacity(0.07)
        static let borderDefault = Color.white.opacity(0.12)
        static let borderStrong  = Color.white.opacity(0.20)

        // Text
        static let textPrimary   = Color(hex: "#F0F2F5") // 15.8:1 contrast
        static let textSecondary = Color(hex: "#9BA3AD") // 5.2:1 contrast
        static let textMuted     = Color(hex: "#6B7480") // 4.6:1 contrast (AA pass)
        static let textDisabled  = Color(hex: "#444A52") // Decorative only

        // Semantic
        static let amber     = Color(hex: "#F5A623") // Verge collection, warnings
        static let amberFaint = Color(hex: "#F5A623").opacity(0.10)
        static let red       = Color(hex: "#E84848") // Errors, missed collections
        static let redFaint  = Color(hex: "#E84848").opacity(0.10)
        static let teal      = Color(hex: "#4DCEBC") // Info states, tips
        static let tealFaint = Color(hex: "#4DCEBC").opacity(0.10)
        static let yellow    = Color(hex: "#F5E642") // Recycling bin colour
        static let yellowFaint = Color(hex: "#F5E642").opacity(0.10)

        // Bin lid colours — always use these for bin type representation
        static let binRed    = Color(hex: "#D32F2F") // General waste (red lid)
        static let binYellow = Color(hex: "#F5E642") // Recycling (yellow lid)
        static let binGreen  = Color(hex: "#4CAF50") // Garden organics (lime green lid)
        static let binBody   = Color(hex: "#37474F") // Bin body illustrations only
    }

    // MARK: - Typography

    enum Typography {
        static let fontDisplay = "Syne"
        static let fontBody    = "DM Sans"
        static let fontMono    = "DM Mono"

        /// 32pt · Syne ExtraBold — hero text, large callouts
        static let display  = Font.custom("Syne", size: 32).weight(.heavy)
        /// 28pt · Syne Bold — screen titles
        static let heading1 = Font.custom("Syne", size: 28).weight(.bold)
        /// 22pt · Syne Bold — section headers
        static let heading2 = Font.custom("Syne", size: 22).weight(.bold)
        /// 18pt · Syne Bold — card titles
        static let heading3 = Font.custom("Syne", size: 18).weight(.bold)
        /// 17pt · DM Sans Regular — lead body text
        static let bodyLarge = Font.custom("DM Sans", size: 17)
        /// 15pt · DM Sans Regular — standard body
        static let body      = Font.custom("DM Sans", size: 15)
        /// 13pt · DM Sans Regular — secondary text
        static let bodySmall = Font.custom("DM Sans", size: 13)
        /// 11pt · DM Mono Medium — uppercase labels
        static let label     = Font.custom("DM Mono", size: 11).weight(.medium)
        /// 13pt · DM Mono Regular — timestamps, technical data
        static let data      = Font.custom("DM Mono", size: 13)
        /// 11pt · DM Sans Regular — legal copy, footnotes
        static let caption   = Font.custom("DM Sans", size: 11)
    }

    // MARK: - Spacing

    enum Spacing {
        static let xs:   CGFloat = 4
        static let sm:   CGFloat = 8
        static let md:   CGFloat = 16  // Default unit
        static let lg:   CGFloat = 24
        static let xl:   CGFloat = 32
        static let xxl:  CGFloat = 48
        static let xxxl: CGFloat = 64
    }

    // MARK: - Radius

    enum Radius {
        static let sm:    CGFloat = 6   // Tags, small badges
        static let md:    CGFloat = 10  // Buttons, input fields
        static let lg:    CGFloat = 16  // Small cards, list items
        static let card:  CGFloat = 22  // Standard cards
        static let sheet: CGFloat = 30  // Bottom sheets, modals
        static let full:  CGFloat = 999 // Pills, circular elements
    }

    // MARK: - Animation

    enum Animation {
        static let `default` = SwiftUI.Animation.easeInOut(duration: 0.2)
        static let slow      = SwiftUI.Animation.easeInOut(duration: 0.3)
    }

    // MARK: - Icons

    enum Symbols {
        static let bins         = "trash"
        static let calendar     = "calendar"
        static let clock        = "clock"
        static let location     = "location.fill"
        static let bell         = "bell.fill"
        static let settings     = "gearshape"
        static let home         = "house.fill"
        static let checkmark    = "checkmark"
        static let dismiss      = "xmark"
        static let next         = "chevron.right"
        static let binsOut      = "arrow.up"
        static let garden       = "leaf.fill"
        static let recycling    = "recycle"
    }
}

// MARK: - Color(hex:) extension

extension Color {
    /// Initialise from a hex string — supports "#RRGGBB" and "RRGGBB".
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: .alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let r = Double((int >> 16) & 0xFF) / 255
        let g = Double((int >> 8) & 0xFF) / 255
        let b = Double(int & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}
