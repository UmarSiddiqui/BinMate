import { PrismaClient } from '@prisma/client';

/** Singleton Prisma client — import this everywhere, never instantiate directly. */
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export default prisma;
