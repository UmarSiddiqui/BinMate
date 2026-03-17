/**
 * Seed Shire of Mundaring council + 10 residential collection zones.
 * Run with: npx tsx prisma/seed-mundaring.ts
 *
 * Zone code convention: MUN-{DAY_ABBREV}-{RECYCLING_WEEK}
 * Mundaring pattern:
 *   - FOGO (lime green): weekly
 *   - Recycling (yellow): fortnightly Week A or B
 *   - General waste (red): fortnightly (opposite week to recycling)
 *   - No separate green waste kerbside (FOGO covers organics)
 *
 * Data source: MyMundaring widget (my.mundaring.wa.gov.au)
 *   GET /Location/GetBinsLocation?term={text}
 *   GET /BinLocationInfo/Info?parcelNumber={id}&suburb={suburb}
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
  console.log('Seeding Shire of Mundaring...');

  const council = await prisma.council.upsert({
    where: { slug: 'mundaring' },
    update: { isActive: true },
    create: {
      name: 'Shire of Mundaring',
      slug: 'mundaring',
      platformType: 'custom',
      apiEndpoint: 'https://my.mundaring.wa.gov.au',
      isActive: true,
    },
  });

  let count = 0;
  for (const { abbrev, day } of DAYS) {
    const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
    for (const recyclingWeek of WEEKS) {
      const zoneCode = `MUN-${abbrev}-${recyclingWeek}`;
      await upsertZone(council.id, zoneCode, {
        zoneName: `Shire of Mundaring — ${dayLabel} (recycling Week ${recyclingWeek})`,
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

  console.log(`Seeded ${count} Mundaring zones.`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
