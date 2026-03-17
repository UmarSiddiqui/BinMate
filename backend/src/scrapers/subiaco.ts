/**
 * City of Subiaco — bin collection scraper.
 *
 * Data source: T1Cloud Intramaps spatial platform (subiaco.spatial.t1cloud.com)
 * Base URL:    https://subiaco.spatial.t1cloud.com/spatial/intramaps/ApplicationEngine
 *
 * Subiaco operates a three-bin FOGO system:
 *   - FOGO (lime green lid):     collected WEEKLY
 *   - Recycling (yellow lid):    collected FORTNIGHTLY — Week A or Week B
 *   - General waste (red lid):   collected FORTNIGHTLY — opposite week to Recycling
 *
 * API call flow (four sequential requests, session-based auth):
 *   1. Projects: POST /Projects/?configId=...&project={UUID}&appType=MapBuilder
 *                → response header x-intramaps-session is the session token
 *   2. Modules:  POST /Modules/?IntraMapsSession={session}
 *                → body: {\"module\": MODULE_ID, \"includeBasemaps\": false}
 *                → activates the Property module; required before Search
 *   3. Search:   POST /Search/?...&form=FORM_ID&IntraMapsSession={session}
 *                → body: {\"fields\": [\"address text\"]} (fullText search)
 *                → returns {fullText: [{selectionLayer, mapKey, dbKey, displayValue}]}
 *   4. Refine:   POST /Search/Refine/Set?IntraMapsSession={session}
 *                → body: {selectionLayer, mapKey, dbKey, infoPanelWidth: 250, mode: \"Refresh\"}
 *                → returns {infoPanels: {info1: {feature: {fields: [...]}}}}
 *
 * Waste fields in infoPanels.info1.feature.fields:
 *   \"General Waste Collection\" → \"Tuesday, Week 2 (17 Mar 2026)\"  → parse date → Week A
 *   \"Recycle Collection\"       → \"Tuesday, Week 1 (24 Mar 2026)\"  → parse date → Week B
 *
 * Note: Subiaco \"Week 1\" = Perth Week B; \"Week 2\" = Perth Week A.
 *       Zone week is determined by parsing the date in the response, NOT the \"Week N\" label.
 *
 * Zone code convention: SUB-{DAY_ABBREV}-{RECYCLING_WEEK}  e.g. \"SUB-TUE-B\"
 *
 * Verified address (2026-03-16):
 *   → Recycle Collection: \"Tuesday, Week 1 (24 Mar 2026)\" → Mar 24 = Perth Week B → SUB-TUE-B
 *
 * IDs sourced from subiaco.spatial.t1cloud.com page source and network capture (2026-03-16).
 */

import type { CouncilScraper, ZoneResolution, ZoneScheduleData } from './base/types';
import { logger } from '../utils/logger';

// ─── Constants ────────────────────────────────────────────────────────────────

/** T1Cloud Intramaps base URL for City of Subiaco */
const T1_BASE = 'https://subiaco.spatial.t1cloud.com/spatial/intramaps/ApplicationEngine';

const CONFIG_ID  = '95fc31a6-7249-4e7f-81cd-342f8e977833';
const PROJECT_ID = '5c8b9af9-72cd-4cbd-86f7-f95be440cc35';  // Public project UUID
const MODULE_ID  = 'fc7765a3-c1f6-4ac8-baec-a08d62dfae8b';
const FORM_ID    = '69516066-c525-433f-8c04-ee76d61f1824';
const LAYER_ID   = 'b5583c5c-337e-4ab1-8987-caad834d5016';

const USER_AGENT        = 'BinMate/1.0 (Perth bin reminder app; contact@binmate.app)';
const REQUEST_TIMEOUT_MS = 10_000;
const INFO_PANEL_WIDTH   = 250;

/** Perth Week-A reference Monday (UTC midnight) — must match WEEK_A_REFERENCE in zoneScheduleComputer.ts */
const WEEK_A_REFERENCE_MS = new Date('2026-01-05T00:00:00.000Z').getTime();
const MS_PER_WEEK = 7 * 86_400_000;

// ─── Suburb set ───────────────────────────────────────────────────────────────

/** City of Subiaco LGA suburbs (lowercase). Source: City of Subiaco official suburb list. */
const SUBIACO_SUBURBS = new Set([
  'subiaco', 'shenton park', 'daglish', 'jolimont',
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

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': USER_AGENT,
};

/** Shared fetch wrapper with per-request abort-on-timeout. */
async function subFetch(url: string, options: RequestInit): Promise<Response> {
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
 * Parse a date string like \"Tuesday, Week 1 (24 Mar 2026)\" and return Week A or B
 * relative to WEEK_A_REFERENCE. Returns null if the string cannot be parsed.
 * Note: the \"Week N\" label is ignored — only the date in parentheses is used.
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

/**
 * Extract lowercase day name from a field string like \"Tuesday, Week 1 (24 Mar 2026)\".
 * Returns null if the string cannot be parsed.
 */
function parseDayName(dateStr: string): string | null {
  const match = dateStr.match(/^(\w+),/);
  return match ? match[1].toLowerCase() : null;
}

/** Extract string value from an InfoField (handles both object and raw string forms). */
function fieldValue(field: InfoField): string {
  if (typeof field.value === 'string') return field.value;
  return field.value?.value ?? '';
}

// ─── T1Cloud API steps ────────────────────────────────────────────────────────

/** Step 1: Create a session for the Subiaco Public project. */
async function createSession(): Promise<string> {
  const params = new URLSearchParams({
    configId: CONFIG_ID, project: PROJECT_ID, appType: 'MapBuilder',
  });
  const res = await subFetch(`${T1_BASE}/Projects/?${params}`, {
    method: 'POST', headers: JSON_HEADERS, body: '{}',
  });
  if (!res.ok) throw new Error(`Subiaco Projects HTTP ${res.status}`);
  const session = res.headers.get('x-intramaps-session');
  if (!session) throw new Error('Subiaco Projects: missing x-intramaps-session header');
  return session;
}

/** Step 2: Activate the Property module for the session. */
async function activateModule(session: string): Promise<void> {
  const res = await subFetch(`${T1_BASE}/Modules/?IntraMapsSession=${session}`, {
    method: 'POST', headers: JSON_HEADERS,
    body: JSON.stringify({ module: MODULE_ID, includeBasemaps: false }),
  });
  if (!res.ok) throw new Error(`Subiaco Modules HTTP ${res.status}`);
}

/** Step 3: Full-text address search — returns matching property records. */
async function searchAddress(term: string, session: string): Promise<FullTextResult[]> {
  const params = new URLSearchParams({
    infoPanelWidth: String(INFO_PANEL_WIDTH), mode: 'Refresh',
    form: FORM_ID, resubmit: 'false', selectionLayersFilter: '',
    IntraMapsSession: session,
  });
  const res = await subFetch(`${T1_BASE}/Search/?${params}`, {
    method: 'POST', headers: JSON_HEADERS,
    body: JSON.stringify({ fields: [term] }),
  });
  if (!res.ok) throw new Error(`Subiaco Search HTTP ${res.status}`);
  const data = await res.json() as SearchResponse;
  return Array.isArray(data.fullText) ? data.fullText : [];
}

/** Step 4: Fetch waste info panel for a selected property (mapKey + dbKey from Search). */
async function fetchPropertyInfo(
  mapKey: string, dbKey: string, selectionLayer: string, session: string,
): Promise<InfoField[]> {
  const res = await subFetch(`${T1_BASE}/Search/Refine/Set?IntraMapsSession=${session}`, {
    method: 'POST', headers: JSON_HEADERS,
    body: JSON.stringify({
      selectionLayer, mapKey, dbKey, infoPanelWidth: INFO_PANEL_WIDTH, mode: 'Refresh',
    }),
  });
  if (!res.ok) throw new Error(`Subiaco Refine/Set HTTP ${res.status}`);
  const data = await res.json() as RefineResponse;
  return data?.infoPanels?.info1?.feature?.fields ?? [];
}

// ─── Scraper ──────────────────────────────────────────────────────────────────

class SubiacoScraper implements CouncilScraper {
  readonly councilSlug = 'subiaco';
  readonly councilName = 'City of Subiaco';

  /**
   * Resolve a street address to a Subiaco collection zone.
   * Runs the 4-step T1Cloud session flow: Projects → Modules → Search → Refine/Set.
   */
  async resolveAddress(address: string): Promise<ZoneResolution> {
    try {
      const session = await createSession();
      await activateModule(session);

      const results = await searchAddress(address, session);
      if (!results.length) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address not found in Subiaco service area' };
      }

      const { mapKey, dbKey, selectionLayer } = results[0];
      const fields = await fetchPropertyInfo(mapKey, dbKey, selectionLayer, session);

      const getField = (name: string) => {
        const f = fields.find((fld) => fld.name === name || fld.caption === name);
        return f ? fieldValue(f) : '';
      };

      const recycleStr = getField('Recycle Collection');
      if (!recycleStr) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'No recycling collection field returned' };
      }

      const dayName = parseDayName(recycleStr);
      if (!dayName) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: `Could not parse day from: ${recycleStr}` };
      }

      const dayAbbrev = DAY_TO_ABBREV[dayName];
      if (!dayAbbrev) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: `Unexpected collection day: ${dayName}` };
      }

      const recyclingWeek = parseDateWeek(recycleStr);
      if (!recyclingWeek) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: `Could not parse recycling date: ${recycleStr}` };
      }

      const zoneCode = `SUB-${dayAbbrev}-${recyclingWeek}`;
      const dayLabel = dayName.charAt(0).toUpperCase() + dayName.slice(1);
      const zoneName = `City of Subiaco — ${dayLabel} (recycling Week ${recyclingWeek})`;
      return { zoneCode, zoneName, councilSlug: this.councilSlug };
    } catch (err) {
      logger.error('Subiaco resolveAddress error', { err });
      return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address resolution failed' };
    }
  }

  /** Return the static schedule for a zone code like \"SUB-TUE-B\". */
  async fetchSchedule(zoneCode: string): Promise<ZoneScheduleData> {
    const match = zoneCode.match(/^SUB-(MON|TUE|WED|THU|FRI)-(A|B)$/);
    if (!match) throw new Error(`Unknown Subiaco zone code: ${zoneCode}`);

    const dayAbbrev     = match[1];
    const recyclingWeek = match[2] as 'A' | 'B';
    const day           = ABBREV_TO_DAY[dayAbbrev];
    const dayLabel      = day.charAt(0).toUpperCase() + day.slice(1);

    return {
      zoneCode,
      zoneName:         `City of Subiaco — ${dayLabel} (recycling Week ${recyclingWeek})`,
      generalDay:       day,
      generalFrequency: 'weekly',   // FOGO (lime green) collected weekly
      recyclingDay:     day,
      recyclingWeek,                // yellow lid — fortnightly
      greenWasteDay:    null,       // no separate green waste (FOGO replaces it)
      greenWasteWeek:   null,
      vergeDates:       null,
    };
  }

  /** Health check — resolve a known Subiaco address and expect any valid SUB zone. */
  async healthCheck(): Promise<boolean> {
    // 1 Rokeby Road remains stable in the live lookup, but day/week can change over time.
    const result = await this.resolveAddress('1 Rokeby Road SUBIACO WA 6008');
    const ok = /^SUB-(MON|TUE|WED|THU|FRI)-(A|B)$/.test(result.zoneCode) && !result.error;
    if (!ok) logger.warn('Subiaco health check failed', { result });
    return ok;
  }
}

/** Singleton export — import this in routes and the scraper runner. */
export const subiacoScraper = new SubiacoScraper();

/** Return true if a (lowercase-trimmed) suburb falls within the Subiaco LGA. */
export function subiacoCanHandle(suburb: string): boolean {
  return SUBIACO_SUBURBS.has(suburb.toLowerCase().trim());
}
