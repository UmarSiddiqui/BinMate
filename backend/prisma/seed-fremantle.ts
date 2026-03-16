/**
 * Seed City of Fremantle council + 6 collection zones.
 * Run with: npx tsx prisma/seed-fremantle.ts
 *
 * Zone code convention: FRE-{WasteID}
 * All zones: recyclingWeek = 'B' (Yellow/Recycling on Week B weeks)
 * FOGO collected weekly → generalFrequency = 'weekly'
 * No kerbside green waste → greenWasteDay/Week = null
 *
 * WasteIDs sourced from ArcGIS FeatureServer on 2026-03-16:
 *   FRE-1  Monday     (North Fremantle / O'Connor area)
 *   FRE-2  Monday     (Fremantle / High St area)
 *   FRE-4  Tuesday
 *   FRE-5  Thursday
 *   FRE-6  Wednesday
 *   FRE-7  Friday
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ZONES = [
  { code: 'FRE-1', day: 'monday',    wasteId: 1 },
  { code: 'FRE-2', day: 'monday',    wasteId: 2 },
  { code: 'FRE-4', day: 'tuesday',   wasteId: 4 },
  { code: 'FRE-5', day: 'thursday',  wasteId: 5 },
  { code: 'FRE-6', day: 'wednesday', wasteId: 6 },
  { code: 'FRE-7', day: 'friday',    wasteId: 7 },
] as const;

async function main(): Promise<void> {
  console.log('Seeding City of Fremantle...');

  const council = await prisma.council.upsert({
    where: { slug: 'fremantle' },
    update: { isActive: true },
    create: {
      name: 'City of Fremantle',
      slug: 'fremantle',
      platformType: 'arcgis',
      apiEndpoint:
        'https://services3.arcgis.com/gxYehwfGQwBQvQkx/arcgis/rest/services' +
        '/Domestic_waste_collection_areas/FeatureServer/60',
      isActive: true,
    },
  });

  console.log(`  ✓ Council: ${council.name} (${council.id})`);

  for (const zone of ZONES) {
    const zoneName = `City of Fremantle — ${zone.day.charAt(0).toUpperCase() + zone.day.slice(1)} (Zone ${zone.wasteId})`;

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
          recyclingWeek: 'B',
          greenWasteDay: null,
          greenWasteWeek: null,
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
          recyclingWeek: 'B',
          greenWasteDay: null,
          greenWasteWeek: null,
        },
      });
    }

    console.log(`  ✓ Zone: ${zone.code} (${zone.day})`);
  }

  console.log(`\nSeeded ${ZONES.length} Fremantle zones.`);
}

main()
  .catch((err) => { console.error('Seed failed:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
