import type { CouncilScraper, ZoneResolution, ZoneScheduleData } from './base/types';
import { logger } from '../utils/logger';

const T1_BASE = 'https://bayswater.spatial.t1cloud.com/spatial/intramaps/ApplicationEngine';
const CONFIG_ID = '359e0f03-92e0-4309-9024-f199f434a742';
const PROJECT_ID = '3c55e04f-d94e-4735-aecf-2e62b40bfd52';
const MODULE_ID = 'd1e90488-605a-43ad-88cd-793e0a7d7c4e';
const FORM_ID = '1e9f6829-fa3b-452a-8ca4-fd7bc2304daa';
const SELECTION_LAYER = 'cfc9e54e-2a37-4069-a1cd-3f0ab1bef88d';
const USER_AGENT = 'BinMate/1.0 (Perth bin reminder app; contact@binmate.app)';
const REQUEST_TIMEOUT_MS = 10_000;
const REQUEST_MIN_INTERVAL_MS = process.env.NODE_ENV === 'test' ? 0 : 1_000;
const MAX_CANDIDATES = 10;
const WEEK_A_REFERENCE_MS = new Date('2026-01-05T00:00:00.000Z').getTime();
const MS_PER_WEEK = 7 * 86_400_000;

const BAYSWATER_SUBURBS = new Set([
  'ashfield', 'bayswater', 'bedford', 'embleton', 'inglewood', 'maylands', 'morley', 'mount lawley', 'noranda',
]);

const DAY_TO_ABBREV: Record<string, string> = { monday: 'MON', tuesday: 'TUE', wednesday: 'WED', thursday: 'THU', friday: 'FRI' };
const ABBREV_TO_DAY: Record<string, string> = { MON: 'monday', TUE: 'tuesday', WED: 'wednesday', THU: 'thursday', FRI: 'friday' };
const MONTH_TO_INDEX: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const JSON_HEADERS = { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'User-Agent': USER_AGENT };

interface SearchResult { selectionLayer: string; mapKey: string; dbKey: string; displayValue: string }
interface SearchResponse { fullText?: SearchResult[] | null }
interface InfoField { caption?: string; name?: string; value?: { value?: string } | string; links?: Array<{ text?: { value?: string } }> }
interface RefinePanel { fields?: InfoField[]; feature?: { fields?: InfoField[] } }
interface RefineResponse { infoPanels?: Record<string, RefinePanel | null> }

let lastRequestAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function bayswaterFetch(url: string, options: RequestInit): Promise<Response> {
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
  const streetWithoutNumber = street.replace(/^\d+[a-z]?\s+/, '').trim();
  const suburb = extractInputSuburb(address);
  if (street) terms.push(street);
  if (streetWithoutNumber && streetWithoutNumber.toLowerCase() !== street.toLowerCase()) terms.push(streetWithoutNumber);
  if (suburb) terms.push(suburb);
  return [...new Set(terms)];
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

function fieldValue(field: InfoField): string {
  if (typeof field.value === 'string') return field.value;
  if (field.value && typeof field.value === 'object' && typeof field.value.value === 'string') return field.value.value;
  return field.links?.[0]?.text?.value ?? '';
}

function parseDay(text: string): string | null {
  const match = text.toLowerCase().match(/\b(monday|tuesday|wednesday|thursday|friday)\b/);
  return match?.[1] ?? null;
}

function parseAreaToWeek(area: string): 'A' | 'B' | null {
  if (/\barea\s*(?:1|one)\b/i.test(area)) return 'B';
  if (/\barea\s*(?:2|two)\b/i.test(area)) return 'A';
  return null;
}

function parseWeekFromDateText(text: string): 'A' | 'B' | null {
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const match = text.match(/(\d{1,2})\s+([A-Za-z]{3,9})(?:\s+(\d{4}))?/);
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const month = MONTH_TO_INDEX[match[2].slice(0, 3).toLowerCase()];
  if (month === undefined) return null;

  let year = match[3] ? parseInt(match[3], 10) : now.getUTCFullYear();
  if (!match[3] && Date.UTC(year, month, day) < todayUtc - 45 * 86_400_000) year += 1;
  const diffWeeks = Math.floor((Date.UTC(year, month, day) - WEEK_A_REFERENCE_MS) / MS_PER_WEEK);
  return diffWeeks % 2 === 0 ? 'A' : 'B';
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

async function createSession(): Promise<string> {
  const params = new URLSearchParams({
    configId: CONFIG_ID,
    appType: 'MapBuilder',
    project: PROJECT_ID,
    datasetCode: '',
    includeDisabledModules: 'true',
  });
  const res = await bayswaterFetch(`${T1_BASE}/Projects/?${params.toString()}`, { method: 'POST', headers: JSON_HEADERS, body: '{}' });
  if (!res.ok) throw new Error(`Bayswater Projects HTTP ${res.status}`);
  const session = res.headers.get('x-intramaps-session');
  if (!session) throw new Error('Bayswater Projects: missing x-intramaps-session header');
  return session;
}

async function activateModule(session: string): Promise<void> {
  const res = await bayswaterFetch(`${T1_BASE}/Modules/?IntraMapsSession=${session}`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ module: MODULE_ID, includeBasemaps: true }),
  });
  if (!res.ok) throw new Error(`Bayswater Modules HTTP ${res.status}`);
}

async function searchAddress(term: string, session: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    infoPanelWidth: '0', mode: 'Refresh', form: FORM_ID, resubmit: 'false', selectionLayersFilter: SELECTION_LAYER, IntraMapsSession: session,
  });
  const res = await bayswaterFetch(`${T1_BASE}/Search/?${params.toString()}`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ fields: [term] }),
  });
  if (!res.ok) throw new Error(`Bayswater Search HTTP ${res.status}`);
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

async function fetchPropertyFields(candidate: SearchResult, session: string): Promise<Record<string, string>> {
  const res = await bayswaterFetch(`${T1_BASE}/Search/Refine/Set?IntraMapsSession=${session}`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ selectionLayer: candidate.selectionLayer, mapKey: candidate.mapKey, dbKey: candidate.dbKey, infoPanelWidth: 0, mode: 'Refresh' }),
  });
  if (!res.ok) throw new Error(`Bayswater Refine/Set HTTP ${res.status}`);

  const data = (await res.json()) as RefineResponse;
  const panels = Object.values(data.infoPanels ?? {}).filter((panel): panel is RefinePanel => Boolean(panel));
  const fields = panels.flatMap((panel) => Array.isArray(panel.fields) && panel.fields.length > 0 ? panel.fields : (panel.feature?.fields ?? []));
  const byName: Record<string, string> = {};

  for (const field of fields) {
    const key = field.name ?? field.caption;
    if (key) byName[key] = fieldValue(field);
  }
  return byName;
}

class BayswaterScraper implements CouncilScraper {
  readonly councilSlug = 'bayswater';
  readonly councilName = 'City of Bayswater';

  /** Resolve an address via Bayswater's T1Cloud mapbuilder service. */
  async resolveAddress(address: string): Promise<ZoneResolution> {
    try {
      const session = await createSession();
      await activateModule(session);
      const candidates = await resolveSearchCandidates(address, session);
      if (!candidates.length) return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address not found in Bayswater service area' };

      const ranked = [...candidates].sort((a, b) => scoreCandidate(address, b) - scoreCandidate(address, a)).slice(0, MAX_CANDIDATES);
      for (const candidate of ranked) {
        const fields = await fetchPropertyFields(candidate, session);
        const day = parseDay(fields['FOGO Green Lid'] ?? fields['Waste Red Lid'] ?? fields['Recycling Yellow Lid'] ?? '');
        const recyclingWeek = parseAreaToWeek(fields.Area ?? '') ?? parseWeekFromDateText(fields['Recycling Yellow Lid'] ?? '');
        if (!day || !recyclingWeek) continue;
        const dayAbbrev = DAY_TO_ABBREV[day];
        if (!dayAbbrev) continue;
        const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
        return { zoneCode: `BAY-${dayAbbrev}-${recyclingWeek}`, zoneName: `City of Bayswater — ${dayLabel} (recycling Week ${recyclingWeek})`, councilSlug: this.councilSlug };
      }

      return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address found but collection pattern is unsupported' };
    } catch (err) {
      logger.error('Bayswater resolveAddress error', { err });
      return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address resolution failed' };
    }
  }

  /** Return static schedule metadata for zone code BAY-{DAY}-{A|B}. */
  async fetchSchedule(zoneCode: string): Promise<ZoneScheduleData> {
    const match = zoneCode.match(/^BAY-(MON|TUE|WED|THU|FRI)-(A|B)$/);
    if (!match) throw new Error(`Unknown Bayswater zone code: ${zoneCode}`);

    const day = ABBREV_TO_DAY[match[1]];
    const recyclingWeek = match[2] as 'A' | 'B';
    const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
    return {
      zoneCode,
      zoneName: `City of Bayswater — ${dayLabel} (recycling Week ${recyclingWeek})`,
      generalDay: day,
      generalFrequency: 'fortnightly',
      recyclingDay: day,
      recyclingWeek,
      greenWasteDay: day,
      greenWasteWeek: 'weekly',
      vergeDates: null,
    };
  }

  /** Health check using a known Bayswater address. */
  async healthCheck(): Promise<boolean> {
    const result = await this.resolveAddress('61 Broun Avenue, Morley WA 6062');
    return !result.error && result.zoneCode === 'BAY-WED-A';
  }
}

export const bayswaterScraper = new BayswaterScraper();

/** Return true if a suburb falls within the City of Bayswater service area. */
export function bayswaterCanHandle(suburb: string): boolean {
  return BAYSWATER_SUBURBS.has(suburb.trim().toLowerCase());
}
