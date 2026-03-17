import prisma from '../utils/prisma';
import type { CollectionZone, Council } from '@prisma/client';

export type ZoneWithCouncil = CollectionZone & { council: Council };

/** Find a zone by its ID, including parent council. */
export async function findZoneById(zoneId: string): Promise<ZoneWithCouncil | null> {
  return prisma.collectionZone.findUnique({
    where: { id: zoneId },
    include: { council: true },
  });
}

/** Find all active zones for a council. */
export async function findZonesByCouncil(councilId: string): Promise<CollectionZone[]> {
  return prisma.collectionZone.findMany({
    where: { councilId },
  });
}

/** Return all collection zones, including parent council. */
export async function listAllZones(): Promise<ZoneWithCouncil[]> {
  return prisma.collectionZone.findMany({
    include: { council: true },
    orderBy: { zoneName: 'asc' },
  });
}

/** Find a zone by council slug and zone code. */
export async function findZoneByCode(
  councilId: string,
  zoneCode: string
): Promise<CollectionZone | null> {
  return prisma.collectionZone.findFirst({
    where: { councilId, zoneCode },
  });
}

export interface ZoneData {
  zoneName: string;
  generalDay: string;
  generalFrequency?: string;
  recyclingDay: string;
  recyclingWeek: string;
  greenWasteDay?: string | null;
  greenWasteWeek?: string | null;
  vergeDates?: string[] | null;
}

/** Upsert a zone — used by scrapers when refreshing council data. */
export async function upsertZone(
  councilId: string,
  zoneCode: string,
  data: ZoneData
): Promise<CollectionZone> {
  const existing = await findZoneByCode(councilId, zoneCode);
  if (existing) {
    return prisma.collectionZone.update({
      where: { id: existing.id },
      data: { ...data, vergeDates: data.vergeDates ?? undefined, updatedAt: new Date() },
    });
  }
  return prisma.collectionZone.create({
    data: { councilId, zoneCode, ...data, vergeDates: data.vergeDates ?? undefined },
  });
}
