/**
 * City of Nedlands — bin collection scraper.
 *
 * Data source: Self-hosted IntraMaps 21b (gispublic01.nedlands.wa.gov.au)
 * Base URL:    https://gispublic01.nedlands.wa.gov.au/intramaps21b/ApplicationEngine
 *
 * Nedlands operates a three-bin FOGO system:
 *   - FOGO (lime green lid):     collected WEEKLY
 *   - Recycling (yellow lid):    collected FORTNIGHTLY — Week A or Week B
 *   - General waste (red lid):   collected FORTNIGHTLY — opposite week to Recycling
 *
 * API call flow (four sequential requests, session-based auth):
 *   1. Projects: POST /Projects/?startToken=...&project=Nedlands+Public&appType=MapBuilder
 *                → response header x-intramaps-session is the session token
 *   2. Modules:  POST /Modules/?IntraMapsSession={session}
 *                → body: {"module": WASTE_MODULE_ID, "includeBasemaps": false}
 *                → activates the Waste Management module; required before Search
 *   3. Search:   POST /Search/?...&form=FORM_ID&IntraMapsSession={session}
 *                → body: {"fields": ["address text"]} (fullText search)
 *                → returns {fullText: [{selectionLayer, mapKey, dbKey, displayValue}]}
 *   4. Refine:   POST /Search/Refine/Set?IntraMapsSession={session}
 *                → body: {selectionLayer, mapKey, dbKey, infoPanelWidth: 250, mode: "Refresh"}
 *                → returns {infoPanels: {info1: {feature: {fields: [...]}}}}
 *
 * Waste fields in infoPanels.info1.feature.fields:
 *   "FOGO Collection Day"        → "Monday"  → parse day name
 *   "Next Recycling Bin Day"     → "Monday, 16 Mar 2026" → parse to Week A/B
 *   "Next General Waste Bin Day" → "Monday, 23 Mar 2026"
 *   "Bulk Verge Collection Zone 1" → "Monday, 20th October 2025" (optional, per-property)
 *   "Bulk Verge Collection Zone 2" → "Monday, 4th May 2026"     (optional, per-property)
 *
 * Zone code convention: NED-{DAY_ABBREV}-{RECYCLING_WEEK}  e.g. "NED-MON-A"
 *
 * Verified address (2026-03-16):
 *   14B Adderley Street MT CLAREMONT
 *   → FOGO Collection Day: "Monday", Next Recycling Bin Day: "Monday, 16 Mar 2026" → Week A → NED-MON-A
 *
 * Auth note: This instance uses startToken (a static UUID matching configId) instead of configId.
 * The startToken is visible in the public HTML link on nedlands.wa.gov.au/waste.
 */

import type { CouncilScraper, ZoneResolution, ZoneScheduleData } from './base/types';
import { logger } from '../utils/logger';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Self-hosted IntraMaps 21b base URL for City of Nedlands */
const T1_BASE = 'https://gispublic01.nedlands.wa.gov.au/intramaps21b/ApplicationEngine';

const START_TOKEN     = 'fc8c081f-100c-4334-a830-32ff07f3b35c';
const PROJECT         = 'Nedlands Public';
const APP_TYPE        = 'MapBuilder';
const WASTE_MODULE_ID = '814b9093-6bfc-4e9d-8cf4-702d4fe19fab';
const FORM_ID         = '34b9ebb3-92cd-43e5-8bba-33e13dbbf50c';
const LAYER_ID        = '1023797c-2d01-429c-b742-025469dd80ae';

const USER_AGENT        = 'BinMate/1.0 (Perth bin reminder app; contact@binmate.app)';
const REQUEST_TIMEOUT_MS = 10_000;
const INFO_PANEL_WIDTH   = 250;

/** Perth Week-A reference Monday (UTC midnight) — must match WEEK_A_REFERENCE in zoneScheduleComputer.ts */
const WEEK_A_REFERENCE_MS = new Date('2026-01-05T00:00:00.000Z').getTime();
const MS_PER_WEEK = 7 * 86_400_000;

// ─── Suburb set ───────────────────────────────────────────────────────────────

/** City of Nedlands LGA suburbs (lowercase). Source: City of Nedlands official suburb list. */
const NEDLANDS_SUBURBS = new Set([
  'nedlands', 'dalkeith', 'swanbourne', 'mt claremont', 'mount claremont',
  'hollywood', 'karrakatta',
]);

// ─── Day maps ─────────────────────────────────────────────────────────────────

const DAY_TO_ABBREV: Record<string, string> = {
  monday: 'MON', tuesday: 'TUE', wednesday: 'WED', thursday: 'THU', friday: 'FRI',
};

const ABBREV_TO_DAY: Record<string, string> = {
  MON: 'monday', TUE: 'tuesday', WED: 'wednesday', THU: 'thursday', FRI: 'friday',
};

// ─── API response types ───────────────────────────────────────────────────────

interface FullTextResult { selectionLayer: string; mapKey: string; dbKey: string; displayValue: string; }
interface SearchResponse { fullText?: FullTextResult[]; }
interface InfoField { name: string; caption: string; value: { value: string } | string; }
interface RefineResponse { infoPanels?: { info1?: { feature?: { fields?: InfoField[] } } } }

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Shared fetch wrapper with per-request abort-on-timeout. */
async function nedFetch(url: string, options: RequestInit): Promise<Response> {
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

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': USER_AGENT,
};

/**
 * Parse a date string like "Monday, 16 Mar 2026" and return Week A or B
 * relative to WEEK_A_REFERENCE. Returns null if the string cannot be parsed.
 */
function parseDateWeek(dateStr: string): 'A' | 'B' | null {
  const MONTHS: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  const match = dateStr.match(/(\d{1,2})\s+(\w{3})\w*\s+(\d{4})/i);
  if (!match) return null;
  const day   = parseInt(match[1], 10);
  const month = MONTHS[match[2].toLowerCase()];
  const year  = parseInt(match[3], 10);
  if (month === undefined) return null;
  const diffWeeks = Math.floor((Date.UTC(year, month, day) - WEEK_A_REFERENCE_MS) / MS_PER_WEEK);
  return diffWeeks % 2 === 0 ? 'A' : 'B';
}

/** Extract string value from an InfoField (handles both object and raw string forms). */
function fieldValue(field: InfoField): string {
  if (typeof field.value === 'string') return field.value;
  return field.value?.value ?? '';
}

// ─── IntraMaps 21b API steps ──────────────────────────────────────────────────

/** Step 1: Create a session for the Nedlands Waste Management project. */
async function createSession(): Promise<string> {
  const params = new URLSearchParams({
    startToken: START_TOKEN, project: PROJECT, appType: APP_TYPE,
  });
  const res = await nedFetch(`${T1_BASE}/Projects/?${params}`, {
    method: 'POST', headers: JSON_HEADERS, body: '{}',
  });
  if (!res.ok) throw new Error(`Nedlands Projects HTTP ${res.status}`);
  const session = res.headers.get('x-intramaps-session');
  if (!session) throw new Error('Nedlands Projects: missing x-intramaps-session header');
  return session;
}

/** Step 2: Activate the Waste Management module for the session. */
async function activateModule(session: string): Promise<void> {
  const res = await nedFetch(`${T1_BASE}/Modules/?IntraMapsSession=${session}`, {
    method: 'POST', headers: JSON_HEADERS,
    body: JSON.stringify({ module: WASTE_MODULE_ID, includeBasemaps: false }),
  });
  if (!res.ok) throw new Error(`Nedlands Modules HTTP ${res.status}`);
}

/** Step 3: Full-text address search — returns matching property records. */
async function searchAddress(term: string, session: string): Promise<FullTextResult[]> {
  const params = new URLSearchParams({
    infoPanelWidth: String(INFO_PANEL_WIDTH), mode: 'Refresh',
    form: FORM_ID, resubmit: 'false', selectionLayersFilter: '',
    IntraMapsSession: session,
  });
  const res = await nedFetch(`${T1_BASE}/Search/?${params}`, {
    method: 'POST', headers: JSON_HEADERS,
    body: JSON.stringify({ fields: [term] }),
  });
  if (!res.ok) throw new Error(`Nedlands Search HTTP ${res.status}`);
  const data = await res.json() as SearchResponse;
  return Array.isArray(data.fullText) ? data.fullText : [];
}

/** Step 4: Fetch waste info panel for a selected property (mapKey + dbKey from Search). */
async function fetchPropertyInfo(
  mapKey: string, dbKey: string, selectionLayer: string, session: string,
): Promise<InfoField[]> {
  const res = await nedFetch(`${T1_BASE}/Search/Refine/Set?IntraMapsSession=${session}`, {
    method: 'POST', headers: JSON_HEADERS,
    body: JSON.stringify({
      selectionLayer, mapKey, dbKey, infoPanelWidth: INFO_PANEL_WIDTH, mode: 'Refresh',
    }),
  });
  if (!res.ok) throw new Error(`Nedlands Refine/Set HTTP ${res.status}`);
  const data = await res.json() as RefineResponse;
  return data?.infoPanels?.info1?.feature?.fields ?? [];
}

// ─── Scraper ──────────────────────────────────────────────────────────────────

class NedlandsScraper implements CouncilScraper {
  readonly councilSlug = 'nedlands';
  readonly councilName = 'City of Nedlands';

  /**
   * Resolve a street address to a Nedlands collection zone.
   * Runs the 4-step IntraMaps session flow: Projects → Modules → Search → Refine/Set.
   */
  async resolveAddress(address: string): Promise<ZoneResolution> {
    try {
      const session = await createSession();
      await activateModule(session);

      const results = await searchAddress(address, session);
      if (!results.length) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address not found in Nedlands service area' };
      }

      const { mapKey, dbKey, selectionLayer } = results[0];
      const fields = await fetchPropertyInfo(mapKey, dbKey, selectionLayer, session);

      const getField = (name: string) => {
        const f = fields.find((fld) => fld.name === name || fld.caption === name);
        return f ? fieldValue(f) : '';
      };

      const fogoDay        = getField('FOGO Collection Day');
      const recyclingDate  = getField('Next Recycling Bin Day');

      if (!fogoDay) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'No FOGO collection day returned' };
      }
      if (!recyclingDate) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'No recycling bin day returned' };
      }

      const dayName   = fogoDay.toLowerCase();
      const dayAbbrev = DAY_TO_ABBREV[dayName];
      if (!dayAbbrev) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: `Unexpected collection day: ${fogoDay}` };
      }

      const recyclingWeek = parseDateWeek(recyclingDate);
      if (!recyclingWeek) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: `Could not parse recycling date: ${recyclingDate}` };
      }

      const zoneCode = `NED-${dayAbbrev}-${recyclingWeek}`;
      const dayLabel = dayName.charAt(0).toUpperCase() + dayName.slice(1);
      const zoneName = `City of Nedlands — ${dayLabel} (recycling Week ${recyclingWeek})`;
      return { zoneCode, zoneName, councilSlug: this.councilSlug };
    } catch (err) {
      logger.error('Nedlands resolveAddress error', { err });
      return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address resolution failed' };
    }
  }

  /** Return the static schedule for a zone code like "NED-MON-A". */
  async fetchSchedule(zoneCode: string): Promise<ZoneScheduleData> {
    const match = zoneCode.match(/^NED-(MON|TUE|WED|THU|FRI)-(A|B)$/);
    if (!match) throw new Error(`Unknown Nedlands zone code: ${zoneCode}`);

    const dayAbbrev     = match[1];
    const recyclingWeek = match[2] as 'A' | 'B';
    const day           = ABBREV_TO_DAY[dayAbbrev];
    const dayLabel      = day.charAt(0).toUpperCase() + day.slice(1);

    return {
      zoneCode,
      zoneName:         `City of Nedlands — ${dayLabel} (recycling Week ${recyclingWeek})`,
      generalDay:       day,
      generalFrequency: 'weekly',  // FOGO (lime green) — collected every week
      recyclingDay:     day,
      recyclingWeek,               // yellow lid — fortnightly
      greenWasteDay:    null,      // no separate green waste kerbside (FOGO replaces it)
      greenWasteWeek:   null,
      vergeDates:       null,      // verge is property-specific, not stored per-zone
    };
  }

  /** Health check — resolve a known Nedlands address and expect NED-MON-A. */
  async healthCheck(): Promise<boolean> {
    // 14B Adderley Street MT CLAREMONT — confirmed Monday, recycling Week A (2026-03-16)
    const result = await this.resolveAddress('14B Adderley Street MT CLAREMONT');
    const ok = result.zoneCode === 'NED-MON-A' && !result.error;
    if (!ok) logger.warn('Nedlands health check failed', { result });
    return ok;
  }
}

/** Singleton export — import this in routes and the scraper runner. */
export const nedlandsScraper = new NedlandsScraper();

/** Return true if a (lowercase-trimmed) suburb falls within the Nedlands LGA. */
export function nedlandsCanHandle(suburb: string): boolean {
  return NEDLANDS_SUBURBS.has(suburb.toLowerCase().trim());
}
