/**
 * Seed Town of Cottesloe council + 5 residential collection zones.
 * Run with: npx tsx prisma/seed-cottesloe.ts
 *
 * Zone code convention: COT-{DAY_ABBREV}-A
 * All Cottesloe zones share recycling Week A (calendar: 2026-01-05 = yellow/recycling week → Week A).
 * Cottesloe pattern:
 *   - FOGO (lime green): weekly
 *   - Recycling (yellow): fortnightly Week A
 *   - General waste (red): fortnightly Week B (opposite)
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
  console.log('Seeding Town of Cottesloe...');

  const council = await prisma.council.upsert({
    where: { slug: 'cottesloe' },
    update: { isActive: true },
    create: {
      name: 'Town of Cottesloe',
      slug: 'cottesloe',
      platformType: 'custom',
      apiEndpoint: 'https://www.cottesloe.wa.gov.au',
      isActive: true,
    },
  });

  let count = 0;
  for (const { abbrev, day } of DAYS) {
    const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
    const zoneCode = `COT-${abbrev}-A`;
    await upsertZone(council.id, zoneCode, {
      zoneName: `Town of Cottesloe — ${dayLabel} (recycling Week A)`,
      generalDay: day,
      generalFrequency: 'weekly',
      recyclingDay: day,
      recyclingWeek: 'A',
      greenWasteDay: day,
      greenWasteWeek: 'B',
      updatedAt: new Date(),
    });
    count += 1;
  }

  console.log(`Seeded ${count} Cottesloe zones.`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
