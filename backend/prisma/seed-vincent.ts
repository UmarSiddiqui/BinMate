/**
 * Seed City of Vincent council + 10 residential collection zones.
 * Run with: npx tsx prisma/seed-vincent.ts
 *
 * Zone code convention: VIN-{DAY_ABBREV}-{RECYCLING_WEEK}
 * Vincent residential pattern:
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
  console.log('Seeding City of Vincent...');

  const council = await prisma.council.upsert({
    where: { slug: 'vincent' },
    update: { isActive: true },
    create: {
      name: 'City of Vincent',
      slug: 'vincent',
      platformType: 'widget',
      apiEndpoint: 'https://mapping.vincent.wa.gov.au/pozi/qgisserver',
      isActive: true,
    },
  });

  let count = 0;
  for (const { abbrev, day } of DAYS) {
    const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
    for (const recyclingWeek of WEEKS) {
      const zoneCode = `VIN-${abbrev}-${recyclingWeek}`;
      await upsertZone(council.id, zoneCode, {
        zoneName: `City of Vincent — ${dayLabel} (recycling Week ${recyclingWeek})`,
        generalDay: day,
        generalFrequency: 'fortnightly',
        recyclingDay: day,
        recyclingWeek,
        greenWasteDay: day,
        greenWasteWeek: 'weekly',
        updatedAt: new Date(),
      });
      count++;
    }
  }

  console.log(`Seeded ${count} Vincent zones.`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
