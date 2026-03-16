/**
 * Seed City of Belmont council + 30 collection zones.
 * Run with: npx tsx prisma/seed-belmont.ts
 *
 * Zone code conventions:
 *   - BEL-FOGO-{DAY_ABBREV}-{RECYCLING_WEEK}-{REL}
 *       REL = S (FOGO same week as recycling) or O (FOGO opposite week)
 *   - BEL-STD-{DAY_ABBREV}-{RECYCLING_WEEK}
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

const WEEKS = ['A', 'B'] as const;

function oppositeWeek(week: 'A' | 'B'): 'A' | 'B' {
  return week === 'A' ? 'B' : 'A';
}

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
  console.log('Seeding City of Belmont...');

  const council = await prisma.council.upsert({
    where: { slug: 'belmont' },
    update: { isActive: true },
    create: {
      name: 'City of Belmont',
      slug: 'belmont',
      platformType: 'intramaps',
      apiEndpoint: 'https://www.belmont.wa.gov.au/api/intramaps',
      isActive: true,
    },
  });

  let count = 0;

  for (const { abbrev, day } of DAYS) {
    const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);

    for (const recyclingWeek of WEEKS) {
      const now = new Date();

      const stdZoneCode = `BEL-STD-${abbrev}-${recyclingWeek}`;
      await upsertZone(council.id, stdZoneCode, {
        zoneName: `City of Belmont — ${dayLabel} (standard, recycling Week ${recyclingWeek})`,
        generalDay: day,
        generalFrequency: 'weekly',
        recyclingDay: day,
        recyclingWeek,
        greenWasteDay: null,
        greenWasteWeek: null,
        updatedAt: now,
      });
      count++;

      const fogoSameZoneCode = `BEL-FOGO-${abbrev}-${recyclingWeek}-S`;
      await upsertZone(council.id, fogoSameZoneCode, {
        zoneName: `City of Belmont — ${dayLabel} (same-week FOGO, recycling Week ${recyclingWeek})`,
        generalDay: day,
        generalFrequency: 'weekly',
        recyclingDay: day,
        recyclingWeek,
        greenWasteDay: day,
        greenWasteWeek: recyclingWeek,
        updatedAt: now,
      });
      count++;

      const fogoOppZoneCode = `BEL-FOGO-${abbrev}-${recyclingWeek}-O`;
      await upsertZone(council.id, fogoOppZoneCode, {
        zoneName: `City of Belmont — ${dayLabel} (opposite-week FOGO, recycling Week ${recyclingWeek})`,
        generalDay: day,
        generalFrequency: 'weekly',
        recyclingDay: day,
        recyclingWeek,
        greenWasteDay: day,
        greenWasteWeek: oppositeWeek(recyclingWeek),
        updatedAt: now,
      });
      count++;
    }
  }

  console.log(`Seeded ${count} Belmont zones.`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

