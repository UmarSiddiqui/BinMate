/**
 * Shire of Serpentine-Jarrahdale — bin collection scraper.
 *
 * Data source (verified 2026-03-17):
 * - SJ website waste widget scripts:
 *   - /profiles/sj/Includes/Scripts/bins.min.js
 *   - /profiles/sj/Includes/Scripts/bins-gw.min.js
 * - IntraMaps integration API:
 *   https://maps.sjshire.wa.gov.au/IntraMaps22B/ApplicationEngine/integration/api/search/
 *
 * API call flow:
 *   1. Search address candidates by free text
 *   2. Fetch details by selected mapkey/dbkey
 *
 * Detail fields used:
 *   - WasteCollectionDay (weekday)
 *   - RecycleCollectionWeek ("Week 1" or "Week 2")
 *   - RecycleDay (fallback parse only)
 *
 * Zone code convention: SJJ-{DAY_ABBREV}-{RECYCLING_WEEK}
 */

import type { CouncilScraper, ZoneResolution, ZoneScheduleData } from './base/types';
import { logger } from '../utils/logger';

const API_BASE = 'https://maps.sjshire.wa.gov.au/IntraMaps22B/ApplicationEngine/integration/api/search/';
const CONFIG_ID = '00000000-0000-0000-0000-000000000000';
const PROJECT_ID = '394a4961-d2ef-48f0-821d-bbd0707fbce0';
const SEARCH_FORM_ID = 'de2aecaf-1e4d-4d25-8146-b0f0109aa458';
const DETAILS_FORM_ID = 'a51626b7-3892-44f4-9fba-b0264486bda5';
const API_KEY = '58383723-1396-43cc-a5cf-722e786208c6';

const USER_AGENT = 'BinMate/1.0 (Perth bin reminder app; contact@binmate.app)';
const REQUEST_TIMEOUT_MS = 10_000;
const REQUEST_MIN_INTERVAL_MS = process.env.NODE_ENV === 'test' ? 0 : 1_000;
const MAX_CANDIDATES = 10;

const SJJ_SUBURBS = new Set([
  'byford',
  'cardup',
  'hopeland',
  'jarrahdale',
  'keysbrook',
  'mardella',
  'mundijong',
  'oldbury',
  'serpentine',
  'whitby',
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

interface ApiField { name: string; caption: string; value: string; }
type SearchRow = ApiField[];
interface Candidate { mapKey: string; dbKey: string; address: string; }

let lastRequestAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sjFetch(url: string): Promise<Response> {
  const waitMs = Math.max(0, REQUEST_MIN_INTERVAL_MS - (Date.now() - lastRequestAt));
  if (waitMs > 0) await sleep(waitMs);
  lastRequestAt = Date.now();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { Authorization: `apikey ${API_KEY}`, 'User-Agent': USER_AGENT },
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

function extractHouseNumber(text: string): string | null {
  const match = normalise(text).match(/(?:\b\d+[a-z]?\/)?(\d+[a-z]?)\b/i);
  return match?.[1] ?? null;
}

function extractInputSuburb(address: string): string | null {
  const waMatch = address.match(/\b([A-Za-z ]+?)\s+(?:WA|Western Australia)\s+\d{4}\b/i);
  if (waMatch) return normalise(waMatch[1]);
  const parts = address.split(',').map((part) => normalise(part)).filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 1] : null;
}

function buildSearchTerms(address: string): string[] {
  const firstPart = address.split(',')[0]?.trim() ?? '';
  const street = firstPart.replace(/^\s*\d+[a-z]?\s*\/(?=\d+[a-z]?\s)/i, '').replace(/\s+/g, ' ').trim();
  const streetWithoutNumber = street.replace(/^\d+[a-z]?\s+/, '').trim();
  const suburb = extractInputSuburb(address);
  const terms = [address, street, streetWithoutNumber, suburb].filter((term): term is string => Boolean(term));
  return [...new Set(terms)];
}

function parseCandidate(row: SearchRow): Candidate | null {
  const mapKey = row.find((f) => f.name.toLowerCase() === 'mapkey')?.value ?? '';
  const dbKey = row.find((f) => f.name.toLowerCase() === 'dbkey')?.value ?? '';
  const address = row.find((f) => f.name.toLowerCase() === 'address')?.value ?? '';
  if (!mapKey || !dbKey || !address) return null;
  return { mapKey, dbKey, address };
}

function scoreCandidate(inputAddress: string, candidate: Candidate): number {
  const input = normalise(inputAddress);
  const candidateText = normalise(candidate.address);
  const inputNumber = extractHouseNumber(inputAddress);
  const inputSuburb = extractInputSuburb(inputAddress);
  let score = 0;

  if (inputNumber && extractHouseNumber(candidate.address) === inputNumber) score += 5;
  if (inputSuburb && candidateText.includes(inputSuburb)) score += 4;
  for (const token of input.split(' ').filter((token) => token.length > 2)) {
    if (candidateText.includes(token)) score += 1;
  }
  return score;
}

function parseDay(text: string): string | null {
  const match = text.toLowerCase().match(/\b(monday|tuesday|wednesday|thursday|friday)\b/);
  return match?.[1] ?? null;
}

function parseWeek(text: string): 'A' | 'B' | null {
  if (/\bweek\s*1\b/i.test(text)) return 'A';
  if (/\bweek\s*2\b/i.test(text)) return 'B';
  return null;
}

async function searchCandidates(address: string): Promise<Candidate[]> {
  for (const term of buildSearchTerms(address)) {
    const params = new URLSearchParams({
      configId: CONFIG_ID,
      project: PROJECT_ID,
      form: SEARCH_FORM_ID,
      fields: term,
    });
    const res = await sjFetch(`${API_BASE}?${params.toString()}`);
    if (!res.ok) continue;

    const data = await res.json() as SearchRow[];
    const parsed = data.map(parseCandidate).filter((c): c is Candidate => Boolean(c));
    if (parsed.length) return parsed;
  }
  return [];
}

async function fetchDetails(mapKey: string, dbKey: string): Promise<ApiField[] | null> {
  const params = new URLSearchParams({
    configId: CONFIG_ID,
    project: PROJECT_ID,
    form: DETAILS_FORM_ID,
    fields: `${mapKey},${dbKey}`,
  });
  const res = await sjFetch(`${API_BASE}?${params.toString()}`);
  if (!res.ok) return null;
  const data = await res.json() as SearchRow[];
  return Array.isArray(data[0]) ? data[0] : null;
}

class SerpentineJJScraper implements CouncilScraper {
  readonly councilSlug = 'serpentinejj';
  readonly councilName = 'Shire of Serpentine-Jarrahdale';

  /** Resolve an address to an SJJ zone via IntraMaps integration API. */
  async resolveAddress(address: string): Promise<ZoneResolution> {
    try {
      const candidates = await searchCandidates(address);
      if (!candidates.length) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address not found in Serpentine-Jarrahdale service area' };
      }

      const ranked = [...candidates]
        .sort((a, b) => scoreCandidate(address, b) - scoreCandidate(address, a))
        .slice(0, MAX_CANDIDATES);

      for (const candidate of ranked) {
        const fields = await fetchDetails(candidate.mapKey, candidate.dbKey);
        if (!fields) continue;

        const wasteDayRaw = fields.find((f) => f.name === 'WasteCollectionDay')?.value ?? '';
        const recycleWeekRaw = fields.find((f) => f.name === 'RecycleCollectionWeek')?.value ?? '';
        const recycleDayRaw = fields.find((f) => f.name === 'RecycleDay')?.value ?? '';

        const day = parseDay(wasteDayRaw) ?? parseDay(recycleDayRaw);
        const recyclingWeek = parseWeek(recycleWeekRaw);
        if (!day || !recyclingWeek) continue;

        const dayAbbrev = DAY_TO_ABBREV[day];
        if (!dayAbbrev) continue;

        const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
        return {
          zoneCode: `SJJ-${dayAbbrev}-${recyclingWeek}`,
          zoneName: `${this.councilName} — ${dayLabel} (recycling Week ${recyclingWeek})`,
          councilSlug: this.councilSlug,
        };
      }

      return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address found but collection pattern is unsupported' };
    } catch (err) {
      logger.error('Serpentine-Jarrahdale resolveAddress error', { err });
      return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address resolution failed' };
    }
  }

  /** Return static schedule metadata for zone code SJJ-{DAY}-{A|B}. */
  async fetchSchedule(zoneCode: string): Promise<ZoneScheduleData> {
    const match = zoneCode.match(/^SJJ-(MON|TUE|WED|THU|FRI)-(A|B)$/);
    if (!match) throw new Error(`Unknown Serpentine-Jarrahdale zone code: ${zoneCode}`);

    const day = ABBREV_TO_DAY[match[1]];
    const recyclingWeek = match[2] as 'A' | 'B';
    const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);

    return {
      zoneCode,
      zoneName: `${this.councilName} — ${dayLabel} (recycling Week ${recyclingWeek})`,
      generalDay: day,
      generalFrequency: 'weekly',
      recyclingDay: day,
      recyclingWeek,
      greenWasteDay: null,
      greenWasteWeek: null,
      vergeDates: null,
    };
  }

  /** Health check using a known Byford address from the live SJ lookup service. */
  async healthCheck(): Promise<boolean> {
    const result = await this.resolveAddress('18 Mead Street BYFORD WA 6122');
    return !result.error && /^SJJ-(MON|TUE|WED|THU|FRI)-(A|B)$/.test(result.zoneCode);
  }
}

export const serpentineJJScraper = new SerpentineJJScraper();

/** Return true when a suburb may be serviced by Shire of Serpentine-Jarrahdale. */
export function serpentineJJCanHandle(suburb: string): boolean {
  return SJJ_SUBURBS.has(suburb.trim().toLowerCase());
}
