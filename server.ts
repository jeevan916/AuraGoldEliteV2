
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Database Connection
// Hostinger typically provides these as env variables or you set them in the Node.js selector
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || process.env.DB_PASS,
  database: process.env.DB_NAME,
};

const pool = mysql.createPool(dbConfig);

// Initialize Table
async function initDB() {
  try {
    const connection = await pool.getConnection();
    await connection.query(`
      CREATE TABLE IF NOT EXISTS app_storage (
        id INT PRIMARY KEY DEFAULT 1,
        data LONGTEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('AuraGold: Database initialized successfully.');
    connection.release();
  } catch (error) {
    console.error('AuraGold: Database initialization failed:', error);
  }
}

initDB();

// API Endpoints
app.get('/api/storage', async (req, res) => {
  try {
    const [rows]: any = await pool.query('SELECT data FROM app_storage WHERE id = 1');
    if (rows.length > 0 && rows[0].data) {
      res.json(JSON.parse(rows[0].data));
    } else {
      res.json({ orders: [], logs: [], templates: [], settings: null, lastUpdated: 0 });
    }
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch data', details: error.message });
  }
});

app.post('/api/storage', async (req, res) => {
  try {
    const data = JSON.stringify(req.body);
    await pool.query(
      'INSERT INTO app_storage (id, data) VALUES (1, ?) ON DUPLICATE KEY UPDATE data = ?',
      [data, data]
    );
    res.json({ success: true, timestamp: Date.now() });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to save data', details: error.message });
  }
});

// Serve Static Frontend (Production Only)
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  // Check if requesting an API, otherwise serve frontend
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(distPath, 'index.html'));
  } else {
    res.status(404).json({ error: 'API not found' });
  }
});

app.listen(PORT, () => {
  console.log(`AuraGold Elite Express Server running on port ${PORT}`);
});
