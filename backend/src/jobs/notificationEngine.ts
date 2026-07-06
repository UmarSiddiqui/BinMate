import cron from 'node-cron';
import { logger } from '../utils/logger';
import { sendPushNotification } from '../services/notifications';
import type { BinType } from '../services/zoneScheduleComputer';
import { findUsersForZone } from '../repositories/userRepository';
import { getZonesCollectingTomorrow } from '../services/scheduleService';

// ─── Schedule ─────────────────────────────────────────────────────────────────

/** Runs nightly at 17:00 AWST = 09:00 UTC. */
const CRON_SCHEDULE = '0 9 * * *';

// ─── Engine ───────────────────────────────────────────────────────────────────

/** Send tomorrow's collection reminders for all zones. */
export async function runNotificationEngine(): Promise<void> {
  logger.info('Notification engine: starting run');

  const zones = await getZonesCollectingTomorrow();

  if (!zones.length) {
    logger.info('Notification engine: no collections tomorrow');
    return;
  }

  let totalSent = 0;
  let totalFailed = 0;

  for (const { zoneId, councilName, collections } of zones) {
    const users = await findUsersForZone(zoneId);
    if (!users.length) continue;

    const binTypes = collections[0]?.types ?? [];

    const payload = buildPayload(binTypes, councilName);

    for (const user of users) {
      try {
        await sendPushNotification(user.pushToken, payload);
        totalSent++;
      } catch (err) {
        logger.error('Notification send failed', { zoneId, err });
        totalFailed++;
      }
    }
  }

  logger.info('Notification engine: run complete', {
    zonesWithCollections: zones.length,
    totalSent,
    totalFailed,
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build APNs payload from bin types. Copy sourced from BRAND.md §7
 * ("Bin Collection — night before"): `{binTypes} bins. {councilName}. Out by 6am tomorrow.`
 * Bin types render as lid colours per the BRAND.md example ("Yellow + Red bins. Stirling Council.").
 */
function buildPayload(
  types: BinType[],
  councilName: string
): { title: string; body: string } {
  const binLabels: Record<BinType, string> = {
    general: 'Red',
    recycling: 'Yellow',
    green_waste: 'Green',
    fogo: 'Lime',
  };

  const bins = types.map((t) => binLabels[t]).join(' + ');
  const title = 'Bins out tonight';
  const body = `${bins} bin${types.length > 1 ? 's' : ''}. ${councilName}. Out by 6am tomorrow.`;

  return { title, body };
}

// ─── Cron registration ────────────────────────────────────────────────────────

/** Register the nightly cron. Call once at server startup. */
export function startNotificationCron(): void {
  cron.schedule(CRON_SCHEDULE, async () => {
    try {
      await runNotificationEngine();
    } catch (err) {
      logger.error('Notification engine: unhandled error', { err });
    }
  }, { timezone: 'UTC' });

  logger.info('Notification cron scheduled', { schedule: CRON_SCHEDULE, note: '09:00 UTC = 17:00 AWST' });
}
