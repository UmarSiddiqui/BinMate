/**
 * City of Armadale scraper tests.
 *
 * Test addresses chosen from PLAN.md §1.3:
 *   - 23 Sexty St, Armadale WA 6112   → WED-1 (Wednesday, Area 1)
 *   - 270 Skeet Rd, Harrisdale WA 6112 → THU-2 (Thursday, Area 2)
 *
 * Mocks the Armadale bins API (no production calls per CLAUDE.md §12).
 * Run with: npm test -- tests/scrapers/armadale.test.ts
 */

const ARMADALE_API_BASE = 'https://api.my.armadale.wa.gov.au';

const originalFetch = globalThis.fetch;
beforeAll(() => {
  const mockFetch: typeof fetch = async (input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as { url: string }).url;
    if (url.startsWith(`${ARMADALE_API_BASE}/bins`)) {
      const addr = new URL(url).searchParams.get('address') ?? '';
      if (addr.includes('Sexty') || addr.includes('23')) {
        return new Response(JSON.stringify([{
          address: '23 Sexty Street, ARMADALE',
          bin_day: 'Wednesday',
          recycle_area: 'This Week (Area 1)',
          vergeside_zone: '9',
        }]), { status: 200 });
      }
      if (addr.includes('Skeet') || addr.includes('270')) {
        return new Response(JSON.stringify([{
          address: '270 Skeet Rd, Harrisdale',
          bin_day: 'Thursday',
          recycle_area: 'Next Week (Area 2)',
          vergeside_zone: '8',
        }]), { status: 200 });
      }
      if (addr.includes('Queen')) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
    }
    return originalFetch(input);
  };
  (globalThis as { fetch: typeof fetch }).fetch = mockFetch;
});
afterAll(() => {
  (globalThis as { fetch: typeof fetch }).fetch = originalFetch;
});

import { armadaleScraper, armadaleCanHandle } from '../../src/scrapers/armadale';

describe('ArmadaleScraper', () => {

  // ── resolveAddress ──────────────────────────────────────────────────────────

  describe('resolveAddress', () => {

    it('resolves 23 Sexty St → WED-1 (Wednesday, Area 1)', async () => {
      const result = await armadaleScraper.resolveAddress('23 Sexty St, Armadale WA 6112');
      expect(result.error).toBeUndefined();
      expect(result.zoneCode).toBe('WED-1');
      expect(result.zoneName).toContain('Wednesday');
      expect(result.zoneName).toContain('Area 1');
      expect(result.councilSlug).toBe('armadale');
    }, 15_000);

    it('resolves 270 Skeet Rd → THU-2 (Thursday, Area 2)', async () => {
      const result = await armadaleScraper.resolveAddress('270 Skeet Rd, Harrisdale WA 6112');
      expect(result.error).toBeUndefined();
      expect(result.zoneCode).toBe('THU-2');
      expect(result.zoneName).toContain('Thursday');
      expect(result.zoneName).toContain('Area 2');
      expect(result.councilSlug).toBe('armadale');
    }, 15_000);

    it('returns error for an address outside Armadale (Fremantle)', async () => {
      // The Armadale API should return an empty array for non-Armadale addresses
      const result = await armadaleScraper.resolveAddress('1 Queen St, Fremantle WA 6160');
      expect(result.error).toBeDefined();
      expect(result.zoneCode).toBe('');
    }, 15_000);

  });

  // ── fetchSchedule ───────────────────────────────────────────────────────────

  describe('fetchSchedule', () => {

    it('returns correct schedule for WED-1 (Area 1 → recycling Week A)', async () => {
      const s = await armadaleScraper.fetchSchedule('WED-1');
      expect(s.generalDay).toBe('wednesday');
      expect(s.generalFrequency).toBe('weekly');
      expect(s.recyclingDay).toBe('wednesday');
      expect(s.recyclingWeek).toBe('A');
      expect(s.greenWasteDay).toBeNull();
      expect(s.greenWasteWeek).toBeNull();
    });

    it('returns correct schedule for THU-2 (Area 2 → recycling Week B)', async () => {
      const s = await armadaleScraper.fetchSchedule('THU-2');
      expect(s.generalDay).toBe('thursday');
      expect(s.recyclingWeek).toBe('B');
    });

    it('returns correct schedule for MON-1', async () => {
      const s = await armadaleScraper.fetchSchedule('MON-1');
      expect(s.generalDay).toBe('monday');
      expect(s.recyclingWeek).toBe('A');
    });

    it('returns correct schedule for FRI-2', async () => {
      const s = await armadaleScraper.fetchSchedule('FRI-2');
      expect(s.generalDay).toBe('friday');
      expect(s.recyclingWeek).toBe('B');
    });

    it('throws for an unknown zone code', async () => {
      await expect(armadaleScraper.fetchSchedule('INVALID')).rejects.toThrow('Unknown Armadale zone code');
    });

    it('throws for an invalid day abbreviation', async () => {
      await expect(armadaleScraper.fetchSchedule('SAT-1')).rejects.toThrow();
    });

  });

  // ── armadaleCanHandle ───────────────────────────────────────────────────────

  describe('armadaleCanHandle', () => {

    it('returns true for Armadale LGA suburbs', () => {
      expect(armadaleCanHandle('armadale')).toBe(true);
      expect(armadaleCanHandle('Harrisdale')).toBe(true);  // case-insensitive
      expect(armadaleCanHandle('Kelmscott')).toBe(true);
      expect(armadaleCanHandle('Byford')).toBe(true);
      expect(armadaleCanHandle('Roleystone')).toBe(true);
    });

    it('returns false for non-Armadale suburbs', () => {
      expect(armadaleCanHandle('fremantle')).toBe(false);
      expect(armadaleCanHandle('clarkson')).toBe(false);
      expect(armadaleCanHandle('scarborough')).toBe(false);
    });

  });

  // ── healthCheck ─────────────────────────────────────────────────────────────

  describe('healthCheck', () => {

    it('passes with mocked API', async () => {
      const ok = await armadaleScraper.healthCheck();
      expect(ok).toBe(true);
    }, 15_000);

  });

});
