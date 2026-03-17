/**
 * Town of Bassendean scraper tests.
 *
 * Mocks:
 * - Nominatim geocoding response
 * - Bassendean ArcGIS FeatureServer point queries
 *
 * No production calls are made during tests.
 */

const BASSENDEAN_ARCGIS_BASE =
  'https://services-ap1.arcgis.com/551UnqKK1GZeDKxQ/arcgis/rest/services' +
  '/address_lookup_for_bin_days_dissolved/FeatureServer/0';

jest.mock('../../src/services/geocoding', () => ({
  geocodeAddress: jest.fn(async (address: string) => {
    if (address.includes('Railway Parade') || address.includes('BASSENDEAN WA 6054')) {
      return {
        lat: -31.9060,
        lng: 115.9480,
        suburb: 'Bassendean',
        state: 'Western Australia',
        postcode: '6054',
        displayName: '4 Railway Parade, Bassendean WA',
      };
    }
    if (address.includes('Maidos') || address.includes('ASHFIELD WA 6054')) {
      return {
        lat: -31.9082,
        lng: 115.9461,
        suburb: 'Ashfield',
        state: 'Western Australia',
        postcode: '6054',
        displayName: '20 Maidos Street, Ashfield WA',
      };
    }
    if (address.includes('South Perth')) {
      return {
        lat: -31.9821,
        lng: 115.8620,
        suburb: 'South Perth',
        state: 'Western Australia',
        postcode: '6151',
        displayName: '1 Sandgate Street, South Perth WA',
      };
    }
    return null;
  }),
}));

const originalFetch = globalThis.fetch;

beforeAll(() => {
  const mockFetch: typeof fetch = async (input) => {
    const url =
      typeof input === 'string' ? input
      : input instanceof URL ? input.href
      : (input as { url: string }).url;

    if (url.startsWith(BASSENDEAN_ARCGIS_BASE)) {
      const geometryJson = new URL(url).searchParams.get('geometry');
      const geom = geometryJson ? JSON.parse(geometryJson) : {};
      const y = geom?.y ?? 0;
      const x = geom?.x ?? 0;

      // 20 Maidos Street, Ashfield -> Tuesday zone
      if (Math.abs(y - (-31.9082)) < 0.002 && Math.abs(x - 115.9461) < 0.002) {
        return new Response(JSON.stringify({
          features: [{ attributes: { ServiceDay: 'Tuesday', SL_Addy: '20 MAIDOS ST ASHFIELD 6054' } }],
        }), { status: 200 });
      }

      // 4 Railway Parade, Bassendean -> Thursday zone
      if (Math.abs(y - (-31.9060)) < 0.002 && Math.abs(x - 115.9480) < 0.002) {
        return new Response(JSON.stringify({
          features: [{ attributes: { ServiceDay: 'Thursday', SL_Addy: '4 RAILWAY PDE BASSENDEAN 6054' } }],
        }), { status: 200 });
      }

      return new Response(JSON.stringify({ features: [] }), { status: 200 });
    }

    return originalFetch(input);
  };

  (globalThis as { fetch: typeof fetch }).fetch = mockFetch;
});

afterAll(() => {
  (globalThis as { fetch: typeof fetch }).fetch = originalFetch;
});

import { bassendeanCanHandle, bassendeanScraper } from '../../src/scrapers/bassendean';

describe('bassendeanScraper.resolveAddress', () => {
  it('resolves a Bassendean address to Thursday Week-B zone', async () => {
    const result = await bassendeanScraper.resolveAddress('4 Railway Parade BASSENDEAN WA 6054');
    expect(result.error).toBeUndefined();
    expect(result.zoneCode).toBe('BAS-THU-B');
    expect(result.zoneName).toContain('Thursday');
    expect(result.councilSlug).toBe('bassendean');
  });

  it('resolves an Ashfield address to Tuesday Week-B zone', async () => {
    const result = await bassendeanScraper.resolveAddress('20 Maidos Street ASHFIELD WA 6054');
    expect(result.error).toBeUndefined();
    expect(result.zoneCode).toBe('BAS-TUE-B');
  });

  it('rejects an address outside Bassendean service area', async () => {
    const result = await bassendeanScraper.resolveAddress('1 Sandgate Street South Perth WA 6151');
    expect(result.zoneCode).toBe('');
    expect(result.error).toBeTruthy();
  });
});

describe('bassendeanScraper.fetchSchedule', () => {
  it('returns weekly base + alternating recycling/general-week schedule', async () => {
    const schedule = await bassendeanScraper.fetchSchedule('BAS-THU-B');
    expect(schedule.generalDay).toBe('thursday');
    expect(schedule.generalFrequency).toBe('weekly');
    expect(schedule.recyclingDay).toBe('thursday');
    expect(schedule.recyclingWeek).toBe('B');
    expect(schedule.greenWasteDay).toBe('thursday');
    expect(schedule.greenWasteWeek).toBe('A');
  });

  it('throws for an unknown zone code', async () => {
    await expect(bassendeanScraper.fetchSchedule('BAS-SAT-B')).rejects.toThrow(
      /Unknown Bassendean zone code/,
    );
  });
});

describe('bassendeanScraper.healthCheck', () => {
  it('passes using the mocked Bassendean address', async () => {
    const ok = await bassendeanScraper.healthCheck();
    expect(ok).toBe(true);
  });
});

describe('bassendeanCanHandle', () => {
  it.each([
    'bassendean',
    'Bassendean',
    'ashfield',
  ])('accepts "%s"', (suburb) => {
    expect(bassendeanCanHandle(suburb)).toBe(true);
  });

  it.each([
    'eden hill',
    'bayswater',
    'swan view',
    '',
  ])('rejects "%s"', (suburb) => {
    expect(bassendeanCanHandle(suburb)).toBe(false);
  });
});
