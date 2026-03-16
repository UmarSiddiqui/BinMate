/**
 * City of Canning — bin collection scraper.
 *
 * Data source: City of Canning property-details REST API
 * Base URL:    https://www.canning.wa.gov.au/api/property-details
 *
 * Canning operates a two-bin fortnightly kerbside system:
 *   - General waste (red lid):  FORTNIGHTLY — opposite week to recycling
 *   - Recycling (yellow lid):   FORTNIGHTLY
 *   - Verge / junk waste:       specific dates returned by the bins endpoint
 *
 * API call flow (two sequential GET requests):
 *   1. Find: GET /find/{encodedSearchTerm} → [{key, address}, ...]
 *   2. Bins: GET /bins/{key}               → {rubbishCollectionDate, recyclingCollectionDate, ...}
 *
 * Date format: midnight AWST stored as UTC offset, e.g.
 *   "2026-03-17T16:00:00+00:00" = 2026-03-18T00:00:00 AWST = Wednesday 18 March
 *   Add AWST_OFFSET_MS (+8h) to obtain the AWST calendar date.
 *
 * Zone code convention: CAN-{DAY_ABBREV}-{RECYCLING_WEEK}  e.g. "CAN-WED-B"
 *   {RECYCLING_WEEK} is the week the yellow lid (recycling) is collected.
 *   The opposite week carries general (red lid) waste.
 *
 * Schema note: generalDay is non-nullable so it stores the collection day even
 * though Canning general waste is fortnightly. The schedule computer will show
 * generalDay every week — this is a known Phase 3 limitation.
 * greenWasteDay/greenWasteWeek store the red lid rubbish bin (semantic mismatch).
 *
 * Address search: the find API requires full street-type names.
 * "31 Manning Rd" → 204; "31 Manning Road" → 200 with results.
 * buildSearchTerm() expands common abbreviations before calling the API.
 */

import type { CouncilScraper, ZoneResolution, ZoneScheduleData } from './base/types';
import { logger } from '../utils/logger';

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE = 'https://www.canning.wa.gov.au/api/property-details';
const USER_AGENT = 'BinMate/1.0 (Perth bin reminder app; contact@binmate.app)';
const REQUEST_TIMEOUT_MS = 10_000;

/** AWST = UTC+8 */
const AWST_OFFSET_MS = 8 * 3600_000;
const MS_PER_WEEK = 7 * 86_400_000;

/** Perth Week-A reference Monday (UTC midnight) — must match WEEK_A_REFERENCE in zoneScheduleComputer.ts */
const WEEK_A_REFERENCE_MS = new Date('2026-01-05T00:00:00.000Z').getTime();

// ─── Suburb set ───────────────────────────────────────────────────────────────

/** City of Canning LGA suburbs (lowercase). Source: City of Canning official suburb list. */
const CANNING_SUBURBS = new Set([
  'bentley', 'cannington', 'carlisle', 'east victoria park', 'ferndale',
  'kenwick', 'lynwood', 'maddington', 'orange grove', 'parkwood',
  'queens park', 'riverton', 'rossmoyne', 'shelley', 'st james',
  'welshpool', 'wilson',
]);

// ─── Day maps ─────────────────────────────────────────────────────────────────

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const DAY_TO_ABBREV: Record<string, string> = {
  monday: 'MON', tuesday: 'TUE', wednesday: 'WED', thursday: 'THU', friday: 'FRI',
};

const ABBREV_TO_DAY: Record<string, string> = {
  MON: 'monday', TUE: 'tuesday', WED: 'wednesday', THU: 'thursday', FRI: 'friday',
};

// ─── Address helpers ──────────────────────────────────────────────────────────

/**
 * Street-type abbreviation expansions for the Canning find API.
 * The API returns 204 for abbreviated street types; full names must be used.
 * Each entry is [word-boundary regex, full expansion].
 */
const STREET_ABBREVS: [RegExp, string][] = [
  [/\bRd\b/gi,   'Road'],
  [/\bSt\b/gi,   'Street'],
  [/\bAve?\b/gi, 'Avenue'],
  [/\bHwy\b/gi,  'Highway'],
  [/\bCrt?\b/gi, 'Court'],
  [/\bPl\b/gi,   'Place'],
  [/\bDr\b/gi,   'Drive'],
  [/\bBlvd\b/gi, 'Boulevard'],
  [/\bTce\b/gi,  'Terrace'],
  [/\bEsp\b/gi,  'Esplanade'],
  [/\bPde\b/gi,  'Parade'],
  [/\bCl\b/gi,   'Close'],
  [/\bLn\b/gi,   'Lane'],
  [/\bGr\b/gi,   'Grove'],
  [/\bCct\b/gi,  'Circuit'],
];

/**
 * Build a search term for the Canning find API.
 * Strips suburb/state/postcode (after the first comma) and expands street-type
 * abbreviations so the API returns results rather than 204 No Content.
 */
function buildSearchTerm(address: string): string {
  let term = address.split(',')[0].trim();
  for (const [pattern, expansion] of STREET_ABBREVS) {
    term = term.replace(pattern, expansion);
  }
  return term;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

/**
 * Return the AWST day-of-week name (e.g. "wednesday") for a Canning API timestamp.
 * Canning timestamps are midnight AWST expressed as UTC, so adding 8h gives the
 * AWST calendar date.  Example: "2026-03-17T16:00:00+00:00" → "wednesday".
 */
function getAwstDayName(isoString: string): string {
  const awstDate = new Date(new Date(isoString).getTime() + AWST_OFFSET_MS);
  return DAY_NAMES[awstDate.getUTCDay()];
}

/**
 * Return the Week-A/B label for a Canning API timestamp.
 * Converts the timestamp to an AWST UTC-midnight value then computes weeks
 * elapsed from WEEK_A_REFERENCE — the same logic used by zoneScheduleComputer.ts.
 */
function getAwstWeekLabel(isoString: string): 'A' | 'B' {
  const awstDate = new Date(new Date(isoString).getTime() + AWST_OFFSET_MS);
  const awstMidnightMs = Date.UTC(
    awstDate.getUTCFullYear(), awstDate.getUTCMonth(), awstDate.getUTCDate(),
  );
  const diffWeeks = Math.floor((awstMidnightMs - WEEK_A_REFERENCE_MS) / MS_PER_WEEK);
  return diffWeeks % 2 === 0 ? 'A' : 'B';
}

// ─── API response types ───────────────────────────────────────────────────────

interface CanningFindResult { key: string; address: string; }

interface CanningBinsResult {
  rubbishCollectionDate: string | null;
  recyclingCollectionDate: string | null;
  junkWasteCollectionDates: string[];
  greenWasteCollectionDates: string[];
}

// ─── API helpers ──────────────────────────────────────────────────────────────

/** Call the find endpoint and return matching property records (empty array on no match). */
async function fetchFindResults(searchTerm: string): Promise<CanningFindResult[]> {
  const url = `${API_BASE}/find/${encodeURIComponent(searchTerm)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: controller.signal });
    clearTimeout(timer);
    if (res.status === 204 || res.status === 404) return [];
    if (!res.ok) throw new Error(`Canning find API HTTP ${res.status}`);
    return (await res.json()) as CanningFindResult[];
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/** Call the bins endpoint for a property key and return collection date data. */
async function fetchBinsData(key: string): Promise<CanningBinsResult> {
  const url = `${API_BASE}/bins/${key}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`Canning bins API HTTP ${res.status}`);
    return (await res.json()) as CanningBinsResult;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// ─── Scraper ──────────────────────────────────────────────────────────────────

class CanningScaper implements CouncilScraper {
  readonly councilSlug = 'canning';
  readonly councilName = 'City of Canning';

  /**
   * Resolve a street address to a Canning collection zone.
   * Calls the find API (address search) then the bins API (collection dates).
   */
  async resolveAddress(address: string): Promise<ZoneResolution> {
    try {
      const searchTerm = buildSearchTerm(address);
      const findResults = await fetchFindResults(searchTerm);

      if (!findResults.length) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address not found in Canning service area' };
      }

      const binsData = await fetchBinsData(findResults[0].key);
      const { rubbishCollectionDate, recyclingCollectionDate } = binsData;

      if (!rubbishCollectionDate || !recyclingCollectionDate) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'No collection dates returned for this address' };
      }

      const dayName = getAwstDayName(rubbishCollectionDate);
      const dayAbbrev = DAY_TO_ABBREV[dayName];
      if (!dayAbbrev) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: `Unexpected collection day: ${dayName}` };
      }

      const recyclingWeek = getAwstWeekLabel(recyclingCollectionDate);
      const zoneCode = `CAN-${dayAbbrev}-${recyclingWeek}`;
      const dayLabel = dayName.charAt(0).toUpperCase() + dayName.slice(1);
      const zoneName = `City of Canning — ${dayLabel} (recycling Week ${recyclingWeek})`;
      return { zoneCode, zoneName, councilSlug: this.councilSlug };
    } catch (err) {
      logger.error('Canning resolveAddress error', { err });
      return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address resolution failed' };
    }
  }

  /** Return the static schedule for a zone code like "CAN-WED-B". */
  async fetchSchedule(zoneCode: string): Promise<ZoneScheduleData> {
    const match = zoneCode.match(/^CAN-(MON|TUE|WED|THU|FRI)-(A|B)$/);
    if (!match) throw new Error(`Unknown Canning zone code: ${zoneCode}`);

    const dayAbbrev = match[1];
    const recyclingWeek = match[2] as 'A' | 'B';
    const rubbishWeek: 'A' | 'B' = recyclingWeek === 'A' ? 'B' : 'A';
    const day = ABBREV_TO_DAY[dayAbbrev];
    const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);

    return {
      zoneCode,
      zoneName: `City of Canning — ${dayLabel} (recycling Week ${recyclingWeek})`,
      generalDay: day,
      generalFrequency: 'fortnightly',  // actual frequency; scheduler shows weekly (Phase 3 TODO)
      recyclingDay: day,
      recyclingWeek,                    // yellow lid — fortnightly
      greenWasteDay: day,
      greenWasteWeek: rubbishWeek,      // red lid general waste — fortnightly, opposite to yellow
      vergeDates: null,                 // verge dates are dynamic; use resolveAddress junkWasteCollectionDates
    };
  }

  /** Health check — resolve a known Cannington address and expect CAN-WED-B. */
  async healthCheck(): Promise<boolean> {
    // 31 Manning Rd, Cannington WA 6107 — confirmed Wednesday, recycling Week B (2026-03-24)
    const result = await this.resolveAddress('31 Manning Rd, Cannington WA 6107');
    const ok = result.zoneCode === 'CAN-WED-B' && !result.error;
    if (!ok) logger.warn('Canning health check failed', { result });
    return ok;
  }
}

/** Singleton export — import this in routes and the scraper runner. */
export const canningScraper = new CanningScaper();

/** Return true if a (lowercase-trimmed) suburb falls within the Canning LGA. */
export function canningCanHandle(suburb: string): boolean {
  return CANNING_SUBURBS.has(suburb.toLowerCase().trim());
}
