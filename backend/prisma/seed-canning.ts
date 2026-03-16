/**
 * Seed City of Canning council + 10 collection zones.
 * Run with: npx tsx prisma/seed-canning.ts
 *
 * Zone code convention: CAN-{DAY_ABBREV}-{RECYCLING_WEEK}
 * All 5 weekdays × 2 recycling weeks (A and B) = 10 zones.
 *
 * Zone schema (Canning two-bin fortnightly system):
 *   generalDay / generalFrequency = 'fortnightly' — NOTE: schedule computer ignores
 *     generalFrequency and will show general as weekly (Phase 3 known limitation)
 *   recyclingDay / recyclingWeek = A | B       → yellow lid recycling (fortnightly)
 *   greenWasteDay / greenWasteWeek = opposite  → red lid general waste (semantic mismatch)
 *   vergeDates = null                          → set dynamically via live API
 *
 * Zones confirmed from live API testing on 2026-03-16:
 *   CAN-WED-B  31 Manning Rd, Cannington (rubbish Wed 18 Mar Week A, recycling Wed 25 Mar Week B)
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
  console.log('Seeding City of Canning...');

  const council = await prisma.council.upsert({
    where: { slug: 'canning' },
    update: { isActive: true },
    create: {
      name: 'City of Canning',
      slug: 'canning',
      platformType: 'custom_rest',
      apiEndpoint: 'https://www.canning.wa.gov.au/api/property-details',
      isActive: true,
    },
  });

  console.log(`  ✓ Council: ${council.name} (${council.id})`);

  let count = 0;

  for (const { abbrev, day } of DAYS) {
    for (const recyclingWeek of WEEKS) {
      const rubbishWeek = recyclingWeek === 'A' ? 'B' : 'A';
      const zoneCode = `CAN-${abbrev}-${recyclingWeek}`;
      const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
      const zoneName = `City of Canning — ${dayLabel} (recycling Week ${recyclingWeek})`;

      const data = {
        zoneName,
        generalDay:       day,
        generalFrequency: 'fortnightly',
        recyclingDay:     day,
        recyclingWeek,
        greenWasteDay:    day,
        greenWasteWeek:   rubbishWeek,
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

      console.log(`  ✓ Zone: ${zoneCode} (${day}, recycling ${recyclingWeek}, rubbish ${rubbishWeek})`);
      count++;
    }
  }

  console.log(`\nSeeded ${count} Canning zones.`);
}

main()
  .catch((err) => { console.error('Seed failed:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
