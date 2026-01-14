
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import cors from 'cors';
import dotenv from 'dotenv';
import https from 'https';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Logging Middleware
app.use((req, res, next) => {
  console.log(`[AuraGold] ${new Date().toISOString()} | ${req.method} ${req.url}`);
  next();
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 1. Enhanced Database Configuration
// Note: Hostinger often requires 127.0.0.1 instead of 'localhost'
const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000 // 10 seconds
};

let pool = null;

const initDb = async () => {
  if (!dbConfig.user || !dbConfig.database) {
    console.error('[AuraGold] CRITICAL: DB Credentials missing in environment variables.');
    return false;
  }

  try {
    pool = mysql.createPool(dbConfig);
    // Test connection immediately
    const conn = await pool.getConnection();
    console.log('[AuraGold] Database Connection Successful');
    
    await conn.query(`
      CREATE TABLE IF NOT EXISTS aura_storage (
        id INT PRIMARY KEY DEFAULT 1,
        data LONGTEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    conn.release();
    return true;
  } catch (err) {
    console.error('[AuraGold] Database Initialization Failed:', err.message);
    return false;
  }
};

// 2. Health & Debug Endpoints
app.get('/api/debug', (req, res) => {
  res.json({
    status: 'Online',
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    dbReady: pool !== null,
    config: {
      host: dbConfig.host,
      user: dbConfig.user ? 'Set' : 'Missing',
      db: dbConfig.database ? 'Set' : 'Missing'
    }
  });
});

app.get('/api/db-check', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ 
      success: false, 
      error: "DB Pool not initialized",
      tip: "Check your Hostinger Environment Variables for DB_USER, DB_NAME, etc."
    });
  }
  
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query('SELECT 1 + 1 AS solution');
    conn.release();
    res.json({ success: true, message: "Database is connected", data: rows[0] });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      error: err.code || "CONNECTION_ERROR", 
      message: err.message 
    });
  }
});

// 3. Application Storage Endpoints
app.get('/api/storage', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database Unavailable' });
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
  if (!pool) return res.status(503).json({ error: 'Database Unavailable' });
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
  try {
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
          res.status(500).json({ success: false, error: 'JSON Parse Error' });
        }
      });
    }).on('error', (err) => {
      res.status(500).json({ success: false, error: err.message });
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Fetch initiation failed' });
  }
});

// 4. Static Files & Routing
// Serve static files from the current directory
app.use(express.static(__dirname));

app.get('*', (req, res) => {
  // If request is for an API that doesn't exist, return 404
  if (req.url.startsWith('/api/')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  // Otherwise serve the index.html (SPA routing)
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, async () => {
  console.log(`[AuraGold] Server running on port ${PORT}`);
  await initDb();
});
