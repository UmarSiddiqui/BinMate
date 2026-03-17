/**
 * Town of East Fremantle — bin collection scraper.
 *
 * Data source (verified 2026-03-17):
 * - Official Waste Guide PDF (contains "Bin Collection Map" with Monday-Friday zones):
 *   https://www.eastfremantle.wa.gov.au/Profiles/eastfremantle/Assets/ClientData/Document-Centre/Waste_/Waste_Guide_2025-26_.pdf
 *
 * Notes:
 * - Public web pages do not currently expose a parcel-level address -> zone endpoint.
 * - This scraper uses map-based coordinate heuristics derived from the official map.
 * - Default service model represented here is three-bin FOGO:
 *   FOGO weekly, general/recycling fortnightly alternating by week.
 */

import { geocodeAddress } from '../services/geocoding';
import type { CouncilScraper, ZoneResolution, ZoneScheduleData } from './base/types';
import { logger } from '../utils/logger';

const COUNCIL_SLUG = 'eastfremantle';
const COUNCIL_NAME = 'Town of East Fremantle';

const EAST_FREMANTLE_SUBURBS = new Set([
  'east fremantle',
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

/** Rough East Fremantle extent guard to avoid false positives outside council bounds. */
const COUNCIL_MIN_LAT = -32.0700;
const COUNCIL_MAX_LAT = -32.0150;
const COUNCIL_MIN_LNG = 115.7400;
const COUNCIL_MAX_LNG = 115.7920;

/** Heuristic split lines derived from map street breaks and weekday labels. */
const NORTH_SPLIT_LAT = -32.0355;
const EAST_SPLIT_LNG = 115.7688;
const FAR_EAST_SPLIT_LNG = 115.7735;
const WEST_SPLIT_LNG = 115.7605;

function inCouncilBounds(lat: number, lng: number): boolean {
  return lat >= COUNCIL_MIN_LAT
    && lat <= COUNCIL_MAX_LAT
    && lng >= COUNCIL_MIN_LNG
    && lng <= COUNCIL_MAX_LNG;
}

function resolveCollectionDay(lat: number, lng: number): string {
  if (lat >= NORTH_SPLIT_LAT) {
    return lng >= EAST_SPLIT_LNG ? 'tuesday' : 'monday';
  }
  if (lng >= FAR_EAST_SPLIT_LNG) return 'thursday';
  if (lng <= WEST_SPLIT_LNG) return 'friday';
  return 'wednesday';
}

function oppositeWeek(week: 'A' | 'B'): 'A' | 'B' {
  return week === 'A' ? 'B' : 'A';
}

class EastFremantleScraper implements CouncilScraper {
  readonly councilSlug = COUNCIL_SLUG;
  readonly councilName = COUNCIL_NAME;

  /** Resolve an address into East Fremantle weekday zone from map-derived boundaries. */
  async resolveAddress(address: string): Promise<ZoneResolution> {
    try {
      const geo = await geocodeAddress(address);
      if (!geo) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Could not geocode address' };
      }

      if (!eastFremantleCanHandle(geo.suburb)) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address not in East Fremantle service area' };
      }

      if (!inCouncilBounds(geo.lat, geo.lng)) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address not in East Fremantle service area' };
      }

      const day = resolveCollectionDay(geo.lat, geo.lng);
      const dayAbbrev = DAY_TO_ABBREV[day];
      const recyclingWeek: 'A' | 'B' = 'A';
      const zoneCode = `EFR-${dayAbbrev}-${recyclingWeek}`;
      const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);

      return {
        zoneCode,
        zoneName: `${this.councilName} — ${dayLabel} (recycling Week ${recyclingWeek})`,
        councilSlug: this.councilSlug,
      };
    } catch (err) {
      logger.error('East Fremantle resolveAddress error', { err });
      return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address resolution failed' };
    }
  }

  /** Return weekly FOGO + alternating recycling/general schedule for zone code. */
  async fetchSchedule(zoneCode: string): Promise<ZoneScheduleData> {
    const match = zoneCode.match(/^EFR-(MON|TUE|WED|THU|FRI)-(A|B)$/);
    if (!match) throw new Error(`Unknown East Fremantle zone code: ${zoneCode}`);

    const day = ABBREV_TO_DAY[match[1]];
    const recyclingWeek = match[2] as 'A' | 'B';
    const generalWeek = oppositeWeek(recyclingWeek);
    const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);

    return {
      zoneCode,
      zoneName: `${this.councilName} — ${dayLabel} (recycling Week ${recyclingWeek})`,
      generalDay: day,
      generalFrequency: 'weekly',
      recyclingDay: day,
      recyclingWeek,
      greenWasteDay: day,
      greenWasteWeek: generalWeek,
      vergeDates: null,
    };
  }

  /** Verify a known East Fremantle civic address resolves to a weekday zone. */
  async healthCheck(): Promise<boolean> {
    const result = await this.resolveAddress('135 Canning Highway EAST FREMANTLE WA 6158');
    return !result.error && /^EFR-(MON|TUE|WED|THU|FRI)-A$/.test(result.zoneCode);
  }
}

export const eastFremantleScraper = new EastFremantleScraper();

/** Return true when a suburb may be serviced by the Town of East Fremantle. */
export function eastFremantleCanHandle(suburb: string): boolean {
  return EAST_FREMANTLE_SUBURBS.has(suburb.trim().toLowerCase());
}
