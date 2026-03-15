import { findZoneById } from '../repositories/zoneRepository';
import { getHolidaysBetween } from '../repositories/holidayRepository';
import { computeSchedule, type Collection } from './zoneScheduleComputer';
import { logger } from '../utils/logger';

/** Default number of upcoming collections to return. */
const DEFAULT_COUNT = 20;

/** How far ahead to fetch holidays (days). */
const HOLIDAY_LOOKAHEAD_DAYS = 120;

export interface ScheduleResult {
  zoneId: string;
  councilName: string;
  collections: Collection[];
}

export interface ScheduleError {
  error: 'zone_not_found' | 'schedule_unavailable';
  message: string;
}

/**
 * Return upcoming collection events for a zone.
 * Applies WA public holiday shifts automatically.
 */
export async function getSchedule(
  zoneId: string,
  from: Date = new Date(),
  count: number = DEFAULT_COUNT
): Promise<ScheduleResult | ScheduleError> {
  const zone = await findZoneById(zoneId);
  if (!zone) {
    return { error: 'zone_not_found', message: 'Zone not found' };
  }

  const holidayEnd = new Date(from);
  holidayEnd.setDate(holidayEnd.getDate() + HOLIDAY_LOOKAHEAD_DAYS);
  const holidays = await getHolidaysBetween(from, holidayEnd);

  try {
    const collections = computeSchedule(zone, holidays, from, count);
    logger.info('Schedule computed', { zoneId, count: collections.length });
    return { zoneId, councilName: zone.council.name, collections };
  } catch (err) {
    logger.error('Schedule computation failed', { err, zoneId });
    return { error: 'schedule_unavailable', message: 'Schedule temporarily unavailable' };
  }
}

/**
 * Return zones that have a kerbside collection tomorrow.
 * Used by the nightly notification cron.
 */
export async function getZonesCollectingTomorrow(): Promise<
  Array<{ zoneId: string; collections: Collection[] }>
> {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);

  const dayAfter = new Date(tomorrow);
  dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);

  const holidays = await getHolidaysBetween(tomorrow, dayAfter);

  // Fetch all zones and check each one — suitable for current zone count (<200)
  const zones = await import('../repositories/zoneRepository').then((r) =>
    r.findZonesByCouncil('').catch(() => [])
  );

  const result: Array<{ zoneId: string; collections: Collection[] }> = [];

  for (const zone of zones) {
    const collections = computeSchedule(zone, holidays, tomorrow, 1);
    if (collections.length > 0 && collections[0].date === tomorrow.toISOString().slice(0, 10)) {
      result.push({ zoneId: zone.id, collections });
    }
  }

  return result;
}
