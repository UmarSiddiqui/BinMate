/**
 * Town of Victoria Park scraper tests.
 *
 * Mocked against live endpoint shape:
 *   - Core property search via WFS TYPENAME=Property_-_Address + EXP_FILTER
 *   - Waste lookup via WFS TYPENAME=Waste_Collection + BBOX
 *
 * Test addresses chosen from live Victoria Park QGIS responses (verified 2026-03-17):
 *   - 99 Shepperton Road, Victoria Park WA 6100 -> TVP-TUE-B
 *   - 1 Kent Street, Victoria Park WA 6100      -> TVP-THU-A
 *
 * No production API calls are made in tests.
 */

const VP_QGIS_BASE = 'https://maps.vicpark.wa.gov.au/pozi/qgisserver';

function jsonRes(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function propertyFeature(address: string, locality: string, centerLon: number): unknown {
  const y = -31.9800;
  const d = 0.0001;
  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [centerLon - d, y - d],
        [centerLon + d, y - d],
        [centerLon + d, y + d],
        [centerLon - d, y + d],
        [centerLon - d, y - d],
      ]],
    },
    properties: {
      Address: address,
      Locality: locality,
    },
  };
}

function wasteFeature(fogo: string, general3: string, recycling: string): unknown {
  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [] },
    properties: {
      'FOGO Collection': fogo,
      'General Waste 3bin system with FOGO': general3,
      'Recycling Collection': recycling,
      'Waste Information': 'https://www.victoriapark.wa.gov.au/residents/waste-and-recycling',
    },
  };
}

const originalFetch = globalThis.fetch;

beforeAll(() => {
  const mockFetch: typeof fetch = async (input) => {
    const rawUrl = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : (input as Request).url;

    if (!rawUrl.startsWith(VP_QGIS_BASE)) return originalFetch(input);

    const url = new URL(rawUrl);
    const map = url.searchParams.get('MAP') ?? '';
    const typeName = url.searchParams.get('TYPENAME') ?? '';

    if (map.includes('Core.qgs') && typeName === 'Property_-_Address') {
      const filter = url.searchParams.get('EXP_FILTER') ?? '';
      const match = filter.match(/Address\s+ilike\s+'(.+)%'/i);
      const query = match?.[1] ?? '';

      if (query === '99 Shepperton Road, Victoria Park WA 6100' || query === '99 Shepperton Road') {
        return jsonRes({
          type: 'FeatureCollection',
          features: [
            propertyFeature('99 Shepperton Road', 'VICTORIA PARK 6100', 115.910),
          ],
        });
      }

      if (query === '1 Kent Street, Victoria Park WA 6100') {
        return jsonRes({ type: 'FeatureCollection', features: [] });
      }

      if (query === '1 Kent Street') {
        return jsonRes({
          type: 'FeatureCollection',
          features: [
            propertyFeature('1 Kent Street', 'VICTORIA PARK 6100', 115.920),
          ],
        });
      }

      if (query === '244 Albany Highway, Victoria Park WA 6100' || query === '244 Albany Highway') {
        return jsonRes({
          type: 'FeatureCollection',
          features: [
            propertyFeature('244 Albany Highway', 'VICTORIA PARK 6100', 115.930),
          ],
        });
      }

      return jsonRes({ type: 'FeatureCollection', features: [] });
    }

    if (map.includes('OurTown.qgs') && typeName === 'Waste_Collection') {
      const bbox = url.searchParams.get('BBOX') ?? '';
      const parts = bbox.split(',');
      const minLon = parseFloat(parts[0] ?? '0');
      const maxLon = parseFloat(parts[2] ?? '0');
      const centerLon = (minLon + maxLon) / 2;

      if (centerLon < 115.915) {
        return jsonRes({
          type: 'FeatureCollection',
          features: [
            wasteFeature(
              'Tuesday - Weekly',
              'Tuesday 31 March - Tuesday Fortnightly (Group 1)',
              'Tuesday 24 March - Fortnightly',
            ),
          ],
        });
      }

      if (centerLon < 115.925) {
        return jsonRes({
          type: 'FeatureCollection',
          features: [
            wasteFeature(
              'Thursday - Weekly',
              'Thursday 26 March - Thursday Fortnightly (Group 2)',
              'Thursday 19 March - Fortnightly',
            ),
          ],
        });
      }

      return jsonRes({
        type: 'FeatureCollection',
        features: [
          wasteFeature(
            'n/a - Multi Unit Dwelling',
            'Today (Tuesday 17 March) - Tuesday Fortnightly (Group 2)',
            'Today (Tuesday 17 March) - Fortnightly',
          ),
        ],
      });
    }

    return jsonRes({ error: 'Unhandled mock URL' }, 404);
  };

  (globalThis as { fetch: typeof fetch }).fetch = mockFetch;
});

afterAll(() => {
  (globalThis as { fetch: typeof fetch }).fetch = originalFetch;
});

import { victoriaParkScraper, victoriaParkCanHandle } from '../../src/scrapers/victoriapark';

describe('VictoriaParkScraper', () => {
  describe('resolveAddress', () => {
    it('resolves Shepperton to TVP-TUE-B', async () => {
      const result = await victoriaParkScraper.resolveAddress('99 Shepperton Road, Victoria Park WA 6100');
      expect(result.error).toBeUndefined();
      expect(result.zoneCode).toBe('TVP-TUE-B');
      expect(result.councilSlug).toBe('victoriapark');
    });

    it('falls back to street query and resolves Kent Street to TVP-THU-A', async () => {
      const result = await victoriaParkScraper.resolveAddress('1 Kent Street, Victoria Park WA 6100');
      expect(result.error).toBeUndefined();
      expect(result.zoneCode).toBe('TVP-THU-A');
      expect(result.zoneName).toContain('Thursday');
    });

    it('returns unsupported for multi-unit n/a FOGO patterns', async () => {
      const result = await victoriaParkScraper.resolveAddress('244 Albany Highway, Victoria Park WA 6100');
      expect(result.zoneCode).toBe('');
      expect(result.error).toContain('unsupported');
    });

    it('returns not found for unknown address', async () => {
      const result = await victoriaParkScraper.resolveAddress('1 Queen Street, Fremantle WA 6160');
      expect(result.zoneCode).toBe('');
      expect(result.error).toContain('not found');
    });
  });

  describe('fetchSchedule', () => {
    it('returns fortnightly general + fortnightly recycling + weekly FOGO for TVP-TUE-B', async () => {
      const s = await victoriaParkScraper.fetchSchedule('TVP-TUE-B');
      expect(s.generalDay).toBe('tuesday');
      expect(s.generalFrequency).toBe('fortnightly');
      expect(s.recyclingDay).toBe('tuesday');
      expect(s.recyclingWeek).toBe('B');
      expect(s.greenWasteDay).toBe('tuesday');
      expect(s.greenWasteWeek).toBe('weekly');
    });

    it('returns correct week for TVP-THU-A', async () => {
      const s = await victoriaParkScraper.fetchSchedule('TVP-THU-A');
      expect(s.generalDay).toBe('thursday');
      expect(s.recyclingWeek).toBe('A');
    });

    it('throws for unknown zone code', async () => {
      await expect(victoriaParkScraper.fetchSchedule('TVP-SAT-A')).rejects.toThrow('Unknown Victoria Park zone code');
    });
  });

  describe('victoriaParkCanHandle', () => {
    it('returns true for Victoria Park suburbs', () => {
      expect(victoriaParkCanHandle('Victoria Park')).toBe(true);
      expect(victoriaParkCanHandle('east victoria park')).toBe(true);
      expect(victoriaParkCanHandle('LATHLAIN')).toBe(true);
      expect(victoriaParkCanHandle('Bentley')).toBe(true);
    });

    it('returns false for non-Victoria Park suburbs', () => {
      expect(victoriaParkCanHandle('fremantle')).toBe(false);
      expect(victoriaParkCanHandle('scarborough')).toBe(false);
      expect(victoriaParkCanHandle('midland')).toBe(false);
    });
  });

  describe('healthCheck', () => {
    it('passes with mocked Victoria Park payloads', async () => {
      const ok = await victoriaParkScraper.healthCheck();
      expect(ok).toBe(true);
    });
  });
});
