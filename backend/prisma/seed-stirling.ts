/**
 * Seed City of Stirling council + 10 collection zones.
 * Run with: npx tsx prisma/seed-stirling.ts
 *
 * Zone code convention: STI-{DAY_ABBREV}-{RECYCLING_WEEK}
 * All 5 weekdays × 2 recycling weeks (A and B) = 10 zones.
 *
 * Zone schema (Stirling 3-bin system at March 2026):
 *   generalDay / generalFrequency = 'weekly'            → red lid (weekly)
 *   recyclingDay / recyclingWeek  = A | B               → yellow lid (fortnightly)
 *   greenWasteDay / greenWasteWeek = same day, opposite → lime green lid (fortnightly, opposite week)
 *   vergeDates = null                                   → per-property, not stored at zone level
 *
 * Zones confirmed from live API coordinate testing on 2026-03-16:
 *   STI-TUE-A  Scarborough/City Beach area  (115.7595, -31.8938)
 *   STI-MON-B  Doubleview/Innaloo area      (115.7743, -31.8910)
 *   STI-WED-B  Osborne Park/Balcatta area   (115.8317, -31.8869)
 *   STI-FRI-A  Dianella area                (115.8663, -31.8703)
 *   STI-TUE-B  Floreat area                 (115.7911, -31.9181)
 *   STI-MON-A  Trigg area                   (115.7541, -31.8710)
 *   STI-WED-A  Joondanna area               (115.8432, -31.9046)
 *   STI-THU-B  Tuart Hill area              (115.8519, -31.9059)
 *   STI-FRI-B  Carine area                  (115.8100, -31.8499)
 *   STI-THU-A  (not yet confirmed — seeded from logical inference)
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
  console.log('Seeding City of Stirling...');

  const council = await prisma.council.upsert({
    where: { slug: 'stirling' },
    update: { isActive: true },
    create: {
      name:         'City of Stirling',
      slug:         'stirling',
      platformType: 'opencities',
      apiEndpoint:  'https://www.stirling.wa.gov.au/bincollectioncheck/getresult',
      isActive:     true,
    },
  });

  console.log(`  ✓ Council: ${council.name} (${council.id})`);

  let count = 0;

  for (const { abbrev, day } of DAYS) {
    for (const recyclingWeek of WEEKS) {
      const zoneCode       = `STI-${abbrev}-${recyclingWeek}`;
      // Garden organics collected fortnightly on the opposite week to recycling
      const greenWasteWeek = recyclingWeek === 'A' ? 'B' : 'A';
      const dayLabel       = day.charAt(0).toUpperCase() + day.slice(1);
      const zoneName       = `City of Stirling — ${dayLabel} (recycling Week ${recyclingWeek})`;

      const data = {
        zoneName,
        generalDay:       day,
        generalFrequency: 'weekly',
        recyclingDay:     day,
        recyclingWeek,
        greenWasteDay:    day,
        greenWasteWeek,
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

      console.log(`  ✓ Zone: ${zoneCode} (${day}, recycling ${recyclingWeek}, green ${greenWasteWeek})`);
      count++;
    }
  }

  console.log(`\nSeeded ${count} Stirling zones.`);
}

main()
  .catch((err) => { console.error('Seed failed:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
