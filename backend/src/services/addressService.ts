import { geocodeAddress, reverseGeocode } from './geocoding';
import { findCachedAddress, cacheAddress } from '../repositories/addressRepository';
import { findZonesByCouncil, findZoneByCode } from '../repositories/zoneRepository';
import prisma from '../utils/prisma';
import { logger } from '../utils/logger';
import type { CollectionZone, Council } from '@prisma/client';
import { SCRAPER_REGISTRY } from '../scrapers/registry';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AddressResolution {
  zoneId: string;
  councilName: string;
  suburb: string;
  lat: number;
  lng: number;
}

export interface AddressError {
  error: 'address_not_found' | 'council_not_supported' | 'geocoding_failed';
  message: string;
}

// ─── Address normalisation ────────────────────────────────────────────────────

/**
 * Strip an Australian unit/apartment prefix before passing an address to a
 * geocoder. Geocoders handle building-level addresses far more reliably than
 * unit-level ones, and coordinates are the same for all units in a building.
 *
 * Examples:
 *   "14S/125 Herdsman Pde, Wembley WA" → "125 Herdsman Pde, Wembley WA"
 *   "Unit 5/42 Smith St, Perth WA"     → "42 Smith St, Perth WA"
 */
function stripUnitPrefix(address: string): string {
  return address
    .replace(/^\w+\//, '')                                                   // "14S/125..." → "125..."
    .replace(/^(unit|apt|apartment|flat|lot|shop|suite|level)\s+\w+[,/\s]+/i, '') // "Unit 5, ..."
    .trim();
}

// ─── Perth LGA bounding box (rough, for fast pre-filter) ─────────────────────

const PERTH_BOUNDS = { latMin: -32.8, latMax: -31.4, lngMin: 115.6, lngMax: 116.3 };

function isInPerth(lat: number, lng: number): boolean {
  return (
    lat >= PERTH_BOUNDS.latMin &&
    lat <= PERTH_BOUNDS.latMax &&
    lng >= PERTH_BOUNDS.lngMin &&
    lng <= PERTH_BOUNDS.lngMax
  );
}

// ─── Generic council matching (fallback for councils without scrapers) ────────

/**
 * Find the active council whose service area contains the given suburb.
 * Uses name-based matching — suitable only for single-zone or same-name councils.
 * Replace with PostGIS ST_Within(point, boundary) in Phase 2.
 */
async function matchCouncil(
  suburb: string,
  _lat: number,
  _lng: number
): Promise<Council | null> {
  const councils = await prisma.council.findMany({ where: { isActive: true } });
  if (!councils.length) return null;

  const suburbLower = suburb.toLowerCase();

  // Direct slug match (e.g. suburb "Wanneroo" → council slug "wanneroo")
  const direct = councils.find((c) => c.slug === suburbLower);
  if (direct) return direct;

  // Partial match — suburb name appears in council name or vice-versa
  const partial = councils.find(
    (c) =>
      c.name.toLowerCase().includes(suburbLower) ||
      suburbLower.includes(c.slug)
  );
  return partial ?? null;
}

/**
 * Generic zone match — returns the first zone for a council.
 * Only used for councils that have no registered scraper yet.
 */
async function matchZone(
  councilId: string,
  _lat: number,
  _lng: number
): Promise<CollectionZone | null> {
  const zones = await findZonesByCouncil(councilId);
  return zones[0] ?? null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

/**
 * Resolve a Perth street address to a collection zone.
 *
 * Resolution order:
 *   1. Address cache (avoids geocoding on repeat lookups)
 *   2. Geocode via Nominatim → suburb + lat/lng
 *   3. Scraper registry — canHandle(suburb) narrows to the right scraper; the
 *      scraper does the definitive zone-level lookup (zone code → DB zone)
 *   4. Generic council name match — fallback for councils without a scraper yet
 */
export async function resolveAddress(
  address: string,
  /** MapKit-resolved coordinates. When provided, Nominatim geocoding is skipped entirely,
   *  which prevents road-centroid imprecision for councils using point-in-polygon lookups. */
  clientCoordinate?: { lat: number; lng: number }
): Promise<AddressResolution | AddressError> {
  // 1. Cache hit
  const cached = await findCachedAddress(address);
  if (cached) {
    const zone = await prisma.collectionZone.findUnique({
      where: { id: cached.zoneId },
      include: { council: true },
    });
    if (zone) {
      logger.info('Address resolved from cache', { zoneId: zone.id });
      return {
        zoneId: zone.id,
        councilName: zone.council.name,
        suburb: address.split(',')[0].trim(),
        lat: cached.lat,
        lng: cached.lng,
      };
    }
  }

  // 2. Geocode — use client-supplied MapKit coordinates when available to avoid
  //    Nominatim road-centroid imprecision (critical for Stirling point-in-polygon).
  let geo: { lat: number; lng: number; suburb: string } | null = null;
  if (clientCoordinate) {
    if (!isInPerth(clientCoordinate.lat, clientCoordinate.lng)) {
      return { error: 'address_not_found', message: 'Address is outside the Perth metro area' };
    }
    const rev = await reverseGeocode(clientCoordinate.lat, clientCoordinate.lng);
    // Fallback suburb comes from the address string ("125 Herdsman Pde, Wembley WA 6014"
    // → "Wembley"). Strip state/postcode so the registry's exact-match canHandle works.
    const fallbackSuburb = address.split(',')[1]?.trim().replace(/\s+WA(\s+\d{4})?\s*$/i, '') ?? '';
    geo = {
      lat: clientCoordinate.lat,
      lng: clientCoordinate.lng,
      suburb: rev?.suburb ?? fallbackSuburb,
    };
  } else {
    const nominatim = await geocodeAddress(stripUnitPrefix(address));
    if (!nominatim) {
      return { error: 'geocoding_failed', message: 'Could not geocode that address' };
    }
    if (!isInPerth(nominatim.lat, nominatim.lng)) {
      return { error: 'address_not_found', message: 'Address is outside the Perth metro area' };
    }
    geo = nominatim;
  }

  // 3. Scraper-based resolution — check each registered scraper
  const suburbLower = geo.suburb.toLowerCase().trim();
  for (const [councilSlug, entry] of Object.entries(SCRAPER_REGISTRY)) {
    if (!entry.canHandle(suburbLower)) continue;

    // Scraper claims this suburb — call it for the definitive zone code.
    // Always forward coordinates (MapKit or Nominatim-geocoded) so scrapers never
    // re-geocode with the raw address, which may still contain a unit prefix.
    const resolution = await entry.scraper.resolveAddress(address, clientCoordinate ?? { lat: geo.lat, lng: geo.lng });
    if (resolution.error || !resolution.zoneCode) {
      logger.warn('Scraper canHandle=true but resolveAddress failed', {
        councilSlug,
        suburb: geo.suburb,
        error: resolution.error,
      });
      continue;
    }

    const council = await prisma.council.findUnique({ where: { slug: councilSlug } });
    if (!council) {
      logger.warn('Scraper matched but council not in DB', { councilSlug });
      continue;
    }

    const zone = await findZoneByCode(council.id, resolution.zoneCode);
    if (!zone) {
      logger.warn('Scraper resolved zone code not seeded in DB', {
        councilSlug,
        zoneCode: resolution.zoneCode,
      });
      continue;
    }

    await cacheAddress({
      addressString: address,
      lat: geo.lat,
      lng: geo.lng,
      councilId: council.id,
      zoneId: zone.id,
    });

    logger.info('Address resolved via scraper', {
      councilName: council.name,
      zoneCode: resolution.zoneCode,
    });
    return {
      zoneId: zone.id,
      councilName: council.name,
      suburb: geo.suburb,
      lat: geo.lat,
      lng: geo.lng,
    };
  }

  // 4. Fallback: generic council name match (for councils without a scraper yet)
  const council = await matchCouncil(geo.suburb, geo.lat, geo.lng);
  if (!council) {
    logger.warn('No council matched for suburb', { suburb: geo.suburb });
    return {
      error: 'council_not_supported',
      message: `${geo.suburb} is not yet supported. More councils coming soon.`,
    };
  }

  const zone = await matchZone(council.id, geo.lat, geo.lng);
  if (!zone) {
    return {
      error: 'council_not_supported',
      message: `${council.name} schedule data is not yet available.`,
    };
  }

  await cacheAddress({
    addressString: address,
    lat: geo.lat,
    lng: geo.lng,
    councilId: council.id,
    zoneId: zone.id,
  });

  logger.info('Address resolved via generic match', {
    councilName: council.name,
    zoneId: zone.id,
  });
  return {
    zoneId: zone.id,
    councilName: council.name,
    suburb: geo.suburb,
    lat: geo.lat,
    lng: geo.lng,
  };
}
