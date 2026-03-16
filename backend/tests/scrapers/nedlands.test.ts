/**
 * City of Nedlands scraper tests.
 *
 * Uses the self-hosted IntraMaps 21b API at gispublic01.nedlands.wa.gov.au.
 * All tests hit the live API — no mocks.
 *
 * Verified address (2026-03-16):
 *   14B Adderley Street MT CLAREMONT
 *   → FOGO Collection Day: "Monday"
 *   → Next Recycling Bin Day: "Monday, 16 Mar 2026" → Perth Week A → NED-MON-A
 *
 * resolveAddress tests use free-text search (IntraMaps 21b fullText).
 */

import { nedlandsScraper, nedlandsCanHandle } from '../../src/scrapers/nedlands';

// ─── nedlandsScraper.resolveAddress ───────────────────────────────────────────

describe('nedlandsScraper.resolveAddress', () => {
  it('resolves a Nedlands LGA address to a NED zone', async () => {
    // 14B Adderley Street MT CLAREMONT — confirmed Monday, recycling Week A (2026-03-16)
    const result = await nedlandsScraper.resolveAddress('14B Adderley Street MT CLAREMONT');
    expect(result.error).toBeUndefined();
    expect(result.zoneCode).toMatch(/^NED-MON-(A|B)$/);
    expect(result.zoneName).toMatch(/Nedlands/);
    expect(result.zoneName).toMatch(/Monday/i);
    expect(result.councilSlug).toBe('nedlands');
  }, 30_000);

  it('returns an error for an address outside the Nedlands LGA', async () => {
    const result = await nedlandsScraper.resolveAddress('1 Sandgate Street SOUTH PERTH WA 6151');
    expect(result.zoneCode).toBe('');
    expect(result.error).toBeTruthy();
  }, 30_000);
});

// ─── nedlandsScraper.fetchSchedule ────────────────────────────────────────────

describe('nedlandsScraper.fetchSchedule', () => {
  it('returns correct schedule for NED-MON-A', async () => {
    const s = await nedlandsScraper.fetchSchedule('NED-MON-A');
    expect(s.zoneCode).toBe('NED-MON-A');
    expect(s.generalDay).toBe('monday');
    expect(s.generalFrequency).toBe('weekly');  // FOGO weekly
    expect(s.recyclingDay).toBe('monday');
    expect(s.recyclingWeek).toBe('A');
    expect(s.greenWasteDay).toBeNull();         // FOGO replaces green waste
    expect(s.greenWasteWeek).toBeNull();
    expect(s.vergeDates).toBeNull();
  });

  it('returns correct schedule for NED-WED-B', async () => {
    const s = await nedlandsScraper.fetchSchedule('NED-WED-B');
    expect(s.zoneCode).toBe('NED-WED-B');
    expect(s.generalDay).toBe('wednesday');
    expect(s.recyclingWeek).toBe('B');
  });

  it('returns correct schedule for NED-FRI-A', async () => {
    const s = await nedlandsScraper.fetchSchedule('NED-FRI-A');
    expect(s.generalDay).toBe('friday');
    expect(s.recyclingWeek).toBe('A');
  });

  it('throws for an unknown zone code', async () => {
    await expect(nedlandsScraper.fetchSchedule('NED-XXX-Z')).rejects.toThrow(
      /Unknown Nedlands zone code/,
    );
  });
});

// ─── nedlandsScraper.healthCheck ──────────────────────────────────────────────

describe('nedlandsScraper.healthCheck', () => {
  it('passes against the live Nedlands IntraMaps 21b API', async () => {
    const ok = await nedlandsScraper.healthCheck();
    expect(ok).toBe(true);
  }, 30_000);
});

// ─── nedlandsCanHandle ────────────────────────────────────────────────────────

describe('nedlandsCanHandle', () => {
  it.each([
    'nedlands',
    'Nedlands',
    'NEDLANDS',
    'dalkeith',
    'Dalkeith',
    'swanbourne',
    'mt claremont',
    'mount claremont',
    'hollywood',
    'karrakatta',
  ])('accepts "%s"', (suburb) => {
    expect(nedlandsCanHandle(suburb)).toBe(true);
  });

  it.each([
    'subiaco',
    'claremont',
    'cottesloe',
    'fremantle',
    'south perth',
    'perth',
    '',
  ])('rejects "%s"', (suburb) => {
    expect(nedlandsCanHandle(suburb)).toBe(false);
  });
});
