/**
 * City of Vincent scraper tests.
 *
 * Mocked against live endpoint shape:
 *   - GET /pozi/qgisserver?...&TYPENAME=Waste_Collection&FILTER=...
 *
 * Test addresses chosen from the council waste layer:
 *   - 2 Chertsey St, Mount Lawley WA 6050 (residential)
 *   - 244 Vincent St, Leederville WA 6007 (unsupported/non-residential pattern)
 *
 * No production API calls are made in tests.
 */

const VINCENT_WFS_BASE = 'https://mapping.vincent.wa.gov.au/pozi/qgisserver';

function jsonRes(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function qgisFeature(
  address: string,
  general: string | null,
  recycling: string | null,
  fogo: string | null,
): unknown {
  return {
    type: 'Feature',
    id: `Waste_Collection.${address}`,
    geometry: { type: 'Polygon', coordinates: [] },
    properties: {
      Address: address,
      'General Waste Collection Day': general,
      'Recycling Collection Day': recycling,
      'FOGO Collection Day': fogo,
      'Verge Valet Vincent': 'https://www.wmrc.wa.gov.au/vergevalet/',
    },
  };
}

const originalFetch = globalThis.fetch;

beforeAll(() => {
  const mockFetch: typeof fetch = async (input) => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : (input as Request).url;

    if (!url.startsWith(VINCENT_WFS_BASE)) return originalFetch(input);

    const parsed = new URL(url);
    const filter = parsed.searchParams.get('FILTER') ?? '';
    const literalMatch = filter.match(/<Literal>([^<]+)<\/Literal>/i);
    const literal = literalMatch?.[1] ?? '';

    if (literal === '2 Chertsey St*') {
      return jsonRes({
        type: 'FeatureCollection',
        features: [
          qgisFeature(
            '2 Chertsey St, Mount Lawley',
            '<p style="color: red; font-weight: bold;">General Waste Collection Day:</p><p>27 Mar 2026 - Fortnightly (Friday Week 1)</p>',
            '<p style="color: #b8860b; font-weight: bold;">Recycling Collection Day:</p><p>20 Mar 2026 - Fortnightly (FRIDAY WEEK 2)</p>',
            '<p style="color: green; font-weight: bold;">FOGO Collection Day:</p><p>20 Mar 2026 - Weekly (FRIDAY)</p>',
          ),
        ],
      });
    }

    if (literal === '17 Simpson St*') {
      return jsonRes({
        type: 'FeatureCollection',
        features: [
          qgisFeature(
            '17 Simpson St, West Perth',
            '<p style="color: red; font-weight: bold;">General Waste Collection Day:</p><p>18 Mar 2026 - Fortnightly (Wednesday Week 2)</p>',
            '<p style="color: #b8860b; font-weight: bold;">Recycling Collection Day:</p><p>25 Mar 2026 - Fortnightly (Wednesday Week 1)</p>',
            '<p style="color: green; font-weight: bold;">FOGO Collection Day:</p><p>18 Mar 2026 - Weekly (Wednesday)</p>',
          ),
        ],
      });
    }

    if (literal === '244 Vincent St*') {
      return jsonRes({
        type: 'FeatureCollection',
        features: [
          qgisFeature('244 Vincent St, Leederville', null, null, null),
        ],
      });
    }

    if (literal === '14 View St*') {
      return jsonRes({
        type: 'FeatureCollection',
        features: [
          qgisFeature(
            '14 View St, North Perth',
            '<p style="color: red; font-weight: bold;">General Waste Collection Day:</p><p>N/A.</p>',
            '<p style="color: #b8860b; font-weight: bold;">Recycling Collection Day:</p><p>N/A.</p>',
            '<p style="color: green; font-weight: bold;">FOGO Collection Day:</p><p>N/A.</p>',
          ),
        ],
      });
    }

    return jsonRes({ type: 'FeatureCollection', features: [] });
  };

  (globalThis as { fetch: typeof fetch }).fetch = mockFetch;
});

afterAll(() => {
  (globalThis as { fetch: typeof fetch }).fetch = originalFetch;
});

import { vincentScraper, vincentCanHandle } from '../../src/scrapers/vincent';

describe('VincentScraper', () => {
  describe('resolveAddress', () => {
    it('resolves Chertsey to VIN-FRI-A', async () => {
      const result = await vincentScraper.resolveAddress('2 Chertsey Street, Mount Lawley WA 6050');
      expect(result.error).toBeUndefined();
      expect(result.zoneCode).toBe('VIN-FRI-A');
      expect(result.councilSlug).toBe('vincent');
    });

    it('resolves Simpson to VIN-WED-B', async () => {
      const result = await vincentScraper.resolveAddress('17 Simpson Street, West Perth WA 6005');
      expect(result.error).toBeUndefined();
      expect(result.zoneCode).toBe('VIN-WED-B');
      expect(result.zoneName).toContain('Wednesday');
    });

    it('returns unsupported for non-residential pattern', async () => {
      const result = await vincentScraper.resolveAddress('244 Vincent Street, Leederville WA 6007');
      expect(result.zoneCode).toBe('');
      expect(result.error).toContain('unsupported');
    });

    it('returns unsupported for N/A properties', async () => {
      const result = await vincentScraper.resolveAddress('14 View Street, North Perth WA 6006');
      expect(result.zoneCode).toBe('');
      expect(result.error).toContain('unsupported');
    });

    it('returns not found for unknown address', async () => {
      const result = await vincentScraper.resolveAddress('1 Queen Street, Fremantle WA 6160');
      expect(result.zoneCode).toBe('');
      expect(result.error).toContain('not found');
    });
  });

  describe('fetchSchedule', () => {
    it('returns fortnightly red + fortnightly recycling + weekly FOGO for VIN-FRI-A', async () => {
      const s = await vincentScraper.fetchSchedule('VIN-FRI-A');
      expect(s.generalDay).toBe('friday');
      expect(s.generalFrequency).toBe('fortnightly');
      expect(s.recyclingDay).toBe('friday');
      expect(s.recyclingWeek).toBe('A');
      expect(s.greenWasteDay).toBe('friday');
      expect(s.greenWasteWeek).toBe('weekly');
    });

    it('returns correct week for VIN-WED-B', async () => {
      const s = await vincentScraper.fetchSchedule('VIN-WED-B');
      expect(s.generalDay).toBe('wednesday');
      expect(s.recyclingWeek).toBe('B');
      expect(s.greenWasteWeek).toBe('weekly');
    });

    it('throws for unknown zone code', async () => {
      await expect(vincentScraper.fetchSchedule('VIN-SAT-A')).rejects.toThrow('Unknown Vincent zone code');
    });
  });

  describe('vincentCanHandle', () => {
    it('returns true for Vincent suburbs', () => {
      expect(vincentCanHandle('North Perth')).toBe(true);
      expect(vincentCanHandle('leederville')).toBe(true);
      expect(vincentCanHandle('WEST PERTH')).toBe(true);
      expect(vincentCanHandle('mount hawthorn')).toBe(true);
    });

    it('returns false for non-Vincent suburbs', () => {
      expect(vincentCanHandle('fremantle')).toBe(false);
      expect(vincentCanHandle('scarborough')).toBe(false);
      expect(vincentCanHandle('midland')).toBe(false);
    });
  });

  describe('healthCheck', () => {
    it('passes with mocked Vincent payloads', async () => {
      const ok = await vincentScraper.healthCheck();
      expect(ok).toBe(true);
    });
  });
});
