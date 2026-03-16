import request from 'supertest';

jest.mock('../../src/services/addressService', () => ({
  resolveAddress: jest.fn(),
}));

jest.mock('../../src/services/scheduleService', () => ({
  getSchedule: jest.fn(),
}));

jest.mock('../../src/repositories/userRepository', () => ({
  createUser: jest.fn(),
  findUserByPushToken: jest.fn(),
  upsertUserZone: jest.fn(),
}));

const { resolveAddress } = require('../../src/services/addressService') as {
  resolveAddress: jest.Mock;
};
const { getSchedule } = require('../../src/services/scheduleService') as {
  getSchedule: jest.Mock;
};

function createTestApp() {
  process.env.DATABASE_URL = 'postgresql://binmate:binmate@localhost:5432/binmate';
  const { createApp } = require('../../src/app') as typeof import('../../src/app');
  return createApp();
}

describe('POST /api/v1/register-address', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    resolveAddress.mockResolvedValue({
      zoneId: '9f520960-f3db-4cf8-b8df-3310f3f43f71',
      councilName: 'City of South Perth',
      suburb: 'South Perth',
      lat: -31.98,
      lng: 115.86,
    });

    getSchedule.mockResolvedValue({
      zoneId: '9f520960-f3db-4cf8-b8df-3310f3f43f71',
      councilName: 'City of South Perth',
      collections: [],
    });
  });

  it('returns the resolved zone and upcoming collections', async () => {
    const app = createTestApp();
    const response = await request(app)
      .post('/api/v1/register-address')
      .send({ address: '1 Sandgate Street SOUTH PERTH WA 6151' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      zoneId: '9f520960-f3db-4cf8-b8df-3310f3f43f71',
      councilName: 'City of South Perth',
      suburb: 'South Perth',
      userId: undefined,
      nextCollections: [],
    });
    expect(resolveAddress).toHaveBeenCalledWith('1 Sandgate Street SOUTH PERTH WA 6151');
  });

  it('rate limits repeated requests from the same client IP', async () => {
    const app = createTestApp();

    for (let index = 0; index < 10; index += 1) {
      const response = await request(app)
        .post('/api/v1/register-address')
        .send({ address: `1 Sandgate Street SOUTH PERTH WA 6151 #${index}` });

      expect(response.status).toBe(200);
    }

    const limitedResponse = await request(app)
      .post('/api/v1/register-address')
      .send({ address: '1 Sandgate Street SOUTH PERTH WA 6151 #limited' });

    expect(limitedResponse.status).toBe(429);
    expect(limitedResponse.body).toEqual({
      error: 'Too many address lookup requests. Please try again shortly.',
    });
    expect(resolveAddress).toHaveBeenCalledTimes(10);
  });
});
