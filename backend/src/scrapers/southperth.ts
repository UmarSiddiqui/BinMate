/**
 * City of South Perth — bin collection scraper.
 *
 * Data source: T1Cloud Intramaps spatial platform (cosp.spatial.t1cloud.com)
 * Base URL:    https://cosp.spatial.t1cloud.com/spatial/IntraMaps/ApplicationEngine
 *
 * South Perth operates a 2-bin kerbside system:
 *   - General waste (green lid):  collected WEEKLY
 *   - Recycling (yellow lid):     collected FORTNIGHTLY — Week A or Week B
 *   - No FOGO / green waste service (Verge Valet™ replaces green waste)
 *
 * API call flow (four sequential POST requests, session-based auth):
 *   1. Projects: POST /Projects/?configId=...&appType=Standard&project=Public&datasetCode=
 *                → response header x-intramaps-session is the session token
 *   2. Modules:  POST /Modules/?IntraMapsSession={session}
 *                → body: {"module": MODULE_ID, "includeBasemaps": false}
 *                → IMPORTANT: requires X-Requested-With: XMLHttpRequest header
 *   3. Search:   POST /Search/?...&form=FORM_ID&IntraMapsSession={session}
 *                → body: {"fields": ["address text"]}
 *                → returns {fullText: [{selectionLayer, mapKey, dbKey, displayValue}]}
 *   4. Refine:   POST /Search/Refine/Set?IntraMapsSession={session}
 *                → body: {selectionLayer, mapKey, dbKey, infoPanelWidth: 250, mode: "Refresh"}
 *                → returns {infoPanels: {info2: {fields: [{caption, value: {value: "..."}}]}}}
 *
 * Waste fields in infoPanels.info2.fields:
 *   "Waste Pickup Day"    → "Every Tuesday"  → parse day name
 *   "Next Recycling Pickup" → "17 March 2026" → parse to Week A/B
 *
 * Zone code convention: COSP-{DAY_ABBREV}-{RECYCLING_WEEK}  e.g. "COSP-TUE-A"
 *
 * Verified address (2026-03-16):
 *   1 Sandgate Street SOUTH PERTH WA 6151
 *   → "Waste Pickup Day": "Every Tuesday", "Next Recycling Pickup": "17 March 2026" → COSP-TUE-A
 *
 * IDs sourced from cosp.spatial.t1cloud.com network capture (2026-03-16).
 */

import type { CouncilScraper, ZoneResolution, ZoneScheduleData } from './base/types';
import { logger } from '../utils/logger';

// ─── Constants ────────────────────────────────────────────────────────────────

/** T1Cloud Intramaps base URL for City of South Perth */
const T1_BASE = 'https://cosp.spatial.t1cloud.com/spatial/IntraMaps/ApplicationEngine';

const CONFIG_ID  = '29b80b8c-2c27-4a14-8f10-678c7947f7be';
const PROJECT    = 'Public';
const APP_TYPE   = 'Standard';
const MODULE_ID  = '4dbe73d9-aaeb-402c-80e1-1e47b96e14d1';
const FORM_ID    = '69516066-c525-433f-8c04-ee76d61f1824';
const LAYER_ID   = 'f9fbb963-0873-4c1e-b84b-77f05e1485fd';

const USER_AGENT        = 'BinMate/1.0 (Perth bin reminder app; contact@binmate.app)';
const REQUEST_TIMEOUT_MS = 10_000;
const INFO_PANEL_WIDTH   = 250;

/** Perth Week-A reference Monday (UTC midnight) — must match WEEK_A_REFERENCE in zoneScheduleComputer.ts */
const WEEK_A_REFERENCE_MS = new Date('2026-01-05T00:00:00.000Z').getTime();
const MS_PER_WEEK = 7 * 86_400_000;

// ─── Suburb set ───────────────────────────────────────────────────────────────

/** City of South Perth LGA suburbs (lowercase). Source: City of South Perth official suburb list. */
const SOUTH_PERTH_SUBURBS = new Set([
  'south perth', 'kensington', 'como', 'karawara', 'waterford', 'salter point',
]);

// ─── Day maps ─────────────────────────────────────────────────────────────────

const DAY_TO_ABBREV: Record<string, string> = {
  monday: 'MON', tuesday: 'TUE', wednesday: 'WED', thursday: 'THU', friday: 'FRI',
};

const ABBREV_TO_DAY: Record<string, string> = {
  MON: 'monday', TUE: 'tuesday', WED: 'wednesday', THU: 'thursday', FRI: 'friday',
};

// ─── API response types ───────────────────────────────────────────────────────

interface SearchResult { selectionLayer: string; mapKey: string; dbKey: string; displayValue: string; }
interface SearchResponse { fullText?: SearchResult[]; }
interface InfoField { caption: string; value: { value: string } | string; }
interface RefinePanel {
  fields?: InfoField[];
  feature?: { fields?: InfoField[] };
}

interface RefineResponse {
  infoPanels?: Record<string, RefinePanel>;
}

// ─── Headers ──────────────────────────────────────────────────────────────────

/** All South Perth T1Cloud requests require both Content-Type and XMLHttpRequest headers. */
const COSP_HEADERS = {
  'Content-Type': 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
  'User-Agent': USER_AGENT,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Shared fetch wrapper with per-request abort-on-timeout. */
async function cospFetch(url: string, options: RequestInit): Promise<Response> {
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

/**
 * Parse a date string like "17 March 2026" and return Week A or B
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

/** Extract the string value from an InfoField (handles both object and raw string forms). */
function fieldValue(field: InfoField): string {
  if (typeof field.value === 'string') return field.value;
  return field.value?.value ?? '';
}

/** Collect fields from all rendered info panels, handling both direct and nested feature field shapes. */
function extractInfoPanelFields(data: RefineResponse): InfoField[] {
  const panels = Object.values(data.infoPanels ?? {}).filter(
    (panel): panel is RefinePanel => Boolean(panel),
  );

  return panels.flatMap((panel) => {
    if (Array.isArray(panel.fields) && panel.fields.length > 0) {
      return panel.fields;
    }

    return Array.isArray(panel.feature?.fields) ? panel.feature.fields : [];
  });
}

// ─── T1Cloud API steps ────────────────────────────────────────────────────────

/** Step 1: Create an Intramaps session for the South Perth Public project. */
async function createSession(): Promise<string> {
  const params = new URLSearchParams({
    configId: CONFIG_ID, appType: APP_TYPE, project: PROJECT, datasetCode: '',
  });
  const res = await cospFetch(`${T1_BASE}/Projects/?${params}`, {
    method: 'POST', headers: COSP_HEADERS, body: '{}',
  });
  if (!res.ok) throw new Error(`South Perth Projects HTTP ${res.status}`);
  const session = res.headers.get('x-intramaps-session');
  if (!session) throw new Error('South Perth Projects: missing x-intramaps-session header');
  return session;
}

/** Step 2: Activate the Property module for the session (required before Search). */
async function activateModule(session: string): Promise<void> {
  const res = await cospFetch(`${T1_BASE}/Modules/?IntraMapsSession=${session}`, {
    method: 'POST', headers: COSP_HEADERS,
    body: JSON.stringify({ module: MODULE_ID, includeBasemaps: false }),
  });
  if (!res.ok) throw new Error(`South Perth Modules HTTP ${res.status}`);
}

/** Step 3: Address text search — returns matching property records. */
async function searchAddress(term: string, session: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    infoPanelWidth: String(INFO_PANEL_WIDTH), mode: 'Refresh',
    form: FORM_ID, resubmit: 'false', selectionLayersFilter: '',
    IntraMapsSession: session,
  });
  const res = await cospFetch(`${T1_BASE}/Search/?${params}`, {
    method: 'POST', headers: COSP_HEADERS,
    body: JSON.stringify({ fields: [term] }),
  });
  if (!res.ok) throw new Error(`South Perth Search HTTP ${res.status}`);
  const data = await res.json() as SearchResponse;
  return Array.isArray(data.fullText) ? data.fullText : [];
}

/** Step 4: Fetch property info panel for a selected result (mapKey + dbKey from Search). */
async function fetchPropertyInfo(
  mapKey: string, dbKey: string, selectionLayer: string, session: string,
): Promise<InfoField[]> {
  const res = await cospFetch(`${T1_BASE}/Search/Refine/Set?IntraMapsSession=${session}`, {
    method: 'POST', headers: COSP_HEADERS,
    body: JSON.stringify({
      selectionLayer, mapKey, dbKey, infoPanelWidth: INFO_PANEL_WIDTH, mode: 'Refresh',
    }),
  });
  if (!res.ok) throw new Error(`South Perth Refine/Set HTTP ${res.status}`);
  const data = await res.json() as RefineResponse;
  return extractInfoPanelFields(data);
}

// ─── Scraper ──────────────────────────────────────────────────────────────────

class SouthPerthScraper implements CouncilScraper {
  readonly councilSlug = 'south-perth';
  readonly councilName = 'City of South Perth';

  /**
   * Resolve a street address to a South Perth collection zone.
   * Runs the 4-step T1Cloud session flow: Projects → Modules → Search → Refine/Set.
   */
  async resolveAddress(address: string): Promise<ZoneResolution> {
    try {
      const session = await createSession();
      await activateModule(session);

      const results = await searchAddress(address, session);
      if (!results.length) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address not found in South Perth service area' };
      }

      const { mapKey, dbKey, selectionLayer } = results[0];
      const fields = await fetchPropertyInfo(mapKey, dbKey, selectionLayer, session);

      const getField = (caption: string) => {
        const f = fields.find((fld) => fld.caption === caption);
        return f ? fieldValue(f) : '';
      };

      const wastePickupDay   = getField('Waste Pickup Day');
      const nextRecyclingStr = getField('Next Recycling Pickup');

      if (!wastePickupDay) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'No waste pickup day returned' };
      }
      if (!nextRecyclingStr) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'No recycling pickup date returned' };
      }

      // "Every Tuesday" → "tuesday"
      const dayMatch = wastePickupDay.match(/Every\s+(\w+)/i);
      if (!dayMatch) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: `Unexpected waste pickup day format: ${wastePickupDay}` };
      }
      const dayName   = dayMatch[1].toLowerCase();
      const dayAbbrev = DAY_TO_ABBREV[dayName];
      if (!dayAbbrev) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: `Unexpected collection day: ${dayName}` };
      }

      const recyclingWeek = parseDateWeek(nextRecyclingStr);
      if (!recyclingWeek) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: `Could not parse recycling date: ${nextRecyclingStr}` };
      }

      const zoneCode = `COSP-${dayAbbrev}-${recyclingWeek}`;
      const dayLabel = dayName.charAt(0).toUpperCase() + dayName.slice(1);
      const zoneName = `City of South Perth — ${dayLabel} (recycling Week ${recyclingWeek})`;
      return { zoneCode, zoneName, councilSlug: this.councilSlug };
    } catch (err) {
      logger.error('South Perth resolveAddress error', { err });
      return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address resolution failed' };
    }
  }

  /** Return the static schedule for a zone code like "COSP-TUE-A". */
  async fetchSchedule(zoneCode: string): Promise<ZoneScheduleData> {
    const match = zoneCode.match(/^COSP-(MON|TUE|WED|THU|FRI)-(A|B)$/);
    if (!match) throw new Error(`Unknown South Perth zone code: ${zoneCode}`);

    const dayAbbrev     = match[1];
    const recyclingWeek = match[2] as 'A' | 'B';
    const day           = ABBREV_TO_DAY[dayAbbrev];
    const dayLabel      = day.charAt(0).toUpperCase() + day.slice(1);

    return {
      zoneCode,
      zoneName:         `City of South Perth — ${dayLabel} (recycling Week ${recyclingWeek})`,
      generalDay:       day,
      generalFrequency: 'weekly',  // green lid general waste — weekly
      recyclingDay:     day,
      recyclingWeek,               // yellow lid — fortnightly
      greenWasteDay:    null,      // no FOGO/green waste (Verge Valet™ replaces green waste)
      greenWasteWeek:   null,
      vergeDates:       null,
    };
  }

  /** Health check — resolve a known South Perth address and expect COSP-TUE-A. */
  async healthCheck(): Promise<boolean> {
    // 1 Sandgate Street SOUTH PERTH WA 6151 — confirmed Tuesday, recycling Week A (2026-03-16)
    const result = await this.resolveAddress('1 Sandgate Street SOUTH PERTH WA 6151');
    const ok = result.zoneCode === 'COSP-TUE-A' && !result.error;
    if (!ok) logger.warn('South Perth health check failed', { result });
    return ok;
  }
}

/** Singleton export — import this in routes and the scraper runner. */
export const southPerthScraper = new SouthPerthScraper();

/** Return true if a (lowercase-trimmed) suburb falls within the South Perth LGA. */
export function southPerthCanHandle(suburb: string): boolean {
  return SOUTH_PERTH_SUBURBS.has(suburb.toLowerCase().trim());
}
