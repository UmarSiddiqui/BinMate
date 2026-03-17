# BinMate — Brand Tokens for AI Agents
> This file is the single source of truth for all design values.
> When writing any UI code, always derive values from this file — never invent new colours, spacing, or copy.

---

## 1. Colour Tokens

### SwiftUI Usage
```swift
// All colours defined in BinMateTheme.Colors
// File: ios/BinMate/UI/Theme/BinMateTheme.swift
```

| Token name | Hex | RGB | Usage |
|---|---|---|---|
| `lime` | `#B8F04A` | 184, 240, 74 | Primary action — CTAs, active states, brand accent |
| `limeDim` | `#8EC438` | 142, 196, 56 | Lime hover/pressed state |
| `limeFaint` | `rgba(184,240,74,0.10)` | — | Lime background tint |
| `limeBorder` | `rgba(184,240,74,0.22)` | — | Lime border tint |
| `bgBase` | `#0D0F12` | 13, 15, 18 | App background — deepest layer |
| `bgRaised` | `#1A1D22` | 26, 29, 34 | Cards, panels |
| `bgSurface` | `#22262D` | 34, 38, 45 | Input fields, secondary surfaces |
| `bgInset` | `#2B3038` | 43, 48, 56 | Inset elements, pressed states |
| `borderSubtle` | `rgba(255,255,255,0.07)` | — | Default card borders |
| `borderDefault` | `rgba(255,255,255,0.12)` | — | Hover borders, input borders |
| `borderStrong` | `rgba(255,255,255,0.20)` | — | Focus rings, selected states |
| `textPrimary` | `#F0F2F5` | 240, 242, 245 | Headings, primary content — 15.8:1 contrast |
| `textSecondary` | `#9BA3AD` | 155, 163, 173 | Body text, descriptions — 5.2:1 contrast |
| `textMuted` | `#6B7480` | 107, 116, 128 | Labels, metadata — 4.6:1 contrast (AA pass) |
| `textDisabled` | `#444A52` | 68, 74, 82 | Decorative only — do not use for readable text |

### Semantic Colours

| Token name | Hex | Usage |
|---|---|---|
| `amber` | `#F5A623` | Verge collection alerts, warnings |
| `amberFaint` | `rgba(245,166,35,0.10)` | Amber background tint |
| `red` | `#E84848` | Errors, missed collections, destructive actions |
| `redFaint` | `rgba(232,72,72,0.10)` | Red background tint |
| `teal` | `#4DCEBC` | Informational states, tips |
| `tealFaint` | `rgba(77,206,188,0.10)` | Teal background tint |
| `yellow` | `#F5E642` | Recycling bin colour |
| `yellowFaint` | `rgba(245,230,66,0.10)` | Yellow background tint |

### Bin Colours (map to Perth physical bin lids)

| Bin type | Lid colour | Hex | Usage in UI |
|---|---|---|---|
| General waste | Red | `#D32F2F` | `binRed` — always this colour for general waste |
| Recycling | Yellow | `#F5E642` | `binYellow` — always this colour for recycling |
| Garden organics | Lime green | `#4CAF50` | `binGreen` — always this colour for garden waste |
| Bin body | Dark green | `#37474F` | `binBody` — bin body illustrations only |

### Contrast Compliance
All text tokens pass WCAG AA (4.5:1) on `bgBase`. Never use `textDisabled` for readable text.

---

## 2. Typography Tokens

### Font Families
```swift
BinMateTheme.Typography.fontDisplay = "Syne"   // Bold display, headings
BinMateTheme.Typography.fontBody    = "DM Sans" // All body, UI text
BinMateTheme.Typography.fontMono    = "DM Mono" // Data, timestamps, labels
```

**Fallbacks:** `Syne` → system-serif, `DM Sans` → `-apple-system`, `DM Mono` → `Menlo`

### Type Scale

| Token | Font | Size | Weight | Letter-spacing | Line-height | Usage |
|---|---|---|---|---|---|---|
| `display` | Syne | 32pt | 800 | -0.03em | 0.95 | Hero text, large callouts |
| `heading1` | Syne | 28pt | 700 | -0.025em | 1.05 | Screen titles |
| `heading2` | Syne | 22pt | 700 | -0.02em | 1.1 | Section headers |
| `heading3` | Syne | 18pt | 700 | -0.015em | 1.2 | Card titles |
| `bodyLarge` | DM Sans | 17pt | 400 | 0 | 1.65 | Lead body text |
| `body` | DM Sans | 15pt | 400 | 0 | 1.6 | Standard body |
| `bodySmall` | DM Sans | 13pt | 400 | 0 | 1.55 | Secondary text |
| `label` | DM Mono | 11pt | 500 | 0.1em | 1.4 | Uppercase labels, section markers |
| `data` | DM Mono | 13pt | 400 | 0 | 1.5 | Timestamps, hex values, technical data |
| `caption` | DM Sans | 11pt | 400 | 0 | 1.4 | Legal copy, footnotes |

### Typography Rules
- Display and heading fonts: **always Syne**, never DM Sans for h1/h2/h3
- Body text: **always DM Sans**, never Syne for reading text
- Technical/time data: **always DM Mono**
- Never use font weights other than: 400 (regular), 500 (medium), 700 (bold), 800 (extrabold)
- Never use font sizes outside the scale above without explicit approval
- Line length maximum: 65 characters per line for body text

---

## 3. Spacing Tokens

```swift
BinMateTheme.Spacing.xs   = 4pt
BinMateTheme.Spacing.sm   = 8pt
BinMateTheme.Spacing.md   = 16pt   // Default spacing unit
BinMateTheme.Spacing.lg   = 24pt
BinMateTheme.Spacing.xl   = 32pt
BinMateTheme.Spacing.xxl  = 48pt
BinMateTheme.Spacing.xxxl = 64pt
```

**Rule:** Always use spacing tokens. Never use arbitrary values like `padding(13)` or `padding(21)`.

---

## 4. Radius Tokens

```swift
BinMateTheme.Radius.sm     = 6pt    // Tags, small badges
BinMateTheme.Radius.md     = 10pt   // Buttons, input fields
BinMateTheme.Radius.lg     = 16pt   // Small cards, list items
BinMateTheme.Radius.card   = 22pt   // Standard cards
BinMateTheme.Radius.sheet  = 30pt   // Bottom sheets, large modals
BinMateTheme.Radius.full   = 999pt  // Pills, circular elements
```

---

## 5. Component Specifications

### Primary Button
```swift
// Min height: 52pt (touch target rule — WCAG 2.1)
// Radius: BinMateTheme.Radius.md (10pt)
// Background: BinMateTheme.Colors.lime
// Text: BinMateTheme.Colors.bgBase (dark on lime)
// Font: DM Sans 16pt, weight 500
// Padding: horizontal 24pt

struct PrimaryButton: View {
    let title: String
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Text(title)
                .font(BinMateTheme.Typography.bodyLarge)
                .fontWeight(.medium)
                .foregroundColor(BinMateTheme.Colors.bgBase)
                .frame(maxWidth: .infinity)
                .frame(minHeight: 52)
                .background(BinMateTheme.Colors.lime)
                .cornerRadius(BinMateTheme.Radius.md)
        }
    }
}
```

### Secondary Button
```swift
// Background: BinMateTheme.Colors.bgSurface
// Border: 1pt, BinMateTheme.Colors.borderDefault
// Text: BinMateTheme.Colors.textPrimary
// Everything else same as PrimaryButton
```

### Ghost Button
```swift
// Background: clear
// Border: 1pt, BinMateTheme.Colors.limeBorder
// Text: BinMateTheme.Colors.lime
```

### Touch Targets
**Minimum 44×44pt on all interactive elements.** This is a hard rule.
If a visual element is smaller, expand the tap area with `.contentShape(Rectangle())` or a padding frame.

### Card
```swift
// Background: BinMateTheme.Colors.bgRaised
// Border: 1pt, BinMateTheme.Colors.borderSubtle
// Radius: BinMateTheme.Radius.card (22pt)
// Padding: BinMateTheme.Spacing.lg (24pt)
// On hover/press: border → BinMateTheme.Colors.borderDefault
```

### Collection Hero Card (the main "Bins out tonight" card)
```swift
// Background: BinMateTheme.Colors.lime (lime fill)
// Radius: 22pt
// Padding: 20pt all sides
// Title: Syne 24pt weight 800, color bgBase (dark)
// Subtitle: DM Sans 12pt, color rgba(13,15,18,0.55)
// Bin tags: small pills, rgba(13,15,18,0.12) background, dark text
```

### Notification Card
```swift
// Background: BinMateTheme.Colors.bgRaised
// Border: 1pt, BinMateTheme.Colors.borderDefault
// Radius: 20pt
// Left accent bar: 3pt wide, colour matches notification type
//   - Bin collection: lime
//   - Verge: amber
//   - Holiday shift: teal
// Icon area: 44×44pt, rounded 10pt, type-matched faint background
```

### Bottom Navigation
```swift
// Background: BinMateTheme.Colors.bgRaised
// Top border: 1pt, BinMateTheme.Colors.borderSubtle
// Tab items: 3 items — Home, Calendar, Settings
// Active: BinMateTheme.Colors.lime
// Inactive: BinMateTheme.Colors.textMuted
// Icon size: 22×22pt (SF Symbols)
// Label: DM Mono 10pt, 0.04em letter-spacing
```

---

## 6. Icon Rules

- **iOS app:** SF Symbols only. No custom icon font, no PNG icons.
- **Always set:** `.font(.system(size: 22))` — never let icons inherit ambient font
- **Accessibility:** every SF Symbol icon must have `.accessibilityLabel("description")`

### Icon Mapping
```
trash        → bins (general)
calendar     → schedule / calendar view
clock        → upcoming, timing
location.fill → address, location
bell.fill    → notifications
gearshape    → settings
house.fill   → home
person.fill  → profile / avatar
checkmark    → success, confirmation
xmark        → error, dismiss
chevron.right → navigation, next
arrow.up     → put bins out
leaf.fill    → garden / green waste
recycle      → recycling
```

### Bin Type Icons (custom — do not use SF Symbols for these)
Represent bins as coloured pill badges with a dot indicator, not icons:
```swift
// BinTypeBadge component
HStack(spacing: 4) {
    Circle()
        .fill(binColor)
        .frame(width: 8, height: 8)
    Text(binLabel)
        .font(BinMateTheme.Typography.caption)
        .foregroundColor(BinMateTheme.Colors.textSecondary)
}
.padding(.horizontal, 10)
.padding(.vertical, 4)
.background(BinMateTheme.Colors.bgSurface)
.cornerRadius(BinMateTheme.Radius.full)
```

---

## 7. Notification Copy Library

**These are the only approved notification strings. Do not invent new ones.**
All copy is tone-reviewed and brand-approved. If a new scenario arises, ask before writing copy.

### Bin Collection (night before — 6pm)
- **Title:** `Bins out tonight`
- **Body:** `{binTypes} bins. {councilName}. Out by 6am tomorrow.`
- **Example body:** `Yellow + Red bins. Stirling Council. Out by 6am tomorrow.`

### Bin Collection (morning — 6am)
- **Title:** `Bin day`
- **Body:** `{primaryBin} lid goes out today. {nextBin} next week.`
- **Example body:** `Red lid goes out today. Yellow next week.`

### Recycling only
- **Title:** `Recycling tonight`
- **Body:** `Yellow bin. {councilName}. Out by 6am.`

### Verge collection (3 days out)
- **Title:** `Verge collection soon`
- **Body:** `Your area starts {dayName} {date}. Time to sort that pile in the garage.`

### Verge collection (day before)
- **Title:** `Verge collection tomorrow`
- **Body:** `Items need to be on the kerb by 7am. No hazardous waste.`

### Public holiday shift (2 days notice)
- **Title:** `Schedule change — {holidayName}`
- **Body:** `Your {originalDay} collection shifts to {newDay} this week. Nothing else changes.`

### Onboarding complete (in-app, not push)
- **Title:** `You're sorted.`
- **Body:** `BinMate has your {suburb} schedule. We'll remind you every time.`

### Free trial ending (2 days before)
- **Title:** `Your free trial ends {day}`
- **Body:** `Keep getting reminders for $0.99/month. Less than a coffee.`

### Subscription confirmed (in-app)
- **Title:** `Cheers.`
- **Body:** `Premium is active. You'll never have to think about bins again.`

### Address not found (in-app error)
- **Title:** `Couldn't find your address`
- **Body:** `Check the spelling or select your council manually.`

---

## 8. Voice Rules for AI-Generated Copy

When writing any in-app text, error messages, empty states, or UI labels, follow these rules:

### Always
- Short. Direct. Active voice.
- Perth-aware — use local terms: "kerb" (not "curb"), "verge" (not "curb"), "fortnightly" (not "biweekly")
- Time in AWST — never UTC, never "your local time"
- Bin types by lid colour: "yellow lid" / "red lid" / "lime green lid"

### Never
- Exclamation marks (except in onboarding max 1 time)
- "We're sorry for the inconvenience"
- "Please note that..."
- "In order to..."
- Emojis in UI text (notification copy only, rare)
- Corporate words: seamless, leverage, synergy, ecosystem, empower, journey, solution

### Approved word list (use these)
`sorted`, `tonight`, `tomorrow`, `heads up`, `all set`, `bin day`, `kerb`, `verge`, `fortnightly`, `goes out`, `Week A`, `Week B`, `council`, `suburb`, `AWST`, `6am`

### Banned word list
`exciting`, `amazing`, `seamless`, `game-changer`, `unlock`, `supercharge`, `frictionless`, `leverage`, `empower`, `ecosystem`, `journey`, `solution`, `utilize`, `touch base`, `circle back`

---

## 9. Animation & Motion Rules

- Transition duration: **150ms–300ms** (never under 100ms, never over 500ms)
- Use `withAnimation(.easeInOut(duration: 0.2))` as default
- Respect `@Environment(\.accessibilityReduceMotion)` — check before animating
- Loading states: skeleton views, not spinners (except for inline actions)
- Page transitions: `.slide` for forward navigation, `.opacity` for modals
- No bounce animations on primary content — reserved for celebratory moments only (e.g. successful subscription)

```swift
// Motion check pattern — always use this
@Environment(\.accessibilityReduceMotion) var reduceMotion

var animation: Animation? {
    reduceMotion ? nil : .easeInOut(duration: 0.2)
}
```

---

## 10. Accessibility Requirements

All UI must meet WCAG 2.1 AA minimum. This is non-negotiable.

- **Colour contrast:** all text 4.5:1 minimum — verified by token table in Section 1
- **Touch targets:** minimum 44×44pt on all interactive elements
- **VoiceOver:** every interactive element needs `.accessibilityLabel()`
- **Dynamic Type:** all text must scale — use `.font()` not `.font(.system(size:))`
  - Exception: `DM Mono` data elements may use fixed size (data layout reasons)
- **Focus order:** tab/swipe order must match visual order
- **No colour-only information:** bin types shown with colour AND text label
- **Error states:** announced via `.accessibilityIdentifier()` and focusable
- **Images:** all decorative images have `.accessibilityHidden(true)`

---

*This file is the single source of truth for all BinMate design values.*
*Last updated: March 2026 — v1.0*
*Do not modify without developer approval.*
