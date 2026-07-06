import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  createUser,
  findUserById,
  findUserByPushToken,
  replaceUserZones,
  updatePushToken,
} from '../repositories/userRepository';
import { logger } from '../utils/logger';

/** Maximum saved addresses one device can subscribe to. */
const MAX_ZONES_PER_DEVICE = 5;

const SyncBody = z.object({
  pushToken: z.string().min(10).max(512),
  /** Known BinMate user ID — lets the backend follow APNs token rotation. */
  userId: z.string().uuid().optional(),
  zones: z
    .array(
      z.object({
        zoneId: z.string().min(1).max(64),
        addressLabel: z.string().min(1).max(80),
        isPrimary: z.boolean(),
      })
    )
    .max(MAX_ZONES_PER_DEVICE),
});

const router = Router();

/**
 * PUT /api/v1/user-zones
 * Replace the full set of zones a device receives bin-day reminders for.
 */
router.put('/', async (req: Request, res: Response) => {
  try {
    const parsed = SyncBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    const { pushToken, userId, zones } = parsed.data;

    let user = userId ? await findUserById(userId) : null;
    if (!user) user = await findUserByPushToken(pushToken);
    if (!user) user = await createUser(pushToken);

    if (user.pushToken !== pushToken) {
      await updatePushToken(user.id, pushToken);
    }

    await replaceUserZones(user.id, zones);

    logger.info('User zones synced', { userId: user.id, zoneCount: zones.length });
    res.json({ ok: true, userId: user.id });
  } catch (err) {
    logger.error('User zones sync failed', { err });
    res.status(500).json({ error: 'Failed to sync zones' });
  }
});

export default router;
