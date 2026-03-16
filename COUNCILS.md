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
- **Platform:** PDF calendar (Group 1 / Group 2)
- **Lookup URL:** `https://www.wanneroo.wa.gov.au/bincollections`
- **PDF URL:** `https://www.wanneroo.wa.gov.au/downloads/file/5709/kerbside_collection_calendar_-_2025.pdf`
- **Data format:** Two suburb groups (Group 1, Group 2), monthly calendar grid
- **Data notes:** Group 1 and Group 2 have slightly different rotation offsets. Extract suburb list from each group. Calendar shows which bins go out each week.
- **Test address 1:** "14 Hainsworth Ave, Girrawheen WA 6064" — Group 1
- **Test address 2:** "5 Shoal Way, Clarkson WA 6030" — Group 2
- **Scraper file:** `backend/src/scrapers/wanneroo.ts`
- **Status:** [ ] Not started
- **Notes:** Annual PDF — refresh every January. They also publish iCal on the same page.

### City of Armadale
- **Population:** ~130,000
- **Slug:** armadale
- **Platform:** Custom address widget (IntraMaps-based)
- **Lookup URL:** `https://my.armadale.wa.gov.au/service/waste-and-recycling/find-your-bin-collection-day/`
- **API endpoint:** TBD — audit in Phase 1.1
- **Test address 1:** "23 Sexty St, Armadale WA 6112"
- **Test address 2:** "270 Skeet Rd, Harrisdale WA 6112"
- **Scraper file:** `backend/src/scrapers/armadale.ts`
- **Status:** [ ] Not started
- **Notes:** Open-source scraper exists at github.com/mampfes/hacs_waste_collection_schedule — pull request #4034 merged May 2025. Returns 78 entries per address (full year). Adapt from Python to TypeScript.

### City of Fremantle
- **Population:** ~35,000
- **Slug:** fremantle
- **Platform:** ArcGIS (likely) + interactive map
- **Lookup URL:** `https://www.fremantle.wa.gov.au/waste-and-environment/residential-waste/bin-collection/`
- **API endpoint:** TBD — audit in Phase 1.1
- **Test address 1:** "15 South Tce, Fremantle WA 6160"
- **Scraper file:** `backend/src/scrapers/fremantle.ts`
- **Status:** [ ] Not started
- **Notes:** Their page confirms: public holidays shift by one day — Christmas, New Year, Good Friday only.

### City of Cockburn
- **Population:** ~130,000
- **Slug:** cockburn
- **Platform:** ArcGIS (likely — confirmed geohub presence)
- **Lookup URL:** `https://www.cockburn.wa.gov.au/Environment-and-Waste/Rubbish-Waste-and-Recycling/Bin-Collections`
- **API endpoint:** TBD
- **Test address 1:** "1 Wentworth Pde, Success WA 6164"
- **Scraper file:** `backend/src/scrapers/cockburn.ts`
- **Status:** [ ] Not started

### City of Melville
- **Population:** ~115,000
- **Slug:** melville
- **Platform:** TBD — audit required
- **Lookup URL:** TBD
- **Test address 1:** TBD
- **Scraper file:** `backend/src/scrapers/melville.ts`
- **Status:** [ ] Not started

### City of Canning
- **Population:** ~120,000
- **Slug:** canning
- **Platform:** Address widget — "Enter your address above to learn when your next collection date is"
- **Lookup URL:** `https://www.canning.wa.gov.au/residents/waste-and-recycling/bins-and-collection-days/`
- **API endpoint:** TBD — audit in Phase 1.1
- **Test address 1:** "1 Manning Rd, Cannington WA 6107"
- **Scraper file:** `backend/src/scrapers/canning.ts`
- **Status:** [ ] Not started
- **Notes:** Website text confirmed as having address search widget. Likely AJAX call.

### City of Swan
- **Population:** ~180,000
- **Slug:** swan
- **Platform:** TBD — audit required
- **Lookup URL:** TBD
- **Test address 1:** "1 Great Northern Hwy, Midland WA 6056"
- **Scraper file:** `backend/src/scrapers/swan.ts`
- **Status:** [ ] Not started

### City of South Perth
- **Population:** ~55,000
- **Slug:** southperth
- **Platform:** T1Cloud — `cosp.t1cloud.com`
- **Lookup URL:** `https://southperth.wa.gov.au/residents/waste-and-recycling/kerb-side-collection`
- **API endpoint:** TBD — `cosp.t1cloud.com` — reverse engineer via DevTools
- **Test address 1:** "1 Coode St, South Perth WA 6151"
- **Scraper file:** `backend/src/scrapers/southperth.ts`
- **Status:** [ ] Not started
- **Notes:** T1Cloud is shared WA council SaaS. If we crack the API pattern here, may apply to other T1Cloud councils. Their verge collection switched to "Verge Valet" pre-booked system from July 2025 — handle differently.

### City of Stirling
- **Population:** ~220,000
- **Slug:** stirling
- **Platform:** Salesforce Experience Cloud — `stirling.my.site.com`
- **Lookup URL:** `https://www.stirling.wa.gov.au/waste-and-environment/waste-and-recycling/bin-collections`
- **Salesforce domain:** `stirling.my.site.com`
- **API endpoint:** TBD — requires Salesforce API reverse engineering
- **Test address 1:** "45 Scarborough Beach Rd, Scarborough WA 6019"
- **Test address 2:** "12 Cedric St, Stirling WA 6021"
- **Scraper file:** `backend/src/scrapers/stirling.ts`
- **Status:** [ ] Not started
- **Notes:** LARGEST COUNCIL — 220,000 residents. Hardest technically. Salesforce SPA. 
  Alternative: They publish Week 1 and Week 2 PDF calendars. Fall back to PDF if Salesforce API is too locked.
  Week 1 PDF: available on their waste guide page.
  Week 2 PDF: available on their waste guide page.
  Bin day is also in their 2025/26 digital Waste Guide via address search.

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
- **Platform:** TBD
- **Scraper file:** `backend/src/scrapers/bayswater.ts`
- **Status:** [ ] Not started

### City of Vincent
- **Population:** ~35,000
- **Slug:** vincent
- **Platform:** Address widget confirmed — `vincent.wa.gov.au/your-home/waste-recycling/your-bin-day.aspx`
- **Scraper file:** `backend/src/scrapers/vincent.ts`
- **Status:** [ ] Not started

### City of Rockingham
- **Population:** ~145,000
- **Slug:** rockingham
- **Platform:** TBD
- **Scraper file:** `backend/src/scrapers/rockingham.ts`
- **Status:** [ ] Not started

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
- **Scraper file:** `backend/src/scrapers/gosnells.ts`
- **Status:** [ ] Not started

### City of Kalamunda
- **Population:** ~60,000
- **Slug:** kalamunda
- **Scraper file:** `backend/src/scrapers/kalamunda.ts`
- **Status:** [ ] Not started

### Town of Victoria Park
- **Population:** ~40,000
- **Slug:** victoriapark
- **Scraper file:** `backend/src/scrapers/victoriapark.ts`
- **Status:** [ ] Not started

### City of Nedlands
- **Population:** ~22,000
- **Slug:** nedlands
- **Scraper file:** `backend/src/scrapers/nedlands.ts`
- **Status:** [ ] Not started

### Town of Cambridge
- **Population:** ~25,000
- **Slug:** cambridge
- **Scraper file:** `backend/src/scrapers/cambridge.ts`
- **Status:** [ ] Not started

---

## Priority 3 — Smaller Councils

### Town of Claremont
- **Population:** ~12,000
- **Slug:** claremont
- **Scraper file:** `backend/src/scrapers/claremont.ts`
- **Status:** [ ] Not started

### Town of Cottesloe
- **Population:** ~7,500
- **Slug:** cottesloe
- **Scraper file:** `backend/src/scrapers/cottesloe.ts`
- **Status:** [ ] Not started

### Town of Mosman Park
- **Population:** ~9,000
- **Slug:** mosmanpark
- **Scraper file:** `backend/src/scrapers/mosmanpark.ts`
- **Status:** [ ] Not started

### Shire of Peppermint Grove
- **Population:** ~2,000
- **Slug:** peppermintgrove
- **Scraper file:** `backend/src/scrapers/peppermintgrove.ts`
- **Status:** [ ] Not started

### City of Subiaco
- **Population:** ~20,000
- **Slug:** subiaco
- **Scraper file:** `backend/src/scrapers/subiaco.ts`
- **Status:** [ ] Not started

### City of East Fremantle
- **Population:** ~7,000
- **Slug:** eastfremantle
- **Scraper file:** `backend/src/scrapers/eastfremantle.ts`
- **Status:** [ ] Not started

### City of Bassendean
- **Population:** ~15,000
- **Slug:** bassendean
- **Scraper file:** `backend/src/scrapers/bassendean.ts`
- **Status:** [ ] Not started

### City of Kwinana
- **Population:** ~45,000
- **Slug:** kwinana
- **Scraper file:** `backend/src/scrapers/kwinana.ts`
- **Status:** [ ] Not started

### Shire of Serpentine-Jarrahdale
- **Population:** ~35,000
- **Slug:** serpentinejj
- **Scraper file:** `backend/src/scrapers/serpentinejj.ts`
- **Status:** [ ] Not started

### Shire of Mundaring
- **Population:** ~35,000
- **Slug:** mundaring
- **Scraper file:** `backend/src/scrapers/mundaring.ts`
- **Status:** [ ] Not started

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

*Last updated: March 2026*
*Update this file when scraper audits are completed in Phase 1.1*
