import { logger } from '../utils/logger';
const T1_BASE = 'https://kwinana.spatial.t1cloud.com/spatial/intramaps/ApplicationEngine';
const CONFIG_ID = '361cf79c-756a-4c28-903a-a8ed0347cacb';
const PROJECT_ID = '139a0e2d-fa83-4232-86e9-5e29f342e289';
const MODULE_ID = 'cbd33a46-14e5-4ca2-9009-03a51dcbc889';
const FORM_ID = '5a7822ea-682a-47d6-996a-c77d71380067';
const SELECTION_LAYER = 'c6352192-20e8-402c-85c1-ca8515d3cae3';
const USER_AGENT = 'BinMate/1.0 (Perth bin reminder app; contact@binmate.app)';
const REQUEST_TIMEOUT_MS = 10_000;
const REQUEST_MIN_INTERVAL_MS = process.env.NODE_ENV === 'test' ? 0 : 1_000;
/** Perth Week-A reference Monday (UTC midnight). */
const WEEK_A_REFERENCE_MS = new Date('2026-01-05T00:00:00.000Z').getTime();
const MS_PER_WEEK = 7 * 86_400_000;
const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
  'User-Agent': USER_AGENT,
};
export const MAX_CANDIDATES = 10;
export const DAY_TO_ABBREV: Record<string, string> = {
  monday: 'MON',
  tuesday: 'TUE',
  wednesday: 'WED',
  thursday: 'THU',
  friday: 'FRI',
};
export const ABBREV_TO_DAY: Record<string, string> = {
  MON: 'monday',
  TUE: 'tuesday',
  WED: 'wednesday',
  THU: 'thursday',
  FRI: 'friday',
};
export type WeekToken = 'A' | 'B' | 'W';
export interface SearchResult {
  selectionLayer: string;
  mapKey: string;
  dbKey: string;
  displayValue: string;
}
interface SearchResponse {
  fullText?: SearchResult[] | null;
}
export interface InfoField {
  name?: string;
  caption?: string;
  type?: string;
  value?: { value?: string } | string;
  links?: Array<{ text?: { value?: string } }>;
}
interface RefinePanel {
  fields?: InfoField[];
  feature?: { fields?: InfoField[] };
}
interface RefineResponse {
  infoPanels?: Record<string, RefinePanel | null>;
}
let lastRequestAt = 0;
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function kwinanaFetch(url: string, options: RequestInit): Promise<Response> {
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
  if (suburb) {
    if (streetWithoutNumber) terms.push(`${streetWithoutNumber} ${suburb}`);
    terms.push(suburb);
  }
  return [...new Set(terms.map((term) => term.trim()).filter(Boolean))];
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
export function scoreCandidate(inputAddress: string, candidate: SearchResult): number {
  const input = normalise(inputAddress);
  const candidateText = normalise(candidate.displayValue);
  const inputNumber = extractHouseNumber(inputAddress);
  const inputSuburb = extractInputSuburb(inputAddress);
  let score = 0;
  if (inputNumber && extractHouseNumber(candidate.displayValue) === inputNumber) score += 5;
  if (inputSuburb && candidateText.includes(inputSuburb)) score += 4;
  for (const token of input.split(' ').filter((token) => token.length > 2)) {
    if (candidateText.includes(token)) score += 1;
  }
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
function currentWeekToken(now = new Date()): 'A' | 'B' {
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const diffWeeks = Math.floor((todayUtc - WEEK_A_REFERENCE_MS) / MS_PER_WEEK);
  return diffWeeks % 2 === 0 ? 'A' : 'B';
}
function oppositeWeek(week: 'A' | 'B'): 'A' | 'B' {
  return week === 'A' ? 'B' : 'A';
}
function parseWeekToken(text: string): WeekToken | null {
  const value = text.toLowerCase();
  if (!value) return null;
  if (value.includes('this week')) return currentWeekToken();
  if (value.includes('next week')) return oppositeWeek(currentWeekToken());
  if (value.includes('weekly') || value.includes('every week')) return 'W';
  return null;
}
function extractInfoPanelFields(data: RefineResponse): InfoField[] {
  const panels = Object.values(data.infoPanels ?? {}).filter((panel): panel is RefinePanel => Boolean(panel));
  return panels.flatMap((panel) => {
    if (Array.isArray(panel.feature?.fields) && panel.feature.fields.length > 0) return panel.feature.fields;
    return Array.isArray(panel.fields) ? panel.fields : [];
  });
}
export function parseCollectionPattern(fields: InfoField[]): { day: string; recycleWeek: WeekToken; goWeek: WeekToken } | null {
  let section = '';
  let rubbishText = '';
  let recycleText = '';
  let goText = '';
  for (const field of fields) {
    const type = (field.type ?? '').toLowerCase();
    const name = (field.name ?? field.caption ?? '').trim().toLowerCase();
    const value = fieldValue(field).trim();
    const dayInValue = parseDay(value);
    if ((type === 'heading' || name === 'text') && value) {
      section = value.toLowerCase();
      continue;
    }
    if (name.includes('rubbish collection')) { rubbishText = value; continue; }
    if (name.includes('recycle collection')) { recycleText = value; continue; }
    if (name.includes('garden organic') || name.includes('go collection')) { goText = value; continue; }
    if (dayInValue && section.includes('garden organic') && !goText) { goText = value; continue; }
    if (dayInValue && section.includes('recycle') && !recycleText) recycleText = value;
  }
  const generalDay = parseDay(rubbishText);
  const recyclingDay = parseDay(recycleText);
  const goDay = parseDay(goText);
  const day = generalDay ?? recyclingDay ?? goDay;
  if (!day) return null;
  if (recyclingDay && recyclingDay !== day) return null;
  if (goDay && goDay !== day) return null;
  let recycleWeek = parseWeekToken(recycleText);
  let goWeek = parseWeekToken(goText);
  if (!recycleWeek && goWeek && goWeek !== 'W') recycleWeek = oppositeWeek(goWeek);
  if (!goWeek && recycleWeek && recycleWeek !== 'W') goWeek = oppositeWeek(recycleWeek);
  if (!recycleWeek || !goWeek) return null;
  return { day, recycleWeek, goWeek };
}
export function weekTokenToSchedule(token: WeekToken): 'A' | 'B' | 'weekly' {
  return token === 'W' ? 'weekly' : token;
}
export async function createSession(): Promise<string> {
  const params = new URLSearchParams({
    configId: CONFIG_ID,
    appType: 'MapBuilder',
    project: PROJECT_ID,
    datasetCode: '',
    includeDisabledModules: 'true',
  });
  const res = await kwinanaFetch(`${T1_BASE}/Projects/?${params.toString()}`, { method: 'POST', headers: JSON_HEADERS, body: '{}' });
  if (!res.ok) throw new Error(`Kwinana Projects HTTP ${res.status}`);
  const session = res.headers.get('x-intramaps-session');
  if (!session) throw new Error('Kwinana Projects: missing x-intramaps-session header');
  return session;
}
export async function activateModule(session: string): Promise<void> {
  const res = await kwinanaFetch(`${T1_BASE}/Modules/?IntraMapsSession=${session}`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ module: MODULE_ID, includeBasemaps: true }),
  });
  if (!res.ok) throw new Error(`Kwinana Modules HTTP ${res.status}`);
}
export async function resolveSearchCandidates(address: string, session: string): Promise<SearchResult[]> {
  for (const term of buildSearchTerms(address)) {
    const params = new URLSearchParams({
      infoPanelWidth: '0', mode: 'Refresh', form: FORM_ID, resubmit: 'false',
      selectionLayersFilter: SELECTION_LAYER, IntraMapsSession: session,
    });
    const res = await kwinanaFetch(`${T1_BASE}/Search/?${params.toString()}`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ fields: [term] }),
    });
    if (!res.ok) {
      logger.warn('Kwinana Search request failed', { status: res.status, term });
      continue;
    }
    const data = (await res.json()) as SearchResponse;
    const results = Array.isArray(data.fullText) ? data.fullText : [];
    if (results.length > 0) return uniqueCandidates(results);
  }
  return [];
}
export async function fetchPropertyFields(candidate: SearchResult, session: string): Promise<InfoField[]> {
  const res = await kwinanaFetch(`${T1_BASE}/Search/Refine/Set?IntraMapsSession=${session}`, {
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
  if (!res.ok) throw new Error(`Kwinana Refine/Set HTTP ${res.status}`);
  const data = (await res.json()) as RefineResponse;
  return extractInfoPanelFields(data);
}
