'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT || 4000);
const HOST = process.env.HOST || '127.0.0.1';
const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'eyadaty.sqlite');
const MAX_BODY = 12 * 1024 * 1024;

fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(DB_FILE);
db.exec(`CREATE TABLE IF NOT EXISTS app_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`);

const blank = () => ({
  users: [], appointments: [], queue_tickets: [], visits: [], prescriptions: [],
  medical_files: [], payments: [], notifications: [], messages: [], audit_logs: [],
  settings: { clinicName: 'عيادتي', logo: '', phone: '', address: '', workStart: '09:00',
    workEnd: '17:00', workDays: [0, 1, 2, 3, 4, 5, 6], appointmentDuration: 15,
    dailyLimit: 20, consultationPrice: 200, currency: 'ج.م', bookingOpen: true,
    requireWorkingToday: true, _rev: 0 }
});

function passwordHash(password, salt) {
  return crypto.createHash('sha256').update(`${salt}::${password}`).digest('hex');
}

function loadState() {
  const row = db.prepare('SELECT payload FROM app_state WHERE id=1').get();
  if (!row) {
    const state = blank();
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (adminPassword) {
      const salt = crypto.randomUUID();
      state.users.push({ id: crypto.randomUUID(), role: 'admin', name: process.env.ADMIN_NAME || 'مدير النظام',
        email: (process.env.ADMIN_EMAIL || 'admin@localhost').toLowerCase(), phone: '', salt,
        hash: passwordHash(adminPassword, salt), active: true, createdAt: new Date().toISOString() });
    }
    saveState(state);
    return state;
  }
  try { return JSON.parse(row.payload); } catch { return blank(); }
}

function saveState(state) {
  const payload = JSON.stringify(state);
  db.prepare(`INSERT INTO app_state (id,payload,updated_at) VALUES (1,?,?)
    ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at`)
    .run(payload, new Date().toISOString());
}

function json(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', chunk => { size += chunk.length; if (size > MAX_BODY) reject(new Error('request too large')); else chunks.push(chunk); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new Error('invalid JSON')); } });
    req.on('error', reject);
  });
}

function serveIndex(res) {
  const body = fs.readFileSync(path.join(ROOT, 'index.html'));
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache',
    'Content-Security-Policy': "default-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com data: blob:; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self' 'unsafe-inline'; frame-src 'self' data: blob:;" });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/api/health') return json(res, 200, { ok: true });
    if (req.method === 'GET' && req.url === '/api/db') return json(res, 200, loadState());
    if (req.method === 'PUT' && req.url === '/api/db') {
      const state = await readBody(req);
      if (!state || typeof state !== 'object' || !Array.isArray(state.users)) return json(res, 400, { error: 'invalid database payload' });
      saveState(state); return json(res, 200, { ok: true, updatedAt: new Date().toISOString() });
    }
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) return serveIndex(res);
    if (req.method === 'GET' && req.url === '/favicon.ico') return res.writeHead(204).end();
    return json(res, 404, { error: 'not found' });
  } catch (err) {
    console.error(err);
    return json(res, err.message === 'request too large' ? 413 : 400, { error: 'request failed' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Eyadaty is running at http://${HOST}:${PORT}`);
  if (!process.env.ADMIN_PASSWORD) console.log('No admin account created. Set ADMIN_PASSWORD before first start.');
});

process.on('SIGINT', () => { db.close(); server.close(() => process.exit(0)); });
process.on('SIGTERM', () => { db.close(); server.close(() => process.exit(0)); });
