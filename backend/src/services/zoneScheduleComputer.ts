import type { CollectionZone } from '@prisma/client';

// ─── Public Types ─────────────────────────────────────────────────────────────

export type BinType = 'general' | 'recycling' | 'green_waste' | 'fogo';
export type EventType = 'kerbside' | 'verge' | 'ewaste' | 'green_waste_drop';

export interface Collection {
  date: string;           // ISO 8601 "2026-03-19"
  dayOfWeek: string;      // "Wednesday"
  types: BinType[];
  eventType: EventType;
  isHolidayShifted: boolean;
  originalDate?: string;  // set if shifted from a public holiday
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Known Perth Week-A reference Monday. Verify per-council when scraping. */
const WEEK_A_REFERENCE = new Date('2026-01-05T00:00:00.000Z');

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Max days to look ahead when collecting results. Prevents infinite loops. */
const MAX_LOOKAHEAD_DAYS = 400;
const FOGO_ALWAYS_COUNCILS = new Set([
  'fremantle',
  'melville',
  'mosmanpark',
  'nedlands',
  'peppermintgrove',
  'subiaco',
  'vincent',
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Return a new Date set to UTC midnight for the given date. */
function utcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Add N days to a UTC midnight date. */
function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

/** Return ISO date string "YYYY-MM-DD" for a UTC midnight date. */
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Return true if two UTC midnight Dates are the same calendar day. */
function sameDay(a: Date, b: Date): boolean {
  return isoDate(a) === isoDate(b);
}

/**
 * Determine whether a given UTC midnight date falls in Week A or Week B.
 * Weeks alternate starting from WEEK_A_REFERENCE (which is Week A).
 */
function getWeekLabel(d: Date): 'A' | 'B' {
  const msPerWeek = 7 * 86_400_000;
  const diffMs = utcMidnight(d).getTime() - utcMidnight(WEEK_A_REFERENCE).getTime();
  const diffWeeks = Math.floor(diffMs / msPerWeek);
  return diffWeeks % 2 === 0 ? 'A' : 'B';
}

/** Apply WA public holiday shift: if date is a holiday, move it forward until it isn't. */
function applyHolidayShift(
  date: Date,
  holidays: Date[]
): { date: Date; shifted: boolean; originalDate?: Date } {
  const original = date;
  let shifted = date;
  let isShifted = false;

  // Max 7 iterations guards against pathological holiday clusters
  for (let i = 0; i < 7; i++) {
    if (!holidays.some((h) => sameDay(h, shifted))) break;
    shifted = addDays(shifted, 1);
    isShifted = true;
  }

  return { date: shifted, shifted: isShifted, originalDate: isShifted ? original : undefined };
}

/** Return true when the zone's weekly "general" stream is actually FOGO. */
function isFogoZone(
  zone: CollectionZone,
  councilSlug?: string
): boolean {
  const zoneCode = zone.zoneCode?.toUpperCase() ?? '';
  const zoneName = zone.zoneName.toLowerCase();

  // Mixed councils encode FOGO directly in zone code.
  if (zoneCode.includes('-FOGO-')) return true;

  // Some councils are fully FOGO; in these councils the weekly "general" stream
  // is the lime-lid FOGO service.
  if (councilSlug && FOGO_ALWAYS_COUNCILS.has(councilSlug.toLowerCase())) {
    return true;
  }

  // Fallback for explicitly named zones.
  return zoneName.includes('fogo');
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * Compute upcoming kerbside collections for a zone.
 * Returns the next `count` collection events on or after `from`.
 */
export function computeSchedule(
  zone: CollectionZone,
  holidays: Date[],
  from: Date,
  count: number,
  context?: { councilSlug?: string }
): Collection[] {
  const results: Collection[] = [];
  const start = utcMidnight(from);
  const holidayDates = holidays.map(utcMidnight);

  let cursor = start;
  let iterations = 0;

  while (results.length < count && iterations < MAX_LOOKAHEAD_DAYS) {
    iterations++;
    const dayIndex = cursor.getUTCDay(); // 0=Sun … 6=Sat
    const dayName = DAY_NAMES[dayIndex];
    const weekLabel = getWeekLabel(cursor);

    const types: BinType[] = [];

    // ── General waste ──────────────────────────────────────────────────────
    if (zone.generalDay === dayName) {
      types.push(isFogoZone(zone, context?.councilSlug) ? 'fogo' : 'general');
    }

    // ── Recycling (weekly or fortnightly) ──────────────────────────────────
    if (
      zone.recyclingDay === dayName &&
      (zone.recyclingWeek === 'weekly' || zone.recyclingWeek === weekLabel)
    ) {
      types.push('recycling');
    }

    // ── Green waste (weekly or fortnightly, optional) ─────────────────────
    if (
      zone.greenWasteDay &&
      zone.greenWasteWeek &&
      zone.greenWasteDay === dayName &&
      (zone.greenWasteWeek === 'weekly' || zone.greenWasteWeek === weekLabel)
    ) {
      types.push('green_waste');
    }

    if (types.length > 0) {
      const { date: finalDate, shifted, originalDate } = applyHolidayShift(cursor, holidayDates);

      results.push({
        date: isoDate(finalDate),
        dayOfWeek: DAY_LABELS[finalDate.getUTCDay()],
        types,
        eventType: 'kerbside',
        isHolidayShifted: shifted,
        ...(originalDate ? { originalDate: isoDate(originalDate) } : {}),
      });
    }

    cursor = addDays(cursor, 1);
  }

  // ── Verge / special events ─────────────────────────────────────────────
  if (zone.vergeDates) {
    const vergeDatesRaw = zone.vergeDates as string[];
    const vergeEvents = vergeDatesRaw
      .map((d) => utcMidnight(new Date(d)))
      .filter((d) => d >= start)
      .map((d): Collection => ({
        date: isoDate(d),
        dayOfWeek: DAY_LABELS[d.getUTCDay()],
        types: [],
        eventType: 'verge',
        isHolidayShifted: false,
      }));

    results.push(...vergeEvents);
    results.sort((a, b) => a.date.localeCompare(b.date));
  }

  return results.slice(0, count);
}
