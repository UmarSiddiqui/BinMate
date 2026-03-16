/**
 * Seed Shire of Peppermint Grove council + fixed Friday zone.
 * Run with: npx tsx prisma/seed-peppermintgrove.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('Seeding Shire of Peppermint Grove...');

  const council = await prisma.council.upsert({
    where: { slug: 'peppermintgrove' },
    update: { isActive: true },
    create: {
      name: 'Shire of Peppermint Grove',
      slug: 'peppermintgrove',
      platformType: 'pdf',
      apiEndpoint: 'https://www.peppermintgrove.wa.gov.au/Profiles/sopg/Assets/ClientData/Recycling_Calendar_2026_-_Shire_of_Peppermint_Grove.pdf',
      isActive: true,
    },
  });

  const zoneCode = 'PEP-FRI-B';
  const data = {
    zoneName: 'Shire of Peppermint Grove — Friday (recycling Week B)',
    generalDay: 'friday',
    generalFrequency: 'weekly',
    recyclingDay: 'friday',
    recyclingWeek: 'B',
    greenWasteDay: 'friday',
    greenWasteWeek: 'weekly',
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

  console.log(`Seeded ${zoneCode}.`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
