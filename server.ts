
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
app.use(express.json({ limit: '50mb' }) as any);

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT || '3306'),
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 10, // Max idle connections
  idleTimeout: 60000, // Idle connections timeout in ms
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
};

const pool = mysql.createPool(dbConfig);

// Initialize Database Table
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
    console.log('✅ AuraGold Backend: Database Pool Initialized');
  } catch (err: any) {
    console.error('❌ AuraGold Backend: Database connection failure:', err.message);
  }
}

initDb();

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
    console.error('State GET Error:', err.message);
    res.status(500).json({ error: `Database Access Error: ${err.message}` });
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
    console.error('State POST Error:', err.message);
    res.status(500).json({ error: `Database Write Failure: ${err.message}` });
  }
});

// Health Check Endpoint
app.get('/api/ping', (req, res) => {
  res.json({ 
    status: 'online', 
    engine: 'Node.js 20',
    platform: process.platform,
    timestamp: Date.now() 
  });
});

// Serve Frontend
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath) as any);

// Fallback for SPA Routing
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server listening on Port ${PORT}`);
});
