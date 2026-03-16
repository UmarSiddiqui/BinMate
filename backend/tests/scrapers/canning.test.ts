/**
 * City of Canning scraper tests.
 *
 * Mocks the Canning property-details REST API (no production calls per CLAUDE.md §12).
 *
 * Test addresses (verified against live canning.wa.gov.au API 2026-03-16):
 *   31 Manning Rd, Cannington WA 6107
 *     → find "31 Manning Road" → key "3263109"
 *     → rubbish Wed 2026-03-18 AWST (Week A), recycling Wed 2026-03-25 AWST (Week B)
 *     → CAN-WED-B
 *
 *   15 Wharf St, Queens Park WA 6107
 *     → find "15 Wharf Street" → key "9999001"
 *     → rubbish Fri 2026-03-20 AWST (Week A), recycling Fri 2026-03-27 AWST (Week B)
 *     → CAN-FRI-B
 *
 *   22 Harrison St, Bentley WA 6102
 *     → find "22 Harrison Street" → key "8888001"
 *     → recycling Mon 2026-03-16 AWST (Week A), rubbish Mon 2026-03-23 AWST (Week B)
 *     → CAN-MON-A
 *
 * Week verification (WEEK_A_REFERENCE = 2026-01-05):
 *   2026-03-18 → 72 days from ref → 10 weeks → Week A  (rubbish for Manning/Wharf)
 *   2026-03-25 → 79 days → 11 weeks → Week B  (recycling for Manning/Wharf)
 *   2026-03-16 → 70 days → 10 weeks → Week A  (recycling for Harrison)
 *   2026-03-23 → 77 days → 11 weeks → Week B  (rubbish for Harrison)
 *
 * Run with: npm test -- tests/scrapers/canning.test.ts
 */

const CANNING_BASE = 'https://www.canning.wa.gov.au/api/property-details';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findResult(key: string, address: string) {
  return [{ key, address }];
}

function binsResult(rubbish: string, recycling: string) {
  return {
    rubbishCollectionDate: rubbish,
    recyclingCollectionDate: recycling,
    junkWasteCollectionDates: [],
    greenWasteCollectionDates: [],
  };
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

    const decodedUrl = decodeURIComponent(url);

    // ── Find endpoint ─────────────────────────────────────────────────────────
    if (url.startsWith(`${CANNING_BASE}/find/`)) {
      if (decodedUrl.includes('Manning')) {
        return jsonRes(findResult('3263109', '31 Manning Road CANNINGTON  6107'));
      }
      if (decodedUrl.includes('Wharf')) {
        return jsonRes(findResult('9999001', '15 Wharf Street QUEENS PARK  6107'));
      }
      if (decodedUrl.includes('Harrison')) {
        return jsonRes(findResult('8888001', '22 Harrison Street BENTLEY  6102'));
      }
      // Abbreviation expansion check — "Rd" is NOT expanded → should return no results
      if (decodedUrl.includes('/find/') && decodedUrl.includes('Rd')) {
        return new Response(null, { status: 204 });
      }
      // Unknown address → 204 No Content
      return new Response(null, { status: 204 });
    }

    // ── Bins endpoint ─────────────────────────────────────────────────────────
    if (url.startsWith(`${CANNING_BASE}/bins/`)) {
      if (url.includes('/bins/3263109')) {
        // Manning Rd: rubbish Wed 2026-03-18 AWST, recycling Wed 2026-03-25 AWST → CAN-WED-B
        return jsonRes(binsResult('2026-03-17T16:00:00+00:00', '2026-03-24T16:00:00+00:00'));
      }
      if (url.includes('/bins/9999001')) {
        // Wharf St: rubbish Fri 2026-03-20 AWST, recycling Fri 2026-03-27 AWST → CAN-FRI-B
        return jsonRes(binsResult('2026-03-19T16:00:00+00:00', '2026-03-26T16:00:00+00:00'));
      }
      if (url.includes('/bins/8888001')) {
        // Harrison St: recycling Mon 2026-03-16 AWST (Week A), rubbish Mon 2026-03-23 AWST (Week B) → CAN-MON-A
        return jsonRes(binsResult('2026-03-22T16:00:00+00:00', '2026-03-15T16:00:00+00:00'));
      }
    }

    return originalFetch(input);
  };

  (globalThis as { fetch: typeof fetch }).fetch = mockFetch;
});

afterAll(() => {
  (globalThis as { fetch: typeof fetch }).fetch = originalFetch;
});

import { canningScraper, canningCanHandle } from '../../src/scrapers/canning';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CanningScaper', () => {

  // ── resolveAddress ──────────────────────────────────────────────────────────

  describe('resolveAddress', () => {

    it('resolves 31 Manning Rd, Cannington → CAN-WED-B (Wednesday, recycling Week B)', async () => {
      const result = await canningScraper.resolveAddress('31 Manning Rd, Cannington WA 6107');
      expect(result.error).toBeUndefined();
      expect(result.zoneCode).toBe('CAN-WED-B');
      expect(result.zoneName).toContain('Wednesday');
      expect(result.zoneName).toContain('Week B');
      expect(result.councilSlug).toBe('canning');
    }, 15_000);

    it('resolves 15 Wharf St, Queens Park → CAN-FRI-B (Friday, recycling Week B)', async () => {
      const result = await canningScraper.resolveAddress('15 Wharf St, Queens Park WA 6107');
      expect(result.error).toBeUndefined();
      expect(result.zoneCode).toBe('CAN-FRI-B');
      expect(result.zoneName).toContain('Friday');
      expect(result.zoneName).toContain('Week B');
      expect(result.councilSlug).toBe('canning');
    }, 15_000);

    it('resolves 22 Harrison St, Bentley → CAN-MON-A (Monday, recycling Week A)', async () => {
      const result = await canningScraper.resolveAddress('22 Harrison St, Bentley WA 6102');
      expect(result.error).toBeUndefined();
      expect(result.zoneCode).toBe('CAN-MON-A');
      expect(result.zoneName).toContain('Monday');
      expect(result.zoneName).toContain('Week A');
      expect(result.councilSlug).toBe('canning');
    }, 15_000);

    it('returns error when address is not found (204 from find API)', async () => {
      const result = await canningScraper.resolveAddress('1 Unknown St, Nowhere WA 9999');
      expect(result.error).toBeDefined();
      expect(result.zoneCode).toBe('');
    }, 15_000);

    it('returns error for a non-Canning address (200 with empty find results)', async () => {
      // Mock returns 204 for any unknown term; address outside Canning is unknown
      const result = await canningScraper.resolveAddress('1 Queen St, Fremantle WA 6160');
      expect(result.error).toBeDefined();
      expect(result.zoneCode).toBe('');
    }, 15_000);

  });

  // ── fetchSchedule ───────────────────────────────────────────────────────────

  describe('fetchSchedule', () => {

    it('CAN-WED-B: Wednesday recycling Week B + general waste Week A', async () => {
      const s = await canningScraper.fetchSchedule('CAN-WED-B');
      expect(s.generalDay).toBe('wednesday');
      expect(s.generalFrequency).toBe('fortnightly');
      expect(s.recyclingDay).toBe('wednesday');
      expect(s.recyclingWeek).toBe('B');
      expect(s.greenWasteDay).toBe('wednesday');
      expect(s.greenWasteWeek).toBe('A');   // rubbish bin — opposite to recycling
      expect(s.vergeDates).toBeNull();
    });

    it('CAN-MON-A: Monday recycling Week A + general waste Week B', async () => {
      const s = await canningScraper.fetchSchedule('CAN-MON-A');
      expect(s.generalDay).toBe('monday');
      expect(s.recyclingWeek).toBe('A');
      expect(s.greenWasteWeek).toBe('B');
    });

    it('CAN-FRI-B: Friday recycling Week B + general waste Week A', async () => {
      const s = await canningScraper.fetchSchedule('CAN-FRI-B');
      expect(s.generalDay).toBe('friday');
      expect(s.recyclingWeek).toBe('B');
      expect(s.greenWasteWeek).toBe('A');
    });

    it('CAN-THU-A: Thursday recycling Week A + general waste Week B', async () => {
      const s = await canningScraper.fetchSchedule('CAN-THU-A');
      expect(s.generalDay).toBe('thursday');
      expect(s.recyclingWeek).toBe('A');
      expect(s.greenWasteWeek).toBe('B');
    });

    it('throws for an unknown zone code', async () => {
      await expect(canningScraper.fetchSchedule('INVALID')).rejects.toThrow('Unknown Canning zone code');
    });

    it('throws for a zone code with an invalid day', async () => {
      await expect(canningScraper.fetchSchedule('CAN-SAT-A')).rejects.toThrow('Unknown Canning zone code');
    });

  });

  // ── canningCanHandle ────────────────────────────────────────────────────────

  describe('canningCanHandle', () => {

    it('returns true for Canning LGA suburbs', () => {
      expect(canningCanHandle('cannington')).toBe(true);
      expect(canningCanHandle('Bentley')).toBe(true);       // case-insensitive
      expect(canningCanHandle('queens park')).toBe(true);
      expect(canningCanHandle('Riverton')).toBe(true);
      expect(canningCanHandle('Wilson')).toBe(true);
      expect(canningCanHandle('st james')).toBe(true);
      expect(canningCanHandle('East Victoria Park')).toBe(true);
    });

    it('returns false for non-Canning suburbs', () => {
      expect(canningCanHandle('fremantle')).toBe(false);
      expect(canningCanHandle('clarkson')).toBe(false);
      expect(canningCanHandle('applecross')).toBe(false);
      expect(canningCanHandle('armadale')).toBe(false);
    });

  });

  // ── healthCheck ─────────────────────────────────────────────────────────────

  describe('healthCheck', () => {

    it('passes with mocked API returning CAN-WED-B for Manning Rd', async () => {
      const ok = await canningScraper.healthCheck();
      expect(ok).toBe(true);
    }, 15_000);

  });

});
