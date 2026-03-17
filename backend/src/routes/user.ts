import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { findUserById, updatePushToken } from '../repositories/userRepository';
import { logger } from '../utils/logger';

const router = Router();

const PushTokenBody = z.object({
  userId: z.string().uuid(),
  pushToken: z.string().min(10).max(512),
  notificationHour: z.number().int().min(0).max(23).optional(),
});

/**
 * PUT /api/v1/push-token
 * Update a user's APNs push token and optional notification hour.
 */
router.put('/', async (req: Request, res: Response) => {
  const parsed = PushTokenBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const { userId, pushToken, notificationHour } = parsed.data;

  const user = await findUserById(userId);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  await updatePushToken(userId, pushToken, notificationHour);
  logger.info('Push token updated', { userId });

  res.json({ ok: true });
});

export default router;
