import type { CouncilScraper, ZoneResolution, ZoneScheduleData } from './base/types';
import { logger } from '../utils/logger';
const API_BASE = 'https://mapping.vincent.wa.gov.au/pozi/qgisserver';
const MAP_PATH = 'C:/Pozi/Waste.qgs';
const WFS_TYPE_NAME = 'Waste_Collection';
const USER_AGENT = 'BinMate/1.0 (Perth bin reminder app; contact@binmate.app)';
const REQUEST_TIMEOUT_MS = 10_000;
const REQUEST_MIN_INTERVAL_MS = process.env.NODE_ENV === 'test' ? 0 : 1_000;
const WEEK_A_REFERENCE_MS = new Date('2026-01-05T00:00:00.000Z').getTime();
const MS_PER_WEEK = 7 * 86_400_000;
const VINCENT_SUBURBS = new Set([
  'highgate',
  'leederville',
  'mount hawthorn',
  'mount lawley',
  'north perth',
  'perth',
  'west perth',
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
interface WasteFeatureProperties {
  Address?: string;
  'General Waste Collection Day'?: string | null;
  'Recycling Collection Day'?: string | null;
  'FOGO Collection Day'?: string | null;
}
interface WasteFeature {
  properties?: WasteFeatureProperties;
}
interface WfsResponse {
  features?: WasteFeature[];
}
interface ParsedCollectionField {
  day: string;
  frequency: 'weekly' | 'fortnightly';
  week: 'A' | 'B' | 'weekly';
}
const MONTH_TO_INDEX: Record<string, number> = {
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
const STREET_NORMALISATION: Array<[RegExp, string]> = [
  [/\bstreet\b/gi, 'St'],
  [/\broad\b/gi, 'Rd'],
  [/\bavenue\b/gi, 'Ave'],
  [/\bterrace\b/gi, 'Tce'],
  [/\bparade\b/gi, 'Pde'],
  [/\bplace\b/gi, 'Pl'],
  [/\bdrive\b/gi, 'Dr'],
  [/\bcourt\b/gi, 'Ct'],
  [/\blane\b/gi, 'Ln'],
  [/\bcrescent\b/gi, 'Cres'],
  [/\bcircuit\b/gi, 'Cct'],
  [/\bboulevard\b/gi, 'Blvd'],
  [/\bhighway\b/gi, 'Hwy'],
];
let lastRequestAt = 0;
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function vincentFetch(url: string): Promise<Response> {
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
function stripHtml(text: string | null | undefined): string {
  return (text ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
function extractInputSuburb(address: string): string | null {
  const waMatch = address.match(/\b([A-Za-z ]+?)\s+(?:WA|Western Australia)\s+\d{4}\b/i);
  if (waMatch) return normalise(waMatch[1]);
  const parts = address.split(',').map((part) => normalise(part)).filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 1] : null;
}
function extractHouseNumber(text: string): string | null {
  const match = text.match(/(?:\b\d+[a-z]?\/)?(\d+[a-z]?)\b/i);
  return match?.[1]?.toLowerCase() ?? null;
}
function normaliseStreetAddress(address: string): string {
  let term = address.split(',')[0].trim();
  term = term.replace(/^\d+[a-z]?\/(?=\d+[a-z]?\s)/i, '');
  for (const [pattern, replacement] of STREET_NORMALISATION) {
    term = term.replace(pattern, replacement);
  }
  return term.replace(/\s+/g, ' ').trim();
}
function escapeXml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&apos;');
}
function buildAddressFilter(literal: string): string {
  return `<Filter><PropertyIsLike wildCard='*' singleChar='.' escape='!'><PropertyName>Address</PropertyName><Literal>${escapeXml(literal)}</Literal></PropertyIsLike></Filter>`;
}
async function fetchAddressCandidates(literal: string): Promise<WasteFeature[]> {
  const params = new URLSearchParams({
    MAP: MAP_PATH,
    SERVICE: 'WFS',
    REQUEST: 'GetFeature',
    VERSION: '1.1.0',
    TYPENAME: WFS_TYPE_NAME,
    SRSNAME: 'EPSG:4326',
    OUTPUTFORMAT: 'application/json',
    FILTER: buildAddressFilter(literal),
  });
  const url = `${API_BASE}?${params.toString()}`;
  const res = await vincentFetch(url);
  if (!res.ok) throw new Error(`Vincent WFS HTTP ${res.status}`);
  const data = (await res.json()) as WfsResponse;
  return Array.isArray(data.features) ? data.features : [];
}
async function searchAddressCandidates(address: string): Promise<WasteFeature[]> {
  const term = normaliseStreetAddress(address);
  if (!term) return [];
  const strict = await fetchAddressCandidates(`${term}*`);
  if (strict.length > 0) return strict;
  return fetchAddressCandidates(`*${term}*`);
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
function parseDateToWeek(dateStr: string): 'A' | 'B' | null {
  const match = dateStr.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const month = MONTH_TO_INDEX[match[2].toLowerCase()];
  const year = parseInt(match[3], 10);
  if (month === undefined) return null;
  const dateMs = Date.UTC(year, month, day);
  const diffWeeks = Math.floor((dateMs - WEEK_A_REFERENCE_MS) / MS_PER_WEEK);
  return diffWeeks % 2 === 0 ? 'A' : 'B';
}
function parseCollectionField(fieldHtml: string | null | undefined): ParsedCollectionField | null {
  const text = stripHtml(fieldHtml);
  if (!text || /\bN\/?A\b/i.test(text)) return null;
  if (/\b2\s*x\s*weekly\b/i.test(text)) return null;
  const frequency: 'weekly' | 'fortnightly' | null =
    /\bfortnightly\b/i.test(text) ? 'fortnightly' :
      /\bweekly\b/i.test(text) ? 'weekly' : null;
  if (!frequency) return null;
  const bracketMatch = text.match(/\(([^)]+)\)/);
  const detail = bracketMatch?.[1]?.replace(/\s+/g, ' ').trim() ?? '';
  if (!detail || detail.includes('/')) return null;
  const dayMatch = detail.toLowerCase().match(/\b(monday|tuesday|wednesday|thursday|friday)\b/);
  if (!dayMatch) return null;
  const day = dayMatch[1];
  if (frequency === 'weekly') {
    return { day, frequency, week: 'weekly' };
  }
  const dateMatch = text.match(/(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})/);
  if (!dateMatch) return null;
  const week = parseDateToWeek(dateMatch[1]);
  if (!week) return null;
  return { day, frequency, week };
}
function parseResidentialZone(feature: WasteFeatureProperties): ZoneResolution | null {
  const general = parseCollectionField(feature['General Waste Collection Day']);
  const recycling = parseCollectionField(feature['Recycling Collection Day']);
  const fogo = parseCollectionField(feature['FOGO Collection Day']);
  if (!general || !recycling || !fogo) return null;
  if (general.frequency !== 'fortnightly') return null;
  if (recycling.frequency !== 'fortnightly') return null;
  if (fogo.frequency !== 'weekly') return null;
  if (recycling.week === 'weekly') return null;
  if (!(general.day === recycling.day && recycling.day === fogo.day)) return null;
  const dayAbbrev = DAY_TO_ABBREV[recycling.day];
  const dayLabel = recycling.day.charAt(0).toUpperCase() + recycling.day.slice(1);
  const zoneCode = `VIN-${dayAbbrev}-${recycling.week}`;
  const zoneName = `City of Vincent — ${dayLabel} (recycling Week ${recycling.week})`;
  return { zoneCode, zoneName, councilSlug: 'vincent' };
}
class VincentScraper implements CouncilScraper {
  readonly councilSlug = 'vincent';
  readonly councilName = 'City of Vincent';
  /** Resolve a Vincent address via the council's live Waste_Collection WFS layer. */
  async resolveAddress(address: string): Promise<ZoneResolution> {
    try {
      const candidates = await searchAddressCandidates(address);
      if (!candidates.length) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address not found in Vincent service area' };
      }
      const ranked = [...candidates].sort((a, b) => {
        const aAddress = a.properties?.Address ?? '';
        const bAddress = b.properties?.Address ?? '';
        return scoreCandidate(address, bAddress) - scoreCandidate(address, aAddress);
      });
      for (const candidate of ranked) {
        const props = candidate.properties;
        if (!props) continue;
        const parsed = parseResidentialZone(props);
        if (parsed) return parsed;
      }
      return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address found but collection pattern is unsupported' };
    } catch (err) {
      logger.error('Vincent resolveAddress error', { err });
      return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address resolution failed' };
    }
  }
  /** Return the static schedule for a Vincent zone code: VIN-{DAY}-{A|B}. */
  async fetchSchedule(zoneCode: string): Promise<ZoneScheduleData> {
    const match = zoneCode.match(/^VIN-(MON|TUE|WED|THU|FRI)-(A|B)$/);
    if (!match) throw new Error(`Unknown Vincent zone code: ${zoneCode}`);
    const day = ABBREV_TO_DAY[match[1]];
    const recyclingWeek = match[2] as 'A' | 'B';
    const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
    return {
      zoneCode,
      zoneName: `City of Vincent — ${dayLabel} (recycling Week ${recyclingWeek})`,
      generalDay: day,
      generalFrequency: 'fortnightly',
      recyclingDay: day,
      recyclingWeek,
      greenWasteDay: day,
      greenWasteWeek: 'weekly',
      vergeDates: null,
    };
  }
  /** Health check using a known Vincent residential address. */
  async healthCheck(): Promise<boolean> {
    const result = await this.resolveAddress('2 Chertsey Street, Mount Lawley WA 6050');
    return !result.error && result.zoneCode.startsWith('VIN-FRI-');
  }
}
export const vincentScraper = new VincentScraper();
/** Return true if a suburb falls within the City of Vincent service area. */
export function vincentCanHandle(suburb: string): boolean {
  return VINCENT_SUBURBS.has(suburb.trim().toLowerCase());
}
