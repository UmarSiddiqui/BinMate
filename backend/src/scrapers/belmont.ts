import type { CouncilScraper, ZoneResolution, ZoneScheduleData } from './base/types';
import { logger } from '../utils/logger';

const BASE_URL = 'https://www.belmont.wa.gov.au';
const ADDRESS_SEARCH_PATH = '/api/intramaps/getaddresses';
const PROPERTY_DETAILS_PATH = '/api/intramaps/getpropertydetailsbymapdbkey';
const USER_AGENT = 'BinMate/1.0 (Perth bin reminder app; contact@binmate.app)';
const REQUEST_TIMEOUT_MS = 10_000;
const REQUEST_MIN_INTERVAL_MS = process.env.NODE_ENV === 'test' ? 0 : 1_000;
const MAX_CANDIDATES = 10;

const WEEK_A_REFERENCE_MS = new Date('2026-01-05T00:00:00.000Z').getTime();
const MS_PER_WEEK = 7 * 86_400_000;

const BELMONT_SUBURBS = new Set(['ascot', 'belmont', 'cloverdale', 'kewdale', 'redcliffe', 'rivervale']);
const DAY_TO_ABBREV: Record<string, string> = { monday: 'MON', tuesday: 'TUE', wednesday: 'WED', thursday: 'THU', friday: 'FRI' };
const ABBREV_TO_DAY: Record<string, string> = { MON: 'monday', TUE: 'tuesday', WED: 'wednesday', THU: 'thursday', FRI: 'friday' };

interface AddressCandidate {
  mapkey: number;
  dbkey: number;
  Address: string;
}

interface PropertyDetails {
  Address: string;
  BinDayGeneralWasteFormatted?: string;
  BinDayRecyclingFormatted?: string;
  BinDayFOGOFormatted?: string;
}

let lastRequestAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function belmontFetch(url: string): Promise<Response> {
  const waitMs = Math.max(0, REQUEST_MIN_INTERVAL_MS - (Date.now() - lastRequestAt));
  if (waitMs > 0) await sleep(waitMs);
  lastRequestAt = Date.now();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

function normalise(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s/]/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractHouseNumber(address: string): string | null {
  const match = normalise(address).match(/(?:\b\d+[a-z]?\/)?(\d+[a-z]?)\b/);
  return match?.[1] ?? null;
}

function extractInputSuburb(address: string): string | null {
  const waMatch = address.match(/\b([A-Za-z ]+?)\s+(?:WA|Western Australia)\s+\d{4}\b/i);
  if (waMatch) return normalise(waMatch[1]);

  const parts = address.split(',').map((part) => normalise(part)).filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 1] : null;
}

function scoreCandidate(inputAddress: string, candidate: AddressCandidate): number {
  const input = normalise(inputAddress);
  const inputNumber = extractHouseNumber(inputAddress);
  const inputSuburb = extractInputSuburb(inputAddress);
  const candidateAddress = normalise(candidate.Address);

  let score = 0;
  if (inputNumber && extractHouseNumber(candidate.Address) === inputNumber) score += 5;
  if (inputSuburb && candidateAddress.includes(inputSuburb)) score += 4;

  const tokens = input.split(' ').filter((token) => token.length > 2);
  for (const token of tokens) {
    if (candidateAddress.includes(token)) score += 1;
  }

  return score;
}

function isZeroDate(iso: string | undefined): boolean {
  return !iso || iso.startsWith('0001-01-01');
}

function parseIsoDateParts(iso: string | undefined): { year: number; month: number; day: number } | null {
  if (isZeroDate(iso)) return null;
  const match = (iso as string).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;

  return {
    year: parseInt(match[1], 10),
    month: parseInt(match[2], 10) - 1,
    day: parseInt(match[3], 10),
  };
}

function parseDayFromIso(iso: string | undefined): string | null {
  const parts = parseIsoDateParts(iso);
  if (!parts) return null;

  const dayIndex = new Date(Date.UTC(parts.year, parts.month, parts.day)).getUTCDay();
  const names = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const day = names[dayIndex];
  return day in DAY_TO_ABBREV ? day : null;
}

function parseWeekFromIso(iso: string | undefined): 'A' | 'B' | null {
  const parts = parseIsoDateParts(iso);
  if (!parts) return null;

  const diffWeeks = Math.floor((Date.UTC(parts.year, parts.month, parts.day) - WEEK_A_REFERENCE_MS) / MS_PER_WEEK);

  return diffWeeks % 2 === 0 ? 'A' : 'B';
}

function oppositeWeek(week: 'A' | 'B'): 'A' | 'B' {
  return week === 'A' ? 'B' : 'A';
}

function pickCollectionDay(details: PropertyDetails): string | null {
  const dayValues = [
    parseDayFromIso(details.BinDayGeneralWasteFormatted),
    parseDayFromIso(details.BinDayRecyclingFormatted),
    parseDayFromIso(details.BinDayFOGOFormatted),
  ].filter((value): value is string => !!value);

  if (!dayValues.length) return null;

  const counts = new Map<string, number>();
  for (const day of dayValues) counts.set(day, (counts.get(day) ?? 0) + 1);

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

async function searchAddresses(address: string): Promise<AddressCandidate[]> {
  const url = `${BASE_URL}${ADDRESS_SEARCH_PATH}?key=${encodeURIComponent(address)}`;
  const res = await belmontFetch(url);
  if (res.status === 204) return [];
  if (!res.ok) throw new Error(`Belmont getaddresses HTTP ${res.status}`);

  const data = await res.json() as unknown;
  return Array.isArray(data) ? data as AddressCandidate[] : [];
}

async function fetchPropertyDetails(
  mapkey: number,
  dbkey: number,
): Promise<PropertyDetails | null> {
  const url = `${BASE_URL}${PROPERTY_DETAILS_PATH}?mapkey=${mapkey}&dbkey=${dbkey}`;
  const res = await belmontFetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Belmont getpropertydetails HTTP ${res.status}`);
  return await res.json() as PropertyDetails;
}

function hasServiceData(details: PropertyDetails): boolean {
  return !(
    isZeroDate(details.BinDayGeneralWasteFormatted) &&
    isZeroDate(details.BinDayRecyclingFormatted) &&
    isZeroDate(details.BinDayFOGOFormatted)
  );
}

async function resolvePropertyDetails(address: string): Promise<PropertyDetails | null> {
  const candidates = await searchAddresses(address);
  if (!candidates.length) return null;

  const ranked = [...candidates]
    .filter((candidate) => candidate.mapkey > 0 && candidate.dbkey > 0)
    .sort((a, b) => scoreCandidate(address, b) - scoreCandidate(address, a))
    .slice(0, MAX_CANDIDATES);

  for (const candidate of ranked) {
    const details = await fetchPropertyDetails(candidate.mapkey, candidate.dbkey);
    if (details && hasServiceData(details)) return details;
  }

  return null;
}

class BelmontScraper implements CouncilScraper {
  readonly councilSlug = 'belmont';
  readonly councilName = 'City of Belmont';

  /** Resolve a Belmont address to a FOGO or standard two-bin zone. */
  async resolveAddress(address: string): Promise<ZoneResolution> {
    try {
      const details = await resolvePropertyDetails(address);
      if (!details) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address not found in Belmont service area' };
      }

      const day = pickCollectionDay(details);
      const recyclingWeek = parseWeekFromIso(details.BinDayRecyclingFormatted);
      if (!day || !recyclingWeek) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Could not parse Belmont bin schedule data' };
      }

      const dayAbbrev = DAY_TO_ABBREV[day];
      const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
      const fogoWeek = parseWeekFromIso(details.BinDayFOGOFormatted);

      if (fogoWeek) {
        const relation = fogoWeek === recyclingWeek ? 'S' : 'O';
        const relationLabel = relation === 'S' ? 'same-week FOGO' : 'opposite-week FOGO';
        const zoneCode = `BEL-FOGO-${dayAbbrev}-${recyclingWeek}-${relation}`;
        const zoneName = `City of Belmont — ${dayLabel} (${relationLabel}, recycling Week ${recyclingWeek})`;
        return { zoneCode, zoneName, councilSlug: this.councilSlug };
      }

      const zoneCode = `BEL-STD-${dayAbbrev}-${recyclingWeek}`;
      const zoneName = `City of Belmont — ${dayLabel} (standard, recycling Week ${recyclingWeek})`;
      return { zoneCode, zoneName, councilSlug: this.councilSlug };
    } catch (err) {
      logger.error('Belmont resolveAddress error', { err });
      return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address resolution failed' };
    }
  }

  /** Return schedule metadata for a Belmont zone code. */
  async fetchSchedule(zoneCode: string): Promise<ZoneScheduleData> {
    const fogoMatch = zoneCode.match(/^BEL-FOGO-(MON|TUE|WED|THU|FRI)-(A|B)-(S|O)$/);
    if (fogoMatch) {
      const day = ABBREV_TO_DAY[fogoMatch[1]];
      const recyclingWeek = fogoMatch[2] as 'A' | 'B';
      const relation = fogoMatch[3];
      const greenWasteWeek = relation === 'S' ? recyclingWeek : oppositeWeek(recyclingWeek);
      const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
      const relationLabel = relation === 'S' ? 'same-week FOGO' : 'opposite-week FOGO';

      return {
        zoneCode,
        zoneName: `City of Belmont — ${dayLabel} (${relationLabel}, recycling Week ${recyclingWeek})`,
        generalDay: day,
        generalFrequency: 'weekly',
        recyclingDay: day,
        recyclingWeek,
        greenWasteDay: day,
        greenWasteWeek,
        vergeDates: null,
      };
    }

    const stdMatch = zoneCode.match(/^BEL-STD-(MON|TUE|WED|THU|FRI)-(A|B)$/);
    if (stdMatch) {
      const day = ABBREV_TO_DAY[stdMatch[1]];
      const recyclingWeek = stdMatch[2] as 'A' | 'B';
      const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);

      return {
        zoneCode,
        zoneName: `City of Belmont — ${dayLabel} (standard, recycling Week ${recyclingWeek})`,
        generalDay: day,
        generalFrequency: 'weekly',
        recyclingDay: day,
        recyclingWeek,
        greenWasteDay: null,
        greenWasteWeek: null,
        vergeDates: null,
      };
    }

    throw new Error(`Unknown Belmont zone code: ${zoneCode}`);
  }

  /** Health check using a known Belmont address with active FOGO service. */
  async healthCheck(): Promise<boolean> {
    const result = await this.resolveAddress('1B Keady Street BELMONT WA 6104');
    return !result.error && result.zoneCode.startsWith('BEL-FOGO-THU-');
  }
}

export const belmontScraper = new BelmontScraper();

/** Return true if a suburb falls within the City of Belmont service area. */
export function belmontCanHandle(suburb: string): boolean {
  return BELMONT_SUBURBS.has(suburb.trim().toLowerCase());
}
