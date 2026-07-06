import { logger } from '../utils/logger';

/**
 * Push notification service — MOCKED for local development.
 *
 * TODO (Phase 2.2): Replace with real APNs implementation.
 * Recommended: Direct APNs HTTP/2 API (free, no third party needed).
 * Required from Apple Developer portal:
 *   - APNs Auth Key (.p8 file)  → APNS_KEY_PATH
 *   - Key ID                    → APNS_KEY_ID
 *   - Team ID                   → APNS_TEAM_ID
 *   - Bundle ID                 → app.binmate.ios
 *
 * Alternative: Firebase Admin SDK (FCM → APNs bridge)
 *   npm install firebase-admin
 *   Set FCM_SERVICE_ACCOUNT_KEY env var.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  /** APNs category — set to 'BIN_REMINDER' on bin day reminders so iOS shows the snooze action. */
  category?: string;
}

export interface SendResult {
  success: boolean;
  error?: string;
}

export interface BatchResult {
  sent: number;
  failed: number;
  errors: string[];
}

// ─── Single send ──────────────────────────────────────────────────────────────

/** Send a push notification to a single APNs token. */
export async function sendPushNotification(
  pushToken: string,
  payload: PushPayload
): Promise<SendResult> {
  // MOCK: log instead of sending
  logger.info('[MOCK PUSH] Notification queued', {
    tokenPrefix: pushToken.substring(0, 8),
    title: payload.title,
  });
  return { success: true };
}

// ─── Batch send ───────────────────────────────────────────────────────────────

/** Send the same notification to multiple APNs tokens. */
export async function sendBatchNotifications(
  pushTokens: string[],
  payload: PushPayload
): Promise<BatchResult> {
  logger.info('[MOCK PUSH] Batch notifications queued', {
    count: pushTokens.length,
    title: payload.title,
  });
  return { sent: pushTokens.length, failed: 0, errors: [] };
}

// ─── Token validation ─────────────────────────────────────────────────────────

/**
 * Mark tokens that came back as invalid (BadDeviceToken, Unregistered).
 * Called after a real send — no-op in mock mode.
 */
export async function invalidateTokens(_invalidTokens: string[]): Promise<void> {
  // TODO: update push_token to null for these user records in database
  logger.debug('[MOCK PUSH] Token invalidation skipped in mock mode');
}
