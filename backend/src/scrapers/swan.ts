/**
 * City of Swan — bin collection scraper.
 *
 * Data source: T1Cloud Intramaps spatial platform (swan.spatial.t1cloud.com)
 * Base URL:    https://swan.spatial.t1cloud.com/spatial/intramaps/ApplicationEngine
 *
 * Swan operates a 2-bin kerbside system (at implementation March 2026):
 *   - General waste (red lid):  collected WEEKLY
 *   - Recycling (yellow lid):   collected FORTNIGHTLY — Week A or Week B
 *   - FOGO transition:          scheduled to start 12/05/2026
 *
 * API call flow (four sequential POST requests, session-based auth):
 *   1. Projects: POST /Projects/?configId=...&project=...&appType=MapBuilder
 *                → response header x-intramaps-session is the session token
 *   2. Modules:  POST /Modules/?IntraMapsSession={session}
 *                → body: {"module": WASTE_MODULE_ID, "includeBasemaps": false}
 *                → activates the waste module; required before Search
 *   3. Search:   POST /Search/?...&form=FORM_ID&selectionLayersFilter=LAYER_ID&IntraMapsSession={session}
 *                → body: {"fields": ["address text"]}
 *                → returns [{mapKey, dbKey, displayValue, ...}]
 *   4. Refine:   POST /Search/Refine/Set?IntraMapsSession={session}
 *                → body: {selectionLayer, mapKey, dbKey, infoPanelWidth: 0, mode: "Refresh"}
 *                → returns [{caption, value}] — "Next Recycling Collection" contains date
 *
 * Zone code convention: SWA-{DAY_ABBREV}-{RECYCLING_WEEK}  e.g. "SWA-TUE-A"
 *   Day is the kerbside collection day; recycling week is when yellow lid is emptied.
 *   General waste (red lid) is collected weekly on the same day.
 *
 * Verified address (2026-03-16):
 *   12 Morrison Road, Midland WA 6056
 *   → "Next Recycling Collection": "Tuesday, 17 March 2026" → Week A → SWA-TUE-A
 *
 * IDs sourced from swan.spatial.t1cloud.com page source and network capture (2026-03-16).
 */

import type { CouncilScraper, ZoneResolution, ZoneScheduleData } from './base/types';
import { logger } from '../utils/logger';

// ─── Constants ────────────────────────────────────────────────────────────────

/** T1Cloud Intramaps base URL for City of Swan */
const T1_BASE = 'https://swan.spatial.t1cloud.com/spatial/intramaps/ApplicationEngine';

const CONFIG_ID       = '4c6eefa0-c035-40d1-b553-be6e06446b38';
const PROJECT_ID      = '41a8ffbd-0da0-47c9-9957-b0dcb8a1bfc3';
const WASTE_MODULE_ID = '5a0205e5-ab05-4d94-a97f-2ae565ae48ff';
const FORM_ID         = '7f2d1f72-efe2-4527-9fcc-1e2ba8348e64';
const LAYER_ID        = 'efd1a218-d9c4-43ec-b1bb-17514d03c3a3';

const USER_AGENT       = 'BinMate/1.0 (Perth bin reminder app; contact@binmate.app)';
const REQUEST_TIMEOUT_MS = 10_000;

/** Perth Week-A reference Monday (UTC midnight) — must match WEEK_A_REFERENCE in zoneScheduleComputer.ts */
const WEEK_A_REFERENCE_MS = new Date('2026-01-05T00:00:00.000Z').getTime();
const MS_PER_WEEK = 7 * 86_400_000;

// ─── Suburb set ───────────────────────────────────────────────────────────────

/** City of Swan LGA suburbs (lowercase). Source: City of Swan official suburb list. */
const SWAN_SUBURBS = new Set([
  'aveley', 'ballajura', 'baskerville', 'beechboro', 'bennett springs',
  'brabham', 'bullsbrook', 'caversham', 'dayton', 'eden hill',
  'ellenbrook', 'gidgegannup', 'henley brook', 'herne hill', 'kiara',
  'koongamia', 'lockridge', 'mahogany creek', 'malaga', 'middle swan',
  'midland', 'midvale', 'millendon', 'parkerville', 'red hill',
  'stratton', 'swan view', 'the vines', 'upper swan', 'viveash',
  'walyunga', 'west swan', 'whiteman', 'woodbridge', 'woollcott',
]);

// ─── Day maps ─────────────────────────────────────────────────────────────────

const DAY_TO_ABBREV: Record<string, string> = {
  monday: 'MON', tuesday: 'TUE', wednesday: 'WED', thursday: 'THU', friday: 'FRI',
};

const ABBREV_TO_DAY: Record<string, string> = {
  MON: 'monday', TUE: 'tuesday', WED: 'wednesday', THU: 'thursday', FRI: 'friday',
};

// ─── API response types ───────────────────────────────────────────────────────

interface SwanSearchResult { mapKey: string; dbKey: string; displayValue: string; }
interface SwanInfoField    { caption: string; value: string; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Strip state abbreviation and postcode suffix from address for T1Cloud text search. */
function buildSearchTerm(address: string): string {
  return address.replace(/,?\s*WA\s+\d{4}.*/i, '').trim();
}

/**
 * Parse a date string like "Tuesday, 17 March 2026" and return Week A or B
 * relative to WEEK_A_REFERENCE. Returns null if the string cannot be parsed.
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

/** Extract lowercase day name from a date string like "Tuesday, 17 March 2026". */
function parseDayName(dateStr: string): string | null {
  const match = dateStr.match(/^(\w+),/);
  return match ? match[1].toLowerCase() : null;
}

/** Shared fetch wrapper with per-request abort-on-timeout. */
async function swanFetch(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// ─── T1Cloud API steps ────────────────────────────────────────────────────────

const JSON_HEADERS = { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT };

/** Step 1: Create an Intramaps session for the Swan waste map project. */
async function createSession(): Promise<string> {
  const params = new URLSearchParams({
    configId: CONFIG_ID, project: PROJECT_ID, appType: 'MapBuilder',
  });
  const res = await swanFetch(`${T1_BASE}/Projects/?${params}`, {
    method: 'POST', headers: JSON_HEADERS, body: '{}',
  });
  if (!res.ok) throw new Error(`Swan Projects HTTP ${res.status}`);
  const session = res.headers.get('x-intramaps-session');
  if (!session) throw new Error('Swan Projects: missing x-intramaps-session header');
  return session;
}

/** Step 2: Activate the waste module for the session (required before Search). */
async function activateModule(session: string): Promise<void> {
  const res = await swanFetch(`${T1_BASE}/Modules/?IntraMapsSession=${session}`, {
    method: 'POST', headers: JSON_HEADERS,
    body: JSON.stringify({ module: WASTE_MODULE_ID, includeBasemaps: false }),
  });
  if (!res.ok) throw new Error(`Swan Modules HTTP ${res.status}`);
}

/** Step 3: Address text search — returns matching property records. */
async function searchAddress(term: string, session: string): Promise<SwanSearchResult[]> {
  const params = new URLSearchParams({
    configId: CONFIG_ID, project: PROJECT_ID,
    form: FORM_ID, selectionLayersFilter: LAYER_ID,
    IntraMapsSession: session,
  });
  const res = await swanFetch(`${T1_BASE}/Search/?${params}`, {
    method: 'POST', headers: JSON_HEADERS,
    body: JSON.stringify({ fields: [term] }),
  });
  if (!res.ok) throw new Error(`Swan Search HTTP ${res.status}`);
  const data = await res.json() as SwanSearchResult[];
  return Array.isArray(data) ? data : [];
}

/** Step 4: Fetch bin day fields for a selected property (mapKey + dbKey from Search). */
async function fetchPropertyInfo(mapKey: string, dbKey: string, session: string): Promise<SwanInfoField[]> {
  const res = await swanFetch(`${T1_BASE}/Search/Refine/Set?IntraMapsSession=${session}`, {
    method: 'POST', headers: JSON_HEADERS,
    body: JSON.stringify({
      selectionLayer: LAYER_ID, mapKey, dbKey, infoPanelWidth: 0, mode: 'Refresh',
    }),
  });
  if (!res.ok) throw new Error(`Swan Refine/Set HTTP ${res.status}`);
  const data = await res.json() as SwanInfoField[];
  return Array.isArray(data) ? data : [];
}

// ─── Scraper ──────────────────────────────────────────────────────────────────

class SwanScraper implements CouncilScraper {
  readonly councilSlug = 'swan';
  readonly councilName = 'City of Swan';

  /**
   * Resolve a street address to a Swan collection zone.
   * Runs the 4-step T1Cloud session flow: Projects → Modules → Search → Refine/Set.
   */
  async resolveAddress(address: string): Promise<ZoneResolution> {
    try {
      const session = await createSession();
      await activateModule(session);

      const term    = buildSearchTerm(address);
      const results = await searchAddress(term, session);
      if (!results.length) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address not found in Swan service area' };
      }

      const { mapKey, dbKey } = results[0];
      const fields = await fetchPropertyInfo(mapKey, dbKey, session);

      const recyclingDateStr = fields.find((f) => f.caption === 'Next Recycling Collection')?.value ?? '';
      if (!recyclingDateStr) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'No recycling collection date returned' };
      }

      const dayName       = parseDayName(recyclingDateStr);
      const recyclingWeek = parseDateWeek(recyclingDateStr);
      if (!dayName || !recyclingWeek) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: `Could not parse recycling date: ${recyclingDateStr}` };
      }

      const dayAbbrev = DAY_TO_ABBREV[dayName];
      if (!dayAbbrev) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: `Unexpected collection day: ${dayName}` };
      }

      const zoneCode = `SWA-${dayAbbrev}-${recyclingWeek}`;
      const dayLabel = dayName.charAt(0).toUpperCase() + dayName.slice(1);
      const zoneName = `City of Swan — ${dayLabel} (recycling Week ${recyclingWeek})`;
      return { zoneCode, zoneName, councilSlug: this.councilSlug };
    } catch (err) {
      logger.error('Swan resolveAddress error', { err });
      return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address resolution failed' };
    }
  }

  /** Return the static schedule for a zone code like "SWA-TUE-A". */
  async fetchSchedule(zoneCode: string): Promise<ZoneScheduleData> {
    const match = zoneCode.match(/^SWA-(MON|TUE|WED|THU|FRI)-(A|B)$/);
    if (!match) throw new Error(`Unknown Swan zone code: ${zoneCode}`);

    const dayAbbrev    = match[1];
    const recyclingWeek = match[2] as 'A' | 'B';
    const day          = ABBREV_TO_DAY[dayAbbrev];
    const dayLabel     = day.charAt(0).toUpperCase() + day.slice(1);

    return {
      zoneCode,
      zoneName:         `City of Swan — ${dayLabel} (recycling Week ${recyclingWeek})`,
      generalDay:       day,
      generalFrequency: 'weekly',  // red lid general waste — weekly (until FOGO launch 12/05/2026)
      recyclingDay:     day,
      recyclingWeek,               // yellow lid — fortnightly
      greenWasteDay:    null,      // FOGO not yet active (scheduled 12/05/2026)
      greenWasteWeek:   null,
      vergeDates:       null,
    };
  }

  /** Health check — resolve a known Midland address and expect SWA-TUE-A. */
  async healthCheck(): Promise<boolean> {
    // 12 Morrison Road, Midland WA 6056 — confirmed Tuesday, recycling Week A (2026-03-17)
    const result = await this.resolveAddress('12 Morrison Road, Midland WA 6056');
    const ok = result.zoneCode === 'SWA-TUE-A' && !result.error;
    if (!ok) logger.warn('Swan health check failed', { result });
    return ok;
  }
}

/** Singleton export — import this in routes and the scraper runner. */
export const swanScraper = new SwanScraper();

/** Return true if a (lowercase-trimmed) suburb falls within the Swan LGA. */
export function swanCanHandle(suburb: string): boolean {
  return SWAN_SUBURBS.has(suburb.toLowerCase().trim());
}
