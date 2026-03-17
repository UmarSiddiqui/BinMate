/**
 * Seed Shire of Serpentine-Jarrahdale council + 10 residential collection zones.
 * Run with: npx tsx prisma/seed-serpentinejj.ts
 *
 * Zone code convention: SJJ-{DAY_ABBREV}-{RECYCLING_WEEK}
 * Serpentine-Jarrahdale pattern:
 *   - General waste (red): weekly
 *   - Recycling (yellow): fortnightly Week A or B
 *   - No separate green waste / FOGO kerbside bin
 *
 * Data source: Shire IntraMaps integration API (maps.sjshire.wa.gov.au)
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
  console.log('Seeding Shire of Serpentine-Jarrahdale...');

  const council = await prisma.council.upsert({
    where: { slug: 'serpentinejj' },
    update: { isActive: true },
    create: {
      name: 'Shire of Serpentine-Jarrahdale',
      slug: 'serpentinejj',
      platformType: 'custom',
      apiEndpoint: 'https://maps.sjshire.wa.gov.au/IntraMaps22B/ApplicationEngine/integration/api/search/',
      isActive: true,
    },
  });

  let count = 0;
  for (const { abbrev, day } of DAYS) {
    const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
    for (const recyclingWeek of WEEKS) {
      const zoneCode = `SJJ-${abbrev}-${recyclingWeek}`;
      await upsertZone(council.id, zoneCode, {
        zoneName: `Shire of Serpentine-Jarrahdale — ${dayLabel} (recycling Week ${recyclingWeek})`,
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

  console.log(`Seeded ${count} Serpentine-Jarrahdale zones.`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
