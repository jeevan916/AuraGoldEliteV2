
import express, { Request, Response, NextFunction } from 'express';
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
app.use(express.json({ limit: '50mb' }));

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT || '3306'),
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 10,
  idleTimeout: 60000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
};

let pool: mysql.Pool;
let isDbHealthy = false;

// Initialize Database Pool
async function initDb() {
  try {
    pool = mysql.createPool(dbConfig);
    const connection = await pool.getConnection();
    await connection.query(`
      CREATE TABLE IF NOT EXISTS aura_app_state (
        id INT PRIMARY KEY,
        content LONGTEXT NOT NULL,
        last_updated BIGINT NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    connection.release();
    isDbHealthy = true;
    console.log('✅ AuraGold Backend: Database Pool Initialized');
  } catch (err: any) {
    isDbHealthy = false;
    console.error('❌ AuraGold Backend: Database connection failure:', err.message);
  }
}

initDb();

// Middleware to check DB health
// Properly typed middleware to avoid return type mismatch in Express chain.
const checkDbHealth = (req: Request, res: Response, next: NextFunction): void => {
  if (!isDbHealthy) {
    res.status(503).json({ 
      error: "Database Connectivity Lost", 
      details: "The Node.js server cannot reach the MySQL instance. Check DB_HOST and DB credentials." 
    });
    return;
  }
  next();
};

// API: Get App State
app.get('/api/state', checkDbHealth, async (req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query('SELECT content FROM aura_app_state WHERE id = 1');
    if (rows.length > 0) {
      res.json(JSON.parse(rows[0].content));
    } else {
      res.json({ orders: [], logs: [], lastUpdated: 0 });
    }
  } catch (err: any) {
    res.status(500).json({ error: `Database Access Error: ${err.message}` });
  }
});

// API: Save App State
app.post('/api/state', checkDbHealth, async (req: Request, res: Response) => {
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
    res.status(500).json({ error: `Database Write Failure: ${err.message}` });
  }
});

// API: Live Gold Rate
app.get('/api/gold-rate', async (req: Request, res: Response) => {
  https.get('https://www.goodreturns.in/gold-rates/', (sourceRes) => {
    let data = '';
    sourceRes.on('data', (chunk) => data += chunk);
    sourceRes.on('end', () => {
      try {
        const match = data.match(/24\s*Carat\s*Gold.*?>\s*₹\s*([\d,]+)/i);
        if (match && match[1]) {
          const rate10g = parseFloat(match[1].replace(/,/g, ''));
          const rate24K = Math.round(rate10g / 10);
          const rate22K = Math.round(rate24K * 0.916);
          res.json({ success: true, k24: rate24K, k22: rate22K });
        } else {
          res.status(500).json({ success: false, error: 'Could not parse rates' });
        }
      } catch (e) {
        res.status(500).json({ success: false, error: 'Rate fetch failed' });
      }
    });
  }).on('error', () => res.status(503).json({ success: false, error: 'Market source offline' }));
});

// Serve Static Files (Production)
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// Fallback for SPA routing
// Explicit typing of route handlers ensures correct resolution of Express method overloads.
app.get('*', (req: Request, res: Response) => {
  const indexFile = path.join(distPath, 'index.html');
  res.sendFile(indexFile, (err) => {
    if (err) {
      // If dist/index.html doesn't exist, we might be in development or build failed
      res.status(404).send("AuraGold: Frontend build not found. Please run 'npm run build' if in production.");
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 AuraGold Server active on Port ${PORT}`);
  console.log(`📡 Database status: ${isDbHealthy ? 'Connected' : 'Disconnected'}`);
});
