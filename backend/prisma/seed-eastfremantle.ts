/**
 * Seed Town of East Fremantle council + 5 residential collection zones.
 * Run with: npx tsx prisma/seed-eastfremantle.ts
 *
 * Zone code convention: EFR-{DAY_ABBREV}-A
 * All East Fremantle zones share recycling Week A (PDF calendar verified 2026-03-17).
 * East Fremantle pattern:
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
  console.log('Seeding Town of East Fremantle...');

  const council = await prisma.council.upsert({
    where: { slug: 'eastfremantle' },
    update: { isActive: true },
    create: {
      name: 'Town of East Fremantle',
      slug: 'eastfremantle',
      platformType: 'custom',
      apiEndpoint: 'https://www.eastfremantle.wa.gov.au',
      isActive: true,
    },
  });

  let count = 0;
  for (const { abbrev, day } of DAYS) {
    const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
    const zoneCode = `EFR-${abbrev}-A`;
    await upsertZone(council.id, zoneCode, {
      zoneName: `Town of East Fremantle — ${dayLabel} (recycling Week A)`,
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

  console.log(`Seeded ${count} East Fremantle zones.`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
