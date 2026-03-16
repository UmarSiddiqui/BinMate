/**
 * Town of Mosman Park — T1Cloud property search scraper.
 * Verified 2026-03-16 from the public launcher:
 *   configId 76eb48b5-17ab-4c7f-82a4-74e34b059b52
 *   module b42bbff6-d727-43d9-b548-2750e61e6318
 *   form 4d26c512-ecd2-4dd6-a36a-529489da356c
 *   street combo 8e4171d4-e94f-41ee-a41b-b64babe8d9f6
 *   suburb combo 5e0feb04-54fb-4196-81b2-9a54637b13e6
 *
 * Waste fields:
 *   "Bin Day"       → "FRIDAY"
 *   "Recycling Day" → "WEEK 1 FRIDAY"
 *
 * Official 2025-26 Waste Guide mapping:
 *   Week 1 = BinMate Week A
 *   Week 2 = BinMate Week B
 */

import type { CouncilScraper, ZoneResolution, ZoneScheduleData } from './base/types';
import { logger } from '../utils/logger';

const T1_BASE = 'https://mosmanpark.spatial.t1cloud.com/spatial/intramaps/ApplicationEngine';
const CONFIG_ID = '76eb48b5-17ab-4c7f-82a4-74e34b059b52';
const PROJECT = 'Mosman Park Public';
const APP_TYPE = 'Standard';
const MODULE_ID = 'b42bbff6-d727-43d9-b548-2750e61e6318';
const FORM_ID = '4d26c512-ecd2-4dd6-a36a-529489da356c';
const STREET_TEMPLATE_ID = '8e4171d4-e94f-41ee-a41b-b64babe8d9f6';
const SUBURB_TEMPLATE_ID = '5e0feb04-54fb-4196-81b2-9a54637b13e6';

const USER_AGENT = 'BinMate/1.0 (Perth bin reminder app; contact@binmate.app)';
const REQUEST_TIMEOUT_MS = 10_000;
const INFO_PANEL_WIDTH = 250;

const MOSMAN_PARK_SUBURBS = new Set(['mosman park']);

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

interface ComboItem { key: string; value?: string; }
interface ComboResponse { items?: ComboItem[]; }
interface InfoField { name: string; caption: string; value?: { value?: string } | string; }
interface SearchResponse { infoPanels?: { info1?: { feature?: { fields?: InfoField[] } } } }
interface AddressParts { unit: string; houseNumber: string; streetQuery: string; }

const JSON_HEADERS = { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT };

async function mosmanFetch(url: string, options: RequestInit): Promise<Response> {
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
  return text.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseAddress(address: string): AddressParts | null {
  let cleaned = address
    .replace(/,/g, ' ')
    .replace(/\bwestern australia\b/gi, ' ')
    .replace(/\bwa\b/gi, ' ')
    .replace(/\b6012\b/g, ' ')
    .replace(/\bmosman park\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  cleaned = cleaned.replace(/^(unit|apt|apartment|suite|u)\s+/i, '');

  const unitMatch = cleaned.match(/^(\d+[a-z]?)\/(\d+[a-z]?)\s+(.+)$/i);
  if (unitMatch) {
    return {
      unit: unitMatch[1],
      houseNumber: unitMatch[2],
      streetQuery: unitMatch[3].trim(),
    };
  }

  const houseMatch = cleaned.match(/^(\d+[a-z]?)\s+(.+)$/i);
  if (!houseMatch) return null;

  return {
    unit: '',
    houseNumber: houseMatch[1],
    streetQuery: houseMatch[2].trim(),
  };
}

function pickComboKey(items: ComboItem[], query: string): string | null {
  const normalisedQuery = normalise(query);
  if (!normalisedQuery) return null;

  const exact = items.find((item) => normalise(item.key) === normalisedQuery);
  if (exact) return exact.key;

  const fuzzy = items.filter((item) => {
    const key = normalise(item.key);
    return key.startsWith(normalisedQuery) || normalisedQuery.startsWith(key);
  });

  return fuzzy.length === 1 ? fuzzy[0].key : null;
}

function fieldValue(field: InfoField): string {
  if (typeof field.value === 'string') return field.value;
  return field.value?.value ?? '';
}

function parseDay(dayValue: string): string | null {
  const normalisedDay = normalise(dayValue);
  return DAY_TO_ABBREV[normalisedDay] ? normalisedDay : null;
}

function parseRecyclingWeek(value: string): 'A' | 'B' | null {
  const match = value.match(/week\s*(1|2)/i);
  return match ? (match[1] === '1' ? 'A' : 'B') : null;
}

function oppositeWeek(week: 'A' | 'B'): 'A' | 'B' {
  return week === 'A' ? 'B' : 'A';
}

async function createSession(): Promise<string> {
  const params = new URLSearchParams({
    configId: CONFIG_ID,
    appType: APP_TYPE,
    project: PROJECT,
    datasetCode: '',
  });
  const res = await mosmanFetch(`${T1_BASE}/Projects/?${params}`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: '{}',
  });
  if (!res.ok) throw new Error(`Mosman Park Projects HTTP ${res.status}`);
  const session = res.headers.get('x-intramaps-session');
  if (!session) throw new Error('Mosman Park Projects: missing x-intramaps-session header');
  return session;
}

async function activateModule(session: string): Promise<void> {
  const res = await mosmanFetch(`${T1_BASE}/Modules/?IntraMapsSession=${session}`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ module: MODULE_ID, includeBasemaps: false }),
  });
  if (!res.ok) throw new Error(`Mosman Park Modules HTTP ${res.status}`);
}

async function fetchComboContents(templateId: string, session: string): Promise<ComboItem[]> {
  const res = await mosmanFetch(`${T1_BASE}/Search/ComboContents?IntraMapsSession=${session}`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ templateId }),
  });
  if (!res.ok) throw new Error(`Mosman Park ComboContents HTTP ${res.status}`);
  const data = await res.json() as ComboResponse;
  return Array.isArray(data.items) ? data.items : [];
}

async function searchProperty(fields: string[], session: string): Promise<InfoField[]> {
  const params = new URLSearchParams({
    infoPanelWidth: String(INFO_PANEL_WIDTH),
    mode: 'Refresh',
    form: FORM_ID,
    resubmit: 'false',
    selectionLayersFilter: '',
    IntraMapsSession: session,
  });
  const res = await mosmanFetch(`${T1_BASE}/Search/?${params}`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`Mosman Park Search HTTP ${res.status}`);
  const data = await res.json() as SearchResponse;
  return data.infoPanels?.info1?.feature?.fields ?? [];
}

class MosmanParkScraper implements CouncilScraper {
  readonly councilSlug = 'mosmanpark';
  readonly councilName = 'Town of Mosman Park';

  /** Resolve a Mosman Park address via the public T1Cloud address form. */
  async resolveAddress(address: string): Promise<ZoneResolution> {
    try {
      const parts = parseAddress(address);
      if (!parts) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Could not parse house number and street' };
      }

      const session = await createSession();
      await activateModule(session);

      const [streetItems, suburbItems] = await Promise.all([
        fetchComboContents(STREET_TEMPLATE_ID, session),
        fetchComboContents(SUBURB_TEMPLATE_ID, session),
      ]);

      const streetKey = pickComboKey(streetItems, parts.streetQuery);
      const suburbKey = pickComboKey(suburbItems, 'Mosman Park');
      if (!streetKey || !suburbKey) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address not found in Mosman Park service area' };
      }

      const fields = await searchProperty([parts.unit, parts.houseNumber, streetKey, suburbKey], session);
      if (!fields.length) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address not found in Mosman Park service area' };
      }

      const getField = (caption: string) =>
        fieldValue(fields.find((item) => item.caption === caption || item.name === caption) ?? { name: '', caption: '' });

      const binDay = parseDay(getField('Bin Day'));
      const recyclingWeek = parseRecyclingWeek(getField('Recycling Day'));
      if (!binDay || !recyclingWeek) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Incomplete waste schedule data returned' };
      }

      const dayAbbrev = DAY_TO_ABBREV[binDay];
      const dayLabel = binDay.charAt(0).toUpperCase() + binDay.slice(1);
      const zoneCode = `MOS-${dayAbbrev}-${recyclingWeek}`;
      const zoneName = `Town of Mosman Park — ${dayLabel} (recycling Week ${recyclingWeek})`;
      return { zoneCode, zoneName, councilSlug: this.councilSlug };
    } catch (err) {
      logger.error('Mosman Park resolveAddress error', { err });
      return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address resolution failed' };
    }
  }

  /** Return the static weekly FOGO + alternating recycling/general schedule. */
  async fetchSchedule(zoneCode: string): Promise<ZoneScheduleData> {
    const match = zoneCode.match(/^MOS-(MON|TUE|WED|THU|FRI)-(A|B)$/);
    if (!match) throw new Error(`Unknown Mosman Park zone code: ${zoneCode}`);

    const day = ABBREV_TO_DAY[match[1]];
    const recyclingWeek = match[2] as 'A' | 'B';
    const rubbishWeek = oppositeWeek(recyclingWeek);
    const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);

    return {
      zoneCode,
      zoneName: `Town of Mosman Park — ${dayLabel} (recycling Week ${recyclingWeek})`,
      generalDay: day,
      generalFrequency: 'weekly',  // FOGO every week
      recyclingDay: day,
      recyclingWeek,               // yellow week
      greenWasteDay: day,
      greenWasteWeek: rubbishWeek, // red lid general waste on opposite week
      vergeDates: null,
    };
  }

  /** Check the live public address form using a known Mosman Park property. */
  async healthCheck(): Promise<boolean> {
    const result = await this.resolveAddress('39 Jameson Street MOSMAN PARK WA 6012');
    return !result.error && result.zoneCode === 'MOS-FRI-A';
  }
}

export const mosmanParkScraper = new MosmanParkScraper();

/** Return true when a suburb may belong to the Town of Mosman Park. */
export function mosmanParkCanHandle(suburb: string): boolean {
  return MOSMAN_PARK_SUBURBS.has(suburb.trim().toLowerCase());
}
