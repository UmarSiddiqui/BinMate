# BinMate — AI Agent Rules
> This file is read automatically by Codex, Cursor, and Codex at session start.
> Every rule here is non-negotiable. Do not deviate without explicit instruction from the developer.

---

## 1. Project Identity

| Field | Value |
|---|---|
| **Product name** | BinMate |
| **Tagline** | Never miss a bin day again. |
| **Platform** | iOS (SwiftUI) — iPhone primary, iPad secondary |
| **Market** | Perth, Western Australia — 30 local government councils |
| **Developer** | Umar Siddiqui — UMAZEN |
| **Repo root** | `/BinMate` |
| **Status** | Pre-build — greenfield |

---

## 2. Tech Stack — Source of Truth

Always use these. Never suggest alternatives without being asked.

### iOS App
- **Language:** Swift 5.9+
- **UI Framework:** SwiftUI (no UIKit unless absolutely unavoidable)
- **Minimum iOS:** 16.0
- **Architecture:** MVVM + Repository pattern
- **Networking:** URLSession with async/await (no Alamofire)
- **Local storage:** CoreData for schedule cache; UserDefaults for preferences only
- **Push notifications:** Apple Push Notification Service (APNs) via UserNotifications framework
- **Payments:** StoreKit 2 (native) + RevenueCat SDK (`purchases-ios`)
- **Widgets:** WidgetKit (iOS 14+)
- **Maps/geocoding:** MapKit + CoreLocation (no Google Maps SDK in app)
- **Analytics:** None at launch — privacy-first

### Backend
- **Runtime:** Node.js 20+ (preferred) or Python 3.11+ FastAPI
- **Database:** PostgreSQL 15+ with PostGIS extension
- **ORM:** Prisma (Node) or SQLAlchemy (Python) — keep it consistent once chosen
- **Hosting:** Render.app
- **Push dispatch:** Firebase Admin SDK (FCM)
- **Geocoding (server-side):** Google Maps Geocoding API
- **Subscription validation:** RevenueCat webhooks
- **Scheduling:** Node-cron or APScheduler — nightly at 17:00 AWST (UTC+8)

### Infrastructure
- **Database host:** Supabase (managed Postgres)
- **Secrets:** Environment variables only — never hardcoded
- **CI:** GitHub Actions
- **Error tracking:** Sentry (both iOS and backend)

---

## 3. Project File Structure

Maintain this structure exactly. Do not reorganise without instruction.

```
BinMate/
├── ios/                          # Xcode project
│   ├── BinMate/
│   │   ├── App/
│   │   │   ├── BinMateApp.swift
│   │   │   └── AppDelegate.swift
│   │   ├── Core/
│   │   │   ├── Models/           # Data models (Council, Zone, Collection, etc.)
│   │   │   ├── Services/         # API client, notification service, location service
│   │   │   ├── Repositories/     # CoreData + API data access
│   │   │   └── Extensions/       # Swift extensions
│   │   ├── Features/
│   │   │   ├── Onboarding/       # Address setup flow
│   │   │   ├── Home/             # Today view, upcoming schedule
│   │   │   ├── Calendar/         # Full year calendar view
│   │   │   ├── Settings/         # Notifications, address, subscription
│   │   │   ├── BinGuide/         # What goes in which bin
│   │   │   └── Paywall/          # Subscription screen
│   │   ├── UI/
│   │   │   ├── Components/       # Reusable SwiftUI views
│   │   │   ├── Theme/            # BinMateTheme.swift (colours, fonts, spacing)
│   │   │   └── Modifiers/        # Custom ViewModifiers
│   │   ├── Widget/               # WidgetKit extension
│   │   └── Resources/
│   │       ├── Assets.xcassets
│   │       └── Localizable.strings
│   └── BinMateTests/
│
├── backend/
│   ├── src/
│   │   ├── routes/               # API route handlers
│   │   ├── services/             # Business logic
│   │   ├── repositories/         # Database access
│   │   ├── scrapers/             # Council data scrapers (one file per council)
│   │   │   ├── base/             # BaseScraper class/interface
│   │   │   ├── pdf/              # PDF-based scrapers
│   │   │   ├── arcgis/           # ArcGIS REST scrapers
│   │   │   ├── widget/           # Address widget scrapers
│   │   │   └── platform/         # T1Cloud, Salesforce scrapers
│   │   ├── jobs/                 # Cron jobs (notification engine, schedule refresh)
│   │   ├── models/               # Database schema / Prisma schema
│   │   └── utils/
│   ├── tests/
│   ├── prisma/schema.prisma
│   ├── .env.example
│   └── package.json
│
├── docs/
│   ├── AGENTS.md                 # This file — AI agent rules
│   ├── BRAND.md                  # Brand tokens for AI agents
│   ├── PLAN.md                   # Full project plan
│   ├── API.md                    # API endpoint documentation
│   └── COUNCILS.md               # Council data source registry
│
└── README.md
```

---

## 4. Coding Standards

### Swift / SwiftUI

```swift
// ✅ ALWAYS: async/await for all async operations
func fetchSchedule(for zoneId: String) async throws -> [Collection] { }

// ✅ ALWAYS: @MainActor on ViewModels
@MainActor
final class HomeViewModel: ObservableObject { }

// ✅ ALWAYS: Dependency injection via init
final class HomeViewModel: ObservableObject {
    private let scheduleRepository: ScheduleRepositoryProtocol
    init(scheduleRepository: ScheduleRepositoryProtocol = ScheduleRepository()) { }
}

// ✅ ALWAYS: Protocol-first for testability
protocol ScheduleRepositoryProtocol {
    func upcoming(for zoneId: String) async throws -> [Collection]
}

// ✅ ALWAYS: Use BinMateTheme for all values — never hardcode colours or spacing
Text("Bins out tonight")
    .font(BinMateTheme.Typography.heading1)
    .foregroundColor(BinMateTheme.Colors.textPrimary)

// ❌ NEVER: hardcode hex values in views
Text("Bins out tonight")
    .foregroundColor(Color(hex: "#F0F2F5")) // BAD

// ❌ NEVER: UIKit in new files
import UIKit // BAD in new SwiftUI files

// ❌ NEVER: Force unwrap
let date = formatter.date(from: string)! // BAD — use guard let or if let

// ❌ NEVER: print() in production code — use os_log or Logger
print("Debug info") // BAD
Logger.app.debug("Debug info") // GOOD
```

### Naming Conventions (Swift)
- Types: `PascalCase` — `CollectionSchedule`, `BinType`, `CouncilZone`
- Variables/functions: `camelCase` — `nextCollectionDate`, `fetchUpcoming()`
- Constants: `camelCase` — `static let defaultNotificationHour = 18`
- Files: match type name — `CollectionSchedule.swift`
- View files: suffix with `View` — `HomeView.swift`, `PaywallView.swift`
- ViewModel files: suffix with `ViewModel` — `HomeViewModel.swift`
- Test files: suffix with `Tests` — `HomeViewModelTests.swift`

### TypeScript / Node.js (backend)

```typescript
// ✅ ALWAYS: async/await, never callbacks
const zone = await zoneRepository.findByAddress(address);

// ✅ ALWAYS: typed interfaces for all data structures
interface CollectionSchedule {
  zoneId: string;
  collectionDay: DayOfWeek;
  generalWasteWeekly: boolean;
  recyclingWeek: 'A' | 'B';
  greenWasteWeek: 'A' | 'B' | null;
}

// ✅ ALWAYS: environment variables via process.env with validation at startup
const FCM_KEY = process.env.FCM_SERVICE_ACCOUNT_KEY;
if (!FCM_KEY) throw new Error('FCM_SERVICE_ACCOUNT_KEY is required');

// ✅ ALWAYS: try/catch on all async route handlers
app.post('/register-address', async (req, res) => {
  try {
    const result = await addressService.register(req.body);
    res.json(result);
  } catch (err) {
    logger.error('register-address failed', { err, body: req.body });
    res.status(500).json({ error: 'Failed to register address' });
  }
});

// ❌ NEVER: any type
const data: any = response.data; // BAD

// ❌ NEVER: console.log in production routes — use the logger
console.log('registered'); // BAD
logger.info('address registered', { zoneId }); // GOOD
```

### General Rules (all files)
- Maximum file length: **300 lines**. If a file exceeds this, split it.
- Maximum function length: **40 lines**. Extract helpers if longer.
- No magic numbers — every numeric constant needs a named constant or comment.
- Every public function needs a one-line doc comment (`///` in Swift, `/** */` in TS).
- Every API endpoint must have a corresponding test.
- Every scraper must have a test against a known address.

---

## 5. Database Schema Rules

### Core Tables (do not alter names without updating all references)

```sql
-- Councils: one row per Perth LGA
councils (id, name, slug, platform_type, api_endpoint, last_scraped_at, is_active)

-- Collection zones: one row per distinct collection rule
collection_zones (
  id, council_id, zone_name, zone_code,
  general_day,           -- 'monday'|'tuesday'|...'friday'
  general_frequency,     -- 'weekly'
  recycling_day,
  recycling_week,        -- 'A'|'B'
  green_waste_day,
  green_waste_week,      -- 'A'|'B'|null
  verge_dates,           -- jsonb array of specific dates
  created_at, updated_at
)

-- Address cache: resolved address → zone mapping
address_cache (
  id, address_string, lat, lng,
  council_id, zone_id,
  cached_at, expires_at
)

-- Users: minimal — privacy first
users (
  id,                    -- UUID, never sequential integer
  push_token,
  notification_hour,     -- 0-23, default 18 (6pm AWST)
  created_at,
  subscription_status    -- 'free'|'trial'|'active'|'expired'
)

-- User zones: which zones a user is subscribed to
user_zones (
  user_id, zone_id, address_label,
  is_primary, created_at
)

-- WA public holidays
wa_public_holidays (
  id, name, date, shift_days  -- shift_days always 1 (next day)
)
```

### Database Rules
- Never store raw addresses against a user ID — only zone IDs.
- UUID primary keys everywhere (never auto-increment integers exposed to clients).
- All timestamps in UTC. Display layer converts to AWST.
- `deleted_at` soft-delete pattern — never hard-delete user records.
- Index: `address_cache(address_string)`, `user_zones(zone_id)`, `collection_zones(council_id)`.

---

## 6. API Contract

All endpoints return JSON. All errors return `{ "error": "message" }`.

```
POST /api/v1/register-address
  Body: { address: string, pushToken?: string }
  Response: { zoneId: string, councilName: string, nextCollections: Collection[] }

GET /api/v1/schedule
  Query: zoneId, from (ISO date), count (default 20)
  Response: { collections: Collection[] }

PUT /api/v1/push-token
  Body: { userId: string, pushToken: string, notificationHour?: number }
  Response: { ok: true }

POST /api/v1/webhook/revenuecat
  Body: RevenueCat webhook payload
  Response: { ok: true }

GET /api/v1/health
  Response: { status: "ok", version: string, db: "ok"|"error" }
```

### Collection object shape
```typescript
interface Collection {
  date: string;           // ISO 8601 date "2026-03-19"
  dayOfWeek: string;      // "Wednesday"
  types: BinType[];       // ["general", "recycling"]
  isHolidayShifted: boolean;
  originalDate?: string;  // set if shifted from a public holiday
  eventType: 'kerbside' | 'verge' | 'ewaste' | 'green_waste_drop';
}

type BinType = 'general' | 'recycling' | 'green_waste';
```

---

## 7. Scraper Rules

Every council scraper must implement this interface:

```typescript
interface CouncilScraper {
  councilId: string;
  councilName: string;
  
  // Returns zone ID for a given address
  resolveAddress(address: string): Promise<ZoneResolution>;
  
  // Returns full schedule for a zone (annual refresh)
  fetchSchedule(zoneId: string): Promise<ZoneSchedule>;
  
  // Returns true if the scraper is working against live council data
  healthCheck(): Promise<boolean>;
}
```

### Scraper Rules
- Each scraper lives in its own file: `backend/src/scrapers/{councilSlug}.ts`
- Every scraper has a test: `backend/tests/scrapers/{councilSlug}.test.ts`
- Test must use a real Perth address (hardcoded in test file, comment explaining it was chosen)
- Scrapers must not throw — catch errors and return them in `ZoneResolution.error`
- Rate limiting: max 1 request/second to council endpoints
- Set a proper User-Agent: `BinMate/1.0 (Perth bin reminder app; contact@binmate.app)`
- Never run scrapers in production during council business hours (9am–5pm AWST) for address resolution — use cached results only

---

## 8. Notification Rules

The notification cron runs nightly at **17:00 AWST (09:00 UTC)**.

### Notification logic (do not change without discussion)
1. Find all zones that have a collection the following day
2. Apply WA public holiday shift check
3. For each zone, batch-send APNs push to all `user_zones` records
4. Log send count, failures, and zone breakdown to Sentry
5. Never send more than one notification per user per day
6. Respect `notification_hour` per user — batch into hourly sends if needed

### Notification copy (do not modify — use BRAND.md copy library)
See `docs/BRAND.md` Section 7 for all approved notification titles and bodies.

---

## 9. Privacy & Security Rules

These are hard constraints. Do not work around them.

- **No user address stored against a user ID.** Only `zone_id` in `user_zones`.
- **No analytics SDK** in the iOS app at v1.0.
- **No tracking pixels** or third-party network requests from the app.
- **No PII in logs.** Never log addresses, push tokens, or user IDs in plaintext logs.
- **All API requests must be HTTPS.** Reject HTTP in production.
- **Push tokens treated as sensitive.** Stored encrypted in database.
- **RevenueCat handles all payment data.** Never store card details or Apple receipt data directly.
- **App Tracking Transparency:** Not required at v1.0 (no tracking). Do not add ATT prompt.
- **Privacy nutrition label (App Store):** Data types collected — Device ID (for push), Approximate Location (for council detection). No linked data to identity.

---

## 10. SwiftUI Theme Reference

**Always import and use `BinMateTheme`. Never hardcode values.**

```swift
// BinMateTheme.swift lives at ios/BinMate/UI/Theme/BinMateTheme.swift
// Full token list in docs/BRAND.md

// Usage examples:
BinMateTheme.Colors.lime          // #B8F04A — primary action
BinMateTheme.Colors.bgBase        // #0D0F12 — app background
BinMateTheme.Colors.textPrimary   // #F0F2F5 — primary text
BinMateTheme.Spacing.md           // 16pt
BinMateTheme.Radius.card          // 22pt
BinMateTheme.Typography.display   // Syne 32pt bold
BinMateTheme.Typography.body      // DM Sans 15pt regular
```

---

## 11. Error Handling Patterns

```swift
// iOS — ViewModel error handling pattern
@MainActor
final class HomeViewModel: ObservableObject {
    @Published var collections: [Collection] = []
    @Published var error: BinMateError? = nil
    @Published var isLoading = false

    func loadSchedule() async {
        isLoading = true
        defer { isLoading = false }
        do {
            collections = try await repository.upcoming(zoneId: zoneId)
        } catch let err as BinMateError {
            error = err
        } catch {
            self.error = .unknown(error)
        }
    }
}

// Custom error type — use this, not raw Error
enum BinMateError: LocalizedError {
    case networkUnavailable
    case addressNotFound
    case councilUnsupported(String)
    case scheduleUnavailable
    case unknown(Error)
    
    var errorDescription: String? {
        switch self {
        case .networkUnavailable: return "No internet connection"
        case .addressNotFound: return "Couldn't find that address"
        case .councilUnsupported(let name): return "\(name) isn't supported yet"
        case .scheduleUnavailable: return "Schedule temporarily unavailable"
        case .unknown: return "Something went wrong"
        }
    }
}
```

---

## 12. Testing Requirements

- **iOS:** XCTest for unit tests, XCUITest for critical flows only (setup, paywall)
- **Backend:** Jest (Node) or pytest (Python)
- **Minimum coverage before PR merge:** 70% on services and repositories
- **Every scraper:** must have a passing test against a live council address before merging
- **Notification cron:** must have a unit test with mocked date scenarios including public holidays
- **No test should hit production APIs** — use fixtures or mocked HTTP responses

---

## 13. Git & Commit Rules

```
feat(home): add upcoming schedule list view
fix(scraper): correct Wanneroo week B rotation offset
chore(deps): update RevenueCat SDK to 4.38.0
test(scraper): add Armadale address resolution test
refactor(notifications): extract holiday shift logic to utility
docs(api): add /schedule endpoint documentation
```

- Branch naming: `feat/home-screen`, `fix/stirling-scraper`, `chore/deps-update`
- Never commit: `.env` files, API keys, push certificates, Xcode derived data
- Always commit: `.env.example` with all required keys (values empty)
- PR title must match commit message format
- No force push to `main`

---

## 14. What AI Agents Must NOT Do

These are absolute prohibitions. If a task seems to require these, stop and ask.

- ❌ Do not add any third-party analytics (Mixpanel, Amplitude, Firebase Analytics, etc.)
- ❌ Do not add any advertising SDKs
- ❌ Do not store user addresses in the database linked to a user identity
- ❌ Do not use UIKit for new views — SwiftUI only
- ❌ Do not hardcode API keys, URLs, or secrets in source files
- ❌ Do not change the pricing model ($1.49/month, $9.99/year) without explicit instruction
- ❌ Do not add notification copy that isn't in BRAND.md Section 7
- ❌ Do not rename or restructure the file layout in Section 3
- ❌ Do not add Android support without explicit instruction
- ❌ Do not introduce a dependency without adding it to the relevant package file and noting why
- ❌ Do not implement any feature that stores or transmits PII beyond what's listed in Section 9

---

## 15. Handoff Checklist (before switching AI tools)

When switching between Codex → Cursor → Codex, always leave a `HANDOFF.md` in the repo root with:

```markdown
## Handoff — [Date] [Time AWST]
**From:** Codex / Cursor / Codex
**Completed in this session:**
- [list what was built]

**Files modified:**
- [list files changed]

**Currently broken / in progress:**
- [list anything not working]

**Next task:**
- [exact description of what the next agent should do]

**Known issues:**
- [anything the next agent needs to be aware of]
```

---

*Last updated: March 2026 — BinMate v1.0 pre-build*
*Owner: Umar Siddiqui — UMAZEN, Perth WA*
