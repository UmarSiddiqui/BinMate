/**
 * Seed City of Subiaco council + 10 collection zones.
 * Run with: npx tsx prisma/seed-subiaco.ts
 *
 * Zone code convention: SUB-{DAY_ABBREV}-{RECYCLING_WEEK}
 * All 5 weekdays × 2 recycling weeks (A and B) = 10 zones.
 *
 * Subiaco operates a three-bin FOGO system:
 *   generalDay / generalFrequency = 'weekly'  → FOGO (lime green lid, weekly)
 *   recyclingDay / recyclingWeek = A | B       → yellow lid recycling (fortnightly)
 *   greenWasteDay / greenWasteWeek = null      → FOGO replaces separate green waste bin
 *
 * Zones confirmed from live API testing on 2026-03-16:
 *   SUB-TUE-B  1 Rokeby Road SUBIACO (Recycle Collection: "Tuesday, Week 1 (24 Mar 2026)" → Week B)
 *   Note: Subiaco "Week 1" = Perth Week B; "Week 2" = Perth Week A.
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
  console.log('Seeding City of Subiaco...');

  const council = await prisma.council.upsert({
    where: { slug: 'subiaco' },
    update: { isActive: true },
    create: {
      name: 'City of Subiaco',
      slug: 'subiaco',
      platformType: 't1cloud',
      apiEndpoint: 'https://subiaco.spatial.t1cloud.com/spatial/intramaps/ApplicationEngine',
      isActive: true,
    },
  });

  console.log(`  ✓ Council: ${council.name} (${council.id})`);

  let count = 0;

  for (const { abbrev, day } of DAYS) {
    for (const recyclingWeek of WEEKS) {
      const zoneCode = `SUB-${abbrev}-${recyclingWeek}`;
      const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
      const zoneName = `City of Subiaco — ${dayLabel} (recycling Week ${recyclingWeek})`;

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

  console.log(`\nSeeded ${count} Subiaco zones.`);
}

main()
  .catch((err) => { console.error('Seed failed:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
