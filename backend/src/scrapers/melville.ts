/**
 * City of Melville — bin collection scraper.
 *
 * Data source: T1Cloud Intramaps spatial API (reverse-engineered from melvillecity.com.au)
 * Base URL:    https://melville.spatial.t1cloud.com/spatial/intramaps/applicationengine/Integration/api
 *
 * Melville operates a three-bin FOGO system (most households):
 *   - FOGO (lime green lid):   collected WEEKLY
 *   - Recycling (yellow lid):  collected FORTNIGHTLY — "Yellow week"
 *   - General waste (red lid): collected FORTNIGHTLY — "Red week" (opposite to Yellow)
 *
 * Zone schema mapping (general/recycling/green_waste fields):
 *   generalDay / generalFrequency = 'weekly'  → FOGO (lime green, every week)
 *   recyclingDay / recyclingWeek  = 'A' | 'B' → yellow lid recycling (fortnightly)
 *   greenWasteDay / greenWasteWeek = opposite  → red lid general waste (fortnightly)
 *
 * API call flow (two sequential GET requests, both require apikey header):
 *   1. Reproject: WGS84 lat/lng → EPSG:7850 (MGA2020 zone 50)
 *   2. Search:    spatial query on the waste layer using projected coords
 *                 Returns { collection_district, GreenLid, RedLid, YellowLid }
 *
 * YellowLid value ("Monday, 16 Mar 2026") is parsed to determine recyclingWeek.
 *
 * Zone code convention: MEL-{DAY_ABBREV}-{RECYCLING_WEEK}  e.g. "MEL-WED-B"
 *
 * API credentials sourced from:
 *   melvillecity.com.au/assets/js/minified/alyka.scripts.src.js (Alyka.MyNeighbourhood.Intramaps)
 *
 * NOTE: T1Cloud zone polygons cover street areas, so Nominatim road-level coordinates
 * work for most Melville addresses. Civic buildings or boundary addresses may return
 * empty results — users will receive an appropriate error message.
 */

import { geocodeAddress } from '../services/geocoding';
import type { CouncilScraper, ZoneResolution, ZoneScheduleData } from './base/types';
import { logger } from '../utils/logger';

// ─── Constants ────────────────────────────────────────────────────────────────

const T1_BASE =
  'https://melville.spatial.t1cloud.com/spatial/intramaps/applicationengine/Integration/api';

/** T1Cloud Intramaps config/project IDs sourced from alyka.scripts.src.js */
const CONFIG_ID    = '3f105b05-d2ee-419c-8265-1ab592559a33';
const PROJECT_ID   = '78ad3422-3dd6-4540-b318-782d4d1313a0';
const WASTE_FORM_ID = '0e72c05c-0181-428a-b4e0-e2be69cf69dc';

/** API key embedded in melvillecity.com.au frontend JS (public, read-only spatial queries) */
const T1_API_KEY = 'bb6fcd4c-7de3-4ce5-8f6d-dc3335ffb26e';

const USER_AGENT       = 'BinMate/1.0 (Perth bin reminder app; contact@binmate.app)';
const REQUEST_TIMEOUT_MS = 10_000;

/** Perth Week-A reference Monday — must match WEEK_A_REFERENCE in zoneScheduleComputer.ts */
const WEEK_A_REFERENCE_MS = new Date('2026-01-05T00:00:00.000Z').getTime();
const MS_PER_WEEK         = 7 * 86_400_000;

// ─── Suburb set ───────────────────────────────────────────────────────────────

/** City of Melville LGA suburbs (lowercase). Source: Melville official suburb list. */
const MELVILLE_SUBURBS = new Set([
  'alfred cove', 'applecross', 'ardross', 'attadale', 'bateman', 'bicton',
  'booragoon', 'brentwood', 'bull creek', 'kardinya', 'melville',
  'mount pleasant', 'murdoch', 'myaree', 'palmyra', 'willagee', 'winthrop',
]);

// ─── Day maps ─────────────────────────────────────────────────────────────────

const DAY_TO_ABBREV: Record<string, string> = {
  monday: 'MON', tuesday: 'TUE', wednesday: 'WED', thursday: 'THU', friday: 'FRI',
};

const ABBREV_TO_DAY: Record<string, string> = {
  MON: 'monday', TUE: 'tuesday', WED: 'wednesday', THU: 'thursday', FRI: 'friday',
};

// ─── T1Cloud response types ───────────────────────────────────────────────────

interface ReprojectResponse { x: number; y: number; }

interface SearchField { caption: string; name: string; value: string; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert WGS84 lat/lng to EPSG:7850 (MGA2020) projected coordinates via T1Cloud. */
async function reproject(lat: number, lng: number): Promise<ReprojectResponse> {
  const params = new URLSearchParams({
    configId: CONFIG_ID, project: PROJECT_ID,
    x: String(lng), y: String(lat),
    epsg: 'epsg:4326', epsgout: 'epsg:7850',
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${T1_BASE}/Reproject?${params}`, {
      headers: { Authorization: `apikey ${T1_API_KEY}`, 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`Reproject HTTP ${res.status}`);
    return await res.json() as ReprojectResponse;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/** Query the T1Cloud waste layer at projected coordinates. Returns null on no data. */
async function searchWasteZone(x: number, y: number): Promise<SearchField[] | null> {
  const params = new URLSearchParams({
    configId: CONFIG_ID, project: PROJECT_ID,
    form: WASTE_FORM_ID, fields: `${x},${y}`,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${T1_BASE}/search/?${params}`, {
      headers: { Authorization: `apikey ${T1_API_KEY}`, 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`Search HTTP ${res.status}`);
    const data = await res.json() as SearchField[][];
    return data[0] ?? null;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/**
 * Parse a date string like "Monday, 16 Mar 2026" and return whether it falls
 * in Week A or Week B relative to WEEK_A_REFERENCE.
 * Returns null if the string cannot be parsed.
 */
function parseDateWeek(dateStr: string): 'A' | 'B' | null {
  const MONTHS: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  const match = dateStr.match(/\w+,\s+(\d{1,2})\s+(\w{3})\w*\s+(\d{4})/i);
  if (!match) return null;
  const day   = parseInt(match[1], 10);
  const month = MONTHS[match[2].toLowerCase()];
  const year  = parseInt(match[3], 10);
  if (month === undefined) return null;
  const diffWeeks = Math.floor((Date.UTC(year, month, day) - WEEK_A_REFERENCE_MS) / MS_PER_WEEK);
  return diffWeeks % 2 === 0 ? 'A' : 'B';
}

// ─── Scraper ──────────────────────────────────────────────────────────────────

class MelvilleScraper implements CouncilScraper {
  readonly councilSlug = 'melville';
  readonly councilName = 'City of Melville';

  /**
   * Resolve a street address to a Melville collection zone.
   * Geocodes via Nominatim → reprojects via T1Cloud → queries the waste layer.
   */
  async resolveAddress(address: string): Promise<ZoneResolution> {
    try {
      const geo = await geocodeAddress(address);
      if (!geo) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Could not geocode address' };
      }

      const proj   = await reproject(geo.lat, geo.lng);
      const fields = await searchWasteZone(proj.x, proj.y);
      if (!fields) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'No zone data from T1Cloud' };
      }

      const get = (name: string) => fields.find((f) => f.name === name)?.value ?? '';
      const district   = get('collection_district').toLowerCase().trim();
      const yellowLid  = get('YellowLid');

      if (!district) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address not in Melville waste zones' };
      }

      const dayAbbrev = DAY_TO_ABBREV[district];
      if (!dayAbbrev) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: `Unexpected collection day: ${district}` };
      }

      const recyclingWeek = parseDateWeek(yellowLid);
      if (!recyclingWeek) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: `Could not parse recycling week from YellowLid: ${yellowLid}` };
      }

      const zoneCode = `MEL-${dayAbbrev}-${recyclingWeek}`;
      const day      = district.charAt(0).toUpperCase() + district.slice(1);
      const zoneName = `City of Melville — ${day} (recycling Week ${recyclingWeek})`;

      return { zoneCode, zoneName, councilSlug: this.councilSlug };
    } catch (err) {
      logger.error('Melville resolveAddress error', { err });
      return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address resolution failed' };
    }
  }

  /** Return the static schedule for a zone code like "MEL-WED-B". */
  async fetchSchedule(zoneCode: string): Promise<ZoneScheduleData> {
    const match = zoneCode.match(/^MEL-(MON|TUE|WED|THU|FRI)-(A|B)$/);
    if (!match) throw new Error(`Unknown Melville zone code: ${zoneCode}`);

    const dayAbbrev      = match[1];
    const recyclingWeek  = match[2] as 'A' | 'B';
    const generalWasteWeek: 'A' | 'B' = recyclingWeek === 'A' ? 'B' : 'A';
    const day            = ABBREV_TO_DAY[dayAbbrev];
    const dayLabel       = day.charAt(0).toUpperCase() + day.slice(1);

    return {
      zoneCode,
      zoneName:         `City of Melville — ${dayLabel} (recycling Week ${recyclingWeek})`,
      generalDay:       day,
      generalFrequency: 'weekly',         // FOGO — lime green lid, every week
      recyclingDay:     day,
      recyclingWeek,                      // yellow lid — fortnightly
      greenWasteDay:    day,
      greenWasteWeek:   generalWasteWeek, // red lid — fortnightly, opposite to yellow
      vergeDates:       null,
    };
  }

  /** Health check — resolve a known Applecross address and expect MEL-MON-A. */
  async healthCheck(): Promise<boolean> {
    // 5 Kintail Rd, Applecross WA 6153 — confirmed Monday / recycling Week A
    const result = await this.resolveAddress('5 Kintail Rd, Applecross WA 6153');
    const ok = result.zoneCode === 'MEL-MON-A' && !result.error;
    if (!ok) logger.warn('Melville health check failed', { result });
    return ok;
  }
}

/** Singleton export — import this in routes and the scraper runner. */
export const melvilleScraper = new MelvilleScraper();

/** Return true if a (lowercase-trimmed) suburb falls within the Melville LGA. */
export function melvilleCanHandle(suburb: string): boolean {
  return MELVILLE_SUBURBS.has(suburb.toLowerCase().trim());
}
