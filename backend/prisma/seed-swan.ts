/**
 * Seed City of Swan council + 10 collection zones.
 * Run with: npx tsx prisma/seed-swan.ts
 *
 * Zone code convention: SWA-{DAY_ABBREV}-{RECYCLING_WEEK}
 * All 5 weekdays × 2 recycling weeks (A and B) = 10 zones.
 *
 * Zone schema (Swan 2-bin system at March 2026):
 *   generalDay / generalFrequency = 'weekly'  → red lid general waste (weekly)
 *   recyclingDay / recyclingWeek = A | B       → yellow lid recycling (fortnightly)
 *   greenWasteDay / greenWasteWeek = null      → FOGO not yet active (scheduled 12/05/2026)
 *   vergeDates = null                          → Swan does not run a verge collection service
 *
 * Zones confirmed from live API testing on 2026-03-16:
 *   SWA-TUE-A  12 Morrison Road, Midland WA 6056
 *               → "Next Recycling Collection": "Tuesday, 17 March 2026" → Week A
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DAYS = [
  { abbrev: 'MON', day: 'monday'    },
  { abbrev: 'TUE', day: 'tuesday'   },
  { abbrev: 'WED', day: 'wednesday' },
  { abbrev: 'THU', day: 'thursday'  },
  { abbrev: 'FRI', day: 'friday'    },
] as const;

const WEEKS = ['A', 'B'] as const;

async function main(): Promise<void> {
  console.log('Seeding City of Swan...');

  const council = await prisma.council.upsert({
    where: { slug: 'swan' },
    update: { isActive: true },
    create: {
      name: 'City of Swan',
      slug: 'swan',
      platformType: 't1cloud',
      apiEndpoint: 'https://swan.spatial.t1cloud.com/spatial/intramaps/ApplicationEngine',
      isActive: true,
    },
  });

  console.log(`  ✓ Council: ${council.name} (${council.id})`);

  let count = 0;

  for (const { abbrev, day } of DAYS) {
    for (const recyclingWeek of WEEKS) {
      const zoneCode = `SWA-${abbrev}-${recyclingWeek}`;
      const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
      const zoneName = `City of Swan — ${dayLabel} (recycling Week ${recyclingWeek})`;

      const data = {
        zoneName,
        generalDay:       day,
        generalFrequency: 'weekly',
        recyclingDay:     day,
        recyclingWeek,
        greenWasteDay:    null,   // FOGO not yet active
        greenWasteWeek:   null,
        updatedAt:        new Date(),
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

  console.log(`\nSeeded ${count} Swan zones.`);
}

main()
  .catch((err) => { console.error('Seed failed:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
