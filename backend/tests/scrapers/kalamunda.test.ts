/**
 * City of Kalamunda scraper tests.
 *
 * Mocked against live endpoint flow:
 *   - POST /Projects/?configId=...&appType=MapBuilder&project=...
 *   - POST /Modules/?IntraMapsSession=...
 *   - POST /Search/?form=4b6f3086-3336-4ccc-a061-4cc2c923aaff...
 *   - POST /Search/Refine/Set?IntraMapsSession=...
 *
 * Test addresses from Kalamunda live dataset (verified 2026-03-17):
 *   - 1 Amaroo Street, Lesmurdie WA 6076  (Area One, Friday)   → KAL-FRI-A
 *   - 1 Barron Road, Kalamunda WA 6076    (Area Two, Thursday) → KAL-THU-B
 *
 * No production API calls are made in tests.
 */

const KAL_BASE = 'https://kalamunda.spatial.t1cloud.com/spatial/intramaps/ApplicationEngine';

function jsonRes(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

function searchResult(mapKey: string, dbKey: string, displayValue: string): unknown {
  return {
    selectionLayer: 'e0b98472-c5bb-4ece-a7cf-e395f275d9d2',
    mapKey,
    dbKey,
    displayValue,
    infoFields: null,
  };
}

function refinePayload(binDay: string, binArea: string): unknown {
  return {
    infoPanels: {
      info1: {
        feature: {
          fields: [
            {
              caption: 'Bin Area',
              value: { value: binArea },
            },
            {
              caption: 'Bin Day',
              value: { value: binDay },
            },
            {
              caption: 'Is it Recycle Week?',
              links: [{ text: { value: binArea === 'Area One' ? 'Yes (View Calendar)' : 'No (View Calendar)' } }],
            },
          ],
        },
      },
    },
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

    if (!url.startsWith(KAL_BASE)) return originalFetch(input, init);

    if (url.includes('/Projects/?')) {
      return jsonRes(
        { id: '3599f26a-72ef-4ae6-99c2-7a335ecb31d8', moduleList: [{ id: '0423add9-3956-4ac9-9b41-3206c4d29358' }] },
        200,
        { 'x-intramaps-session': 'test-session' },
      );
    }

    if (url.includes('/Modules/?IntraMapsSession=')) {
      return jsonRes({ name: 'BinCollectionDay (website)_PUB' });
    }

    if (url.includes('/Search/?')) {
      const body = JSON.parse((init?.body as string) ?? '{}') as { fields?: string[] };
      const term = (body.fields?.[0] ?? '').trim();

      if (term === '1 Amaroo St') {
        return jsonRes({ header: { warning: null }, fullText: null });
      }

      if (term === '1 Amaroo Street') {
        return jsonRes({
          fullText: [
            searchResult('257892', '257892', '1 AMAROO STREET (Lot 1), LESMURDIE, 6076'),
          ],
        });
      }

      if (term === '1 Barron Road') {
        return jsonRes({
          fullText: [
            searchResult('300001', '300001', '1 BARRON ROAD (Lot 50), KALAMUNDA, 6076'),
          ],
        });
      }

      if (term === 'lesmurdie') {
        return jsonRes({
          fullText: [
            searchResult('257355', '257355', '1 ASHURST DRIVE (Lot 26), LESMURDIE, 6076'),
            searchResult('257892', '257892', '1 AMAROO STREET (Lot 1), LESMURDIE, 6076'),
          ],
        });
      }

      if (term === 'kalamunda') {
        return jsonRes({
          fullText: [
            searchResult('300001', '300001', '1 BARRON ROAD (Lot 50), KALAMUNDA, 6076'),
          ],
        });
      }

      return jsonRes({ header: { warning: null }, fullText: null });
    }

    if (url.includes('/Search/Refine/Set?')) {
      const body = JSON.parse((init?.body as string) ?? '{}') as { mapKey?: string };
      if (body.mapKey === '257892') return jsonRes(refinePayload('Friday', 'Area One'));
      if (body.mapKey === '257355') return jsonRes(refinePayload('Thursday', 'Area One'));
      if (body.mapKey === '300001') return jsonRes(refinePayload('Thursday', 'Area Two'));
      return jsonRes({ infoPanels: {} });
    }

    return jsonRes({ error: 'Unhandled mock URL' }, 404);
  };

  (globalThis as { fetch: typeof fetch }).fetch = mockFetch;
});

afterAll(() => {
  (globalThis as { fetch: typeof fetch }).fetch = originalFetch;
});

import { kalamundaScraper, kalamundaCanHandle } from '../../src/scrapers/kalamunda';

describe('KalamundaScraper', () => {
  describe('resolveAddress', () => {
    it('resolves a known Area One address to KAL-FRI-A', async () => {
      const result = await kalamundaScraper.resolveAddress('1 Amaroo Street, Lesmurdie WA 6076');
      expect(result.error).toBeUndefined();
      expect(result.zoneCode).toBe('KAL-FRI-A');
      expect(result.zoneName).toContain('Friday');
      expect(result.councilSlug).toBe('kalamunda');
    });

    it('falls back to suburb search and ranks candidates correctly', async () => {
      const result = await kalamundaScraper.resolveAddress('1 Amaroo St, Lesmurdie WA 6076');
      expect(result.error).toBeUndefined();
      expect(result.zoneCode).toBe('KAL-FRI-A');
    });

    it('resolves Area Two address to KAL-THU-B', async () => {
      const result = await kalamundaScraper.resolveAddress('1 Barron Road, Kalamunda WA 6076');
      expect(result.error).toBeUndefined();
      expect(result.zoneCode).toBe('KAL-THU-B');
      expect(result.zoneName).toContain('Week B');
    });

    it('returns not found for non-Kalamunda address', async () => {
      const result = await kalamundaScraper.resolveAddress('1 Queen Street, Fremantle WA 6160');
      expect(result.zoneCode).toBe('');
      expect(result.error).toContain('not found');
    });
  });

  describe('fetchSchedule', () => {
    it('returns weekly general + fortnightly recycling + weekly FOGO for KAL-FRI-A', async () => {
      const s = await kalamundaScraper.fetchSchedule('KAL-FRI-A');
      expect(s.generalDay).toBe('friday');
      expect(s.generalFrequency).toBe('weekly');
      expect(s.recyclingDay).toBe('friday');
      expect(s.recyclingWeek).toBe('A');
      expect(s.greenWasteDay).toBe('friday');
      expect(s.greenWasteWeek).toBe('weekly');
    });

    it('returns correct week for KAL-THU-B', async () => {
      const s = await kalamundaScraper.fetchSchedule('KAL-THU-B');
      expect(s.generalDay).toBe('thursday');
      expect(s.recyclingWeek).toBe('B');
      expect(s.greenWasteWeek).toBe('weekly');
    });

    it('throws for unknown zone code', async () => {
      await expect(kalamundaScraper.fetchSchedule('KAL-SAT-A')).rejects.toThrow('Unknown Kalamunda zone code');
    });
  });

  describe('kalamundaCanHandle', () => {
    it('returns true for Kalamunda suburbs', () => {
      expect(kalamundaCanHandle('kalamunda')).toBe(true);
      expect(kalamundaCanHandle('Lesmurdie')).toBe(true);
      expect(kalamundaCanHandle('HIGH WYCOMBE')).toBe(true);
      expect(kalamundaCanHandle('forrestfield')).toBe(true);
    });

    it('returns false for non-Kalamunda suburbs', () => {
      expect(kalamundaCanHandle('fremantle')).toBe(false);
      expect(kalamundaCanHandle('scarborough')).toBe(false);
      expect(kalamundaCanHandle('midland')).toBe(false);
    });
  });

  describe('healthCheck', () => {
    it('passes with mocked Kalamunda payloads', async () => {
      const ok = await kalamundaScraper.healthCheck();
      expect(ok).toBe(true);
    });
  });
});
