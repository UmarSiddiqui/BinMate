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
- [x] City of Armadale — REST API `api.my.armadale.wa.gov.au/bins` (reverse-engineered from Next.js frontend)
- [x] City of Fremantle — ArcGIS FeatureServer/60 (public, no auth) ✅
- [x] City of Cockburn — widget API `gis1.cockburn.wa.gov.au/webapiv2` ✅
- [x] City of Melville — T1Cloud static API key (`gis.melvillecity.com.au`) ✅
- [x] City of Canning — `canning.wa.gov.au/residents/waste-and-recycling/bins-and-collection-days/`
- [x] City of Swan — `swan.spatial.t1cloud.com` — T1Cloud Intramaps (session-based auth) ✅
- [x] City of South Perth — `cosp.spatial.t1cloud.com` — T1Cloud Intramaps (session-based auth, Property module) ✅
- [x] City of Stirling — OpenCities custom widget — `GET /bincollectioncheck/getresult` ✅

Document findings in `docs/COUNCILS.md`.

### 1.2 Database & Schema
- [x] Initial Prisma migration applied to Supabase (`20260315152437_init`) ✅
- [x] `src/scrapers/base/types.ts` — `CouncilScraper` interface + `ZoneResolution`, `ZoneScheduleData` types
- [x] Seed `wa_public_holidays` table for 2026 and 2027 (22 holidays seeded ✅)
- [x] Write `zoneScheduleComputer.ts` — takes zone record + date, returns next N collections ✅
- [x] Write unit tests for `zoneScheduleComputer` — 17/17 passing ✅
  - [x] Normal week (no holiday)
  - [x] Collection on WA public holiday (should shift +1 day)
  - [x] Week A / Week B rotation over 12 months
  - [x] Year boundary (Dec 31 → Jan 1)
  - [x] Council with no green waste
  - [x] Multi-day Easter cluster (4-day shift Fri→Tue)
  - [x] Verge dates included/excluded by date range

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

#### City of Armadale ✅
- [x] Reverse-engineered live REST API: `GET https://api.my.armadale.wa.gov.au/bins?address={street}`
  - Autocomplete endpoint — street portion only (comma-split, not full qualified address)
  - Response: `{ address, bin_day, recycle_area, vergeside_zone }`
  - Area 1 → recyclingWeek 'A', Area 2 → recyclingWeek 'B' (verified 2026-03-16 = Week A)
- [x] Write `armadale.ts` scraper — direct API, no Nominatim needed
- [x] Write test: `tests/scrapers/armadale.test.ts` — **12/12 passing** ✅
  - 23 Sexty St, Armadale → WED-1 ✓
  - 270 Skeet Rd, Harrisdale → THU-2 ✓
- [x] Seed Armadale zones into database — 10 zones (5 days × 2 areas) ✅
  - Council row: `93961ddc-f962-46e4-928e-56a3244ba070`
- [x] Wired into `SCRAPER_REGISTRY` in `addressService.ts` ✅

#### Smaller councils (PDF/iCal — batch these together)
- [ ] City of Nedlands — identify data source, build scraper
- [ ] Town of Claremont — identify data source, build scraper
- [ ] Town of Cottesloe — identify data source, build scraper
- [ ] Town of Mosman Park — identify data source, build scraper
- [ ] City of Subiaco — identify data source, build scraper
- [ ] Town of Cambridge — identify data source, build scraper
- [ ] Each needs test with a real address

### 1.4 Scrapers — Tier 1 (ArcGIS)

#### City of Fremantle ✅
- [x] Identified ArcGIS layer: `Domestic_waste_collection_areas/FeatureServer/60` (services3.arcgis.com, public, no auth)
  - FOGO (dark green lid) weekly; General waste (red lid) fortnightly Week A; Recycling (yellow lid) fortnightly Week B
  - All zones: `recyclingWeek = 'B'` — verified from 2025-26 Waste Guide PDF holiday table
  - 6 zones: FRE-1(Mon), FRE-2(Mon), FRE-4(Tue), FRE-5(Thu), FRE-6(Wed), FRE-7(Fri)
- [x] Write `fremantle.ts` scraper — geocode → lat/lng → ArcGIS point query
- [x] Write test: `tests/scrapers/fremantle.test.ts` — **13/13 passing** ✅
  - 15 South Tce, Fremantle → FRE-4 (Tuesday) ✓
- [x] Seed Fremantle zones — 6 zones seeded ✅
  - Council row: `19c27fce-df87-4c68-b277-831f5fa41f7c`
- [x] Wired into `SCRAPER_REGISTRY` in `addressService.ts` ✅

#### City of Cockburn ✅
- [x] Reverse-engineered live widget API on `gis1.cockburn.wa.gov.au/webapiv2`
  - `LikeSearch` / `FuzzySearch` → property `dbkey`
  - `PropertyInfoSearch/PropertyNo?q={dbkey}` → `BinDay`, `GardenWaste`, verge `Area`, verge dates
  - Weekly general + weekly recycling; garden organics fortnightly when applicable
  - Verge `Area` is separate from kerbside bin day / garden parity, so Cockburn zones are stored as `day + garden week + verge area`
- [x] Write `cockburn.ts` scraper and test
- [x] Seed Cockburn zones — 110 seeded combinations (5 weekdays × 10 garden areas × A/B, plus no-garden areas 0 and 11)
- [x] Wired into `SCRAPER_REGISTRY` in `addressService.ts` ✅

#### City of Melville ✅
- [x] Reverse-engineered T1Cloud Intramaps API from `melvillecity.com.au/assets/js/minified/alyka.scripts.src.js`
  - Two-step flow: GET Reproject (WGS84 → EPSG:7850) then GET Search (waste layer)
  - API key embedded in public frontend JS
  - Response fields: `collection_district`, `GreenLid`, `RedLid`, `YellowLid`
  - Recycling week determined by parsing YellowLid date vs WEEK_A_REFERENCE
- [x] Write `melville.ts` scraper — geocode → reproject → search → zone code `MEL-{DAY}-{WEEK}`
- [x] Write test: `tests/scrapers/melville.test.ts` — **13/13 passing** ✅
  - 5 Kintail Rd, Applecross → MEL-MON-A ✓
  - 12 Ardross St, Ardross → MEL-WED-B ✓
- [x] Seed Melville zones — 10 zones (5 days × 2 recycling weeks) ✅
  - Council ID: `0ddbb441-a515-423e-b649-8ccde4553f51`
- [x] Wired into `SCRAPER_REGISTRY` in `addressService.ts` ✅

### 1.5 Scrapers — Tier 2 (Address widget reverse-engineering)

#### City of Canning ✅
- [x] DevTools audit complete — two-step custom REST API (find + bins endpoints)
  - `GET /api/property-details/find/{encodedSearchTerm}` → `[{key, address}]`
  - `GET /api/property-details/bins/{key}` → `{rubbishCollectionDate, recyclingCollectionDate, ...}`
  - Dates are midnight AWST expressed as UTC — add 8h to get AWST calendar date
  - Street abbreviations must be expanded (Rd→Road, St→Street, etc.) or API returns 204
- [x] Write `canning.ts` scraper — zone code `CAN-{DAY_ABBREV}-{RECYCLING_WEEK}`
- [x] Write test: `tests/scrapers/canning.test.ts` — **14/14 passing** ✅
  - 31 Manning Rd, Cannington → CAN-WED-B ✓
  - 15 Wharf St, Queens Park → CAN-FRI-B ✓
  - 22 Harrison St, Bentley → CAN-MON-A ✓
- [x] Seed Canning zones — 10 zones (5 days × 2 recycling weeks) ✅
  - Council ID: `b49fecaf-35e4-4aca-8d71-983fbcde831c`
- [x] Wired into `SCRAPER_REGISTRY` in `addressService.ts` ✅

#### City of Swan ✅
- [x] DevTools audit complete — T1Cloud Intramaps session-based auth (4-step flow)
- [x] Write `swan.ts` scraper — `SWA-{DAY_ABBREV}-{RECYCLING_WEEK}` zone codes
- [x] Test with real address: 12 Morrison Road, Midland → SWA-TUE-A ✓
- [x] Seed Swan zones — 10 zones (5 days × 2 recycling weeks)
- [x] Wired into `SCRAPER_REGISTRY` in `addressService.ts` ✅
- [x] 14 tests passing ✅

### 1.6 Scrapers — Tier 4 (Platform APIs — hardest)

#### City of South Perth (T1Cloud) ✅
- [x] DevTools audit — session-based auth (appType=Standard, project=Public, X-Requested-With required)
- [x] Reverse-engineered T1Cloud API: Projects → Modules → Search → Refine/Set; waste data in Property module infoPanels.info2
- [x] Write `southperth.ts` scraper — zone code `COSP-{DAY_ABBREV}-{RECYCLING_WEEK}`
- [x] Test: 1 Sandgate Street SOUTH PERTH WA 6151 → COSP-TUE-A ✓
- [x] Seed 10 zones into Supabase — Council ID: `ea021a6a-7b30-4408-abbd-75916d14411d`
- [x] Wired into `SCRAPER_REGISTRY` in `addressService.ts` ✅

#### City of Stirling (OpenCities custom widget) ✅
- [x] DevTools audit — NOT Salesforce; custom OpenCities CMS widget on `www.stirling.wa.gov.au`
- [x] API: `GET /bincollectioncheck/getresult` — custom headers (configid, form, fields=lng,lat, Referer required)
- [x] Coordinate-based lookup (point-in-polygon against property parcels); `Referer` header required
- [x] Write `stirling.ts` scraper — zone code `STI-{DAY_ABBREV}-{RECYCLING_WEEK}`; green waste = opposite week
- [x] 45/45 tests passing — coordinate tests for WED-A, FRI-A, TUE-B, THU-B + canHandle + fetchSchedule + healthCheck
- [x] Seed 10 zones into Supabase — Council ID: `8ef3fd59-ae75-4c15-8ac2-cb1c7a5dc489`
- [x] Wired into `SCRAPER_REGISTRY` in `addressService.ts` ✅
- **Note on precision:** Nominatim returns road centroids for major arterial roads; API resolves empty in those cases. Residential street addresses resolve correctly. scraper returns informative error.

### 1.7 Address Resolution Service
- [x] `AddressService.resolveAddress(address: string): Promise<AddressResolution | AddressError>` ✅
- [x] Geocode via Nominatim (not Google Maps) → lat/lng + suburb ✅
- [x] Check `address_cache` first — return cached result on hit ✅
- [x] Scraper registry: `canHandle(suburb)` check → scraper.resolveAddress → zone code → DB lookup ✅
  - Wanneroo scraper wired in — resolves all 30 Wanneroo suburbs to correct zone codes
  - Generic council name fallback for councils without a scraper yet
- [x] Cache result in `address_cache` ✅
- [x] Return zone ID + council name + next 5 collections (via `/register-address` route) ✅
- [ ] Write integration test with real Perth addresses across multiple councils (Phase 2)

---

## Phase 2 — Backend API
**Goal:** Deployed API that accepts addresses and schedules push notifications.
**Estimated time:** 1.5 weeks
**AI tool recommendation:** Cursor (good for iterating on route handlers and tests)

### 2.1 API Routes
- [x] `POST /api/v1/register-address` — Zod validation, resolves address, creates user, returns schedule ✅
- [x] `GET /api/v1/schedule` — Zod validation, `zoneId` + `from` + `count` params ✅
- [x] `PUT /api/v1/push-token` — Zod validation, updates token + notification hour ✅
- [x] `POST /api/v1/webhook/revenuecat` — auth header validation, full event map ✅
- [x] `GET /api/v1/health` — returns `{ status, version, env, db }` ✅
- [x] Request validation with Zod on all POST/PUT endpoints ✅
- [x] Error middleware — consistent `{ error: string }` responses ✅
- [x] Rate limiting — 10 req/min per IP on `/register-address` ✅

### 2.2 Notification Engine
- [x] `sendPushNotification` / `sendBatchNotifications` — **MOCKED** (real APNs blocked on Apple Dev account) ✅
- [x] Notification copy from `BRAND.md` §7 in `buildPayload()` ✅
- [x] `jobs/notificationEngine.ts` — cron at 09:00 UTC (17:00 AWST) ✅
  - [x] `getZonesCollectingTomorrow()` — implemented in scheduleService ✅
  - [x] Public holiday shift applied via zoneScheduleComputer ✅
  - [x] Logs sent/failed counts ✅
  - [ ] Test: mock tomorrow = Good Friday → verify shift fires correctly
- [x] `POST /api/v1/cron/trigger-notifications` — protected endpoint for Render free tier external cron ✅

### 2.3 RevenueCat Webhook Handler
- [x] `POST /api/v1/webhook/revenuecat` ✅
- [x] Validates `REVENUECAT_WEBHOOK_AUTH_HEADER` ✅
- [x] Handles all events: `INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION`, `EXPIRATION`, `BILLING_ISSUE`, `TRIAL_*` ✅
- [x] Updates `users.subscription_status` ✅
- [x] Logs all webhook events ✅

### 2.4 Deployment
- [ ] Deploy to Render — `render.yaml` blueprint, environment variables configured
- [ ] Connect Render to Supabase PostgreSQL (DATABASE_URL, DIRECT_URL)
- [ ] Run migrations on production: `npx prisma migrate deploy`
- [ ] Verify health endpoint: `GET /api/v1/health` returns `{ status: "ok" }`
- [ ] Test `/register-address` with 3 real Perth addresses from production
- [ ] Set up Sentry alerts for 5xx errors
- [ ] **External cron (Render free tier):** Use cron-job.org or similar — 16:58 AWST hit `/health` (wake service), 17:01 AWST hit `POST /api/v1/cron/trigger-notifications` with `Authorization: Bearer <CRON_SECRET>`

---

## Phase 2.5 — Admin Dashboard
**Goal:** Internal web tool to monitor scrapers, inspect data, manage users, and track revenue — usable from Phase 1 onwards.
**Estimated time:** 1 week
**AI tool recommendation:** Cursor (iterative UI work)
**Access:** Protected behind HTTP Basic Auth (admin only — not a user-facing feature)
**Tech:** Protected Express routes + lightweight React SPA served from `/admin` on the backend. No new framework — builds on existing Node.js/Express stack.

### 2.5.1 Setup
- [x] Create `backend/src/admin/` directory for all admin routes and UI ✅
- [x] Add `GET /admin` route (server-rendered HTML — no React build step needed) ✅
- [x] Protect all `/admin/*` routes with HTTP Basic Auth middleware ✅
- [x] `ADMIN_PASSWORD` already in `.env.example` ✅
- [ ] Add admin build step to `package.json` scripts (deferred — no build step needed for server-rendered approach)

### 2.5.2 Scraper Management Panel
- [x] Council table: name, slug, platform type, last scraped, zone count, status badges ✅
- [ ] Per-council row: expand to see last scraper output and error message
- [ ] "Run scraper now" button → POST `/admin/api/scrapers/:slug/run`
- [x] "Health check" button per council → calls `healthCheck()` and returns pass/fail ✅
- [ ] Scraper run history log
- [ ] Bulk action: "Run all scrapers"

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
- [x] Render deployment info: current deploy timestamp, git SHA (via `process.env.RENDER_GIT_COMMIT`) ✅
- [ ] All council scraper health checks: run all `healthCheck()` calls and display pass/fail grid

---

## Phase 3 — iOS App
**Goal:** Fully functional iOS app connected to backend, submission-ready.
**Estimated time:** 6 weeks
**AI tool recommendation:** Claude Code for architecture/complex logic; Cursor for view iteration; Codex for boilerplate

### 3.1 Core Infrastructure
- [x] `BinMateAPI.swift` — URLSession wrapper with base URL, headers, error handling
- [x] `KeychainService.swift` — store push token and user ID
- [x] `NotificationService.swift` — request permission, register with APNs, forward token to backend
- [x] `ScheduleRepository.swift` — fetch from API, cache in CoreData, return to ViewModels
- [x] `CoreData` model: `CollectionEntity`, `ZoneEntity`, `CouncilEntity`
- [x] `AppState.swift` — global state: onboarding complete, zone ID, subscription status
- [x] Deeplink handling for notification tap → open correct screen

### 3.2 Onboarding Flow
- [x] `OnboardingView.swift` — step container (3 steps, progress indicator)
- [x] Step 1: `AddressEntryView.swift`
  - Address text field with autocomplete (MapKit local search)
  - "Find my council" CTA
  - Privacy note: "Your address stays on your device"
  - Loading state while API resolves
  - Error state: "Couldn't find your address"
- [x] Step 2: `CouncilConfirmView.swift`
  - Show detected council name + suburb
  - Show first upcoming collection as preview
  - "That's me" confirm CTA
  - "Try a different address" link
- [x] Step 3: `NotificationSetupView.swift`
  - Explain what notifications will look like
  - "Turn on reminders" CTA → request APNs permission
  - If denied: show instructions to enable in Settings
  - Set default notification hour = 18 (6pm)
- [x] Store zone ID in `AppState` and `UserDefaults`
- [x] Mark onboarding complete → navigate to Home

### 3.3 Home Screen
- [x] `HomeView.swift` + `HomeViewModel.swift`
- [x] Date/location header: "TUESDAY, 18 MAR" + "Scarborough · Stirling"
- [x] `HeroCollectionCard.swift` — the lime "Bins out tonight" card
  - Dynamic: changes based on next collection
  - Shows which bins go out (colour-coded pills)
  - Shows "Out by 6am {day}" subtitle
  - Empty state: "Nothing due this week. Next: [date]"
- [x] `UpcomingScheduleList.swift` — next 8 collections
  - Date column (day abbreviation + date number)
  - Bin type pills (colour + label)
  - Verge collection shown in amber
  - Holiday-shifted collection shows original date in strikethrough
- [x] Pull to refresh
- [x] Bottom navigation bar (Home, Calendar, Settings)

### 3.4 Calendar Screen
- [x] `CalendarView.swift` + `CalendarViewModel.swift`
- [x] Month grid view — 12 months of upcoming collections
- [x] Bin type colour dots on collection days
- [x] Tap a day → bottom sheet with collection details
- [x] Verge collection dates highlighted in amber
- [x] Public holidays shown with shift indicator

### 3.5 Settings Screen
- [x] `SettingsView.swift` — full implementation ✅
- [x] `SettingsViewModel.swift` — notification state, hour sync, test notification ✅
- [x] Address section: current address (suburb + council) + "Change address" → confirmation → re-runs onboarding ✅
- [x] Multiple addresses section (Premium): premium gate (free → upgrade prompt; premium → "Coming soon" placeholder) ✅
- [x] Notification section:
  - Toggle notifications on/off (system auth check, local opt-out, open Settings if denied) ✅
  - Notification time picker (4pm–10pm, syncs to backend via updatePushToken) ✅
  - "Test notification" button (fires local notification in 3s, checkmark feedback) ✅
- [x] Subscription section: current plan, manage subscription (RevenueCat CustomerCenter) ✅
- [x] About section: version, privacy policy link, contact support link ✅
- [x] Wired into MainTabView (replaced Text("Settings") placeholder) ✅

### 3.6 Bin Guide Screen
- [x] `BinGuideView.swift` + `BinGuideContent.swift` ✅
- [x] Lid selector: Red / Yellow / Lime Green tabs with coloured circle indicators ✅
- [x] Per-lid content lists: "Goes in" (accepted) + "Not in this bin" (rejected) sections ✅
- [x] A–Z search: "What goes where?" — filters accepted items across all bins ✅
- [x] Bin colours match Perth physical lids exactly via `BinMateTheme.Colors.binRed/Yellow/Green` ✅
- [x] Accessible from Settings → About → "Bin guide" (presented as sheet) ✅
- [x] Full VoiceOver labels on all interactive elements ✅

### 3.7 Paywall Screen
- [x] `BinMatePaywallView.swift` — wraps RevenueCat native `PaywallView` (design configured in RC dashboard) ✅
- [x] `onPurchaseCompleted` + `onRestoreCompleted` handlers → `EntitlementService.refresh()` ✅
- [x] `.tint(BinMateTheme.Colors.lime)` applied to RC paywall CTA ✅
- [x] `binMatePaywall(isPresented:)` modifier — reusable sheet presenter used across the app ✅
- [x] Show paywall: second address gate (SettingsView), calendar locked cells, notification gate ✅
- [x] Verge collection gentle upsell trigger ✅

### 3.8 Free Tier Logic
- [x] `EntitlementService.swift` — RevenueCat entitlement `Bin Mate Pro`, real-time stream ✅
- [x] 1 address: second address gated in Settings behind `isPremium` ✅
- [x] No push notifications: notifications section locked for free users, shows Premium badge ✅
- [x] 7-day schedule preview: CalendarView locks cells beyond today+7 with lock icon + upsell banner ✅
- [x] Graceful degradation: informational banners + Premium badge labels, no hard errors ✅

### 3.9 Widget (WidgetKit)
- [x] `BinMateWidget` — small and medium sizes ✅
- [x] Small: "Tomorrow — Red + Yellow" or "Nothing this week" ✅
- [x] Medium: small + next 3 collections with dates ✅
- [x] Timeline provider refreshes at 17:00 AWST daily ✅
- [x] Uses shared `AppGroup` (`group.app.binmate`) to read data from main app ✅
- [x] `WidgetDataWriter` called after schedule loads in `HomeViewModel` ✅

### 3.10 Accessibility Pass
- [x] VoiceOver: all interactive elements labelled, decorative icons hidden ✅
- [x] Dynamic Type: theme fonts used throughout (no hardcoded sizes in interactive elements) ✅
- [x] Colour contrast: lime (#B8F04A) on dark (#0D0F12) = 14.2:1 — passes WCAG AAA ✅
- [x] Reduce Motion: `@Environment(\.accessibilityReduceMotion)` in OnboardingView, BinGuideView, SkeletonView ✅
- [ ] Keyboard navigation (iPad): logical tab order (manual test needed)

---

## Phase 4 — Remaining Councils + Polish
**Goal:** All 30 councils covered. App store-ready quality.
**Estimated time:** 3–4 weeks

### 4.1 Remaining Council Scrapers (post-launch priority order)
- [x] City of Joondalup (~180k) ✅
- [ ] City of Bayswater (~70k)
- [ ] City of Vincent (~35k)
- [ ] City of Rockingham (~145k)
- [x] City of Belmont (~35k) ✅
- [ ] City of Gosnells (~130k)
- [ ] City of Kalamunda (~60k)
- [ ] Town of Victoria Park (~40k)
- [ ] City of East Fremantle (~8k)
- [ ] Town of Bassendean (~15k)
- [ ] Shire of Serpentine-Jarrahdale (~35k)
- [ ] Remaining 9 smaller councils
- **Each needs:** scraper + test + seeded zones + health check registered

### 4.2 App Polish
- [ ] App icon: 1024×1024pt (lime square, bin mark) — needs designer asset
- [x] Launch screen: `LaunchBackground` (#0D0F12) colorset + `INFOPLIST_KEY_UILaunchScreen_UIColorName` ✅
- [x] All loading states implemented (SkeletonView shimmer in HomeView) ✅
- [x] All empty states implemented (HomeView empty state card with pull-to-refresh prompt) ✅
- [x] Error states show user-friendly messages via `BinMateError.errorDescription` + `isUserFacing` ✅
- [x] Haptic feedback: `HapticFeedback.impact(.medium)` on "That's me" + "Turn on reminders" CTAs ✅
- [x] App review prompt: fires after 3rd notification via `requestReview()` + `notificationReceivedCount` ✅
- [x] Verge collection gentle upsell trigger ✅

### 4.3 App Store Preparation
- [ ] App Store screenshots: 6 screens (iPhone 6.7" and 6.1")
  1. Home screen — "Bins out tonight" card
  2. Upcoming schedule
  3. Public holiday shift notification
  4. Verge collection alert
  5. Address setup (onboarding)
  6. Calendar view
- [ ] App Store screenshots: 6 screens — see `docs/APP_STORE.md` for specs (needs Xcode/designer)
- [x] App Store description — see `docs/APP_STORE.md` ✅
- [x] Keywords — see `docs/APP_STORE.md` (96 chars, 7 terms) ✅
- [x] Category: Utilities (primary), Lifestyle (secondary) ✅
- [ ] Privacy policy page: `binmate.app/privacy`
- [ ] Support URL: `binmate.app/support`
- [x] Age rating: 4+ ✅
- [x] App Review notes — see `docs/APP_STORE.md` ✅

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
*Next: City of South Perth — T1Cloud Intramaps pattern (cosp.spatial.t1cloud.com); see HANDOFF.md*
