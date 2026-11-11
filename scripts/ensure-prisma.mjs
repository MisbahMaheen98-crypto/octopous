import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const prismaClientTypes = resolve(process.cwd(), 'node_modules/.prisma/client/index.d.ts');
const shouldGenerate = process.platform !== 'win32' || !existsSync(prismaClientTypes);

if (shouldGenerate) {
  console.log('[ensure-prisma] Generating Prisma Client...');
  try {
    execSync('npx prisma generate --schema database/prisma/schema.prisma', {
      stdio: 'inherit',
    });
  } catch (err) {
    if (process.platform === 'win32' && existsSync(prismaClientTypes)) {
      console.warn('[ensure-prisma] Warning: Prisma generate skipped (client already exists and may be locked by running process).');
    } else {
      throw err;
    }
  }
} else {
  console.log('[ensure-prisma] Prisma Client already present on Windows; skipping to avoid DLL lock.');
}
