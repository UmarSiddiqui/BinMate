import type { CouncilScraper, ZoneResolution, ZoneScheduleData } from './base/types';
import { logger } from '../utils/logger';

const API_BASE = 'https://t1.gosnells.wa.gov.au/API/waste/v8';
const USER_AGENT = 'BinMate/1.0 (Perth bin reminder app; contact@binmate.app)';
const REQUEST_TIMEOUT_MS = 10_000;
const REQUEST_MIN_INTERVAL_MS = process.env.NODE_ENV === 'test' ? 0 : 1_000;
const MAX_CANDIDATES = 10;
const WEEK_A_REFERENCE_MS = new Date('2026-01-05T00:00:00.000Z').getTime();
const MS_PER_WEEK = 7 * 86_400_000;

const GOSNELLS_SUBURBS = new Set([
  'beckenham',
  'canning vale',
  'gosnells',
  'huntingdale',
  'kenwick',
  'langford',
  'maddington',
  'martin',
  'orange grove',
  'southern river',
  'thornlie',
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

interface AddressCandidate {
  Address: string;
  property_no: string;
}

interface AddressResponse {
  results?: AddressCandidate[];
}

interface PropertyRecord {
  rubbish_day?: string;
  recycling?: string | null;
}

interface PropertyResponse {
  results?: PropertyRecord[];
}

let lastRequestAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function gosnellsFetch(url: string, options: RequestInit): Promise<Response> {
  const waitMs = Math.max(0, REQUEST_MIN_INTERVAL_MS - (Date.now() - lastRequestAt));
  if (waitMs > 0) await sleep(waitMs);
  lastRequestAt = Date.now();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'User-Agent': USER_AGENT,
        ...(options.headers ?? {}),
      },
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

function extractStreet(address: string): string {
  return address.split(',')[0]?.trim() ?? '';
}

function scoreCandidate(inputAddress: string, candidateAddress: string): number {
  const input = normalise(inputAddress);
  const candidate = normalise(candidateAddress);
  const inputNumber = extractHouseNumber(inputAddress);
  const inputSuburb = extractInputSuburb(inputAddress);

  let score = 0;
  if (inputNumber && extractHouseNumber(candidateAddress) === inputNumber) score += 5;
  if (inputSuburb && candidate.includes(inputSuburb)) score += 4;

  const tokens = input.split(' ').filter((token) => token.length > 2);
  for (const token of tokens) {
    if (candidate.includes(token)) score += 1;
  }

  return score;
}

function parseDay(dayText: string): string | null {
  const day = dayText.trim().toLowerCase();
  return day in DAY_TO_ABBREV ? day : null;
}

function parseWeekFromIso(isoDate: string): 'A' | 'B' | null {
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const day = parseInt(match[3], 10);
  const diffWeeks = Math.floor((Date.UTC(year, month, day) - WEEK_A_REFERENCE_MS) / MS_PER_WEEK);
  return diffWeeks % 2 === 0 ? 'A' : 'B';
}

async function searchAddress(query: string): Promise<AddressCandidate[]> {
  const res = await gosnellsFetch(`${API_BASE}/address`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) throw new Error(`Gosnells address lookup HTTP ${res.status}`);
  const data = (await res.json()) as AddressResponse;
  return Array.isArray(data.results) ? data.results : [];
}

async function fetchProperty(propertyNo: string): Promise<PropertyRecord | null> {
  const res = await gosnellsFetch(`${API_BASE}/propertyNum/${encodeURIComponent(propertyNo)}`, {
    method: 'GET',
  });

  if (!res.ok) throw new Error(`Gosnells property lookup HTTP ${res.status}`);
  const data = (await res.json()) as PropertyResponse;
  return data.results?.[0] ?? null;
}

async function resolveCandidates(address: string): Promise<AddressCandidate[]> {
  const fullQuery = address.trim();
  const streetQuery = extractStreet(address);

  const fullResults = await searchAddress(fullQuery);
  if (fullResults.length > 0) return fullResults;

  if (streetQuery && streetQuery.toLowerCase() !== fullQuery.toLowerCase()) {
    return searchAddress(streetQuery);
  }

  return [];
}

class GosnellsScraper implements CouncilScraper {
  readonly councilSlug = 'gosnells';
  readonly councilName = 'City of Gosnells';

  /** Resolve a Gosnells address via City waste API (address -> propertyNum). */
  async resolveAddress(address: string): Promise<ZoneResolution> {
    try {
      const candidates = await resolveCandidates(address);
      if (!candidates.length) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address not found in Gosnells service area' };
      }

      const inputSuburb = extractInputSuburb(address);
      const ranked = [...candidates]
        .sort((a, b) => scoreCandidate(address, b.Address) - scoreCandidate(address, a.Address))
        .slice(0, MAX_CANDIDATES);

      for (const candidate of ranked) {
        if (inputSuburb && !normalise(candidate.Address).includes(inputSuburb)) continue;

        const details = await fetchProperty(candidate.property_no);
        const day = details?.rubbish_day ? parseDay(details.rubbish_day) : null;
        const week = details?.recycling ? parseWeekFromIso(details.recycling) : null;
        if (!day || !week) continue;

        const dayAbbrev = DAY_TO_ABBREV[day];
        const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
        const zoneCode = `GOS-${dayAbbrev}-${week}`;
        const zoneName = `City of Gosnells — ${dayLabel} (recycling Week ${week})`;
        return { zoneCode, zoneName, councilSlug: this.councilSlug };
      }

      return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address found but collection pattern is unsupported' };
    } catch (err) {
      logger.error('Gosnells resolveAddress error', { err });
      return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address resolution failed' };
    }
  }

  /** Return static schedule for Gosnells zone code: GOS-{DAY}-{A|B}. */
  async fetchSchedule(zoneCode: string): Promise<ZoneScheduleData> {
    const match = zoneCode.match(/^GOS-(MON|TUE|WED|THU|FRI)-(A|B)$/);
    if (!match) throw new Error(`Unknown Gosnells zone code: ${zoneCode}`);

    const day = ABBREV_TO_DAY[match[1]];
    const week = match[2] as 'A' | 'B';
    const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);

    return {
      zoneCode,
      zoneName: `City of Gosnells — ${dayLabel} (recycling Week ${week})`,
      generalDay: day,
      generalFrequency: 'weekly',
      recyclingDay: day,
      recyclingWeek: week,
      greenWasteDay: null,
      greenWasteWeek: null,
      vergeDates: null,
    };
  }

  /** Health check using known Gosnells address. */
  async healthCheck(): Promise<boolean> {
    const result = await this.resolveAddress('1 Adams Road, Thornlie WA 6108');
    return !result.error && result.zoneCode === 'GOS-WED-A';
  }
}

export const gosnellsScraper = new GosnellsScraper();

/** Return true if a suburb falls within the City of Gosnells service area. */
export function gosnellsCanHandle(suburb: string): boolean {
  return GOSNELLS_SUBURBS.has(suburb.trim().toLowerCase());
}
