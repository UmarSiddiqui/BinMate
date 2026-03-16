import 'dotenv/config';
import { logger } from './utils/logger';
import { startNotificationCron } from './jobs/notificationEngine';
import { createApp } from './app';

// ─── Validate required env vars ───────────────────────────────────────────────

const requiredEnv = ['DATABASE_URL'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    logger.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}

// ─── App setup ────────────────────────────────────────────────────────────────

const app = createApp();
const PORT = parseInt(process.env.PORT ?? '3000', 10);

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  logger.info(`BinMate API running on http://localhost:${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);
  if (process.env.NODE_ENV !== 'test') {
    startNotificationCron();
  }
});

export default app;
