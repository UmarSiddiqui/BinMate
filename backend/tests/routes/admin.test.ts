import request from 'supertest';

jest.mock('../../src/services/scheduleService', () => ({
  getSchedule: jest.fn(),
}));

jest.mock('../../src/jobs/notificationEngine', () => ({
  runNotificationEngine: jest.fn(),
}));

jest.mock('../../src/repositories/zoneRepository', () => ({
  upsertZone: jest.fn(),
}));

jest.mock('../../src/scrapers/registry', () => ({
  SCRAPER_REGISTRY: {
    stirling: {
      scraper: {
        councilName: 'City of Stirling',
        healthCheck: jest.fn(),
        fetchSchedule: jest.fn(),
      },
      canHandle: jest.fn(),
    },
  },
}));

jest.mock('../../src/utils/prisma', () => ({
  __esModule: true,
  default: {
    $queryRaw: jest.fn(),
    council: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    collectionZone: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    waPublicHoliday: {
      count: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    addressCache: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      groupBy: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

const prisma = require('../../src/utils/prisma').default as {
  $queryRaw: jest.Mock;
  council: {
    count: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  collectionZone: {
    count: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
  };
  waPublicHoliday: {
    count: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  addressCache: {
    count: jest.Mock;
    findMany: jest.Mock;
  };
  user: {
    groupBy: jest.Mock;
    findMany: jest.Mock;
    findFirst: jest.Mock;
  };
};

const { getSchedule } = require('../../src/services/scheduleService') as {
  getSchedule: jest.Mock;
};
const { runNotificationEngine } = require('../../src/jobs/notificationEngine') as {
  runNotificationEngine: jest.Mock;
};
const { upsertZone } = require('../../src/repositories/zoneRepository') as {
  upsertZone: jest.Mock;
};
const { SCRAPER_REGISTRY } = require('../../src/scrapers/registry') as {
  SCRAPER_REGISTRY: {
    stirling: {
      scraper: {
        councilName: string;
        healthCheck: jest.Mock;
        fetchSchedule: jest.Mock;
      };
    };
  };
};

function createTestApp() {
  process.env.DATABASE_URL = 'postgresql://binmate:binmate@localhost:5432/binmate';
  process.env.ADMIN_PASSWORD = 'test-admin-password';
  const { createApp } = require('../../src/app') as typeof import('../../src/app');
  return createApp();
}

function authHeader(): string {
  return `Basic ${Buffer.from('admin:test-admin-password').toString('base64')}`;
}

function seedSummaryMocks(): void {
  prisma.council.findMany.mockResolvedValue([
    {
      id: 'council-1',
      name: 'City of Stirling',
      slug: 'stirling',
      platformType: 'widget',
      lastScrapedAt: new Date('2026-03-15T01:00:00.000Z'),
      isActive: true,
      _count: { zones: 2 },
    },
    {
      id: 'council-2',
      name: 'Town of Cambridge',
      slug: 'cambridge',
      platformType: 'arcgis',
      lastScrapedAt: null,
      isActive: false,
      _count: { zones: 1 },
    },
  ]);
  prisma.collectionZone.count.mockResolvedValue(3);
  prisma.waPublicHoliday.count.mockResolvedValue(2);
  prisma.addressCache.count.mockResolvedValue(4);
  prisma.user.groupBy.mockResolvedValue([
    { subscriptionStatus: 'free', _count: { _all: 2 } },
    { subscriptionStatus: 'active', _count: { _all: 1 } },
  ]);
  prisma.collectionZone.findMany.mockResolvedValue([
    {
      id: 'zone-1',
      zoneName: 'North Coastal A',
      council: { name: 'City of Stirling' },
      _count: { userZones: 5 },
    },
  ]);
  prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
}

describe('Admin routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
    seedSummaryMocks();
    prisma.collectionZone.findUnique.mockResolvedValue({
      id: 'zone-1',
      zoneName: 'North Coastal A',
      zoneCode: 'MON-A',
      generalDay: 'monday',
      generalFrequency: 'weekly',
      recyclingDay: 'monday',
      recyclingWeek: 'A',
      greenWasteDay: null,
      greenWasteWeek: null,
      vergeDates: ['2026-04-10'],
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-15T00:00:00.000Z'),
      council: { id: 'council-1', name: 'City of Stirling', slug: 'stirling' },
      _count: { userZones: 3 },
    });
    prisma.waPublicHoliday.create.mockResolvedValue({
      id: 'holiday-1',
      name: 'Labour Day',
      date: new Date('2026-03-02T00:00:00.000Z'),
      shiftDays: 1,
    });
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      createdAt: new Date('2026-03-10T00:00:00.000Z'),
      subscriptionStatus: 'active',
      notificationHour: 18,
      pushToken: 'redacted',
      zones: [
        {
          zoneId: 'zone-1',
          addressLabel: 'Scarborough',
          isPrimary: true,
          createdAt: new Date('2026-03-10T00:00:00.000Z'),
          zone: {
            zoneName: 'North Coastal A',
            council: { name: 'City of Stirling' },
          },
        },
      ],
      _count: { zones: 1 },
    });
    getSchedule.mockResolvedValue({
      zoneId: 'zone-1',
      councilName: 'City of Stirling',
      collections: [
        {
          date: '2026-03-17',
          dayOfWeek: 'Tuesday',
          types: ['general'],
          eventType: 'kerbside',
          isHolidayShifted: false,
        },
      ],
    });
    SCRAPER_REGISTRY.stirling.scraper.healthCheck.mockResolvedValue(true);
    SCRAPER_REGISTRY.stirling.scraper.fetchSchedule.mockResolvedValue({
      zoneCode: 'MON-A',
      zoneName: 'North Coastal A',
      generalDay: 'monday',
      generalFrequency: 'weekly',
      recyclingDay: 'monday',
      recyclingWeek: 'A',
      greenWasteDay: null,
      greenWasteWeek: null,
      vergeDates: null,
    });
    prisma.council.findUnique.mockResolvedValue({
      id: 'council-1',
      name: 'City of Stirling',
      lastScrapedAt: null,
      zones: [
        { id: 'zone-1', zoneCode: 'MON-A', zoneName: 'North Coastal A' },
      ],
    });
    prisma.council.update.mockResolvedValue({
      lastScrapedAt: new Date('2026-03-16T01:00:00.000Z'),
    });
    runNotificationEngine.mockResolvedValue(undefined);
    upsertZone.mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete process.env.ADMIN_PASSWORD;
    delete process.env.NODE_ENV;
  });

  it('requires basic auth for admin endpoints', async () => {
    const app = createTestApp();
    const response = await request(app).get('/admin/api/summary');

    expect(response.status).toBe(401);
    expect(response.text).toContain('Authentication required');
  });

  it('returns the combined admin summary payload', async () => {
    const app = createTestApp();
    const response = await request(app)
      .get('/admin/api/summary')
      .set('Authorization', authHeader());

    expect(response.status).toBe(200);
    expect(response.body.summary.councils.total).toBe(2);
    expect(response.body.summary.users.total).toBe(3);
    expect(response.body.summary.topZones[0]).toEqual({
      zoneId: 'zone-1',
      zoneName: 'North Coastal A',
      councilName: 'City of Stirling',
      userCount: 5,
    });
    expect(response.body.system.db.status).toBe('ok');
  });

  it('returns zone detail with preview collections', async () => {
    const app = createTestApp();
    const response = await request(app)
      .get('/admin/api/zones/zone-1?count=5')
      .set('Authorization', authHeader());

    expect(response.status).toBe(200);
    expect(response.body.zone.zoneName).toBe('North Coastal A');
    expect(response.body.preview.collections[0].date).toBe('2026-03-17');
    expect(getSchedule).toHaveBeenCalledWith('zone-1', expect.any(Date), 5);
  });

  it('validates holiday creation requests', async () => {
    const app = createTestApp();
    const response = await request(app)
      .post('/admin/api/holidays')
      .set('Authorization', authHeader())
      .send({ name: '', date: 'invalid-date' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBeTruthy();
  });

  it('creates holiday rows', async () => {
    const app = createTestApp();
    const response = await request(app)
      .post('/admin/api/holidays')
      .set('Authorization', authHeader())
      .send({ name: 'Labour Day', date: '2026-03-02' });

    expect(response.status).toBe(201);
    expect(prisma.waPublicHoliday.create).toHaveBeenCalledWith({
      data: { name: 'Labour Day', date: new Date('2026-03-02'), shiftDays: 1 },
    });
  });

  it('runs a scraper refresh for a single council', async () => {
    const app = createTestApp();
    const response = await request(app)
      .post('/admin/api/scrapers/stirling/run')
      .set('Authorization', authHeader());

    expect(response.status).toBe(200);
    expect(response.body.refreshed).toBe(1);
    expect(SCRAPER_REGISTRY.stirling.scraper.fetchSchedule).toHaveBeenCalledWith('MON-A');
    expect(upsertZone).toHaveBeenCalledWith('council-1', 'MON-A', expect.objectContaining({
      zoneCode: 'MON-A',
    }));
  });

  it('returns user detail without exposing the push token itself', async () => {
    const app = createTestApp();
    const response = await request(app)
      .get('/admin/api/users/user-1')
      .set('Authorization', authHeader());

    expect(response.status).toBe(200);
    expect(response.body.pushTokenStatus).toBe('configured');
    expect(response.body.pushToken).toBeUndefined();
    expect(response.body.zones[0]).toEqual({
      zoneId: 'zone-1',
      zoneName: 'North Coastal A',
      councilName: 'City of Stirling',
      addressLabel: 'Scarborough',
      isPrimary: true,
      createdAt: '2026-03-10T00:00:00.000Z',
    });
  });

  it('blocks manual notification triggers in production without confirmation', async () => {
    process.env.NODE_ENV = 'production';
    const app = createTestApp();
    const response = await request(app)
      .post('/admin/api/system/notifications/trigger')
      .set('Authorization', authHeader());

    expect(response.status).toBe(409);
    expect(runNotificationEngine).not.toHaveBeenCalled();
  });

  it('allows manual notification triggers outside production', async () => {
    const app = createTestApp();
    const response = await request(app)
      .post('/admin/api/system/notifications/trigger')
      .set('Authorization', authHeader());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
    expect(runNotificationEngine).toHaveBeenCalledTimes(1);
  });
});
