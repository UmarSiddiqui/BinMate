/**
 * Town of Cottesloe — bin collection scraper.
 *
 * Data sources (verified 2026-03-17):
 * - Waste calendar PDF (bin-day zone map + red/yellow week legend):
 *   https://www.cottesloe.wa.gov.au/profiles/cottesloe/assets/clientdata/25-26_waste_calendar_-_cot_-_web_version_updated2.pdf
 * - Official address dataset endpoint (lat/lng source, no bin-day fields):
 *   https://www.cottesloe.wa.gov.au/api/nearme/getaddresses
 *
 * The published map shows five bin-day zones:
 *   Monday, Tuesday, Wednesday, Thursday, Friday.
 *
 * Calendar parity:
 * - Yellow week = Recycling + FOGO
 * - Red week    = General waste + FOGO
 * - Week beginning Monday 2026-01-05 is yellow in the official calendar,
 *   therefore BinMate Week A = recycling week for Cottesloe.
 *
 * NOTE: The council's public APIs expose address points but not parcel->zone joins.
 * This implementation uses the official map's named street breaks (Grant, Eric,
 * Napier) plus the coastal strip to determine weekday zones from coordinates.
 */

import { geocodeAddress } from '../services/geocoding';
import type { CouncilScraper, ZoneResolution, ZoneScheduleData } from './base/types';
import { logger } from '../utils/logger';

const COUNCIL_SLUG = 'cottesloe';
const COUNCIL_NAME = 'Town of Cottesloe';

const COTTESLOE_SUBURBS = new Set([
  'cottesloe',
  'swanbourne',
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

/** Approximate longitude of the coastal Monday strip from calendar map. */
const COASTAL_STRIP_MAX_LNG = 115.7608;

/** North/south street break latitudes from calendar map labels. */
const GRANT_ST_LAT = -31.9868;
const ERIC_ST_LAT = -31.9899;
const NAPIER_ST_LAT = -31.9927;

/** Rough Cottesloe map extent guard to avoid false positives outside council bounds. */
const COUNCIL_MIN_LAT = -32.0210;
const COUNCIL_MAX_LAT = -31.9815;
const COUNCIL_MIN_LNG = 115.7508;
const COUNCIL_MAX_LNG = 115.7720;

function inCouncilBounds(lat: number, lng: number): boolean {
  return lat >= COUNCIL_MIN_LAT
    && lat <= COUNCIL_MAX_LAT
    && lng >= COUNCIL_MIN_LNG
    && lng <= COUNCIL_MAX_LNG;
}

function resolveCollectionDay(lat: number, lng: number): string {
  if (lng <= COASTAL_STRIP_MAX_LNG) return 'monday';
  if (lat >= GRANT_ST_LAT) return 'tuesday';
  if (lat >= ERIC_ST_LAT) return 'thursday';
  if (lat >= NAPIER_ST_LAT) return 'friday';
  return 'wednesday';
}

function oppositeWeek(week: 'A' | 'B'): 'A' | 'B' {
  return week === 'A' ? 'B' : 'A';
}

class CottesloeScraper implements CouncilScraper {
  readonly councilSlug = COUNCIL_SLUG;
  readonly councilName = COUNCIL_NAME;

  /** Resolve an address into Cottesloe's weekday zone from official map boundaries. */
  async resolveAddress(address: string): Promise<ZoneResolution> {
    try {
      const geo = await geocodeAddress(address);
      if (!geo) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Could not geocode address' };
      }

      if (!cottesloeCanHandle(geo.suburb)) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address not in Cottesloe service area' };
      }

      if (!inCouncilBounds(geo.lat, geo.lng)) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address not in Cottesloe service area' };
      }

      const day = resolveCollectionDay(geo.lat, geo.lng);
      const dayAbbrev = DAY_TO_ABBREV[day];
      const recyclingWeek: 'A' | 'B' = 'A';
      const zoneCode = `COT-${dayAbbrev}-${recyclingWeek}`;
      const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);

      return {
        zoneCode,
        zoneName: `${this.councilName} — ${dayLabel} (recycling Week ${recyclingWeek})`,
        councilSlug: this.councilSlug,
      };
    } catch (err) {
      logger.error('Cottesloe resolveAddress error', { err });
      return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address resolution failed' };
    }
  }

  /** Return weekly FOGO + alternating recycling/general schedule for zone code. */
  async fetchSchedule(zoneCode: string): Promise<ZoneScheduleData> {
    const match = zoneCode.match(/^COT-(MON|TUE|WED|THU|FRI)-(A|B)$/);
    if (!match) throw new Error(`Unknown Cottesloe zone code: ${zoneCode}`);

    const day = ABBREV_TO_DAY[match[1]];
    const recyclingWeek = match[2] as 'A' | 'B';
    const redBinWeek = oppositeWeek(recyclingWeek);
    const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);

    return {
      zoneCode,
      zoneName: `${this.councilName} — ${dayLabel} (recycling Week ${recyclingWeek})`,
      generalDay: day,
      generalFrequency: 'weekly',
      recyclingDay: day,
      recyclingWeek,
      greenWasteDay: day,
      greenWasteWeek: redBinWeek,
      vergeDates: null,
    };
  }

  /** Verify a known civic address resolves to one of Cottesloe's weekday zones. */
  async healthCheck(): Promise<boolean> {
    const result = await this.resolveAddress('109 Broome Street COTTESLOE WA 6011');
    return !result.error && /^COT-(MON|TUE|WED|THU|FRI)-A$/.test(result.zoneCode);
  }
}

export const cottesloeScraper = new CottesloeScraper();

/** Return true when a suburb may be serviced by the Town of Cottesloe. */
export function cottesloeCanHandle(suburb: string): boolean {
  return COTTESLOE_SUBURBS.has(suburb.trim().toLowerCase());
}
