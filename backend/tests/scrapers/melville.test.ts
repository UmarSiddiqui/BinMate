/**
 * City of Melville scraper tests.
 *
 * Mocks Nominatim geocoding and T1Cloud Intramaps API (no production calls per CLAUDE.md §12).
 *
 * Test addresses (verified against live melvillecity.com.au widget on 2026-03-16):
 *   5 Kintail Rd, Applecross WA 6153    → MEL-MON-A (Monday, recycling Week A)
 *   12 Ardross St, Ardross WA 6153      → MEL-WED-B (Wednesday, recycling Week B)
 *
 * Week verification:
 *   YellowLid "Monday, 16 Mar 2026" — WEEK_A_REFERENCE = 2026-01-05 → 10 weeks → Week A
 *   YellowLid "Wednesday, 25 Mar 2026"                              → 11 weeks → Week B
 *
 * Run with: npm test -- tests/scrapers/melville.test.ts
 */

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const T1_BASE = 'https://melville.spatial.t1cloud.com/spatial/intramaps/applicationengine/Integration/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nominatimResult(lat: string, lon: string, suburb: string, postcode: string) {
  return [{
    lat, lon,
    display_name: `${suburb}, City of Melville, Western Australia, Australia`,
    address: { suburb, state: 'Western Australia', postcode },
  }];
}

function searchResult(district: string, greenLid: string, redLid: string, yellowLid: string) {
  return [[
    { caption: 'collection district', name: 'collection_district', value: district },
    { caption: 'GreenLid',            name: 'GreenLid',            value: greenLid },
    { caption: 'RedLid',              name: 'RedLid',              value: redLid },
    { caption: 'YellowLid',           name: 'YellowLid',           value: yellowLid },
  ]];
}

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

// ─── Mock fetch ───────────────────────────────────────────────────────────────

const originalFetch = globalThis.fetch;

beforeAll(() => {
  const mockFetch: typeof fetch = async (input) => {
    const url =
      typeof input === 'string' ? input
      : input instanceof URL    ? input.href
      : (input as Request).url;

    const parsed = new URL(url);

    // Nominatim geocoding
    if (url.startsWith(NOMINATIM_BASE)) {
      const q = parsed.searchParams.get('q') ?? '';
      if (q.includes('Kintail') || q.includes('Applecross')) {
        return jsonRes(nominatimResult('-32.0110141', '115.8487948', 'Applecross', '6153'));
      }
      if (q.includes('Ardross')) {
        return jsonRes(nominatimResult('-32.0219955', '115.8429219', 'Ardross', '6153'));
      }
      // Non-Melville address — no results
      return jsonRes([]);
    }

    // T1Cloud Reproject — route by lat (y param)
    if (url.includes('/Reproject')) {
      const y = parseFloat(parsed.searchParams.get('y') ?? '0');
      if (Math.abs(y - (-32.0110141)) < 0.0001) {
        // Applecross
        return jsonRes({ x: 391700.12, y: 6456957.34 });
      }
      if (Math.abs(y - (-32.0219955)) < 0.0001) {
        // Ardross
        return jsonRes({ x: 391200.56, y: 6455760.78 });
      }
    }

    // T1Cloud Search — route by fields prefix (projected x coord)
    if (url.includes('/search/')) {
      const fields = parsed.searchParams.get('fields') ?? '';
      if (fields.startsWith('391700')) {
        // Applecross: Monday, yellow lid Week A
        return jsonRes(searchResult('Monday', 'Every Monday', 'Monday, 23 Mar 2026', 'Monday, 16 Mar 2026'));
      }
      if (fields.startsWith('391200')) {
        // Ardross: Wednesday, yellow lid Week B
        return jsonRes(searchResult('Wednesday', 'Every Wednesday', 'Wednesday, 18 Mar 2026', 'Wednesday, 25 Mar 2026'));
      }
      // Coords outside Melville — return empty values
      return jsonRes([[
        { caption: 'collection district', name: 'collection_district', value: '' },
        { caption: 'GreenLid',            name: 'GreenLid',            value: '' },
        { caption: 'RedLid',              name: 'RedLid',              value: '' },
        { caption: 'YellowLid',           name: 'YellowLid',           value: '' },
      ]]);
    }

    return originalFetch(input);
  };

  (globalThis as { fetch: typeof fetch }).fetch = mockFetch;
});

afterAll(() => {
  (globalThis as { fetch: typeof fetch }).fetch = originalFetch;
});

import { melvilleScraper, melvilleCanHandle } from '../../src/scrapers/melville';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MelvilleScraper', () => {

  // ── resolveAddress ───────────────────────────────────────────────────────────

  describe('resolveAddress', () => {

    it('resolves 5 Kintail Rd, Applecross → MEL-MON-A (Monday, recycling Week A)', async () => {
      const result = await melvilleScraper.resolveAddress('5 Kintail Rd, Applecross WA 6153');
      expect(result.error).toBeUndefined();
      expect(result.zoneCode).toBe('MEL-MON-A');
      expect(result.zoneName).toContain('Monday');
      expect(result.zoneName).toContain('Week A');
      expect(result.councilSlug).toBe('melville');
    }, 15_000);

    it('resolves 12 Ardross St, Ardross → MEL-WED-B (Wednesday, recycling Week B)', async () => {
      const result = await melvilleScraper.resolveAddress('12 Ardross St, Ardross WA 6153');
      expect(result.error).toBeUndefined();
      expect(result.zoneCode).toBe('MEL-WED-B');
      expect(result.zoneName).toContain('Wednesday');
      expect(result.zoneName).toContain('Week B');
      expect(result.councilSlug).toBe('melville');
    }, 15_000);

    it('returns error when Nominatim cannot find the address', async () => {
      // Mocked to return empty array for unknown addresses
      const result = await melvilleScraper.resolveAddress('1 Unknown Pl, Nowhere WA 9999');
      expect(result.error).toBeDefined();
      expect(result.zoneCode).toBe('');
    }, 15_000);

    it('returns error when address is outside Melville zone polygons', async () => {
      // Nominatim returns no results for this address → empty error
      const result = await melvilleScraper.resolveAddress('1 Queen St, Fremantle WA 6160');
      expect(result.error).toBeDefined();
      expect(result.zoneCode).toBe('');
    }, 15_000);

  });

  // ── fetchSchedule ─────────────────────────────────────────────────────────

  describe('fetchSchedule', () => {

    it('MEL-MON-A: Monday FOGO weekly + yellow Monday Week A + red Monday Week B', async () => {
      const s = await melvilleScraper.fetchSchedule('MEL-MON-A');
      expect(s.generalDay).toBe('monday');
      expect(s.generalFrequency).toBe('weekly');   // FOGO every week
      expect(s.recyclingDay).toBe('monday');
      expect(s.recyclingWeek).toBe('A');            // yellow lid — Week A
      expect(s.greenWasteDay).toBe('monday');
      expect(s.greenWasteWeek).toBe('B');           // red lid — Week B (opposite)
      expect(s.vergeDates).toBeNull();
    });

    it('MEL-WED-B: Wednesday FOGO weekly + yellow Wednesday Week B + red Wednesday Week A', async () => {
      const s = await melvilleScraper.fetchSchedule('MEL-WED-B');
      expect(s.generalDay).toBe('wednesday');
      expect(s.generalFrequency).toBe('weekly');
      expect(s.recyclingDay).toBe('wednesday');
      expect(s.recyclingWeek).toBe('B');
      expect(s.greenWasteDay).toBe('wednesday');
      expect(s.greenWasteWeek).toBe('A');
    });

    it('MEL-THU-B: Thursday', async () => {
      const s = await melvilleScraper.fetchSchedule('MEL-THU-B');
      expect(s.generalDay).toBe('thursday');
      expect(s.recyclingWeek).toBe('B');
      expect(s.greenWasteWeek).toBe('A');
    });

    it('MEL-FRI-A: Friday Week A → green waste Week B', async () => {
      const s = await melvilleScraper.fetchSchedule('MEL-FRI-A');
      expect(s.generalDay).toBe('friday');
      expect(s.recyclingWeek).toBe('A');
      expect(s.greenWasteWeek).toBe('B');
    });

    it('throws for an unknown zone code', async () => {
      await expect(melvilleScraper.fetchSchedule('MEL-SAT-A')).rejects.toThrow('Unknown Melville zone code');
    });

    it('throws for a completely invalid zone code', async () => {
      await expect(melvilleScraper.fetchSchedule('INVALID')).rejects.toThrow('Unknown Melville zone code');
    });

  });

  // ── melvilleCanHandle ────────────────────────────────────────────────────

  describe('melvilleCanHandle', () => {

    it('returns true for Melville LGA suburbs', () => {
      expect(melvilleCanHandle('applecross')).toBe(true);
      expect(melvilleCanHandle('Ardross')).toBe(true);     // case-insensitive
      expect(melvilleCanHandle('booragoon')).toBe(true);
      expect(melvilleCanHandle('Kardinya')).toBe(true);
      expect(melvilleCanHandle('Mount Pleasant')).toBe(true);
      expect(melvilleCanHandle('winthrop')).toBe(true);
      expect(melvilleCanHandle('bull creek')).toBe(true);
    });

    it('returns false for non-Melville suburbs', () => {
      expect(melvilleCanHandle('fremantle')).toBe(false);
      expect(melvilleCanHandle('clarkson')).toBe(false);
      expect(melvilleCanHandle('rockingham')).toBe(false);
      expect(melvilleCanHandle('armadale')).toBe(false);
    });

  });

  // ── healthCheck ──────────────────────────────────────────────────────────

  describe('healthCheck', () => {

    it('passes with mocked API returning MEL-MON-A for Applecross', async () => {
      const ok = await melvilleScraper.healthCheck();
      expect(ok).toBe(true);
    }, 15_000);

  });

});
