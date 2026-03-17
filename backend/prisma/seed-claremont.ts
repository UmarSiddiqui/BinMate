/**
 * Seed Town of Claremont council + 5 residential collection zones.
 * Run with: npx tsx prisma/seed-claremont.ts
 *
 * Zone code convention: CLR-{DAY_ABBREV}-B
 * All Claremont zones share recycling Week B (calendar: 2026-01-05 = green/GO week → Week A).
 * Claremont pattern:
 *   - FOGO (lime green): weekly
 *   - Recycling (yellow): fortnightly Week B
 *   - General waste (red): fortnightly Week A (opposite)
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
  console.log('Seeding Town of Claremont...');

  const council = await prisma.council.upsert({
    where: { slug: 'claremont' },
    update: { isActive: true },
    create: {
      name: 'Town of Claremont',
      slug: 'claremont',
      platformType: 'custom',
      apiEndpoint: 'https://www.claremont.wa.gov.au',
      isActive: true,
    },
  });

  let count = 0;
  for (const { abbrev, day } of DAYS) {
    const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
    const zoneCode = `CLR-${abbrev}-B`;
    await upsertZone(council.id, zoneCode, {
      zoneName: `Town of Claremont — ${dayLabel} (recycling Week B)`,
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

  console.log(`Seeded ${count} Claremont zones.`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
