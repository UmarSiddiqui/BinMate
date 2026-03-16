import { Router, type Request, type Response, type NextFunction } from 'express';
import { runNotificationEngine } from '../jobs/notificationEngine';
import { logger } from '../utils/logger';

/** Error text returned when cron triggering has not been configured. */
const CRON_SECRET_MISSING_MESSAGE = 'Cron trigger disabled';

/** Extract a Bearer token from the Authorization header. */
function getBearerToken(header: string | undefined): string | null {
  if (!header?.startsWith('Bearer ')) {
    return null;
  }

  return header.slice('Bearer '.length).trim() || null;
}

/** Require a valid CRON_SECRET Bearer token before allowing manual notification runs. */
function requireCronSecret(req: Request, res: Response, next: NextFunction): void {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    res.status(503).json({ error: CRON_SECRET_MISSING_MESSAGE });
    return;
  }

  const bearerToken = getBearerToken(req.headers.authorization);
  if (bearerToken !== cronSecret) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}

/**
 * Create the protected cron router.
 */
export function createCronRouter(): Router {
  const router = Router();

  /**
   * POST /api/v1/cron/trigger-notifications
   * Manually trigger the nightly notification engine.
   */
  router.post('/trigger-notifications', requireCronSecret, async (_req, res) => {
    try {
      await runNotificationEngine();
      res.json({ ok: true });
    } catch (err) {
      logger.error('Manual notification trigger failed', { err });
      res.status(500).json({ error: 'Failed to trigger notifications' });
    }
  });

  return router;
}
