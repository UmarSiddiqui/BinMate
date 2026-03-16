/**
 * Town of Mosman Park scraper tests.
 *
 * Uses the live public T1Cloud property search.
 *
 * Verified address choice:
 *   39 Jameson Street MOSMAN PARK WA 6012
 *   Live response on 2026-03-16:
 *     Bin Day       = FRIDAY
 *     Recycling Day = WEEK 1 FRIDAY
 *
 * Official 2025-26 Waste & Recycling Guide mapping:
 *   Week 1 = yellow recycling week = BinMate Week A
 *   Week 2 = red general-waste week = BinMate Week B
 */

import { mosmanParkCanHandle, mosmanParkScraper } from '../../src/scrapers/mosmanpark';

describe('mosmanParkScraper.resolveAddress', () => {
  it('resolves a Mosman Park address to a MOS zone', async () => {
    const result = await mosmanParkScraper.resolveAddress('39 Jameson Street MOSMAN PARK WA 6012');
    expect(result.error).toBeUndefined();
    expect(result.zoneCode).toBe('MOS-FRI-A');
    expect(result.zoneName).toContain('Mosman Park');
    expect(result.zoneName).toContain('Friday');
    expect(result.councilSlug).toBe('mosmanpark');
  }, 30_000);

  it('resolves the same property without suburb/postcode suffixes', async () => {
    const result = await mosmanParkScraper.resolveAddress('39 Jameson Street');
    expect(result.error).toBeUndefined();
    expect(result.zoneCode).toBe('MOS-FRI-A');
  }, 30_000);

  it('returns an error for an address outside the Mosman Park service area', async () => {
    const result = await mosmanParkScraper.resolveAddress('1 Rokeby Road SUBIACO WA 6008');
    expect(result.zoneCode).toBe('');
    expect(result.error).toBeTruthy();
  }, 30_000);
});

describe('mosmanParkScraper.fetchSchedule', () => {
  it('returns weekly FOGO + Week A recycling for MOS-FRI-A', async () => {
    const schedule = await mosmanParkScraper.fetchSchedule('MOS-FRI-A');
    expect(schedule.generalDay).toBe('friday');
    expect(schedule.generalFrequency).toBe('weekly');
    expect(schedule.recyclingDay).toBe('friday');
    expect(schedule.recyclingWeek).toBe('A');
    expect(schedule.greenWasteDay).toBe('friday');
    expect(schedule.greenWasteWeek).toBe('B');
  });

  it('returns the opposite rubbish week for MOS-TUE-B', async () => {
    const schedule = await mosmanParkScraper.fetchSchedule('MOS-TUE-B');
    expect(schedule.generalDay).toBe('tuesday');
    expect(schedule.recyclingWeek).toBe('B');
    expect(schedule.greenWasteWeek).toBe('A');
  });

  it('throws for an unknown zone code', async () => {
    await expect(mosmanParkScraper.fetchSchedule('MOS-XXX-Z')).rejects.toThrow(
      /Unknown Mosman Park zone code/,
    );
  });
});

describe('mosmanParkScraper.healthCheck', () => {
  it('passes against the live Mosman Park T1Cloud API', async () => {
    const ok = await mosmanParkScraper.healthCheck();
    expect(ok).toBe(true);
  }, 30_000);
});

describe('mosmanParkCanHandle', () => {
  it.each([
    'mosman park',
    'Mosman Park',
    'MOSMAN PARK',
  ])('accepts "%s"', (suburb) => {
    expect(mosmanParkCanHandle(suburb)).toBe(true);
  });

  it.each([
    'peppermint grove',
    'claremont',
    'cottesloe',
    '',
  ])('rejects "%s"', (suburb) => {
    expect(mosmanParkCanHandle(suburb)).toBe(false);
  });
});
