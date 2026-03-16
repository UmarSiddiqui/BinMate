/**
 * City of Stirling — bin collection scraper.
 *
 * Data source: Custom OpenCities CMS widget on www.stirling.wa.gov.au
 * API endpoint: GET https://www.stirling.wa.gov.au/bincollectioncheck/getresult
 *
 * Stirling operates a 3-bin kerbside system:
 *   - General waste (red lid):        collected WEEKLY
 *   - Recycling (yellow lid):         collected FORTNIGHTLY — Week A or Week B
 *   - Garden organics (lime green):   collected FORTNIGHTLY — opposite week to recycling
 *
 * API call flow (single GET request — no session required):
 *   1. Geocode address via Nominatim → lat, lng
 *   2. GET /bincollectioncheck/getresult with five custom HTTP headers:
 *        configid     — widget config UUID (from data-configid on page element)
 *        form         — form UUID (from data-formid on page element)
 *        fields       — "{longitude},{latitude}"  (NOTE: longitude FIRST)
 *        apikeylookup — "Bin Day"
 *        Referer      — must be set to the council page URL (server validates this)
 *   3. Response: JSON array of arrays — one inner array per bin type
 *        [[{name:"type",value:"Red"},{name:"day",value:"Tuesday"},{name:"date",value:"Mar 17 2026 "}], ...]
 *   4. Determine recycling Week A/B from the Yellow bin's next collection date
 *
 * Zone code convention: STI-{DAY_ABBREV}-{RECYCLING_WEEK}  e.g. "STI-TUE-A"
 *
 * Coordinate precision note:
 *   The Stirling API uses point-in-polygon against property parcel polygons.
 *   Nominatim resolves most residential addresses precisely, but coordinates that
 *   land on a road centreline (osm_type=way) may return empty data from the API.
 *   The scraper returns an informative error in that case.
 *
 * Confirmed zones (2026-03-16):
 *   Scarborough area  (115.7595, -31.8938) → Tuesday,   recycling Week A → STI-TUE-A
 *   Doubleview area   (115.7743, -31.8910) → Monday,    recycling Week B → STI-MON-B
 *   Innaloo area      (115.7990, -31.8940) → Monday,    recycling Week B → STI-MON-B
 *   Osborne Park area (115.8317, -31.8869) → Wednesday, recycling Week B → STI-WED-B
 *   Dianella area     (115.8663, -31.8703) → Friday,    recycling Week A → STI-FRI-A
 *   City Beach area   (115.7554, -31.9026) → Tuesday,   recycling Week A → STI-TUE-A
 *   Floreat area      (115.7911, -31.9181) → Tuesday,   recycling Week B → STI-TUE-B
 *   Balcatta area     (115.8200, -31.8680) → Wednesday, recycling Week B → STI-WED-B
 *   Nollamara area    (115.8490, -31.8850) → Wednesday, recycling Week B → STI-WED-B
 *   Trigg area        (115.7541, -31.8710) → Monday,    recycling Week A → STI-MON-A
 *   Joondanna area    (115.8432, -31.9046) → Wednesday, recycling Week A → STI-WED-A
 *   Tuart Hill area   (115.8519, -31.9059) → Thursday,  recycling Week B → STI-THU-B
 *   Carine area       (115.8100, -31.8499) → Friday,    recycling Week B → STI-FRI-B
 *
 * IDs sourced from www.stirling.wa.gov.au HTML data attributes (2026-03-16).
 */

import type { CouncilScraper, ZoneResolution, ZoneScheduleData } from './base/types';
import { geocodeAddress } from '../services/geocoding';
import { logger } from '../utils/logger';

// ─── Constants ────────────────────────────────────────────────────────────────

const API_URL   = 'https://www.stirling.wa.gov.au/bincollectioncheck/getresult';
const REFERER   = 'https://www.stirling.wa.gov.au/waste-and-environment/waste-and-recycling/bin-collections';
const CONFIG_ID = '7c833520-7b62-4228-8522-fb1a220b32e8';
const FORM_ID   = '57753bab-f589-44d7-8934-098b6d5c572f';

const USER_AGENT       = 'BinMate/1.0 (Perth bin reminder app; contact@binmate.app)';
const REQUEST_TIMEOUT  = 10_000;

/** Perth Week-A reference Monday (UTC midnight) — must match zoneScheduleComputer.ts */
const WEEK_A_REFERENCE_MS = new Date('2026-01-05T00:00:00.000Z').getTime();
const MS_PER_WEEK = 7 * 86_400_000;

// ─── Suburb set ───────────────────────────────────────────────────────────────

/** City of Stirling LGA suburbs (lowercase). Source: ABS + stirling.wa.gov.au (2026). */
const STIRLING_SUBURBS = new Set([
  'balcatta', 'balga', 'carine', 'churchlands', 'city beach', 'coolbinia',
  'dianella', 'doubleview', 'floreat', 'glendalough', 'gwelup', 'hamersley',
  'innaloo', 'joondanna', 'karrinyup', 'mirrabooka', 'mount lawley',
  'nollamara', 'osborne park', 'scarborough', 'stirling', 'trigg',
  'tuart hill', 'wembley', 'wembley downs', 'westminster', 'woodlands',
]);

// ─── Day maps ─────────────────────────────────────────────────────────────────

const DAY_TO_ABBREV: Record<string, string> = {
  monday: 'MON', tuesday: 'TUE', wednesday: 'WED', thursday: 'THU', friday: 'FRI',
};

const ABBREV_TO_DAY: Record<string, string> = {
  MON: 'monday', TUE: 'tuesday', WED: 'wednesday', THU: 'thursday', FRI: 'friday',
};

// ─── API response types ───────────────────────────────────────────────────────

interface BinItem { name: string; value: string; }
type BinEntry = BinItem[];
type StirlingApiResponse = BinEntry[];

interface ParsedBin { type: string; day: string; date: string; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Shared fetch wrapper with abort-on-timeout. */
async function stirlingFetch(lat: number, lng: number): Promise<StirlingApiResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    // NOTE: longitude first in the fields header — this is how the widget sends it
    const res = await fetch(API_URL, {
      method: 'GET',
      headers: {
        configid:     CONFIG_ID,
        form:         FORM_ID,
        fields:       `${lng},${lat}`,
        apikeylookup: 'Bin Day',
        Referer:      REFERER,
        'User-Agent': USER_AGENT,
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`Stirling API HTTP ${res.status}`);
    return await res.json() as StirlingApiResponse;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/** Parse the API's array-of-arrays response into a flat object per bin type. */
function parseApiResponse(data: StirlingApiResponse): ParsedBin[] {
  return data.map((entry) => ({
    type: entry.find((x) => x.name === 'type')?.value ?? '',
    day:  entry.find((x) => x.name === 'day')?.value ?? '',
    date: entry.find((x) => x.name === 'date')?.value.trim() ?? '',
  }));
}

/**
 * Determine Week A or B from the Yellow bin's next collection date.
 * The API returns dates in "Mar 17 2026" format (MMM DD YYYY).
 * Strategy: find Monday of that week, count weeks from WEEK_A_REFERENCE.
 * Even = A, Odd = B.
 */
function parseDateToWeek(dateStr: string): 'A' | 'B' | null {
  const trimmed = dateStr.trim();
  if (!trimmed || trimmed === '-') return null;

  const MONTHS: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };

  // Format: "Mar 17 2026" — month abbreviation first
  const match = trimmed.match(/^(\w{3})\s+(\d{1,2})\s+(\d{4})/i);
  if (!match) return null;

  const month = MONTHS[match[1].toLowerCase()];
  const day   = parseInt(match[2], 10);
  const year  = parseInt(match[3], 10);
  if (month === undefined) return null;

  // Find Monday of the week containing this date
  const dateMs = Date.UTC(year, month, day);
  const dow    = new Date(dateMs).getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysToMonday = dow === 0 ? -6 : 1 - dow;
  const mondayMs     = dateMs + daysToMonday * 86_400_000;

  const weeksFromRef = Math.round((mondayMs - WEEK_A_REFERENCE_MS) / MS_PER_WEEK);
  return weeksFromRef % 2 === 0 ? 'A' : 'B';
}

// ─── Coordinate-level resolution (exported for testing) ──────────────────────

/**
 * Resolve a lat/lng coordinate pair to a Stirling collection zone.
 * This is the core lookup — used by both resolveAddress and healthCheck.
 * Exported so tests can bypass Nominatim with known-good coordinates.
 */
export async function stirlingResolveCoordinates(
  lat: number, lng: number,
): Promise<ZoneResolution> {
  const empty: ZoneResolution = { zoneCode: '', zoneName: '', councilSlug: 'stirling' };

  const data = await stirlingFetch(lat, lng);
  const bins = parseApiResponse(data);

  const red    = bins.find((b) => b.type === 'Red');
  const yellow = bins.find((b) => b.type === 'Yellow');

  if (!red?.day || red.day === '' || !yellow || yellow.date === '-') {
    return { ...empty, error: 'Address not found in Stirling collection database. Ensure the address is a residential property within the City of Stirling.' };
  }

  const dayName   = red.day.toLowerCase();
  const dayAbbrev = DAY_TO_ABBREV[dayName];
  if (!dayAbbrev) {
    return { ...empty, error: `Unexpected collection day from API: ${red.day}` };
  }

  const recyclingWeek = parseDateToWeek(yellow.date);
  if (!recyclingWeek) {
    return { ...empty, error: `Could not determine recycling week from date: ${yellow.date}` };
  }

  const zoneCode = `STI-${dayAbbrev}-${recyclingWeek}`;
  const dayLabel = dayName.charAt(0).toUpperCase() + dayName.slice(1);
  const zoneName = `City of Stirling — ${dayLabel} (recycling Week ${recyclingWeek})`;

  return { zoneCode, zoneName, councilSlug: 'stirling' };
}

// ─── Scraper ──────────────────────────────────────────────────────────────────

class StirlingScaper implements CouncilScraper {
  readonly councilSlug = 'stirling';
  readonly councilName = 'City of Stirling';

  /**
   * Resolve a street address to a Stirling collection zone.
   * Geocodes via Nominatim, then calls the OpenCities coordinate API.
   *
   * Precision note: the API uses point-in-polygon. Nominatim returns road-level
   * coordinates for some addresses (particularly major roads). If the coordinate
   * misses all property polygons, the API returns empty and this method returns
   * an error. House numbers on residential streets resolve reliably.
   */
  async resolveAddress(address: string): Promise<ZoneResolution> {
    try {
      const geo = await geocodeAddress(address);
      if (!geo) {
        return {
          zoneCode: '', zoneName: '', councilSlug: this.councilSlug,
          error: 'Could not geocode address',
        };
      }
      return stirlingResolveCoordinates(geo.lat, geo.lng);
    } catch (err) {
      logger.error('Stirling resolveAddress error', { err });
      return {
        zoneCode: '', zoneName: '', councilSlug: this.councilSlug,
        error: 'Address resolution failed',
      };
    }
  }

  /** Return the static schedule for a zone code like "STI-TUE-A". */
  async fetchSchedule(zoneCode: string): Promise<ZoneScheduleData> {
    const match = zoneCode.match(/^STI-(MON|TUE|WED|THU|FRI)-(A|B)$/);
    if (!match) throw new Error(`Unknown Stirling zone code: ${zoneCode}`);

    const dayAbbrev      = match[1];
    const recyclingWeek  = match[2] as 'A' | 'B';
    const day            = ABBREV_TO_DAY[dayAbbrev];
    const greenWasteWeek = recyclingWeek === 'A' ? 'B' : 'A';
    const dayLabel       = day.charAt(0).toUpperCase() + day.slice(1);

    return {
      zoneCode,
      zoneName:         `City of Stirling — ${dayLabel} (recycling Week ${recyclingWeek})`,
      generalDay:       day,
      generalFrequency: 'weekly',
      recyclingDay:     day,
      recyclingWeek,
      greenWasteDay:    day,          // garden organics on same weekday, opposite week
      greenWasteWeek,
      vergeDates:       null,         // per-property verge dates — not stored at zone level
    };
  }

  /**
   * Health check — resolves known-good coordinates in Joondanna.
   * Uses coordinate-level lookup to avoid Nominatim precision risk in health checks.
   * Expected result: STI-WED-A (confirmed 2026-03-16).
   */
  async healthCheck(): Promise<boolean> {
    const result = await stirlingResolveCoordinates(-31.9046, 115.8432);
    const ok = !result.error && result.zoneCode.startsWith('STI-WED');
    if (!ok) logger.warn('Stirling health check failed', { result });
    return ok;
  }
}

/** Singleton export — import this in routes and the scraper runner. */
export const stirlingScraper = new StirlingScaper();

/** Return true if a (lowercase-trimmed) suburb falls within the Stirling LGA. */
export function stirlingCanHandle(suburb: string): boolean {
  return STIRLING_SUBURBS.has(suburb.toLowerCase().trim());
}
