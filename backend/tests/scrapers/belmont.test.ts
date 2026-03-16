/**
 * City of Belmont scraper tests.
 *
 * Mocked against live endpoint shapes:
 *   - GET /api/intramaps/getaddresses?key={address}
 *   - GET /api/intramaps/getpropertydetailsbymapdbkey?mapkey={mapkey}&dbkey={dbkey}
 *
 * No production API calls are made in tests.
 */

const BELMONT_BASE = 'https://www.belmont.wa.gov.au';

function jsonRes(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const originalFetch = globalThis.fetch;

beforeAll(() => {
  const mockFetch: typeof fetch = async (input) => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : (input as Request).url;

    const parsed = new URL(url);

    if (parsed.pathname === '/api/intramaps/getaddresses') {
      const key = (parsed.searchParams.get('key') ?? '').toLowerCase();

      if (key.includes('keady')) {
        return jsonRes([{ mapkey: 161217, dbkey: 184618, Address: '1B Keady Street BELMONT 6104' }]);
      }

      if (key.includes('fulham')) {
        return jsonRes([
          { mapkey: 999999, dbkey: 888888, Address: '1 Fulham Street KEWDALE 6105' },
          { mapkey: 168705, dbkey: 181575, Address: '4 Fulham Street KEWDALE 6105' },
        ]);
      }

      if (key.includes('fisher')) {
        return jsonRes([{ mapkey: 161115, dbkey: 189495, Address: '7 Fisher Street BELMONT 6104' }]);
      }

      if (key.includes('eyre')) {
        return jsonRes([{ mapkey: 159403, dbkey: 193692, Address: '1 Eyre Street RIVERVALE 6103' }]);
      }

      return jsonRes([]);
    }

    if (parsed.pathname === '/api/intramaps/getpropertydetailsbymapdbkey') {
      const mapkey = parsed.searchParams.get('mapkey');
      const dbkey = parsed.searchParams.get('dbkey');

      if (mapkey === '999999' && dbkey === '888888') {
        return jsonRes({
          Address: '1 Fulham Street KEWDALE 6105',
          BinDayGeneralWasteFormatted: '0001-01-01T00:00:00',
          BinDayRecyclingFormatted: '0001-01-01T00:00:00',
          BinDayFOGOFormatted: '0001-01-01T00:00:00',
        });
      }

      if (mapkey === '168705' && dbkey === '181575') {
        return jsonRes({
          Address: '4 Fulham Street KEWDALE 6105',
          BinDayGeneralWasteFormatted: '2026-03-17T00:00:00',
          BinDayRecyclingFormatted: '2026-03-10T00:00:00',
          BinDayFOGOFormatted: '2026-03-10T00:00:00',
        });
      }

      if (mapkey === '161217' && dbkey === '184618') {
        return jsonRes({
          Address: '1B Keady Street BELMONT 6104',
          BinDayGeneralWasteFormatted: '2026-03-12T00:00:00',
          BinDayRecyclingFormatted: '2026-03-19T00:00:00',
          BinDayFOGOFormatted: '2026-03-12T00:00:00',
        });
      }

      if (mapkey === '161115' && dbkey === '189495') {
        return jsonRes({
          Address: '7 Fisher Street BELMONT 6104',
          BinDayGeneralWasteFormatted: '2026-03-12T00:00:00',
          BinDayRecyclingFormatted: '2026-03-12T00:00:00',
          BinDayFOGOFormatted: '0001-01-01T00:00:00',
        });
      }

      if (mapkey === '159403' && dbkey === '193692') {
        return jsonRes({
          Address: '1 Eyre Street RIVERVALE 6103',
          BinDayGeneralWasteFormatted: '0001-01-01T00:00:00',
          BinDayRecyclingFormatted: '0001-01-01T00:00:00',
          BinDayFOGOFormatted: '0001-01-01T00:00:00',
        });
      }

      return jsonRes({ error: 'not found' }, 404);
    }

    return originalFetch(input);
  };

  (globalThis as { fetch: typeof fetch }).fetch = mockFetch;
});

afterAll(() => {
  (globalThis as { fetch: typeof fetch }).fetch = originalFetch;
});

import { belmontScraper, belmontCanHandle } from '../../src/scrapers/belmont';

describe('BelmontScraper', () => {
  describe('resolveAddress', () => {
    it('resolves Keady to a FOGO opposite-week zone', async () => {
      const result = await belmontScraper.resolveAddress('1B Keady Street, Belmont WA 6104');
      expect(result.error).toBeUndefined();
      expect(result.zoneCode).toBe('BEL-FOGO-THU-A-O');
      expect(result.councilSlug).toBe('belmont');
    });

    it('skips unsupported candidate and resolves Fulham to same-week FOGO zone', async () => {
      const result = await belmontScraper.resolveAddress('4 Fulham Street, Kewdale WA 6105');
      expect(result.error).toBeUndefined();
      expect(result.zoneCode).toBe('BEL-FOGO-TUE-B-S');
    });

    it('resolves non-FOGO property to standard zone', async () => {
      const result = await belmontScraper.resolveAddress('7 Fisher Street, Belmont WA 6104');
      expect(result.error).toBeUndefined();
      expect(result.zoneCode).toBe('BEL-STD-THU-B');
    });

    it('returns error when property has no service data', async () => {
      const result = await belmontScraper.resolveAddress('1 Eyre Street, Rivervale WA 6103');
      expect(result.zoneCode).toBe('');
      expect(result.error).toBeDefined();
    });
  });

  describe('fetchSchedule', () => {
    it('returns same-week FOGO schedule for BEL-FOGO-TUE-B-S', async () => {
      const s = await belmontScraper.fetchSchedule('BEL-FOGO-TUE-B-S');
      expect(s.generalDay).toBe('tuesday');
      expect(s.recyclingWeek).toBe('B');
      expect(s.greenWasteWeek).toBe('B');
    });

    it('returns opposite-week FOGO schedule for BEL-FOGO-THU-A-O', async () => {
      const s = await belmontScraper.fetchSchedule('BEL-FOGO-THU-A-O');
      expect(s.generalDay).toBe('thursday');
      expect(s.recyclingWeek).toBe('A');
      expect(s.greenWasteWeek).toBe('B');
    });

    it('returns standard schedule with no green waste for BEL-STD-THU-B', async () => {
      const s = await belmontScraper.fetchSchedule('BEL-STD-THU-B');
      expect(s.generalDay).toBe('thursday');
      expect(s.recyclingWeek).toBe('B');
      expect(s.greenWasteDay).toBeNull();
      expect(s.greenWasteWeek).toBeNull();
    });

    it('throws for unknown zone code', async () => {
      await expect(belmontScraper.fetchSchedule('BEL-THU-A')).rejects.toThrow('Unknown Belmont zone code');
    });
  });

  describe('belmontCanHandle', () => {
    it('returns true for Belmont suburbs', () => {
      expect(belmontCanHandle('Belmont')).toBe(true);
      expect(belmontCanHandle('kewdale')).toBe(true);
      expect(belmontCanHandle('RIVERVALE')).toBe(true);
    });

    it('returns false for non-Belmont suburbs', () => {
      expect(belmontCanHandle('fremantle')).toBe(false);
      expect(belmontCanHandle('joondalup')).toBe(false);
      expect(belmontCanHandle('midland')).toBe(false);
    });
  });

  describe('healthCheck', () => {
    it('passes with mocked Belmont API payloads', async () => {
      const ok = await belmontScraper.healthCheck();
      expect(ok).toBe(true);
    });
  });
});

