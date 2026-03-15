import { logger } from '../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GeocodeResult {
  lat: number;
  lng: number;
  suburb: string;
  state: string;
  postcode: string;
  displayName: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

/** Nominatim (OpenStreetMap) — free geocoding, no API key required. Rate limit: 1 req/sec. */
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const CONTACT_EMAIL = process.env.GEOCODING_CONTACT_EMAIL ?? 'contact@binmate.app';
const USER_AGENT = `BinMate/1.0 (Perth bin reminder app; ${CONTACT_EMAIL})`;

// Rate limiting: ensure max 1 request per second to Nominatim
let lastRequestTime = 0;
const MIN_INTERVAL_MS = 1100; // 1.1s to safely stay under 1 req/sec

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL_MS - elapsed));
  }
  lastRequestTime = Date.now();
  return fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept-Language': 'en',
    },
  });
}

// ─── Geocode ──────────────────────────────────────────────────────────────────

/**
 * Geocode a Perth address using Nominatim (OpenStreetMap).
 * Free — no API key required. Max 1 request/second.
 * Returns null if no result found.
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const params = new URLSearchParams({
    q: `${address}, Western Australia, Australia`,
    format: 'json',
    addressdetails: '1',
    countrycodes: 'au',
    limit: '1',
  });

  try {
    const response = await rateLimitedFetch(`${NOMINATIM_BASE}/search?${params}`);

    if (!response.ok) {
      throw new Error(`Nominatim HTTP ${response.status}`);
    }

    const results = await response.json() as NominatimResult[];
    if (!results.length) return null;

    const r = results[0];
    return {
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      suburb: r.address?.suburb ?? r.address?.town ?? r.address?.city_district ?? '',
      state: r.address?.state ?? '',
      postcode: r.address?.postcode ?? '',
      displayName: r.display_name,
    };
  } catch (err) {
    logger.error('Geocoding failed', { err, address: '[redacted]' });
    return null;
  }
}

// ─── Reverse Geocode ──────────────────────────────────────────────────────────

/** Reverse geocode lat/lng to suburb and postcode. */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<Pick<GeocodeResult, 'suburb' | 'postcode' | 'state'> | null> {
  const params = new URLSearchParams({
    lat: lat.toString(),
    lon: lng.toString(),
    format: 'json',
    addressdetails: '1',
  });

  try {
    const response = await rateLimitedFetch(`${NOMINATIM_BASE}/reverse?${params}`);
    if (!response.ok) return null;

    const r = await response.json() as NominatimResult;
    return {
      suburb: r.address?.suburb ?? r.address?.town ?? '',
      postcode: r.address?.postcode ?? '',
      state: r.address?.state ?? '',
    };
  } catch (err) {
    logger.error('Reverse geocoding failed', { err });
    return null;
  }
}

// ─── Nominatim types (internal) ───────────────────────────────────────────────

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    suburb?: string;
    town?: string;
    city?: string;
    city_district?: string;
    state?: string;
    postcode?: string;
  };
}
