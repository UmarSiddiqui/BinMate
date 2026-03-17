/**
 * City of Gosnells scraper tests.
 *
 * Mocked against live endpoint flow:
 *   - POST /API/waste/v8/address
 *   - GET  /API/waste/v8/propertyNum/{propertyNo}
 *
 * Test addresses chosen from live API responses (verified 2026-03-17):
 *   - 1 Adams Road, Thornlie WA 6108       → GOS-WED-A
 *   - 41 Wheatley Street, Gosnells WA 6110 → GOS-MON-B
 *
 * No production API calls are made in tests.
 */

const GOS_BASE = 'https://t1.gosnells.wa.gov.au/API/waste/v8';

function jsonRes(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function addressRow(address: string, propertyNo: string): unknown {
  return { Address: address, property_no: propertyNo };
}

function propertyRow(rubbishDay: string, recycling: string | null): unknown {
  return {
    rubbish_day: rubbishDay,
    recycling,
    green_waste1: null,
    green_waste2: null,
    general_junk: null,
  };
}

const originalFetch = globalThis.fetch;

beforeAll(() => {
  const mockFetch: typeof fetch = async (input, init) => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : (input as Request).url;

    if (!url.startsWith(GOS_BASE)) return originalFetch(input, init);

    if (url.endsWith('/address')) {
      const body = JSON.parse((init?.body as string) ?? '{}') as { query?: string };
      const query = (body.query ?? '').trim();

      if (query === '1 Adams Road, Thornlie WA 6108' || query === '1 Adams Road') {
        return jsonRes({
          results: [
            addressRow('1 Adams Road THORNLIE 6108', '226539'),
          ],
        });
      }

      if (query === '41 Wheatley Street, Gosnells WA 6110' || query === '41 Wheatley Street') {
        return jsonRes({
          results: [
            addressRow('41 Wheatley Street GOSNELLS 6110', '208566'),
          ],
        });
      }

      if (query === '1 Queen Street, Fremantle WA 6160') {
        // Real API can return nearest Gosnells match for out-of-area addresses.
        return jsonRes({
          results: [
            addressRow('11 Queen Street GOSNELLS 6110', '208999'),
          ],
        });
      }

      if (query === 'Kenwick Link, Beckenham WA 6107') {
        return jsonRes({
          results: [
            addressRow('Kenwick Link BECKENHAM 6107', '305516'),
          ],
        });
      }

      return jsonRes({ results: [] });
    }

    if (url.endsWith('/propertyNum/226539')) {
      return jsonRes({ results: [propertyRow('WEDNESDAY', '2026-03-18')] });
    }

    if (url.endsWith('/propertyNum/208566')) {
      return jsonRes({ results: [propertyRow('MONDAY', '2026-03-23')] });
    }

    if (url.endsWith('/propertyNum/208999')) {
      return jsonRes({ results: [propertyRow('TUESDAY', '2026-03-24')] });
    }

    if (url.endsWith('/propertyNum/305516')) {
      return jsonRes({ results: [propertyRow('WEDNESDAY', null)] });
    }

    return jsonRes({ error: 'Unhandled mock URL' }, 404);
  };

  (globalThis as { fetch: typeof fetch }).fetch = mockFetch;
});

afterAll(() => {
  (globalThis as { fetch: typeof fetch }).fetch = originalFetch;
});

import { gosnellsScraper, gosnellsCanHandle } from '../../src/scrapers/gosnells';

describe('GosnellsScraper', () => {
  describe('resolveAddress', () => {
    it('resolves Adams Road to GOS-WED-A', async () => {
      const result = await gosnellsScraper.resolveAddress('1 Adams Road, Thornlie WA 6108');
      expect(result.error).toBeUndefined();
      expect(result.zoneCode).toBe('GOS-WED-A');
      expect(result.councilSlug).toBe('gosnells');
    });

    it('resolves Wheatley Street to GOS-MON-B', async () => {
      const result = await gosnellsScraper.resolveAddress('41 Wheatley Street, Gosnells WA 6110');
      expect(result.error).toBeUndefined();
      expect(result.zoneCode).toBe('GOS-MON-B');
      expect(result.zoneName).toContain('Monday');
      expect(result.zoneName).toContain('Week B');
    });

    it('rejects nearest-match result when suburb does not match input', async () => {
      const result = await gosnellsScraper.resolveAddress('1 Queen Street, Fremantle WA 6160');
      expect(result.zoneCode).toBe('');
      expect(result.error).toContain('unsupported');
    });

    it('returns unsupported when recycling date is missing', async () => {
      const result = await gosnellsScraper.resolveAddress('Kenwick Link, Beckenham WA 6107');
      expect(result.zoneCode).toBe('');
      expect(result.error).toContain('unsupported');
    });
  });

  describe('fetchSchedule', () => {
    it('returns weekly general and fortnightly recycling for GOS-WED-A', async () => {
      const s = await gosnellsScraper.fetchSchedule('GOS-WED-A');
      expect(s.generalDay).toBe('wednesday');
      expect(s.generalFrequency).toBe('weekly');
      expect(s.recyclingDay).toBe('wednesday');
      expect(s.recyclingWeek).toBe('A');
      expect(s.greenWasteDay).toBeNull();
      expect(s.greenWasteWeek).toBeNull();
    });

    it('returns correct week for GOS-MON-B', async () => {
      const s = await gosnellsScraper.fetchSchedule('GOS-MON-B');
      expect(s.generalDay).toBe('monday');
      expect(s.recyclingWeek).toBe('B');
    });

    it('throws for unknown zone code', async () => {
      await expect(gosnellsScraper.fetchSchedule('GOS-SAT-A')).rejects.toThrow('Unknown Gosnells zone code');
    });
  });

  describe('gosnellsCanHandle', () => {
    it('returns true for Gosnells suburbs', () => {
      expect(gosnellsCanHandle('Gosnells')).toBe(true);
      expect(gosnellsCanHandle('thornlie')).toBe(true);
      expect(gosnellsCanHandle('HUNTINGDALE')).toBe(true);
      expect(gosnellsCanHandle('beckenham')).toBe(true);
    });

    it('returns false for non-Gosnells suburbs', () => {
      expect(gosnellsCanHandle('fremantle')).toBe(false);
      expect(gosnellsCanHandle('scarborough')).toBe(false);
      expect(gosnellsCanHandle('midland')).toBe(false);
    });
  });

  describe('healthCheck', () => {
    it('passes with mocked Gosnells payloads', async () => {
      const ok = await gosnellsScraper.healthCheck();
      expect(ok).toBe(true);
    });
  });
});
