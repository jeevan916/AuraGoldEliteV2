
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

// Production Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' }) as any);

// Database configuration from .env
const dbConfig = {
  host: process.env.DB_HOST,
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

// Initialize Tables
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
    console.log('✅ Production Database Connection Established');
  } catch (err) {
    console.error('❌ Database connection failed. Check your .env credentials:', err);
    process.exit(1);
  }
}

initDb();

// API: Fetch Application State (Orders, Settings, Logs)
app.get('/api/state', async (req, res) => {
  try {
    const [rows]: any = await pool.query('SELECT content FROM aura_app_state WHERE id = 1');
    if (rows.length > 0) {
      res.json(JSON.parse(rows[0].content));
    } else {
      // Return empty structure only if brand new
      res.json({ orders: [], lastUpdated: 0 });
    }
  } catch (err: any) {
    console.error('API Error (GET /state):', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// API: Save Application State
app.post('/api/state', async (req, res) => {
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
    console.error('API Error (POST /state):', err.message);
    res.status(500).json({ error: 'Failed to synchronize data' });
  }
});

// Health check for monitoring
app.get('/api/status', (req, res) => {
  res.json({ status: 'online', version: '5.0.0-PROD' });
});

// Serve Frontend
app.use(express.static(path.join(__dirname, 'dist')) as any);
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 AuraGold Server active on port ${PORT}`);
});
