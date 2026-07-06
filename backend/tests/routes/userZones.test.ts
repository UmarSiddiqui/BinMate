import express from 'express';
import request from 'supertest';

jest.mock('../../src/repositories/userRepository', () => ({
  createUser: jest.fn(),
  findUserById: jest.fn(),
  findUserByPushToken: jest.fn(),
  replaceUserZones: jest.fn(),
  updatePushToken: jest.fn(),
}));

import userZonesRouter from '../../src/routes/userZones';
import {
  createUser,
  findUserById,
  findUserByPushToken,
  replaceUserZones,
  updatePushToken,
} from '../../src/repositories/userRepository';

const mockCreateUser = createUser as jest.Mock;
const mockFindUserById = findUserById as jest.Mock;
const mockFindUserByPushToken = findUserByPushToken as jest.Mock;
const mockReplaceUserZones = replaceUserZones as jest.Mock;
const mockUpdatePushToken = updatePushToken as jest.Mock;

const PUSH_TOKEN = 'a'.repeat(64);
const USER_ID = '4f6c1f6e-9f2a-4b7e-8c3d-2a1b0c9d8e7f';

const ZONES = [
  { zoneId: 'zone-1', addressLabel: 'Wembley', isPrimary: true },
  { zoneId: 'zone-2', addressLabel: 'Scarborough', isPrimary: false },
];

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/user-zones', userZonesRouter);
  return app;
}

describe('PUT /api/v1/user-zones', () => {
  beforeEach(() => jest.resetAllMocks());

  it('creates a user for an unknown push token and stores all zones', async () => {
    mockFindUserByPushToken.mockResolvedValue(null);
    mockCreateUser.mockResolvedValue({ id: USER_ID, pushToken: PUSH_TOKEN });

    const res = await request(makeApp())
      .put('/api/v1/user-zones')
      .send({ pushToken: PUSH_TOKEN, zones: ZONES });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, userId: USER_ID });
    expect(mockCreateUser).toHaveBeenCalledWith(PUSH_TOKEN);
    expect(mockReplaceUserZones).toHaveBeenCalledWith(USER_ID, ZONES);
    expect(mockUpdatePushToken).not.toHaveBeenCalled();
  });

  it('reuses the existing user matched by push token', async () => {
    mockFindUserByPushToken.mockResolvedValue({ id: USER_ID, pushToken: PUSH_TOKEN });

    const res = await request(makeApp())
      .put('/api/v1/user-zones')
      .send({ pushToken: PUSH_TOKEN, zones: [ZONES[0]] });

    expect(res.status).toBe(200);
    expect(res.body.userId).toBe(USER_ID);
    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(mockReplaceUserZones).toHaveBeenCalledWith(USER_ID, [ZONES[0]]);
  });

  it('follows APNs token rotation when a userId is supplied', async () => {
    mockFindUserById.mockResolvedValue({ id: USER_ID, pushToken: 'b'.repeat(64) });

    const res = await request(makeApp())
      .put('/api/v1/user-zones')
      .send({ pushToken: PUSH_TOKEN, userId: USER_ID, zones: [ZONES[0]] });

    expect(res.status).toBe(200);
    expect(mockUpdatePushToken).toHaveBeenCalledWith(USER_ID, PUSH_TOKEN);
    expect(mockFindUserByPushToken).not.toHaveBeenCalled();
  });

  it('accepts an empty zone list to unsubscribe from all reminders', async () => {
    mockFindUserByPushToken.mockResolvedValue({ id: USER_ID, pushToken: PUSH_TOKEN });

    const res = await request(makeApp())
      .put('/api/v1/user-zones')
      .send({ pushToken: PUSH_TOKEN, zones: [] });

    expect(res.status).toBe(200);
    expect(mockReplaceUserZones).toHaveBeenCalledWith(USER_ID, []);
  });

  it('rejects an invalid body with 400', async () => {
    const res = await request(makeApp())
      .put('/api/v1/user-zones')
      .send({ pushToken: 'short', zones: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(mockReplaceUserZones).not.toHaveBeenCalled();
  });
});
