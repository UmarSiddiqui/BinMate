## Handoff — 2026-03-17 (updated after doc audit)
**From:** Claude Code
**Completed in this session (post-Subiaco):**
- Town of Bassendean — scraper + tests ✅ (no seed file yet)
- City of Bayswater — scraper + tests + seed ✅
- Town of Claremont — scraper + tests ✅ (no seed file yet)
- Town of Cottesloe — scraper + tests ✅ (no seed file yet)
- City of East Fremantle — scraper + tests ✅ (no seed file yet)
- City of Gosnells — scraper + tests + seed ✅
- City of Kwinana — scraper + helpers + tests ✅ (no seed file yet)
- Shire of Mundaring — scraper + tests ✅ (no seed file yet)
- City of Rockingham — scraper + tests + seed ✅
- Shire of Serpentine-Jarrahdale — scraper + tests ✅ (no seed file yet)
- Town of Victoria Park — scraper + tests + seed ✅
- City of Nedlands — scraper + tests + seed ✅ (previously committed)
- Town of Cambridge — scraper + tests + seed ✅ (previously committed)
- Shire of Peppermint Grove — scraper + tests + seed ✅ (previously committed)
- Updated `registry.ts` — all 29 scrapers wired in
- Subiaco scraper stability fixes (live data drift, flexible health check assertions)
- Updated PLAN.md, COUNCILS.md, HANDOFF.md to reflect actual state

**Files modified (uncommitted):**
- `COUNCILS.md` — all Priority 1 councils updated from "Not started" to Complete with API details; Nedlands, Cambridge, Claremont, Cottesloe, Peppermint Grove entries added/updated
- `HANDOFF.md` — this file
- `PLAN.md` — Nedlands/Cambridge marked [x]; Peppermint Grove added; Phase 4.1 remaining councils updated
- `backend/src/scrapers/registry.ts` — all 29 scrapers registered
- `backend/src/scrapers/subiaco.ts` — stability fixes
- `backend/tests/scrapers/subiaco.test.ts` — stable assertions
- `backend/src/jobs/notificationEngine.ts` — (check diff)
- `backend/src/repositories/zoneRepository.ts` — (check diff)
- `backend/src/services/scheduleService.ts` — (check diff)
- `backend/src/services/zoneScheduleComputer.ts` — (check diff)
- `backend/tests/services/zoneScheduleComputer.test.ts` — (check diff)

**New untracked files (uncommitted):**
- `backend/src/scrapers/`: bassendean, bayswater, claremont, cottesloe, eastfremantle, gosnells, kwinana, kwinana.helpers, mundaring, rockingham, serpentinejj, victoriapark
- `backend/tests/scrapers/`: bassendean, bayswater, claremont, cottesloe, eastfremantle, gosnells, kwinana, mundaring, rockingham, serpentinejj, victoriapark
- `backend/prisma/`: seed-bayswater, seed-gosnells, seed-rockingham, seed-victoriapark

**Current state:**
- **29 of ~30 Perth councils** have scrapers in `SCRAPER_REGISTRY`
- **All scrapers wired** into address resolution service
- **Seed files pending** for: Claremont, Cottesloe, EastFremantle, Bassendean, Kwinana, SerpentineJJ, Mundaring (scraper + tests done; zones not yet in Supabase)
- **iOS app:** All phases 3.1–3.10 complete per PLAN.md ✅
- **Backend API:** All Phase 2.1 routes complete ✅
- **Notification engine:** Implemented (mocked APNs — pending real Apple Dev account)
- **Deployment:** Not yet deployed to Render (pending GitHub repo setup)

**Currently broken / in progress:**
- None known from scraper work
- APNs still mocked (blocked on Apple Developer account)

**Next tasks (in priority order):**
1. **Run seed files** for unseeded councils (Claremont, Cottesloe, EastFremantle, Bassendean, Kwinana, SerpentineJJ, Mundaring) — each needs a seed script created + run against Supabase
2. **Commit all uncommitted work** — 11 new scrapers + 4 seed files + registry + doc updates
3. **Deploy to Render** — create GitHub repo, push, configure environment vars, run `prisma migrate deploy`
4. **Apple Developer account** — unblocks real APNs push notifications
5. **TestFlight beta** — once deployed + APNs working

**Known issues:**
- Live council APIs can shift weekday/week-token outcomes for fixed reference addresses over time — tests should assert invariant zone shape, not pinned day values
- Stirling scraper returns informative error for major arterial road addresses (Nominatim returns road centroids, not residential parcels) — expected behaviour
