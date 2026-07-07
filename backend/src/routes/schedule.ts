import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getSchedule } from '../services/scheduleService';

const router = Router();

const ScheduleQuery = z.object({
  zoneId: z.string().uuid(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  count: z.coerce.number().int().min(1).max(365).default(20),
});

/**
 * GET /api/v1/schedule
 * Return upcoming collections for a zone.
 */
router.get('/', async (req: Request, res: Response) => {
  const parsed = ScheduleQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const { zoneId, from, count } = parsed.data;
  const fromDate = from ? new Date(`${from}T00:00:00.000Z`) : new Date();

  const result = await getSchedule(zoneId, fromDate, count);

  if ('error' in result) {
    const status = result.error === 'zone_not_found' ? 404 : 503;
    res.status(status).json({ error: result.message });
    return;
  }

  res.json(result);
});

export default router;
