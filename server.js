
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

// 1. Resolve .env from your specific protected path
// Hostinger absolute path typically: /home/u123456789/domains/yourdomain.com/public_html/.builds/config/.env
const envPath = path.join(__dirname, '.builds', 'config', '.env');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(`[AuraGold] Environment loaded from: ${envPath}`);
} else {
  dotenv.config(); // Fallback to root .env
  console.log(`[AuraGold] .env not found at ${envPath}, attempting root fallback.`);
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 2. Database Connection
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
    console.warn('[AuraGold] DB Credentials missing. Storage API will be restricted.');
    return;
  }
  try {
    pool = mysql.createPool(dbConfig);
    const conn = await pool.getConnection();
    console.log('[AuraGold] Database connected successfully');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS aura_storage (
        id INT PRIMARY KEY DEFAULT 1,
        data LONGTEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    conn.release();
  } catch (err) {
    console.error('[AuraGold] Database Connection Failed:', err.message);
  }
};

// 3. API Endpoints (Prefix with /api)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    db: !!pool, 
    envFound: fs.existsSync(envPath),
    time: new Date().toISOString() 
  });
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
    res.status(500).json({ error: 'Fetch failed', message: err.message });
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
        res.status(500).json({ error: 'Rates Parse Error' });
      }
    });
  }).on('error', (err) => {
    res.status(500).json({ error: err.message });
  });
});

// 4. Static Frontend Assets
// The build process puts the frontend in the /dist folder
app.use(express.static(path.join(__dirname, 'dist')));

// 5. Single Page Application (SPA) Fallback
app.get('*', (req, res) => {
  // If it's an API route that wasn't caught, return 404 instead of HTML
  if (req.url.startsWith('/api/')) {
    return res.status(404).json({ error: 'API not found' });
  }
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Start Server
app.listen(PORT, async () => {
  console.log(`[AuraGold] Server running on port ${PORT}`);
  await initDb();
});
