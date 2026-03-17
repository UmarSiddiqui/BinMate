/**
 * Seed Town of Victoria Park council + 10 residential collection zones.
 * Run with: npx tsx prisma/seed-victoriapark.ts
 *
 * Zone code convention: TVP-{DAY_ABBREV}-{RECYCLING_WEEK}
 * Victoria Park pattern:
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
  console.log('Seeding Town of Victoria Park...');

  const council = await prisma.council.upsert({
    where: { slug: 'victoriapark' },
    update: { isActive: true },
    create: {
      name: 'Town of Victoria Park',
      slug: 'victoriapark',
      platformType: 'widget',
      apiEndpoint: 'https://maps.vicpark.wa.gov.au/pozi/qgisserver',
      isActive: true,
    },
  });

  let count = 0;
  for (const { abbrev, day } of DAYS) {
    const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
    for (const recyclingWeek of WEEKS) {
      const zoneCode = `TVP-${abbrev}-${recyclingWeek}`;
      await upsertZone(council.id, zoneCode, {
        zoneName: `Town of Victoria Park — ${dayLabel} (recycling Week ${recyclingWeek})`,
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

  console.log(`Seeded ${count} Victoria Park zones.`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
