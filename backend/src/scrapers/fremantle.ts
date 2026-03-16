/**
 * City of Fremantle — bin collection scraper.
 *
 * Data source: ArcGIS FeatureServer (public, no auth required)
 * Service:     Domestic_waste_collection_areas / Layer 60
 * Base URL:    https://services3.arcgis.com/gxYehwfGQwBQvQkx/arcgis/rest/services
 *              /Domestic_waste_collection_areas/FeatureServer/60
 *
 * Fremantle operates a three-bin FOGO system:
 *   - FOGO (dark green lid):      collected WEEKLY
 *   - General waste (red lid):    collected FORTNIGHTLY — "Red week"
 *   - Recycling (yellow lid):     collected FORTNIGHTLY — "Yellow week"
 *
 * In our zone schema we model it as:
 *   generalDay/Frequency = weekly  (FOGO is always collected → bin always goes out)
 *   recyclingDay/Week    = day / 'B' (verified: Yellow/Recycling falls on Week B weeks)
 *   greenWasteDay/Week   = null    (no separate green waste kerbside — drop-off only)
 *
 * Recycling week mapping verified from 2025-26 Waste Guide holiday table:
 *   - Christmas Day (Thu 25 Dec 2025) = "FOGO and Waste" (Red/General)
 *   - Dec week = Week A per WEEK_A_REFERENCE (2026-01-05)
 *   → Week A = Red (General Waste); Week B = Yellow (Recycling) for ALL zones.
 *   - Good Friday (Fri 3 Apr 2026) = "FOGO and Waste" confirms Friday is also Week A = Red.
 *   → All Fremantle zones: recyclingWeek = 'B'.
 *
 * Zone coding convention: FRE-{WasteID} e.g. "FRE-4", "FRE-1"
 *
 * ArcGIS layer fields:
 *   WasteID      integer  — zone identifier
 *   CollectionDay string   — "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday"
 *
 * Known zones (all zones, sourced from the FeatureServer on 2026-03-16):
 *   FRE-1 Monday     (North Fremantle area)
 *   FRE-2 Monday     (Fremantle / High St area)
 *   FRE-4 Tuesday
 *   FRE-5 Thursday
 *   FRE-6 Wednesday
 *   FRE-7 Friday
 */

import { geocodeAddress } from '../services/geocoding';
import type { CouncilScraper, ZoneResolution, ZoneScheduleData } from './base/types';
import { logger } from '../utils/logger';

// ─── Constants ────────────────────────────────────────────────────────────────

const FEATURE_SERVER =
  'https://services3.arcgis.com/gxYehwfGQwBQvQkx/arcgis/rest/services' +
  '/Domestic_waste_collection_areas/FeatureServer/60';

const USER_AGENT = 'BinMate/1.0 (Perth bin reminder app; contact@binmate.app)';
const REQUEST_TIMEOUT_MS = 10_000;

// ─── Suburb set ───────────────────────────────────────────────────────────────

/**
 * City of Fremantle LGA suburbs (lowercase).
 * Source: City of Fremantle official suburb list.
 */
const FREMANTLE_SUBURBS = new Set([
  'fremantle',
  'north fremantle',
  'south fremantle',
  'beaconsfield',
  'hilton',
  'samson',
  'o\'connor',
  'white gum valley',
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** ArcGIS REST query for a single lat/lng point, returns WasteID + CollectionDay. */
async function queryZoneAtPoint(lat: number, lng: number): Promise<ArcGISRecord | null> {
  const params = new URLSearchParams({
    f: 'json',
    geometry: JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } }),
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'WasteID,CollectionDay',
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
      logger.warn('Fremantle ArcGIS query failed', { status: res.status });
      return null;
    }

    const data = (await res.json()) as ArcGISResponse;
    return data.features?.[0]?.attributes ?? null;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// ─── ArcGIS response types ────────────────────────────────────────────────────

interface ArcGISRecord {
  WasteID: number;
  CollectionDay: string;
}

interface ArcGISResponse {
  features?: Array<{ attributes: ArcGISRecord }>;
  error?: { message: string };
}

// ─── Scraper ──────────────────────────────────────────────────────────────────

class FremantleScraper implements CouncilScraper {
  readonly councilSlug = 'fremantle';
  readonly councilName = 'City of Fremantle';

  /**
   * Resolve a street address to a Fremantle collection zone.
   * Geocodes via Nominatim, then queries the ArcGIS FeatureServer with the
   * resulting lat/lng to find the intersecting waste collection zone polygon.
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

      const record = await queryZoneAtPoint(geo.lat, geo.lng);
      if (!record) {
        return {
          zoneCode: '',
          zoneName: '',
          councilSlug: this.councilSlug,
          error: 'Address not found in Fremantle waste collection zones',
        };
      }

      const zoneCode = `FRE-${record.WasteID}`;
      const zoneName = `City of Fremantle — ${record.CollectionDay} (Zone ${record.WasteID})`;

      return { zoneCode, zoneName, councilSlug: this.councilSlug };
    } catch (err) {
      logger.error('Fremantle resolveAddress error', { err });
      return {
        zoneCode: '',
        zoneName: '',
        councilSlug: this.councilSlug,
        error: 'Address resolution failed',
      };
    }
  }

  /** Return the static schedule for a zone code such as "FRE-4". */
  async fetchSchedule(zoneCode: string): Promise<ZoneScheduleData> {
    const match = zoneCode.match(/^FRE-(\d+)$/);
    if (!match) {
      throw new Error(`Unknown Fremantle zone code: ${zoneCode}`);
    }

    const wasteId = parseInt(match[1], 10);
    const day = WASTEID_DAY[wasteId];
    if (!day) {
      throw new Error(`Unknown Fremantle WasteID: ${wasteId}`);
    }

    return {
      zoneCode,
      zoneName: `City of Fremantle — ${day.charAt(0).toUpperCase() + day.slice(1)} (Zone ${wasteId})`,
      generalDay: day,
      generalFrequency: 'weekly',  // FOGO collected every week
      recyclingDay: day,
      recyclingWeek: 'B',          // Yellow week = Week B (verified from 2025-26 guide)
      greenWasteDay: null,         // No kerbside green waste — FOGO replaces it
      greenWasteWeek: null,
      vergeDates: null,
    };
  }

  /** Health check — resolve a known Fremantle address. */
  async healthCheck(): Promise<boolean> {
    // 15 South Tce, Fremantle WA 6160 — expected FRE-4 (Tuesday)
    const result = await this.resolveAddress('15 South Tce, Fremantle WA 6160');
    const ok = result.zoneCode === 'FRE-4' && !result.error;
    if (!ok) {
      logger.warn('Fremantle health check failed', { result });
    }
    return ok;
  }
}

/** WasteID → lowercase day name. Sourced from FeatureServer on 2026-03-16. */
const WASTEID_DAY: Record<number, string> = {
  1: 'monday',
  2: 'monday',
  4: 'tuesday',
  5: 'thursday',
  6: 'wednesday',
  7: 'friday',
};

/** Singleton export — import this in routes and the scraper runner. */
export const fremantleScraper = new FremantleScraper();

/** Return true if a (lowercase-trimmed) suburb falls within the Fremantle LGA. */
export function fremantleCanHandle(suburb: string): boolean {
  return FREMANTLE_SUBURBS.has(suburb.toLowerCase().trim());
}
