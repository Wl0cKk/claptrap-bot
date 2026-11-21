import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sqlite = new Database('claptrap.db');
const db = drizzle(sqlite);

// Read the generated SQL migration file
const migrationFile = path.join(__dirname, 'drizzle/0000_lumpy_lionheart.sql');

if (!fs.existsSync(migrationFile)) {
  console.error('Migration file not found. Run "npx drizzle-kit generate" first.');
  process.exit(1);
}

const sql = fs.readFileSync(migrationFile, 'utf-8');

console.log('Applying migration...');
try {
  db.run(sql);
  console.log('Migration applied successfully!');
} catch (err) {
  console.error('Migration failed:', err);
} finally {
  sqlite.close();
}
