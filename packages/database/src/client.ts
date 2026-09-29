import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import * as schema from './schema.js';
import { MIGRATIONS_SQL } from './migrations.js';

export type DatabaseInstance = ReturnType<typeof drizzlePg<typeof schema>> | ReturnType<typeof drizzlePglite<typeof schema>>;

let dbInstance: any = null;
let pgPool: pg.Pool | null = null;
let pgliteInstance: PGlite | null = null;

export interface DatabaseConfig {
  databaseUrl?: string;
  pgliteDir?: string;
}

/**
 * Initializes database connection and runs idempotent table migrations.
 */
export async function initDatabase(config: DatabaseConfig = {}): Promise<DatabaseInstance> {
  if (dbInstance) {
    return dbInstance;
  }

  const databaseUrl = config.databaseUrl || process.env.DATABASE_URL;
  const isPostgresUrl =
    databaseUrl &&
    (databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://'));

  if (isPostgresUrl) {
    pgPool = new pg.Pool({
      connectionString: databaseUrl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    // Run migrations using raw client
    const client = await pgPool.connect();
    try {
      await client.query(MIGRATIONS_SQL);
    } finally {
      client.release();
    }

    dbInstance = drizzlePg(pgPool, { schema });
    return dbInstance;
  }

  // Fallback to embedded PGlite for self-contained local operation
  const dataDir = config.pgliteDir || process.env.PGLITE_DIR || './data/pgdata';
  if (!dataDir.startsWith('memory:')) {
    const fs = await import('node:fs');
    fs.mkdirSync(dataDir, { recursive: true });
  }
  pgliteInstance = new PGlite(dataDir);
  await pgliteInstance.waitReady;

  // Run migrations
  await pgliteInstance.exec(MIGRATIONS_SQL);

  dbInstance = drizzlePglite(pgliteInstance, { schema });
  return dbInstance;
}

export function getDb(): any {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return dbInstance;
}

export async function closeDatabase(): Promise<void> {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
  }
  if (pgliteInstance) {
    await pgliteInstance.close();
    pgliteInstance = null;
  }
  dbInstance = null;
}
