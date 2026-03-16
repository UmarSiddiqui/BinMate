/**
 * Seed Town of Cambridge council + 20 collection zones.
 * Run with: npx tsx prisma/seed-cambridge.ts
 *
 * Zone code conventions:
 *   CAM-FOGO-{DAY_ABBREV}-{RECYCLING_WEEK}
 *   CAM-STD-{DAY_ABBREV}-{RECYCLING_WEEK}
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
const SCHEMES = [
  { prefix: 'FOGO', label: 'FOGO' },
  { prefix: 'STD', label: 'standard' },
] as const;

async function main(): Promise<void> {
  console.log('Seeding Town of Cambridge...');

  const council = await prisma.council.upsert({
    where: { slug: 'cambridge' },
    update: { isActive: true },
    create: {
      name: 'Town of Cambridge',
      slug: 'cambridge',
      platformType: 'opencities',
      apiEndpoint: 'https://www.cambridge.wa.gov.au/ocapi/Public/myarea/wasteservices',
      isActive: true,
    },
  });

  let count = 0;

  for (const scheme of SCHEMES) {
    for (const { abbrev, day } of DAYS) {
      for (const recyclingWeek of WEEKS) {
        const zoneCode = `CAM-${scheme.prefix}-${abbrev}-${recyclingWeek}`;
        const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
        const greenWasteWeek = recyclingWeek === 'A' ? 'B' : 'A';

        const data = {
          zoneName: `Town of Cambridge — ${scheme.label} ${dayLabel} (recycling Week ${recyclingWeek})`,
          generalDay: day,
          generalFrequency: 'weekly',
          recyclingDay: day,
          recyclingWeek,
          greenWasteDay: day,
          greenWasteWeek,
          updatedAt: new Date(),
        };

        const existing = await prisma.collectionZone.findFirst({
          where: { councilId: council.id, zoneCode },
        });

        if (existing) {
          await prisma.collectionZone.update({ where: { id: existing.id }, data });
        } else {
          await prisma.collectionZone.create({
            data: { councilId: council.id, zoneCode, ...data },
          });
        }

        count++;
      }
    }
  }

  console.log(`Seeded ${count} Cambridge zones.`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
