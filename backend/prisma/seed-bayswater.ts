/**
 * Seed City of Bayswater council + 10 residential collection zones.
 * Run with: npx tsx prisma/seed-bayswater.ts
 *
 * Zone code convention: BAY-{DAY_ABBREV}-{RECYCLING_WEEK}
 * Bayswater pattern:
 *   - General waste: fortnightly
 *   - Recycling: fortnightly
 *   - FOGO: weekly (same weekday)
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
  console.log('Seeding City of Bayswater...');

  const council = await prisma.council.upsert({
    where: { slug: 'bayswater' },
    update: { isActive: true },
    create: {
      name: 'City of Bayswater',
      slug: 'bayswater',
      platformType: 't1cloud',
      apiEndpoint: 'https://bayswater.spatial.t1cloud.com/spatial/intramaps/ApplicationEngine',
      isActive: true,
    },
  });

  let count = 0;
  for (const { abbrev, day } of DAYS) {
    const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
    for (const recyclingWeek of WEEKS) {
      const zoneCode = `BAY-${abbrev}-${recyclingWeek}`;
      await upsertZone(council.id, zoneCode, {
        zoneName: `City of Bayswater — ${dayLabel} (recycling Week ${recyclingWeek})`,
        generalDay: day,
        generalFrequency: 'fortnightly',
        recyclingDay: day,
        recyclingWeek,
        greenWasteDay: day,
        greenWasteWeek: 'weekly',
        updatedAt: new Date(),
      });
      count += 1;
    }
  }

  console.log(`Seeded ${count} Bayswater zones.`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
