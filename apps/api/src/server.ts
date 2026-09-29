import fs from 'node:fs';
import path from 'node:path';
import { initDatabase } from '@dogfood/database';
import { importFixtures } from '@dogfood/fixture-importer';
import { buildApp } from './app.js';
import { config } from './config/index.js';
import { startJobWorker, stopJobWorker } from './services/jobs/worker.js';

async function findFixturesFile(): Promise<string> {
  const candidates = [
    config.fixturesPath,
    './fixtures.json',
    '../fixtures.json',
    '../../fixtures.json',
    path.resolve(process.cwd(), 'fixtures.json'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return path.resolve(c);
    }
  }
  return path.resolve(process.cwd(), 'fixtures.json');
}

export async function startServer() {
  console.log('🚀 Starting DOGFOOD 2026 Platform API Server...');

  // 1. Initialize Database & Run Idempotent Migrations
  console.log('📦 Initializing database...');
  const db = await initDatabase({
    databaseUrl: config.databaseUrl,
    pgliteDir: config.pgliteDir,
  });
  console.log('✅ Database connected and migrated.');

  // 2. Check and Import Fixtures if enabled (Demo mode or explicit SEED_DEMO_DATA=true)
  if (config.seedDemoData) {
    const fixturesPath = await findFixturesFile();
    if (fs.existsSync(fixturesPath)) {
      console.log(`📂 [APP_MODE=${config.appMode}] Found fixtures file at: ${fixturesPath}`);
      const result = await importFixtures(db, { fixturePath: fixturesPath });

      if (result.skipped) {
        console.log('⚡ Fixture data was previously imported (SHA-256 match). Re-verified acceptance sessions.');
      } else {
        console.log(`🎉 Successfully imported fixtures (${result.counts.projects} projects, ${result.counts.reviews} reviews).`);
      }

      // 3. Print Deterministic Acceptance Identifiers in Demo Mode
      if (config.appMode === 'demo') {
        console.log('\n======================================================');
        console.log('Seeded DOGFOOD acceptance identities (DEMO MODE):');
        console.log('');
        console.log('organizer');
        console.log(result.acceptance.organizer.cookie);
        console.log('');
        console.log('judge_a');
        console.log(result.acceptance.judgeA.cookie);
        console.log('');
        console.log('judge_b');
        console.log(result.acceptance.judgeB.cookie);
        console.log('');
        console.log('participant');
        console.log(result.acceptance.participant.cookie);
        console.log('======================================================\n');
      }
    } else {
      console.warn(`⚠️ Fixtures file not found at ${fixturesPath}`);
    }
  } else {
    console.log(`🔒 [APP_MODE=${config.appMode}] Production mode active: demo fixture seeding & acceptance sessions disabled.`);
  }

  // 4. Start Background Job Worker (if enabled)
  if (process.env.JOB_WORKER_ENABLED !== 'false') {
    startJobWorker(2000);
  }

  // 5. Start Fastify Server
  const app = buildApp();
  await app.listen({ port: config.port, host: config.host });
  console.log(`🌐 Server running at http://${config.host}:${config.port}`);
  console.log(`📖 OpenAPI Documentation at http://${config.host}:${config.port}/api/v1/docs`);

  const shutdown = async () => {
    console.log('\n🛑 Initiating graceful shutdown...');
    stopJobWorker();
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return app;
}

if (process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    console.error('Fatal error starting DOGFOOD server:', err);
    process.exit(1);
  });
}

