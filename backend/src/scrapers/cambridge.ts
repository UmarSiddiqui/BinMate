/**
 * Town of Cambridge — bin collection scraper.
 *
 * Data source: official OpenCities "my area" APIs on cambridge.wa.gov.au
 *
 * API call flow:
 *   1. GET /api/v1/myarea/searchfuzzy?keywords={address}&maxresults=5
 *   2. GET /ocapi/Public/myarea/wasteservices?geolocationid={id}&ocsvclang=en-AU&pageLink=...
 *
 * The waste services response is HTML containing service cards for:
 *   - FOGO or Green Waste
 *   - General Waste
 *   - Recycling
 *
 * Cambridge supports both FOGO and non-FOGO properties. Zone codes encode that:
 *   CAM-FOGO-{DAY_ABBREV}-{RECYCLING_WEEK}
 *   CAM-STD-{DAY_ABBREV}-{RECYCLING_WEEK}
 */

import type { CouncilScraper, ZoneResolution, ZoneScheduleData } from './base/types';
import { logger } from '../utils/logger';

const BASE_URL = 'https://www.cambridge.wa.gov.au';
const PAGE_LINK = '/$720CFBD8-DF7E-4B88-BF92-E218D51EE173$/Residents/Waste-Recycling/Find-My-Bin-Day';
const USER_AGENT = 'BinMate/1.0 (Perth bin reminder app; contact@binmate.app)';
const REQUEST_TIMEOUT_MS = 10_000;
const WEEK_A_REFERENCE_MS = new Date('2026-01-05T00:00:00.000Z').getTime();
const MS_PER_WEEK = 7 * 86_400_000;

const CAMBRIDGE_SUBURBS = new Set([
  'churchlands',
  'city beach',
  'floreat',
  'glendalough',
  'jolimont',
  'mount claremont',
  'wembley',
  'wembley downs',
  'west leederville',
  'woodlands',
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

const DAY_PREFIX_TO_NAME: Record<string, string> = {
  mon: 'monday',
  tue: 'tuesday',
  wed: 'wednesday',
  thu: 'thursday',
  fri: 'friday',
};

interface SearchItem {
  Id: string;
  AddressSingleLine: string;
}

interface SearchResponse {
  Items?: SearchItem[];
}

interface WasteResponse {
  success: boolean;
  responseContent?: string;
}

interface ServiceCard {
  title: string;
  nextService: string;
}

async function cambridgeFetch(url: string): Promise<Response> {
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

function extractStreetNumber(text: string): string | null {
  const match = normalise(text).match(/(?:\b\d+[a-z]?\/)?(\d+[a-z]?)\b/);
  return match?.[1] ?? null;
}

function extractInputSuburb(text: string): string | null {
  const match = text.match(/\b([A-Za-z ]+?)\s+(?:WA|Western Australia)\s+\d{4}\b/i);
  if (match) return normalise(match[1]);
  const parts = text.split(',').map((part) => normalise(part)).filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 1] : null;
}

function candidateMatchesInput(input: string, candidate: string): boolean {
  const inputNormalised = normalise(input);
  const candidateNormalised = normalise(candidate);
  const inputNumber = extractStreetNumber(inputNormalised);
  const candidateNumber = extractStreetNumber(candidateNormalised);
  const inputSuburb = extractInputSuburb(input);

  if (inputNumber && candidateNumber && inputNumber !== candidateNumber) return false;
  if (inputSuburb && !candidateNormalised.includes(inputSuburb)) return false;

  const requiredTokens = inputNormalised
    .split(' ')
    .filter((token) => token.length > 2)
    .filter((token) => !['street', 'road', 'avenue', 'drive', 'lane', 'place', 'court', 'wa'].includes(token));

  return requiredTokens.some((token) => candidateNormalised.includes(token));
}

async function searchAddress(address: string): Promise<SearchItem | null> {
  // Strip unit prefix from the search query — Cambridge's API resolves at building
  // level ("125 Herdsman Pde"), not unit level ("14S/125"). The full address (with
  // unit) is still passed to candidateMatchesInput for result validation.
  const query = address.replace(/^\w+\//, '').trim();
  const params = new URLSearchParams({ keywords: query, maxresults: '5' });
  const res = await cambridgeFetch(`${BASE_URL}/api/v1/myarea/searchfuzzy?${params}`);
  if (!res.ok) throw new Error(`Cambridge searchfuzzy HTTP ${res.status}`);

  const data = await res.json() as SearchResponse;
  const items = Array.isArray(data.Items) ? data.Items : [];
  return items.find((item) => candidateMatchesInput(address, item.AddressSingleLine)) ?? null;
}

function parseWasteCards(html: string): ServiceCard[] {
  const cards: ServiceCard[] = [];
  const regex = /<div class="col-xs-12 col-m-6 waste-services-result[\s\S]*?<h3>([^<]+)<\/h3>[\s\S]*?<div class="next-service">\s*([^<]+?)\s*<\/div>/g;

  for (const match of html.matchAll(regex)) {
    cards.push({
      title: match[1].trim(),
      nextService: match[2].trim(),
    });
  }

  return cards;
}

function parseWeek(dateStr: string): 'A' | 'B' | null {
  const match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const year = parseInt(match[3], 10);
  const diffWeeks = Math.floor((Date.UTC(year, month, day) - WEEK_A_REFERENCE_MS) / MS_PER_WEEK);
  return diffWeeks % 2 === 0 ? 'A' : 'B';
}

function parseDay(dateStr: string): string | null {
  const match = dateStr.match(/^([A-Za-z]{3})\b/);
  return match ? DAY_PREFIX_TO_NAME[match[1].toLowerCase()] ?? null : null;
}

function oppositeWeek(week: 'A' | 'B'): 'A' | 'B' {
  return week === 'A' ? 'B' : 'A';
}

async function fetchWasteCards(geolocationId: string): Promise<ServiceCard[]> {
  const params = new URLSearchParams({
    geolocationid: geolocationId,
    ocsvclang: 'en-AU',
    pageLink: PAGE_LINK,
  });
  const res = await cambridgeFetch(`${BASE_URL}/ocapi/Public/myarea/wasteservices?${params}`);
  if (!res.ok) throw new Error(`Cambridge wasteservices HTTP ${res.status}`);

  const data = await res.json() as WasteResponse;
  if (!data.success || !data.responseContent) return [];
  return parseWasteCards(data.responseContent);
}

class CambridgeScraper implements CouncilScraper {
  readonly councilSlug = 'cambridge';
  readonly councilName = 'Town of Cambridge';

  /** Resolve a Cambridge address to a FOGO or non-FOGO collection zone. */
  async resolveAddress(address: string): Promise<ZoneResolution> {
    try {
      const match = await searchAddress(address);
      if (!match) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address not found in Cambridge service area' };
      }

      const cards = await fetchWasteCards(match.Id);
      const generalWaste = cards.find((card) => card.title === 'General Waste');
      const recycling = cards.find((card) => card.title === 'Recycling');
      const fogo = cards.find((card) => card.title === 'FOGO');
      const greenWaste = cards.find((card) => card.title === 'Green Waste');

      if (!generalWaste || !recycling || (!fogo && !greenWaste)) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Incomplete waste service data from Cambridge' };
      }

      const collectionDay = parseDay((fogo ?? generalWaste).nextService);
      const recyclingWeek = parseWeek(recycling.nextService);
      if (!collectionDay || !recyclingWeek) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Could not parse Cambridge waste service dates' };
      }

      const dayAbbrev = DAY_TO_ABBREV[collectionDay];
      const scheme = fogo ? 'FOGO' : 'STD';
      const zoneCode = `CAM-${scheme}-${dayAbbrev}-${recyclingWeek}`;
      const dayLabel = collectionDay.charAt(0).toUpperCase() + collectionDay.slice(1);
      const zoneName = `Town of Cambridge — ${scheme === 'FOGO' ? 'FOGO' : 'standard'} ${dayLabel} (recycling Week ${recyclingWeek})`;

      return { zoneCode, zoneName, councilSlug: this.councilSlug };
    } catch (err) {
      logger.error('Cambridge resolveAddress error', { err });
      return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address resolution failed' };
    }
  }

  /** Return the static schedule for a Cambridge zone code. */
  async fetchSchedule(zoneCode: string): Promise<ZoneScheduleData> {
    const match = zoneCode.match(/^CAM-(FOGO|STD)-(MON|TUE|WED|THU|FRI)-(A|B)$/);
    if (!match) throw new Error(`Unknown Cambridge zone code: ${zoneCode}`);

    const scheme = match[1];
    const day = ABBREV_TO_DAY[match[2]];
    const recyclingWeek = match[3] as 'A' | 'B';
    const alternateWeek = oppositeWeek(recyclingWeek);
    const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);

    return {
      zoneCode,
      zoneName: `Town of Cambridge — ${scheme === 'FOGO' ? 'FOGO' : 'standard'} ${dayLabel} (recycling Week ${recyclingWeek})`,
      generalDay: day,
      generalFrequency: 'weekly',
      recyclingDay: day,
      recyclingWeek,
      greenWasteDay: day,
      greenWasteWeek: alternateWeek,
      vergeDates: null,
    };
  }

  /** Run a live health check against Cambridge's official address search. */
  async healthCheck(): Promise<boolean> {
    const result = await this.resolveAddress('10 Floreat Avenue FLOREAT WA 6014');
    return !result.error && result.zoneCode.startsWith('CAM-FOGO-');
  }
}

export const cambridgeScraper = new CambridgeScraper();

/** Return true when a suburb may be serviced by the Town of Cambridge. */
export function cambridgeCanHandle(suburb: string): boolean {
  return CAMBRIDGE_SUBURBS.has(suburb.trim().toLowerCase());
}
