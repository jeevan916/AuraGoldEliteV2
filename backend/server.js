import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

let pool;

async function initDb() {
  try {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    
    const connection = await pool.getConnection();
    console.log('✅ AuraGold Backend: Database Connected');
    
    await connection.query(`
      CREATE TABLE IF NOT EXISTS aura_app_state (
        id INT PRIMARY KEY,
        content LONGTEXT NOT NULL,
        last_updated BIGINT NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    connection.release();
  } catch (err) {
    console.error('❌ AuraGold Backend: Database failure:', err.message);
  }
}

initDb();

app.get("/", (req, res) => res.send("AuraGold API Active"));

app.get("/api/state", async (req, res) => {
  try {
    if (!pool) return res.status(503).json({ error: "DB not ready" });
    const [rows] = await pool.query('SELECT content FROM aura_app_state WHERE id = 1');
    if (rows.length > 0) {
      res.json(JSON.parse(rows[0].content));
    } else {
      res.json({ orders: [], logs: [], lastUpdated: 0 });
    }
  } catch (err) {
    res.status(500).json({ error: "Load failed" });
  }
});

app.post("/api/state", async (req, res) => {
  try {
    if (!pool) return res.status(503).json({ error: "DB not ready" });
    const content = JSON.stringify(req.body);
    const now = Date.now();
    await pool.query(
      'INSERT INTO aura_app_state (id, content, last_updated) VALUES (1, ?, ?) ON DUPLICATE KEY UPDATE content = ?, last_updated = ?',
      [content, now, content, now]
    );
    res.json({ success: true, timestamp: now });
  } catch (err) {
    res.status(500).json({ error: "Save failed" });
  }
});

app.get('/api/gold-rate', (req, res) => {
  res.json({ k24: 7850, k22: 7180, k18: 5880, timestamp: Date.now() });
});

app.listen(PORT, () => console.log(`🚀 Server on port: ${PORT}`));