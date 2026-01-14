
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Essential Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 1. Logger Middleware (Check your Node.js logs on Hostinger to see requests)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Database Connection Pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

// 2. Health Check (Test this first: yourdomain.com/api/health)
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'AuraGold Server is running', timestamp: Date.now() });
});

// API ROUTE: GET Storage
app.get('/api/storage', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT data FROM aura_storage WHERE id = 1');
    if (rows.length > 0 && rows[0].data) {
      res.json(JSON.parse(rows[0].data));
    } else {
      res.json({ orders: [], logs: [], templates: [], settings: null, lastUpdated: 0 });
    }
  } catch (err) {
    console.error('[API] GET Storage Error:', err);
    res.status(500).json({ error: 'Database fetch failed', details: err.message });
  }
});

// API ROUTE: POST Storage
app.post('/api/storage', async (req, res) => {
  try {
    const data = JSON.stringify(req.body);
    await pool.query(
      'INSERT INTO aura_storage (id, data) VALUES (1, ?) ON DUPLICATE KEY UPDATE data = ?',
      [data, data]
    );
    res.json({ success: true, timestamp: Date.now() });
  } catch (err) {
    console.error('[API] POST Storage Error:', err);
    res.status(500).json({ error: 'Database save failed', details: err.message });
  }
});

// API ROUTE: Live Rates Proxy
app.get('/api/rates', async (req, res) => {
  try {
    const response = await fetch('https://uat.batuk.in/augmont/gold');
    if (!response.ok) throw new Error(`External API status ${response.status}`);
    const data = await response.json();
    const rate24K = parseFloat(data?.data?.[0]?.[0]?.gSell || 0);
    const rate22K = Math.round(rate24K * 0.916);
    res.json({ rate24K, rate22K, success: true });
  } catch (err) {
    console.error('[API] Rates Error:', err);
    res.status(500).json({ success: false, error: 'External rates unavailable', details: err.message });
  }
});

// Serve static assets
app.use(express.static(__dirname));

// Single Page Application (SPA) Support
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, async () => {
  console.log(`[AuraGold] Server active on port ${PORT}`);
  try {
    // Ensure table structure exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS aura_storage (
        id INT PRIMARY KEY DEFAULT 1,
        data LONGTEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('[AuraGold] MySQL Schema Validated');
  } catch (err) {
    console.error('[AuraGold] Database Initialization Failed:', err.message);
  }
});
