/**
 * Shire of Mundaring — bin collection scraper.
 *
 * Data source (verified 2026-03-17):
 * - Lookup page: https://my.mundaring.wa.gov.au/BinLocationInfo/Details
 * - Address autocomplete: GET /Location/GetBinsLocation?term={text}
 * - Collection details:   GET /BinLocationInfo/Info?parcelNumber={id}&suburb={suburb}
 *
 * Detail endpoint returns HTML with:
 * - Collection Area
 * - FOGO Bin (weekday)
 * - Next Recycle Bin Date (dd/mm/yyyy)
 * - Next General Waste Date (dd/mm/yyyy)
 *
 * Zone code convention: MUN-{DAY_ABBREV}-{RECYCLING_WEEK}
 */

import type { CouncilScraper, ZoneResolution, ZoneScheduleData } from './base/types';
import { logger } from '../utils/logger';

const BASE_URL = 'https://my.mundaring.wa.gov.au';
const USER_AGENT = 'BinMate/1.0 (Perth bin reminder app; contact@binmate.app)';
const REQUEST_TIMEOUT_MS = 10_000;
const REQUEST_MIN_INTERVAL_MS = process.env.NODE_ENV === 'test' ? 0 : 1_000;
const MAX_CANDIDATES = 10;

const WEEK_A_REFERENCE_MS = new Date('2026-01-05T00:00:00.000Z').getTime();
const MS_PER_WEEK = 7 * 86_400_000;

const MUNDARING_SUBURBS = new Set([
  'bailup',
  'beechina',
  'boya',
  'chidlow',
  'darlington',
  'glen forrest',
  'hovea',
  'mahogany creek',
  'mount helena',
  'mundaring',
  'parkerville',
  'sawyers valley',
  'stoneville',
  'the lakes',
  'wooroloo',
  'wundowie',
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

interface SearchCandidate {
  parcelnumber: number;
  streetdetails: string;
  suburb: string;
}

let lastRequestAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mundaringFetch(url: string): Promise<Response> {
  const waitMs = Math.max(0, REQUEST_MIN_INTERVAL_MS - (Date.now() - lastRequestAt));
  if (waitMs > 0) await sleep(waitMs);
  lastRequestAt = Date.now();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Referer: `${BASE_URL}/BinLocationInfo/Details`,
        'X-Requested-With': 'XMLHttpRequest',
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

function extractSuburb(address: string): string | null {
  const waMatch = address.match(/\b([A-Za-z ]+?)\s+(?:WA|Western Australia)\s+\d{4}\b/i);
  if (waMatch) return normalise(waMatch[1]);
  const parts = address.split(',').map((part) => normalise(part)).filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 1] : null;
}

function buildSearchTerms(address: string): string[] {
  const firstPart = address.split(',')[0]?.trim() ?? '';
  const street = firstPart.replace(/^\s*\d+[a-z]?\s*\/(?=\d+[a-z]?\s)/i, '').replace(/\s+/g, ' ').trim();
  const streetNoNumber = street.replace(/^\d+[a-z]?\s+/, '').trim();
  const suburb = extractSuburb(address);
  const terms = [address, street, streetNoNumber, suburb].filter((term): term is string => Boolean(term));
  return [...new Set(terms)];
}

function scoreCandidate(inputAddress: string, candidate: SearchCandidate): number {
  const input = normalise(inputAddress);
  const inputNumber = extractHouseNumber(inputAddress);
  const inputSuburb = extractSuburb(inputAddress);
  const candidateText = normalise(candidate.streetdetails);
  let score = 0;

  if (inputNumber && extractHouseNumber(candidate.streetdetails) === inputNumber) score += 5;
  if (inputSuburb && candidateText.includes(inputSuburb)) score += 4;
  for (const token of input.split(' ').filter((token) => token.length > 2)) {
    if (candidateText.includes(token)) score += 1;
  }
  return score;
}

function parseDateWeek(dateStr: string): 'A' | 'B' | null {
  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const year = parseInt(match[3], 10);
  const dateMs = Date.UTC(year, month, day);
  const diffWeeks = Math.floor((dateMs - WEEK_A_REFERENCE_MS) / MS_PER_WEEK);
  return diffWeeks % 2 === 0 ? 'A' : 'B';
}

function parseWeekday(text: string): string | null {
  const match = text.toLowerCase().match(/\b(monday|tuesday|wednesday|thursday|friday)\b/);
  return match?.[1] ?? null;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
}

function extractFieldValue(html: string, labelText: string): string {
  const pattern = new RegExp(`<label[^>]*>${labelText}[\\s\\S]*?<\\/label>\\s*([\\s\\S]*?)<\\/div>`, 'i');
  const match = html.match(pattern);
  if (!match) return '';
  return stripTags(match[1]);
}

async function searchCandidates(term: string): Promise<SearchCandidate[]> {
  const params = new URLSearchParams({ term });
  const res = await mundaringFetch(`${BASE_URL}/Location/GetBinsLocation?${params.toString()}`);
  if (!res.ok) return [];
  const data = await res.json() as SearchCandidate[];
  return Array.isArray(data) ? data : [];
}

async function fetchDetails(parcelNumber: number, suburb: string): Promise<string | null> {
  const params = new URLSearchParams({ parcelNumber: String(parcelNumber), suburb });
  const res = await mundaringFetch(`${BASE_URL}/BinLocationInfo/Info?${params.toString()}`);
  if (!res.ok) return null;
  return res.text();
}

class MundaringScraper implements CouncilScraper {
  readonly councilSlug = 'mundaring';
  readonly councilName = 'Shire of Mundaring';

  /** Resolve an address to an MUN zone via Mundaring's public lookup endpoints. */
  async resolveAddress(address: string): Promise<ZoneResolution> {
    try {
      const allCandidates: SearchCandidate[] = [];
      for (const term of buildSearchTerms(address)) {
        const found = await searchCandidates(term);
        for (const candidate of found) {
          if (!allCandidates.find((c) => c.parcelnumber === candidate.parcelnumber)) allCandidates.push(candidate);
        }
        if (allCandidates.length >= MAX_CANDIDATES) break;
      }

      if (!allCandidates.length) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address not found in Mundaring service area' };
      }

      const ranked = [...allCandidates]
        .sort((a, b) => scoreCandidate(address, b) - scoreCandidate(address, a))
        .slice(0, MAX_CANDIDATES);

      for (const candidate of ranked) {
        const html = await fetchDetails(candidate.parcelnumber, candidate.suburb);
        if (!html) continue;

        const area = extractFieldValue(html, 'Collection Area :');
        const fogoDayRaw = extractFieldValue(html, 'FOGO Bin');
        const recycleDate = extractFieldValue(html, 'Next Recycle Bin Date');
        const day = parseWeekday(fogoDayRaw);
        const recyclingWeek = parseDateWeek(recycleDate);
        if (!day || !recyclingWeek) continue;

        const dayAbbrev = DAY_TO_ABBREV[day];
        if (!dayAbbrev) continue;

        const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
        const areaSuffix = area ? ` (${area})` : '';
        return {
          zoneCode: `MUN-${dayAbbrev}-${recyclingWeek}`,
          zoneName: `${this.councilName} — ${dayLabel} (recycling Week ${recyclingWeek})${areaSuffix}`,
          councilSlug: this.councilSlug,
        };
      }

      return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address found but collection pattern is unsupported' };
    } catch (err) {
      logger.error('Mundaring resolveAddress error', { err });
      return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address resolution failed' };
    }
  }

  /** Return static schedule metadata for zone code MUN-{DAY}-{A|B}. */
  async fetchSchedule(zoneCode: string): Promise<ZoneScheduleData> {
    const match = zoneCode.match(/^MUN-(MON|TUE|WED|THU|FRI)-(A|B)$/);
    if (!match) throw new Error(`Unknown Mundaring zone code: ${zoneCode}`);

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

  /** Health check using a known Mundaring address from the live lookup service. */
  async healthCheck(): Promise<boolean> {
    const result = await this.resolveAddress('14 Mundaring Weir RD MUNDARING WA 6073');
    return !result.error && /^MUN-(MON|TUE|WED|THU|FRI)-(A|B)$/.test(result.zoneCode);
  }
}

export const mundaringScraper = new MundaringScraper();

/** Return true if a suburb falls within the Shire of Mundaring service area. */
export function mundaringCanHandle(suburb: string): boolean {
  return MUNDARING_SUBURBS.has(suburb.trim().toLowerCase());
}
