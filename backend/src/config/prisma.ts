import { PrismaClient } from '@prisma/client';
import { env } from './env';

// Reused across hot reloads in dev so `tsx watch` doesn't open a new pool
// of Postgres connections on every file save.
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: env.isProduction ? ['error', 'warn'] : ['error', 'warn'],
  });

if (!env.isProduction) {
  global.__prisma = prisma;
}
