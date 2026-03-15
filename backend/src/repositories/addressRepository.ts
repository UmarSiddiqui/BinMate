import prisma from '../utils/prisma';
import type { AddressCache } from '@prisma/client';

/** How long address resolutions are cached (30 days). */
const CACHE_TTL_DAYS = 30;

/** Look up a cached address resolution. Returns null if missing or expired. */
export async function findCachedAddress(addressString: string): Promise<AddressCache | null> {
  return prisma.addressCache.findFirst({
    where: {
      addressString,
      expiresAt: { gt: new Date() },
    },
  });
}

/** Save an address → zone resolution to the cache. */
export async function cacheAddress(params: {
  addressString: string;
  lat: number;
  lng: number;
  councilId: string;
  zoneId: string;
}): Promise<AddressCache> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + CACHE_TTL_DAYS);

  return prisma.addressCache.create({
    data: { ...params, expiresAt },
  });
}
