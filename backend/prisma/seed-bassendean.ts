/**
 * Seed Town of Bassendean council + 5 residential collection zones.
 * Run with: npx tsx prisma/seed-bassendean.ts
 *
 * Zone code convention: BAS-{DAY_ABBREV}-B
 * All Bassendean zones share recycling Week B (ArcGIS popup expressions verified 2026-03-17).
 * Bassendean pattern:
 *   - FOGO (lime green): weekly
 *   - Recycling (yellow): fortnightly Week B
 *   - General waste (red): fortnightly Week A (opposite)
 *
 * Data source: ArcGIS FeatureServer
 *   services-ap1.arcgis.com/551UnqKK1GZeDKxQ/arcgis/rest/services/address_lookup_for_bin_days_dissolved/FeatureServer/0
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

async function upsertZone(
  councilId: string,
  zoneCode: string,
  data: {
    zoneName: string;
    generalDay: string;
    generalFrequency: string;
    recyclingDay: string;
    recyclingWeek: 'A' | 'B' | 'weekly';
    greenWasteDay: string | null;
    greenWasteWeek: 'A' | 'B' | 'weekly' | null;
    updatedAt: Date;
  },
): Promise<void> {
  const existing = await prisma.collectionZone.findFirst({ where: { councilId, zoneCode } });
  if (existing) {
    await prisma.collectionZone.update({ where: { id: existing.id }, data });
    return;
  }
  await prisma.collectionZone.create({ data: { councilId, zoneCode, ...data } });
}

async function main(): Promise<void> {
  console.log('Seeding Town of Bassendean...');

  const council = await prisma.council.upsert({
    where: { slug: 'bassendean' },
    update: { isActive: true },
    create: {
      name: 'Town of Bassendean',
      slug: 'bassendean',
      platformType: 'arcgis',
      apiEndpoint:
        'https://services-ap1.arcgis.com/551UnqKK1GZeDKxQ/arcgis/rest/services/address_lookup_for_bin_days_dissolved/FeatureServer/0',
      isActive: true,
    },
  });

  let count = 0;
  for (const { abbrev, day } of DAYS) {
    const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
    const zoneCode = `BAS-${abbrev}-B`;
    await upsertZone(council.id, zoneCode, {
      zoneName: `Town of Bassendean — ${dayLabel} (recycling Week B)`,
      generalDay: day,
      generalFrequency: 'weekly',
      recyclingDay: day,
      recyclingWeek: 'B',
      greenWasteDay: day,
      greenWasteWeek: 'A',
      updatedAt: new Date(),
    });
    count += 1;
  }

  console.log(`Seeded ${count} Bassendean zones.`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
