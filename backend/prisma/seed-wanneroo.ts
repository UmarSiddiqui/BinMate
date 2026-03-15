/**
 * Seed City of Wanneroo council + all 9 collection zones.
 * Run with: npx tsx prisma/seed-wanneroo.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ZONES = [
  { code: 'MON-A', day: 'monday',    recyclingWeek: 'A' },
  { code: 'TUE-A', day: 'tuesday',   recyclingWeek: 'A' },
  { code: 'TUE-B', day: 'tuesday',   recyclingWeek: 'B' },
  { code: 'WED-A', day: 'wednesday', recyclingWeek: 'A' },
  { code: 'WED-B', day: 'wednesday', recyclingWeek: 'B' },
  { code: 'THU-A', day: 'thursday',  recyclingWeek: 'A' },
  { code: 'THU-B', day: 'thursday',  recyclingWeek: 'B' },
  { code: 'FRI-A', day: 'friday',    recyclingWeek: 'A' },
  { code: 'FRI-B', day: 'friday',    recyclingWeek: 'B' },
] as const;

async function main(): Promise<void> {
  console.log('Seeding City of Wanneroo...');

  const council = await prisma.council.upsert({
    where: { slug: 'wanneroo' },
    update: { isActive: true },
    create: {
      name: 'City of Wanneroo',
      slug: 'wanneroo',
      platformType: 'pdf',
      apiEndpoint: 'https://www.wanneroo.wa.gov.au/bincollections',
      isActive: true,
    },
  });

  console.log(`  ✓ Council: ${council.name} (${council.id})`);

  for (const zone of ZONES) {
    const greenWasteWeek = zone.recyclingWeek === 'A' ? 'B' : 'A';
    const zoneName = `City of Wanneroo — ${zone.day.charAt(0).toUpperCase() + zone.day.slice(1)} Week ${zone.recyclingWeek}`;

    const existing = await prisma.collectionZone.findFirst({
      where: { councilId: council.id, zoneCode: zone.code },
    });

    if (existing) {
      await prisma.collectionZone.update({
        where: { id: existing.id },
        data: {
          zoneName,
          generalDay: zone.day,
          generalFrequency: 'weekly',
          recyclingDay: zone.day,
          recyclingWeek: zone.recyclingWeek,
          greenWasteDay: zone.day,
          greenWasteWeek,
          updatedAt: new Date(),
        },
      });
    } else {
      await prisma.collectionZone.create({
        data: {
          councilId: council.id,
          zoneCode: zone.code,
          zoneName,
          generalDay: zone.day,
          generalFrequency: 'weekly',
          recyclingDay: zone.day,
          recyclingWeek: zone.recyclingWeek,
          greenWasteDay: zone.day,
          greenWasteWeek,
        },
      });
    }

    console.log(`  ✓ Zone: ${zone.code} (${zone.day}, recycling week ${zone.recyclingWeek})`);
  }

  console.log(`\nSeeded ${ZONES.length} Wanneroo zones.`);
}

main()
  .catch((err) => { console.error('Seed failed:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
