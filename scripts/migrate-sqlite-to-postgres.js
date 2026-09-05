'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { Pool } = require('pg');

const sqliteFile = process.env.LOCAL_DB_FILE || path.join(__dirname, '..', 'data', 'eyadaty.sqlite');
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!connectionString) throw new Error('Set DATABASE_URL or POSTGRES_URL first.');
if (!fs.existsSync(sqliteFile)) throw new Error(`SQLite file not found: ${sqliteFile}`);

const sqlite = new DatabaseSync(sqliteFile);
const row = sqlite.prepare('SELECT payload FROM app_state WHERE id=1').get();
if (!row) throw new Error('SQLite database has no app_state row.');
const payload = JSON.parse(row.payload);
const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

(async () => {
  const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS eyadaty_app_state (
      id INTEGER PRIMARY KEY CHECK (id = 1), payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    await client.query(`INSERT INTO eyadaty_app_state (id, payload, updated_at) VALUES (1, $1::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`, [JSON.stringify(payload)]);
    console.log(`Migration complete. Users: ${payload.users?.length || 0}`);
  } finally { client.release(); await pool.end(); sqlite.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
