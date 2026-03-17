## Handoff — 2026-03-17 08:20 AWST
**From:** Codex
**Completed in this session:**
- Implemented City of Kalamunda scraper end-to-end using live T1Cloud IntraMaps MapBuilder flow (`Projects → Modules → Search → Refine/Set`).
- Added resilient Kalamunda resolution logic:
  - street-first search terms with suburb fallback
  - candidate ranking by house number/suburb/token overlap
  - `Bin Day` + `Bin Area` parsing (`Area One → Week A`, `Area Two → Week B`)
  - request timeout + 1 request/second throttling in non-test env
- Added full Kalamunda scraper unit tests (resolve, fallback ranking, schedule, canHandle, health-check) with mocked T1Cloud payloads.
- Wired Kalamunda into `SCRAPER_REGISTRY` so `addressService` can route Kalamunda suburbs.
- Added Kalamunda seed script with 10 zones (`5 weekdays × 2 recycling weeks`) and weekly FOGO settings.
- Updated tracker docs to mark Kalamunda complete in `COUNCILS.md` and `PLAN.md`.

**Files modified:**
- [backend/src/scrapers/kalamunda.ts](/Users/umarsiddiqui/Desktop/BinMate/backend/src/scrapers/kalamunda.ts)
- [backend/tests/scrapers/kalamunda.test.ts](/Users/umarsiddiqui/Desktop/BinMate/backend/tests/scrapers/kalamunda.test.ts)
- [backend/prisma/seed-kalamunda.ts](/Users/umarsiddiqui/Desktop/BinMate/backend/prisma/seed-kalamunda.ts)
- [backend/src/scrapers/registry.ts](/Users/umarsiddiqui/Desktop/BinMate/backend/src/scrapers/registry.ts)
- [COUNCILS.md](/Users/umarsiddiqui/Desktop/BinMate/COUNCILS.md)
- [PLAN.md](/Users/umarsiddiqui/Desktop/BinMate/PLAN.md)
- [HANDOFF.md](/Users/umarsiddiqui/Desktop/BinMate/HANDOFF.md)

**Currently broken / in progress:**
- Kalamunda implementation complete; tests and TypeScript build pass.
- Existing unrelated workspace change remains in `ios/Bin Mate` (not reverted).

**Next task:**
- Implement the next remaining council scraper (likely Gosnells or Victoria Park) with the same checklist: scraper + tests + seed + registry/docs updates.

**Known issues:**
- Kalamunda search endpoint does not match full comma-formatted addresses reliably; resolver intentionally uses street/suburb terms and candidate ranking to compensate.
