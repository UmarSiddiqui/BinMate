/**
 * City of Fremantle scraper tests.
 *
 * Test addresses chosen from PLAN.md §1.4:
 *   - 15 South Tce, Fremantle WA 6160  → FRE-4 (Tuesday)
 *
 * Mocks geocoding (Nominatim) and ArcGIS FeatureServer (no production calls per CLAUDE.md §12).
 * Run with: npm test -- tests/scrapers/fremantle.test.ts
 */

const FREMANTLE_ARCGIS_BASE =
  'https://services3.arcgis.com/gxYehwfGQwBQvQkx/arcgis/rest/services' +
  '/Domestic_waste_collection_areas/FeatureServer/60';

jest.mock('../../src/services/geocoding', () => ({
  geocodeAddress: jest.fn(async (address: string) => {
    if (address.includes('South Tce') || address.includes('Fremantle WA 6160')) {
      return {
        lat: -32.0569,
        lng: 115.7439,
        suburb: 'Fremantle',
        state: 'Western Australia',
        postcode: '6160',
        displayName: '15 South Terrace, Fremantle WA',
      };
    }
    if (address.includes('Armadale') || address.includes('Sexty')) {
      return {
        lat: -32.15,
        lng: 116.0,
        suburb: 'Armadale',
        state: 'Western Australia',
        postcode: '6112',
        displayName: '23 Sexty St, Armadale WA',
      };
    }
    return null;
  }),
}));

const originalFetch = globalThis.fetch;
beforeAll(() => {
  const mockFetch: typeof fetch = async (input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as { url: string }).url;
    if (url.startsWith(FREMANTLE_ARCGIS_BASE)) {
      const geo = new URL(url).searchParams.get('geometry');
      const geom = geo ? JSON.parse(geo) : {};
      const y = geom?.y ?? 0;
      const x = geom?.x ?? 0;
      // Fremantle coords (-32.0569, 115.7439) → FRE-4 (Tuesday)
      if (Math.abs(y - (-32.0569)) < 0.01 && Math.abs(x - 115.7439) < 0.01) {
        return new Response(JSON.stringify({
          features: [{ attributes: { WasteID: 4, CollectionDay: 'Tuesday' } }],
        }), { status: 200 });
      }
      // Armadale coords → outside Fremantle, no zone
      return new Response(JSON.stringify({ features: [] }), { status: 200 });
    }
    return originalFetch(input);
  };
  (globalThis as { fetch: typeof fetch }).fetch = mockFetch;
});
afterAll(() => {
  (globalThis as { fetch: typeof fetch }).fetch = originalFetch;
});

import { fremantleScraper, fremantleCanHandle } from '../../src/scrapers/fremantle';

describe('FremantleScraper', () => {

  // ── resolveAddress ──────────────────────────────────────────────────────────

  describe('resolveAddress', () => {

    it('resolves 15 South Tce → FRE-4 (Tuesday)', async () => {
      const result = await fremantleScraper.resolveAddress('15 South Tce, Fremantle WA 6160');
      expect(result.error).toBeUndefined();
      expect(result.zoneCode).toBe('FRE-4');
      expect(result.zoneName).toContain('Tuesday');
      expect(result.councilSlug).toBe('fremantle');
    }, 20_000);

    it('returns error for an address outside Fremantle LGA (Armadale)', async () => {
      const result = await fremantleScraper.resolveAddress('23 Sexty St, Armadale WA 6112');
      expect(result.error).toBeDefined();
      expect(result.zoneCode).toBe('');
    }, 20_000);

  });

  // ── fetchSchedule ───────────────────────────────────────────────────────────

  describe('fetchSchedule', () => {

    it('FRE-4 (Tuesday): general weekly, recycling Week B', async () => {
      const s = await fremantleScraper.fetchSchedule('FRE-4');
      expect(s.generalDay).toBe('tuesday');
      expect(s.generalFrequency).toBe('weekly');
      expect(s.recyclingDay).toBe('tuesday');
      expect(s.recyclingWeek).toBe('B');
      expect(s.greenWasteDay).toBeNull();
      expect(s.greenWasteWeek).toBeNull();
    });

    it('FRE-5 (Thursday): general weekly, recycling Week B', async () => {
      const s = await fremantleScraper.fetchSchedule('FRE-5');
      expect(s.generalDay).toBe('thursday');
      expect(s.recyclingWeek).toBe('B');
    });

    it('FRE-1 (Monday zone 1): general weekly, recycling Week B', async () => {
      const s = await fremantleScraper.fetchSchedule('FRE-1');
      expect(s.generalDay).toBe('monday');
      expect(s.recyclingWeek).toBe('B');
    });

    it('FRE-2 (Monday zone 2): same day as FRE-1, recycling Week B', async () => {
      const s = await fremantleScraper.fetchSchedule('FRE-2');
      expect(s.generalDay).toBe('monday');
      expect(s.recyclingWeek).toBe('B');
    });

    it('FRE-6 (Wednesday): general weekly, recycling Week B', async () => {
      const s = await fremantleScraper.fetchSchedule('FRE-6');
      expect(s.generalDay).toBe('wednesday');
      expect(s.recyclingWeek).toBe('B');
    });

    it('FRE-7 (Friday): general weekly, recycling Week B', async () => {
      const s = await fremantleScraper.fetchSchedule('FRE-7');
      expect(s.generalDay).toBe('friday');
      expect(s.recyclingWeek).toBe('B');
    });

    it('throws for an unknown zone code', async () => {
      await expect(fremantleScraper.fetchSchedule('INVALID')).rejects.toThrow('Unknown Fremantle zone code');
    });

    it('throws for an unknown WasteID', async () => {
      await expect(fremantleScraper.fetchSchedule('FRE-99')).rejects.toThrow('Unknown Fremantle WasteID');
    });

  });

  // ── fremantleCanHandle ──────────────────────────────────────────────────────

  describe('fremantleCanHandle', () => {

    it('returns true for Fremantle LGA suburbs', () => {
      expect(fremantleCanHandle('fremantle')).toBe(true);
      expect(fremantleCanHandle('Fremantle')).toBe(true);  // case-insensitive
      expect(fremantleCanHandle('north fremantle')).toBe(true);
      expect(fremantleCanHandle('South Fremantle')).toBe(true);
      expect(fremantleCanHandle('beaconsfield')).toBe(true);
      expect(fremantleCanHandle('hilton')).toBe(true);
    });

    it('returns false for non-Fremantle suburbs', () => {
      expect(fremantleCanHandle('armadale')).toBe(false);
      expect(fremantleCanHandle('clarkson')).toBe(false);
      expect(fremantleCanHandle('scarborough')).toBe(false);
    });

  });

  // ── healthCheck ─────────────────────────────────────────────────────────────

  describe('healthCheck', () => {

    it('passes with mocked geocoding and ArcGIS', async () => {
      const ok = await fremantleScraper.healthCheck();
      expect(ok).toBe(true);
    }, 20_000);

  });

});
