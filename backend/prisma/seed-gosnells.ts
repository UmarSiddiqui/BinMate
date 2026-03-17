/**
 * Seed City of Gosnells council + 10 collection zones.
 * Run with: npx tsx prisma/seed-gosnells.ts
 *
 * Zone code convention: GOS-{DAY_ABBREV}-{RECYCLING_WEEK}
 * All 5 weekdays × 2 recycling weeks (A and B) = 10 zones.
 *
 * Gosnells kerbside pattern (verified 2026-03-17):
 *   - General waste (grey/red-lid): weekly
 *   - Recycling (yellow-lid): fortnightly (Week A / Week B)
 *   - No kerbside green-waste/FOGO cycle in this API
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
  console.log('Seeding City of Gosnells...');

  const council = await prisma.council.upsert({
    where: { slug: 'gosnells' },
    update: { isActive: true },
    create: {
      name: 'City of Gosnells',
      slug: 'gosnells',
      platformType: 'widget',
      apiEndpoint: 'https://t1.gosnells.wa.gov.au/API/waste/v8',
      isActive: true,
    },
  });

  let count = 0;
  for (const { abbrev, day } of DAYS) {
    const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
    for (const recyclingWeek of WEEKS) {
      const zoneCode = `GOS-${abbrev}-${recyclingWeek}`;
      await upsertZone(council.id, zoneCode, {
        zoneName: `City of Gosnells — ${dayLabel} (recycling Week ${recyclingWeek})`,
        generalDay: day,
        generalFrequency: 'weekly',
        recyclingDay: day,
        recyclingWeek,
        greenWasteDay: null,
        greenWasteWeek: null,
        updatedAt: new Date(),
      });
      count += 1;
    }
  }

  console.log(`Seeded ${count} Gosnells zones.`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
