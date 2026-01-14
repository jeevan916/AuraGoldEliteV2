
import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Hostinger Node selector injection often uses process.env.PORT
const PORT = process.env.PORT || 3000;

app.use(cors());
// Increased limit for jewelry image data in state sync
app.use(express.json({ limit: '50mb' }));

// Static file serving: Assuming dist is in the root and server.js is in backend/
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

let pool;

async function initDb() {
  console.log(`[${new Date().toISOString()}] Initializing AuraGold Backend...`);

  try {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true
    });
    
    const connection = await pool.getConnection();
    console.log('✅ Database Connection Verified');
    
    await connection.query(`
      CREATE TABLE IF NOT EXISTS aura_app_state (
        id INT PRIMARY KEY,
        content LONGTEXT NOT NULL,
        last_updated BIGINT NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    connection.release();
  } catch (err) {
    console.error('❌ Database Initialization Failed:', err.message);
  }
}

initDb();

// API Health Check
app.get("/api/health", (req, res) => {
  res.json({
    status: "online",
    db: pool ? "connected" : "disconnected",
    timestamp: Date.now()
  });
});

// App State Management
app.get("/api/state", async (req, res) => {
  try {
    if (!pool) return res.status(503).json({ error: "DB Unavailable" });
    const [rows] = await pool.query('SELECT content FROM aura_app_state WHERE id = 1');
    if (rows.length > 0) {
      res.json(JSON.parse(rows[0].content));
    } else {
      res.json({ orders: [], logs: [], lastUpdated: 0 });
    }
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/api/state", async (req, res) => {
  try {
    if (!pool) return res.status(503).json({ error: "DB Unavailable" });
    const content = JSON.stringify(req.body);
    const now = Date.now();
    await pool.query(
      'INSERT INTO aura_app_state (id, content, last_updated) VALUES (1, ?, ?) ON DUPLICATE KEY UPDATE content = ?, last_updated = ?',
      [content, now, content, now]
    );
    res.json({ success: true, timestamp: now });
  } catch (err) {
    res.status(500).json({ error: "Failed to persist state" });
  }
});

// Live Gold Rates
app.get('/api/gold-rate', (req, res) => {
  // Logic to fetch from external or manual source could go here
  res.json({ 
    k24: 7850, 
    k22: 7180, 
    k18: 5880, 
    timestamp: Date.now() 
  });
});

// SPA Fallback: Serve index.html for any unknown routes
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 AuraGold Server active on port ${PORT}`);
});
