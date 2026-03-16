/**
 * City of Cockburn — bin collection scraper.
 *
 * Data source: City of Cockburn map widget API (public JSONP, no auth required)
 * Bin page:    https://www.cockburn.wa.gov.au/Environment-and-Waste/Rubbish-Waste-and-Recycling/Bin-Collection
 * API base:    https://gis1.cockburn.wa.gov.au/webapiv2
 *
 * Live lookup flow (verified 2026-03-16):
 *   1. LikeSearch / FuzzySearch returns candidate properties with dbkey values
 *   2. PropertyInfoSearch/PropertyNo?q={dbkey} returns:
 *      - BinDay: weekly general + weekly recycling collection day
 *      - GardenWaste: fortnightly next collection date (if applicable)
 *      - Area: verge collection area
 *      - JunkWhite1/2, GreenWaste1/2: verge dates for that area
 *
 * Cockburn operates:
 *   - Recycling (yellow lid): weekly
 *   - General waste (red lid): weekly
 *   - Garden organics (lime green lid): fortnightly (if applicable)
 *
 * Zone code convention:
 *   COC-{DAY_ABBREV}-{GARDEN_CODE}-{AREA}
 *   Examples:
 *     COC-TUE-B-7   Tuesday, garden Week B, verge area 7
 *     COC-FRI-A-10  Friday, garden Week A, verge area 10
 *     COC-THU-N-11  Thursday, no garden organics service, verge area 11
 *
 * `Area` is NOT a full kerbside zone identifier. The live API shows the same
 * area can appear on multiple bin days and both garden-week parities, so we
 * persist the full combination of day + garden week + verge area.
 */

import type { CouncilScraper, ZoneResolution, ZoneScheduleData } from './base/types';
import { logger } from '../utils/logger';

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE = 'https://gis1.cockburn.wa.gov.au/webapiv2';
const USER_AGENT = 'BinMate/1.0 (Perth bin reminder app; contact@binmate.app)';
const REQUEST_TIMEOUT_MS = 10_000;
const WEEK_A_REFERENCE = new Date('2026-01-05T00:00:00.000Z');

const MONTH_INDEX: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

const DAY_ABBREV: Record<string, string> = {
  monday: 'MON',
  tuesday: 'TUE',
  wednesday: 'WED',
  thursday: 'THU',
  friday: 'FRI',
};

const ABBREV_DAY: Record<string, string> = {
  MON: 'monday',
  TUE: 'tuesday',
  WED: 'wednesday',
  THU: 'thursday',
  FRI: 'friday',
};

type GardenCode = 'A' | 'B' | 'N';

// ─── Suburb set ───────────────────────────────────────────────────────────────

/**
 * City of Cockburn service-area suburbs (lowercase).
 * This is only a cheap pre-filter; the live property lookup remains definitive.
 */
const COCKBURN_SUBURBS = new Set([
  'atwell',
  'aubin grove',
  'banjup',
  'beeliar',
  'bibra lake',
  'cockburn central',
  'coogee',
  'coolbellup',
  'hamilton hill',
  'hammond park',
  'henderson',
  'jandakot',
  'lake coogee',
  'leeming',
  'munster',
  'north coogee',
  'north lake',
  'south lake',
  'spearwood',
  'success',
  'treeby',
  'wattleup',
  'yangebup',
]);

// ─── Verge areas ──────────────────────────────────────────────────────────────

/**
 * Verge area dates sourced from the live PropertyInfoSearch responses and
 * Cockburn Resource Recovery Calendar 2025-2026 on 2026-03-16.
 */
export const COCKBURN_AREA_VERGE_DATES: Record<number, string[] | null> = {
  0: null,
  1: ['2025-07-07', '2025-10-13', '2026-01-05', '2026-05-04'],
  2: ['2025-07-14', '2025-10-20', '2026-01-12', '2026-05-11'],
  3: ['2025-07-21', '2025-10-27', '2026-01-26', '2026-05-18'],
  4: ['2025-07-28', '2025-11-03', '2026-02-02', '2026-05-25'],
  5: ['2025-08-11', '2025-11-10', '2026-02-16', '2026-06-01'],
  6: ['2025-08-18', '2025-11-17', '2026-02-23', '2026-06-08'],
  7: ['2025-08-25', '2025-11-24', '2026-03-09', '2026-06-15'],
  8: ['2025-09-01', '2025-12-01', '2026-03-16', '2026-06-22'],
  9: ['2025-09-15', '2025-12-08', '2026-03-30', '2026-06-29'],
  10: ['2025-09-22', '2025-12-15', '2026-04-13', '2026-07-06'],
  11: ['2025-09-29', '2026-04-27'],
};

// ─── API response types ──────────────────────────────────────────────────────

interface CockburnSearchRecord {
  name: string;
  dbkey: string;
}

interface CockburnPropertyInfoRecord {
  Address: string;
  PropertyNo: number;
  Suburb: string;
  BinDay: string;
  Area: number;
  JunkWhite1?: string | null;
  GreenWaste1?: string | null;
  JunkWhite2?: string | null;
  GreenWaste2?: string | null;
  GardenWaste?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getWeekLabel(d: Date): 'A' | 'B' {
  const msPerWeek = 7 * 86_400_000;
  const diffMs = d.getTime() - WEEK_A_REFERENCE.getTime();
  const diffWeeks = Math.floor(diffMs / msPerWeek);
  return diffWeeks % 2 === 0 ? 'A' : 'B';
}

function parseCockburnDate(value: string): Date | null {
  const match = value.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const month = MONTH_INDEX[match[2].toLowerCase()];
  const year = parseInt(match[3], 10);
  if (month === undefined) return null;

  return new Date(Date.UTC(year, month, day));
}

function parseGardenWeek(
  binDay: string,
  gardenWaste: string | null | undefined
): 'A' | 'B' | null {
  if (!gardenWaste || !gardenWaste.trim()) return null;

  const match = gardenWaste.match(/\((\d{1,2}-[A-Za-z]{3}-\d{4})\)/);
  if (!match) return null;

  const nextCollectionDate = parseCockburnDate(match[1]);
  if (!nextCollectionDate) return null;

  // Around holiday shifts the displayed next date may be a later weekday.
  // Walk backwards to the most recent matching scheduled weekday.
  const expectedDay = binDay.toLowerCase().trim();
  const expectedDayIndex = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    .indexOf(expectedDay);

  let scheduledDate = nextCollectionDate;
  if (expectedDayIndex !== -1) {
    for (let i = 0; i < 7 && scheduledDate.getUTCDay() !== expectedDayIndex; i++) {
      scheduledDate = new Date(scheduledDate.getTime() - 86_400_000);
    }
  }

  return getWeekLabel(scheduledDate);
}

function parseJsonp<T>(body: string, callbackName: string): T {
  const pattern = new RegExp(`${callbackName}\\((.*)\\);?\\s*$`, 's');
  const match = body.match(pattern);
  if (!match) {
    throw new Error('Invalid JSONP response');
  }
  return JSON.parse(match[1]) as T;
}

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`Cockburn API returned HTTP ${res.status}`);
    }

    return await res.text();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

async function fetchJsonp<T>(url: string, callbackName: string): Promise<T> {
  const body = await fetchText(url);
  return parseJsonp<T>(body, callbackName);
}

async function searchLike(address: string): Promise<CockburnSearchRecord[]> {
  const callbackName = 'binMateLikeSearch';
  const q = address.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  const url =
    `${API_BASE}/LikeSearch` +
    `?callback=${callbackName}` +
    `&app=mapcontrol` +
    `&q=${encodeURIComponent(q)}` +
    `&num=10000` +
    `&theme=Property`;

  return fetchJsonp<CockburnSearchRecord[]>(url, callbackName);
}

async function searchFuzzy(address: string): Promise<CockburnSearchRecord[]> {
  const callbackName = 'binMateFuzzySearch';
  const streetQuery = address.split(',')[0].trim();
  const url =
    `${API_BASE}/FuzzySearch/` +
    `?callback=${callbackName}` +
    `&app=mapcontrol` +
    `&q=${encodeURIComponent(streetQuery)}` +
    `&num=100` +
    `&theme=PROPERTY`;

  return fetchJsonp<CockburnSearchRecord[]>(url, callbackName);
}

function pickBestCandidate(
  address: string,
  records: CockburnSearchRecord[]
): CockburnSearchRecord | null {
  if (!records.length) return null;

  const normalizedInput = normalizeForMatch(address);
  const exact = records.find((record) => normalizeForMatch(record.name) === normalizedInput);
  if (exact) return exact;

  const streetOnly = normalizeForMatch(address.split(',')[0]);
  const streetMatch = records.find((record) => normalizeForMatch(record.name).startsWith(streetOnly));
  if (streetMatch) return streetMatch;

  return records[0];
}

async function fetchPropertyInfo(
  propertyNo: string
): Promise<CockburnPropertyInfoRecord | null> {
  const callbackName = 'binMatePropertyInfo';
  const url =
    `${API_BASE}/PropertyInfoSearch/PropertyNo` +
    `?callback=${callbackName}` +
    `&q=${encodeURIComponent(propertyNo)}` +
    `&search_method=property_no`;

  const results = await fetchJsonp<CockburnPropertyInfoRecord[]>(url, callbackName);
  return results[0] ?? null;
}

function buildZoneCode(day: string, gardenCode: GardenCode, area: number): string {
  const dayAbbrev = DAY_ABBREV[day];
  if (!dayAbbrev) {
    throw new Error(`Unknown Cockburn bin day: ${day}`);
  }
  return `COC-${dayAbbrev}-${gardenCode}-${area}`;
}

function buildZoneName(day: string, gardenCode: GardenCode, area: number): string {
  const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
  const gardenLabel =
    gardenCode === 'N' ? 'No Garden Organics' : `Garden Organics Week ${gardenCode}`;
  return `City of Cockburn — ${dayLabel}, ${gardenLabel}, Area ${area}`;
}

function getVergeDates(area: number): string[] | null {
  const dates = COCKBURN_AREA_VERGE_DATES[area];
  return dates ? [...dates] : null;
}

// ─── Scraper ──────────────────────────────────────────────────────────────────

class CockburnScraper implements CouncilScraper {
  readonly councilSlug = 'cockburn';
  readonly councilName = 'City of Cockburn';

  /**
   * Resolve an address via Cockburn's own property widget.
   * Prefer LikeSearch on the full user input, then fall back to FuzzySearch on
   * the street component if needed.
   */
  async resolveAddress(address: string): Promise<ZoneResolution> {
    try {
      let candidate = pickBestCandidate(address, await searchLike(address));
      if (!candidate) {
        candidate = pickBestCandidate(address, await searchFuzzy(address));
      }

      if (!candidate?.dbkey) {
        return {
          zoneCode: '',
          zoneName: '',
          councilSlug: this.councilSlug,
          error: 'Address not found in Cockburn service area',
        };
      }

      const info = await fetchPropertyInfo(candidate.dbkey);
      if (!info) {
        return {
          zoneCode: '',
          zoneName: '',
          councilSlug: this.councilSlug,
          error: 'Cockburn property lookup returned no schedule data',
        };
      }

      const day = info.BinDay.toLowerCase().trim();
      const area = Number.isFinite(info.Area) ? Math.trunc(info.Area) : 0;
      const gardenWeek = parseGardenWeek(day, info.GardenWaste);
      const gardenCode: GardenCode = gardenWeek ?? 'N';

      const zoneCode = buildZoneCode(day, gardenCode, area);
      const zoneName = buildZoneName(day, gardenCode, area);

      return { zoneCode, zoneName, councilSlug: this.councilSlug };
    } catch (err) {
      logger.error('Cockburn resolveAddress error', { err, address });
      return {
        zoneCode: '',
        zoneName: '',
        councilSlug: this.councilSlug,
        error: 'Address resolution failed',
      };
    }
  }

  /** Return the static schedule data for a zone code such as "COC-TUE-B-7". */
  async fetchSchedule(zoneCode: string): Promise<ZoneScheduleData> {
    const match = zoneCode.match(/^COC-([A-Z]{3})-([ABN])-(\d{1,2})$/);
    if (!match) {
      throw new Error(`Unknown Cockburn zone code: ${zoneCode}`);
    }

    const day = ABBREV_DAY[match[1]];
    const gardenCode = match[2] as GardenCode;
    const area = parseInt(match[3], 10);

    if (!day) {
      throw new Error(`Unknown Cockburn day abbreviation: ${match[1]}`);
    }
    if (!Object.prototype.hasOwnProperty.call(COCKBURN_AREA_VERGE_DATES, area)) {
      throw new Error(`Unknown Cockburn area: ${area}`);
    }

    return {
      zoneCode,
      zoneName: buildZoneName(day, gardenCode, area),
      generalDay: day,
      generalFrequency: 'weekly',
      recyclingDay: day,
      recyclingWeek: 'weekly',
      greenWasteDay: gardenCode === 'N' ? null : day,
      greenWasteWeek: gardenCode === 'N' ? null : gardenCode,
      vergeDates: getVergeDates(area),
    };
  }

  /** Health check — resolve a known Cockburn address. */
  async healthCheck(): Promise<boolean> {
    const result = await this.resolveAddress('155L Beeliar Drive, Yangebup WA 6164');
    const ok = result.zoneCode === 'COC-TUE-B-7' && !result.error;
    if (!ok) {
      logger.warn('Cockburn health check failed', { result });
    }
    return ok;
  }
}

/** Singleton export — import this in routes and the scraper runner. */
export const cockburnScraper = new CockburnScraper();

/** Return true if a (lowercase-trimmed) suburb falls within Cockburn's service area. */
export function cockburnCanHandle(suburb: string): boolean {
  return COCKBURN_SUBURBS.has(suburb.toLowerCase().trim());
}
