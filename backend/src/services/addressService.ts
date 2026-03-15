import { geocodeAddress } from './geocoding';
import { findCachedAddress, cacheAddress } from '../repositories/addressRepository';
import { findZonesByCouncil } from '../repositories/zoneRepository';
import prisma from '../utils/prisma';
import { logger } from '../utils/logger';
import type { CollectionZone, Council } from '@prisma/client';

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

// ─── Council matching ─────────────────────────────────────────────────────────

/**
 * Find the active council whose service area contains the given lat/lng.
 * Currently uses suburb name matching against council slugs (pre-scraper phase).
 * Replace with PostGIS spatial query once boundary polygons are loaded.
 */
async function matchCouncil(
  suburb: string,
  _lat: number,
  _lng: number
): Promise<Council | null> {
  // Simple suburb → council lookup using known Perth suburbs in council names
  // TODO Phase 2: replace with PostGIS ST_Within(point, boundary) query
  const councils = await prisma.council.findMany({ where: { isActive: true } });
  if (!councils.length) return null;

  const suburbLower = suburb.toLowerCase();

  // Direct slug match (e.g. suburb "Wanneroo" → council slug "wanneroo")
  const direct = councils.find((c) => c.slug === suburbLower);
  if (direct) return direct;

  // Partial match — suburb name appears in council name
  const partial = councils.find((c) =>
    c.name.toLowerCase().includes(suburbLower) ||
    suburbLower.includes(c.slug)
  );
  return partial ?? null;
}

// ─── Zone matching ────────────────────────────────────────────────────────────

/**
 * Find the best zone for a lat/lng within a council.
 * Currently returns the first zone (single-zone councils) or null.
 * TODO Phase 2: use scraper resolveAddress() for multi-zone councils.
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
 * Checks cache first; geocodes and matches council/zone on cache miss.
 */
export async function resolveAddress(
  address: string
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

  // 2. Geocode
  const geo = await geocodeAddress(address);
  if (!geo) {
    return { error: 'geocoding_failed', message: 'Could not geocode that address' };
  }
  if (!isInPerth(geo.lat, geo.lng)) {
    return { error: 'address_not_found', message: 'Address is outside the Perth metro area' };
  }

  // 3. Match council
  const council = await matchCouncil(geo.suburb, geo.lat, geo.lng);
  if (!council) {
    logger.warn('No council matched for suburb', { suburb: geo.suburb });
    return {
      error: 'council_not_supported',
      message: `${geo.suburb} is not yet supported. More councils coming soon.`,
    };
  }

  // 4. Match zone
  const zone = await matchZone(council.id, geo.lat, geo.lng);
  if (!zone) {
    return {
      error: 'council_not_supported',
      message: `${council.name} schedule data is not yet available.`,
    };
  }

  // 5. Cache and return
  await cacheAddress({
    addressString: address,
    lat: geo.lat,
    lng: geo.lng,
    councilId: council.id,
    zoneId: zone.id,
  });

  logger.info('Address resolved and cached', { councilName: council.name, zoneId: zone.id });

  return {
    zoneId: zone.id,
    councilName: council.name,
    suburb: geo.suburb,
    lat: geo.lat,
    lng: geo.lng,
  };
}
