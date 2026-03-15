import 'dotenv/config';
import express from 'express';
import { logger } from './utils/logger';
import { startNotificationCron } from './jobs/notificationEngine';
import addressRouter from './routes/address';
import scheduleRouter from './routes/schedule';
import userRouter from './routes/user';
import webhookRouter from './routes/webhook';

// ─── Validate required env vars ───────────────────────────────────────────────

const requiredEnv = ['DATABASE_URL'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    logger.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}

// ─── App setup ────────────────────────────────────────────────────────────────

const app = express();
const PORT = parseInt(process.env.PORT ?? '3000', 10);

app.use(express.json());

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/api/v1/health', async (_req, res) => {
  let dbStatus: 'ok' | 'error' = 'ok';
  try {
    const { default: prisma } = await import('./utils/prisma');
    await prisma.council.count();
  } catch {
    dbStatus = 'error';
  }
  res.json({ status: 'ok', version: '1.0.0', env: process.env.NODE_ENV, db: dbStatus });
});

// ─── API routes ───────────────────────────────────────────────────────────────

app.use('/api/v1/register-address', addressRouter);
app.use('/api/v1/schedule', scheduleRouter);
app.use('/api/v1/push-token', userRouter);
app.use('/api/v1/webhook/revenuecat', webhookRouter);

// ─── 404 handler ─────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ─── Error handler ────────────────────────────────────────────────────────────

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { err });
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  logger.info(`BinMate API running on http://localhost:${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);
  if (process.env.NODE_ENV !== 'test') {
    startNotificationCron();
  }
});

export default app;
