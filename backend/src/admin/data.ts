import prisma from '../utils/prisma';
import { getSchedule } from '../services/scheduleService';
import { SCRAPER_REGISTRY } from '../scrapers/registry';
import type {
  AddressCacheItem,
  AdminSummary,
  CouncilStat,
  SystemHealthSummary,
  UserDetail,
  UserListItem,
  ZoneDetail,
  ZoneListItem,
} from './types';

/** Return council coverage and scraper availability for the admin dashboard. */
export async function listCouncilStats(): Promise<CouncilStat[]> {
  const councils = await prisma.council.findMany({
    include: { _count: { select: { zones: true } } },
    orderBy: { name: 'asc' },
  });
  const scraperSlugs = new Set(Object.keys(SCRAPER_REGISTRY));

  return councils.map((council) => ({
    id: council.id,
    name: council.name,
    slug: council.slug,
    platformType: council.platformType,
    zoneCount: council._count.zones,
    lastScrapedAt: council.lastScrapedAt,
    isActive: council.isActive,
    hasScraper: scraperSlugs.has(council.slug),
  }));
}

/** Return the high-level admin summary cards and top-zone usage metrics. */
export async function getAdminSummary(): Promise<AdminSummary> {
  const [councilStats, zoneCount, holidayCount, addressCacheCount, users, topZones] = await Promise.all([
    listCouncilStats(),
    prisma.collectionZone.count(),
    prisma.waPublicHoliday.count(),
    prisma.addressCache.count(),
    prisma.user.groupBy({
      by: ['subscriptionStatus'],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
    prisma.collectionZone.findMany({
      include: {
        council: { select: { name: true } },
        _count: { select: { userZones: true } },
      },
      orderBy: { userZones: { _count: 'desc' } },
      take: 10,
    }),
  ]);

  const usersByStatus = new Map(users.map((row) => [row.subscriptionStatus, row._count._all]));

  return {
    councils: {
      total: councilStats.length,
      active: councilStats.filter((item) => item.isActive).length,
      withScrapers: councilStats.filter((item) => item.hasScraper).length,
    },
    zones: { total: zoneCount },
    users: {
      total: users.reduce((sum, row) => sum + row._count._all, 0),
      free: usersByStatus.get('free') ?? 0,
      trial: usersByStatus.get('trial') ?? 0,
      active: usersByStatus.get('active') ?? 0,
      expired: usersByStatus.get('expired') ?? 0,
    },
    holidays: { total: holidayCount },
    addressCache: { total: addressCacheCount },
    topZones: topZones.map((zone) => ({
      zoneId: zone.id,
      zoneName: zone.zoneName,
      councilName: zone.council.name,
      userCount: zone._count.userZones,
    })),
  };
}

/** Return collection zones for browsing in the admin panel. */
export async function listZones(councilSlug?: string): Promise<ZoneListItem[]> {
  const zones = await prisma.collectionZone.findMany({
    where: councilSlug ? { council: { slug: councilSlug } } : undefined,
    include: {
      council: { select: { id: true, name: true, slug: true } },
      _count: { select: { userZones: true } },
    },
    orderBy: [{ council: { name: 'asc' } }, { zoneName: 'asc' }],
  });

  return zones.map((zone) => ({
    id: zone.id,
    zoneName: zone.zoneName,
    zoneCode: zone.zoneCode,
    generalDay: zone.generalDay,
    recyclingDay: zone.recyclingDay,
    recyclingWeek: zone.recyclingWeek,
    greenWasteDay: zone.greenWasteDay,
    greenWasteWeek: zone.greenWasteWeek,
    vergeDates: toDateList(zone.vergeDates),
    council: zone.council,
    userCount: zone._count.userZones,
    updatedAt: zone.updatedAt,
  }));
}

/** Return one collection zone with a live schedule preview. */
export async function getZoneDetail(zoneId: string): Promise<ZoneDetail | null> {
  const zone = await prisma.collectionZone.findUnique({
    where: { id: zoneId },
    include: {
      council: { select: { id: true, name: true, slug: true } },
      _count: { select: { userZones: true } },
    },
  });

  if (!zone) {
    return null;
  }

  return {
    id: zone.id,
    zoneName: zone.zoneName,
    zoneCode: zone.zoneCode,
    generalDay: zone.generalDay,
    generalFrequency: zone.generalFrequency,
    recyclingDay: zone.recyclingDay,
    recyclingWeek: zone.recyclingWeek,
    greenWasteDay: zone.greenWasteDay,
    greenWasteWeek: zone.greenWasteWeek,
    vergeDates: toDateList(zone.vergeDates),
    council: zone.council,
    userCount: zone._count.userZones,
    createdAt: zone.createdAt,
    updatedAt: zone.updatedAt,
  };
}

/** Return one zone plus the next upcoming schedule preview. */
export async function getZonePreview(zoneId: string, count: number) {
  const [zone, preview] = await Promise.all([getZoneDetail(zoneId), getSchedule(zoneId, new Date(), count)]);

  return { zone, preview };
}

/** Search the address cache by a partial, case-insensitive address string. */
export async function listAddressCache(query?: string): Promise<AddressCacheItem[]> {
  const rows = await prisma.addressCache.findMany({
    where: query
      ? { addressString: { contains: query, mode: 'insensitive' } }
      : undefined,
    include: {
      council: { select: { name: true } },
      zone: { select: { id: true, zoneName: true } },
    },
    orderBy: { cachedAt: 'desc' },
    take: 100,
  });

  return rows.map((row) => ({
    id: row.id,
    addressLabel: row.addressString,
    lat: row.lat,
    lng: row.lng,
    cachedAt: row.cachedAt,
    expiresAt: row.expiresAt,
    councilName: row.council.name,
    zoneId: row.zone.id,
    zoneName: row.zone.zoneName,
  }));
}

/** Return all WA public holidays in date order. */
export async function listHolidays() {
  return prisma.waPublicHoliday.findMany({ orderBy: { date: 'asc' } });
}

/** Create a WA public holiday row. */
export async function createHoliday(name: string, date: Date) {
  return prisma.waPublicHoliday.create({ data: { name, date, shiftDays: 1 } });
}

/** Update a WA public holiday row. */
export async function updateHoliday(id: string, name: string, date: Date) {
  return prisma.waPublicHoliday.update({ where: { id }, data: { name, date, shiftDays: 1 } });
}

/** Delete a WA public holiday row. */
export async function deleteHoliday(id: string) {
  return prisma.waPublicHoliday.delete({ where: { id } });
}

/** Return users for admin review without exposing sensitive push token values. */
export async function listUsers(subscriptionStatus?: string): Promise<UserListItem[]> {
  const rows = await prisma.user.findMany({
    where: {
      deletedAt: null,
      ...(subscriptionStatus ? { subscriptionStatus } : {}),
    },
    include: { _count: { select: { zones: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return rows.map((user) => ({
    id: user.id,
    createdAt: user.createdAt,
    subscriptionStatus: user.subscriptionStatus,
    notificationHour: user.notificationHour,
    zoneCount: user._count.zones,
    pushTokenStatus: user.pushToken ? 'configured' : 'missing',
  }));
}

/** Return one user and the zones linked to them. */
export async function getUserDetail(userId: string): Promise<UserDetail | null> {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    include: {
      zones: {
        include: {
          zone: {
            include: {
              council: { select: { name: true } },
            },
          },
        },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      },
      _count: { select: { zones: true } },
    },
  });

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    createdAt: user.createdAt,
    subscriptionStatus: user.subscriptionStatus,
    notificationHour: user.notificationHour,
    zoneCount: user._count.zones,
    pushTokenStatus: user.pushToken ? 'configured' : 'missing',
    zones: user.zones.map((row) => ({
      zoneId: row.zoneId,
      zoneName: row.zone.zoneName,
      councilName: row.zone.council.name,
      addressLabel: row.addressLabel,
      isPrimary: row.isPrimary,
      createdAt: row.createdAt,
    })),
  };
}

/** Return database and deployment health for the admin panel. */
export async function getSystemHealthSummary(): Promise<SystemHealthSummary> {
  const start = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      db: { status: 'ok', latencyMs: Date.now() - start },
      deployment: getDeployment(),
      adminAuthEnabled: Boolean(process.env.ADMIN_PASSWORD),
    };
  } catch {
    return {
      db: { status: 'error', latencyMs: null },
      deployment: getDeployment(),
      adminAuthEnabled: Boolean(process.env.ADMIN_PASSWORD),
    };
  }
}

/** Normalise Prisma JSON verge dates to a string array. */
function toDateList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/** Return deployment metadata for admin surfaces. */
function getDeployment() {
  return {
    env: process.env.NODE_ENV ?? 'development',
    serviceName: process.env.RENDER_SERVICE_NAME ?? 'local',
    gitSha: process.env.RENDER_GIT_COMMIT ?? 'local',
  };
}
