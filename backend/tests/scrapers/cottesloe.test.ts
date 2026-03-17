/**
 * Town of Cottesloe scraper tests.
 *
 * Mocks Nominatim geocoding. No production calls.
 *
 * Verified address choices (real Perth streets used for deterministic mocks):
 * - 109 Broome Street, Cottesloe WA 6011 (coastal side)
 * - 24 Grant Street, Cottesloe WA 6011 (north band)
 * - 18 Eric Street, Cottesloe WA 6011 (mid-north band)
 * - 12 Napier Street, Cottesloe WA 6011 (mid-south band)
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

      if (query.includes('Broome Street')) {
        return jsonRes([{
          lat: '-31.9930',
          lon: '115.7595',
          display_name: '109 Broome Street, Cottesloe, Western Australia, Australia',
          address: { suburb: 'Cottesloe', state: 'Western Australia', postcode: '6011' },
        }]);
      }

      if (query.includes('Grant Street')) {
        return jsonRes([{
          lat: '-31.9860',
          lon: '115.7655',
          display_name: '24 Grant Street, Cottesloe, Western Australia, Australia',
          address: { suburb: 'Cottesloe', state: 'Western Australia', postcode: '6011' },
        }]);
      }

      if (query.includes('Eric Street')) {
        return jsonRes([{
          lat: '-31.9892',
          lon: '115.7655',
          display_name: '18 Eric Street, Cottesloe, Western Australia, Australia',
          address: { suburb: 'Cottesloe', state: 'Western Australia', postcode: '6011' },
        }]);
      }

      if (query.includes('Napier Street')) {
        return jsonRes([{
          lat: '-31.9920',
          lon: '115.7655',
          display_name: '12 Napier Street, Cottesloe, Western Australia, Australia',
          address: { suburb: 'Cottesloe', state: 'Western Australia', postcode: '6011' },
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

import { cottesloeCanHandle, cottesloeScraper } from '../../src/scrapers/cottesloe';

describe('cottesloeScraper.resolveAddress', () => {
  it('resolves a coastal address to Monday Week-A zone', async () => {
    const result = await cottesloeScraper.resolveAddress('109 Broome Street Cottesloe WA 6011');
    expect(result.error).toBeUndefined();
    expect(result.zoneCode).toBe('COT-MON-A');
    expect(result.zoneName).toContain('Monday');
    expect(result.councilSlug).toBe('cottesloe');
  });

  it('resolves a north-band address to Tuesday zone', async () => {
    const result = await cottesloeScraper.resolveAddress('24 Grant Street Cottesloe WA 6011');
    expect(result.error).toBeUndefined();
    expect(result.zoneCode).toBe('COT-TUE-A');
  });

  it('resolves an Eric Street band address to Thursday zone', async () => {
    const result = await cottesloeScraper.resolveAddress('18 Eric Street Cottesloe WA 6011');
    expect(result.error).toBeUndefined();
    expect(result.zoneCode).toBe('COT-THU-A');
  });

  it('resolves a Napier Street band address to Friday zone', async () => {
    const result = await cottesloeScraper.resolveAddress('12 Napier Street Cottesloe WA 6011');
    expect(result.error).toBeUndefined();
    expect(result.zoneCode).toBe('COT-FRI-A');
  });

  it('rejects an address outside Cottesloe service area', async () => {
    const result = await cottesloeScraper.resolveAddress('1 Sandgate Street South Perth WA 6151');
    expect(result.zoneCode).toBe('');
    expect(result.error).toBeTruthy();
  });
});

describe('cottesloeScraper.fetchSchedule', () => {
  it('returns weekly FOGO + alternating recycling/general schedule', async () => {
    const schedule = await cottesloeScraper.fetchSchedule('COT-WED-A');
    expect(schedule.generalDay).toBe('wednesday');
    expect(schedule.generalFrequency).toBe('weekly');
    expect(schedule.recyclingDay).toBe('wednesday');
    expect(schedule.recyclingWeek).toBe('A');
    expect(schedule.greenWasteDay).toBe('wednesday');
    expect(schedule.greenWasteWeek).toBe('B');
  });

  it('throws for an unknown zone code', async () => {
    await expect(cottesloeScraper.fetchSchedule('COT-SAT-A')).rejects.toThrow(
      /Unknown Cottesloe zone code/,
    );
  });
});

describe('cottesloeScraper.healthCheck', () => {
  it('passes using the mocked Cottesloe civic address', async () => {
    const ok = await cottesloeScraper.healthCheck();
    expect(ok).toBe(true);
  });
});

describe('cottesloeCanHandle', () => {
  it.each([
    'cottesloe',
    'swanbourne',
    'COTTESLOE',
  ])('accepts "%s"', (suburb) => {
    expect(cottesloeCanHandle(suburb)).toBe(true);
  });

  it.each([
    'peppermint grove',
    'mosman park',
    'claremont',
    '',
  ])('rejects "%s"', (suburb) => {
    expect(cottesloeCanHandle(suburb)).toBe(false);
  });
});
