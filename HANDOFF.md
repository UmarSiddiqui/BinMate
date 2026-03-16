## Handoff — 2026-03-17 06:54 AWST
**From:** Codex
**Completed in this session:**
- Implemented City of Belmont scraper end-to-end using the live public IntraMaps endpoints:
  - `GET /api/intramaps/getaddresses?key={address}`
  - `GET /api/intramaps/getpropertydetailsbymapdbkey?mapkey={mapkey}&dbkey={dbkey}`
- Added candidate ranking + retry logic so address resolution can skip unsupported map records and still return a valid serviced property.
- Added Belmont zone model:
  - `BEL-FOGO-{DAY}-{A|B}-{S|O}` where `S` = same-week FOGO and `O` = opposite-week FOGO
  - `BEL-STD-{DAY}-{A|B}` for non-FOGO properties
- Wired Belmont into `SCRAPER_REGISTRY` so `addressService` can route Belmont suburbs.
- Added full Belmont scraper unit tests (resolve, schedule, canHandle, health-check).
- Added Belmont seed script with 30 zones (FOGO same/opposite + standard across weekdays and A/B).
- Updated trackers to mark Belmont complete in `COUNCILS.md` and `PLAN.md`.
- Verification:
  - `npm test -- tests/scrapers/belmont.test.ts` ✅ (11/11)
  - `npm run build` ✅

**Files modified:**
- [backend/src/scrapers/belmont.ts](/Users/umarsiddiqui/Desktop/BinMate/backend/src/scrapers/belmont.ts)
- [backend/tests/scrapers/belmont.test.ts](/Users/umarsiddiqui/Desktop/BinMate/backend/tests/scrapers/belmont.test.ts)
- [backend/prisma/seed-belmont.ts](/Users/umarsiddiqui/Desktop/BinMate/backend/prisma/seed-belmont.ts)
- [backend/src/scrapers/registry.ts](/Users/umarsiddiqui/Desktop/BinMate/backend/src/scrapers/registry.ts)
- [COUNCILS.md](/Users/umarsiddiqui/Desktop/BinMate/COUNCILS.md)
- [PLAN.md](/Users/umarsiddiqui/Desktop/BinMate/PLAN.md)
- [HANDOFF.md](/Users/umarsiddiqui/Desktop/BinMate/HANDOFF.md)

**Currently broken / in progress:**
- Belmont tests and backend TypeScript build pass.
- Existing uncommitted Joondalup files from previous session remain in the worktree (not reverted).

**Next task:**
- Continue remaining-council coverage with the same checklist (scraper + tests + seed + registry + tracker updates), recommended next:
  - `vincent` (Pozi-backed widget)
  - `kalamunda` (T1Cloud map embed)
  - `gosnells` (Drupal AJAX form flow)

**Known issues:**
- Worktree contains unrelated existing changes, including an iOS path entry (`ios/Bin Mate`); do not revert unrelated files.
