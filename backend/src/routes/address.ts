import { Router } from 'express';
import { z } from 'zod';
import { resolveAddress } from '../services/addressService';
import { getSchedule } from '../services/scheduleService';
import { createUser, findUserByPushToken, upsertUserZone } from '../repositories/userRepository';
import { logger } from '../utils/logger';

const router = Router();

const RegisterBody = z.object({
  address: z.string().min(5).max(200),
  pushToken: z.string().optional(),
});

/**
 * POST /api/v1/register-address
 * Geocode a Perth address, link to a collection zone, optionally create a user.
 */
router.post('/', async (req, res) => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const { address, pushToken } = parsed.data;

  // Resolve address → zone
  const resolution = await resolveAddress(address);
  if ('error' in resolution) {
    const status = resolution.error === 'council_not_supported' ? 422 : 400;
    res.status(status).json({ error: resolution.message });
    return;
  }

  // Create or retrieve user
  let userId: string | undefined;
  if (pushToken) {
    const existing = await findUserByPushToken(pushToken);
    if (existing) {
      userId = existing.id;
    } else {
      const created = await createUser(pushToken);
      userId = created.id;
    }

    await upsertUserZone({
      userId,
      zoneId: resolution.zoneId,
      addressLabel: resolution.suburb,
      isPrimary: true,
    });
  }

  // Return zone + next 5 collections
  const schedule = await getSchedule(resolution.zoneId, new Date(), 5);
  const nextCollections = 'collections' in schedule ? schedule.collections : [];

  logger.info('Address registered', { councilName: resolution.councilName });

  res.json({
    zoneId: resolution.zoneId,
    councilName: resolution.councilName,
    suburb: resolution.suburb,
    userId,
    nextCollections,
  });
});

export default router;
