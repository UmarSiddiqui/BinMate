import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAdminAuth } from './middleware';
import { renderDashboard } from './dashboard';
import {
  clearAddressCache,
  createHoliday,
  deleteHoliday,
  getAdminSummary,
  getUserDetail,
  getZonePreview,
  listAddressCache,
  listCouncilStats,
  listHolidays,
  listUsers,
  listZones,
  softDeleteUser,
  toggleCouncilActive,
  updateHoliday,
} from './data';
import { getSystemHealthSummary } from './data-system';
import { runAllScraperHealthChecks, runAllScrapers, runScraper } from './scrapers';
import { logger } from '../utils/logger';
import { SCRAPER_REGISTRY } from '../scrapers/registry';
import { runNotificationEngine } from '../jobs/notificationEngine';

const adminRouter = Router();

const holidaySchema = z.object({
  name: z.string().trim().min(1),
  date: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
});

/** All /admin routes require Basic Auth. */
adminRouter.use(requireAdminAuth);

/** GET /admin — serves the HTML admin dashboard shell. */
adminRouter.get('/', (_req: Request, res: Response) => {
  res.send(renderDashboard());
});

/** GET /admin/api/summary — high-level admin cards and metrics. */
adminRouter.get('/api/summary', async (_req: Request, res: Response) => {
  try {
    const [summary, system] = await Promise.all([getAdminSummary(), getSystemHealthSummary()]);
    res.json({ summary, system });
  } catch (err) {
    respondWithError(res, 'Failed to load admin summary', err);
  }
});

/** GET /admin/api/scrapers — list councils and scraper coverage. */
adminRouter.get('/api/scrapers', async (_req: Request, res: Response) => {
  try {
    res.json(await listCouncilStats());
  } catch (err) {
    respondWithError(res, 'Failed to load scrapers', err);
  }
});

/** GET /admin/api/scrapers/health — run a live health check for each scraper. */
adminRouter.get('/api/scrapers/health', async (_req: Request, res: Response) => {
  try {
    res.json(await runAllScraperHealthChecks());
  } catch (err) {
    respondWithError(res, 'Failed to run scraper health checks', err);
  }
});

/** POST /admin/api/scrapers/run-all — refresh every registered scraper. */
adminRouter.post('/api/scrapers/run-all', async (_req: Request, res: Response) => {
  try {
    res.json(await runAllScrapers());
  } catch (err) {
    respondWithError(res, 'Failed to run scrapers', err);
  }
});

/** POST /admin/api/scrapers/:slug/health — run healthCheck() for one scraper. */
adminRouter.post('/api/scrapers/:slug/health', async (req: Request, res: Response) => {
  const entry = SCRAPER_REGISTRY[req.params.slug];
  if (!entry) {
    res.status(404).json({ error: `No scraper registered for '${req.params.slug}'` });
    return;
  }

  try {
    res.json({ slug: req.params.slug, healthy: await entry.scraper.healthCheck() });
  } catch (err) {
    res.json({ slug: req.params.slug, healthy: false, error: toMessage(err) });
  }
});

/** POST /admin/api/scrapers/:slug/run — refresh seeded zones for one scraper. */
adminRouter.post('/api/scrapers/:slug/run', async (req: Request, res: Response) => {
  try {
    res.json(await runScraper(req.params.slug));
  } catch (err) {
    const message = toMessage(err);
    const status = message.includes('not found') || message.includes('No scraper') ? 404 : 500;
    res.status(status).json({ error: message });
  }
});

/** GET /admin/api/zones — browse collection zones, optionally filtered by council. */
adminRouter.get('/api/zones', async (req: Request, res: Response) => {
  try {
    const councilSlug = typeof req.query.councilSlug === 'string' ? req.query.councilSlug : undefined;
    res.json(await listZones(councilSlug));
  } catch (err) {
    respondWithError(res, 'Failed to load zones', err);
  }
});

/** GET /admin/api/zones/:zoneId — zone detail with schedule preview. */
adminRouter.get('/api/zones/:zoneId', async (req: Request, res: Response) => {
  try {
    const count = parseCount(req.query.count);
    const result = await getZonePreview(req.params.zoneId, count);

    if (!result.zone) {
      res.status(404).json({ error: 'Zone not found' });
      return;
    }

    res.json(result);
  } catch (err) {
    respondWithError(res, 'Failed to load zone detail', err);
  }
});

/** GET /admin/api/address-cache — search recent address resolutions. */
adminRouter.get('/api/address-cache', async (req: Request, res: Response) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q : undefined;
    res.json(await listAddressCache(query));
  } catch (err) {
    respondWithError(res, 'Failed to load address cache', err);
  }
});

/** GET /admin/api/holidays — list WA public holidays. */
adminRouter.get('/api/holidays', async (_req: Request, res: Response) => {
  try {
    res.json(await listHolidays());
  } catch (err) {
    respondWithError(res, 'Failed to load holidays', err);
  }
});

/** POST /admin/api/holidays — create a holiday row. */
adminRouter.post('/api/holidays', async (req: Request, res: Response) => {
  try {
    const payload = holidaySchema.parse(req.body);
    res.status(201).json(await createHoliday(payload.name, new Date(payload.date)));
  } catch (err) {
    respondWithValidationOrServerError(res, 'Failed to create holiday', err);
  }
});

/** PUT /admin/api/holidays/:id — update a holiday row. */
adminRouter.put('/api/holidays/:id', async (req: Request, res: Response) => {
  try {
    const payload = holidaySchema.parse(req.body);
    res.json(await updateHoliday(req.params.id, payload.name, new Date(payload.date)));
  } catch (err) {
    respondWithValidationOrServerError(res, 'Failed to update holiday', err);
  }
});

/** DELETE /admin/api/holidays/:id — remove a holiday row. */
adminRouter.delete('/api/holidays/:id', async (req: Request, res: Response) => {
  try {
    await deleteHoliday(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    respondWithError(res, 'Failed to delete holiday', err);
  }
});

/** GET /admin/api/users — list users without exposing push token values. */
adminRouter.get('/api/users', async (req: Request, res: Response) => {
  try {
    const subscriptionStatus =
      typeof req.query.subscriptionStatus === 'string' ? req.query.subscriptionStatus : undefined;
    res.json(await listUsers(subscriptionStatus));
  } catch (err) {
    respondWithError(res, 'Failed to load users', err);
  }
});

/** GET /admin/api/users/:userId — user detail, linked zones only. */
adminRouter.get('/api/users/:userId', async (req: Request, res: Response) => {
  try {
    const user = await getUserDetail(req.params.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json(user);
  } catch (err) {
    respondWithError(res, 'Failed to load user', err);
  }
});

/** PATCH /admin/api/councils/:id/toggle — toggle a council's isActive flag. */
adminRouter.patch('/api/councils/:id/toggle', async (req: Request, res: Response) => {
  try {
    const council = await toggleCouncilActive(req.params.id);
    res.json({ id: council.id, isActive: council.isActive });
  } catch (err) {
    respondWithError(res, 'Failed to toggle council', err);
  }
});

/** DELETE /admin/api/address-cache — clear the entire address cache. */
adminRouter.delete('/api/address-cache', async (_req: Request, res: Response) => {
  try {
    res.json(await clearAddressCache());
  } catch (err) {
    respondWithError(res, 'Failed to clear address cache', err);
  }
});

/** DELETE /admin/api/users/:userId — soft-delete a user. */
adminRouter.delete('/api/users/:userId', async (req: Request, res: Response) => {
  try {
    await softDeleteUser(req.params.userId);
    res.json({ ok: true });
  } catch (err) {
    respondWithError(res, 'Failed to delete user', err);
  }
});

/** GET /admin/api/system/health — DB and deployment summary. */
adminRouter.get('/api/system/health', async (_req: Request, res: Response) => {
  try {
    res.json(await getSystemHealthSummary());
  } catch (err) {
    respondWithError(res, 'Failed to load system health', err);
  }
});

/** POST /admin/api/system/notifications/trigger — manual notification run. */
adminRouter.post('/api/system/notifications/trigger', async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production' && req.get('X-Admin-Confirm') !== 'RUN_NOW') {
    res.status(409).json({ error: 'Confirmation required in production' });
    return;
  }

  try {
    await runNotificationEngine();
    res.json({ ok: true });
  } catch (err) {
    respondWithError(res, 'Failed to trigger notifications', err);
  }
});

export default adminRouter;

/** Clamp count query params to a sane preview size. */
function parseCount(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 20;
  }

  return Math.min(Math.trunc(parsed), 50);
}

/** Return a safe string from unknown errors. */
function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Unknown error';
}

/** Send a standard 500 JSON error and log the underlying failure. */
function respondWithError(
  res: Response,
  message: string,
  err: unknown
): void {
  logger.error(message, { err });
  res.status(500).json({ error: message });
}

/** Return validation errors as 400, otherwise log and return 500. */
function respondWithValidationOrServerError(
  res: Response,
  message: string,
  err: unknown
): void {
  if (err instanceof z.ZodError) {
    res.status(400).json({ error: err.issues[0]?.message ?? 'Invalid request body' });
    return;
  }

  respondWithError(res, message, err);
}
