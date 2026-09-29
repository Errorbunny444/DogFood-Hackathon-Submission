import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDatabase, getDb } from '@dogfood/database';
import { importFixtures } from '@dogfood/fixture-importer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('Seeding DOGFOOD database...');
  await initDatabase();
  const db = getDb();
  const fixturePath = path.resolve(__dirname, '../fixtures.json');
  const result = await importFixtures(db, fixturePath);
  console.log('Seed completed successfully:', result);
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
