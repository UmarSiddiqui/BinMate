/**
 * Town of East Fremantle scraper tests.
 *
 * Mocks Nominatim geocoding. No production calls.
 *
 * Addresses are chosen to exercise each weekday branch in the map heuristic.
 */

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

function jsonRes(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
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

      if (query.includes('135 Canning Highway')) {
        return jsonRes([{
          lat: '-32.0348',
          lon: '115.7650',
          display_name: '135 Canning Highway, East Fremantle, Western Australia, Australia',
          address: { suburb: 'East Fremantle', state: 'Western Australia', postcode: '6158' },
        }]);
      }

      if (query.includes('1 Irwin Street')) {
        return jsonRes([{
          lat: '-32.0330',
          lon: '115.7710',
          display_name: '1 Irwin Street, East Fremantle, Western Australia, Australia',
          address: { suburb: 'East Fremantle', state: 'Western Australia', postcode: '6158' },
        }]);
      }

      if (query.includes('1 Pier Street')) {
        return jsonRes([{
          lat: '-32.0410',
          lon: '115.7668',
          display_name: '1 Pier Street, East Fremantle, Western Australia, Australia',
          address: { suburb: 'East Fremantle', state: 'Western Australia', postcode: '6158' },
        }]);
      }

      if (query.includes('1 Marmion Street')) {
        return jsonRes([{
          lat: '-32.0408',
          lon: '115.7750',
          display_name: '1 Marmion Street, East Fremantle, Western Australia, Australia',
          address: { suburb: 'East Fremantle', state: 'Western Australia', postcode: '6158' },
        }]);
      }

      if (query.includes('1 Fraser Street')) {
        return jsonRes([{
          lat: '-32.0440',
          lon: '115.7588',
          display_name: '1 Fraser Street, East Fremantle, Western Australia, Australia',
          address: { suburb: 'East Fremantle', state: 'Western Australia', postcode: '6158' },
        }]);
      }

      if (query.includes('South Perth')) {
        return jsonRes([{
          lat: '-31.9821',
          lon: '115.8620',
          display_name: '1 Sandgate Street, South Perth, Western Australia, Australia',
          address: { suburb: 'South Perth', state: 'Western Australia', postcode: '6151' },
        }]);
      }

      return jsonRes([]);
    }

    return originalFetch(input);
  };

  (globalThis as { fetch: typeof fetch }).fetch = mockFetch;
});

afterAll(() => {
  (globalThis as { fetch: typeof fetch }).fetch = originalFetch;
});

import { eastFremantleCanHandle, eastFremantleScraper } from '../../src/scrapers/eastfremantle';

describe('eastFremantleScraper.resolveAddress', () => {
  it('resolves a north-west address to Monday zone', async () => {
    const result = await eastFremantleScraper.resolveAddress('135 Canning Highway East Fremantle WA 6158');
    expect(result.error).toBeUndefined();
    expect(result.zoneCode).toBe('EFR-MON-A');
    expect(result.councilSlug).toBe('eastfremantle');
  });

  it('resolves a north-east address to Tuesday zone', async () => {
    const result = await eastFremantleScraper.resolveAddress('1 Irwin Street East Fremantle WA 6158');
    expect(result.error).toBeUndefined();
    expect(result.zoneCode).toBe('EFR-TUE-A');
  });

  it('resolves a south-central address to Wednesday zone', async () => {
    const result = await eastFremantleScraper.resolveAddress('1 Pier Street East Fremantle WA 6158');
    expect(result.error).toBeUndefined();
    expect(result.zoneCode).toBe('EFR-WED-A');
  });

  it('resolves a south-east address to Thursday zone', async () => {
    const result = await eastFremantleScraper.resolveAddress('1 Marmion Street East Fremantle WA 6158');
    expect(result.error).toBeUndefined();
    expect(result.zoneCode).toBe('EFR-THU-A');
  });

  it('resolves a south-west address to Friday zone', async () => {
    const result = await eastFremantleScraper.resolveAddress('1 Fraser Street East Fremantle WA 6158');
    expect(result.error).toBeUndefined();
    expect(result.zoneCode).toBe('EFR-FRI-A');
  });

  it('rejects an address outside East Fremantle service area', async () => {
    const result = await eastFremantleScraper.resolveAddress('1 Sandgate Street South Perth WA 6151');
    expect(result.zoneCode).toBe('');
    expect(result.error).toBeTruthy();
  });
});

describe('eastFremantleScraper.fetchSchedule', () => {
  it('returns weekly FOGO + alternating recycling/general schedule', async () => {
    const schedule = await eastFremantleScraper.fetchSchedule('EFR-WED-A');
    expect(schedule.generalDay).toBe('wednesday');
    expect(schedule.generalFrequency).toBe('weekly');
    expect(schedule.recyclingDay).toBe('wednesday');
    expect(schedule.recyclingWeek).toBe('A');
    expect(schedule.greenWasteDay).toBe('wednesday');
    expect(schedule.greenWasteWeek).toBe('B');
  });

  it('throws for an unknown zone code', async () => {
    await expect(eastFremantleScraper.fetchSchedule('EFR-SAT-A')).rejects.toThrow(
      /Unknown East Fremantle zone code/,
    );
  });
});

describe('eastFremantleScraper.healthCheck', () => {
  it('passes using the mocked East Fremantle civic address', async () => {
    const ok = await eastFremantleScraper.healthCheck();
    expect(ok).toBe(true);
  });
});

describe('eastFremantleCanHandle', () => {
  it.each([
    'east fremantle',
    'East Fremantle',
    'EAST FREMANTLE',
  ])('accepts "%s"', (suburb) => {
    expect(eastFremantleCanHandle(suburb)).toBe(true);
  });

  it.each([
    'fremantle',
    'palmyra',
    'bicton',
    '',
  ])('rejects "%s"', (suburb) => {
    expect(eastFremantleCanHandle(suburb)).toBe(false);
  });
});
