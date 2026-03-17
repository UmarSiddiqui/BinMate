import type { CouncilScraper, ZoneResolution, ZoneScheduleData } from './base/types';
import { logger } from '../utils/logger';
const T1_BASE = 'https://maps.rockingham.wa.gov.au/IntraMaps23A/ApplicationEngine';
const CONFIG_ID = '00000000-0000-0000-0000-000000000000';
const PROJECT_ID = '1917ad36-6a1d-4145-9eeb-736f8fa9646d';
const MODULE_ID = '571fb157-241b-44f6-878f-904ee2464450';
const FORM_ID = '9c08cb2f-d75d-4ca2-bbb2-88a2a9d3aa48';
const SELECTION_LAYER = '9f256a90-46da-4519-9d0e-d3d1b4e8c462';
const USER_AGENT = 'BinMate/1.0 (Perth bin reminder app; contact@binmate.app)';
const REQUEST_TIMEOUT_MS = 10_000;
const REQUEST_MIN_INTERVAL_MS = process.env.NODE_ENV === 'test' ? 0 : 1_000;
const MAX_CANDIDATES = 10;
const WEEK_A_REFERENCE_MS = new Date('2026-01-05T00:00:00.000Z').getTime();
const MS_PER_WEEK = 7 * 86_400_000;
const ROCKINGHAM_SUBURBS = new Set([
  'baldivis', 'cooloongup', 'east rockingham', 'garden island', 'hillman', 'karnup', 'peron', 'port kennedy',
  'rockingham', 'safety bay', 'secret harbour', 'shoalwater', 'singleton', 'waikiki', 'warnbro',
]);
const DAY_TO_ABBREV: Record<string, string> = { monday: 'MON', tuesday: 'TUE', wednesday: 'WED', thursday: 'THU', friday: 'FRI' };
const ABBREV_TO_DAY: Record<string, string> = { MON: 'monday', TUE: 'tuesday', WED: 'wednesday', THU: 'thursday', FRI: 'friday' };
const MONTH_TO_INDEX: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5,
  jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9,
  nov: 10, november: 10, dec: 11, december: 11,
};
const JSON_HEADERS = { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'User-Agent': USER_AGENT };

interface SearchResult { selectionLayer: string; mapKey: string; dbKey: string; displayValue: string }
interface SearchResponse { fullText?: SearchResult[] | null }
interface InfoField {
  caption?: string;
  name?: string;
  type?: string;
  value?: { value?: string } | string;
}
interface RefineResponse {
  header?: { warning?: string };
  infoPanels?: { info1?: { feature?: { fields?: InfoField[] } } };
}
type Code = 'A' | 'B' | 'W' | 'N';
type CollectionInfo = { day: string | null; code: Code };
let lastRequestAt = 0;
function sleep(ms: number): Promise<void> { return new Promise((resolve) => setTimeout(resolve, ms)); }
async function rockinghamFetch(url: string, options: RequestInit): Promise<Response> {
  const waitMs = Math.max(0, REQUEST_MIN_INTERVAL_MS - (Date.now() - lastRequestAt));
  if (waitMs > 0) await sleep(waitMs);
  lastRequestAt = Date.now();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
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

function extractStreetQuery(address: string): string {
  const firstPart = address.split(',')[0]?.trim() ?? '';
  return firstPart.replace(/^\s*\d+[a-z]?\s*\/(?=\d+[a-z]?\s)/i, '').replace(/\s+/g, ' ').trim();
}

function buildSearchTerms(address: string): string[] {
  const terms: string[] = [];
  const street = extractStreetQuery(address);
  const streetNoNumber = street.replace(/^\d+[a-z]?\s+/, '').trim();
  const suburb = extractInputSuburb(address);

  if (street) terms.push(street);
  if (streetNoNumber && streetNoNumber.toLowerCase() !== street.toLowerCase()) terms.push(streetNoNumber);
  if (suburb) {
    if (streetNoNumber) terms.push(`${streetNoNumber} ${suburb}`);
    terms.push(suburb);
  }

  return [...new Set(terms.map((term) => term.trim()).filter(Boolean))];
}

function scoreCandidate(inputAddress: string, candidate: SearchResult): number {
  const input = normalise(inputAddress);
  const candidateText = normalise(candidate.displayValue);
  const inputNumber = extractHouseNumber(inputAddress);
  const inputSuburb = extractInputSuburb(inputAddress);
  let score = 0;

  if (inputNumber && extractHouseNumber(candidate.displayValue) === inputNumber) score += 5;
  if (inputSuburb && candidateText.includes(inputSuburb)) score += 4;
  for (const token of input.split(' ').filter((token) => token.length > 2)) if (candidateText.includes(token)) score += 1;
  return score;
}

function uniqueCandidates(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  const unique: SearchResult[] = [];
  for (const result of results) {
    const key = `${result.mapKey}:${result.dbKey}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(result);
  }
  return unique;
}

function fieldValue(field: InfoField): string {
  if (typeof field.value === 'string') return field.value;
  if (field.value && typeof field.value === 'object' && typeof field.value.value === 'string') return field.value.value;
  return '';
}

function parseDay(text: string): string | null {
  const match = text.toLowerCase().match(/\b(monday|tuesday|wednesday|thursday|friday)\b/);
  return match?.[1] ?? null;
}

function parseWeekFromDateText(text: string): 'A' | 'B' | null {
  const match = text.match(/(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/);
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const month = MONTH_TO_INDEX[match[2].toLowerCase()];
  const year = parseInt(match[3], 10);
  if (month === undefined) return null;

  const diffWeeks = Math.floor((Date.UTC(year, month, day) - WEEK_A_REFERENCE_MS) / MS_PER_WEEK);
  return diffWeeks % 2 === 0 ? 'A' : 'B';
}

function parseCollectionInfo(text: string): CollectionInfo {
  const value = text.trim();
  if (!value || /^n\/?a$/i.test(value)) return { day: null, code: 'N' };

  const day = parseDay(value);
  if (!day) return { day: null, code: 'N' };

  if (/\bfortnightly\b/i.test(value)) {
    const week = parseWeekFromDateText(value);
    return week ? { day, code: week } : { day: null, code: 'N' };
  }

  if (/\bweekly\b/i.test(value)) return { day, code: 'W' };
  return { day: null, code: 'N' };
}

function pickPrimaryDay(...infos: CollectionInfo[]): string | null {
  const days = infos.map((info) => info.day).filter((value): value is string => Boolean(value));
  if (!days.length) return null;
  const counts = new Map<string, number>();
  for (const day of days) counts.set(day, (counts.get(day) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}
async function createSession(): Promise<string> {
  const params = new URLSearchParams({ configId: CONFIG_ID, appType: 'MapBuilder', project: PROJECT_ID, datasetCode: '', includeDisabledModules: 'true' });
  const res = await rockinghamFetch(`${T1_BASE}/Projects/?${params.toString()}`, { method: 'POST', headers: JSON_HEADERS, body: '{}' });
  if (!res.ok) throw new Error(`Rockingham Projects HTTP ${res.status}`);
  const session = res.headers.get('x-intramaps-session');
  if (!session) throw new Error('Rockingham Projects: missing x-intramaps-session header');
  return session;
}

async function activateModule(session: string): Promise<void> {
  const res = await rockinghamFetch(`${T1_BASE}/Modules/?IntraMapsSession=${session}`, {
    method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ module: MODULE_ID, includeBasemaps: true }),
  });
  if (!res.ok) throw new Error(`Rockingham Modules HTTP ${res.status}`);
}

async function searchAddress(term: string, session: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({ infoPanelWidth: '0', mode: 'Refresh', form: FORM_ID, resubmit: 'false', selectionLayersFilter: SELECTION_LAYER, IntraMapsSession: session });
  const res = await rockinghamFetch(`${T1_BASE}/Search/?${params.toString()}`, {
    method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ fields: [term] }),
  });
  if (!res.ok) throw new Error(`Rockingham Search HTTP ${res.status}`);
  const data = (await res.json()) as SearchResponse;
  return Array.isArray(data.fullText) ? data.fullText : [];
}

async function resolveSearchCandidates(address: string, session: string): Promise<SearchResult[]> {
  for (const term of buildSearchTerms(address)) {
    const results = await searchAddress(term, session);
    if (results.length > 0) return uniqueCandidates(results);
  }
  return [];
}

async function fetchPropertyFields(candidate: SearchResult, session: string): Promise<Record<string, string> | null> {
  const res = await rockinghamFetch(`${T1_BASE}/Search/Refine/Set?IntraMapsSession=${session}`, {
    method: 'POST', headers: JSON_HEADERS,
    body: JSON.stringify({ selectionLayer: candidate.selectionLayer, mapKey: candidate.mapKey, dbKey: candidate.dbKey, infoPanelWidth: 0, mode: 'Refresh' }),
  });
  if (!res.ok) throw new Error(`Rockingham Refine/Set HTTP ${res.status}`);

  const data = (await res.json()) as RefineResponse;
  if (data.header?.warning?.toLowerCase().includes('no spatial object')) return null;

  const fields = data.infoPanels?.info1?.feature?.fields ?? [];
  const byName: Record<string, string> = {};
  for (const field of fields) {
    const key = field.name ?? field.caption;
    if (key) byName[key] = fieldValue(field);
  }

  return byName;
}

class RockinghamScraper implements CouncilScraper {
  readonly councilSlug = 'rockingham';
  readonly councilName = 'City of Rockingham';

  /** Resolve an address via Rockingham's IntraMaps Near Me service. */
  async resolveAddress(address: string): Promise<ZoneResolution> {
    try {
      const session = await createSession();
      await activateModule(session);
      const candidates = await resolveSearchCandidates(address, session);
      if (!candidates.length) return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address not found in Rockingham service area' };

      const ranked = [...candidates].sort((a, b) => scoreCandidate(address, b) - scoreCandidate(address, a)).slice(0, MAX_CANDIDATES);
      for (const candidate of ranked) {
        const fields = await fetchPropertyFields(candidate, session);
        if (!fields) continue;

        const recycle = parseCollectionInfo(fields['Recycle (Yellow Lid)'] ?? '');
        const waste = parseCollectionInfo(fields['Waste (Red Lid)'] ?? '');
        const fogo = parseCollectionInfo(fields['FOGO Bin (FOGO lid)'] ?? '');
        const day = pickPrimaryDay(recycle, waste, fogo);

        if (!day || recycle.code === 'N') continue;
        if (fogo.code !== 'N' && fogo.code !== 'W') continue;

        const dayAbbrev = DAY_TO_ABBREV[day];
        const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
        const zoneCode = `ROC-${dayAbbrev}-${recycle.code}-${waste.code}-${fogo.code}`;
        const zoneName = `City of Rockingham — ${dayLabel} (recycling ${recycle.code}, waste ${waste.code}, FOGO ${fogo.code})`;
        return { zoneCode, zoneName, councilSlug: this.councilSlug };
      }

      return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address found but collection pattern is unsupported' };
    } catch (err) {
      logger.error('Rockingham resolveAddress error', { err });
      return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address resolution failed' };
    }
  }

  /** Return schedule metadata for zone code ROC-{DAY}-{REC}-{WASTE}-{FOGO}. */
  async fetchSchedule(zoneCode: string): Promise<ZoneScheduleData> {
    const match = zoneCode.match(/^ROC-(MON|TUE|WED|THU|FRI)-(A|B|W)-(A|B|W)-(W|N)$/);
    if (!match) throw new Error(`Unknown Rockingham zone code: ${zoneCode}`);

    const day = ABBREV_TO_DAY[match[1]];
    const recCode = match[2] as 'A' | 'B' | 'W';
    const wasteCode = match[3] as 'A' | 'B' | 'W';
    const fogoCode = match[4] as 'W' | 'N';
    const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);

    return {
      zoneCode,
      zoneName: `City of Rockingham — ${dayLabel} (recycling ${recCode}, waste ${wasteCode}, FOGO ${fogoCode})`,
      generalDay: day,
      generalFrequency: wasteCode === 'W' ? 'weekly' : 'fortnightly',
      recyclingDay: day,
      recyclingWeek: recCode === 'W' ? 'weekly' : recCode,
      greenWasteDay: fogoCode === 'N' ? null : day,
      greenWasteWeek: fogoCode === 'N' ? null : 'weekly',
      vergeDates: null,
    };
  }

  /** Health check using a known Rockingham in-area address. */
  async healthCheck(): Promise<boolean> {
    const result = await this.resolveAddress('Sixty Eight Road Baldivis WA 6171');
    return !result.error && result.zoneCode === 'ROC-THU-B-A-W';
  }
}

export const rockinghamScraper = new RockinghamScraper();

/** Return true if a suburb falls within the City of Rockingham service area. */
export function rockinghamCanHandle(suburb: string): boolean {
  return ROCKINGHAM_SUBURBS.has(suburb.trim().toLowerCase());
}
