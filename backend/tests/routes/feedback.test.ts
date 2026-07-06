import request from 'supertest';

jest.mock('../../src/repositories/feedbackRepository', () => ({
  createFeedback: jest.fn(),
}));

const { createFeedback } = require('../../src/repositories/feedbackRepository') as {
  createFeedback: jest.Mock;
};

function createTestApp() {
  process.env.DATABASE_URL = 'postgresql://binmate:binmate@localhost:5432/binmate';
  const { createApp } = require('../../src/app') as typeof import('../../src/app');
  return createApp();
}

describe('POST /api/v1/feedback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createFeedback.mockResolvedValue({
      id: '2f4a7c1e-9b3d-4e8f-a6c5-1d2e3f4a5b6c',
      category: 'missed_bin',
      message: 'Bins were not collected on Tuesday',
      zoneId: null,
      appVersion: null,
      createdAt: new Date(),
    });
  });

  it('stores valid feedback and returns 201 with the id', async () => {
    const app = createTestApp();
    const response = await request(app)
      .post('/api/v1/feedback')
      .send({ category: 'missed_bin', message: 'Bins were not collected on Tuesday' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ ok: true, id: '2f4a7c1e-9b3d-4e8f-a6c5-1d2e3f4a5b6c' });
    expect(createFeedback).toHaveBeenCalledWith({
      category: 'missed_bin',
      message: 'Bins were not collected on Tuesday',
    });
  });

  it('accepts optional zoneId and appVersion', async () => {
    const app = createTestApp();
    const response = await request(app).post('/api/v1/feedback').send({
      category: 'wrong_schedule',
      message: 'Recycling week is off by one',
      zoneId: '9f520960-f3db-4cf8-b8df-3310f3f43f71',
      appVersion: '1.0.0',
    });

    expect(response.status).toBe(201);
    expect(createFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ zoneId: '9f520960-f3db-4cf8-b8df-3310f3f43f71' })
    );
  });

  it('rejects an unknown category', async () => {
    const app = createTestApp();
    const response = await request(app)
      .post('/api/v1/feedback')
      .send({ category: 'rant', message: 'hello there' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBeDefined();
    expect(createFeedback).not.toHaveBeenCalled();
  });

  it('rejects a message that is too short', async () => {
    const app = createTestApp();
    const response = await request(app)
      .post('/api/v1/feedback')
      .send({ category: 'other', message: 'a' });

    expect(response.status).toBe(400);
    expect(createFeedback).not.toHaveBeenCalled();
  });

  it('returns 500 when persistence fails', async () => {
    createFeedback.mockRejectedValue(new Error('db down'));
    const app = createTestApp();
    const response = await request(app)
      .post('/api/v1/feedback')
      .send({ category: 'ui', message: 'Buttons too small on iPhone SE' });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Failed to save feedback' });
  });
});
