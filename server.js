
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

// Load environment variables
const envPaths = [
  path.join(__dirname, '.builds', 'config', '.env'),
  path.join(__dirname, '.env')
];

let envLoaded = false;
for (const p of envPaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    console.log(`[AuraGold] Environment loaded from: ${p}`);
    envLoaded = true;
    break;
  }
}

const app = express();
// Hostinger provides the PORT environment variable
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
  connectTimeout: 10000
};

let pool = null;

const initDb = async () => {
  if (!dbConfig.user || !dbConfig.database) {
    console.warn('[AuraGold] DB Credentials incomplete. Storage API will be restricted.');
    return;
  }
  try {
    pool = mysql.createPool(dbConfig);
    const conn = await pool.getConnection();
    console.log('[AuraGold] DB Connection Verified');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS aura_storage (
        id INT PRIMARY KEY DEFAULT 1,
        data LONGTEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    conn.release();
  } catch (err) {
    console.error('[AuraGold] DB Init Error:', err.message);
  }
};

// API ROUTES
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', db: !!pool, time: new Date().toISOString() });
});

app.get('/api/storage', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'DB not connected' });
  try {
    const [rows] = await pool.query('SELECT data FROM aura_storage WHERE id = 1');
    if (rows.length > 0 && rows[0].data) {
      res.json(JSON.parse(rows[0].data));
    } else {
      res.json({ orders: [], logs: [], templates: [], settings: null, lastUpdated: 0 });
    }
  } catch (err) {
    res.status(500).json({ error: 'Internal Error', message: err.message });
  }
});

app.post('/api/storage', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'DB not connected' });
  try {
    const data = JSON.stringify(req.body);
    await pool.query(
      'INSERT INTO aura_storage (id, data) VALUES (1, ?) ON DUPLICATE KEY UPDATE data = ?',
      [data, data]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Save failed', message: err.message });
  }
});

app.get('/api/rates', async (req, res) => {
  https.get('https://uat.batuk.in/augmont/gold', (apiRes) => {
    let data = '';
    apiRes.on('data', (chunk) => data += chunk);
    apiRes.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        const rate24K = parseFloat(parsed?.data?.[0]?.[0]?.gSell || 0);
        const rate22K = Math.round(rate24K * 0.916);
        res.json({ rate24K, rate22K, success: true });
      } catch (e) {
        res.status(500).json({ error: 'Rate Parse Error' });
      }
    });
  }).on('error', (err) => {
    res.status(500).json({ error: err.message });
  });
});

// Serve Frontend
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  if (req.url.startsWith('/api/')) {
    return res.status(404).json({ error: 'API Endpoint not found' });
  }
  const indexFile = path.join(distPath, 'index.html');
  if (fs.existsSync(indexFile)) {
    res.sendFile(indexFile);
  } else {
    res.status(404).send('Frontend build (dist/) not found. Please run build.');
  }
});

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`[AuraGold] Server running on port ${PORT}`);
  await initDb();
});
