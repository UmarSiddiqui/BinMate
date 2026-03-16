/**
 * Seed City of Melville council + 10 collection zones.
 * Run with: npx tsx prisma/seed-melville.ts
 *
 * Zone code convention: MEL-{DAY_ABBREV}-{RECYCLING_WEEK}
 * All 5 weekdays × 2 recycling weeks (A and B) = 10 zones.
 *
 * Zone schema:
 *   generalDay / generalFrequency = 'weekly'  → FOGO (lime green lid, weekly)
 *   recyclingDay / recyclingWeek = A | B       → yellow lid recycling (fortnightly)
 *   greenWasteDay / greenWasteWeek = opposite  → red lid general waste (fortnightly)
 *
 * Zones confirmed from live API testing on 2026-03-16:
 *   MEL-MON-A  Applecross area  (YellowLid Mon 16 Mar 2026 → Week A)
 *   MEL-WED-B  Ardross/Booragoon (YellowLid Wed 25 Mar 2026 → Week B)
 *   MEL-THU-B  Kardinya area    (YellowLid Thu 26 Mar 2026 → Week B)
 *   MEL-TUE-?  Melville/Palmyra (week not tested — both A and B seeded)
 *   MEL-FRI-?  (week not confirmed — both A and B seeded)
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
  console.log('Seeding City of Melville...');

  const council = await prisma.council.upsert({
    where: { slug: 'melville' },
    update: { isActive: true },
    create: {
      name: 'City of Melville',
      slug: 'melville',
      platformType: 't1cloud',
      apiEndpoint:
        'https://melville.spatial.t1cloud.com/spatial/intramaps/applicationengine/Integration/api',
      isActive: true,
    },
  });

  console.log(`  ✓ Council: ${council.name} (${council.id})`);

  let count = 0;

  for (const { abbrev, day } of DAYS) {
    for (const recyclingWeek of WEEKS) {
      const generalWasteWeek = recyclingWeek === 'A' ? 'B' : 'A';
      const zoneCode = `MEL-${abbrev}-${recyclingWeek}`;
      const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
      const zoneName = `City of Melville — ${dayLabel} (recycling Week ${recyclingWeek})`;

      const data = {
        zoneName,
        generalDay:       day,
        generalFrequency: 'weekly',
        recyclingDay:     day,
        recyclingWeek,
        greenWasteDay:    day,
        greenWasteWeek:   generalWasteWeek,
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

      console.log(`  ✓ Zone: ${zoneCode} (${day}, recycling ${recyclingWeek}, red ${generalWasteWeek})`);
      count++;
    }
  }

  console.log(`\nSeeded ${count} Melville zones.`);
}

main()
  .catch((err) => { console.error('Seed failed:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
