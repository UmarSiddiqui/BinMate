/**
 * City of Cockburn scraper tests.
 *
 * Mocks Cockburn's widget JSONP endpoints. No production calls.
 * Run with: npm test -- tests/scrapers/cockburn.test.ts
 */

const COCKBURN_API_BASE = 'https://gis1.cockburn.wa.gov.au/webapiv2';

function jsonp(callbackName: string, data: unknown): string {
  return `/**/ typeof ${callbackName} === 'function' && ${callbackName}(${JSON.stringify(data)});`;
}

const originalFetch = globalThis.fetch;
beforeAll(() => {
  const mockFetch: typeof fetch = async (input) => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : (input as { url: string }).url;

    if (url.startsWith(`${COCKBURN_API_BASE}/LikeSearch`)) {
      const parsed = new URL(url);
      const callbackName = parsed.searchParams.get('callback') ?? 'cb';
      const q = (parsed.searchParams.get('q') ?? '').toLowerCase();

      if (q.includes('155l beeliar drive yangebup wa 6164')) {
        return new Response(
          jsonp(callbackName, [{
            name: '155L Beeliar Drive Yangebup WA 6164',
            dbkey: '6025514',
          }]),
          { status: 200 }
        );
      }

      if (q.includes('108 wattleup road wattleup wa 6166')) {
        return new Response(
          jsonp(callbackName, [{
            name: '108 Wattleup Road Wattleup WA 6166',
            dbkey: '3411940',
          }]),
          { status: 200 }
        );
      }

      if (q.includes('1 paradise grove atwell wa 6164')) {
        return new Response(jsonp(callbackName, []), { status: 200 });
      }

      if (q.includes('1 queen st fremantle wa 6160')) {
        return new Response(jsonp(callbackName, []), { status: 200 });
      }
    }

    if (url.startsWith(`${COCKBURN_API_BASE}/FuzzySearch/`)) {
      const parsed = new URL(url);
      const callbackName = parsed.searchParams.get('callback') ?? 'cb';
      const q = (parsed.searchParams.get('q') ?? '').toLowerCase();

      if (q.includes('1 paradise grove')) {
        return new Response(
          jsonp(callbackName, [{
            name: '1 Paradise Grove Atwell WA 6164',
            dbkey: '5517530',
          }]),
          { status: 200 }
        );
      }

      return new Response(jsonp(callbackName, []), { status: 200 });
    }

    if (url.startsWith(`${COCKBURN_API_BASE}/PropertyInfoSearch/PropertyNo`)) {
      const parsed = new URL(url);
      const callbackName = parsed.searchParams.get('callback') ?? 'cb';
      const q = parsed.searchParams.get('q') ?? '';

      if (q === '6025514') {
        return new Response(
          jsonp(callbackName, [{
            Address: '155L Beeliar Drive YANGEBUP WA 6164',
            PropertyNo: 6025514,
            Suburb: 'Yangebup',
            BinDay: 'Tuesday',
            Area: 7,
            JunkWhite1: '25-Aug-2025',
            GreenWaste1: '24-Nov-2025',
            JunkWhite2: '9-Mar-2026',
            GreenWaste2: '15-Jun-2026',
            GardenWaste: 'Tuesday Fortnightly (24-Mar-2026) (if applicable)',
          }]),
          { status: 200 }
        );
      }

      if (q === '5517530') {
        return new Response(
          jsonp(callbackName, [{
            Address: '1 Paradise Grove ATWELL WA 6164',
            PropertyNo: 5517530,
            Suburb: 'Atwell',
            BinDay: 'Friday',
            Area: 10,
            JunkWhite1: '22-Sep-2025',
            GreenWaste1: '15-Dec-2025',
            JunkWhite2: '13-Apr-2026',
            GreenWaste2: '6-Jul-2026',
            GardenWaste: 'Friday Fortnightly (20-Mar-2026) (if applicable)',
          }]),
          { status: 200 }
        );
      }

      if (q === '3411940') {
        return new Response(
          jsonp(callbackName, [{
            Address: '108 Wattleup Road WATTLEUP WA 6166',
            PropertyNo: 3411940,
            Suburb: 'Wattleup',
            BinDay: 'Thursday',
            Area: 11,
            JunkWhite1: '29-Sep-2025',
            GreenWaste1: '',
            JunkWhite2: '27-Apr-2026',
            GreenWaste2: '',
            GardenWaste: null,
          }]),
          { status: 200 }
        );
      }
    }

    return originalFetch(input);
  };

  (globalThis as { fetch: typeof fetch }).fetch = mockFetch;
});

afterAll(() => {
  (globalThis as { fetch: typeof fetch }).fetch = originalFetch;
});

import { COCKBURN_AREA_VERGE_DATES, cockburnCanHandle, cockburnScraper } from '../../src/scrapers/cockburn';

describe('CockburnScraper', () => {

  describe('resolveAddress', () => {

    it('resolves 155L Beeliar Drive → COC-TUE-B-7', async () => {
      const result = await cockburnScraper.resolveAddress('155L Beeliar Drive, Yangebup WA 6164');
      expect(result.error).toBeUndefined();
      expect(result.zoneCode).toBe('COC-TUE-B-7');
      expect(result.zoneName).toContain('Tuesday');
      expect(result.zoneName).toContain('Area 7');
      expect(result.councilSlug).toBe('cockburn');
    });

    it('falls back to FuzzySearch when LikeSearch returns no exact hit', async () => {
      const result = await cockburnScraper.resolveAddress('1 Paradise Grove, Atwell WA 6164');
      expect(result.error).toBeUndefined();
      expect(result.zoneCode).toBe('COC-FRI-A-10');
      expect(result.zoneName).toContain('Week A');
      expect(result.zoneName).toContain('Area 10');
    });

    it('handles properties with no garden organics service', async () => {
      const result = await cockburnScraper.resolveAddress('108 Wattleup Road, Wattleup WA 6166');
      expect(result.error).toBeUndefined();
      expect(result.zoneCode).toBe('COC-THU-N-11');
      expect(result.zoneName).toContain('No Garden Organics');
    });

    it('returns error for an address outside Cockburn', async () => {
      const result = await cockburnScraper.resolveAddress('1 Queen St, Fremantle WA 6160');
      expect(result.error).toBeDefined();
      expect(result.zoneCode).toBe('');
    });

  });

  describe('fetchSchedule', () => {

    it('returns weekly general + weekly recycling + fortnightly garden for COC-TUE-B-7', async () => {
      const s = await cockburnScraper.fetchSchedule('COC-TUE-B-7');
      expect(s.generalDay).toBe('tuesday');
      expect(s.generalFrequency).toBe('weekly');
      expect(s.recyclingDay).toBe('tuesday');
      expect(s.recyclingWeek).toBe('weekly');
      expect(s.greenWasteDay).toBe('tuesday');
      expect(s.greenWasteWeek).toBe('B');
      expect(s.vergeDates).toEqual(COCKBURN_AREA_VERGE_DATES[7]);
    });

    it('returns garden Week A for COC-FRI-A-10', async () => {
      const s = await cockburnScraper.fetchSchedule('COC-FRI-A-10');
      expect(s.generalDay).toBe('friday');
      expect(s.recyclingWeek).toBe('weekly');
      expect(s.greenWasteWeek).toBe('A');
      expect(s.vergeDates).toEqual(COCKBURN_AREA_VERGE_DATES[10]);
    });

    it('returns no garden service for COC-THU-N-11', async () => {
      const s = await cockburnScraper.fetchSchedule('COC-THU-N-11');
      expect(s.greenWasteDay).toBeNull();
      expect(s.greenWasteWeek).toBeNull();
      expect(s.vergeDates).toEqual(COCKBURN_AREA_VERGE_DATES[11]);
    });

    it('throws for an unknown zone code', async () => {
      await expect(cockburnScraper.fetchSchedule('INVALID')).rejects.toThrow('Unknown Cockburn zone code');
    });

    it('throws for an unknown verge area', async () => {
      await expect(cockburnScraper.fetchSchedule('COC-TUE-A-99')).rejects.toThrow('Unknown Cockburn area');
    });

  });

  describe('cockburnCanHandle', () => {

    it('returns true for Cockburn suburbs', () => {
      expect(cockburnCanHandle('cockburn central')).toBe(true);
      expect(cockburnCanHandle('Yangebup')).toBe(true);
      expect(cockburnCanHandle('Hamilton Hill')).toBe(true);
      expect(cockburnCanHandle('North Coogee')).toBe(true);
      expect(cockburnCanHandle('Wattleup')).toBe(true);
    });

    it('returns false for non-Cockburn suburbs', () => {
      expect(cockburnCanHandle('fremantle')).toBe(false);
      expect(cockburnCanHandle('clarkson')).toBe(false);
      expect(cockburnCanHandle('scarborough')).toBe(false);
    });

  });

  describe('healthCheck', () => {

    it('passes with mocked Cockburn API', async () => {
      const ok = await cockburnScraper.healthCheck();
      expect(ok).toBe(true);
    });

  });

});
