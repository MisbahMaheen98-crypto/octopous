import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { env } from '../config/env.js';

declare global {
  var __octopusPrisma: PrismaClient | undefined;
  var __octopusPgPool: pg.Pool | undefined;
}

function createPrismaClient(): PrismaClient {
  const pool =
    globalThis.__octopusPgPool ??
    new pg.Pool({
      connectionString: env.DATABASE_URL,
    });

  if (process.env.NODE_ENV !== 'production') {
    globalThis.__octopusPgPool = pool;
  }

  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: ['error', 'warn'],
  });
}

export const prisma = globalThis.__octopusPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__octopusPrisma = prisma;
}
