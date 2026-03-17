/**
 * Town of Bassendean — bin collection scraper.
 *
 * Data sources (verified 2026-03-17):
 * - Public app: https://bassendean.maps.arcgis.com/apps/instant/lookup/index.html?appid=95c3e8687b9f42b9b4b7757dd43efac3
 * - Web map: d92758b0b96c43ada9e25eade1ed758b
 * - Feature layer:
 *   https://services-ap1.arcgis.com/551UnqKK1GZeDKxQ/arcgis/rest/services/address_lookup_for_bin_days_dissolved/FeatureServer/0
 *
 * ArcGIS popup expressions define:
 * - Red lid (general) fortnightly from base dates in Week A.
 * - Yellow lid (recycling) fortnightly from base dates in Week B.
 * - FOGO weekly on ServiceDay.
 *
 * In current BinMate schema this is represented as:
 * - generalDay/frequency: weekly
 * - recyclingWeek: B
 * - greenWasteWeek: A
 *
 * Zone code convention: BAS-{DAY}-B (e.g. BAS-TUE-B, BAS-THU-B)
 */

import { geocodeAddress } from '../services/geocoding';
import type { CouncilScraper, ZoneResolution, ZoneScheduleData } from './base/types';
import { logger } from '../utils/logger';

const COUNCIL_SLUG = 'bassendean';
const COUNCIL_NAME = 'Town of Bassendean';

const FEATURE_SERVER =
  'https://services-ap1.arcgis.com/551UnqKK1GZeDKxQ/arcgis/rest/services' +
  '/address_lookup_for_bin_days_dissolved/FeatureServer/0';

const USER_AGENT = 'BinMate/1.0 (Perth bin reminder app; contact@binmate.app)';
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Keep this set strict to avoid overlap with neighbouring council scrapers.
 * `ashfield` is included because Bassendean's own ArcGIS map resolves it.
 */
const BASSENDEAN_SUBURBS = new Set([
  'bassendean',
  'ashfield',
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

interface ArcGISRecord {
  ServiceDay: string;
  SL_Addy?: string;
}

interface ArcGISResponse {
  features?: Array<{ attributes: ArcGISRecord }>;
}

/** Query Bassendean ArcGIS layer for the polygon intersecting a lat/lng point. */
async function queryZoneAtPoint(lat: number, lng: number): Promise<ArcGISRecord | null> {
  const params = new URLSearchParams({
    f: 'json',
    geometry: JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } }),
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'ServiceDay,SL_Addy',
    returnGeometry: 'false',
  });

  const url = `${FEATURE_SERVER}/query?${params.toString()}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      logger.warn('Bassendean ArcGIS query failed', { status: res.status });
      return null;
    }

    const data = (await res.json()) as ArcGISResponse;
    return data.features?.[0]?.attributes ?? null;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

class BassendeanScraper implements CouncilScraper {
  readonly councilSlug = COUNCIL_SLUG;
  readonly councilName = COUNCIL_NAME;

  /** Resolve a street address to Bassendean's service day zone via ArcGIS polygon lookup. */
  async resolveAddress(address: string): Promise<ZoneResolution> {
    try {
      const geo = await geocodeAddress(address);
      if (!geo) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Could not geocode address' };
      }

      if (!bassendeanCanHandle(geo.suburb)) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address not in Bassendean service area' };
      }

      const record = await queryZoneAtPoint(geo.lat, geo.lng);
      if (!record?.ServiceDay) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address not found in Bassendean waste zones' };
      }

      const day = record.ServiceDay.toLowerCase().trim();
      const dayAbbrev = DAY_TO_ABBREV[day];
      if (!dayAbbrev) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Unsupported Bassendean service day' };
      }

      const recyclingWeek: 'A' | 'B' = 'B';
      const zoneCode = `BAS-${dayAbbrev}-${recyclingWeek}`;
      const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);

      return {
        zoneCode,
        zoneName: `${this.councilName} — ${dayLabel} (recycling Week ${recyclingWeek})`,
        councilSlug: this.councilSlug,
      };
    } catch (err) {
      logger.error('Bassendean resolveAddress error', { err });
      return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address resolution failed' };
    }
  }

  /** Return the static schedule shape for zone code BAS-{DAY}-B. */
  async fetchSchedule(zoneCode: string): Promise<ZoneScheduleData> {
    const match = zoneCode.match(/^BAS-(MON|TUE|WED|THU|FRI)-(A|B)$/);
    if (!match) throw new Error(`Unknown Bassendean zone code: ${zoneCode}`);

    const day = ABBREV_TO_DAY[match[1]];
    const recyclingWeek = match[2] as 'A' | 'B';
    const generalWeek: 'A' | 'B' = recyclingWeek === 'A' ? 'B' : 'A';
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

  /** Health check using a known Bassendean address from the live ArcGIS dataset. */
  async healthCheck(): Promise<boolean> {
    const result = await this.resolveAddress('4 Railway Parade BASSENDEAN WA 6054');
    return !result.error && /^BAS-(MON|TUE|WED|THU|FRI)-B$/.test(result.zoneCode);
  }
}

export const bassendeanScraper = new BassendeanScraper();

/** Return true when a suburb may be serviced by the Town of Bassendean. */
export function bassendeanCanHandle(suburb: string): boolean {
  return BASSENDEAN_SUBURBS.has(suburb.trim().toLowerCase());
}
