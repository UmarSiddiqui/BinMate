/**
 * Seed City of Rockingham council + zone patterns used by the scraper.
 * Run with: npx tsx prisma/seed-rockingham.ts
 *
 * Zone code convention: ROC-{DAY_ABBREV}-{RECYCLE_CODE}-{WASTE_CODE}-{FOGO_CODE}
 *   RECYCLE_CODE: A | B
 *   WASTE_CODE:   A | B | W
 *   FOGO_CODE:    W | N
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

const RECYCLE_WEEKS = ['A', 'B'] as const;

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
  console.log('Seeding City of Rockingham...');

  const council = await prisma.council.upsert({
    where: { slug: 'rockingham' },
    update: { isActive: true },
    create: {
      name: 'City of Rockingham',
      slug: 'rockingham',
      platformType: 't1cloud',
      apiEndpoint: 'https://maps.rockingham.wa.gov.au/IntraMaps23A/ApplicationEngine',
      isActive: true,
    },
  });

  let count = 0;
  for (const { abbrev, day } of DAYS) {
    const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);

    // FOGO pattern: recycling fortnightly, waste fortnightly on opposite week, FOGO weekly.
    for (const recycleWeek of RECYCLE_WEEKS) {
      const wasteWeek = recycleWeek === 'A' ? 'B' : 'A';
      const zoneCode = `ROC-${abbrev}-${recycleWeek}-${wasteWeek}-W`;
      await upsertZone(council.id, zoneCode, {
        zoneName: `City of Rockingham — ${dayLabel} (recycling ${recycleWeek}, waste ${wasteWeek}, FOGO W)`,
        generalDay: day,
        generalFrequency: 'fortnightly',
        recyclingDay: day,
        recyclingWeek: recycleWeek,
        greenWasteDay: day,
        greenWasteWeek: 'weekly',
        updatedAt: new Date(),
      });
      count += 1;
    }

    // Non-FOGO pattern: recycling fortnightly, waste weekly, no FOGO.
    for (const recycleWeek of RECYCLE_WEEKS) {
      const zoneCode = `ROC-${abbrev}-${recycleWeek}-W-N`;
      await upsertZone(council.id, zoneCode, {
        zoneName: `City of Rockingham — ${dayLabel} (recycling ${recycleWeek}, waste W, FOGO N)`,
        generalDay: day,
        generalFrequency: 'weekly',
        recyclingDay: day,
        recyclingWeek: recycleWeek,
        greenWasteDay: null,
        greenWasteWeek: null,
        updatedAt: new Date(),
      });
      count += 1;
    }
  }

  console.log(`Seeded ${count} Rockingham zones.`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
