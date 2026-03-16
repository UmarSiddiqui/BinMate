import request from 'supertest';

jest.mock('../../src/utils/prisma', () => ({
  __esModule: true,
  default: {
    council: {
      count: jest.fn().mockResolvedValue(1),
    },
  },
}));

function createTestApp() {
  process.env.DATABASE_URL = 'postgresql://binmate:binmate@localhost:5432/binmate';
  process.env.RENDER_SERVICE_NAME = 'binmate-api';
  process.env.RENDER_GIT_COMMIT = 'abc123def456';
  const { createApp } = require('../../src/app') as typeof import('../../src/app');
  return createApp();
}

describe('GET /api/v1/health', () => {
  it('returns db status and deployment metadata', async () => {
    const app = createTestApp();
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.db).toBe('ok');
    expect(response.body.deployment.serviceName).toBe('binmate-api');
    expect(response.body.deployment.gitSha).toBe('abc123def456');
    expect(typeof response.body.deployment.startedAt).toBe('string');
  });
});
