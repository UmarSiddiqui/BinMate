/**
 * City of South Perth scraper tests.
 *
 * Live address used: 1 Sandgate Street SOUTH PERTH WA 6151
 *   — chosen because it is the civic address of South Perth Council itself,
 *     guaranteed to exist in the T1Cloud dataset, and verified on 2026-03-16
 *     to return zone COSP-TUE-A (Tuesday collection, recycling Week A).
 */

import { southPerthScraper, southPerthCanHandle } from '../../src/scrapers/southperth';

// ─── resolveAddress ───────────────────────────────────────────────────────────

describe('southPerthScraper.resolveAddress', () => {
  it('resolves a known South Perth address to COSP-TUE-A', async () => {
    const result = await southPerthScraper.resolveAddress(
      '1 Sandgate Street SOUTH PERTH WA 6151',
    );
    expect(result.error).toBeUndefined();
    expect(result.zoneCode).toBe('COSP-TUE-A');
    expect(result.zoneName).toMatch(/South Perth/);
    expect(result.zoneName).toMatch(/Tuesday/i);
    expect(result.zoneName).toMatch(/Week A/);
    expect(result.councilSlug).toBe('south-perth');
  }, 30_000);

  it('returns an error for an address outside the South Perth LGA', async () => {
    // Northbridge address — well outside South Perth LGA
    const result = await southPerthScraper.resolveAddress(
      '1 James Street NORTHBRIDGE WA 6003',
    );
    expect(result.zoneCode).toBe('');
    expect(result.error).toBeTruthy();
  }, 30_000);
});

// ─── fetchSchedule ────────────────────────────────────────────────────────────

describe('southPerthScraper.fetchSchedule', () => {
  it('returns correct schedule for COSP-TUE-A', async () => {
    const schedule = await southPerthScraper.fetchSchedule('COSP-TUE-A');
    expect(schedule.zoneCode).toBe('COSP-TUE-A');
    expect(schedule.generalDay).toBe('tuesday');
    expect(schedule.generalFrequency).toBe('weekly');
    expect(schedule.recyclingDay).toBe('tuesday');
    expect(schedule.recyclingWeek).toBe('A');
    expect(schedule.greenWasteDay).toBeNull();
    expect(schedule.greenWasteWeek).toBeNull();
    expect(schedule.vergeDates).toBeNull();
  });

  it('returns correct schedule for COSP-WED-B', async () => {
    const schedule = await southPerthScraper.fetchSchedule('COSP-WED-B');
    expect(schedule.zoneCode).toBe('COSP-WED-B');
    expect(schedule.generalDay).toBe('wednesday');
    expect(schedule.recyclingDay).toBe('wednesday');
    expect(schedule.recyclingWeek).toBe('B');
  });

  it('throws for an unknown zone code', async () => {
    await expect(southPerthScraper.fetchSchedule('COSP-XXX-Z')).rejects.toThrow(
      /Unknown South Perth zone code/,
    );
  });
});

// ─── healthCheck ──────────────────────────────────────────────────────────────

describe('southPerthScraper.healthCheck', () => {
  it('passes against the live T1Cloud endpoint', async () => {
    const ok = await southPerthScraper.healthCheck();
    expect(ok).toBe(true);
  }, 30_000);
});

// ─── southPerthCanHandle ──────────────────────────────────────────────────────

describe('southPerthCanHandle', () => {
  it.each([
    'south perth',
    'South Perth',
    'SOUTH PERTH',
    'kensington',
    'Kensington',
    'como',
    'Como',
    'karawara',
    'waterford',
    'salter point',
  ])('accepts "%s"', (suburb) => {
    expect(southPerthCanHandle(suburb)).toBe(true);
  });

  it.each([
    'perth',
    'northbridge',
    'subiaco',
    'midland',
    'applecross',
    '',
  ])('rejects "%s"', (suburb) => {
    expect(southPerthCanHandle(suburb)).toBe(false);
  });
});
