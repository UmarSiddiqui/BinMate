/**
 * Town of Claremont scraper tests.
 *
 * Mocks:
 * - Nominatim geocoding response
 * - Claremont ward bundle containing embedded GeoJSON polygons
 *
 * No production calls are made during tests.
 */

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const CLAREMONT_WARD_BUNDLE = 'https://www.claremont.wa.gov.au/assets/dist/796.2182434058107d55e5c6.js';

const MOCK_WARD_GEOJSON = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { Name: 'South East Ward', BinDay: 'Monday', RecycleDay: null },
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [115.78, -31.99],
              [115.79, -31.99],
              [115.79, -31.98],
              [115.78, -31.98],
              [115.78, -31.99],
            ],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { Name: 'North West Ward', BinDay: 'Thursday', RecycleDay: null },
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [115.76, -31.98],
              [115.77, -31.98],
              [115.77, -31.97],
              [115.76, -31.97],
              [115.76, -31.98],
            ],
          ],
        ],
      },
    },
  ],
} as const;

function jsonRes(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function bundleResFromGeoJson(geoJson: unknown): Response {
  const escaped = JSON.stringify(geoJson)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\"/g, '\\\"');

  const body = `"use strict";(self.webpackChunk=self.webpackChunk||[]).push([[796],{4796:function(e){e.exports=JSON.parse('${escaped}')}}]);`;

  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'application/javascript' },
  });
}

const originalFetch = globalThis.fetch;

beforeAll(() => {
  const mockFetch: typeof fetch = async (input) => {
    const url =
      typeof input === 'string' ? input
      : input instanceof URL ? input.href
      : (input as Request).url;

    if (url.startsWith(NOMINATIM_BASE)) {
      const query = new URL(url).searchParams.get('q') ?? '';

      if (query.includes('308 Stirling Highway') || query.includes('Claremont')) {
        return jsonRes([{
          lat: '-31.9850',
          lon: '115.7850',
          display_name: '308 Stirling Highway, Claremont, Western Australia, Australia',
          address: {
            suburb: 'Claremont',
            state: 'Western Australia',
            postcode: '6010',
          },
        }]);
      }

      if (query.includes('1 Alfred Road')) {
        return jsonRes([{
          lat: '-31.9750',
          lon: '115.7650',
          display_name: '1 Alfred Road, Swanbourne, Western Australia, Australia',
          address: {
            suburb: 'Swanbourne',
            state: 'Western Australia',
            postcode: '6010',
          },
        }]);
      }

      if (query.includes('South Perth')) {
        return jsonRes([{
          lat: '-31.9821',
          lon: '115.8620',
          display_name: '1 Sandgate Street, South Perth, Western Australia, Australia',
          address: {
            suburb: 'South Perth',
            state: 'Western Australia',
            postcode: '6151',
          },
        }]);
      }

      return jsonRes([]);
    }

    if (url === CLAREMONT_WARD_BUNDLE) {
      return bundleResFromGeoJson(MOCK_WARD_GEOJSON);
    }

    return originalFetch(input);
  };

  (globalThis as { fetch: typeof fetch }).fetch = mockFetch;
});

afterAll(() => {
  (globalThis as { fetch: typeof fetch }).fetch = originalFetch;
});

import { claremontCanHandle, claremontScraper } from '../../src/scrapers/claremont';

describe('claremontScraper.resolveAddress', () => {
  it('resolves a Claremont address to a Monday Week-B zone', async () => {
    const result = await claremontScraper.resolveAddress('308 Stirling Highway CLAREMONT WA 6010');
    expect(result.error).toBeUndefined();
    expect(result.zoneCode).toBe('CLR-MON-B');
    expect(result.zoneName).toContain('Monday');
    expect(result.councilSlug).toBe('claremont');
  });

  it('resolves another in-area address to the expected ward day', async () => {
    const result = await claremontScraper.resolveAddress('1 Alfred Road SWANBOURNE WA 6010');
    expect(result.error).toBeUndefined();
    expect(result.zoneCode).toBe('CLR-THU-B');
  });

  it('rejects an address outside Claremont service polygons', async () => {
    const result = await claremontScraper.resolveAddress('1 Sandgate Street SOUTH PERTH WA 6151');
    expect(result.zoneCode).toBe('');
    expect(result.error).toBeTruthy();
  });
});

describe('claremontScraper.fetchSchedule', () => {
  it('returns weekly general and Week-B recycling for CLR-MON-B', async () => {
    const schedule = await claremontScraper.fetchSchedule('CLR-MON-B');
    expect(schedule.generalDay).toBe('monday');
    expect(schedule.generalFrequency).toBe('weekly');
    expect(schedule.recyclingDay).toBe('monday');
    expect(schedule.recyclingWeek).toBe('B');
    expect(schedule.greenWasteDay).toBe('monday');
    expect(schedule.greenWasteWeek).toBe('A');
  });

  it('throws for an unknown zone code', async () => {
    await expect(claremontScraper.fetchSchedule('CLR-SAT-B')).rejects.toThrow(
      /Unknown Claremont zone code/,
    );
  });
});

describe('claremontScraper.healthCheck', () => {
  it('passes using the mocked Claremont civic address', async () => {
    const ok = await claremontScraper.healthCheck();
    expect(ok).toBe(true);
  });
});

describe('claremontCanHandle', () => {
  it.each([
    'claremont',
    'swanbourne',
    'mount claremont',
    'mt claremont',
  ])('accepts "%s"', (suburb) => {
    expect(claremontCanHandle(suburb)).toBe(true);
  });

  it.each([
    'nedlands',
    'subiaco',
    'peppermint grove',
    '',
  ])('rejects "%s"', (suburb) => {
    expect(claremontCanHandle(suburb)).toBe(false);
  });
});
