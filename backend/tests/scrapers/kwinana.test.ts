/**
 * City of Kwinana scraper tests.
 *
 * Mocks T1Cloud endpoint flow:
 * - POST /Projects/?configId=...&project=...&appType=MapBuilder
 * - POST /Modules/?IntraMapsSession=...
 * - POST /Search/?...&form=...&selectionLayersFilter=...
 * - POST /Search/Refine/Set?IntraMapsSession=...
 *
 * Real-address examples used in mocked payloads:
 * - 23 Adamson Road, Parmelia WA 6167
 * - 1 Chisham Avenue, Kwinana Town Centre WA 6167
 */

const KWINANA_BASE = 'https://kwinana.spatial.t1cloud.com/spatial/intramaps/ApplicationEngine';
const SESSION = 'test-session-id';

function jsonRes(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

function heading(value: string): unknown {
  return {
    name: 'Text',
    caption: 'Text',
    type: 'Heading',
    value: { value },
  };
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
  jest.useFakeTimers().setSystemTime(new Date('2026-03-17T00:00:00.000Z'));

  const mockFetch: typeof fetch = async (input, init) => {
    const rawUrl = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : (input as Request).url;

    if (!rawUrl.startsWith(KWINANA_BASE)) return originalFetch(input, init);

    const url = new URL(rawUrl);
    const path = url.pathname;
    const body = typeof init?.body === 'string'
      ? JSON.parse(init.body) as { fields?: string[]; mapKey?: string }
      : {};

    if (path.endsWith('/Projects/')) {
      return jsonRes({ ok: true }, 200, { 'x-intramaps-session': SESSION });
    }

    if (path.endsWith('/Modules/')) {
      return jsonRes({ ok: true });
    }

    if (path.endsWith('/Search/')) {
      const term = body.fields?.[0] ?? '';

      if (term === '23 Adamson Road, Parmelia WA 6167') return jsonRes({ fullText: [] });
      if (term === '23 Adamson Road PARMELIA WA 6167') return jsonRes({ fullText: [] });
      if (term === '23 Adamson Road' || term.includes('Adamson Road')) {
        return jsonRes({
          fullText: [{
            selectionLayer: 'layer',
            mapKey: '100',
            dbKey: '200',
            displayValue: '23 Adamson Road PARMELIA  WESTERN AUSTRALIA  6167',
          }],
        });
      }

      if (term === '1 Chisham Avenue, Kwinana Town Centre WA 6167') return jsonRes({ fullText: [] });
      if (term === '1 Chisham Avenue') {
        return jsonRes({
          fullText: [{
            selectionLayer: 'layer',
            mapKey: '110',
            dbKey: '210',
            displayValue: '1 Chisham Avenue KWINANA TOWN CENTRE  WESTERN AUSTRALIA  6167',
          }],
        });
      }

      if (term === '404 Broken Street, Parmelia WA 6167' || term === '404 Broken Street PARMELIA WA 6167' || term === '404 Broken Street') {
        return jsonRes({
          fullText: [{
            selectionLayer: 'layer',
            mapKey: '120',
            dbKey: '220',
            displayValue: '404 Broken Street PARMELIA  WESTERN AUSTRALIA  6167',
          }],
        });
      }

      return jsonRes({ fullText: [] });
    }

    if (path.endsWith('/Search/Refine/Set')) {
      const mapKey = body.mapKey ?? '';

      if (mapKey === '100') {
        return jsonRes(refinePayload([
          heading('Waste & Recycling'),
          heading('General Waste Collection'),
          textField('Rubbish Collection', 'Every Friday'),
          heading('Recycle Collection'),
          textField('Recycle Collection', 'Friday Next Week'),
          heading('Garden Organic (GO) Collection'),
          textField('', 'Friday This Week'),
        ]));
      }

      if (mapKey === '110') {
        return jsonRes(refinePayload([
          heading('Waste & Recycling'),
          heading('General Waste Collection'),
          textField('Rubbish Collection', 'Every Friday'),
          heading('Recycle Collection'),
          textField('Recycle Collection', 'Friday This Week'),
          heading('Garden Organic (GO) Collection'),
          textField('', 'Friday Next Week'),
        ]));
      }

      if (mapKey === '120') {
        return jsonRes(refinePayload([
          heading('Waste & Recycling'),
          heading('General Waste Collection'),
          textField('Rubbish Collection', 'Collection unavailable'),
          heading('Recycle Collection'),
          textField('Recycle Collection', 'N/A'),
        ]));
      }

      return jsonRes(refinePayload([]));
    }

    return jsonRes({ error: 'Unhandled mock URL' }, 404);
  };

  (globalThis as { fetch: typeof fetch }).fetch = mockFetch;
});

afterAll(() => {
  jest.useRealTimers();
  (globalThis as { fetch: typeof fetch }).fetch = originalFetch;
});

import { kwinanaCanHandle, kwinanaScraper } from '../../src/scrapers/kwinana';

describe('KwinanaScraper', () => {
  describe('resolveAddress', () => {
    it('resolves fallback street search to KWN-FRI-B-A', async () => {
      const result = await kwinanaScraper.resolveAddress('23 Adamson Road, Parmelia WA 6167');
      expect(result.error).toBeUndefined();
      expect(result.zoneCode).toBe('KWN-FRI-B-A');
      expect(result.councilSlug).toBe('kwinana');
    });

    it('maps this-week recycling and next-week GO to KWN-FRI-A-B', async () => {
      const result = await kwinanaScraper.resolveAddress('1 Chisham Avenue, Kwinana Town Centre WA 6167');
      expect(result.error).toBeUndefined();
      expect(result.zoneCode).toBe('KWN-FRI-A-B');
      expect(result.zoneName).toContain('Friday');
    });

    it('returns unsupported when fields cannot be parsed', async () => {
      const result = await kwinanaScraper.resolveAddress('404 Broken Street, Parmelia WA 6167');
      expect(result.zoneCode).toBe('');
      expect(result.error).toContain('unsupported');
    });

    it('returns not found when no candidate is returned', async () => {
      const result = await kwinanaScraper.resolveAddress('999 Unknown Street, Perth WA 6000');
      expect(result.zoneCode).toBe('');
      expect(result.error).toContain('not found');
    });
  });

  describe('fetchSchedule', () => {
    it('returns weekly general and A/B weeks for KWN-FRI-B-A', async () => {
      const s = await kwinanaScraper.fetchSchedule('KWN-FRI-B-A');
      expect(s.generalDay).toBe('friday');
      expect(s.generalFrequency).toBe('weekly');
      expect(s.recyclingWeek).toBe('B');
      expect(s.greenWasteWeek).toBe('A');
    });

    it('supports weekly week tokens', async () => {
      const s = await kwinanaScraper.fetchSchedule('KWN-THU-W-W');
      expect(s.recyclingWeek).toBe('weekly');
      expect(s.greenWasteWeek).toBe('weekly');
    });

    it('throws for unknown zone code', async () => {
      await expect(kwinanaScraper.fetchSchedule('KWN-SAT-A-B')).rejects.toThrow('Unknown Kwinana zone code');
    });
  });

  describe('healthCheck', () => {
    it('passes with mocked Kwinana payloads', async () => {
      const ok = await kwinanaScraper.healthCheck();
      expect(ok).toBe(true);
    });
  });
});

describe('kwinanaCanHandle', () => {
  it.each(['Kwinana Town Centre', 'parmelia', 'LEDA', 'Wellard'])('accepts "%s"', (suburb) => {
    expect(kwinanaCanHandle(suburb)).toBe(true);
  });

  it.each(['cockburn central', 'fremantle', 'armadale', ''])('rejects "%s"', (suburb) => {
    expect(kwinanaCanHandle(suburb)).toBe(false);
  });
});
