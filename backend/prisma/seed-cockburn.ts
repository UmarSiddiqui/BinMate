/**
 * Seed City of Cockburn council + collection zones.
 * Run with: npx tsx prisma/seed-cockburn.ts
 *
 * Cockburn uses:
 *   - General waste: weekly
 *   - Recycling:     weekly
 *   - Garden organics: fortnightly (Week A or B) where applicable
 *   - Verge dates:   driven by verge area 0-11
 *
 * Zone code convention:
 *   COC-{DAY_ABBREV}-{GARDEN_CODE}-{AREA}
 *
 * We seed a superset of valid combinations:
 *   - Areas 1-10: every weekday × garden Week A/B
 *   - Areas 0 and 11: every weekday with no garden organics service
 *
 * This mirrors the Armadale strategy: a few unused combinations may exist in
 * the database, but every live property lookup will resolve to a seeded zone.
 */

import { PrismaClient } from '@prisma/client';
import { COCKBURN_AREA_VERGE_DATES } from '../src/scrapers/cockburn';

const prisma = new PrismaClient();

const DAYS = [
  { abbrev: 'MON', day: 'monday' },
  { abbrev: 'TUE', day: 'tuesday' },
  { abbrev: 'WED', day: 'wednesday' },
  { abbrev: 'THU', day: 'thursday' },
  { abbrev: 'FRI', day: 'friday' },
] as const;

const GARDEN_AREAS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
const NO_GARDEN_AREAS = [0, 11] as const;
const GARDEN_WEEKS = ['A', 'B'] as const;

function zoneName(day: string, gardenCode: 'A' | 'B' | 'N', area: number): string {
  const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
  const gardenLabel =
    gardenCode === 'N' ? 'No Garden Organics' : `Garden Organics Week ${gardenCode}`;
  return `City of Cockburn — ${dayLabel}, ${gardenLabel}, Area ${area}`;
}

async function upsertZone(
  councilId: string,
  zoneCode: string,
  zoneNameValue: string,
  day: string,
  gardenCode: 'A' | 'B' | 'N',
  area: number
): Promise<void> {
  const existing = await prisma.collectionZone.findFirst({
    where: { councilId, zoneCode },
  });

  const data = {
    zoneName: zoneNameValue,
    generalDay: day,
    generalFrequency: 'weekly',
    recyclingDay: day,
    recyclingWeek: 'weekly',
    greenWasteDay: gardenCode === 'N' ? null : day,
    greenWasteWeek: gardenCode === 'N' ? null : gardenCode,
    vergeDates: COCKBURN_AREA_VERGE_DATES[area] ?? undefined,
    updatedAt: new Date(),
  };

  if (existing) {
    await prisma.collectionZone.update({
      where: { id: existing.id },
      data,
    });
    return;
  }

  await prisma.collectionZone.create({
    data: {
      councilId,
      zoneCode,
      ...data,
    },
  });
}

async function main(): Promise<void> {
  console.log('Seeding City of Cockburn...');

  const council = await prisma.council.upsert({
    where: { slug: 'cockburn' },
    update: { isActive: true },
    create: {
      name: 'City of Cockburn',
      slug: 'cockburn',
      platformType: 'widget',
      apiEndpoint: 'https://gis1.cockburn.wa.gov.au/webapiv2',
      isActive: true,
    },
  });

  console.log(`  ✓ Council: ${council.name} (${council.id})`);

  let zoneCount = 0;

  for (const { abbrev, day } of DAYS) {
    for (const area of GARDEN_AREAS) {
      for (const gardenWeek of GARDEN_WEEKS) {
        const code = `COC-${abbrev}-${gardenWeek}-${area}`;
        await upsertZone(council.id, code, zoneName(day, gardenWeek, area), day, gardenWeek, area);
        zoneCount++;
      }
    }

    for (const area of NO_GARDEN_AREAS) {
      const code = `COC-${abbrev}-N-${area}`;
      await upsertZone(council.id, code, zoneName(day, 'N', area), day, 'N', area);
      zoneCount++;
    }
  }

  console.log(`\nSeeded ${zoneCount} Cockburn zones.`);
}

main()
  .catch((err) => { console.error('Seed failed:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
