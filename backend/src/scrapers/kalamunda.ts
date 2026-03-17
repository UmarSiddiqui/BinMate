import type { CouncilScraper, ZoneResolution, ZoneScheduleData } from './base/types';
import { logger } from '../utils/logger';

const T1_BASE = 'https://kalamunda.spatial.t1cloud.com/spatial/intramaps/ApplicationEngine';
const CONFIG_ID = '38999f30-1676-4524-b501-0130581a2ba2';
const PROJECT_ID = '3599f26a-72ef-4ae6-99c2-7a335ecb31d8';
const MODULE_ID = '0423add9-3956-4ac9-9b41-3206c4d29358';
const FORM_ID = '4b6f3086-3336-4ccc-a061-4cc2c923aaff';
const SELECTION_LAYER = 'e0b98472-c5bb-4ece-a7cf-e395f275d9d2';
const USER_AGENT = 'BinMate/1.0 (Perth bin reminder app; contact@binmate.app)';
const REQUEST_TIMEOUT_MS = 10_000;
const REQUEST_MIN_INTERVAL_MS = process.env.NODE_ENV === 'test' ? 0 : 1_000;
const MAX_CANDIDATES = 10;

const KALAMUNDA_SUBURBS = new Set([
  'bickley', 'carmel', 'forrestfield', 'gooseberry hill', 'high wycombe', 'kalamunda',
  'lesmurdie', 'maida vale', 'orange grove', 'paulls valley', 'pickering brook',
  'piesse brook', 'walliston',
]);

const DAY_TO_ABBREV: Record<string, string> = { monday: 'MON', tuesday: 'TUE', wednesday: 'WED', thursday: 'THU', friday: 'FRI' };
const ABBREV_TO_DAY: Record<string, string> = { MON: 'monday', TUE: 'tuesday', WED: 'wednesday', THU: 'thursday', FRI: 'friday' };
const JSON_HEADERS = { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'User-Agent': USER_AGENT };

interface SearchResult { selectionLayer: string; mapKey: string; dbKey: string; displayValue: string }
interface SearchResponse { fullText?: SearchResult[] | null }
interface InfoField { caption?: string; value?: { value?: string } | string; links?: Array<{ text?: { value?: string } }> }
interface RefinePanel { fields?: InfoField[]; feature?: { fields?: InfoField[] } }
interface RefineResponse { infoPanels?: Record<string, RefinePanel | null> }

let lastRequestAt = 0;

function sleep(ms: number): Promise<void> { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function kalamundaFetch(url: string, options: RequestInit): Promise<Response> {
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
  const part = address.split(',')[0]?.trim() ?? '';
  return part.replace(/^\s*\d+[a-z]?\s*\/(?=\d+[a-z]?\s)/i, '').replace(/\s+/g, ' ').trim();
}

function buildSearchTerms(address: string): string[] {
  const terms: string[] = [];
  const street = extractStreetQuery(address);
  const streetWithoutNumber = street.replace(/^\d+[a-z]?\s+/, '').trim();
  const suburb = extractInputSuburb(address);
  if (street) terms.push(street);
  if (streetWithoutNumber && streetWithoutNumber.toLowerCase() !== street.toLowerCase()) terms.push(streetWithoutNumber);
  if (suburb) terms.push(suburb);
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
  const tokens = input.split(' ').filter((token) => token.length > 2);
  for (const token of tokens) if (candidateText.includes(token)) score += 1;
  return score;
}

function fieldValue(field: InfoField): string {
  if (typeof field.value === 'string') return field.value;
  if (field.value && typeof field.value === 'object' && typeof field.value.value === 'string') return field.value.value;
  return field.links?.[0]?.text?.value ?? '';
}

function parseAreaToWeek(area: string): 'A' | 'B' | null {
  if (/\barea\s+one\b/i.test(area)) return 'A';
  if (/\barea\s+two\b/i.test(area)) return 'B';
  return null;
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
  const res = await kalamundaFetch(`${T1_BASE}/Projects/?${params.toString()}`, { method: 'POST', headers: JSON_HEADERS });
  if (!res.ok) throw new Error(`Kalamunda Projects HTTP ${res.status}`);
  const session = res.headers.get('x-intramaps-session');
  if (!session) throw new Error('Kalamunda Projects: missing x-intramaps-session header');
  return session;
}

async function activateModule(session: string): Promise<void> {
  const res = await kalamundaFetch(`${T1_BASE}/Modules/?IntraMapsSession=${session}`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ module: MODULE_ID, includeBasemaps: true }),
  });
  if (!res.ok) throw new Error(`Kalamunda Modules HTTP ${res.status}`);
}

async function searchAddress(term: string, session: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    infoPanelWidth: '0',
    mode: 'Refresh',
    form: FORM_ID,
    resubmit: 'false',
    selectionLayersFilter: SELECTION_LAYER,
    IntraMapsSession: session,
  });
  const res = await kalamundaFetch(`${T1_BASE}/Search/?${params.toString()}`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ fields: [term] }),
  });
  if (!res.ok) throw new Error(`Kalamunda Search HTTP ${res.status}`);
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
  const res = await kalamundaFetch(`${T1_BASE}/Search/Refine/Set?IntraMapsSession=${session}`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      selectionLayer: candidate.selectionLayer,
      mapKey: candidate.mapKey,
      dbKey: candidate.dbKey,
      infoPanelWidth: 0,
      mode: 'Refresh',
    }),
  });
  if (!res.ok) throw new Error(`Kalamunda Refine/Set HTTP ${res.status}`);
  const data = (await res.json()) as RefineResponse;
  const panels = Object.values(data.infoPanels ?? {}).filter((panel): panel is RefinePanel => Boolean(panel));
  const fields = panels.flatMap((panel) => {
    if (Array.isArray(panel.fields) && panel.fields.length > 0) return panel.fields;
    return Array.isArray(panel.feature?.fields) ? panel.feature.fields : [];
  });

  const byCaption: Record<string, string> = {};
  for (const field of fields) {
    if (!field.caption) continue;
    byCaption[field.caption] = fieldValue(field);
  }
  return byCaption;
}

class KalamundaScraper implements CouncilScraper {
  readonly councilSlug = 'kalamunda';
  readonly councilName = 'City of Kalamunda';

  /** Resolve an address via Kalamunda's T1Cloud mapbuilder service. */
  async resolveAddress(address: string): Promise<ZoneResolution> {
    try {
      const session = await createSession();
      await activateModule(session);
      const candidates = await resolveSearchCandidates(address, session);
      if (!candidates.length) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address not found in Kalamunda service area' };
      }

      const ranked = [...candidates].sort((a, b) => scoreCandidate(address, b) - scoreCandidate(address, a)).slice(0, MAX_CANDIDATES);
      for (const candidate of ranked) {
        const fields = await fetchPropertyFields(candidate, session);
        const dayName = (fields['Bin Day'] ?? '').trim().toLowerCase();
        const dayAbbrev = DAY_TO_ABBREV[dayName];
        const recyclingWeek = parseAreaToWeek(fields['Bin Area'] ?? '');
        if (!dayAbbrev || !recyclingWeek) continue;

        const dayLabel = dayName.charAt(0).toUpperCase() + dayName.slice(1);
        const zoneCode = `KAL-${dayAbbrev}-${recyclingWeek}`;
        const zoneName = `City of Kalamunda — ${dayLabel} (recycling Week ${recyclingWeek})`;
        return { zoneCode, zoneName, councilSlug: this.councilSlug };
      }

      return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address found but collection pattern is unsupported' };
    } catch (err) {
      logger.error('Kalamunda resolveAddress error', { err });
      return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address resolution failed' };
    }
  }

  /** Return the static schedule for a Kalamunda zone code: KAL-{DAY}-{A|B}. */
  async fetchSchedule(zoneCode: string): Promise<ZoneScheduleData> {
    const match = zoneCode.match(/^KAL-(MON|TUE|WED|THU|FRI)-(A|B)$/);
    if (!match) throw new Error(`Unknown Kalamunda zone code: ${zoneCode}`);
    const day = ABBREV_TO_DAY[match[1]];
    const recyclingWeek = match[2] as 'A' | 'B';
    const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
    return {
      zoneCode,
      zoneName: `City of Kalamunda — ${dayLabel} (recycling Week ${recyclingWeek})`,
      generalDay: day,
      generalFrequency: 'weekly',
      recyclingDay: day,
      recyclingWeek,
      greenWasteDay: day,
      greenWasteWeek: 'weekly',
      vergeDates: null,
    };
  }

  /** Health check using a known Kalamunda residential address. */
  async healthCheck(): Promise<boolean> {
    const result = await this.resolveAddress('1 Amaroo Street, Lesmurdie WA 6076');
    return !result.error && result.zoneCode === 'KAL-FRI-A';
  }
}

export const kalamundaScraper = new KalamundaScraper();

/** Return true if a suburb falls within the City of Kalamunda service area. */
export function kalamundaCanHandle(suburb: string): boolean {
  return KALAMUNDA_SUBURBS.has(suburb.trim().toLowerCase());
}
