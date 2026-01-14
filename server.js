
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import cors from 'cors';
import dotenv from 'dotenv';
import https from 'https';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from various possible locations on Hostinger
const envPaths = [
  path.join(__dirname, '.env'),
  path.join(__dirname, '..', '.env')
];

for (const p of envPaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    console.log(`[AuraGold Server] Environment loaded: ${p}`);
    break;
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Database Setup
const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 15000
};

let pool = null;

const initDb = async () => {
  if (!dbConfig.user || !dbConfig.database) {
    console.warn('[AuraGold Server] Database credentials missing in environment.');
    return;
  }
  try {
    pool = mysql.createPool(dbConfig);
    const conn = await pool.getConnection();
    console.log('[AuraGold Server] MySQL Connected');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS aura_storage (
        id INT PRIMARY KEY DEFAULT 1,
        data LONGTEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    conn.release();
  } catch (err) {
    console.error('[AuraGold Server] DB Error:', err.message);
  }
};

// --- API ---
app.get('/api/health', (req, res) => res.json({ status: 'ok', db: !!pool }));

app.get('/api/storage', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'DB not available' });
  try {
    const [rows] = await pool.query('SELECT data FROM aura_storage WHERE id = 1');
    res.json(rows[0] ? JSON.parse(rows[0].data) : { orders: [], lastUpdated: 0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/storage', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'DB not available' });
  try {
    const data = JSON.stringify(req.body);
    await pool.query('INSERT INTO aura_storage (id, data) VALUES (1, ?) ON DUPLICATE KEY UPDATE data = ?', [data, data]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/rates', (req, res) => {
  https.get('https://uat.batuk.in/augmont/gold', (apiRes) => {
    let data = '';
    apiRes.on('data', d => data += d);
    apiRes.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        const rate24K = parseFloat(parsed?.data?.[0]?.[0]?.gSell || 0);
        res.json({ rate24K, rate22K: Math.round(rate24K * 0.916), success: true });
      } catch (e) { res.status(500).json({ error: 'Parse error' }); }
    });
  }).on('error', e => res.status(500).json({ error: 'Service down' }));
});

// --- SERVE PRODUCTION BUILD ---
const distPath = path.join(__dirname, 'dist');

if (fs.existsSync(distPath)) {
  console.log(`[AuraGold Server] Serving from dist: ${distPath}`);
  app.use(express.static(distPath));
  
  // SPA routing: Send index.html for any request that isn't an API call
  app.get('*', (req, res) => {
    if (req.url.startsWith('/api/')) return res.status(404).json({ error: 'API not found' });
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  console.error(`[AuraGold Server] DIST FOLDER NOT FOUND AT: ${distPath}`);
  app.get('*', (req, res) => res.status(404).send('Production build not found. Please run "npm run build".'));
}

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`[AuraGold Server] Running on port ${PORT}`);
  await initDb();
});
