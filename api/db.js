'use strict';

const { Pool } = require('pg');

let pool;
function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!connectionString) throw new Error('DATABASE_URL is not configured');
    pool = new Pool({ connectionString, max: 3, idleTimeoutMillis: 10000, connectionTimeoutMillis: 10000, ssl: { rejectUnauthorized: false } });
  }
  return pool;
}

function blank() {
  return {
    users: [], appointments: [], queue_tickets: [], visits: [], prescriptions: [],
    medical_files: [], payments: [], notifications: [], messages: [], audit_logs: [],
    settings: { clinicName: 'عيادتي', logo: '', phone: '', address: '', workStart: '09:00',
      workEnd: '17:00', workDays: [0, 1, 2, 3, 4, 5, 6], appointmentDuration: 15,
      dailyLimit: 20, consultationPrice: 200, currency: 'ج.م', bookingOpen: true,
      requireWorkingToday: true, _rev: 0 }
  };
}

async function ensureTable(client) {
  await client.query(`CREATE TABLE IF NOT EXISTS eyadaty_app_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    payload JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
}

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const client = await getPool().connect();
  try {
    await ensureTable(client);
    if (req.method === 'GET') {
      const result = await client.query('SELECT payload FROM eyadaty_app_state WHERE id = 1');
      if (!result.rowCount) {
        const state = blank();
        await client.query('INSERT INTO eyadaty_app_state (id, payload) VALUES (1, $1::jsonb)', [JSON.stringify(state)]);
        return res.status(200).json(state);
      }
      return res.status(200).json(result.rows[0].payload);
    }
    if (req.method === 'PUT') {
      const state = req.body;
      if (!state || typeof state !== 'object' || !Array.isArray(state.users)) return res.status(400).json({ error: 'invalid database payload' });
      await client.query(`INSERT INTO eyadaty_app_state (id, payload, updated_at) VALUES (1, $1::jsonb, NOW())
        ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`, [JSON.stringify(state)]);
      return res.status(200).json({ ok: true });
    }
    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'database request failed' });
  } finally {
    client.release();
  }
}

module.exports = handler;
