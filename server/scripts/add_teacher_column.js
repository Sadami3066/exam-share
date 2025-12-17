const db = require('../db');

async function migrate() {
  try {
    await db.query('ALTER TABLE papers ADD COLUMN IF NOT EXISTS teacher VARCHAR(50);');
    console.log('Migration successful: Added teacher column');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed', err);
    process.exit(1);
  }
}

migrate();
