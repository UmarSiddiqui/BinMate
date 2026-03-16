import request from 'supertest';

jest.mock('../../src/jobs/notificationEngine', () => ({
  runNotificationEngine: jest.fn(),
}));

const { runNotificationEngine } = require('../../src/jobs/notificationEngine') as {
  runNotificationEngine: jest.Mock;
};

function createTestApp() {
  process.env.DATABASE_URL = 'postgresql://binmate:binmate@localhost:5432/binmate';
  const { createApp } = require('../../src/app') as typeof import('../../src/app');
  return createApp();
}

describe('POST /api/v1/cron/trigger-notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = 'test-cron-secret';
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it('rejects requests without the bearer secret', async () => {
    const app = createTestApp();
    const response = await request(app).post('/api/v1/cron/trigger-notifications');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Unauthorized' });
    expect(runNotificationEngine).not.toHaveBeenCalled();
  });

  it('returns 503 when CRON_SECRET is not configured', async () => {
    delete process.env.CRON_SECRET;

    const app = createTestApp();
    const response = await request(app)
      .post('/api/v1/cron/trigger-notifications')
      .set('Authorization', 'Bearer ignored');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: 'Cron trigger disabled' });
    expect(runNotificationEngine).not.toHaveBeenCalled();
  });

  it('runs the notification engine when given the correct bearer secret', async () => {
    runNotificationEngine.mockResolvedValue(undefined);

    const app = createTestApp();
    const response = await request(app)
      .post('/api/v1/cron/trigger-notifications')
      .set('Authorization', 'Bearer test-cron-secret');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
    expect(runNotificationEngine).toHaveBeenCalledTimes(1);
  });

  it('returns 500 when the notification engine throws', async () => {
    runNotificationEngine.mockRejectedValue(new Error('boom'));

    const app = createTestApp();
    const response = await request(app)
      .post('/api/v1/cron/trigger-notifications')
      .set('Authorization', 'Bearer test-cron-secret');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Failed to trigger notifications' });
  });
});
