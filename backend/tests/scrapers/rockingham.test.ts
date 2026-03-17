/**
 * City of Rockingham scraper tests.
 *
 * Mocked against live IntraMaps endpoint shape:
 *   - POST /Projects/?configId=...&project=...&appType=MapBuilder
 *   - POST /Modules/?IntraMapsSession=...
 *   - POST /Search/?...&form=...&selectionLayersFilter=...
 *   - POST /Search/Refine/Set?IntraMapsSession=...
 *
 * No production API calls are made in tests.
 */

const ROCKINGHAM_BASE = 'https://maps.rockingham.wa.gov.au/IntraMaps23A/ApplicationEngine';
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

function refinePayload(fields: unknown[], warning = ''): unknown {
  return {
    header: { warning, authenticationRequired: false },
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

    if (!rawUrl.startsWith(ROCKINGHAM_BASE)) return originalFetch(input, init);

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
          textField('Address', '68 Example Rd'),
          textField('FOGO Bin (FOGO lid)', 'Collected weekly on Thursday'),
          textField('Recycle (Yellow Lid)', 'Collected fortnightly Thursday 26 March 2026'),
          textField('Waste (Red Lid)', 'Collected fortnightly Thursday   19 March 2026'),
        ]));
      }

      if (mapKey === '200') {
        return jsonRes(refinePayload([
          textField('Address', 'Warnbro Sound Av'),
          textField('FOGO Bin (FOGO lid)', 'N/A'),
          textField('Recycle (Yellow Lid)', 'Collected fortnightly Friday 20 March 2026'),
          textField('Waste (Red Lid)', 'Collected weekly Friday   27 March 2026'),
        ]));
      }

      if (mapKey === '300') {
        return jsonRes(refinePayload([
          textField('Address', 'Unsupported Place'),
          textField('FOGO Bin (FOGO lid)', 'Collected weekly on Tuesday'),
          textField('Recycle (Yellow Lid)', 'Collection unavailable'),
          textField('Waste (Red Lid)', 'Collection unavailable'),
        ]));
      }

      if (mapKey === '999') {
        return jsonRes(refinePayload([], 'No spatial object found for Pin=999'));
      }

      return jsonRes(refinePayload([]));
    }

    if (path.endsWith('/Search/')) {
      const term = body.fields?.[0] ?? '';

      if (term === '1 Example Ave, Baldivis WA 6171') {
        return jsonRes({ fullText: [] });
      }

      if (term === '1 Example Ave') {
        return jsonRes({
          fullText: [{ selectionLayer: 'layer', mapKey: '100', dbKey: '200', displayValue: '68 Example Rd BALDIVIS' }],
        });
      }

      if (term === 'Warnbro Sound Avenue Warnbro') {
        return jsonRes({
          fullText: [{ selectionLayer: 'layer', mapKey: '200', dbKey: '300', displayValue: 'Warnbro Sound Av WARNBRO' }],
        });
      }

      if (term === 'Unsupported Place Rockingham') {
        return jsonRes({
          fullText: [{ selectionLayer: 'layer', mapKey: '300', dbKey: '400', displayValue: 'Unsupported Place ROCKINGHAM' }],
        });
      }

      if (term === 'No Spatial Place Rockingham') {
        return jsonRes({
          fullText: [{ selectionLayer: 'layer', mapKey: '999', dbKey: '888', displayValue: 'No Spatial Place ROCKINGHAM' }],
        });
      }

      if (term === 'Sixty Eight Road Baldivis WA 6171') {
        return jsonRes({
          fullText: [{ selectionLayer: 'layer', mapKey: '100', dbKey: '200', displayValue: '68 Example Rd BALDIVIS' }],
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

import { rockinghamCanHandle, rockinghamScraper } from '../../src/scrapers/rockingham';

describe('RockinghamScraper', () => {
  describe('resolveAddress', () => {
    it('falls back from full address term to street search and resolves FOGO pattern', async () => {
      const result = await rockinghamScraper.resolveAddress('1 Example Ave, Baldivis WA 6171');
      expect(result.error).toBeUndefined();
      expect(result.zoneCode).toBe('ROC-THU-B-A-W');
      expect(result.councilSlug).toBe('rockingham');
    });

    it('resolves non-FOGO weekly waste pattern', async () => {
      const result = await rockinghamScraper.resolveAddress('Warnbro Sound Avenue Warnbro');
      expect(result.error).toBeUndefined();
      expect(result.zoneCode).toBe('ROC-FRI-A-W-N');
      expect(result.zoneName).toContain('Friday');
    });

    it('returns unsupported when collection fields cannot be parsed', async () => {
      const result = await rockinghamScraper.resolveAddress('Unsupported Place Rockingham');
      expect(result.zoneCode).toBe('');
      expect(result.error).toContain('unsupported');
    });

    it('returns unsupported when refine response has no spatial object', async () => {
      const result = await rockinghamScraper.resolveAddress('No Spatial Place Rockingham');
      expect(result.zoneCode).toBe('');
      expect(result.error).toContain('unsupported');
    });

    it('returns not found when no candidate is returned', async () => {
      const result = await rockinghamScraper.resolveAddress('999 Unknown Avenue, Perth WA 6000');
      expect(result.zoneCode).toBe('');
      expect(result.error).toContain('not found');
    });
  });

  describe('fetchSchedule', () => {
    it('returns fortnightly waste + fortnightly recycling + weekly FOGO schedule', async () => {
      const s = await rockinghamScraper.fetchSchedule('ROC-THU-B-A-W');
      expect(s.generalDay).toBe('thursday');
      expect(s.generalFrequency).toBe('fortnightly');
      expect(s.recyclingDay).toBe('thursday');
      expect(s.recyclingWeek).toBe('B');
      expect(s.greenWasteDay).toBe('thursday');
      expect(s.greenWasteWeek).toBe('weekly');
    });

    it('returns weekly waste + no FOGO schedule', async () => {
      const s = await rockinghamScraper.fetchSchedule('ROC-FRI-A-W-N');
      expect(s.generalDay).toBe('friday');
      expect(s.generalFrequency).toBe('weekly');
      expect(s.recyclingWeek).toBe('A');
      expect(s.greenWasteDay).toBeNull();
      expect(s.greenWasteWeek).toBeNull();
    });

    it('throws for unknown zone code', async () => {
      await expect(rockinghamScraper.fetchSchedule('ROC-SAT-A-W-N')).rejects.toThrow('Unknown Rockingham zone code');
    });
  });

  describe('rockinghamCanHandle', () => {
    it('returns true for Rockingham suburbs', () => {
      expect(rockinghamCanHandle('Rockingham')).toBe(true);
      expect(rockinghamCanHandle('baldivis')).toBe(true);
      expect(rockinghamCanHandle('WARNBRO')).toBe(true);
      expect(rockinghamCanHandle('Safety Bay')).toBe(true);
    });

    it('returns false for non-Rockingham suburbs', () => {
      expect(rockinghamCanHandle('fremantle')).toBe(false);
      expect(rockinghamCanHandle('claremont')).toBe(false);
      expect(rockinghamCanHandle('midland')).toBe(false);
    });
  });

  describe('healthCheck', () => {
    it('passes with mocked Rockingham payloads', async () => {
      const ok = await rockinghamScraper.healthCheck();
      expect(ok).toBe(true);
    });
  });
});
