/**
 * Unit tests for zoneScheduleComputer.ts
 *
 * All tests are pure — no database, no network.
 * Week A reference: 2026-01-05 (Monday) per WEEK_A_REFERENCE constant.
 *
 * Day-of-week reference for 2026:
 *   2026-01-05 Mon = Week A reference
 *   2026-01-07 Wed = Week A
 *   2026-01-14 Wed = Week B
 *   2026-01-26 Mon = Week B  (Australia Day — public holiday)
 *   2026-04-03 Fri = Week A  (Good Friday)
 *   2026-12-31 Thu = Week B
 *   2027-01-07 Thu = Week A
 */

import { computeSchedule } from '../../src/services/zoneScheduleComputer';
import type { CollectionZone } from '@prisma/client';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal CollectionZone for testing. */
function makeZone(overrides: Partial<CollectionZone> = {}): CollectionZone {
  return {
    id: 'test-zone-id',
    councilId: 'test-council-id',
    zoneName: 'Test Zone',
    zoneCode: 'WED-A',
    generalDay: 'wednesday',
    generalFrequency: 'weekly',
    recyclingDay: 'wednesday',
    recyclingWeek: 'A',
    greenWasteDay: 'wednesday',
    greenWasteWeek: 'B',
    vergeDates: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  } as CollectionZone;
}

/** Parse an ISO date string to a UTC midnight Date. */
function utc(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('computeSchedule', () => {

  // ── Normal week (no holiday) ─────────────────────────────────────────────

  describe('normal week — no holidays', () => {
    const zone = makeZone(); // Wed, recycling=A, green=B
    const holidays: Date[] = [];

    it('returns general + recycling on Week A Wednesday', () => {
      const results = computeSchedule(zone, holidays, utc('2026-01-07'), 1);
      expect(results).toHaveLength(1);
      const c = results[0];
      expect(c.date).toBe('2026-01-07');
      expect(c.dayOfWeek).toBe('Wednesday');
      expect(c.types).toContain('general');
      expect(c.types).toContain('recycling');
      expect(c.types).not.toContain('green_waste');
      expect(c.isHolidayShifted).toBe(false);
      expect(c.eventType).toBe('kerbside');
    });

    it('returns general + green_waste on Week B Wednesday', () => {
      const results = computeSchedule(zone, holidays, utc('2026-01-14'), 1);
      expect(results).toHaveLength(1);
      const c = results[0];
      expect(c.date).toBe('2026-01-14');
      expect(c.types).toContain('general');
      expect(c.types).toContain('green_waste');
      expect(c.types).not.toContain('recycling');
    });

    it('returns only general when zone has no green waste configured', () => {
      const noGreenZone = makeZone({
        zoneCode: 'MON-A',
        generalDay: 'monday',
        recyclingDay: 'monday',
        recyclingWeek: 'A',
        greenWasteDay: null,
        greenWasteWeek: null,
      });
      // 2026-01-05 is Monday Week A — general + recycling only
      const results = computeSchedule(noGreenZone, [], utc('2026-01-05'), 1);
      expect(results[0].types).toContain('general');
      expect(results[0].types).toContain('recycling');
      expect(results[0].types).not.toContain('green_waste');
    });

    it('supports councils with weekly recycling', () => {
      const weeklyRecycleZone = makeZone({
        zoneCode: 'TUE-WEEKLY',
        generalDay: 'tuesday',
        recyclingDay: 'tuesday',
        recyclingWeek: 'weekly',
        greenWasteDay: 'tuesday',
        greenWasteWeek: 'B',
      });

      const weekAResults = computeSchedule(weeklyRecycleZone, [], utc('2026-03-17'), 1);
      expect(weekAResults[0].date).toBe('2026-03-17');
      expect(weekAResults[0].types).toContain('general');
      expect(weekAResults[0].types).toContain('recycling');
      expect(weekAResults[0].types).not.toContain('green_waste');

      const weekBResults = computeSchedule(weeklyRecycleZone, [], utc('2026-03-24'), 1);
      expect(weekBResults[0].date).toBe('2026-03-24');
      expect(weekBResults[0].types).toContain('general');
      expect(weekBResults[0].types).toContain('recycling');
      expect(weekBResults[0].types).toContain('green_waste');
    });

    it('keeps Friday 2026-03-20 in Week A for fortnightly services', () => {
      const friZone = makeZone({
        zoneCode: 'FRI-A',
        generalDay: 'friday',
        recyclingDay: 'friday',
        recyclingWeek: 'A',
        greenWasteDay: 'friday',
        greenWasteWeek: 'B',
      });

      const results = computeSchedule(friZone, [], utc('2026-03-20'), 1);
      expect(results[0].date).toBe('2026-03-20');
      expect(results[0].types).toContain('general');
      expect(results[0].types).toContain('recycling');
      expect(results[0].types).not.toContain('green_waste');
    });

    it('starts from "from" date — does not include earlier collections', () => {
      // Starting from Thursday should skip Wednesday collections from that week
      const results = computeSchedule(zone, holidays, utc('2026-01-08'), 1);
      expect(results[0].date).toBe('2026-01-14');
    });

    it('returns fogo instead of general for known FOGO councils', () => {
      const results = computeSchedule(zone, holidays, utc('2026-01-07'), 1, { councilSlug: 'fremantle' });
      expect(results[0].types).toContain('fogo');
      expect(results[0].types).not.toContain('general');
    });

    it('returns fogo when zone code explicitly marks a mixed-council FOGO zone', () => {
      const fogoZone = makeZone({
        zoneCode: 'BEL-FOGO-WED-A-S',
      });
      const results = computeSchedule(fogoZone, holidays, utc('2026-01-07'), 1);
      expect(results[0].types).toContain('fogo');
      expect(results[0].types).not.toContain('general');
    });
  });

  // ── Week A / Week B rotation ──────────────────────────────────────────────

  describe('Week A / Week B rotation', () => {
    const zone = makeZone(); // Wed, recycling=A, green=B
    const holidays: Date[] = [];

    it('alternates recycling and green_waste across 4 consecutive Wednesdays', () => {
      const results = computeSchedule(zone, holidays, utc('2026-01-07'), 4);
      expect(results).toHaveLength(4);

      // Week A: 2026-01-07
      expect(results[0].date).toBe('2026-01-07');
      expect(results[0].types).toContain('recycling');
      expect(results[0].types).not.toContain('green_waste');

      // Week B: 2026-01-14
      expect(results[1].date).toBe('2026-01-14');
      expect(results[1].types).toContain('green_waste');
      expect(results[1].types).not.toContain('recycling');

      // Week A: 2026-01-21
      expect(results[2].date).toBe('2026-01-21');
      expect(results[2].types).toContain('recycling');
      expect(results[2].types).not.toContain('green_waste');

      // Week B: 2026-01-28
      expect(results[3].date).toBe('2026-01-28');
      expect(results[3].types).toContain('green_waste');
      expect(results[3].types).not.toContain('recycling');
    });

    it('general waste appears every week', () => {
      const results = computeSchedule(zone, holidays, utc('2026-01-07'), 8);
      expect(results.every((c) => c.types.includes('general'))).toBe(true);
    });

    it('recycling appears every second week (4 times in 8 weeks)', () => {
      const results = computeSchedule(zone, holidays, utc('2026-01-07'), 8);
      const recyclingCount = results.filter((c) => c.types.includes('recycling')).length;
      expect(recyclingCount).toBe(4);
    });
  });

  // ── WA public holiday shift ───────────────────────────────────────────────

  describe('public holiday shift', () => {

    it('shifts Monday collection to Tuesday on Australia Day 2026', () => {
      const monZone = makeZone({
        zoneCode: 'MON-B',
        generalDay: 'monday',
        recyclingDay: 'monday',
        recyclingWeek: 'B',  // 2026-01-26 is Week B → recycling fires
        greenWasteDay: 'monday',
        greenWasteWeek: 'A',
      });
      // 2026-01-26 = Australia Day (Monday, Week B)
      const holidays = [utc('2026-01-26')];
      const results = computeSchedule(monZone, holidays, utc('2026-01-26'), 1);
      expect(results).toHaveLength(1);
      const c = results[0];
      expect(c.date).toBe('2026-01-27');          // shifted to Tuesday
      expect(c.dayOfWeek).toBe('Tuesday');
      expect(c.isHolidayShifted).toBe(true);
      expect(c.originalDate).toBe('2026-01-26');
      expect(c.types).toContain('general');
      expect(c.types).toContain('recycling');
    });

    it('shifts through multi-day Easter cluster (Good Friday → Tuesday)', () => {
      // Good Friday 2026-04-03 (Friday, Week A)
      // Easter Saturday 2026-04-04, Easter Sunday 2026-04-05, Easter Monday 2026-04-06 — all holidays
      // Collection should land on Tuesday 2026-04-07
      const friZone = makeZone({
        zoneCode: 'FRI-A',
        generalDay: 'friday',
        recyclingDay: 'friday',
        recyclingWeek: 'A',  // 2026-04-03 is Week A
        greenWasteDay: 'friday',
        greenWasteWeek: 'B',
      });
      const easterCluster = [
        utc('2026-04-03'), // Good Friday
        utc('2026-04-04'), // Easter Saturday
        utc('2026-04-05'), // Easter Sunday
        utc('2026-04-06'), // Easter Monday
      ];
      const results = computeSchedule(friZone, easterCluster, utc('2026-04-03'), 1);
      expect(results).toHaveLength(1);
      const c = results[0];
      expect(c.date).toBe('2026-04-07');          // 4 shifts: Fri→Sat→Sun→Mon→Tue
      expect(c.isHolidayShifted).toBe(true);
      expect(c.originalDate).toBe('2026-04-03');
    });

    it('does not shift collection when holiday is on a different day', () => {
      const wedZone = makeZone(); // Wednesday
      const holidays = [utc('2026-01-26')]; // Monday — different day
      const results = computeSchedule(wedZone, holidays, utc('2026-01-28'), 1);
      // Next Wednesday is 2026-02-04 (next week, Week A)
      // Wait — 2026-01-28 is after 2026-01-21 (Week A) and 2026-01-28 (Week B)
      // From 2026-01-28, next Wednesday = 2026-02-04
      expect(results[0].isHolidayShifted).toBe(false);
      expect(results[0].originalDate).toBeUndefined();
    });
  });

  // ── Year boundary ─────────────────────────────────────────────────────────

  describe('year boundary (Dec → Jan)', () => {
    // 2026-12-31 is Thursday, Week B
    // 2027-01-07 is Thursday, Week A

    it('correctly crosses from December into January', () => {
      const thuZone = makeZone({
        zoneCode: 'THU-A',
        generalDay: 'thursday',
        recyclingDay: 'thursday',
        recyclingWeek: 'A',
        greenWasteDay: 'thursday',
        greenWasteWeek: 'B',
      });
      const results = computeSchedule(thuZone, [], utc('2026-12-31'), 3);
      expect(results).toHaveLength(3);

      // 2026-12-31 (Thu, Week B) → general + green_waste
      expect(results[0].date).toBe('2026-12-31');
      expect(results[0].types).toContain('general');
      expect(results[0].types).toContain('green_waste');
      expect(results[0].types).not.toContain('recycling');

      // 2027-01-07 (Thu, Week A) → general + recycling
      expect(results[1].date).toBe('2027-01-07');
      expect(results[1].types).toContain('general');
      expect(results[1].types).toContain('recycling');
      expect(results[1].types).not.toContain('green_waste');

      // 2027-01-14 (Thu, Week B) → general + green_waste
      expect(results[2].date).toBe('2027-01-14');
      expect(results[2].types).toContain('green_waste');
    });

    it('applies New Year holiday shift correctly (2027-01-01 falls on Friday)', () => {
      // 2027-01-01 is Friday. Zone collecting on Friday gets shifted.
      const friZone = makeZone({
        zoneCode: 'FRI-B',
        generalDay: 'friday',
        recyclingDay: 'friday',
        recyclingWeek: 'B',
        greenWasteDay: 'friday',
        greenWasteWeek: 'A',
      });
      const holidays = [utc('2027-01-01')]; // New Year's Day
      const results = computeSchedule(friZone, holidays, utc('2027-01-01'), 1);
      expect(results[0].date).toBe('2027-01-02');  // shifted to Saturday
      expect(results[0].isHolidayShifted).toBe(true);
      expect(results[0].originalDate).toBe('2027-01-01');
    });
  });

  // ── Verge / special event dates ───────────────────────────────────────────

  describe('verge dates', () => {
    it('includes verge events from vergeDates within the date range', () => {
      const zone = makeZone({
        vergeDates: ['2026-03-15', '2026-06-20'] as unknown as CollectionZone['vergeDates'],
      });
      const results = computeSchedule(zone, [], utc('2026-03-01'), 20);
      const vergeDates = results.filter((c) => c.eventType === 'verge').map((c) => c.date);
      expect(vergeDates).toContain('2026-03-15');
      expect(vergeDates).toContain('2026-06-20');
    });

    it('excludes verge events before the from date', () => {
      const zone = makeZone({
        vergeDates: ['2026-01-01'] as unknown as CollectionZone['vergeDates'],
      });
      const results = computeSchedule(zone, [], utc('2026-03-01'), 20);
      const vergeDates = results.filter((c) => c.eventType === 'verge').map((c) => c.date);
      expect(vergeDates).not.toContain('2026-01-01');
    });

    it('sets correct eventType and empty types array for verge events', () => {
      const zone = makeZone({
        vergeDates: ['2026-04-15'] as unknown as CollectionZone['vergeDates'],
      });
      const results = computeSchedule(zone, [], utc('2026-04-15'), 20);
      const verge = results.find((c) => c.eventType === 'verge');
      expect(verge).toBeDefined();
      expect(verge!.types).toEqual([]);
      expect(verge!.isHolidayShifted).toBe(false);
    });
  });

  // ── Count / lookahead ────────────────────────────────────────────────────

  describe('count behaviour', () => {
    const zone = makeZone();
    const holidays: Date[] = [];

    it('returns exactly count events', () => {
      expect(computeSchedule(zone, holidays, utc('2026-01-07'), 5)).toHaveLength(5);
      expect(computeSchedule(zone, holidays, utc('2026-01-07'), 1)).toHaveLength(1);
      expect(computeSchedule(zone, holidays, utc('2026-01-07'), 20)).toHaveLength(20);
    });

    it('returns results in chronological order', () => {
      const results = computeSchedule(zone, holidays, utc('2026-01-07'), 8);
      for (let i = 1; i < results.length; i++) {
        expect(results[i].date >= results[i - 1].date).toBe(true);
      }
    });
  });

});
