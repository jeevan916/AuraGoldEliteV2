
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import cors from 'cors';
import dotenv from 'dotenv';
import https from 'https';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const envPaths = [
  path.join(__dirname, '.env'),
  path.join(__dirname, '..', '.env')
];

for (const p of envPaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    console.log(`[AuraGold Server] Environment loaded from: ${p}`);
    break;
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Database Connection
const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 15000
};

let pool = null;
const LOCAL_DB_FILE = path.join(__dirname, 'local_db.json');

const initDb = async () => {
  if (!dbConfig.user || !dbConfig.database) {
    console.warn('[AuraGold Server] MySQL configuration incomplete. Using local file system for storage.');
    return;
  }
  try {
    pool = mysql.createPool(dbConfig);
    const conn = await pool.getConnection();
    console.log('[AuraGold Server] MySQL Pool Initialized');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS aura_storage (
        id INT PRIMARY KEY DEFAULT 1,
        data LONGTEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    conn.release();
  } catch (err) {
    console.error('[AuraGold Server] Database Connection Failed (Using local file fallback):', err.message);
  }
};

// Helper: Local File Storage Fallback
const getLocalData = () => {
    if (fs.existsSync(LOCAL_DB_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(LOCAL_DB_FILE, 'utf8'));
        } catch (e) {
            console.error('Failed to read local DB', e);
        }
    }
    return { orders: [], logs: [], templates: [], settings: {}, lastUpdated: 0 };
};

const saveLocalData = (data) => {
    try {
        fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Failed to save local DB', e);
    }
};

// API Endpoints
app.get('/api/health', (req, res) => res.json({ status: 'ok', mode: pool ? 'mysql' : 'local_fs', timestamp: new Date().toISOString() }));

app.get('/api/storage', async (req, res) => {
  try {
    if (pool) {
        const [rows] = await pool.query('SELECT data FROM aura_storage WHERE id = 1');
        res.json(rows[0] ? JSON.parse(rows[0].data) : { orders: [], lastUpdated: 0 });
    } else {
        // Fallback to local file
        res.json(getLocalData());
    }
  } catch (err) { 
      res.status(500).json({ error: err.message }); 
  }
});

app.post('/api/storage', async (req, res) => {
  try {
    const data = JSON.stringify(req.body);
    if (pool) {
        await pool.query('INSERT INTO aura_storage (id, data) VALUES (1, ?) ON DUPLICATE KEY UPDATE data = ?', [data, data]);
    } else {
        // Fallback to local file
        saveLocalData(req.body);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/rates', (req, res) => {
  https.get('https://uat.batuk.in/augmont/gold', (apiRes) => {
    let data = '';
    apiRes.on('data', d => data += d);
    apiRes.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        const rate24K = parseFloat(parsed?.data?.[0]?.[0]?.gSell || 0);
        res.json({ rate24K, rate22K: Math.round(rate24K * 0.916), success: true });
      } catch (e) { res.status(500).json({ error: 'Failed to parse market rates' }); }
    });
  }).on('error', e => res.status(500).json({ error: 'Market rate service unreachable' }));
});

// Serving the compiled build folder
const distPath = path.join(__dirname, 'dist');

if (fs.existsSync(distPath)) {
  console.log(`[AuraGold Server] Serving build from: ${distPath}`);
  app.use(express.static(distPath));
  
  // SPA Fallback: serve index.html for unknown routes
  app.get('*', (req, res) => {
    if (req.url.startsWith('/api/')) return res.status(404).json({ error: 'API route not found' });
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  console.error(`[AuraGold Server] WARNING: 'dist' folder not found. Please run 'npm run build' before starting the server.`);
  app.get('/', (req, res) => {
      res.send('<h1>AuraGold Server Active</h1><p>Frontend build not found. Please run <code>npm run build</code> to generate the UI.</p>');
  });
}

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`[AuraGold Server] Live on port ${PORT}`);
  await initDb();
});
