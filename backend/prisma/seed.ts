/**
 * Seed WA public holidays for 2026 and 2027.
 * Source: https://www.wa.gov.au/service/employment/workplace-agreements/public-holidays-western-australia
 * Run with: npx tsx prisma/seed.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const WA_HOLIDAYS: Array<{ name: string; date: string }> = [
  // ── 2026 ──────────────────────────────────────────────────────────────────
  { name: "New Year's Day",              date: '2026-01-01' },
  { name: 'Australia Day',               date: '2026-01-26' },
  { name: 'Good Friday',                 date: '2026-04-03' },
  { name: 'Easter Saturday',             date: '2026-04-04' },
  { name: 'Easter Sunday',               date: '2026-04-05' },
  { name: 'Easter Monday',               date: '2026-04-06' },
  { name: 'Anzac Day',                   date: '2026-04-25' },
  { name: 'Western Australia Day',       date: '2026-06-01' },
  { name: "Queen's/King's Birthday",     date: '2026-09-28' }, // 4th Monday September
  { name: 'Christmas Day',               date: '2026-12-25' },
  { name: 'Boxing Day',                  date: '2026-12-26' },

  // ── 2027 ──────────────────────────────────────────────────────────────────
  { name: "New Year's Day",              date: '2027-01-01' },
  { name: 'Australia Day',               date: '2027-01-26' },
  { name: 'Good Friday',                 date: '2027-03-26' },
  { name: 'Easter Saturday',             date: '2027-03-27' },
  { name: 'Easter Sunday',               date: '2027-03-28' },
  { name: 'Easter Monday',               date: '2027-03-29' },
  { name: 'Anzac Day',                   date: '2027-04-26' }, // observed (25th is Sunday)
  { name: 'Western Australia Day',       date: '2027-06-07' }, // 1st Monday June
  { name: "Queen's/King's Birthday",     date: '2027-09-27' }, // 4th Monday September
  { name: 'Christmas Day',               date: '2027-12-27' }, // observed (25th is Saturday)
  { name: 'Boxing Day',                  date: '2027-12-28' }, // observed (26th is Sunday)
];

async function main(): Promise<void> {
  console.log('Seeding WA public holidays...');

  for (const h of WA_HOLIDAYS) {
    await prisma.waPublicHoliday.upsert({
      where: { id: `holiday-${h.date}` },
      update: { name: h.name },
      create: {
        id: `holiday-${h.date}`,
        name: h.name,
        date: new Date(`${h.date}T00:00:00.000Z`),
        shiftDays: 1,
      },
    });
    console.log(`  ✓ ${h.date} — ${h.name}`);
  }

  console.log(`\nSeeded ${WA_HOLIDAYS.length} holidays.`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
