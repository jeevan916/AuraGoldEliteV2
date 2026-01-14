
import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Production Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' }) as any);

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT || '3306'),
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
};

const pool = mysql.createPool(dbConfig);

// Initialize Database
async function initDb() {
  try {
    const connection = await pool.getConnection();
    await connection.query(`
      CREATE TABLE IF NOT EXISTS aura_app_state (
        id INT PRIMARY KEY,
        content LONGTEXT NOT NULL,
        last_updated BIGINT NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    connection.release();
    console.log('✅ AuraGold: Production Database Link Established');
  } catch (err: any) {
    console.error('❌ AuraGold: Database connection failed. Verify .env settings:', err.message);
  }
}

initDb();

// Helper: Fetch Gold Rate on Backend
async function fetchGoldRateFromSource(): Promise<{k24: number, k22: number} | null> {
  return new Promise((resolve) => {
    https.get('https://www.goodreturns.in/gold-rates/', (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const match = data.match(/24\s*Carat\s*Gold.*?>\s*₹\s*([\d,]+)/i);
          if (match && match[1]) {
            const rate10g = parseFloat(match[1].replace(/,/g, ''));
            const rate24K = Math.round(rate10g / 10);
            const rate22K = Math.round(rate24K * 0.916);
            resolve({ k24: rate24K, k22: rate22K });
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

// API: Get App State
app.get('/api/state', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const [rows]: any = await pool.query('SELECT content FROM aura_app_state WHERE id = 1');
    if (rows.length > 0) {
      res.json(JSON.parse(rows[0].content));
    } else {
      res.json({ orders: [], logs: [], lastUpdated: 0 });
    }
  } catch (err: any) {
    console.error('API Error (State GET):', err.message);
    res.status(500).json({ error: `Database access failure: ${err.message}` });
  }
});

// API: Save App State
app.post('/api/state', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const content = JSON.stringify(req.body);
    const lastUpdated = Date.now();
    await pool.query(`
      INSERT INTO aura_app_state (id, content, last_updated) 
      VALUES (1, ?, ?) 
      ON DUPLICATE KEY UPDATE content = VALUES(content), last_updated = VALUES(last_updated)
    `, [content, lastUpdated]);
    res.json({ success: true, timestamp: lastUpdated });
  } catch (err: any) {
    console.error('API Error (State POST):', err.message);
    res.status(500).json({ error: `Persistence failed: ${err.message}` });
  }
});

// API: Live Gold Rate
app.get('/api/gold-rate', async (req, res) => {
  const rates = await fetchGoldRateFromSource();
  if (rates) {
    res.json({ success: true, ...rates });
  } else {
    res.status(503).json({ success: false, error: 'Market source offline' });
  }
});

// Health Check
app.get('/api/ping', (req, res) => {
  res.json({ 
    status: 'pong', 
    timestamp: Date.now(),
    engine: {
      node: process.version,
      platform: process.platform
    }
  });
});

// Serve built frontend files
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath) as any);

// SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Production Server Ready on Port ${PORT}`);
});
