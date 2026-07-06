import express, { type NextFunction, type Request, type Response } from 'express';
import { logger } from './utils/logger';
import { createAddressRouter } from './routes/address';
import scheduleRouter from './routes/schedule';
import userRouter from './routes/user';
import userZonesRouter from './routes/userZones';
import feedbackRouter from './routes/feedback';
import { createCronRouter } from './routes/cron';
import adminRouter from './admin/router';

/** App boot timestamp, used as deployment metadata in health responses. */
const APP_STARTED_AT = new Date().toISOString();

/**
 * Create the BinMate Express application.
 */
export function createApp(): express.Express {
  const app = express();

  app.use(express.json());

  app.get('/api/v1/health', async (_req: Request, res: Response) => {
    let dbStatus: 'ok' | 'error' = 'ok';
    try {
      const { default: prisma } = await import('./utils/prisma');
      await prisma.council.count();
    } catch {
      dbStatus = 'error';
    }

    res.json({
      status: 'ok',
      version: '1.0.0',
      env: process.env.NODE_ENV,
      db: dbStatus,
      deployment: {
        serviceName: process.env.RENDER_SERVICE_NAME ?? 'local',
        gitSha: process.env.RENDER_GIT_COMMIT ?? 'local',
        startedAt: APP_STARTED_AT,
      },
    });
  });

  app.use('/api/v1/register-address', createAddressRouter());
  app.use('/api/v1/schedule', scheduleRouter);
  app.use('/api/v1/push-token', userRouter);
  app.use('/api/v1/user-zones', userZonesRouter);
  app.use('/api/v1/feedback', feedbackRouter);
  app.use('/api/v1/cron', createCronRouter());
  app.use('/admin', adminRouter);

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled error', { err });
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
