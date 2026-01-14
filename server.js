
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
const PORT = process.env.PORT || 3000;

// Initialize Gemini AI
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' }));

// Database Connection Pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 20,
});

// Initialize Database Table
async function initDB() {
  try {
    const connection = await pool.getConnection();
    await connection.query(`
      CREATE TABLE IF NOT EXISTS aura_storage (
        id INT PRIMARY KEY DEFAULT 1,
        data LONGTEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('AuraGold Express: MySQL Engine Ready');
    connection.release();
  } catch (err) {
    console.error('AuraGold Express: DB Init Error', err.message);
  }
}
initDB();

// --- API ROUTES ---

app.get('/api/storage', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT data FROM aura_storage WHERE id = 1');
    if (rows.length > 0 && rows[0].data) {
      res.json(JSON.parse(rows[0].data));
    } else {
      res.json({ orders: [], logs: [], templates: [], settings: null, lastUpdated: 0 });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch persistent storage', details: err.message });
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
    res.status(500).json({ error: 'Failed to persist data', details: err.message });
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
    res.status(500).json({ success: false, error: 'External Market Feed Unavailable', details: err.message });
  }
});

// Serve Frontend from the 'dist' directory
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// For SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`AuraGold Elite Console active on port ${PORT}`);
});
