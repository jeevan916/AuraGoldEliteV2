
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Hostinger often provides the PORT via environment variable
const PORT = process.env.PORT || 3000;

// Initialize Database Pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 1. API ROUTES (Must be defined BEFORE express.static)
app.get('/api/storage', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT data FROM aura_storage WHERE id = 1');
    if (rows.length > 0 && rows[0].data) {
      res.json(JSON.parse(rows[0].data));
    } else {
      res.json({ orders: [], logs: [], templates: [], settings: null, lastUpdated: 0 });
    }
  } catch (err) {
    console.error('Storage Fetch Error:', err);
    res.status(500).json({ error: 'DB Fetch Failed', details: err.message });
  }
});

app.post('/api/storage', async (req, res) => {
  try {
    const data = JSON.stringify(req.body);
    await pool.query(
      'INSERT INTO aura_storage (id, data) VALUES (1, ?) ON DUPLICATE KEY UPDATE data = ?',
      [data, data]
    );
    res.json({ success: true, timestamp: Date.now() });
  } catch (err) {
    console.error('Storage Save Error:', err);
    res.status(500).json({ error: 'DB Save Failed', details: err.message });
  }
});

app.get('/api/rates', async (req, res) => {
  try {
    const response = await fetch('https://uat.batuk.in/augmont/gold');
    const data = await response.json();
    const rate24K = parseFloat(data?.data?.[0]?.[0]?.gSell || 0);
    const rate22K = Math.round(rate24K * 0.916);
    res.json({ rate24K, rate22K, success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Rates Fetch Failed' });
  }
});

// 2. STATIC FILES (Vite Build)
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// 3. SPA FALLBACK (Catch-all)
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Start Server & Init DB
app.listen(PORT, async () => {
  console.log(`>>> AuraGold Node Backend running on port ${PORT}`);
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS aura_storage (
        id INT PRIMARY KEY DEFAULT 1,
        data LONGTEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('>>> MySQL Table Verified');
  } catch (e) {
    console.error('>>> DB Init Failed:', e.message);
  }
});
