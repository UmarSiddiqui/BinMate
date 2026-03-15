# BinMate — Full Project Build Plan
> Living document. Update task status as work progresses.
> Read CLAUDE.md before starting any session. Read BRAND.md before writing any UI code.

---

## Status Legend
- `[ ]` Not started
- `[~]` In progress
- `[x]` Complete
- `[!]` Blocked — see notes

---

## Recommended Agents, MCP Servers & Skills

> **MCP Servers** — install via: `npx -y @smithery/cli install <package> --client claude`
> **aitmpl.com Skills** — install via: `npx claude-code-templates@latest` then browse to skill
> **Claude Code Skills** ✅ — already loaded, invoke via `/skill-name`, no install needed

---

### MCP Servers (by phase)

| Phase | MCP Server | Purpose | Install |
|---|---|---|---|
| 0 — Repo & GitHub | GitHub MCP | Create repo, branches, PRs from Claude | `@smithery-ai/github` |
| 1.1 — Council audit | Playwright MCP | Open council pages, intercept XHR/API calls via browser automation | [`@adalovu/mcp-playwright`](https://smithery.ai/server/@adalovu/mcp-playwright) |
| 1.x — Tier 2 scrapers | Firecrawl MCP | Scrape council pages to clean markdown/JSON | [`@mendableai/mcp-server-firecrawl`](https://github.com/firecrawl/firecrawl-mcp-server) |
| 1.x — Salesforce/T1Cloud | Hyperbrowser MCP | Cloud browser fallback for anti-bot councils | [`@mfengzhishang/mcp`](https://smithery.ai/server/@mfengzhishang/mcp) |
| 1.2 — Database | Supabase MCP | Run migrations, browse zones, seed holidays, inspect cache | [`@supabase-community/supabase-mcp`](https://smithery.ai/server/@supabase-community/supabase-mcp) |
| 3 — iOS build/test | XcodeBuildMCP | Build targets, boot simulators, run XCTest from Claude | [`@cameroncooke/XcodeBuildMCP`](https://smithery.ai/servers/@cameroncooke/XcodeBuildMCP) |
| 3 — iOS API docs | Apple Docs MCP | Search SwiftUI/StoreKit 2/WidgetKit/APNs docs inline | [`apple-docs-mcp`](https://github.com/kimsungwhee/apple-docs-mcp) |

**Priority install order (before starting Phase 1):**
1. **Playwright MCP** — council auditing is Phase 1's biggest unknown; this makes it visual and fast
2. **Supabase MCP** — used every single day from Phase 1.2 onwards
3. **XcodeBuildMCP** — essential for Phase 3, install early to stay familiar with it

---

### aitmpl.com Skills (by phase)
> Browse and install at [aitmpl.com/skills](https://www.aitmpl.com/skills)

#### Phase 0 & Architecture
| Skill | Use |
|---|---|
| **Senior Architect** | System design, dependency analysis, architecture diagrams before building any phase |

#### Phase 2.5 — Admin Dashboard
| Skill | Use |
|---|---|
| **UI/UX Pro Max** ✅ | Admin dashboard design — dark mode, data tables, status cards, chart layouts |
| **Senior Frontend** | React SPA scaffolding, bundle optimisation, component generation for admin panel |
| **React Best Practices** | 45 rules across 8 categories — apply during admin dashboard code review |

#### Phase 3 — iOS App (SwiftUI)
> These come from the [swift-ios-skills](https://github.com/dpearson2699/swift-ios-skills) collection (56 skills for Swift/SwiftUI)

| Skill | Phase 3 Task |
|---|---|
| **swiftui-patterns** | Core SwiftUI architecture patterns throughout the app |
| **swiftui-navigation** | Onboarding flow (3-step), tab bar, deeplink handling (§3.1, §3.2) |
| **swiftui-layout-components** | HeroCollectionCard, UpcomingScheduleList, BinGuide tabs (§3.3, §3.6) |
| **swift-concurrency** | All async/await patterns — `@MainActor` ViewModels, structured concurrency (§4 coding standards) |
| **ios-networking** | `BinMateAPI.swift` — URLSession wrapper, error handling, retry logic (§3.1) |
| **ios-security** | `KeychainService.swift` — push token + user ID storage (§3.1) |
| **storekit** | `PaywallView.swift` + `EntitlementService.swift` — StoreKit 2 / RevenueCat (§3.7, §3.8) |
| **push-notifications** | `NotificationService.swift` — APNs permission, token registration, deeplink on tap (§3.1) |
| **widgetkit** | `BinMateWidget` — small/medium sizes, timeline provider, AppGroup sharing (§3.9) |
| **mapkit-location** | Address autocomplete in `AddressEntryView.swift` (§3.2) |
| **swiftdata** | CoreData entities: `CollectionEntity`, `ZoneEntity`, `CouncilEntity` (§3.1) |
| **swift-testing** | XCTest + Swift Testing for ViewModels, repositories, notification cron (§12) |
| **ios-accessibility** | VoiceOver labels, Dynamic Type, Reduce Motion pass (§3.10) |
| **app-store-review** | App Store submission checklist, review notes, screenshot strategy (§4.3) |

#### Phase 2.2 — Notifications Cron
| Skill | Use |
|---|---|
| **Schedule Skill** ✅ | Set up the nightly 17:00 AWST cron job as a scheduled task |

#### Phase 1.3 — PDF Scrapers
| Skill | Use |
|---|---|
| **PDF Skill** ✅ | Extract tables from Wanneroo/council PDF calendars directly in Claude |

---

### Quick Reference — All Skills by Install Method

| How to get it | Skills |
|---|---|
| ✅ Already in Claude Code | PDF, Schedule, UI/UX Pro Max, Frontend Design, Skill Creator |
| [aitmpl.com/skills](https://www.aitmpl.com/skills) | Senior Architect, Senior Frontend, React Best Practices |
| [swift-ios-skills](https://github.com/dpearson2699/swift-ios-skills) | swiftui-patterns, swiftui-navigation, swiftui-layout-components, swift-concurrency, ios-networking, ios-security, storekit, push-notifications, widgetkit, mapkit-location, swiftdata, swift-testing, ios-accessibility, app-store-review |
| Smithery (`npx @smithery/cli install`) | GitHub MCP, Playwright MCP, Firecrawl MCP, Hyperbrowser MCP, Supabase MCP, XcodeBuildMCP, Apple Docs MCP |

---

## Phase 0 — Project Setup
**Goal:** Repo, tools, environments all working before a single feature is built.
**Estimated time:** 1–2 days

### 0.1 Repository
- [ ] Create GitHub repo: `binmate-app`
- [ ] Create `main`, `develop`, `staging` branches
- [x] Add `.gitignore` for Xcode, Node, Python, `.env`
- [ ] Add `README.md` with project overview
- [ ] Copy `CLAUDE.md`, `BRAND.md`, `PLAN.md` into `docs/`
- [ ] Create `.cursorrules` file (symlink or copy of `CLAUDE.md` for Cursor)
- [x] Create `.env.example` with all required keys (values empty)

### 0.2 iOS Project
- [x] Create Xcode project: `BinMate`, SwiftUI — bundle ID `app.binmate.ios`
- [~] iOS deployment target set (currently 26.2 in Xcode — needs lowering to 16.0)
- [ ] Configure signing (personal team for dev, paid team for TestFlight)
- [x] Create folder structure as per `CLAUDE.md` Section 3
- [x] Add `BinMateTheme.swift` with all tokens from `BRAND.md`
- [x] Add `Logger+BinMate.swift` (os_log setup)
- [x] Add `BinMateError.swift` (error enum)
- [x] `BinMateApp.swift`, `AppState.swift`, `Configuration.swift` created
- [x] `EntitlementService.swift`, `PaywallView.swift`, `SettingsView.swift` created
- [x] RevenueCat SPM package added (`RevenueCat` + `RevenueCatUI`)
- [x] Verify build succeeds on simulator — **Build Succeeded ✅**

### 0.3 Backend Project
- [x] `npm init` + all dependencies installed
- [x] `tsconfig.json` created (strict, ES2022, CommonJS)
- [x] `prisma/schema.prisma` — all 6 models from `CLAUDE.md` §5
- [x] Initial migration applied to Supabase: `20260315152437_init` ✅
- [x] All 6 tables live in Supabase (PostgreSQL, Tokyo region)
- [x] `src/index.ts` — Express server, `GET /api/v1/health` → `{"status":"ok"}` ✅
- [x] `src/utils/logger.ts` — Winston structured logger
- [x] `src/services/geocoding.ts` — Nominatim (free, no key) with 1.1s rate limit
- [x] `src/services/notifications.ts` — mocked (TODO: real APNs later)
- [x] `render.yaml` — Render deployment blueprint created

### 0.4 External Services — Accounts & Keys
- [ ] Apple Developer account ($149 AUD/year) — deferred until app is ready for TestFlight
- [~] RevenueCat account — test key `test_oPScHsCPlTsGZedsKOJpkWVRXhn` integrated in app; dashboard products not yet configured
- [!] Firebase / FCM — **mocked** (TODO: implement direct APNs instead of FCM — see Decision Log)
- [x] Geocoding — **Nominatim** (free, no API key needed — replaces Google Maps)
- [ ] Sentry iOS — run: `brew install getsentry/tools/sentry-wizard && sentry-wizard -i ios --saas --org umazen --project apple-ios`
- [ ] Sentry backend — DSN to be added to `.env`
- [x] Supabase — project `kpjhpxtegrieuknqulpo` (Tokyo), connected via pooler, migrations applied ✅
- [ ] Render — `render.yaml` ready; deploy after GitHub repo created
- [x] All keys in `backend/.env` (not committed) and `backend/.env.example`

### 0.5 RevenueCat Setup
- [ ] Create product in App Store Connect: `binmate_monthly` ($1.49 AUD/month) — needs paid Apple Dev account
- [ ] Create product in App Store Connect: `binmate_annual` ($9.99 AUD/year)
- [ ] Create subscription group: `BinMate Premium`
- [ ] Add 7-day free trial to both products
- [ ] Add products to RevenueCat dashboard
- [ ] Create entitlement: `Bin Mate Pro` (already hardcoded in `EntitlementService.swift`)
- [ ] Create offering: `default` with both packages

---

## Phase 1 — Data Foundation
**Goal:** Backend can take a Perth address and return a correct collection schedule.
**Estimated time:** 3–4 weeks
**AI tool recommendation:** Claude Code (complex scraper logic benefits from context retention)

### 1.1 Council Audit (do this manually before any code)
For each of the priority 9 councils, open the bin lookup page, open DevTools → Network → XHR, enter a test address, and document:
- The exact URL being called
- The request method (GET/POST)
- The request payload structure
- The response structure
- Whether cookies/CSRF are needed
- Platform (ArcGIS / T1Cloud / Salesforce / custom)

**Priority order (by population + implementation ease):**
- [x] City of Wanneroo — PDF + static zone map (no public API)
- [ ] City of Armadale — `my.armadale.wa.gov.au/service/waste-and-recycling/find-your-bin-collection-day/`
- [ ] City of Fremantle — `fremantle.wa.gov.au/waste-and-environment/residential-waste/bin-collection/`
- [ ] City of Cockburn — `cockburn.wa.gov.au/Environment-and-Waste/Rubbish-Waste-and-Recycling/Bin-Collections`
- [ ] City of Melville — audit URL
- [ ] City of Canning — `canning.wa.gov.au/residents/waste-and-recycling/bins-and-collection-days/`
- [ ] City of Swan — audit URL
- [ ] City of South Perth — `cosp.t1cloud.com` — T1Cloud
- [ ] City of Stirling — `stirling.wa.gov.au/waste-and-environment/waste-and-recycling/bin-collections` — Salesforce

Document findings in `docs/COUNCILS.md`.

### 1.2 Database & Schema
- [x] Initial Prisma migration applied to Supabase (`20260315152437_init`) ✅
- [x] `src/scrapers/base/types.ts` — `CouncilScraper` interface + `ZoneResolution`, `ZoneScheduleData` types
- [ ] Seed `wa_public_holidays` table for 2026 and 2027
- [ ] Write `zoneScheduleComputer.ts` — takes zone record + date, returns next N collections
- [ ] Write unit tests for `zoneScheduleComputer` including:
  - [ ] Normal week (no holiday)
  - [ ] Collection on WA public holiday (should shift +1 day)
  - [ ] Week A / Week B rotation over 12 months
  - [ ] Year boundary (Dec 31 → Jan 1)
  - [ ] Council with no green waste

### 1.3 Scrapers — Tier 3 (PDF — easiest, start here)

#### City of Wanneroo ✅
- [x] `src/scrapers/wanneroo.ts` — static suburb→zone map (30 suburbs, 9 zones, PDF-derived)
  - Approach: Nominatim geocodes address → suburb name → static zone lookup
  - General: weekly; Recycling + Green waste: fortnightly opposite weeks
  - TODO (Phase 2): auto-refresh recycling week offset from iCal each January
- [x] `tests/scrapers/wanneroo.test.ts` — **9/9 tests passing** ✅
  - Girrawheen → MON-A, Clarkson → WED-A, Sinagra → FRI-A, Fremantle → error
- [x] `prisma/seed-wanneroo.ts` — all 9 zones seeded into Supabase ✅
- [x] Council row in `councils` table: `e6d72c4e-32d9-441b-a4e6-d7a5dc6476e3`

#### City of Armadale (open-source scraper — adapt from HACS)
- [ ] Clone relevant code from `github.com/mampfes/hacs_waste_collection_schedule`
  - File: `custom_components/waste_collection_schedule/source/armadale_wa_gov_au.py`
- [ ] Port to TypeScript (or run as Python subprocess if faster)
- [ ] Write `armadale.ts` scraper
- [ ] Write test: `tests/scrapers/armadale.test.ts`
  - Test address: "23 Sexty St, Armadale WA 6112"
  - Test address: "270 Skeet Rd, Harrisdale WA 6112"
- [ ] Seed Armadale zones into database

#### Smaller councils (PDF/iCal — batch these together)
- [ ] City of Nedlands — identify data source, build scraper
- [ ] Town of Claremont — identify data source, build scraper
- [ ] Town of Cottesloe — identify data source, build scraper
- [ ] Town of Mosman Park — identify data source, build scraper
- [ ] City of Subiaco — identify data source, build scraper
- [ ] Town of Cambridge — identify data source, build scraper
- [ ] Each needs test with a real address

### 1.4 Scrapers — Tier 1 (ArcGIS)

#### City of Fremantle
- [ ] Identify ArcGIS layer ID from `fremantle.wa.gov.au`
- [ ] Write `fremantle.ts` scraper — query by lat/lng point
- [ ] Write test: `tests/scrapers/fremantle.test.ts`
  - Test address: "15 South Tce, Fremantle WA 6160"
- [ ] Seed Fremantle zones

#### City of Cockburn
- [ ] Same as Fremantle — ArcGIS approach
- [ ] Write `cockburn.ts` scraper and test
- [ ] Seed Cockburn zones

#### City of Melville
- [ ] Same approach — write `melville.ts` scraper and test
- [ ] Seed Melville zones

### 1.5 Scrapers — Tier 2 (Address widget reverse-engineering)

#### City of Canning
- [ ] DevTools audit complete (see §1.1)
- [ ] Write `canning.ts` scraper against discovered endpoint
- [ ] Test: `tests/scrapers/canning.test.ts`
  - Test address: "1 Manning Rd, Cannington WA 6107"
- [ ] Seed Canning zones

#### City of Swan
- [ ] DevTools audit complete
- [ ] Write `swan.ts` scraper
- [ ] Test with real address in Middle Swan / Ellenbrook
- [ ] Seed Swan zones

### 1.6 Scrapers — Tier 4 (Platform APIs — hardest)

#### City of South Perth (T1Cloud)
- [ ] DevTools audit of `cosp.t1cloud.com` address lookup
- [ ] Reverse-engineer T1Cloud API endpoint
- [ ] Write `southperth.ts` scraper
- [ ] Test with real South Perth address
- [ ] Document T1Cloud pattern in `docs/COUNCILS.md` — may reuse for other T1Cloud councils

#### City of Stirling (Salesforce)
- [ ] DevTools audit of `stirling.my.site.com` address lookup
- [ ] Reverse-engineer Salesforce Experience Cloud API
- [ ] Write `stirling.ts` scraper
- [ ] Test: "45 Scarborough Beach Rd, Scarborough WA 6019"
- [ ] Seed Stirling zones (this is the largest council — 220k residents)
- **Note:** If Salesforce API is too locked down, fall back to PDF calendars (Week 1/Week 2 published on their site)

### 1.7 Address Resolution Service
- [ ] `AddressService.resolveAddress(address: string): Promise<ZoneResolution>`
- [ ] Geocode address using Google Maps API → lat/lng + suburb
- [ ] Check `address_cache` first — return cached result if < 30 days old
- [ ] Determine council from geocoded suburb
- [ ] Run council-specific scraper to get zone ID
- [ ] Cache result in `address_cache`
- [ ] Return zone ID + council name + next 10 collections
- [ ] Write integration test with 10 real Perth addresses across 5 councils

---

## Phase 2 — Backend API
**Goal:** Deployed API that accepts addresses and schedules push notifications.
**Estimated time:** 1.5 weeks
**AI tool recommendation:** Cursor (good for iterating on route handlers and tests)

### 2.1 API Routes
- [ ] `POST /api/v1/register-address` — register address, return zone + schedule
- [ ] `GET /api/v1/schedule` — get upcoming collections for a zone
- [ ] `PUT /api/v1/push-token` — store/update APNs push token
- [ ] `POST /api/v1/webhook/revenuecat` — handle subscription events
- [ ] `GET /api/v1/health` — health check endpoint
- [ ] Request validation with Zod on all POST/PUT endpoints
- [ ] Error middleware — consistent `{ error: string }` responses
- [ ] Rate limiting — 10 req/min per IP on `/register-address`

### 2.2 Notification Engine
- [ ] `NotificationService` class wrapping Firebase Admin SDK
- [ ] `sendBinReminderPush(userId, collection)` — formats and sends APNs notification
- [ ] Notification copy pulled from constants file mirroring `BRAND.md` Section 7
- [ ] `jobs/nightly-notifications.ts` — runs at 17:00 AWST (triggered via external cron; see 2.4)
  - [ ] Find all zones with tomorrow's collection
  - [ ] Apply public holiday shift check
  - [ ] Batch send per zone (FCM topic or individual tokens)
  - [ ] Log results to Sentry
  - [ ] Test: mock tomorrow = Good Friday → shift check fires correctly
- [ ] `POST /api/v1/cron/trigger-notifications` — protected by `CRON_SECRET` header; invokes nightly job (for Render free tier: external cron triggers this since node-cron can't run when service is spun down)

### 2.3 RevenueCat Webhook Handler
- [ ] `POST /api/v1/webhook/revenuecat`
- [ ] Validate RevenueCat webhook signature
- [ ] Handle events: `INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION`, `EXPIRATION`, `BILLING_ISSUE`
- [ ] Update `users.subscription_status` accordingly
- [ ] Log all webhook events

### 2.4 Deployment
- [ ] Deploy to Render — `render.yaml` blueprint, environment variables configured
- [ ] Connect Render to Supabase PostgreSQL (DATABASE_URL, DIRECT_URL)
- [ ] Run migrations on production: `npx prisma migrate deploy`
- [ ] Verify health endpoint: `GET /api/v1/health` returns `{ status: "ok" }`
- [ ] Test `/register-address` with 3 real Perth addresses from production
- [ ] Set up Sentry alerts for 5xx errors
- [ ] **External cron (Render free tier):** Use cron-job.org or similar — 16:58 AWST hit `/health` (wake service), 17:01 AWST hit `POST /api/v1/cron/trigger-notifications` with `X-Cron-Secret: <CRON_SECRET>`

---

## Phase 2.5 — Admin Dashboard
**Goal:** Internal web tool to monitor scrapers, inspect data, manage users, and track revenue — usable from Phase 1 onwards.
**Estimated time:** 1 week
**AI tool recommendation:** Cursor (iterative UI work)
**Access:** Protected behind HTTP Basic Auth (admin only — not a user-facing feature)
**Tech:** Protected Express routes + lightweight React SPA served from `/admin` on the backend. No new framework — builds on existing Node.js/Express stack.

### 2.5.1 Setup
- [ ] Create `backend/src/admin/` directory for all admin routes and UI
- [ ] Add `GET /admin` route serving the React SPA (built and served as static files)
- [ ] Protect all `/admin/*` routes with HTTP Basic Auth middleware using `ADMIN_PASSWORD` env var
- [ ] Add `ADMIN_PASSWORD` to `.env.example`
- [ ] Add admin build step to `package.json` scripts

### 2.5.2 Scraper Management Panel
- [ ] Council table: name, slug, platform type, last scraped timestamp, zone count, status badge (Healthy / Error / Never Run)
- [ ] Per-council row: expand to see last scraper output, last error message, and response time
- [ ] "Run scraper now" button per council → POST to `/admin/api/scrapers/:slug/run` → streams status back
- [ ] "Health check" button per council → calls `healthCheck()` and returns pass/fail
- [ ] Scraper run history log: last 10 runs per council (timestamp, duration, zones updated, error if any)
- [ ] Bulk action: "Run all scrapers" (queued sequentially, not parallel — respect rate limits)

### 2.5.3 Data Browser
- [ ] **Collection Zones tab:** filterable table by council — shows zone name, collection day, recycling week, green waste, verge dates
- [ ] Click a zone → detail view with full schedule preview (next 20 collection dates computed live)
- [ ] **Address Cache tab:** search by partial address string — shows lat/lng, council, zone, cached date, expires date
- [ ] **Public Holidays tab:** full `wa_public_holidays` table — add/edit/delete rows inline (for annual updates)
- [ ] Export any table as CSV

### 2.5.4 User & Subscriber Management
- [ ] Summary cards: Total Users, Active Subscribers, Free Tier, Trial, Expired
- [ ] User table: user ID (truncated UUID), created date, subscription status, notification hour, zone count, push token status (valid / expired / missing)
- [ ] Filter by subscription status, sort by created date
- [ ] Click user → detail view: zones they've registered (zone IDs + council names only — no address per privacy rules), notification settings, subscription history
- [ ] "Invalidate push token" action (marks token for removal — triggers clean-up on next notification run)
- [ ] Export user count metrics as CSV (no PII in export)

### 2.5.5 Notification Logs
- [ ] Last 30 nightly notification job runs: timestamp, zones processed, total sends, failures, duration
- [ ] Click run → breakdown by zone: sends, failures, failure reason codes
- [ ] Failure reason breakdown chart: `BadDeviceToken` / `DeviceTokenNotForTopic` / `Unregistered` / network errors
- [ ] Push token health summary: valid / stale / invalid counts across all users
- [ ] "Trigger notification job now" button → runs the nightly job immediately (for testing — only in non-production or with confirmation dialog)

### 2.5.6 Analytics Overview
*All metrics are privacy-preserving — no PII, no individual user tracking.*
- [ ] **Coverage map card:** how many Perth councils are live vs pending (number + %)
- [ ] **Address lookups chart:** daily count of `/register-address` calls (last 30 days)
- [ ] **Zone popularity:** top 10 zones by user count (zone name + council, no user details)
- [ ] **Council coverage table:** all 30 councils — status (Live / In Progress / Not Started), user count, last scraper run
- [ ] **Subscription funnel:** Free → Trial → Active → Expired counts with conversion % (data from `users` table)
- [ ] RevenueCat dashboard deep-link card (opens RevenueCat in new tab — MRR/churn live there)
- [ ] **Notification delivery rate:** 7-day rolling average (successful sends / total attempted)

### 2.5.7 System Health Panel
- [ ] Database connection status + query latency (ping `SELECT 1`)
- [ ] Address cache hit rate: cached hits vs live scraper calls (last 7 days)
- [ ] Recent Sentry errors: last 10 backend errors with message + timestamp (Sentry API integration)
- [ ] Render deployment info: current deploy timestamp, git SHA (via `process.env.RENDER_GIT_COMMIT`)
- [ ] All council scraper health checks: run all `healthCheck()` calls and display pass/fail grid

---

## Phase 3 — iOS App
**Goal:** Fully functional iOS app connected to backend, submission-ready.
**Estimated time:** 6 weeks
**AI tool recommendation:** Claude Code for architecture/complex logic; Cursor for view iteration; Codex for boilerplate

### 3.1 Core Infrastructure
- [ ] `BinMateAPI.swift` — URLSession wrapper with base URL, headers, error handling
- [ ] `KeychainService.swift` — store push token and user ID
- [ ] `NotificationService.swift` — request permission, register with APNs, forward token to backend
- [ ] `ScheduleRepository.swift` — fetch from API, cache in CoreData, return to ViewModels
- [ ] `CoreData` model: `CollectionEntity`, `ZoneEntity`, `CouncilEntity`
- [ ] `AppState.swift` — global state: onboarding complete, zone ID, subscription status
- [ ] Deeplink handling for notification tap → open correct screen

### 3.2 Onboarding Flow
- [ ] `OnboardingView.swift` — step container (3 steps, progress indicator)
- [ ] Step 1: `AddressEntryView.swift`
  - Address text field with autocomplete (MapKit local search)
  - "Find my council" CTA
  - Privacy note: "Your address stays on your device"
  - Loading state while API resolves
  - Error state: "Couldn't find your address"
- [ ] Step 2: `CouncilConfirmView.swift`
  - Show detected council name + suburb
  - Show first upcoming collection as preview
  - "That's me" confirm CTA
  - "Try a different address" link
- [ ] Step 3: `NotificationSetupView.swift`
  - Explain what notifications will look like
  - "Turn on reminders" CTA → request APNs permission
  - If denied: show instructions to enable in Settings
  - Set default notification hour = 18 (6pm)
- [ ] Store zone ID in `AppState` and `UserDefaults`
- [ ] Mark onboarding complete → navigate to Home

### 3.3 Home Screen
- [ ] `HomeView.swift` + `HomeViewModel.swift`
- [ ] Date/location header: "TUESDAY, 18 MAR" + "Scarborough · Stirling"
- [ ] `HeroCollectionCard.swift` — the lime "Bins out tonight" card
  - Dynamic: changes based on next collection
  - Shows which bins go out (colour-coded pills)
  - Shows "Out by 6am {day}" subtitle
  - Empty state: "Nothing due this week. Next: [date]"
- [ ] `UpcomingScheduleList.swift` — next 8 collections
  - Date column (day abbreviation + date number)
  - Bin type pills (colour + label)
  - Verge collection shown in amber
  - Holiday-shifted collection shows original date in strikethrough
- [ ] Pull to refresh
- [ ] Bottom navigation bar (Home, Calendar, Settings)

### 3.4 Calendar Screen
- [ ] `CalendarView.swift` + `CalendarViewModel.swift`
- [ ] Month grid view — 12 months of upcoming collections
- [ ] Bin type colour dots on collection days
- [ ] Tap a day → bottom sheet with collection details
- [ ] Verge collection dates highlighted in amber
- [ ] Public holidays shown with shift indicator

### 3.5 Settings Screen
- [ ] `SettingsView.swift`
- [ ] Address section: current address + "Change address" → re-runs onboarding
- [ ] Multiple addresses section (Premium): add/remove addresses, toggle primary
- [ ] Notification section:
  - Toggle notifications on/off
  - Notification time picker (4pm–10pm)
  - "Test notification" button (sends immediately)
- [ ] Subscription section: current plan, manage subscription (opens App Store)
- [ ] About section: version, privacy policy link, contact email

### 3.6 Bin Guide Screen
- [ ] `BinGuideView.swift`
- [ ] Tab bar: Red lid / Yellow lid / Lime Green lid
- [ ] Per-council bin content list (what goes in, what doesn't)
- [ ] A–Z search: "where does X go?"
- [ ] Matches bin colours exactly to Perth lids (`BRAND.md` Section 1, bin colours)

### 3.7 Paywall Screen
- [ ] `PaywallView.swift` + `PaywallViewModel.swift`
- [ ] Eyebrow: "Your free trial ends {day}" (amber, mono font)
- [ ] Headline: "Never miss a bin day. Ever."
- [ ] Feature list (5 items from `BRAND.md`)
- [ ] Two plan options:
  - Annual: $9.99/year, "BEST VALUE" badge, selected by default
  - Monthly: $1.49/month
- [ ] "Get BinMate Premium →" CTA
- [ ] Legal copy: "7-day free trial. Cancel anytime in Settings."
- [ ] RevenueCat `Purchases.purchase(package:)` call
- [ ] Loading state during purchase
- [ ] Error handling (user cancelled vs actual error — different messages)
- [ ] Restore purchases link
- [ ] Show paywall:
  - After 7-day trial ends
  - When user tries to add a second address (Premium feature)
  - On first verge collection alert trigger (gentle upsell)

### 3.8 Free Tier Logic
- [ ] `EntitlementService.swift` — checks RevenueCat entitlement `premium`
- [ ] Free tier: 1 address, no push notifications, 7-day schedule preview only
- [ ] Premium features gated by `EntitlementService.isPremium`
- [ ] Graceful degradation: show what they're missing, not a hard error

### 3.9 Widget (WidgetKit)
- [ ] `BinMateWidget` — small and medium sizes
- [ ] Small: "Tomorrow — Red + Yellow" or "Nothing this week"
- [ ] Medium: small + next 3 collections with dates
- [ ] Timeline provider refreshes at 17:00 AWST daily
- [ ] Uses shared `AppGroup` to read zone ID from main app
- [ ] Tap widget → opens Home screen

### 3.10 Accessibility Pass
- [ ] VoiceOver: all interactive elements labelled
- [ ] Dynamic Type: all text scales correctly
- [ ] Colour contrast: verify lime on dark passes 4.5:1
- [ ] Reduce Motion: all animations respect `@Environment(\.accessibilityReduceMotion)`
- [ ] Keyboard navigation (iPad): logical tab order

---

## Phase 4 — Remaining Councils + Polish
**Goal:** All 30 councils covered. App store-ready quality.
**Estimated time:** 3–4 weeks

### 4.1 Remaining Council Scrapers (post-launch priority order)
- [ ] City of Joondalup (~180k)
- [ ] City of Bayswater (~70k)
- [ ] City of Vincent (~35k)
- [ ] City of Rockingham (~145k)
- [ ] City of Belmont (~35k)
- [ ] City of Gosnells (~130k)
- [ ] City of Kalamunda (~60k)
- [ ] Town of Victoria Park (~40k)
- [ ] City of East Fremantle (~8k)
- [ ] Town of Bassendean (~15k)
- [ ] Shire of Serpentine-Jarrahdale (~35k)
- [ ] Remaining 9 smaller councils
- **Each needs:** scraper + test + seeded zones + health check registered

### 4.2 App Polish
- [ ] App icon: 1024×1024pt (lime square, bin mark)
- [ ] Launch screen: midnight background, BinMate wordmark centered
- [ ] All loading states implemented (skeleton views)
- [ ] All empty states implemented with helpful copy
- [ ] All error states show user-friendly messages (from `BRAND.md`)
- [ ] Haptic feedback: `UIImpactFeedbackGenerator` on primary CTA taps
- [ ] App review prompt: trigger after 3rd successful bin-day notification received

### 4.3 App Store Preparation
- [ ] App Store screenshots: 6 screens (iPhone 6.7" and 6.1")
  1. Home screen — "Bins out tonight" card
  2. Upcoming schedule
  3. Public holiday shift notification
  4. Verge collection alert
  5. Address setup (onboarding)
  6. Calendar view
- [ ] App Store description (see `docs/PROJECT.md` Section 9.2 for copy)
- [ ] Keywords: "bin day Perth", "Perth bin reminder", "recycling reminder Perth", "WA bin collection", "rubbish day reminder"
- [ ] Category: Utilities (primary), Lifestyle (secondary)
- [ ] Privacy policy page: `binmate.app/privacy`
- [ ] Support URL: `binmate.app/support`
- [ ] Age rating: 4+
- [ ] App Review notes: explain what the app does, list test credentials

### 4.4 TestFlight Beta
- [ ] Upload build to TestFlight
- [ ] Internal testing: developer + 3 known addresses (one per council tier)
- [ ] External testing group: 50–100 Perth residents
  - Recruit from: Perth Facebook groups, r/perth, personal network
  - Target: range of councils, FIFO workers, new Perth arrivals, renters
- [ ] Beta feedback form: Google Form with 5 questions
  - Did the notification fire on the right day?
  - Was the bin type correct?
  - Did the public holiday shift work? (if applicable)
  - What would you pay for this? (validate price)
  - Anything else broken?
- [ ] Beta period: minimum 2 weeks before App Store submission
- [ ] Fix all P0 and P1 bugs from beta feedback

---

## Phase 5 — Launch
**Goal:** App live in App Store, first paying users.
**Estimated time:** 1 week

### 5.1 Pre-Launch
- [ ] App Store submission: submit for review
- [ ] Expected review time: 24–72 hours (expedite if needed)
- [ ] Landing page live: `binmate.app` — "Get it on the App Store" button
- [ ] Email list: notify waitlist from landing page
- [ ] All council data for current month verified correct (manual spot-check 5 addresses)

### 5.2 Launch Day
- [ ] Post to r/perth
- [ ] Post to top Perth suburb Facebook groups (Stirling, Scarborough, Wanneroo, Joondalup, Rockingham)
- [ ] Post to Nextdoor Perth (key suburbs)
- [ ] No paid ads on launch day — organic only

### 5.3 Post-Launch (Week 1)
- [ ] Monitor Sentry for crashes — fix P0 within 24 hours
- [ ] Monitor notification delivery rate (target >97%)
- [ ] Monitor App Store rating (target 4.5+ after first 20 reviews)
- [ ] Monitor conversion: install → trial → paid (target >40%)
- [ ] Respond to all App Store reviews (first 30 days)

---

## Ongoing Maintenance

### Annual Tasks (every January)
- [ ] Download and parse new council PDF calendars
- [ ] Update WA public holidays table for new year + next year
- [ ] Verify all active scrapers still returning correct data
- [ ] Update App Store screenshots if UI has changed significantly

### Monthly Tasks
- [ ] Review Sentry error report
- [ ] Review notification delivery metrics
- [ ] Review RevenueCat dashboard — churn, MRR, conversion

### As Needed
- [ ] Council website change detected (change-detection cron alerts) → fix scraper within 48 hours
- [ ] New council coverage request → add to queue

---

## Milestones Summary

| Milestone | Target Date | Definition of Done |
|---|---|---|
| Phase 0 complete | Week 1 | Repo set up, all accounts active, iOS + backend scaffolded |
| Data layer MVP | Week 4 | 5 councils return correct schedules for real addresses |
| Backend API live | Week 6 | API deployed, push notifications working end-to-end |
| iOS Alpha | Week 8 | Address setup + home screen working on real device |
| iOS Feature Complete | Week 12 | All screens built, paywall working, no P0 bugs |
| Top 9 councils live | Week 14 | 57% of Perth covered |
| TestFlight Beta | Week 15 | 50+ beta testers, feedback collected |
| App Store Submission | Week 16 | All P0/P1 bugs fixed, screenshots done |
| **App Store Launch** | **Week 17** | **Live in App Store** |
| All 30 councils | Month 5 | 100% Perth metro coverage |
| 1,000 paying users | Month 4 | Revenue validated, sustainable |

---

## Decision Log

Record significant decisions here so future AI sessions have context.

| Date | Decision | Reason |
|---|---|---|
| Mar 2026 | iOS-only at launch, no Android | Faster build, iOS dominant in AU (60%+), validate before scaling |
| Mar 2026 | Node.js backend (not Python) | Developer familiarity, faster iteration |
| Mar 2026 | RevenueCat for subscriptions | Avoids building subscription validation from scratch |
| Mar 2026 | No analytics SDK at launch | Privacy-first position, simpler app, less data liability |
| Mar 2026 | Zone-based data model (not per-user schedules) | Massively more efficient — 1 zone serves thousands of users |
| Mar 2026 | Free tier has no push notifications | Makes the value of Premium immediately obvious, not coercive |
| Mar 2026 | $1.49/month primary, $9.99/year | Below friction threshold, annual drives retention |
| Mar 2026 | 7-day free trial on both plans | User must experience a real bin-day notification before converting |
| Mar 2026 | Nominatim for geocoding (not Google Maps) | Free, no API key, 1 req/sec — sufficient for address lookups at MVP scale |
| Mar 2026 | Local server for development (not Railway/Render yet) | No running costs during build phase; deploy to Render when app is TestFlight-ready |
| Mar 2026 | Wanneroo: static suburb map not PDF parsing | PDF parsing is fragile; static map from verified calendar is reliable and maintainable |
| Mar 2026 | FCM deferred — notifications service mocked | No Apple Dev account yet; APNs implementation blocked until account active |

---

## Known Risks & Current Status

| Risk | Status | Notes |
|---|---|---|
| City of Stirling uses Salesforce | Unresolved | May need PDF fallback — investigate in Phase 1.6 |
| FCM deprecation of legacy APIs | Low risk | Using Firebase Admin SDK (current) |
| Apple rejection for subscription terms | Low risk | Standard utility app, StoreKit 2 pattern is Apple-preferred |
| Council website redesigns | Ongoing | Change detection cron mitigates this |

---

*Last updated: 16 March 2026*
*Next: seed WA public holidays → `zoneScheduleComputer.ts` → Armadale scraper → wire `/register-address` route*
