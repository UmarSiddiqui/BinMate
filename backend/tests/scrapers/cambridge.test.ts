/**
 * Town of Cambridge scraper tests.
 *
 * Mocks Cambridge's official myarea endpoints. No production calls.
 *
 * Verified live addresses (2026-03-16):
 *   10 Floreat Avenue FLOREAT WA 6014  → CAM-FOGO-WED-B
 *   40 Salvado Road WEMBLEY WA 6014    → CAM-STD-FRI-A
 */

const BASE_URL = 'https://www.cambridge.wa.gov.au';

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

    const parsed = new URL(url);

    if (url.startsWith(`${BASE_URL}/api/v1/myarea/searchfuzzy`)) {
      const keywords = parsed.searchParams.get('keywords') ?? '';

      if (keywords.includes('10 Floreat Avenue')) {
        return jsonRes({
          Items: [{ Id: 'geo-fogo', AddressSingleLine: '10 Floreat Avenue FLOREAT 6014' }],
        });
      }

      if (keywords.includes('40 Salvado Road')) {
        return jsonRes({
          Items: [{ Id: 'geo-std', AddressSingleLine: '40 Salvado Road WEMBLEY 6014' }],
        });
      }

      if (keywords.includes('South Perth')) {
        return jsonRes({
          Items: [{ Id: 'geo-wrong', AddressSingleLine: '9 South Banff Road FLOREAT 6014' }],
        });
      }

      return jsonRes({ Items: [] });
    }

    if (url.startsWith(`${BASE_URL}/ocapi/Public/myarea/wasteservices`)) {
      const geolocationId = parsed.searchParams.get('geolocationid');

      if (geolocationId === 'geo-fogo') {
        return jsonRes({
          success: true,
          responseContent: `
            <div class="col-xs-12 col-m-6 waste-services-result regular-service general-waste date-precise item-0">
              <article><h3>General Waste</h3><div class="next-service">Wed 18/3/2026</div></article>
            </div>
            <div class="col-xs-12 col-m-6 waste-services-result regular-service recycling date-precise item-1">
              <article><h3>Recycling</h3><div class="next-service">Wed 25/3/2026</div></article>
            </div>
            <div class="col-xs-12 col-m-6 waste-services-result regular-service green-waste date-precise item-2">
              <article><h3>FOGO</h3><div class="next-service">Wed 18/3/2026</div></article>
            </div>
          `,
        });
      }

      if (geolocationId === 'geo-std') {
        return jsonRes({
          success: true,
          responseContent: `
            <div class="col-xs-12 col-m-6 waste-services-result regular-service general-waste date-precise item-0">
              <article><h3>General Waste</h3><div class="next-service">Fri 20/3/2026</div></article>
            </div>
            <div class="col-xs-12 col-m-6 waste-services-result regular-service general-waste date-precise item-1">
              <article><h3>General Waste</h3><div class="next-service">Fri 27/3/2026</div></article>
            </div>
            <div class="col-xs-12 col-m-6 waste-services-result regular-service green-waste date-precise item-2">
              <article><h3>Green Waste</h3><div class="next-service">Fri 27/3/2026</div></article>
            </div>
            <div class="col-xs-12 col-m-6 waste-services-result regular-service recycling date-precise item-3">
              <article><h3>Recycling</h3><div class="next-service">Fri 20/3/2026</div></article>
            </div>
          `,
        });
      }
    }

    return originalFetch(input);
  };

  (globalThis as { fetch: typeof fetch }).fetch = mockFetch;
});

afterAll(() => {
  (globalThis as { fetch: typeof fetch }).fetch = originalFetch;
});

import { cambridgeScraper, cambridgeCanHandle } from '../../src/scrapers/cambridge';

describe('cambridgeScraper.resolveAddress', () => {
  it('resolves a FOGO address to a CAM-FOGO zone', async () => {
    const result = await cambridgeScraper.resolveAddress('10 Floreat Avenue FLOREAT WA 6014');
    expect(result.error).toBeUndefined();
    expect(result.zoneCode).toBe('CAM-FOGO-WED-B');
    expect(result.zoneName).toContain('FOGO');
    expect(result.councilSlug).toBe('cambridge');
  });

  it('resolves a non-FOGO address to a CAM-STD zone', async () => {
    const result = await cambridgeScraper.resolveAddress('40 Salvado Road WEMBLEY WA 6014');
    expect(result.error).toBeUndefined();
    expect(result.zoneCode).toBe('CAM-STD-FRI-A');
    expect(result.zoneName).toContain('standard');
  });

  it('rejects a fuzzy result that does not match the requested suburb/number', async () => {
    const result = await cambridgeScraper.resolveAddress('1 Sandgate Street SOUTH PERTH WA 6151');
    expect(result.zoneCode).toBe('');
    expect(result.error).toBeTruthy();
  });
});

describe('cambridgeScraper.fetchSchedule', () => {
  it('returns the FOGO schedule for CAM-FOGO-WED-B', async () => {
    const schedule = await cambridgeScraper.fetchSchedule('CAM-FOGO-WED-B');
    expect(schedule.generalDay).toBe('wednesday');
    expect(schedule.generalFrequency).toBe('weekly');
    expect(schedule.recyclingWeek).toBe('B');
    expect(schedule.greenWasteWeek).toBe('A');
  });

  it('returns the standard schedule for CAM-STD-FRI-A', async () => {
    const schedule = await cambridgeScraper.fetchSchedule('CAM-STD-FRI-A');
    expect(schedule.generalDay).toBe('friday');
    expect(schedule.generalFrequency).toBe('weekly');
    expect(schedule.recyclingWeek).toBe('A');
    expect(schedule.greenWasteWeek).toBe('B');
  });

  it('throws for an unknown zone code', async () => {
    await expect(cambridgeScraper.fetchSchedule('CAM-WED-A')).rejects.toThrow(
      /Unknown Cambridge zone code/,
    );
  });
});

describe('cambridgeScraper.healthCheck', () => {
  it('passes using the verified Cambridge FOGO address', async () => {
    const ok = await cambridgeScraper.healthCheck();
    expect(ok).toBe(true);
  });
});

describe('cambridgeCanHandle', () => {
  it.each([
    'floreat',
    'wembley',
    'wembley downs',
    'city beach',
    'west leederville',
    'churchlands',
  ])('accepts "%s"', (suburb) => {
    expect(cambridgeCanHandle(suburb)).toBe(true);
  });

  it.each([
    'subiaco',
    'nedlands',
    'south perth',
    'fremantle',
    '',
  ])('rejects "%s"', (suburb) => {
    expect(cambridgeCanHandle(suburb)).toBe(false);
  });
});
