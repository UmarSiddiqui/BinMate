/**
 * Town of Claremont — ward polygon bin-day scraper.
 *
 * Live data source (verified 2026-03-17):
 *   https://www.claremont.wa.gov.au/assets/dist/796.2182434058107d55e5c6.js
 *
 * The bundle embeds GeoJSON layer "Claremont_BinDay_AllAreas" with ward polygons
 * and a "BinDay" field (Monday-Friday).
 *
 * Week parity source (verified 2026-03-17):
 *   https://www.claremont.wa.gov.au/media/ieleld3i/25-26-waste-calendar.pdf
 *
 * The published 2025-26 calendar alternates Yellow (recycling) and Green
 * (garden organics) weeks town-wide. Week starting Monday 2026-01-05 is Green,
 * so BinMate Week A = green week and recycling runs on Week B.
 *
 * Zone code convention: CLR-{DAY_ABBREV}-B
 */

import { geocodeAddress } from '../services/geocoding';
import type { CouncilScraper, ZoneResolution, ZoneScheduleData } from './base/types';
import { logger } from '../utils/logger';

const COUNCIL_SLUG = 'claremont';
const COUNCIL_NAME = 'Town of Claremont';
const USER_AGENT = 'BinMate/1.0 (Perth bin reminder app; contact@binmate.app)';
const REQUEST_TIMEOUT_MS = 10_000;

const WARD_BUNDLE_URL = 'https://www.claremont.wa.gov.au/assets/dist/796.2182434058107d55e5c6.js';

const CLAREMONT_SUBURBS = new Set([
  'claremont',
  'swanbourne',
  'mount claremont',
  'mt claremont',
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

interface GeoJsonFeatureCollection {
  features?: WardFeature[];
}

interface WardFeature {
  properties: {
    Name?: string;
    BinDay?: string;
  };
  geometry: {
    type: 'MultiPolygon';
    coordinates: number[][][][];
  };
}

interface WardBinArea {
  wardName: string;
  day: string;
  multipolygon: number[][][][];
}

let wardAreasCache: WardBinArea[] | null = null;

async function claremontFetch(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT },
    });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

function parseEmbeddedGeoJson(bundleCode: string): GeoJsonFeatureCollection {
  const match = bundleCode.match(/JSON\.parse\('([\s\S]+)'\)/);
  if (!match) throw new Error('Claremont ward GeoJSON payload not found');

  const jsonText = match[1]
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');

  return JSON.parse(jsonText) as GeoJsonFeatureCollection;
}

async function loadWardAreas(): Promise<WardBinArea[]> {
  if (wardAreasCache) return wardAreasCache;

  const res = await claremontFetch(WARD_BUNDLE_URL);
  if (!res.ok) throw new Error(`Claremont ward bundle HTTP ${res.status}`);

  const bundleCode = await res.text();
  const geojson = parseEmbeddedGeoJson(bundleCode);

  const areas = (geojson.features ?? [])
    .filter((feature) => feature.geometry?.type === 'MultiPolygon')
    .map((feature) => {
      const day = (feature.properties.BinDay ?? '').trim().toLowerCase();
      const wardName = (feature.properties.Name ?? 'Unknown ward').trim();
      return {
        wardName,
        day,
        multipolygon: feature.geometry.coordinates,
      };
    })
    .filter((area) => area.day in DAY_TO_ABBREV);

  if (!areas.length) throw new Error('No valid Claremont ward areas found');

  wardAreasCache = areas;
  return wardAreasCache;
}

function isPointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];

    const intersects = (yi > lat) !== (yj > lat)
      && lng < ((xj - xi) * (lat - yi)) / ((yj - yi) || Number.EPSILON) + xi;

    if (intersects) inside = !inside;
  }

  return inside;
}

function isPointInMultiPolygon(lng: number, lat: number, multipolygon: number[][][][]): boolean {
  return multipolygon.some((polygon) => {
    if (!polygon.length) return false;

    const [outerRing, ...holes] = polygon;
    if (!isPointInRing(lng, lat, outerRing)) return false;

    const insideHole = holes.some((hole) => isPointInRing(lng, lat, hole));
    return !insideHole;
  });
}

function oppositeWeek(week: 'A' | 'B'): 'A' | 'B' {
  return week === 'A' ? 'B' : 'A';
}

class ClaremontScraper implements CouncilScraper {
  readonly councilSlug = COUNCIL_SLUG;
  readonly councilName = COUNCIL_NAME;

  /** Resolve a Claremont address to ward polygon and collection-day zone. */
  async resolveAddress(address: string): Promise<ZoneResolution> {
    try {
      const geo = await geocodeAddress(address);
      if (!geo) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Could not geocode address' };
      }

      const areas = await loadWardAreas();
      const area = areas.find((candidate) => isPointInMultiPolygon(geo.lng, geo.lat, candidate.multipolygon));
      if (!area) {
        return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address not in Claremont service area' };
      }

      const dayAbbrev = DAY_TO_ABBREV[area.day];
      const recyclingWeek: 'A' | 'B' = 'B';
      const zoneCode = `CLR-${dayAbbrev}-${recyclingWeek}`;
      const dayLabel = area.day.charAt(0).toUpperCase() + area.day.slice(1);

      return {
        zoneCode,
        zoneName: `${this.councilName} — ${dayLabel} (${area.wardName}, recycling Week ${recyclingWeek})`,
        councilSlug: this.councilSlug,
      };
    } catch (err) {
      logger.error('Claremont resolveAddress error', { err });
      return { zoneCode: '', zoneName: '', councilSlug: this.councilSlug, error: 'Address resolution failed' };
    }
  }

  /** Return static alternating schedule for a Claremont zone code. */
  async fetchSchedule(zoneCode: string): Promise<ZoneScheduleData> {
    const match = zoneCode.match(/^CLR-(MON|TUE|WED|THU|FRI)-(A|B)$/);
    if (!match) throw new Error(`Unknown Claremont zone code: ${zoneCode}`);

    const day = ABBREV_TO_DAY[match[1]];
    const recyclingWeek = match[2] as 'A' | 'B';
    const greenWeek = oppositeWeek(recyclingWeek);
    const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);

    return {
      zoneCode,
      zoneName: `${this.councilName} — ${dayLabel} (recycling Week ${recyclingWeek})`,
      generalDay: day,
      generalFrequency: 'weekly',
      recyclingDay: day,
      recyclingWeek,
      greenWasteDay: day,
      greenWasteWeek: greenWeek,
      vergeDates: null,
    };
  }

  /** Verify a known Claremont civic address resolves to a Claremont zone. */
  async healthCheck(): Promise<boolean> {
    const result = await this.resolveAddress('308 Stirling Highway CLAREMONT WA 6010');
    return !result.error && /^CLR-(MON|TUE|WED|THU|FRI)-B$/.test(result.zoneCode);
  }
}

export const claremontScraper = new ClaremontScraper();

/** Return true when a suburb may be serviced by the Town of Claremont. */
export function claremontCanHandle(suburb: string): boolean {
  return CLAREMONT_SUBURBS.has(suburb.trim().toLowerCase());
}
