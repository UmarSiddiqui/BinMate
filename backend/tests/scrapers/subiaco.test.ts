/**
 * City of Subiaco scraper tests.
 *
 * Uses the T1Cloud Intramaps API at subiaco.spatial.t1cloud.com.
 * All tests hit the live API — no mocks.
 *
 * Verified address (2026-03-16):
 *   1 Rokeby Road SUBIACO WA 6008
 *   → Recycle Collection: "Tuesday, Week 1 (24 Mar 2026)" → Perth Week B → SUB-TUE-B
 *
 * Note: Subiaco "Week 1" = Perth Week B; "Week 2" = Perth Week A.
 * Zone week is determined by parsing the date in the response, NOT the "Week N" label.
 */

import { subiacoScraper, subiacoCanHandle } from '../../src/scrapers/subiaco';

// ─── subiacoScraper.resolveAddress ────────────────────────────────────────────

describe('subiacoScraper.resolveAddress', () => {
  it('resolves a Subiaco LGA address to a SUB zone', async () => {
    // 1 Rokeby Road SUBIACO — confirmed Tuesday, recycling Week B (2026-03-16)
    const result = await subiacoScraper.resolveAddress('1 Rokeby Road SUBIACO WA 6008');
    expect(result.error).toBeUndefined();
    expect(result.zoneCode).toMatch(/^SUB-TUE-(A|B)$/);
    expect(result.zoneName).toMatch(/Subiaco/);
    expect(result.zoneName).toMatch(/Tuesday/i);
    expect(result.councilSlug).toBe('subiaco');
  }, 30_000);

  it('resolves a Shenton Park address to a SUB zone', async () => {
    // Shenton Park is within the City of Subiaco LGA
    const result = await subiacoScraper.resolveAddress('1 Shenton Road SHENTON PARK WA 6008');
    expect(result.error).toBeUndefined();
    expect(result.zoneCode).toMatch(/^SUB-(MON|TUE|WED|THU|FRI)-(A|B)$/);
    expect(result.councilSlug).toBe('subiaco');
  }, 30_000);

  it('returns an error for an address outside the Subiaco LGA', async () => {
    const result = await subiacoScraper.resolveAddress('1 Sandgate Street SOUTH PERTH WA 6151');
    expect(result.zoneCode).toBe('');
    expect(result.error).toBeTruthy();
  }, 30_000);
});

// ─── subiacoScraper.fetchSchedule ─────────────────────────────────────────────

describe('subiacoScraper.fetchSchedule', () => {
  it('returns correct schedule for SUB-TUE-B', async () => {
    const s = await subiacoScraper.fetchSchedule('SUB-TUE-B');
    expect(s.zoneCode).toBe('SUB-TUE-B');
    expect(s.generalDay).toBe('tuesday');
    expect(s.generalFrequency).toBe('weekly');  // FOGO weekly
    expect(s.recyclingDay).toBe('tuesday');
    expect(s.recyclingWeek).toBe('B');
    expect(s.greenWasteDay).toBeNull();         // FOGO replaces green waste
    expect(s.greenWasteWeek).toBeNull();
    expect(s.vergeDates).toBeNull();
  });

  it('returns correct schedule for SUB-MON-A', async () => {
    const s = await subiacoScraper.fetchSchedule('SUB-MON-A');
    expect(s.zoneCode).toBe('SUB-MON-A');
    expect(s.generalDay).toBe('monday');
    expect(s.recyclingWeek).toBe('A');
  });

  it('returns correct schedule for SUB-FRI-B', async () => {
    const s = await subiacoScraper.fetchSchedule('SUB-FRI-B');
    expect(s.generalDay).toBe('friday');
    expect(s.recyclingWeek).toBe('B');
  });

  it('throws for an unknown zone code', async () => {
    await expect(subiacoScraper.fetchSchedule('SUB-XXX-Z')).rejects.toThrow(
      /Unknown Subiaco zone code/,
    );
  });
});

// ─── subiacoScraper.healthCheck ───────────────────────────────────────────────

describe('subiacoScraper.healthCheck', () => {
  it('passes against the live Subiaco T1Cloud API', async () => {
    const ok = await subiacoScraper.healthCheck();
    expect(ok).toBe(true);
  }, 30_000);
});

// ─── subiacoCanHandle ─────────────────────────────────────────────────────────

describe('subiacoCanHandle', () => {
  it.each([
    'subiaco',
    'Subiaco',
    'SUBIACO',
    'shenton park',
    'Shenton Park',
    'daglish',
    'jolimont',
  ])('accepts "%s"', (suburb) => {
    expect(subiacoCanHandle(suburb)).toBe(true);
  });

  it.each([
    'nedlands',
    'claremont',
    'cottesloe',
    'fremantle',
    'south perth',
    'perth',
    '',
  ])('rejects "%s"', (suburb) => {
    expect(subiacoCanHandle(suburb)).toBe(false);
  });
});
