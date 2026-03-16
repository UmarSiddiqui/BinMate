/**
 * City of Armadale — bin collection scraper.
 *
 * Data source: Live REST API at api.my.armadale.wa.gov.au
 * Endpoint:    GET https://api.my.armadale.wa.gov.au/bins?address={address}
 *
 * Collection pattern:
 *   - General waste:  weekly
 *   - Recycling:      fortnightly (Area 1 or Area 2)
 *   - Green waste:    not returned by this API; set to null (TODO: verify)
 *
 * Zone coding convention: {DAY_ABBREV}-{AREA} e.g. "WED-1", "THU-2"
 *
 * Area → recyclingWeek mapping (verified 2026-03-16, which is Week A per
 * WEEK_A_REFERENCE 2026-01-05; Area 1 was "This Week" → Area 1 = Week A):
 *   Area 1 → recyclingWeek 'A'
 *   Area 2 → recyclingWeek 'B'
 *
 * API response shape (array, usually one element):
 *   address:        "23 Sexty Street, ARMADALE"
 *   bin_day:        "Wednesday"
 *   recycle_area:   "This Week (Area 1)" | "Next Week (Area 2)" | ...
 *   vergeside_zone: "9"  (numeric string — not used for kerbside schedule)
 */

import type { CouncilScraper, ZoneResolution, ZoneScheduleData } from './base/types';
import { logger } from '../utils/logger';

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.my.armadale.wa.gov.au';
const USER_AGENT = 'BinMate/1.0 (Perth bin reminder app; contact@binmate.app)';
const REQUEST_TIMEOUT_MS = 10_000;

// ─── Suburb set ───────────────────────────────────────────────────────────────

/**
 * City of Armadale LGA suburbs (lowercase).
 * Used for O(1) canHandle check before calling the live API.
 * Source: City of Armadale official suburb list.
 */
const ARMADALE_SUBURBS = new Set([
  'armadale',
  'bedfordale',
  'brookdale',
  'byford',
  'camillo',
  'champion lakes',
  'forrestdale',
  'harrisdale',
  'haynes',
  'hilbert',
  'karragullen',
  'kelmscott',
  'lesley',
  'martin',
  'mount nasura',
  'mount richon',
  'oakford',
  'piara waters',
  'roleystone',
  'seville grove',
  'wungong',
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Day name (Title Case) → 3-letter abbreviation. */
const DAY_ABBREV: Record<string, string> = {
  monday: 'MON',
  tuesday: 'TUE',
  wednesday: 'WED',
  thursday: 'THU',
  friday: 'FRI',
};

/** 3-letter abbreviation → lowercase day name. */
const ABBREV_DAY: Record<string, string> = {
  MON: 'monday',
  TUE: 'tuesday',
  WED: 'wednesday',
  THU: 'thursday',
  FRI: 'friday',
};

/**
 * Parse the area number out of recycle_area strings like:
 *   "This Week (Area 1)"  →  1
 *   "Next Week (Area 2)"  →  2
 */
function parseArea(recycleArea: string): 1 | 2 | null {
  const match = recycleArea.match(/Area\s+(\d)/i);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  return n === 1 || n === 2 ? n : null;
}

// ─── API response type ────────────────────────────────────────────────────────

interface ArmadaleBinsRecord {
  address: string;
  bin_day: string;
  recycle_area: string;
  vergeside_zone: string;
}

// ─── Scraper ──────────────────────────────────────────────────────────────────

class ArmadaleScraper implements CouncilScraper {
  readonly councilSlug = 'armadale';
  readonly councilName = 'City of Armadale';

  /**
   * Resolve a street address to a collection zone via the Armadale bins API.
   * Does not call Nominatim — the Armadale API handles address lookup directly.
   *
   * The API is an autocomplete endpoint that works with partial street queries
   * (e.g. "23 Sexty St"). Passing a fully-qualified address with suburb/postcode
   * returns empty results, so we extract just the street portion (before the
   * first comma) and send that.
   */
  async resolveAddress(address: string): Promise<ZoneResolution> {
    try {
      // Extract "23 Sexty St" from "23 Sexty St, Armadale WA 6112"
      const streetQuery = address.split(',')[0].trim();
      const url = `${API_BASE}/bins?address=${encodeURI(streetQuery)}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      let records: ArmadaleBinsRecord[];
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': USER_AGENT },
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (!res.ok) {
          return {
            zoneCode: '',
            zoneName: '',
            councilSlug: this.councilSlug,
            error: `Armadale API returned HTTP ${res.status}`,
          };
        }

        records = (await res.json()) as ArmadaleBinsRecord[];
      } catch (fetchErr) {
        clearTimeout(timer);
        throw fetchErr;
      }

      if (!records.length) {
        return {
          zoneCode: '',
          zoneName: '',
          councilSlug: this.councilSlug,
          error: 'Address not found in Armadale service area',
        };
      }

      const record = records[0];
      const dayLower = record.bin_day.toLowerCase();
      const dayAbbrev = DAY_ABBREV[dayLower];

      if (!dayAbbrev) {
        logger.warn('Armadale: unexpected bin_day value', { bin_day: record.bin_day });
        return {
          zoneCode: '',
          zoneName: '',
          councilSlug: this.councilSlug,
          error: `Unexpected bin_day: "${record.bin_day}"`,
        };
      }

      const area = parseArea(record.recycle_area);
      if (!area) {
        logger.warn('Armadale: could not parse recycle_area', { recycle_area: record.recycle_area });
        return {
          zoneCode: '',
          zoneName: '',
          councilSlug: this.councilSlug,
          error: `Could not parse recycle_area: "${record.recycle_area}"`,
        };
      }

      const zoneCode = `${dayAbbrev}-${area}`;
      const zoneName = `City of Armadale — ${record.bin_day} Area ${area}`;

      return { zoneCode, zoneName, councilSlug: this.councilSlug };
    } catch (err) {
      logger.error('Armadale resolveAddress error', { err });
      return {
        zoneCode: '',
        zoneName: '',
        councilSlug: this.councilSlug,
        error: 'Address resolution failed',
      };
    }
  }

  /** Return the static schedule data for a zone code such as "WED-1". */
  async fetchSchedule(zoneCode: string): Promise<ZoneScheduleData> {
    const match = zoneCode.match(/^([A-Z]{3})-([12])$/);
    if (!match) {
      throw new Error(`Unknown Armadale zone code: ${zoneCode}`);
    }

    const dayAbbrev = match[1];
    const area = parseInt(match[2], 10) as 1 | 2;
    const day = ABBREV_DAY[dayAbbrev];

    if (!day) {
      throw new Error(`Unknown day abbreviation in zone code: ${zoneCode}`);
    }

    // Area 1 → Week A, Area 2 → Week B (verified 2026-03-16)
    const recyclingWeek: 'A' | 'B' = area === 1 ? 'A' : 'B';

    return {
      zoneCode,
      zoneName: `City of Armadale — ${day.charAt(0).toUpperCase() + day.slice(1)} Area ${area}`,
      generalDay: day,
      generalFrequency: 'weekly',
      recyclingDay: day,
      recyclingWeek,
      greenWasteDay: null,   // TODO: verify if Armadale has kerbside green waste
      greenWasteWeek: null,
      vergeDates: null,
    };
  }

  /** Health check — resolve a known Armadale address. */
  async healthCheck(): Promise<boolean> {
    // 23 Sexty St, Armadale WA 6112 — expected zone WED-1
    const result = await this.resolveAddress('23 Sexty St, Armadale WA 6112');
    const ok = result.zoneCode === 'WED-1' && !result.error;
    if (!ok) {
      logger.warn('Armadale health check failed', { result });
    }
    return ok;
  }
}

/** Singleton export — import this in routes and the scraper runner. */
export const armadaleScraper = new ArmadaleScraper();

/** Return true if a (lowercase-trimmed) suburb falls within the Armadale LGA. */
export function armadaleCanHandle(suburb: string): boolean {
  return ARMADALE_SUBURBS.has(suburb.toLowerCase().trim());
}
