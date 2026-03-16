/**
 * Seed City of Joondalup council + 10 collection zones.
 * Run with: npx tsx prisma/seed-joondalup.ts
 *
 * Zone code convention: JOO-{DAY_ABBREV}-{RECYCLING_WEEK}
 * All 5 weekdays × 2 recycling weeks (A and B) = 10 zones.
 *
 * Joondalup service pattern (verified 2026-03-16):
 *   - Red lid (general): weekly
 *   - Yellow lid (recycling): fortnightly
 *   - Lime green lid (garden organics): fortnightly, alternate to recycling
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

function oppositeWeek(week: 'A' | 'B'): 'A' | 'B' {
  return week === 'A' ? 'B' : 'A';
}

async function main(): Promise<void> {
  console.log('Seeding City of Joondalup...');

  const council = await prisma.council.upsert({
    where: { slug: 'joondalup' },
    update: { isActive: true },
    create: {
      name: 'City of Joondalup',
      slug: 'joondalup',
      platformType: 'widget',
      apiEndpoint: 'https://www.joondalup.wa.gov.au/aapi/coj',
      isActive: true,
    },
  });

  console.log(`  ✓ Council: ${council.name} (${council.id})`);

  let count = 0;

  for (const { abbrev, day } of DAYS) {
    for (const recyclingWeek of WEEKS) {
      const zoneCode = `JOO-${abbrev}-${recyclingWeek}`;
      const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
      const zoneName = `City of Joondalup — ${dayLabel} (recycling Week ${recyclingWeek})`;

      const data = {
        zoneName,
        generalDay: day,
        generalFrequency: 'weekly',
        recyclingDay: day,
        recyclingWeek,
        greenWasteDay: day,
        greenWasteWeek: oppositeWeek(recyclingWeek),
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

  console.log(`\nSeeded ${count} Joondalup zones.`);
}

main()
  .catch((err) => { console.error('Seed failed:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());

