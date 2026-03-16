/**
 * Seed City of Nedlands council + 10 collection zones.
 * Run with: npx tsx prisma/seed-nedlands.ts
 *
 * Zone code convention: NED-{DAY_ABBREV}-{RECYCLING_WEEK}
 * All 5 weekdays × 2 recycling weeks (A and B) = 10 zones.
 *
 * Nedlands operates a three-bin FOGO system:
 *   generalDay / generalFrequency = 'weekly'  → FOGO (lime green lid, weekly)
 *   recyclingDay / recyclingWeek = A | B       → yellow lid recycling (fortnightly)
 *   greenWasteDay / greenWasteWeek = null      → FOGO replaces separate green waste bin
 *
 * Zones confirmed from live API testing on 2026-03-16:
 *   NED-MON-A  14B Adderley St, Mt Claremont (FOGO Mon, recycling Mon 16 Mar 2026 → Week A)
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
  console.log('Seeding City of Nedlands...');

  const council = await prisma.council.upsert({
    where: { slug: 'nedlands' },
    update: { isActive: true },
    create: {
      name: 'City of Nedlands',
      slug: 'nedlands',
      platformType: 'intramaps',
      apiEndpoint: 'https://gispublic01.nedlands.wa.gov.au/intramaps21b/ApplicationEngine',
      isActive: true,
    },
  });

  console.log(`  ✓ Council: ${council.name} (${council.id})`);

  let count = 0;

  for (const { abbrev, day } of DAYS) {
    for (const recyclingWeek of WEEKS) {
      const zoneCode = `NED-${abbrev}-${recyclingWeek}`;
      const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
      const zoneName = `City of Nedlands — ${dayLabel} (recycling Week ${recyclingWeek})`;

      const data = {
        zoneName,
        generalDay:       day,
        generalFrequency: 'weekly',  // FOGO (lime green lid) — weekly
        recyclingDay:     day,
        recyclingWeek,               // yellow lid — fortnightly
        greenWasteDay:    null,      // no separate green waste (FOGO replaces it)
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

  console.log(`\nSeeded ${count} Nedlands zones.`);
}

main()
  .catch((err) => { console.error('Seed failed:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
