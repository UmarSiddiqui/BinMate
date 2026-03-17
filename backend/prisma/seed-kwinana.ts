/**
 * Seed City of Kwinana council + 20 residential collection zones.
 * Run with: npx tsx prisma/seed-kwinana.ts
 *
 * Zone code convention: KWN-{DAY_ABBREV}-{RECYCLING_WEEK}-{GO_WEEK}
 *   RECYCLING_WEEK: A | B | W  (W = weekly)
 *   GO_WEEK:        A | B | W  (W = weekly — typical for FOGO properties)
 *
 * Seeds the 4 most common recycling/GO combinations per weekday (20 zones).
 * Additional zone codes can be upserted on first encounter by the address service.
 *
 * Kwinana pattern:
 *   - General waste (red): fortnightly (opposite week to recycling)
 *   - Recycling (yellow): fortnightly Week A or B
 *   - Garden Organics / FOGO: weekly (W) OR fortnightly A or B
 *
 * Data source: T1Cloud IntraMaps (kwinana.spatial.t1cloud.com)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type WeekValue = 'A' | 'B' | 'weekly';

const DAYS = [
  { abbrev: 'MON', day: 'monday' },
  { abbrev: 'TUE', day: 'tuesday' },
  { abbrev: 'WED', day: 'wednesday' },
  { abbrev: 'THU', day: 'thursday' },
  { abbrev: 'FRI', day: 'friday' },
] as const;

/** Most common recycling+GO combinations seen in Kwinana. */
const WEEK_COMBOS: Array<{ recycleToken: 'A' | 'B'; goToken: 'A' | 'B' | 'W'; recycleWeek: WeekValue; goWeek: WeekValue }> = [
  { recycleToken: 'A', goToken: 'W', recycleWeek: 'A', goWeek: 'weekly' },
  { recycleToken: 'B', goToken: 'W', recycleWeek: 'B', goWeek: 'weekly' },
  { recycleToken: 'A', goToken: 'B', recycleWeek: 'A', goWeek: 'B' },
  { recycleToken: 'B', goToken: 'A', recycleWeek: 'B', goWeek: 'A' },
];

async function upsertZone(
  councilId: string,
  zoneCode: string,
  data: {
    zoneName: string;
    generalDay: string;
    generalFrequency: string;
    recyclingDay: string;
    recyclingWeek: WeekValue;
    greenWasteDay: string | null;
    greenWasteWeek: WeekValue | null;
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
  console.log('Seeding City of Kwinana...');

  const council = await prisma.council.upsert({
    where: { slug: 'kwinana' },
    update: { isActive: true },
    create: {
      name: 'City of Kwinana',
      slug: 'kwinana',
      platformType: 't1cloud',
      apiEndpoint: 'https://kwinana.spatial.t1cloud.com/spatial/intramaps/ApplicationEngine',
      isActive: true,
    },
  });

  let count = 0;
  for (const { abbrev, day } of DAYS) {
    const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
    for (const { recycleToken, goToken, recycleWeek, goWeek } of WEEK_COMBOS) {
      const zoneCode = `KWN-${abbrev}-${recycleToken}-${goToken}`;
      await upsertZone(council.id, zoneCode, {
        zoneName: `City of Kwinana — ${dayLabel} (recycling ${recycleToken}, GO ${goToken})`,
        generalDay: day,
        generalFrequency: 'weekly',
        recyclingDay: day,
        recyclingWeek: recycleWeek,
        greenWasteDay: day,
        greenWasteWeek: goWeek,
        updatedAt: new Date(),
      });
      count += 1;
    }
  }

  console.log(`Seeded ${count} Kwinana zones.`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
