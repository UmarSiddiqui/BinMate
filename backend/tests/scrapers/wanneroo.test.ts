/**
 * City of Wanneroo scraper tests.
 *
 * Test addresses chosen as suburb-level queries — Nominatim reliably resolves these.
 *   - Girrawheen WA 6064          → MON-A (Group 1, Monday)
 *   - Clarkson WA 6030            → WED-A (Group 2, Wednesday)
 *   - Wanneroo WA 6065            → FRI-A (Group 2, Friday)
 *
 * NOTE: resolveAddress calls Nominatim. Tests have a 15s timeout.
 * Run with: npm test -- tests/scrapers/wanneroo.test.ts
 */

import { wannerooScraper } from '../../src/scrapers/wanneroo';

describe('WannerooScraper', () => {

  // ── resolveAddress ─────────────────────────────────────────────────────────

  describe('resolveAddress', () => {

    it('resolves Group 1 Monday suburb (Girrawheen)', async () => {
      const result = await wannerooScraper.resolveAddress('Girrawheen WA 6064');
      expect(result.error).toBeUndefined();
      expect(result.zoneCode).toBe('MON-A');
      expect(result.councilSlug).toBe('wanneroo');
    }, 15_000);

    it('resolves Group 2 Wednesday suburb (Clarkson)', async () => {
      const result = await wannerooScraper.resolveAddress('Clarkson WA 6030');
      expect(result.error).toBeUndefined();
      expect(result.zoneCode).toBe('WED-A');
    }, 15_000);

    it('resolves Group 2 Friday suburb (Sinagra)', async () => {
      // Sinagra WA 6065 — Nominatim reliably returns "Sinagra" as the suburb
      const result = await wannerooScraper.resolveAddress('Sinagra WA 6065');
      expect(result.error).toBeUndefined();
      expect(result.zoneCode).toBe('FRI-A');
    }, 15_000);

    it('returns an error for a non-Wanneroo suburb (Fremantle)', async () => {
      const result = await wannerooScraper.resolveAddress('Fremantle WA 6160');
      expect(result.error).toBeDefined();
      expect(result.zoneCode).toBe('');
    }, 15_000);

  });

  // ── fetchSchedule ─────────────────────────────────────────────────────────

  describe('fetchSchedule', () => {

    it('returns correct schedule for MON-A', async () => {
      const s = await wannerooScraper.fetchSchedule('MON-A');
      expect(s.generalDay).toBe('monday');
      expect(s.generalFrequency).toBe('weekly');
      expect(s.recyclingDay).toBe('monday');
      expect(s.recyclingWeek).toBe('A');
      expect(s.greenWasteDay).toBe('monday');
      expect(s.greenWasteWeek).toBe('B');
    });

    it('returns correct schedule for WED-A', async () => {
      const s = await wannerooScraper.fetchSchedule('WED-A');
      expect(s.generalDay).toBe('wednesday');
      expect(s.recyclingWeek).toBe('A');
      expect(s.greenWasteWeek).toBe('B');
    });

    it('returns correct schedule for TUE-B (green waste opposite week)', async () => {
      const s = await wannerooScraper.fetchSchedule('TUE-B');
      expect(s.generalDay).toBe('tuesday');
      expect(s.recyclingWeek).toBe('B');
      expect(s.greenWasteWeek).toBe('A');
    });

    it('throws for an unknown zone code', async () => {
      await expect(wannerooScraper.fetchSchedule('INVALID')).rejects.toThrow('Unknown zone code');
    });

  });

  // ── healthCheck ───────────────────────────────────────────────────────────

  describe('healthCheck', () => {

    it('passes against live Nominatim', async () => {
      const ok = await wannerooScraper.healthCheck();
      expect(ok).toBe(true);
    }, 15_000);

  });

});
