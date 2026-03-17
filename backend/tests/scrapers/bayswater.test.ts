/**
 * City of Bayswater scraper tests.
 *
 * Mocked against live T1Cloud endpoint shape:
 *   - POST /Projects/?configId=...&project=...&appType=MapBuilder
 *   - POST /Modules/?IntraMapsSession=...
 *   - POST /Search/?...&form=...&selectionLayersFilter=...
 *   - POST /Search/Refine/Set?IntraMapsSession=...
 *
 * No production API calls are made in tests.
 */

const BAYSWATER_BASE = 'https://bayswater.spatial.t1cloud.com/spatial/intramaps/ApplicationEngine';
const SESSION = 'test-session-id';

function jsonRes(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

function textField(name: string, value: string): unknown {
  return {
    name,
    caption: name,
    type: 'Text',
    value: { value },
  };
}

function refinePayload(fields: unknown[]): unknown {
  return {
    header: { warnings: [], authenticationRequired: false },
    infoPanels: {
      info1: {
        feature: {
          fields,
        },
      },
    },
  };
}

const originalFetch = globalThis.fetch;

beforeAll(() => {
  const mockFetch: typeof fetch = async (input, init) => {
    const rawUrl = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : (input as Request).url;

    if (!rawUrl.startsWith(BAYSWATER_BASE)) return originalFetch(input, init);

    const url = new URL(rawUrl);
    const path = url.pathname;
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) as { fields?: string[]; mapKey?: string } : {};

    if (path.endsWith('/Projects/')) {
      return jsonRes({ ok: true }, 200, { 'x-intramaps-session': SESSION });
    }

    if (path.endsWith('/Modules/')) {
      return jsonRes({ ok: true });
    }

    if (path.endsWith('/Search/Refine/Set')) {
      const mapKey = body.mapKey ?? '';

      if (mapKey === '100') {
        return jsonRes(refinePayload([
          textField('Area', 'Area 2'),
          textField('FOGO Green Lid', 'Every Wednesday'),
          textField('Waste Red Lid', 'Wednesday - 25 March 2026'),
          textField('Recycling Yellow Lid', 'Wednesday - 18 March 2026'),
        ]));
      }

      if (mapKey === '120') {
        return jsonRes(refinePayload([
          textField('Area', 'Area 1'),
          textField('FOGO Green Lid', 'Every Tuesday'),
          textField('Waste Red Lid', 'Tuesday - 17 March 2026'),
          textField('Recycling Yellow Lid', 'Tuesday - 24 March 2026'),
        ]));
      }

      if (mapKey === '130') {
        return jsonRes(refinePayload([
          textField('Area', ''),
          textField('FOGO Green Lid', 'Every Thursday'),
          textField('Waste Red Lid', 'Thursday - 19 March 2026'),
          textField('Recycling Yellow Lid', 'Thursday - 26 March 2026'),
        ]));
      }

      if (mapKey === '110') {
        return jsonRes(refinePayload([
          textField('Area', 'Area 2'),
          textField('FOGO Green Lid', 'Every Tuesday'),
          textField('Waste Red Lid', 'Tuesday - 24 March 2026'),
          textField('Recycling Yellow Lid', 'Tuesday - 17 March 2026'),
        ]));
      }

      if (mapKey === '140') {
        return jsonRes(refinePayload([
          textField('Area', ''),
          textField('FOGO Green Lid', 'Collection unavailable'),
          textField('Waste Red Lid', 'N/A'),
          textField('Recycling Yellow Lid', 'N/A'),
        ]));
      }

      return jsonRes(refinePayload([]));
    }

    if (path.endsWith('/Search/')) {
      const term = body.fields?.[0] ?? '';

      if (term === '61 Broun Avenue, Morley WA 6062' || term === '61 Broun Avenue') {
        return jsonRes({
          fullText: [{ selectionLayer: 'layer', mapKey: '100', dbKey: '200', displayValue: '61 Broun Avenue MORLEY WA 6062' }],
        });
      }

      if (term === '1 Crimea Street, Morley WA 6062' || term === '1 Crimea Street') {
        return jsonRes({
          fullText: [{ selectionLayer: 'layer', mapKey: '120', dbKey: '220', displayValue: '10 Crimea Street MORLEY WA 6062' }],
        });
      }

      if (term === '1 Walter Road West, Bedford WA 6052' || term === '1 Walter Road West') {
        return jsonRes({
          fullText: [{ selectionLayer: 'layer', mapKey: '130', dbKey: '230', displayValue: '1/100 Walter Road West BEDFORD WA 6052' }],
        });
      }

      if (term === '1 Railway Parade, Bayswater WA 6053') {
        return jsonRes({ fullText: [] });
      }

      if (term === '1 Railway Parade') {
        return jsonRes({
          fullText: [{ selectionLayer: 'layer', mapKey: '110', dbKey: '210', displayValue: '10 Railway Parade BAYSWATER WA 6053' }],
        });
      }

      if (term === '404 Broken Street, Bayswater WA 6053' || term === '404 Broken Street') {
        return jsonRes({
          fullText: [{ selectionLayer: 'layer', mapKey: '140', dbKey: '240', displayValue: '404 Broken Street BAYSWATER WA 6053' }],
        });
      }

      return jsonRes({ fullText: [] });
    }

    return jsonRes({ error: 'Unhandled mock URL' }, 404);
  };

  (globalThis as { fetch: typeof fetch }).fetch = mockFetch;
});

afterAll(() => {
  (globalThis as { fetch: typeof fetch }).fetch = originalFetch;
});

import { bayswaterCanHandle, bayswaterScraper } from '../../src/scrapers/bayswater';

describe('BayswaterScraper', () => {
  describe('resolveAddress', () => {
    it('resolves Area 2 address to BAY-WED-A', async () => {
      const result = await bayswaterScraper.resolveAddress('61 Broun Avenue, Morley WA 6062');
      expect(result.error).toBeUndefined();
      expect(result.zoneCode).toBe('BAY-WED-A');
      expect(result.councilSlug).toBe('bayswater');
    });

    it('resolves Area 1 address to BAY-TUE-B', async () => {
      const result = await bayswaterScraper.resolveAddress('1 Crimea Street, Morley WA 6062');
      expect(result.error).toBeUndefined();
      expect(result.zoneCode).toBe('BAY-TUE-B');
      expect(result.zoneName).toContain('Tuesday');
    });

    it('falls back to street search term when full address returns no candidates', async () => {
      const result = await bayswaterScraper.resolveAddress('1 Railway Parade, Bayswater WA 6053');
      expect(result.error).toBeUndefined();
      expect(result.zoneCode).toBe('BAY-TUE-A');
    });

    it('falls back to recycling date when Area value is missing', async () => {
      const result = await bayswaterScraper.resolveAddress('1 Walter Road West, Bedford WA 6052');
      expect(result.error).toBeUndefined();
      expect(result.zoneCode).toBe('BAY-THU-B');
    });

    it('returns unsupported when collection fields cannot be parsed', async () => {
      const result = await bayswaterScraper.resolveAddress('404 Broken Street, Bayswater WA 6053');
      expect(result.zoneCode).toBe('');
      expect(result.error).toContain('unsupported');
    });

    it('returns not found when no candidate is returned', async () => {
      const result = await bayswaterScraper.resolveAddress('999 Unknown Avenue, Perth WA 6000');
      expect(result.zoneCode).toBe('');
      expect(result.error).toContain('not found');
    });
  });

  describe('fetchSchedule', () => {
    it('returns fortnightly general + fortnightly recycling + weekly FOGO for BAY-WED-A', async () => {
      const s = await bayswaterScraper.fetchSchedule('BAY-WED-A');
      expect(s.generalDay).toBe('wednesday');
      expect(s.generalFrequency).toBe('fortnightly');
      expect(s.recyclingDay).toBe('wednesday');
      expect(s.recyclingWeek).toBe('A');
      expect(s.greenWasteDay).toBe('wednesday');
      expect(s.greenWasteWeek).toBe('weekly');
    });

    it('returns correct week for BAY-TUE-B', async () => {
      const s = await bayswaterScraper.fetchSchedule('BAY-TUE-B');
      expect(s.generalDay).toBe('tuesday');
      expect(s.recyclingWeek).toBe('B');
    });

    it('throws for unknown zone code', async () => {
      await expect(bayswaterScraper.fetchSchedule('BAY-SAT-A')).rejects.toThrow('Unknown Bayswater zone code');
    });
  });

  describe('bayswaterCanHandle', () => {
    it('returns true for Bayswater suburbs', () => {
      expect(bayswaterCanHandle('Bayswater')).toBe(true);
      expect(bayswaterCanHandle('morley')).toBe(true);
      expect(bayswaterCanHandle('MOUNT LAWLEY')).toBe(true);
      expect(bayswaterCanHandle('Noranda')).toBe(true);
    });

    it('returns false for non-Bayswater suburbs', () => {
      expect(bayswaterCanHandle('fremantle')).toBe(false);
      expect(bayswaterCanHandle('claremont')).toBe(false);
      expect(bayswaterCanHandle('midland')).toBe(false);
    });
  });

  describe('healthCheck', () => {
    it('passes with mocked Bayswater payloads', async () => {
      const ok = await bayswaterScraper.healthCheck();
      expect(ok).toBe(true);
    });
  });
});
