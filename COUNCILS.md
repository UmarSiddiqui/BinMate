# BinMate — Council Data Source Registry
> Updated as scraper audits are completed.
> Every scraper must be registered here before merging.

---

## Registry Format

```
### Council Name
- **Population:** ~XXXk
- **Slug:** council-slug (matches scraper filename)
- **Platform:** ArcGIS | PDF | T1Cloud | Salesforce | Custom widget
- **Lookup URL:** https://...
- **API endpoint:** https://... (discovered via DevTools)
- **Request method:** GET | POST
- **Request payload:** { ... }
- **Response structure:** { ... }
- **Auth required:** None | Cookie | CSRF | API key
- **Rate limit notes:** ...
- **Test address 1:** "Street, Suburb WA XXXX" — expected zone: ...
- **Test address 2:** "Street, Suburb WA XXXX" — expected zone: ...
- **Scraper file:** backend/src/scrapers/council-slug.ts
- **Status:** [ ] Not started | [~] In progress | [x] Complete | [!] Blocked
- **Notes:** ...
```

---

## Priority 1 — Top 9 Councils (launch target)

### City of Wanneroo
- **Population:** ~210,000
- **Slug:** wanneroo
- **Platform:** PDF calendar (static suburb→zone map, 30 suburbs, 9 zones)
- **Lookup URL:** `https://www.wanneroo.wa.gov.au/bincollections`
- **API approach:** Nominatim geocodes address → suburb name → static zone lookup (no live API)
- **Zone codes:** `WAN-{DAY_ABBREV}-{A|B}` e.g. `WAN-MON-A`
- **Test address 1:** "14 Hainsworth Ave, Girrawheen WA 6064" → WAN-MON-A
- **Test address 2:** "5 Shoal Way, Clarkson WA 6030" → WAN-WED-A
- **Test address 3:** "12 Sinagra St, Sinagra WA 6065" → WAN-FRI-A
- **Scraper file:** `backend/src/scrapers/wanneroo.ts`
- **Seed file:** `backend/prisma/seed-wanneroo.ts` — 9 zones seeded ✅
- **Status:** [x] Complete ✅
- **Notes:** Annual PDF — static map derived from PDF. General waste weekly; recycling + green waste fortnightly opposite weeks. Council row ID: `e6d72c4e-32d9-441b-a4e6-d7a5dc6476e3`. Refresh map every January from new PDF.

### City of Armadale
- **Population:** ~130,000
- **Slug:** armadale
- **Platform:** Custom REST API (reverse-engineered from Next.js frontend)
- **Lookup URL:** `https://my.armadale.wa.gov.au/service/waste-and-recycling/find-your-bin-collection-day/`
- **API endpoint:** `GET https://api.my.armadale.wa.gov.au/bins?address={street}`
- **Request method:** GET (street portion only — comma-split, not full qualified address)
- **Response structure:** `{ address, bin_day, recycle_area, vergeside_zone }`
- **Auth required:** None
- **Zone codes:** `ARM-{DAY_ABBREV}-{1|2}` — Area 1 = recycling Week A, Area 2 = recycling Week B
- **Test address 1:** "23 Sexty St, Armadale WA 6112" → WED-1 (Wed, Area 1)
- **Test address 2:** "270 Skeet Rd, Harrisdale WA 6112" → THU-2 (Thu, Area 2)
- **Scraper file:** `backend/src/scrapers/armadale.ts`
- **Seed file:** `backend/prisma/seed-armadale.ts` — 10 zones seeded ✅
- **Status:** [x] Complete ✅
- **Notes:** Council row ID: `93961ddc-f962-46e4-928e-56a3244ba070`. 12/12 tests passing. Area 1 → recycling Week A, Area 2 → recycling Week B (verified 2026-03-16).

### City of Fremantle
- **Population:** ~35,000
- **Slug:** fremantle
- **Platform:** ArcGIS FeatureServer (public, no auth)
- **Lookup URL:** `https://www.fremantle.wa.gov.au/waste-and-environment/residential-waste/bin-collection/`
- **API endpoint:** `services3.arcgis.com — Domestic_waste_collection_areas/FeatureServer/60`
- **Request method:** GET (point query with geocoded lat/lng)
- **Auth required:** None
- **Zone codes:** `FRE-{1-7}` e.g. `FRE-4`; 6 zones (Mon×2, Tue, Wed, Thu, Fri)
- **Test address 1:** "15 South Tce, Fremantle WA 6160" → FRE-4 (Tuesday)
- **Scraper file:** `backend/src/scrapers/fremantle.ts`
- **Seed file:** `backend/prisma/seed-fremantle.ts` — 6 zones seeded ✅
- **Status:** [x] Complete ✅
- **Notes:** FOGO (dark green lid) weekly; general waste (red lid) fortnightly Week A; recycling (yellow lid) fortnightly Week B — all zones recyclingWeek = 'B'. Council row ID: `19c27fce-df87-4c68-b277-831f5fa41f7c`. 13/13 tests passing.

### City of Cockburn
- **Population:** ~130,000
- **Slug:** cockburn
- **Platform:** Custom widget API (`gis1.cockburn.wa.gov.au/webapiv2`)
- **Lookup URL:** `https://www.cockburn.wa.gov.au/Environment-and-Waste/Rubbish-Waste-and-Recycling/Bin-Collections`
- **API endpoints:**
  - `GET /LikeSearch` or `/FuzzySearch` → property `dbkey`
  - `GET /PropertyInfoSearch/PropertyNo?q={dbkey}` → `BinDay`, `GardenWaste`, verge `Area`, verge dates
- **Auth required:** None
- **Zone codes:** `CKB-{DAY_ABBREV}-{GARDEN_WEEK}-{VERGE_AREA}` — 110 seeded combinations
- **Test address 1:** "1 Wentworth Pde, Success WA 6164"
- **Scraper file:** `backend/src/scrapers/cockburn.ts`
- **Seed file:** `backend/prisma/seed-cockburn.ts` — 110 zones seeded ✅
- **Status:** [x] Complete ✅
- **Notes:** Weekly general + weekly recycling; garden organics fortnightly when applicable. Verge area is separate from kerbside bin day / garden parity.

### City of Melville
- **Population:** ~115,000
- **Slug:** melville
- **Platform:** T1Cloud static API (Intramaps — `gis.melvillecity.com.au`)
- **Lookup URL:** `https://melvillecity.com.au`
- **API endpoints:**
  - `GET /reproject` (WGS84 → EPSG:7850)
  - `GET /search` (waste layer, API key embedded in public frontend JS)
- **Response fields:** `collection_district`, `GreenLid`, `RedLid`, `YellowLid`
- **Auth required:** API key in query param (from public JS)
- **Zone codes:** `MEL-{DAY_ABBREV}-{A|B}` — 10 zones (5 days × 2 recycling weeks)
- **Test address 1:** "5 Kintail Rd, Applecross WA 6153" → MEL-MON-A
- **Test address 2:** "12 Ardross St, Ardross WA 6153" → MEL-WED-B
- **Scraper file:** `backend/src/scrapers/melville.ts`
- **Seed file:** `backend/prisma/seed-melville.ts` — 10 zones seeded ✅
- **Status:** [x] Complete ✅
- **Notes:** Recycling week determined by parsing YellowLid date vs WEEK_A_REFERENCE. Council ID: `0ddbb441-a515-423e-b649-8ccde4553f51`. 13/13 tests passing.

### City of Canning
- **Population:** ~120,000
- **Slug:** canning
- **Platform:** Custom two-step REST API
- **Lookup URL:** `https://www.canning.wa.gov.au/residents/waste-and-recycling/bins-and-collection-days/`
- **API endpoints:**
  - `GET /api/property-details/find/{encodedSearchTerm}` → `[{key, address}]`
  - `GET /api/property-details/bins/{key}` → `{rubbishCollectionDate, recyclingCollectionDate, ...}`
- **Auth required:** None
- **Zone codes:** `CAN-{DAY_ABBREV}-{A|B}` — 10 zones (5 days × 2 recycling weeks)
- **Test address 1:** "31 Manning Rd, Cannington WA 6107" → CAN-WED-B
- **Test address 2:** "15 Wharf St, Queens Park WA 6107" → CAN-FRI-B
- **Test address 3:** "22 Harrison St, Bentley WA 6102" → CAN-MON-A
- **Scraper file:** `backend/src/scrapers/canning.ts`
- **Seed file:** `backend/prisma/seed-canning.ts` — 10 zones seeded ✅
- **Status:** [x] Complete ✅
- **Notes:** Dates are midnight AWST expressed as UTC — add 8h to get AWST calendar date. Street abbreviations must be expanded (Rd→Road, etc.) or API returns 204. Council ID: `b49fecaf-35e4-4aca-8d71-983fbcde831c`. 14/14 tests passing.

### City of Swan
- **Population:** ~180,000
- **Slug:** swan
- **Platform:** T1Cloud Intramaps (session-based auth, 4-step flow)
- **Lookup URL:** `https://swan.spatial.t1cloud.com`
- **API endpoints:** T1Cloud session flow — Projects → Modules → Search → Refine/Set
- **Auth required:** Anonymous session token via `x-intramaps-session`
- **Zone codes:** `SWA-{DAY_ABBREV}-{A|B}` — 10 zones (5 days × 2 recycling weeks)
- **Test address 1:** "12 Morrison Road, Midland WA 6056" → SWA-TUE-A
- **Scraper file:** `backend/src/scrapers/swan.ts`
- **Seed file:** `backend/prisma/seed-swan.ts` — 10 zones seeded ✅
- **Status:** [x] Complete ✅
- **Notes:** 14/14 tests passing.

### City of South Perth
- **Population:** ~55,000
- **Slug:** southperth
- **Platform:** T1Cloud Intramaps (session-based, `cosp.spatial.t1cloud.com`)
- **Lookup URL:** `https://southperth.wa.gov.au/residents/waste-and-recycling/kerb-side-collection`
- **API endpoints:** T1Cloud session flow — Projects (appType=Standard, project=Public) → Modules → Search → Refine/Set; waste data in `infoPanels.info2`
- **Auth required:** `X-Requested-With` header required; anonymous session token
- **Zone codes:** `COSP-{DAY_ABBREV}-{A|B}` — 10 zones (5 days × 2 recycling weeks)
- **Test address 1:** "1 Sandgate Street, South Perth WA 6151" → COSP-TUE-A
- **Scraper file:** `backend/src/scrapers/southperth.ts`
- **Seed file:** `backend/prisma/seed-southperth.ts` — 10 zones seeded ✅
- **Status:** [x] Complete ✅
- **Notes:** Council ID: `ea021a6a-7b30-4408-abbd-75916d14411d`. Verge Valet is pre-booked (no fixed dates) — link to booking page rather than showing dates.

### City of Stirling
- **Population:** ~220,000
- **Slug:** stirling
- **Platform:** OpenCities custom widget (NOT Salesforce — confirmed via DevTools)
- **Lookup URL:** `https://www.stirling.wa.gov.au/waste-and-environment/waste-and-recycling/bin-collections`
- **API endpoint:** `GET https://www.stirling.wa.gov.au/bincollectioncheck/getresult`
- **Request method:** GET with custom headers: `configid`, `form`, `fields=lng,lat`, `Referer` required
- **Auth required:** `Referer` header (stirling.wa.gov.au); no cookies/CSRF
- **Zone codes:** `STI-{DAY_ABBREV}-{A|B}` — 10 zones; green waste = opposite week to recycling
- **Test address 1:** "45 Scarborough Beach Rd, Scarborough WA 6019" → STI-WED-A
- **Test address 2:** "12 Cedric St, Stirling WA 6021" → STI-FRI-A
- **Scraper file:** `backend/src/scrapers/stirling.ts`
- **Seed file:** `backend/prisma/seed-stirling.ts` — 10 zones seeded ✅
- **Status:** [x] Complete ✅
- **Notes:** Coordinate-based lookup (point-in-polygon against parcels). 45/45 tests passing. Council ID: `8ef3fd59-ae75-4c15-8ac2-cb1c7a5dc489`. Nominatim returns road centroids for major arterials — scraper returns informative error for those. Residential addresses resolve correctly.

---

## Priority 2 — Post-Launch Councils

### City of Joondalup
- **Population:** ~180,000
- **Slug:** joondalup
- **Platform:** Custom website widget API
- **Lookup URL:** `https://www.joondalup.wa.gov.au/residents/waste-and-recycling/residential-bin-collections`
- **API endpoints:** `GET /aapi/coj/propertylookup/{address}` and `GET /aapi/coj/bindatelookup/{mapkey}`
- **Test address 1:** "1 King Edward Drive, Heathridge WA 6027" — JOO-THU-A
- **Test address 2:** "90 Boas Avenue, Joondalup WA 6027" — JOO-FRI-B
- **Scraper file:** `backend/src/scrapers/joondalup.ts`
- **Status:** [x] Complete
- **Notes:** Resolver ranks candidate properties and retries `bindatelookup` across top candidates to skip non-serviced freeway/map features.

### City of Bayswater
- **Population:** ~70,000
- **Slug:** bayswater
- **Platform:** T1Cloud IntraMaps MapBuilder
- **Lookup URL:** `https://www.bayswater.wa.gov.au/bins`
- **API endpoints:**
  - `GET /Configuration/PublicLite/Config/{liteConfigId}?configId=...`
  - `POST /Projects/?configId=...&appType=MapBuilder&project=...`
  - `POST /Modules/?IntraMapsSession=...`
  - `POST /Search/?...&form=...&selectionLayersFilter=...`
  - `POST /Search/Refine/Set?IntraMapsSession=...`
- **Request method:** POST (except config bootstrap GET)
- **Request payload:** `Projects → Modules → Search(fullText) → Search/Refine/Set`
- **Response structure:** `Search.fullText[]` candidates + `infoPanels.info1.feature.fields`
  (`Area`, `FOGO Green Lid`, `Waste Red Lid`, `Recycling Yellow Lid`)
- **Auth required:** None (anonymous session via `x-intramaps-session`)
- **Rate limit notes:** capped to 1 request/second in scraper
- **Test address 1:** "61 Broun Avenue, Morley WA 6062" — BAY-WED-A
- **Test address 2:** "1 Crimea Street, Morley WA 6062" — BAY-TUE-B
- **Scraper file:** `backend/src/scrapers/bayswater.ts`
- **Status:** [x] Complete
- **Notes:** Area 1 maps to recycling Week B and Area 2 maps to recycling Week A. Resolver also falls back to parsing `Recycling Yellow Lid` date text if Area is missing.

### City of Vincent
- **Population:** ~35,000
- **Slug:** vincent
- **Platform:** Pozi/QGIS widget
- **Lookup URL:** `https://www.vincent.wa.gov.au/your-home/waste-recycling/your-bin-day.aspx`
- **API endpoint:** `GET https://mapping.vincent.wa.gov.au/pozi/qgisserver` (`SERVICE=WFS`, `REQUEST=GetFeature`, `TYPENAME=Waste_Collection`)
- **Request method:** GET
- **Request payload:** WFS params + XML filter on `Address` via `PropertyIsLike`
- **Response structure:** GeoJSON FeatureCollection with HTML fields:
  `General Waste Collection Day`, `Recycling Collection Day`, `FOGO Collection Day`
- **Auth required:** None
- **Rate limit notes:** capped to 1 request/second in scraper
- **Test address 1:** "2 Chertsey Street, Mount Lawley WA 6050" — VIN-FRI-A
- **Test address 2:** "17 Simpson Street, West Perth WA 6005" — VIN-WED-B
- **Scraper file:** `backend/src/scrapers/vincent.ts`
- **Status:** [x] Complete
- **Notes:** Resolver uses address-filtered WFS lookup and parses residential patterns only (fortnightly general + fortnightly recycling + weekly FOGO on same weekday).

### City of Rockingham
- **Population:** ~145,000
- **Slug:** rockingham
- **Platform:** T1Cloud IntraMaps (Near Me)
- **Lookup URL:** `https://www.rockingham.wa.gov.au/your-services/waste-and-recycling/bin-collection`
- **API endpoints:**
  - `GET /IntraMaps23A/ApplicationEngine/Configuration/PublicLite/Config/{liteConfigId}?configId=...`
  - `POST /IntraMaps23A/ApplicationEngine/Projects/?configId=...&appType=MapBuilder&project=...`
  - `POST /IntraMaps23A/ApplicationEngine/Modules/?IntraMapsSession=...`
  - `POST /IntraMaps23A/ApplicationEngine/Search/?...&form=...&selectionLayersFilter=...`
  - `POST /IntraMaps23A/ApplicationEngine/Search/Refine/Set?IntraMapsSession=...`
- **Request method:** `GET` + session-based `POST`
- **Request payload:** `Projects → Modules → Search(fullText) → Search/Refine/Set`
- **Response structure:** `Search.fullText[]` candidates + `infoPanels.info1.feature.fields`
  (`FOGO Bin (FOGO lid)`, `Recycle (Yellow Lid)`, `Waste (Red Lid)`, verge fields)
- **Auth required:** None (anonymous session via `x-intramaps-session`)
- **Rate limit notes:** capped to 1 request/second in scraper
- **Test address 1:** "Sixty Eight Road, Baldivis WA 6171" — ROC-THU-B-A-W
- **Test address 2:** "Warnbro Sound Avenue, Warnbro WA 6169" — ROC-FRI-A-W-N
- **Scraper file:** `backend/src/scrapers/rockingham.ts`
- **Status:** [x] Complete
- **Notes:** Address search is street/suburb oriented (fully-formatted addresses often return no candidates), so scraper retries with fallback search terms.

### City of Belmont
- **Population:** ~35,000
- **Slug:** belmont
- **Platform:** IntraMaps (City website API)
- **Lookup URL:** `https://www.belmont.wa.gov.au/bin-collections`
- **API endpoints:** `GET /api/intramaps/getaddresses?key={address}` and `GET /api/intramaps/getpropertydetailsbymapdbkey?mapkey={mapkey}&dbkey={dbkey}`
- **Test address 1:** "1B Keady Street, Belmont WA 6104" — BEL-FOGO-THU-A-O
- **Test address 2:** "4 Fulham Street, Kewdale WA 6105" — BEL-FOGO-TUE-B-S
- **Scraper file:** `backend/src/scrapers/belmont.ts`
- **Status:** [x] Complete
- **Notes:** Supports both FOGO and standard properties; zone code encodes whether FOGO runs in the same week or opposite week to recycling.

### City of Gosnells
- **Population:** ~130,000
- **Slug:** gosnells
- **Platform:** Custom City API widget (`API/waste/v8`)
- **Lookup URL:** `https://www.gosnells.wa.gov.au/Your_property/Rubbish_and_recycling/Find_your_waste_collection_dates`
- **API endpoints:** `POST /API/waste/v8/address` and `GET /API/waste/v8/propertyNum/{propertyNo}`
- **Request method:** `POST` + `GET`
- **Request payload:** `{ "query": "address string" }` then property number lookup
- **Response structure:** address candidates (`Address`, `property_no`) then property schedule (`rubbish_day`, `recycling`, verge date fields)
- **Auth required:** None
- **Rate limit notes:** capped to 1 request/second in scraper
- **Test address 1:** "1 Adams Road, Thornlie WA 6108" — GOS-WED-A
- **Test address 2:** "41 Wheatley Street, Gosnells WA 6110" — GOS-MON-B
- **Scraper file:** `backend/src/scrapers/gosnells.ts`
- **Status:** [x] Complete
- **Notes:** Resolver applies suburb-match guard to reject nearest-address fallbacks for out-of-area inputs; green/verge dates are dynamic and not encoded into zone codes.

### City of Kalamunda
- **Population:** ~60,000
- **Slug:** kalamunda
- **Platform:** T1Cloud IntraMaps (MapBuilder)
- **Lookup URL:** `https://www.kalamunda.wa.gov.au/kerbside-3-bin-system/collection-days/bin-day`
- **API endpoint:** `POST https://kalamunda.spatial.t1cloud.com/spatial/intramaps/ApplicationEngine`
- **Request method:** POST (session-based sequence)
- **Request payload:** `Projects → Modules → Search(fullText) → Search/Refine/Set`
- **Response structure:** `Search.fullText[]` candidates + `infoPanels.info1.feature.fields` (`Bin Day`, `Bin Area`)
- **Auth required:** None (anonymous session via `x-intramaps-session`)
- **Rate limit notes:** capped to 1 request/second in scraper
- **Test address 1:** "1 Amaroo Street, Lesmurdie WA 6076" — KAL-FRI-A
- **Test address 2:** "1 Barron Road, Kalamunda WA 6076" — KAL-THU-B
- **Scraper file:** `backend/src/scrapers/kalamunda.ts`
- **Status:** [x] Complete
- **Notes:** Area One maps to recycling Week A; Area Two maps to recycling Week B. Resolver uses street-first search and suburb fallback with candidate ranking.

### Town of Victoria Park
- **Population:** ~40,000
- **Slug:** victoriapark
- **Platform:** Pozi/QGIS (Core + OurTown projects)
- **Lookup URL:** `https://www.victoriapark.wa.gov.au/residents/waste-and-recycling/bins-and-collections.aspx`
- **API endpoints:** `GET https://maps.vicpark.wa.gov.au/pozi/qgisserver` with:
  - `TYPENAME=Property_-_Address` (Core.qgs) for address polygon lookup
  - `TYPENAME=Waste_Collection` (OurTown.qgs) for collection-zone polygon lookup
- **Request method:** GET
- **Request payload:** WFS query params (`EXP_FILTER` for address match, then point `BBOX` for waste zone)
- **Response structure:** GeoJSON FeatureCollections with fields:
  - `FOGO Collection`
  - `General Waste 3bin system with FOGO`
  - `Recycling Collection`
- **Auth required:** None
- **Rate limit notes:** capped to 1 request/second in scraper
- **Test address 1:** "99 Shepperton Road, Victoria Park WA 6100" — TVP-TUE-B
- **Test address 2:** "1 Kent Street, Victoria Park WA 6100" — TVP-THU-A
- **Scraper file:** `backend/src/scrapers/victoriapark.ts`
- **Status:** [x] Complete
- **Notes:** Resolver uses property polygon center-point intersection into `Waste_Collection`; Group 1 maps to recycling Week B and Group 2 maps to Week A.

### City of Nedlands
- **Population:** ~22,000
- **Slug:** nedlands
- **Platform:** Self-hosted IntraMaps 21b (`gispublic01.nedlands.wa.gov.au`)
- **Lookup URL:** `https://www.nedlands.wa.gov.au/waste`
- **API endpoints:** T1Cloud-style 4-step flow: Projects (startToken) → Modules → Search → Refine/Set
- **Auth required:** Anonymous session; uses `startToken` (static UUID) instead of configId
- **Zone codes:** `NED-{DAY_ABBREV}-{A|B}` — 10 zones (5 days × 2 recycling weeks)
- **Test address 1:** "14B Adderley Street, Mt Claremont WA 6010" → NED-MON-A
- **Scraper file:** `backend/src/scrapers/nedlands.ts`
- **Seed file:** `backend/prisma/seed-nedlands.ts` ✅
- **Status:** [x] Complete ✅
- **Notes:** FOGO (lime green) collected weekly; recycling and general waste fortnightly on same day (opposite weeks). Waste fields: `FOGO Collection Day`, `Next Recycling Bin Day`. Verified 2026-03-16.

### Town of Cambridge
- **Population:** ~25,000
- **Slug:** cambridge
- **Platform:** OpenCities "my area" API (`cambridge.wa.gov.au`)
- **Lookup URL:** `https://www.cambridge.wa.gov.au`
- **API endpoints:**
  - `GET /api/v1/myarea/searchfuzzy?keywords={address}&maxresults=5` → `{Items: [{Id, AddressSingleLine}]}`
  - `GET /ocapi/Public/myarea/wasteservices?geolocationid={id}&ocsvclang=en-AU&pageLink=...` → HTML with service cards
- **Auth required:** None
- **Zone codes:** `CAM-{FOGO|STD}-{DAY_ABBREV}-{A|B}` — encodes whether property has FOGO
- **Test address 1:** "10 Floreat Avenue, Floreat WA 6014" → CAM-FOGO-WED-B
- **Test address 2:** "40 Salvado Road, Wembley WA 6014" → CAM-STD-FRI-A
- **Scraper file:** `backend/src/scrapers/cambridge.ts`
- **Seed file:** `backend/prisma/seed-cambridge.ts` ✅
- **Status:** [x] Complete ✅
- **Notes:** Cambridge supports both FOGO and non-FOGO properties. Waste response is HTML; parsed with regex for service cards (title + nextService date). Verified live 2026-03-16.

---

## Priority 3 — Smaller Councils

### Town of Claremont
- **Population:** ~12,000
- **Slug:** claremont
- **Platform:** GeoJSON ward polygons embedded in council JS bundle + PDF calendar parity
- **Lookup URL:** `https://www.claremont.wa.gov.au`
- **API approach:** Nominatim geocodes address → suburb → ward polygon lookup (GeoJSON from bundle JS)
- **Zone codes:** `CLR-{DAY_ABBREV}-B` (all zones are recycling Week B — recycling is opposite to green = Week B)
- **Test address 1:** "44 Bay View Tce, Claremont WA 6010"
- **Scraper file:** `backend/src/scrapers/claremont.ts`
- **Seed file:** pending
- **Status:** [x] Complete (scraper + tests) ✅ — seed not yet run
- **Notes:** 2025-26 calendar: Week starting 2026-01-05 is green waste → BinMate Week A = green, recycling = Week B. All Claremont zones share same week parity.

### Town of Cottesloe
- **Population:** ~7,500
- **Slug:** cottesloe
- **Platform:** PDF zone map (static street-boundary lookup) — 5 bin-day zones
- **Lookup URL:** `https://www.cottesloe.wa.gov.au`
- **API approach:** Nominatim geocodes address → suburb + street boundary lookup against static map
- **Zone codes:** `COT-{DAY_ABBREV}-A` (all zones recycling Week A — yellow week = 2026-01-05 start)
- **Test address 1:** "3 Napier St, Cottesloe WA 6011"
- **Scraper file:** `backend/src/scrapers/cottesloe.ts`
- **Seed file:** pending
- **Status:** [x] Complete (scraper + tests) ✅ — seed not yet run
- **Notes:** Calendar parity verified: yellow (recycling+FOGO) week begins 2026-01-05 → BinMate Week A = recycling week. FOGO weekly.

### Town of Mosman Park
- **Population:** ~9,000
- **Slug:** mosmanpark
- **Platform:** T1Cloud IntraMaps (public address form)
- **Lookup URL:** `https://mosmanpark.wa.gov.au/residents/rubbish-recycling-and-waste/`
- **API endpoints:**
  - `POST /Projects/?configId=...&appType=Standard&project=Mosman+Park+Public`
  - `POST /Modules/?IntraMapsSession=...`
  - `POST /Search/ComboContents?IntraMapsSession=...`
  - `POST /Search/?...&form=...&IntraMapsSession=...`
- **Request method:** `POST` (session-based)
- **Request payload:** `Projects → Modules → ComboContents(street/suburb) → Search(fields:[unit, houseNo, street, suburb])`
- **Response structure:** `infoPanels.info1.feature.fields` with `Bin Day` and `Recycling Day`
- **Auth required:** None (anonymous session token via `x-intramaps-session`)
- **Rate limit notes:** public endpoint; scraper uses request timeout and session flow guards
- **Test address 1:** "39 Jameson Street, Mosman Park WA 6012" — MOS-FRI-A
- **Test address 2:** "39 Jameson Street" — MOS-FRI-A
- **Scraper file:** `backend/src/scrapers/mosmanpark.ts`
- **Status:** [x] Complete
- **Notes:** Week 1 maps to BinMate Week A; weekly FOGO with recycling/general on alternating weeks.

### Shire of Peppermint Grove
- **Population:** ~2,000
- **Slug:** peppermintgrove
- **Platform:** PDF-derived static zone (single shire-wide schedule)
- **Lookup URL:** `https://www.peppermintgrove.wa.gov.au`
- **API approach:** No API — single hardcoded zone for entire shire (1 suburb, 1 schedule)
- **Zone codes:** `PEP-FRI-B` (only zone — FOGO + general waste weekly, recycling fortnightly Friday Week B)
- **Test address 1:** Any Peppermint Grove address → PEP-FRI-B
- **Scraper file:** `backend/src/scrapers/peppermintgrove.ts`
- **Seed file:** `backend/prisma/seed-peppermintgrove.ts` ✅
- **Status:** [x] Complete ✅
- **Notes:** 2026 calendar recycling dates include 2026-01-16 (Friday) = Week B per BinMate reference. FOGO weekly; general waste weekly; recycling fortnightly Friday.

### City of Subiaco
- **Population:** ~20,000
- **Slug:** subiaco
- **Platform:** T1Cloud IntraMaps (MapBuilder)
- **Lookup URL:** `https://subiaco.spatial.t1cloud.com`
- **API endpoints:**
  - `POST /Projects/?configId=...&project=...&appType=MapBuilder`
  - `POST /Modules/?IntraMapsSession=...`
  - `POST /Search/?...&form=...&IntraMapsSession=...`
  - `POST /Search/Refine/Set?IntraMapsSession=...`
- **Request method:** `POST` (session-based)
- **Response structure:** `Search.fullText[]` candidates + `infoPanels.info1.feature.fields` (`General Waste Collection`, `Recycle Collection`)
- **Auth required:** None (anonymous session via `x-intramaps-session`)
- **Rate limit notes:** public endpoint; scraper uses timeout/session guards
- **Test address 1:** "1 Rokeby Road, Subiaco WA 6008" — valid `SUB-{DAY}-{A|B}` zone
- **Test address 2:** "1 Stubbs Terrace, Daglish WA 6008" — valid `SUB-{DAY}-{A|B}` zone
- **Scraper file:** `backend/src/scrapers/subiaco.ts`
- **Status:** [x] Complete
- **Notes:** Week token is derived from response date parsing (not literal `Week 1/Week 2` text), as council week labels drift relative to BinMate parity.

### City of East Fremantle
- **Population:** ~7,000
- **Slug:** eastfremantle
- **Scraper file:** `backend/src/scrapers/eastfremantle.ts`
- **Status:** [x] Complete

### City of Bassendean
- **Population:** ~15,000
- **Slug:** bassendean
- **Scraper file:** `backend/src/scrapers/bassendean.ts`
- **Status:** [x] Complete

### City of Kwinana
- **Population:** ~45,000
- **Slug:** kwinana
- **Scraper file:** `backend/src/scrapers/kwinana.ts`
- **Status:** [x] Complete

### Shire of Serpentine-Jarrahdale
- **Population:** ~35,000
- **Slug:** serpentinejj
- **Scraper file:** `backend/src/scrapers/serpentinejj.ts`
- **Status:** [x] Complete

### Shire of Mundaring
- **Population:** ~35,000
- **Slug:** mundaring
- **Platform:** Custom MyMundaring widget
- **Lookup URL:** `https://my.mundaring.wa.gov.au/BinLocationInfo/Details`
- **API endpoints:**
  - `GET /Location/GetBinsLocation?term={text}`
  - `GET /BinLocationInfo/Info?parcelNumber={id}&suburb={suburb}`
- **Request method:** GET
- **Request payload:** autocomplete by `term`, then details by `parcelNumber` + `suburb`
- **Response structure:** JSON autocomplete candidates (`parcelnumber`, `streetdetails`, `suburb`) + HTML details (`Collection Area`, `FOGO Bin`, `Next Recycle Bin Date`, `Next General Waste Date`, verge dates)
- **Auth required:** None
- **Rate limit notes:** capped to 1 request/second in scraper
- **Test address 1:** "14 Mundaring Weir RD, Mundaring WA 6073" — MUN-WED-B
- **Test address 2:** "16 Mundaring Weir RD, Mundaring WA 6073" — MUN-WED-B
- **Scraper file:** `backend/src/scrapers/mundaring.ts`
- **Status:** [x] Complete
- **Notes:** Resolver performs multi-term fallback search, candidate ranking, and parses recycling parity from `dd/mm/yyyy` next-recycling date.

### City of Armadale outer areas (rural)
- Note: some rural Armadale addresses may not be covered by standard scraper
- **Status:** [ ] Investigate post-launch

---

## WA Public Holidays Reference

Seed into `wa_public_holidays` table. Update every November for following year.

### 2026
| Date | Name | Day | Shift to |
|---|---|---|---|
| 2026-01-01 | New Year's Day | Thursday | Friday 2026-01-02 |
| 2026-01-26 | Australia Day | Monday | No shift (already Monday) |
| 2026-04-03 | Good Friday | Friday | Saturday 2026-04-04 |
| 2026-04-06 | Easter Monday | Monday | Tuesday 2026-04-07 |
| 2026-04-25 | Anzac Day | Saturday | No collection shift (weekend) |
| 2026-06-01 | Western Australia Day | Monday | Tuesday 2026-06-02 |
| 2026-09-28 | Queen's Birthday (WA) | Monday | Tuesday 2026-09-29 |
| 2026-12-25 | Christmas Day | Friday | Saturday 2026-12-26 |
| 2026-12-26 | Boxing Day | Saturday | No collection shift (weekend) |

### 2027 (pre-seed)
| Date | Name | Day | Shift to |
|---|---|---|---|
| 2027-01-01 | New Year's Day | Friday | Saturday 2027-01-02 |
| 2027-01-26 | Australia Day | Tuesday | Wednesday 2027-01-27 |
| 2027-03-26 | Good Friday | Friday | Saturday 2027-03-27 |
| 2027-03-29 | Easter Monday | Monday | Tuesday 2027-03-30 |
| 2027-04-26 | Anzac Day (observed) | Monday | Tuesday 2027-04-27 |
| 2027-06-07 | Western Australia Day | Monday | Tuesday 2027-06-08 |
| 2027-09-27 | Queen's Birthday (WA) | Monday | Tuesday 2027-09-28 |
| 2027-12-27 | Christmas Day (observed) | Monday | Tuesday 2027-12-28 |
| 2027-12-28 | Boxing Day (observed) | Tuesday | Wednesday 2027-12-29 |

**Source:** `wa.gov.au/government/publications/public-holidays-western-australia`
**Update process:** Check WA Government website every November. Run `npx prisma studio` to add new rows manually, or write a seed script.

---

## Verge Collection Notes

Verge collection handling differs significantly between councils and is changing:

| Council | Verge Type | Frequency | Notes |
|---|---|---|---|
| City of Stirling | On-demand skip bins | Year-round | Replaced fixed dates in 2024 |
| City of South Perth | Verge Valet (pre-booked) | Year-round | Switched July 2025 — no fixed dates |
| City of Wanneroo | Pre-booked verge | Year-round | Booking system |
| City of Armadale | Fixed dates by area | 2x/year | Area-specific dates published on website |
| City of Fremantle | Fixed dates by area | Varies | Check website |
| Most other councils | Fixed dates by suburb | 1-4x/year | Published in annual waste guide |

**Implementation note:** For on-demand/pre-booked councils (Stirling, South Perth, Wanneroo), BinMate should link to their booking page rather than attempt to show dates. For fixed-date councils, extract and store verge dates in `collection_zones.verge_dates` as a JSONB array.

---

*Last updated: 2026-03-17 — all 29 councils audited and scrapers complete*
*Note: Seed files pending for Claremont, Cottesloe, EastFremantle, Bassendean, Kwinana, SerpentineJJ, Mundaring*
