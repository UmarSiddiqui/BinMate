# BinMate — App Store Listing Copy
> Source of truth for all App Store metadata. Update here first, then copy into App Store Connect.
> Voice rules: BRAND.md Section 8. No exclamation marks, no banned words.

---

## App Name
`Bin Mate`
*(30 char max — fits exactly)*

## Subtitle
`Perth bin day reminders`
*(23 chars — under 30 char limit)*

## Category
- **Primary:** Utilities
- **Secondary:** Lifestyle

## Age Rating
`4+`
No objectionable content.

## Price
Free (with In-App Purchase)

---

## Description
*(4,000 char limit. Current length: ~1,450 chars.)*

```
Never miss a bin day again.

BinMate reads your Perth council's schedule and tells you when to put your bins out — the night before, every time.

SET UP IN 30 SECONDS
Enter your address. BinMate detects your council, loads your exact collection schedule, and you're sorted.

WHAT BINMATE TRACKS
• Red lid, yellow lid, or lime green lid week
• Fortnightly recycling and green waste rotations
• Public holiday shifts — your collection moves, BinMate moves with it
• Verge collection dates for your area

COUNCILS COVERED
City of Stirling · City of Wanneroo · City of Fremantle · City of Cockburn · City of Melville · City of Canning · City of Swan · City of South Perth · City of Armadale

More councils added regularly. If your council isn't listed, it's in the queue.

FREE TIER
Full upcoming schedule, verge collection dates, public holiday shift information, 7-day schedule preview.

PREMIUM — $1.49/MONTH OR $9.99/YEAR
Push notification the evening before bin day. Verge collection reminder 3 days out and the day before. Public holiday shift alert 2 days out. Full year calendar view.

7-day free trial. Cancel any time.

PRIVACY
Your address stays on your device. No account required. No ads. No tracking.
```

---

## Keywords
*(100 char limit — exactly 96 chars with commas)*

```
bin day Perth,recycling reminder,rubbish day,bin reminder,Perth council,WA bins,verge collection
```

**Rationale:**
| Keyword | Why |
|---|---|
| `bin day Perth` | Primary search intent — geo-qualified |
| `recycling reminder` | High intent, no Perth qualifier needed |
| `rubbish day` | AU English variant of "bin day" |
| `bin reminder` | Generic intent |
| `Perth council` | Captures council-lookup searches |
| `WA bins` | Abbreviation users type |
| `verge collection` | Unique feature — low competition |

*Do NOT include "Bin Mate" or "BinMate" in keywords — Apple ignores the app name in keyword field.*

---

## App Review Notes
*(Shown only to the App Review team — plain text)*

```
BinMate provides Perth, Western Australia council bin collection schedules
and reminders.

TEST ADDRESS
Use any Perth, WA residential address. Suggested:
  45 Scarborough Beach Road, Scarborough WA 6019
  (City of Stirling — largest council, most common use case)

TEST FLOW
1. Enter the address above on the onboarding screen
2. Tap "Find my council" — council and schedule load automatically
3. Tap "That's me" to confirm
4. Optionally enable push notifications (can be skipped)
5. Home screen shows upcoming collection schedule

SUBSCRIPTION TESTING
Both plans ($1.49/month, $9.99/year) include a 7-day free trial.
Use the StoreKit sandbox environment — no charge will occur.
Restore purchases works in sandbox via the Settings screen.

FREE TIER RESTRICTIONS (visible during review)
• Schedule preview limited to 7 days (Calendar tab locks beyond this)
• Push notifications locked — shown in Settings with Premium badge
• Second address locked — shown in Settings with Premium badge

NOTES
• App is Perth, WA specific. Non-Perth addresses show a clear error.
• No account or sign-in required at any point.
• No location permission requested (address typed manually).
• Notification permission only requested on onboarding Step 3 — can be skipped.
```

---

## Screenshots Plan
*(6 screens — iPhone 6.7" primary, 6.1" secondary)*

| # | Screen | Caption |
|---|---|---|
| 1 | Home — "Bins out tonight" hero card | "Know the night before, every time." |
| 2 | Home — upcoming schedule list | "Red lid. Yellow lid. Green lid. All sorted." |
| 3 | Calendar — public holiday shift | "Public holidays? Already handled." |
| 4 | Home — verge collection amber row | "Verge day. Sorted." |
| 5 | Onboarding — address entry | "30 seconds to set up." |
| 6 | Calendar — full year view | "The whole year, at a glance." |

Screenshot dimensions:
- iPhone 6.7" (iPhone 15 Pro Max): 1290 × 2796 px
- iPhone 6.1" (iPhone 15): 1179 × 2556 px

---

## Privacy Nutrition Label (App Store)
*(Data collected — fill in App Store Connect)*

| Data type | Collected | Linked to identity | Used for tracking |
|---|---|---|---|
| Device ID | Yes (push token) | No | No |
| Location | No | — | — |
| Contact info | No | — | — |
| Identifiers | Yes (UUID — anonymous) | No | No |

**Privacy policy URL:** `https://binmate.app/privacy`
**Support URL:** `https://binmate.app/support`

---

*Last updated: March 2026 — v1.0 pre-submission*
