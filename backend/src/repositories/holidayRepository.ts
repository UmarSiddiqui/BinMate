import prisma from '../utils/prisma';

/** Return all WA public holiday dates as UTC midnight Date objects. */
export async function getAllHolidays(): Promise<Date[]> {
  const rows = await prisma.waPublicHoliday.findMany({
    select: { date: true },
    orderBy: { date: 'asc' },
  });
  return rows.map((r) => r.date);
}

/** Return WA public holidays between two dates (inclusive). */
export async function getHolidaysBetween(from: Date, to: Date): Promise<Date[]> {
  const rows = await prisma.waPublicHoliday.findMany({
    where: { date: { gte: from, lte: to } },
    select: { date: true },
    orderBy: { date: 'asc' },
  });
  return rows.map((r) => r.date);
}
