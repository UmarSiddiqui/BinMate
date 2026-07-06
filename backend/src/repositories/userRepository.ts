import prisma from '../utils/prisma';
import type { User, UserZone } from '@prisma/client';

/** Find an existing user by push token. */
export async function findUserByPushToken(pushToken: string): Promise<User | null> {
  return prisma.user.findFirst({
    where: { pushToken, deletedAt: null },
  });
}

/** Find a user by ID (non-deleted). */
export async function findUserById(userId: string): Promise<User | null> {
  return prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
  });
}

/** Create a new user, optionally with a push token. */
export async function createUser(pushToken?: string): Promise<User> {
  return prisma.user.create({
    data: { pushToken: pushToken ?? null },
  });
}

/** Update a user's push token and notification hour. */
export async function updatePushToken(
  userId: string,
  pushToken: string,
  notificationHour?: number
): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: {
      pushToken,
      ...(notificationHour !== undefined ? { notificationHour } : {}),
    },
  });
}

/** Link a user to a zone. No-ops if already linked. */
export async function upsertUserZone(params: {
  userId: string;
  zoneId: string;
  addressLabel: string;
  isPrimary: boolean;
}): Promise<UserZone> {
  return prisma.userZone.upsert({
    where: { userId_zoneId: { userId: params.userId, zoneId: params.zoneId } },
    update: { addressLabel: params.addressLabel, isPrimary: params.isPrimary },
    create: params,
  });
}

/** Zone subscription entry used when replacing a user's saved addresses. */
export interface UserZoneEntry {
  zoneId: string;
  addressLabel: string;
  isPrimary: boolean;
}

/** Replace every zone subscription for a user in one transaction. */
export async function replaceUserZones(userId: string, zones: UserZoneEntry[]): Promise<void> {
  await prisma.$transaction([
    prisma.userZone.deleteMany({ where: { userId } }),
    ...(zones.length
      ? [prisma.userZone.createMany({ data: zones.map((z) => ({ userId, ...z })) })]
      : []),
  ]);
}

/** Get all user IDs with a push token subscribed to a given zone. */
export async function findUsersForZone(
  zoneId: string
): Promise<Array<{ userId: string; pushToken: string; notificationHour: number }>> {
  const rows = await prisma.userZone.findMany({
    where: { zoneId },
    include: { user: { select: { id: true, pushToken: true, notificationHour: true, deletedAt: true } } },
  });

  return rows
    .filter((r) => r.user.deletedAt === null && r.user.pushToken !== null)
    .map((r) => ({
      userId: r.user.id,
      pushToken: r.user.pushToken as string,
      notificationHour: r.user.notificationHour,
    }));
}
