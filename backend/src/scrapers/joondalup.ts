/**
 * City of Joondalup — residential bin collection scraper.
 *
 * Data source: City of Joondalup public JSON endpoints used by the website widget:
 *   - /aapi/coj/propertylookup/{address}
 *   - /aapi/coj/bindatelookup/{mapkey}
 *
 * Public page verified 2026-03-16:
 *   https://www.joondalup.wa.gov.au/residents/waste-and-recycling/residential-bin-collections
 */

import type { CouncilScraper, ZoneResolution, ZoneScheduleData } from './base/types';
import { logger } from '../utils/logger';

const BASE_URL = 'https://www.joondalup.wa.gov.au';
const PROPERTY_LOOKUP_PATH = '/aapi/coj/propertylookup';
const BIN_DATE_LOOKUP_PATH = '/aapi/coj/bindatelookup';

const USER_AGENT = 'BinMate/1.0 (Perth bin reminder app; contact@binmate.app)';
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_CANDIDATES = 12;

const WEEK_A_REFERENCE_MS = new Date('2026-01-05T00:00:00.000Z').getTime();
const MS_PER_WEEK = 7 * 86_400_000;

/** City of Joondalup LGA suburbs (lowercase). Source: City of Joondalup suburbs and wards. */
const JOONDALUP_SUBURBS = new Set([
  'beldon', 'burns beach', 'connolly', 'craigie', 'currambine',
  'duncraig', 'edgewater', 'greenwood', 'heathridge', 'hillarys',
  'iluka', 'joondalup', 'kallaroo', 'kingsley', 'kinross',
  'marmion', 'mullaloo', 'ocean reef', 'padbury', 'sorrento',
  'warwick', 'woodvale',
]);

const DAY_TO_ABBREV: Record<string, string> = {
  monday: 'MON',
  tuesday: 'TUE',
  wednesday: 'WED',
  thursday: 'THU',
  friday: 'FRI',
};

const ABBREV_TO_DAY: Record<string, string> = {
  MON: 'monday',
  TUE: 'tuesday',
  WED: 'wednesday',
  THU: 'thursday',
  FRI: 'friday',
};

interface PropertyLookupResult {
  formatted_address: string;
  house_no: number | null;
  locality: string;
  mapkey: string;
}

interface BinDateResult {
  Rubbish_Day?: string;
  Next_Recycling_Date?: string;
  Next_Recycling_Date_CustomValue?: string;
}

function normalise(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractHouseNumber(address: string): string | null {
  const match = address.match(/(?:\b\d+[a-z]?\/)?(\d+[a-z]?)\b/i);
  return match?.[1]?.toLowerCase() ?? null;
}

function extractInputSuburb(address: string): string | null {
  const waMatch = address.match(/\b([A-Za-z ]+?)\s+(?:WA|Western Australia)\s+\d{4}\b/i);
  if (waMatch) return normalise(waMatch[1]);

  const parts = address.split(',').map((part) => normalise(part)).filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 1] : null;
}

function scoreCandidate(inputAddress: string, candidate: PropertyLookupResult): number {
  const input = normalise(inputAddress);
  const inputHouseNo = extractHouseNumber(inputAddress);
  const inputSuburb = extractInputSuburb(inputAddress);

  let score = 0;
  if (inputHouseNo && candidate.house_no !== null && String(candidate.house_no) === inputHouseNo) score += 5;
  if (inputSuburb && normalise(candidate.locality) === inputSuburb) score += 4;

  const candidateText = normalise(candidate.formatted_address);
  const tokens = input.split(' ').filter((token) => token.length > 2);
  for (const token of tokens) {
    if (candidateText.includes(token)) score += 1;
  }
  return score;
}

function parseRecyclingWeek(row: BinDateResult): 'A' | 'B' | null {
  const iso = row.Next_Recycling_Date_CustomValue?.trim() ?? '';
  if (iso) {
    const ms = Date.parse(iso);
    if (!Number.isNaN(ms)) {
      const date = new Date(ms);
      const diffWeeks = Math.floor((Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
      ) - WEEK_A_REFERENCE_MS) / MS_PER_WEEK);
      return diffWeeks % 2 === 0 ? 'A' : 'B';
    }
  }

  const display = row.Next_Recycling_Date ?? '';
  const match = display.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const year = parseInt(match[3], 10);
  const diffWeeks = Math.floor((Date.UTC(year, month, day) - WEEK_A_REFERENCE_MS) / MS_PER_WEEK);
  return diffWeeks % 2 === 0 ? 'A' : 'B';
}

function parseDay(dayValue: string): string | null {
  const day = normalise(dayValue).split(' ')[0];
  return DAY_TO_ABBREV[day] ? day : null;
}

function oppositeWeek(week: 'A' | 'B'): 'A' | 'B' {
  return week === 'A' ? 'B' : 'A';
}

async function joondalupFetch(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

async function propertyLookup(address: string): Promise<PropertyLookupResult[]> {
  const url = `${BASE_URL}${PROPERTY_LOOKUP_PATH}/${encodeURIComponent(address)}`;
  const res = await joondalupFetch(url);
  if (!res.ok) throw new Error(`Joondalup propertylookup HTTP ${res.status}`);
  const data = await res.json() as unknown;
  return Array.isArray(data) ? data as PropertyLookupResult[] : [];
}

async function binDateLookup(mapkey: string): Promise<BinDateResult | null> {
  const url = `${BASE_URL}${BIN_DATE_LOOKUP_PATH}/${encodeURIComponent(mapkey)}`;
  const res = await joondalupFetch(url);
  if (!res.ok) throw new Error(`Joondalup bindatelookup HTTP ${res.status}`);
  const data = await res.json() as unknown;
  return Array.isArray(data) && data.length > 0 ? data[0] as BinDateResult : null;
}

async function resolvePropertyWithBinData(address: string): Promise<BinDateResult | null> {
  const candidates = await propertyLookup(address);
  if (!candidates.length) return null;

  const ranked = [...candidates]
    .sort((a, b) => scoreCandidate(address, b) - scoreCandidate(address, a))
    .slice(0, MAX_CANDIDATES);

  for (const candidate of ranked) {
    const binData = await binDateLookup(candidate.mapkey);
    if (binData) return binData;
  }
  return null;
}

class JoondalupScraper implements CouncilScraper {
  readonly councilSlug = 'joondalup';
  readonly councilName = 'City of Joondalup';

  /** Resolve a Joondalup address to a zone code using the public lookup endpoints. */
  async resolveAddress(address: string): Promise<ZoneResolution> {
    try {
      const binData = await resolvePropertyWithBinData(address);
      if (!binData) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address not found in Joondalup service area' };
      }

      const day = parseDay(binData.Rubbish_Day ?? '');
      const recyclingWeek = parseRecyclingWeek(binData);
      if (!day || !recyclingWeek) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Could not parse Joondalup bin schedule response' };
      }

      const dayAbbrev = DAY_TO_ABBREV[day];
      const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
      const zoneCode = `JOO-${dayAbbrev}-${recyclingWeek}`;
      const zoneName = `City of Joondalup — ${dayLabel} (recycling Week ${recyclingWeek})`;
      return { zoneCode, zoneName, councilSlug: this.councilSlug };
    } catch (err) {
      logger.error('Joondalup resolveAddress error', { err });
      return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address resolution failed' };
    }
  }

  /** Return weekly general + alternating recycling/green schedule for zone code JOO-{DAY}-{WEEK}. */
  async fetchSchedule(zoneCode: string): Promise<ZoneScheduleData> {
    const match = zoneCode.match(/^JOO-(MON|TUE|WED|THU|FRI)-(A|B)$/);
    if (!match) throw new Error(`Unknown Joondalup zone code: ${zoneCode}`);

    const day = ABBREV_TO_DAY[match[1]];
    const recyclingWeek = match[2] as 'A' | 'B';
    const greenWasteWeek = oppositeWeek(recyclingWeek);
    const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);

    return {
      zoneCode,
      zoneName: `City of Joondalup — ${dayLabel} (recycling Week ${recyclingWeek})`,
      generalDay: day,
      generalFrequency: 'weekly',
      recyclingDay: day,
      recyclingWeek,
      greenWasteDay: day,
      greenWasteWeek,
      vergeDates: null,
    };
  }

  /** Resolve a known Joondalup address via live API to verify scraper health. */
  async healthCheck(): Promise<boolean> {
    const result = await this.resolveAddress('1 King Edward Drive HEATHRIDGE WA 6027');
    return !result.error && result.zoneCode.startsWith('JOO-THU-');
  }
}

export const joondalupScraper = new JoondalupScraper();

/** Return true if a suburb falls within the City of Joondalup service area. */
export function joondalupCanHandle(suburb: string): boolean {
  return JOONDALUP_SUBURBS.has(suburb.trim().toLowerCase());
}

