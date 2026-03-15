import { Router } from 'express';
import { updateSubscriptionStatus } from '../repositories/userRepository';
import { logger } from '../utils/logger';

const router = Router();

/** Auth header value from RevenueCat dashboard → Settings → Webhooks. */
const RC_AUTH_HEADER = process.env.REVENUECAT_WEBHOOK_AUTH_HEADER;

// ─── RevenueCat event → subscription status mapping ──────────────────────────

type SubscriptionStatus = 'free' | 'trial' | 'active' | 'expired';

const EVENT_STATUS_MAP: Record<string, SubscriptionStatus> = {
  INITIAL_PURCHASE: 'active',
  RENEWAL: 'active',
  PRODUCT_CHANGE: 'active',
  CANCELLATION: 'active',     // still active until period ends
  EXPIRATION: 'expired',
  BILLING_ISSUE: 'active',    // give benefit of doubt until expiration
  TRIAL_STARTED: 'trial',
  TRIAL_CONVERTED: 'active',
  TRIAL_CANCELLED: 'free',
  UNCANCELLATION: 'active',
  SUBSCRIBER_ALIAS: 'active',
  TRANSFER: 'active',
};

/**
 * POST /api/v1/webhook/revenuecat
 * Validates the RevenueCat auth header and updates user subscription status.
 */
router.post('/', async (req, res) => {
  // Validate auth header (skip in development if not set)
  if (RC_AUTH_HEADER) {
    const incomingAuth = req.headers['authorization'];
    if (incomingAuth !== RC_AUTH_HEADER) {
      logger.warn('RevenueCat webhook: invalid auth header');
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  }

  const event = req.body?.event;
  if (!event?.type || !event?.app_user_id) {
    res.status(400).json({ error: 'Invalid webhook payload' });
    return;
  }

  const eventType: string = event.type;
  const userId: string = event.app_user_id;
  const newStatus = EVENT_STATUS_MAP[eventType];

  if (!newStatus) {
    // Unknown event type — acknowledge without acting
    logger.info('RevenueCat webhook: unknown event type, ignoring', { eventType });
    res.json({ ok: true });
    return;
  }

  try {
    await updateSubscriptionStatus(userId, newStatus);
    logger.info('Subscription status updated', { userId, eventType, newStatus });
  } catch (err) {
    // User may not exist in our DB yet (e.g. web purchase) — not a hard error
    logger.warn('RevenueCat webhook: could not update user', { userId, err });
  }

  res.json({ ok: true });
});

export default router;
