/**
 * Seed City of Kalamunda council + 10 collection zones.
 * Run with: npx tsx prisma/seed-kalamunda.ts
 *
 * Zone code convention: KAL-{DAY_ABBREV}-{RECYCLING_WEEK}
 * All 5 weekdays × 2 recycling weeks (A and B) = 10 zones.
 *
 * Kalamunda kerbside pattern (verified 2026-03-17):
 *   - General waste: weekly
 *   - Recycling: fortnightly (Area One = Week A, Area Two = Week B)
 *   - FOGO: weekly (same weekday as general/recycling)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DAYS = [
  { abbrev: 'MON', day: 'monday' },
  { abbrev: 'TUE', day: 'tuesday' },
  { abbrev: 'WED', day: 'wednesday' },
  { abbrev: 'THU', day: 'thursday' },
  { abbrev: 'FRI', day: 'friday' },
] as const;

const WEEKS = ['A', 'B'] as const;

async function upsertZone(
  councilId: string,
  zoneCode: string,
  data: {
    zoneName: string;
    generalDay: string;
    generalFrequency: string;
    recyclingDay: string;
    recyclingWeek: 'A' | 'B' | 'weekly';
    greenWasteDay: string | null;
    greenWasteWeek: 'A' | 'B' | 'weekly' | null;
    updatedAt: Date;
  },
): Promise<void> {
  const existing = await prisma.collectionZone.findFirst({ where: { councilId, zoneCode } });
  if (existing) {
    await prisma.collectionZone.update({ where: { id: existing.id }, data });
    return;
  }

  await prisma.collectionZone.create({ data: { councilId, zoneCode, ...data } });
}

async function main(): Promise<void> {
  console.log('Seeding City of Kalamunda...');

  const council = await prisma.council.upsert({
    where: { slug: 'kalamunda' },
    update: { isActive: true },
    create: {
      name: 'City of Kalamunda',
      slug: 'kalamunda',
      platformType: 't1cloud',
      apiEndpoint: 'https://kalamunda.spatial.t1cloud.com/spatial/intramaps/ApplicationEngine',
      isActive: true,
    },
  });

  let count = 0;
  for (const { abbrev, day } of DAYS) {
    const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
    for (const recyclingWeek of WEEKS) {
      const zoneCode = `KAL-${abbrev}-${recyclingWeek}`;
      await upsertZone(council.id, zoneCode, {
        zoneName: `City of Kalamunda — ${dayLabel} (recycling Week ${recyclingWeek})`,
        generalDay: day,
        generalFrequency: 'weekly',
        recyclingDay: day,
        recyclingWeek,
        greenWasteDay: day,
        greenWasteWeek: 'weekly',
        updatedAt: new Date(),
      });
      count += 1;
    }
  }

  console.log(`Seeded ${count} Kalamunda zones.`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
