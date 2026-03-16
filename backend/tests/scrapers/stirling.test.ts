/**
 * City of Stirling scraper tests.
 *
 * Address-level tests use real Nominatim geocoding + the live Stirling API.
 * Coordinate-level tests bypass Nominatim and call the API directly with
 * confirmed-good coordinates (safer for CI — avoids Nominatim precision issues
 * on major arterial roads).
 *
 * Test coordinates confirmed on 2026-03-16:
 *   Joondanna  (-31.9046,  115.8432) → STI-WED-A  (Wednesday, recycling Week A)
 *   Dianella   (-31.8703,  115.8663) → STI-FRI-A  (Friday,    recycling Week A)
 *   Floreat    (-31.9181,  115.7911) → STI-TUE-B  (Tuesday,   recycling Week B)
 *   Tuart Hill (-31.9059,  115.8519) → STI-THU-B  (Thursday,  recycling Week B)
 *
 * Test address for resolveAddress (live Nominatim + API):
 *   Dianella is used because Collins Road is a residential street (not an
 *   arterial road) and Nominatim typically resolves it to a precise point.
 */

import {
  stirlingScraper,
  stirlingCanHandle,
  stirlingResolveCoordinates,
} from '../../src/scrapers/stirling';

// ─── stirlingResolveCoordinates (API without Nominatim) ───────────────────────

describe('stirlingResolveCoordinates', () => {
  it('resolves Joondanna coordinates to STI-WED-A', async () => {
    const result = await stirlingResolveCoordinates(-31.9046, 115.8432);
    expect(result.error).toBeUndefined();
    expect(result.zoneCode).toBe('STI-WED-A');
    expect(result.zoneName).toMatch(/Stirling/);
    expect(result.zoneName).toMatch(/Wednesday/i);
    expect(result.zoneName).toMatch(/Week A/);
    expect(result.councilSlug).toBe('stirling');
  }, 15_000);

  it('resolves Dianella coordinates to STI-FRI-A', async () => {
    const result = await stirlingResolveCoordinates(-31.8703, 115.8663);
    expect(result.error).toBeUndefined();
    expect(result.zoneCode).toBe('STI-FRI-A');
    expect(result.zoneName).toMatch(/Friday/i);
  }, 15_000);

  it('resolves Floreat coordinates to STI-TUE-B', async () => {
    const result = await stirlingResolveCoordinates(-31.9181, 115.7911);
    expect(result.error).toBeUndefined();
    expect(result.zoneCode).toBe('STI-TUE-B');
    expect(result.zoneName).toMatch(/Tuesday/i);
    expect(result.zoneName).toMatch(/Week B/);
  }, 15_000);

  it('resolves Tuart Hill coordinates to STI-THU-B', async () => {
    const result = await stirlingResolveCoordinates(-31.9059, 115.8519);
    expect(result.error).toBeUndefined();
    expect(result.zoneCode).toBe('STI-THU-B');
    expect(result.zoneName).toMatch(/Thursday/i);
  }, 15_000);

  it('returns an error for coordinates outside the Stirling collection area', async () => {
    // CBD of Perth — inside Perth metro but not a Stirling residential property
    const result = await stirlingResolveCoordinates(-31.9505, 115.8605);
    expect(result.zoneCode).toBe('');
    expect(result.error).toBeTruthy();
  }, 15_000);
});

// ─── stirlingScraper.resolveAddress (full Nominatim + API round-trip) ─────────

describe('stirlingScraper.resolveAddress', () => {
  it('resolves a Dianella suburb address to a STI-THU zone', async () => {
    // "Dianella WA 6059" — suburb-level query geocodes to the Nominatim administrative
    // centroid at (-31.8923, 115.8742), which falls in a Thursday collection zone.
    // Expected: STI-THU-A (Thursday, recycling Week A — confirmed 2026-03-16).
    // Note: specific house-number addresses on major arterial roads may return empty
    // if Nominatim returns road-centroid coordinates instead of property-level coords.
    const result = await stirlingScraper.resolveAddress('Dianella WA 6059');
    expect(result.error).toBeUndefined();
    expect(result.zoneCode).toMatch(/^STI-THU-(A|B)$/);
    expect(result.councilSlug).toBe('stirling');
  }, 30_000);

  it('returns an error for an address in a different council (Fremantle)', async () => {
    const result = await stirlingScraper.resolveAddress(
      '15 South Terrace Fremantle WA 6160',
    );
    expect(result.zoneCode).toBe('');
    expect(result.error).toBeTruthy();
  }, 30_000);
});

// ─── stirlingScraper.fetchSchedule ────────────────────────────────────────────

describe('stirlingScraper.fetchSchedule', () => {
  it('returns correct schedule for STI-TUE-A', async () => {
    const s = await stirlingScraper.fetchSchedule('STI-TUE-A');
    expect(s.zoneCode).toBe('STI-TUE-A');
    expect(s.generalDay).toBe('tuesday');
    expect(s.generalFrequency).toBe('weekly');
    expect(s.recyclingDay).toBe('tuesday');
    expect(s.recyclingWeek).toBe('A');
    expect(s.greenWasteDay).toBe('tuesday');
    expect(s.greenWasteWeek).toBe('B');   // opposite week to recycling
    expect(s.vergeDates).toBeNull();
  });

  it('returns correct schedule for STI-WED-B', async () => {
    const s = await stirlingScraper.fetchSchedule('STI-WED-B');
    expect(s.zoneCode).toBe('STI-WED-B');
    expect(s.generalDay).toBe('wednesday');
    expect(s.recyclingWeek).toBe('B');
    expect(s.greenWasteWeek).toBe('A');   // opposite week
  });

  it('returns correct schedule for STI-FRI-A', async () => {
    const s = await stirlingScraper.fetchSchedule('STI-FRI-A');
    expect(s.generalDay).toBe('friday');
    expect(s.recyclingWeek).toBe('A');
    expect(s.greenWasteWeek).toBe('B');
  });

  it('throws for an unknown zone code', async () => {
    await expect(stirlingScraper.fetchSchedule('STI-XXX-Z')).rejects.toThrow(
      /Unknown Stirling zone code/,
    );
  });
});

// ─── stirlingScraper.healthCheck ──────────────────────────────────────────────

describe('stirlingScraper.healthCheck', () => {
  it('passes against the live Stirling API', async () => {
    const ok = await stirlingScraper.healthCheck();
    expect(ok).toBe(true);
  }, 15_000);
});

// ─── stirlingCanHandle ────────────────────────────────────────────────────────

describe('stirlingCanHandle', () => {
  it.each([
    'scarborough',
    'Scarborough',
    'SCARBOROUGH',
    'dianella',
    'Dianella',
    'balcatta',
    'nollamara',
    'osborne park',
    'Osborne Park',
    'innaloo',
    'karrinyup',
    'gwelup',
    'carine',
    'trigg',
    'joondanna',
    'tuart hill',
    'westminster',
    'floreat',
    'mount lawley',
    'mirrabooka',
    'wembley downs',
    'stirling',
    'hamersley',
  ])('accepts "%s"', (suburb) => {
    expect(stirlingCanHandle(suburb)).toBe(true);
  });

  it.each([
    'fremantle',
    'applecross',
    'subiaco',
    'midland',
    'northbridge',
    'perth',
    'duncraig',    // City of Joondalup
    'north perth', // City of Vincent
    'leederville', // City of Vincent
    '',
  ])('rejects "%s"', (suburb) => {
    expect(stirlingCanHandle(suburb)).toBe(false);
  });
});
