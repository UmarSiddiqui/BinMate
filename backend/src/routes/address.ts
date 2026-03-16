import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { resolveAddress } from '../services/addressService';
import { getSchedule } from '../services/scheduleService';
import { createUser, findUserByPushToken, upsertUserZone } from '../repositories/userRepository';
import { logger } from '../utils/logger';

/** Maximum register-address requests allowed per IP inside one rate-limit window. */
const REGISTER_ADDRESS_RATE_LIMIT_MAX = 10;

/** Register-address rate-limit window in milliseconds. */
const REGISTER_ADDRESS_RATE_LIMIT_WINDOW_MS = 60 * 1000;

const RegisterBody = z.object({
  address: z.string().min(5).max(200),
  pushToken: z.string().optional(),
});

/**
 * Create the rate-limited register-address router.
 */
export function createAddressRouter(): Router {
  const router = Router();

  const registerAddressLimiter = rateLimit({
    windowMs: REGISTER_ADDRESS_RATE_LIMIT_WINDOW_MS,
    limit: REGISTER_ADDRESS_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many address lookup requests. Please try again shortly.' },
  });

  /**
   * POST /api/v1/register-address
   * Geocode a Perth address, link to a collection zone, optionally create a user.
   */
  router.post('/', registerAddressLimiter, async (req, res) => {
    try {
      const parsed = RegisterBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0].message });
        return;
      }

      const { address, pushToken } = parsed.data;
      const resolution = await resolveAddress(address);
      if ('error' in resolution) {
        const status = resolution.error === 'council_not_supported' ? 422 : 400;
        res.status(status).json({ error: resolution.message });
        return;
      }

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
    } catch (err) {
      logger.error('Register address failed', { err });
      res.status(500).json({ error: 'Failed to register address' });
    }
  });

  return router;
}
