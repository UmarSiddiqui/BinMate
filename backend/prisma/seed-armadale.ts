/**
 * Seed City of Armadale council + all 10 collection zones.
 * Run with: npx tsx prisma/seed-armadale.ts
 *
 * Zone code convention: {DAY_ABBREV}-{AREA}
 *   Area 1 → recyclingWeek 'A'
 *   Area 2 → recyclingWeek 'B'
 *
 * All 5 collection days × 2 areas = 10 zones seeded.
 * Zones that don't exist in practice will simply have no addresses assigned.
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

const AREAS = [1, 2] as const;

async function main(): Promise<void> {
  console.log('Seeding City of Armadale...');

  const council = await prisma.council.upsert({
    where: { slug: 'armadale' },
    update: { isActive: true },
    create: {
      name: 'City of Armadale',
      slug: 'armadale',
      platformType: 'widget',
      apiEndpoint: 'https://api.my.armadale.wa.gov.au/bins',
      isActive: true,
    },
  });

  console.log(`  ✓ Council: ${council.name} (${council.id})`);

  let zoneCount = 0;

  for (const { abbrev, day } of DAYS) {
    for (const area of AREAS) {
      const zoneCode = `${abbrev}-${area}`;
      const recyclingWeek = area === 1 ? 'A' : 'B';
      const zoneName = `City of Armadale — ${day.charAt(0).toUpperCase() + day.slice(1)} Area ${area}`;

      const existing = await prisma.collectionZone.findFirst({
        where: { councilId: council.id, zoneCode },
      });

      if (existing) {
        await prisma.collectionZone.update({
          where: { id: existing.id },
          data: {
            zoneName,
            generalDay: day,
            generalFrequency: 'weekly',
            recyclingDay: day,
            recyclingWeek,
            greenWasteDay: null,
            greenWasteWeek: null,
            updatedAt: new Date(),
          },
        });
      } else {
        await prisma.collectionZone.create({
          data: {
            councilId: council.id,
            zoneCode,
            zoneName,
            generalDay: day,
            generalFrequency: 'weekly',
            recyclingDay: day,
            recyclingWeek,
            greenWasteDay: null,
            greenWasteWeek: null,
          },
        });
      }

      console.log(`  ✓ Zone: ${zoneCode} (${day}, recycling week ${recyclingWeek})`);
      zoneCount++;
    }
  }

  console.log(`\nSeeded ${zoneCount} Armadale zones.`);
}

main()
  .catch((err) => { console.error('Seed failed:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
