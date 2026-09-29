import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { initDatabase, getDb } from '@dogfood/database';
import { importFixtures } from '@dogfood/fixture-importer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const targetFile = process.argv[2]
    ? path.resolve(process.cwd(), process.argv[2])
    : path.resolve(__dirname, '../fixtures.json');

  if (!fs.existsSync(targetFile)) {
    console.error(`Target fixture file not found at: ${targetFile}`);
    process.exit(1);
  }

  console.log(`Importing fixture file: ${targetFile}`);
  await initDatabase();
  const db = getDb();
  const result = await importFixtures(db, targetFile);
  console.log('Import result:', result);
  process.exit(0);
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
