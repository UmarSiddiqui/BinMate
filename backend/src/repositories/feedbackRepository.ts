import prisma from '../utils/prisma';
import type { Feedback } from '@prisma/client';

export interface NewFeedback {
  category: string;
  message: string;
  zoneId?: string;
  appVersion?: string;
}

/** Persist a feedback submission. Anonymous by design — never accepts a user id. */
export async function createFeedback(input: NewFeedback): Promise<Feedback> {
  return prisma.feedback.create({
    data: {
      category: input.category,
      message: input.message,
      zoneId: input.zoneId ?? null,
      appVersion: input.appVersion ?? null,
    },
  });
}
