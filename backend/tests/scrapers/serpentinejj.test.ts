/**
 * Shire of Serpentine-Jarrahdale scraper tests.
 *
 * Mocks SJ IntraMaps integration API endpoints:
 * - address search form
 * - details form by mapkey/dbkey
 */

const SJJ_BASE = 'https://maps.sjshire.wa.gov.au/IntraMaps22B/ApplicationEngine/integration/api/search/';

function jsonRes(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function searchRow(mapKey: string, dbKey: string, address: string): unknown {
  return [
    { name: 'mapkey', caption: 'mapkey', value: mapKey },
    { name: 'dbkey', caption: 'dbkey', value: dbKey },
    { name: 'Address', caption: 'Address', value: address },
  ];
}

function detailsRow(day: string, week: string, recycleDay: string): unknown {
  return [
    { name: 'WasteCollectionDay', caption: 'WasteCollectionDay', value: day },
    { name: 'RecycleCollectionWeek', caption: 'RecycleCollectionWeek', value: week },
    { name: 'RecycleDay', caption: 'RecycleDay', value: recycleDay },
  ];
}

const originalFetch = globalThis.fetch;

beforeAll(() => {
  const mockFetch: typeof fetch = async (input) => {
    const rawUrl = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : (input as Request).url;

    if (!rawUrl.startsWith(SJJ_BASE)) return originalFetch(input);

    const url = new URL(rawUrl);
    const form = url.searchParams.get('form') ?? '';
    const fields = url.searchParams.get('fields') ?? '';

    // Search form
    if (form === 'de2aecaf-1e4d-4d25-8146-b0f0109aa458') {
      if (fields === '18 Mead Street BYFORD WA 6122') return jsonRes([]);
      if (fields.includes('Mead Street')) {
        return jsonRes([searchRow('11398', 'A271200', '18 Mead Street BYFORD WA 6122')]);
      }

      if (fields === '6 Paterson Street MUNDIJONG WA 6123') return jsonRes([]);
      if (fields.includes('Paterson Street')) {
        return jsonRes([searchRow('2689', 'A178400', '6 Paterson Street MUNDIJONG WA 6123')]);
      }

      if (fields === '404 Broken Street PARMELIA WA 6167') {
        return jsonRes([searchRow('9999', 'A999999', '404 Broken Street PARMELIA WA 6167')]);
      }

      return jsonRes([]);
    }

    // Details form
    if (form === 'a51626b7-3892-44f4-9fba-b0264486bda5') {
      if (fields === '11398,A271200') return jsonRes([detailsRow('Tuesday', 'Week 2', 'Tuesday Next Week')]);
      if (fields === '2689,A178400') return jsonRes([detailsRow('Thursday', 'Week 2', 'Thursday Next Week')]);
      if (fields === '9999,A999999') return jsonRes([detailsRow('N/A', 'N/A', 'N/A')]);
      return jsonRes([[]]);
    }

    return jsonRes({ error: 'Unhandled mock URL' }, 404);
  };

  (globalThis as { fetch: typeof fetch }).fetch = mockFetch;
});

afterAll(() => {
  (globalThis as { fetch: typeof fetch }).fetch = originalFetch;
});

import { serpentineJJCanHandle, serpentineJJScraper } from '../../src/scrapers/serpentinejj';

describe('SerpentineJJScraper', () => {
  describe('resolveAddress', () => {
    it('resolves Byford address to SJJ-TUE-B via fallback street search', async () => {
      const result = await serpentineJJScraper.resolveAddress('18 Mead Street BYFORD WA 6122');
      expect(result.error).toBeUndefined();
      expect(result.zoneCode).toBe('SJJ-TUE-B');
      expect(result.councilSlug).toBe('serpentinejj');
    });

    it('resolves Mundijong address to SJJ-THU-B', async () => {
      const result = await serpentineJJScraper.resolveAddress('6 Paterson Street MUNDIJONG WA 6123');
      expect(result.error).toBeUndefined();
      expect(result.zoneCode).toBe('SJJ-THU-B');
    });

    it('returns unsupported when week/day fields are unusable', async () => {
      const result = await serpentineJJScraper.resolveAddress('404 Broken Street PARMELIA WA 6167');
      expect(result.zoneCode).toBe('');
      expect(result.error).toContain('unsupported');
    });

    it('returns not found when no candidates are returned', async () => {
      const result = await serpentineJJScraper.resolveAddress('999 Unknown Road Perth WA 6000');
      expect(result.zoneCode).toBe('');
      expect(result.error).toContain('not found');
    });
  });

  describe('fetchSchedule', () => {
    it('returns expected schedule for SJJ-TUE-B', async () => {
      const s = await serpentineJJScraper.fetchSchedule('SJJ-TUE-B');
      expect(s.generalDay).toBe('tuesday');
      expect(s.generalFrequency).toBe('weekly');
      expect(s.recyclingDay).toBe('tuesday');
      expect(s.recyclingWeek).toBe('B');
      expect(s.greenWasteDay).toBeNull();
      expect(s.greenWasteWeek).toBeNull();
    });

    it('throws for unknown zone code', async () => {
      await expect(serpentineJJScraper.fetchSchedule('SJJ-SAT-A')).rejects.toThrow(
        'Unknown Serpentine-Jarrahdale zone code',
      );
    });
  });

  describe('healthCheck', () => {
    it('passes with mocked SJ payloads', async () => {
      const ok = await serpentineJJScraper.healthCheck();
      expect(ok).toBe(true);
    });
  });
});

describe('serpentineJJCanHandle', () => {
  it.each(['Byford', 'serpentine', 'MUNDIJONG', 'Jarrahdale'])('accepts "%s"', (suburb) => {
    expect(serpentineJJCanHandle(suburb)).toBe(true);
  });

  it.each(['armadale', 'kwinana', 'fremantle', ''])('rejects "%s"', (suburb) => {
    expect(serpentineJJCanHandle(suburb)).toBe(false);
  });
});
