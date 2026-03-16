## Handoff — 2026-03-16 22:50 AWST
**From:** Codex
**Completed in this session:**
- Added a Cambridge scraper in [backend/src/scrapers/cambridge.ts](/Users/umarsiddiqui/Desktop/BinMate/backend/src/scrapers/cambridge.ts) using the official OpenCities endpoints:
  `GET /api/v1/myarea/searchfuzzy` and `GET /ocapi/Public/myarea/wasteservices`.
- Supported both Cambridge service patterns:
  `CAM-FOGO-{DAY}-{WEEK}` for FOGO properties and `CAM-STD-{DAY}-{WEEK}` for non-FOGO properties.
- Added mocked scraper coverage in [backend/tests/scrapers/cambridge.test.ts](/Users/umarsiddiqui/Desktop/BinMate/backend/tests/scrapers/cambridge.test.ts).
- Added Cambridge seed data in [backend/prisma/seed-cambridge.ts](/Users/umarsiddiqui/Desktop/BinMate/backend/prisma/seed-cambridge.ts).
- Registered Cambridge in [backend/src/scrapers/registry.ts](/Users/umarsiddiqui/Desktop/BinMate/backend/src/scrapers/registry.ts).
- Live-verified Cambridge resolve/health behavior against the official site:
  `10 Floreat Avenue FLOREAT WA 6014 -> CAM-FOGO-WED-B`
  `40 Salvado Road WEMBLEY WA 6014 -> CAM-STD-FRI-A`
- Added a Peppermint Grove scraper in [backend/src/scrapers/peppermintgrove.ts](/Users/umarsiddiqui/Desktop/BinMate/backend/src/scrapers/peppermintgrove.ts) from the official 2026 recycling calendar PDF.
- Added tests in [backend/tests/scrapers/peppermintgrove.test.ts](/Users/umarsiddiqui/Desktop/BinMate/backend/tests/scrapers/peppermintgrove.test.ts) and seed data in [backend/prisma/seed-peppermintgrove.ts](/Users/umarsiddiqui/Desktop/BinMate/backend/prisma/seed-peppermintgrove.ts).
- Live-verified Peppermint Grove resolve/health behavior:
  `1 Leake Street Peppermint Grove WA 6011 -> PEP-FRI-B`
- Audited Mosman Park enough to confirm it is a T1Cloud/IntraMaps council with:
  configId `76eb48b5-17ab-4c7f-82a4-74e34b059b52`
  module `b42bbff6-d727-43d9-b548-2750e61e6318`
  address form `4d26c512-ecd2-4dd6-a36a-529489da356c`
  street combo template `8e4171d4-e94f-41ee-a41b-b64babe8d9f6`
  suburb combo template `5e0feb04-54fb-4196-81b2-9a54637b13e6`

**Files modified:**
- [HANDOFF.md](/Users/umarsiddiqui/Desktop/BinMate/HANDOFF.md)
- [backend/prisma/seed-cambridge.ts](/Users/umarsiddiqui/Desktop/BinMate/backend/prisma/seed-cambridge.ts)
- [backend/prisma/seed-peppermintgrove.ts](/Users/umarsiddiqui/Desktop/BinMate/backend/prisma/seed-peppermintgrove.ts)
- [backend/src/scrapers/cambridge.ts](/Users/umarsiddiqui/Desktop/BinMate/backend/src/scrapers/cambridge.ts)
- [backend/src/scrapers/peppermintgrove.ts](/Users/umarsiddiqui/Desktop/BinMate/backend/src/scrapers/peppermintgrove.ts)
- [backend/src/scrapers/registry.ts](/Users/umarsiddiqui/Desktop/BinMate/backend/src/scrapers/registry.ts)
- [backend/tests/scrapers/cambridge.test.ts](/Users/umarsiddiqui/Desktop/BinMate/backend/tests/scrapers/cambridge.test.ts)
- [backend/tests/scrapers/peppermintgrove.test.ts](/Users/umarsiddiqui/Desktop/BinMate/backend/tests/scrapers/peppermintgrove.test.ts)

**Currently broken / in progress:**
- Nothing newly broken from the Cambridge work.
- Nothing newly broken from the Cambridge or Peppermint Grove work.
- Mosman Park is only partially reverse-engineered; the combo lookup flow is identified, but the final search/refine request still needs to be reproduced cleanly outside the browser UI.
- `COUNCILS.md` remains stale overall; many already-implemented councils are still marked `Not started`.

**Next task:**
- Finish Mosman Park next. The likely path is:
  1. reproduce the combo-backed IntraMaps address search using the audited template IDs,
  2. inspect the resulting `Search` / `Refine` payloads,
  3. build `backend/src/scrapers/mosmanpark.ts`,
  4. add tests and `backend/prisma/seed-mosmanpark.ts`,
  5. register it in [backend/src/scrapers/registry.ts](/Users/umarsiddiqui/Desktop/BinMate/backend/src/scrapers/registry.ts).

**Known issues:**
- The worktree is dirty with many unrelated changes; do not revert broad file sets.
- Remaining documented councils after Cambridge and Peppermint Grove: `joondalup`, `bayswater`, `vincent`, `rockingham`, `belmont`, `gosnells`, `kalamunda`, `victoriapark`, `claremont`, `cottesloe`, `mosmanpark`, `eastfremantle`, `bassendean`, `kwinana`, `serpentinejj`, `mundaring`.
