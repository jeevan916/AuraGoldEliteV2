
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
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve static files from the 'dist' directory (frontend build)
// This is critical for Hostinger if you want the backend to serve the UI
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

let pool;

async function initDb() {
  console.log('--- AuraGold Backend Initialization ---');
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Port: ${PORT}`);
  console.log(`DB Host: ${process.env.DB_HOST || 'localhost'}`);

  try {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    });
    
    // Verify connection immediately
    const connection = await pool.getConnection();
    console.log('✅ Database Connection: SUCCESS');
    
    await connection.query(`
      CREATE TABLE IF NOT EXISTS aura_app_state (
        id INT PRIMARY KEY,
        content LONGTEXT NOT NULL,
        last_updated BIGINT NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Tables Verified');
    connection.release();
  } catch (err) {
    console.error('❌ Database Connection: FAILED');
    console.error(`Error Details: ${err.message}`);
    // We don't exit the process so the health check route still works
  }
}

initDb();

// API ROUTES
app.get("/api/health", (req, res) => {
  res.json({
    status: "online",
    database: pool ? "connected" : "disconnected",
    timestamp: Date.now(),
    uptime: process.uptime()
  });
});

app.get("/api/state", async (req, res) => {
  try {
    if (!pool) return res.status(503).json({ error: "Database not initialized" });
    const [rows] = await pool.query('SELECT content FROM aura_app_state WHERE id = 1');
    if (rows.length > 0) {
      res.json(JSON.parse(rows[0].content));
    } else {
      res.json({ orders: [], logs: [], lastUpdated: 0 });
    }
  } catch (err) {
    console.error('API Error (Get State):', err.message);
    res.status(500).json({ error: "Failed to load state from database" });
  }
});

app.post("/api/state", async (req, res) => {
  try {
    if (!pool) return res.status(503).json({ error: "Database not initialized" });
    const content = JSON.stringify(req.body);
    const now = Date.now();
    await pool.query(
      'INSERT INTO aura_app_state (id, content, last_updated) VALUES (1, ?, ?) ON DUPLICATE KEY UPDATE content = ?, last_updated = ?',
      [content, now, content, now]
    );
    res.json({ success: true, timestamp: now });
  } catch (err) {
    console.error('API Error (Save State):', err.message);
    res.status(500).json({ error: "Failed to save state to database" });
  }
});

app.get('/api/gold-rate', (req, res) => {
  res.json({ 
    k24: 7850, 
    k22: 7180, 
    k18: 5880, 
    timestamp: Date.now() 
  });
});

// Fallback to index.html for SPA routing (must be last)
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 AuraGold Server listening on port: ${PORT}`);
  console.log(`Check health at: http://localhost:${PORT}/api/health`);
});
