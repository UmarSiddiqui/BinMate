/**
 * City of Wanneroo — bin collection scraper.
 *
 * Data source: Static suburb → zone mapping derived from the annual PDF calendar.
 * PDF URL: https://www.wanneroo.wa.gov.au/downloads/file/5709/kerbside_collection_calendar_-_2025.pdf
 * iCal:    https://www.wanneroo.wa.gov.au/info/20172/
 *
 * Collection pattern:
 *   - General waste:  weekly
 *   - Recycling:      fortnightly (Week A or B per zone)
 *   - Green waste:    fortnightly (opposite week to recycling)
 *
 * Zone coding convention: {DAY_CODE}-{WEEK} e.g. "MON-A", "TUE-B"
 *
 * TODO (Phase 2): add iCal download + parse to auto-detect week A/B offset each year.
 */

import { geocodeAddress } from '../services/geocoding';
import type { CouncilScraper, ZoneResolution, ZoneScheduleData } from './base/types';
import { logger } from '../utils/logger';

// ─── Zone definitions ─────────────────────────────────────────────────────────

/** Each entry: [generalDay, recyclingWeek] — greenWaste is opposite week. */
const ZONE_DEFS: Record<string, { day: string; recyclingWeek: 'A' | 'B' }> = {
  'MON-A': { day: 'monday',    recyclingWeek: 'A' },
  'TUE-A': { day: 'tuesday',   recyclingWeek: 'A' },
  'TUE-B': { day: 'tuesday',   recyclingWeek: 'B' },
  'WED-A': { day: 'wednesday', recyclingWeek: 'A' },
  'WED-B': { day: 'wednesday', recyclingWeek: 'B' },
  'THU-A': { day: 'thursday',  recyclingWeek: 'A' },
  'THU-B': { day: 'thursday',  recyclingWeek: 'B' },
  'FRI-A': { day: 'friday',    recyclingWeek: 'A' },
  'FRI-B': { day: 'friday',    recyclingWeek: 'B' },
};

// ─── Suburb → zone code lookup ────────────────────────────────────────────────
//
// Source: City of Wanneroo kerbside calendar 2025/2026 + wanneroo.wa.gov.au/bincollections
// Group 1 suburbs collect on Monday (both general and recycling/green).
// Group 2 suburbs collect on their designated day.
//
// Recycling weeks verified from 2026 calendar (Jan start reference 2026-01-05 = Week A).
// TODO: Auto-refresh from iCal feed each January.

const SUBURB_ZONE: Record<string, string> = {
  // ── Monday (Group 1) ─────────────────────────────────────────────────────
  'alexander heights': 'MON-A',
  'carabooda':         'MON-A',
  'girrawheen':        'MON-A',
  'koondoola':         'MON-A',
  'marangaroo':        'MON-A',
  'neerabup':          'MON-A',
  'nowergup':          'MON-A',
  'pinjar':            'MON-A',
  'two rocks':         'MON-A',

  // ── Tuesday ──────────────────────────────────────────────────────────────
  'butler':            'TUE-B',
  'jindalee':          'TUE-B',
  'merriwa':           'TUE-B',
  'quinns rocks':      'TUE-B',
  'ridgewood':         'TUE-B',

  // ── Wednesday ────────────────────────────────────────────────────────────
  'alkimos':           'WED-A',
  'clarkson':          'WED-A',
  'eglinton':          'WED-A',
  'mindarie':          'WED-A',
  'yanchep':           'WED-A',

  // ── Thursday ─────────────────────────────────────────────────────────────
  'darch':             'THU-B',
  'gnangara':          'THU-B',
  'hocking':           'THU-B',
  'jandabup':          'THU-B',
  'landsdale':         'THU-B',
  'madeley':           'THU-B',
  'mariginiup':        'THU-B',
  'pearsall':          'THU-B',
  'wangara':           'THU-B',
  'woodvale':          'THU-B',

  // ── Friday ───────────────────────────────────────────────────────────────
  'ashby':             'FRI-A',
  'banksia grove':     'FRI-A',
  'carramar':          'FRI-A',
  'sinagra':           'FRI-A',
  'tapping':           'FRI-A',
  'wanneroo':          'FRI-A',
};

// ─── Scraper ──────────────────────────────────────────────────────────────────

class WannerooScraper implements CouncilScraper {
  readonly councilSlug = 'wanneroo';
  readonly councilName = 'City of Wanneroo';

  /**
   * Resolve a Perth address to a Wanneroo collection zone.
   * Uses Nominatim to geocode and extract the suburb, then does a static lookup.
   */
  async resolveAddress(address: string): Promise<ZoneResolution> {
    try {
      const geo = await geocodeAddress(address);
      if (!geo) {
        return {
          zoneCode: '',
          zoneName: '',
          councilSlug: this.councilSlug,
          error: 'Could not geocode address',
        };
      }

      const suburb = geo.suburb.toLowerCase().trim();
      const zoneCode = SUBURB_ZONE[suburb];

      if (!zoneCode) {
        logger.warn('Wanneroo: suburb not in zone map', { suburb });
        return {
          zoneCode: '',
          zoneName: '',
          councilSlug: this.councilSlug,
          error: `Suburb "${geo.suburb}" is not in the City of Wanneroo service area`,
        };
      }

      const def = ZONE_DEFS[zoneCode];
      return {
        zoneCode,
        zoneName: `Wanneroo ${def.day.charAt(0).toUpperCase() + def.day.slice(1)} ${def.recyclingWeek}`,
        councilSlug: this.councilSlug,
      };
    } catch (err) {
      logger.error('Wanneroo resolveAddress error', { err });
      return {
        zoneCode: '',
        zoneName: '',
        councilSlug: this.councilSlug,
        error: 'Address resolution failed',
      };
    }
  }

  /** Return the schedule data for a zone code. */
  async fetchSchedule(zoneCode: string): Promise<ZoneScheduleData> {
    const def = ZONE_DEFS[zoneCode];
    if (!def) {
      throw new Error(`Unknown zone code: ${zoneCode}`);
    }

    const greenWasteWeek: 'A' | 'B' = def.recyclingWeek === 'A' ? 'B' : 'A';

    return {
      zoneCode,
      zoneName: `City of Wanneroo — ${def.day.charAt(0).toUpperCase() + def.day.slice(1)} ${def.recyclingWeek}`,
      generalDay: def.day,
      generalFrequency: 'weekly',
      recyclingDay: def.day,
      recyclingWeek: def.recyclingWeek,
      greenWasteDay: def.day,
      greenWasteWeek,
      vergeDates: null,
    };
  }

  /** Health check — attempt to resolve a known Wanneroo suburb. */
  async healthCheck(): Promise<boolean> {
    // Clarkson WA 6030 — always resolvable via Nominatim, expected zone WED-A
    const result = await this.resolveAddress('Clarkson WA 6030');
    const ok = result.zoneCode === 'WED-A' && !result.error;
    if (!ok) {
      logger.warn('Wanneroo health check failed', { result });
    }
    return ok;
  }
}

/** Singleton export — import this in routes and the scraper runner. */
export const wannerooScraper = new WannerooScraper();
