import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { createFeedback } from '../repositories/feedbackRepository';
import { logger } from '../utils/logger';

const router = Router();

const FEEDBACK_CATEGORIES = [
  'missed_bin',
  'wrong_schedule',
  'ui',
  'feature_request',
  'other',
] as const;

const FeedbackBody = z.object({
  category: z.enum(FEEDBACK_CATEGORIES),
  message: z.string().trim().min(3).max(2000),
  zoneId: z.string().uuid().optional(),
  appVersion: z.string().max(32).optional(),
});

/**
 * POST /api/v1/feedback
 * Store anonymous user feedback (missed bins, wrong data, UI, feature requests).
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const parsed = FeedbackBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    const saved = await createFeedback(parsed.data);
    logger.info('Feedback received', { id: saved.id, category: saved.category });

    res.status(201).json({ ok: true, id: saved.id });
  } catch (err) {
    logger.error('feedback failed', { err });
    res.status(500).json({ error: 'Failed to save feedback' });
  }
});

export default router;
