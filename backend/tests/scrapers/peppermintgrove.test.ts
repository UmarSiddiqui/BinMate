/**
 * Shire of Peppermint Grove scraper tests.
 *
 * Mocks Nominatim geocoding. No production calls.
 *
 * Verified address choice:
 *   1 Leake Street Peppermint Grove WA 6011
 *   Shire administration address inside the service area.
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

      if (query.includes('Leake Street') || query.includes('Peppermint Grove')) {
        return jsonRes([{
          lat: '-31.9993',
          lon: '115.7642',
          display_name: '1 Leake Street, Peppermint Grove, Western Australia, Australia',
          address: {
            suburb: 'Peppermint Grove',
            state: 'Western Australia',
            postcode: '6011',
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

    return originalFetch(input);
  };

  (globalThis as { fetch: typeof fetch }).fetch = mockFetch;
});

afterAll(() => {
  (globalThis as { fetch: typeof fetch }).fetch = originalFetch;
});

import { peppermintGroveScraper, peppermintGroveCanHandle } from '../../src/scrapers/peppermintgrove';

describe('peppermintGroveScraper.resolveAddress', () => {
  it('resolves a Peppermint Grove address to the fixed Friday zone', async () => {
    const result = await peppermintGroveScraper.resolveAddress('1 Leake Street Peppermint Grove WA 6011');
    expect(result.error).toBeUndefined();
    expect(result.zoneCode).toBe('PEP-FRI-B');
    expect(result.zoneName).toContain('Friday');
    expect(result.councilSlug).toBe('peppermintgrove');
  });

  it('rejects an address outside Peppermint Grove', async () => {
    const result = await peppermintGroveScraper.resolveAddress('1 Sandgate Street South Perth WA 6151');
    expect(result.zoneCode).toBe('');
    expect(result.error).toBeTruthy();
  });
});

describe('peppermintGroveScraper.fetchSchedule', () => {
  it('returns the fixed Peppermint Grove schedule', async () => {
    const schedule = await peppermintGroveScraper.fetchSchedule('PEP-FRI-B');
    expect(schedule.generalDay).toBe('friday');
    expect(schedule.generalFrequency).toBe('weekly');
    expect(schedule.recyclingDay).toBe('friday');
    expect(schedule.recyclingWeek).toBe('B');
    expect(schedule.greenWasteDay).toBe('friday');
    expect(schedule.greenWasteWeek).toBe('weekly');
  });

  it('throws for an unknown zone code', async () => {
    await expect(peppermintGroveScraper.fetchSchedule('PEP-MON-A')).rejects.toThrow(
      /Unknown Peppermint Grove zone code/,
    );
  });
});

describe('peppermintGroveScraper.healthCheck', () => {
  it('passes against the mocked shire address', async () => {
    const ok = await peppermintGroveScraper.healthCheck();
    expect(ok).toBe(true);
  });
});

describe('peppermintGroveCanHandle', () => {
  it.each([
    'peppermint grove',
    'Peppermint Grove',
    'PEPPERMINT GROVE',
  ])('accepts "%s"', (suburb) => {
    expect(peppermintGroveCanHandle(suburb)).toBe(true);
  });

  it.each([
    'claremont',
    'cottesloe',
    'mosman park',
    '',
  ])('rejects "%s"', (suburb) => {
    expect(peppermintGroveCanHandle(suburb)).toBe(false);
  });
});
