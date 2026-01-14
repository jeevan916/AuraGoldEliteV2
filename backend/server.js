import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Database configuration from environment variables
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

let pool;

async function initDb() {
  try {
    pool = mysql.createPool({
      ...dbConfig,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    });
    
    // Verify connection
    const connection = await pool.getConnection();
    console.log('✅ AuraGold Backend: Database Connected');
    
    // Initialize required tables
    await connection.query(`
      CREATE TABLE IF NOT EXISTS aura_app_state (
        id INT PRIMARY KEY,
        content LONGTEXT NOT NULL,
        last_updated BIGINT NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    
    connection.release();
  } catch (err) {
    console.error('❌ AuraGold Backend: Database connection failure:', err.message);
  }
}

initDb();

/* Health check */
app.get("/", (req, res) => {
  res.send("AuraGold Node app is running");
});

/* REQUIRED: Get State */
app.get("/api/state", async (req, res) => {
  try {
    if (!pool) return res.status(503).json({ error: "DB Pool not initialized" });
    const [rows] = await pool.query('SELECT content FROM aura_app_state WHERE id = 1');
    if (rows.length > 0) {
      res.json(JSON.parse(rows[0].content));
    } else {
      res.json({ orders: [], logs: [], lastUpdated: 0 });
    }
  } catch (err) {
    console.error('State Load Error:', err.message);
    res.status(500).json({ error: "Failed to load state from database" });
  }
});

/* REQUIRED: Save State */
app.post("/api/state", async (req, res) => {
  try {
    if (!pool) return res.status(503).json({ error: "DB Pool not initialized" });
    const content = JSON.stringify(req.body);
    const now = Date.now();
    
    await pool.query(
      'INSERT INTO aura_app_state (id, content, last_updated) VALUES (1, ?, ?) ON DUPLICATE KEY UPDATE content = ?, last_updated = ?',
      [content, now, content, now]
    );
    
    res.json({ success: true, ok: true, timestamp: now });
  } catch (err) {
    console.error('State Save Error:', err.message);
    res.status(500).json({ error: "Failed to persist state to database" });
  }
});

/* Gold Rate endpoint (Simulation for Demo) */
app.get('/api/gold-rate', (req, res) => {
  res.json({
    k24: 7850,
    k22: 7180,
    k18: 5880,
    timestamp: Date.now()
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server listening on port: ${PORT}`);
});