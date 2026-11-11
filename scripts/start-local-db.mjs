import fs from 'node:fs';
import path from 'node:path';

async function main() {
  let EmbeddedPostgres;
  try {
    const mod = await import('embedded-postgres');
    EmbeddedPostgres = mod.default || mod;
  } catch {
    console.error('[PostgreSQL] "embedded-postgres" is not installed.');
    console.log('[PostgreSQL] The application is configured to connect to your remote/local PostgreSQL database via DATABASE_URL.');
    console.log('[PostgreSQL] If you want an embedded database for offline testing, install it locally with: npm i -D embedded-postgres');
    process.exit(1);
  }

  const dataDir = path.resolve(process.cwd(), '.octopus-storage/postgres-data');

  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    persistent: true,
  });

  const needsInit = !fs.existsSync(path.join(dataDir, 'PG_VERSION'));
  if (needsInit) {
    console.log('[PostgreSQL] Initializing data directory at:', dataDir);
    await pg.initialise();
  }

  console.log('[PostgreSQL] Starting database engine on port 5432...');
  await pg.start();
  console.log('[PostgreSQL] Server started successfully!');

  try {
    console.log('[PostgreSQL] Ensuring database "octopus" exists...');
    await pg.createDatabase('octopus');
    console.log('[PostgreSQL] Database "octopus" created.');
  } catch (err) {
    if (!err.message?.includes('already exists')) {
      console.warn('[PostgreSQL] Notice:', err.message);
    }
  }

  console.log('[PostgreSQL] Ready! Connection: postgresql://postgres:postgres@localhost:5432/octopus');

  // Keep process alive to serve queries
  await new Promise(() => {});
}

main().catch((err) => {
  console.error('[PostgreSQL] Failed to start:', err);
  process.exit(1);
});
