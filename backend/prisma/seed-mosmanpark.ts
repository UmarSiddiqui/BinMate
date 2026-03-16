/**
 * Seed Town of Mosman Park council + 10 collection zones.
 * Run with: npx tsx prisma/seed-mosmanpark.ts
 *
 * Zone code convention: MOS-{DAY_ABBREV}-{RECYCLING_WEEK}
 *
 * Mosman Park operates a three-bin FOGO system:
 *   generalDay / generalFrequency = 'weekly'  → FOGO every week
 *   recyclingDay / recyclingWeek = A | B       → yellow lid recycling
 *   greenWasteDay / greenWasteWeek = opposite  → red lid general waste
 *
 * Verified live address (2026-03-16):
 *   39 Jameson Street MOSMAN PARK WA 6012 → MOS-FRI-A
 *
 * Official 2025-26 Waste Guide mapping:
 *   Week 1 = BinMate Week A
 *   Week 2 = BinMate Week B
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

async function main(): Promise<void> {
  console.log('Seeding Town of Mosman Park...');

  const council = await prisma.council.upsert({
    where: { slug: 'mosmanpark' },
    update: { isActive: true },
    create: {
      name: 'Town of Mosman Park',
      slug: 'mosmanpark',
      platformType: 't1cloud',
      apiEndpoint: 'https://mosmanpark.spatial.t1cloud.com/spatial/intramaps/ApplicationEngine',
      isActive: true,
    },
  });

  console.log(`  ✓ Council: ${council.name} (${council.id})`);

  let count = 0;

  for (const { abbrev, day } of DAYS) {
    for (const recyclingWeek of WEEKS) {
      const zoneCode = `MOS-${abbrev}-${recyclingWeek}`;
      const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
      const zoneName = `Town of Mosman Park — ${dayLabel} (recycling Week ${recyclingWeek})`;
      const rubbishWeek = recyclingWeek === 'A' ? 'B' : 'A';

      const data = {
        zoneName,
        generalDay: day,
        generalFrequency: 'weekly',
        recyclingDay: day,
        recyclingWeek,
        greenWasteDay: day,
        greenWasteWeek: rubbishWeek,
        updatedAt: new Date(),
      };

      const existing = await prisma.collectionZone.findFirst({
        where: { councilId: council.id, zoneCode },
      });

      if (existing) {
        await prisma.collectionZone.update({ where: { id: existing.id }, data });
      } else {
        await prisma.collectionZone.create({
          data: { councilId: council.id, zoneCode, ...data },
        });
      }

      console.log(`  ✓ Zone: ${zoneCode} (${day}, recycling ${recyclingWeek})`);
      count++;
    }
  }

  console.log(`\nSeeded ${count} Mosman Park zones.`);
}

main()
  .catch((err) => { console.error('Seed failed:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
