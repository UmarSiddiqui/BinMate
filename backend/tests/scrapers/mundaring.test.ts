/**
 * Shire of Mundaring scraper tests.
 *
 * Mocks the Mundaring public endpoints:
 * - GET /Location/GetBinsLocation?term={text}
 * - GET /BinLocationInfo/Info?parcelNumber={id}&suburb={suburb}
 */

const BASE = 'https://my.mundaring.wa.gov.au';

function htmlDetails(params: {
  area: string;
  fogoDay: string;
  recycleDate: string;
  generalDate: string;
  vergeDate?: string;
}): string {
  return `
    <section>
      <div class="form-group"><label>Collection Area :</label>${params.area}</div>
      <div class="form-group"><label>FOGO Bin (<b>Lime Green Lid</b>):</label>${params.fogoDay}</div>
      <div class="form-group"><label>Next Recycle Bin Date (<b>Yellow Lid</b>):</label>${params.recycleDate}</div>
      <div class="form-group"><label>Next General Waste Date (<b>Red Lid</b>):</label>${params.generalDate}</div>
      <div class="form-group"><label>Bulk Verge Collection Dates:</label>${params.vergeDate ?? ''}</div>
    </section>
  `;
}

function jsonRes(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function htmlRes(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

const originalFetch = globalThis.fetch;

beforeAll(() => {
  const mockFetch: typeof fetch = async (input) => {
    const rawUrl = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : (input as Request).url;

    if (!rawUrl.startsWith(BASE)) return originalFetch(input);

    const url = new URL(rawUrl);

    if (url.pathname === '/Location/GetBinsLocation') {
      const term = url.searchParams.get('term') ?? '';

      if (term === '14 Mundaring Weir RD MUNDARING WA 6073') return jsonRes([]);

      if (term.includes('Mundaring')) {
        return jsonRes([
          {
            parcelnumber: 108350,
            streetdetails: '16 Mundaring Weir RD MUNDARING WA 6073',
            suburb: 'MUNDARING',
          },
          {
            parcelnumber: 108351,
            streetdetails: '14 Mundaring Weir RD MUNDARING WA 6073',
            suburb: 'MUNDARING',
          },
        ]);
      }

      if (term.includes('Broken')) {
        return jsonRes([
          {
            parcelnumber: 999999,
            streetdetails: '404 Broken Street MUNDARING WA 6073',
            suburb: 'MUNDARING',
          },
        ]);
      }

      return jsonRes([]);
    }

    if (url.pathname === '/BinLocationInfo/Info') {
      const parcel = Number(url.searchParams.get('parcelNumber') ?? '0');

      if (parcel === 108351) {
        return htmlRes(htmlDetails({
          area: 'Area 1',
          fogoDay: 'Wednesday',
          recycleDate: '25/03/2026',
          generalDate: '18/03/2026',
          vergeDate: '01 September 2025',
        }));
      }

      if (parcel === 108350) {
        return htmlRes(htmlDetails({
          area: 'Area 1',
          fogoDay: 'N/A',
          recycleDate: 'N/A',
          generalDate: 'N/A',
        }));
      }

      if (parcel === 999999) {
        return htmlRes(htmlDetails({
          area: 'Area 9',
          fogoDay: 'N/A',
          recycleDate: 'N/A',
          generalDate: 'N/A',
        }));
      }

      return htmlRes('<div>Not found</div>', 404);
    }

    return jsonRes({ error: 'Unhandled mock URL' }, 404);
  };

  (globalThis as { fetch: typeof fetch }).fetch = mockFetch;
});

afterAll(() => {
  (globalThis as { fetch: typeof fetch }).fetch = originalFetch;
});

import { mundaringCanHandle, mundaringScraper } from '../../src/scrapers/mundaring';

describe('MundaringScraper', () => {
  describe('resolveAddress', () => {
    it('resolves Mundaring address to MUN-WED-B', async () => {
      const result = await mundaringScraper.resolveAddress('14 Mundaring Weir RD MUNDARING WA 6073');
      expect(result.error).toBeUndefined();
      expect(result.zoneCode).toBe('MUN-WED-B');
      expect(result.councilSlug).toBe('mundaring');
    });

    it('returns unsupported when details cannot be parsed', async () => {
      const result = await mundaringScraper.resolveAddress('404 Broken Street MUNDARING WA 6073');
      expect(result.zoneCode).toBe('');
      expect(result.error).toContain('unsupported');
    });

    it('returns not found when there are no candidates', async () => {
      const result = await mundaringScraper.resolveAddress('999 Unknown Road Perth WA 6000');
      expect(result.zoneCode).toBe('');
      expect(result.error).toContain('not found');
    });
  });

  describe('fetchSchedule', () => {
    it('returns expected schedule for MUN-WED-B', async () => {
      const s = await mundaringScraper.fetchSchedule('MUN-WED-B');
      expect(s.generalDay).toBe('wednesday');
      expect(s.generalFrequency).toBe('weekly');
      expect(s.recyclingDay).toBe('wednesday');
      expect(s.recyclingWeek).toBe('B');
      expect(s.greenWasteDay).toBeNull();
      expect(s.greenWasteWeek).toBeNull();
    });

    it('throws for unknown zone code', async () => {
      await expect(mundaringScraper.fetchSchedule('MUN-SAT-A')).rejects.toThrow(
        'Unknown Mundaring zone code',
      );
    });
  });

  describe('healthCheck', () => {
    it('passes with mocked Mundaring payloads', async () => {
      const ok = await mundaringScraper.healthCheck();
      expect(ok).toBe(true);
    });
  });
});

describe('mundaringCanHandle', () => {
  it.each(['Mundaring', 'darlington', 'STONEVILLE', 'wundowie'])('accepts "%s"', (suburb) => {
    expect(mundaringCanHandle(suburb)).toBe(true);
  });

  it.each(['armadale', 'fremantle', 'midland', ''])('rejects "%s"', (suburb) => {
    expect(mundaringCanHandle(suburb)).toBe(false);
  });
});
