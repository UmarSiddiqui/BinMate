import type { CouncilScraper, ZoneResolution, ZoneScheduleData } from './base/types';
import { logger } from '../utils/logger';

const QGIS_BASE = 'https://maps.vicpark.wa.gov.au/pozi/qgisserver';
const CORE_MAP = 'E:/PoziProjects/Core.qgs';
const WASTE_MAP = 'E:/PoziProjects/OurTown.qgs';
const USER_AGENT = 'BinMate/1.0 (Perth bin reminder app; contact@binmate.app)';
const REQUEST_TIMEOUT_MS = 10_000;
const REQUEST_MIN_INTERVAL_MS = process.env.NODE_ENV === 'test' ? 0 : 1_000;
const MAX_CANDIDATES = 10;
const BBOX_EPSILONS = [0.00002, 0.0002] as const;
const WEEK_A_REFERENCE_MS = new Date('2026-01-05T00:00:00.000Z').getTime();
const MS_PER_WEEK = 7 * 86_400_000;

const VICTORIA_PARK_SUBURBS = new Set([
  'bentley', 'burswood', 'carlisle', 'curtin university', 'east victoria park',
  'lathlain', 'st james', 'victoria park', 'welshpool',
]);

const DAY_TO_ABBREV: Record<string, string> = {
  monday: 'MON', tuesday: 'TUE', wednesday: 'WED', thursday: 'THU', friday: 'FRI',
};

const ABBREV_TO_DAY: Record<string, string> = {
  MON: 'monday', TUE: 'tuesday', WED: 'wednesday', THU: 'thursday', FRI: 'friday',
};

const MONTH_TO_INDEX: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

let lastRequestAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function vicParkFetch(url: string): Promise<Response> {
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

function extractHouseNumber(text: string): string | null {
  const match = text.match(/(?:\b\d+[a-z]?\/)?(\d+[a-z]?)\b/i);
  return match?.[1]?.toLowerCase() ?? null;
}

function extractInputSuburb(address: string): string | null {
  const waMatch = address.match(/\b([A-Za-z ]+?)\s+(?:WA|Western Australia)\s+\d{4}\b/i);
  if (waMatch) return normalise(waMatch[1]);
  const parts = address.split(',').map((part) => normalise(part)).filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 1] : null;
}

function escapeExpFilterLiteral(text: string): string {
  return text.replace(/'/g, "''");
}

function scoreCandidate(inputAddress: string, candidateAddress: string, locality: string): number {
  const input = normalise(inputAddress);
  const candidate = `${normalise(candidateAddress)} ${normalise(locality)}`.trim();
  const inputNumber = extractHouseNumber(inputAddress);
  const inputSuburb = extractInputSuburb(inputAddress);

  let score = 0;
  if (inputNumber && extractHouseNumber(candidateAddress) === inputNumber) score += 5;
  if (inputSuburb && candidate.includes(inputSuburb)) score += 4;

  for (const token of input.split(' ').filter((t) => t.length > 2)) {
    if (candidate.includes(token)) score += 1;
  }
  return score;
}

function firstRing(geometry: { type?: string; coordinates?: unknown } | undefined): number[][] {
  if (!geometry || !Array.isArray(geometry.coordinates)) return [];
  if (geometry.type === 'Polygon') return geometry.coordinates[0] as number[][];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates[0]?.[0] as number[][];
  return [];
}

function centerPoint(geometry: { type?: string; coordinates?: unknown } | undefined): [number, number] | null {
  const ring = firstRing(geometry);
  if (!ring.length) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const [x, y] of ring) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
  return [(minX + maxX) / 2, (minY + maxY) / 2];
}

function parseDay(text: string): string | null {
  const match = text.toLowerCase().match(/\b(monday|tuesday|wednesday|thursday|friday)\b/);
  return match?.[1] ?? null;
}

function parseWeekFromDateMs(dateMs: number): 'A' | 'B' {
  const diffWeeks = Math.floor((dateMs - WEEK_A_REFERENCE_MS) / MS_PER_WEEK);
  return diffWeeks % 2 === 0 ? 'A' : 'B';
}

function parseWeekFromRecyclingText(text: string): 'A' | 'B' | null {
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (/\btoday\b/i.test(text)) return parseWeekFromDateMs(todayUtc);
  if (/\btomorrow\b/i.test(text)) return parseWeekFromDateMs(todayUtc + 86_400_000);

  const match = text.match(/(\d{1,2})\s+([A-Za-z]{3,9})(?:\s+(\d{4}))?/);
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const month = MONTH_TO_INDEX[match[2].slice(0, 3).toLowerCase()];
  if (month === undefined) return null;

  let year = match[3] ? parseInt(match[3], 10) : now.getUTCFullYear();
  if (!match[3] && Date.UTC(year, month, day) < todayUtc - 45 * 86_400_000) year += 1;
  return parseWeekFromDateMs(Date.UTC(year, month, day));
}

function parseWasteZone(feature: { properties?: Record<string, string> }): { day: string; recyclingWeek: 'A' | 'B' } | null {
  const props = feature.properties ?? {};
  const fogo = props['FOGO Collection'] ?? '';
  const general = props['General Waste 3bin system with FOGO'] ?? '';
  const recycling = props['Recycling Collection'] ?? '';

  if (/multi\s*unit|\bn\/?a\b/i.test(fogo)) return null;

  const day = parseDay(fogo) ?? parseDay(general) ?? parseDay(recycling);
  if (!day) return null;

  const group = general.match(/Group\s*([12])/i)?.[1] ?? null;
  const recyclingWeek = group === '1'
    ? 'B'
    : group === '2'
      ? 'A'
      : parseWeekFromRecyclingText(recycling);

  if (!recyclingWeek) return null;
  return { day, recyclingWeek };
}

async function searchPropertyCandidates(query: string): Promise<Array<{ properties?: { Address?: string; Locality?: string }; geometry?: { type?: string; coordinates?: unknown } }>> {
  const params = new URLSearchParams({
    MAP: CORE_MAP,
    SERVICE: 'WFS',
    REQUEST: 'GetFeature',
    TYPENAME: 'Property_-_Address',
    SRSNAME: 'EPSG:4326',
    OUTPUTFORMAT: 'application/json',
    EXP_FILTER: `Address ilike '${escapeExpFilterLiteral(query)}%'`,
    maxfeatures: String(MAX_CANDIDATES),
  });

  const res = await vicParkFetch(`${QGIS_BASE}?${params.toString()}`);
  if (!res.ok) throw new Error(`Victoria Park property lookup HTTP ${res.status}`);

  const data = await res.json() as { features?: Array<{ properties?: { Address?: string; Locality?: string }; geometry?: { type?: string; coordinates?: unknown } }> };
  return Array.isArray(data.features) ? data.features : [];
}

async function resolveCandidates(address: string): Promise<Array<{ properties?: { Address?: string; Locality?: string }; geometry?: { type?: string; coordinates?: unknown } }>> {
  const full = address.trim();
  const fullResults = await searchPropertyCandidates(full);
  if (fullResults.length > 0) return fullResults;

  const street = address.split(',')[0]?.trim() ?? '';
  if (street && street.toLowerCase() !== full.toLowerCase()) {
    return searchPropertyCandidates(street);
  }

  return [];
}

async function fetchWasteByPoint(lon: number, lat: number): Promise<{ properties?: Record<string, string> } | null> {
  for (const epsilon of BBOX_EPSILONS) {
    const bbox = [lon - epsilon, lat - epsilon, lon + epsilon, lat + epsilon, 'EPSG:4326'].join(',');
    const params = new URLSearchParams({
      MAP: WASTE_MAP,
      SERVICE: 'WFS',
      REQUEST: 'GetFeature',
      VERSION: '1.1.0',
      TYPENAME: 'Waste_Collection',
      SRSNAME: 'EPSG:4326',
      OUTPUTFORMAT: 'application/json',
      BBOX: bbox,
      MAXFEATURES: '5',
    });

    const res = await vicParkFetch(`${QGIS_BASE}?${params.toString()}`);
    if (!res.ok) throw new Error(`Victoria Park waste lookup HTTP ${res.status}`);

    const data = await res.json() as { features?: Array<{ properties?: Record<string, string> }> };
    if (data.features?.[0]) return data.features[0];
  }
  return null;
}

class VictoriaParkScraper implements CouncilScraper {
  readonly councilSlug = 'victoriapark';
  readonly councilName = 'Town of Victoria Park';
  async resolveAddress(address: string): Promise<ZoneResolution> {
    try {
      const candidates = await resolveCandidates(address);
      if (!candidates.length) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address not found in Victoria Park service area' };
      }

      const inputSuburb = extractInputSuburb(address);
      const ranked = [...candidates]
        .sort((a, b) => scoreCandidate(address, b.properties?.Address ?? '', b.properties?.Locality ?? '') - scoreCandidate(address, a.properties?.Address ?? '', a.properties?.Locality ?? ''))
        .slice(0, MAX_CANDIDATES);

      for (const candidate of ranked) {
        const locality = normalise(candidate.properties?.Locality ?? '');
        if (inputSuburb && locality && !locality.includes(inputSuburb)) continue;

        const point = centerPoint(candidate.geometry);
        if (!point) continue;

        const wasteFeature = await fetchWasteByPoint(point[0], point[1]);
        if (!wasteFeature) continue;

        const parsed = parseWasteZone(wasteFeature);
        if (!parsed) continue;

        const dayAbbrev = DAY_TO_ABBREV[parsed.day];
        const dayLabel = parsed.day.charAt(0).toUpperCase() + parsed.day.slice(1);
        const zoneCode = `TVP-${dayAbbrev}-${parsed.recyclingWeek}`;
        const zoneName = `Town of Victoria Park — ${dayLabel} (recycling Week ${parsed.recyclingWeek})`;
        return { zoneCode, zoneName, councilSlug: this.councilSlug };
      }

      return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address found but collection pattern is unsupported' };
    } catch (err) {
      logger.error('Victoria Park resolveAddress error', { err });
      return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address resolution failed' };
    }
  }

  async fetchSchedule(zoneCode: string): Promise<ZoneScheduleData> {
    const match = zoneCode.match(/^TVP-(MON|TUE|WED|THU|FRI)-(A|B)$/);
    if (!match) throw new Error(`Unknown Victoria Park zone code: ${zoneCode}`);

    const day = ABBREV_TO_DAY[match[1]];
    const recyclingWeek = match[2] as 'A' | 'B';
    const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);

    return {
      zoneCode,
      zoneName: `Town of Victoria Park — ${dayLabel} (recycling Week ${recyclingWeek})`,
      generalDay: day,
      generalFrequency: 'fortnightly',
      recyclingDay: day,
      recyclingWeek,
      greenWasteDay: day,
      greenWasteWeek: 'weekly',
      vergeDates: null,
    };
  }

  async healthCheck(): Promise<boolean> {
    const result = await this.resolveAddress('99 Shepperton Road, Victoria Park WA 6100');
    return !result.error && result.zoneCode === 'TVP-TUE-B';
  }
}

export const victoriaParkScraper = new VictoriaParkScraper();
export function victoriaParkCanHandle(suburb: string): boolean {
  return VICTORIA_PARK_SUBURBS.has(suburb.trim().toLowerCase());
}
