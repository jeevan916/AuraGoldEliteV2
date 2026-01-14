
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

// Ensure .env is loaded
const envPaths = [path.join(__dirname, '.env'), path.join(__dirname, '..', '.env')];
for (const p of envPaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}

const app = express();
const PORT = process.env.PORT || 3000;
const LOCAL_DB_PATH = path.join(__dirname, 'local_db.json');

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Database Configuration
const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 5000 // Fast failover to local file
};

let pool = null;
let serverMode = 'local_fs'; // 'mysql' | 'local_fs'

// Initialize Database or Fallback
const initSystem = async () => {
  console.log('🔄 [Server] Initializing Storage Engine...');
  
  // 1. Try MySQL if credentials exist
  if (dbConfig.user && dbConfig.database) {
    try {
      pool = mysql.createPool(dbConfig);
      const conn = await pool.getConnection();
      console.log('✅ [Server] Connected to MySQL Database (Enterprise Mode)');
      
      // Init Table
      await conn.query(`
        CREATE TABLE IF NOT EXISTS aura_storage (
          id INT PRIMARY KEY DEFAULT 1,
          data LONGTEXT,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
      conn.release();
      serverMode = 'mysql';
      return;
    } catch (err) {
      console.warn(`⚠️ [Server] MySQL Connection Failed: ${err.message}`);
      console.warn('🔄 [Server] Switching to Local File System Mode (Fallback)');
    }
  } else {
    console.log('ℹ️ [Server] No MySQL credentials found. Using Local File System Mode.');
  }

  // 2. Fallback: Check/Create Local File
  if (!fs.existsSync(LOCAL_DB_PATH)) {
    try {
      fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify({ orders: [], lastUpdated: Date.now() }));
      console.log('✅ [Server] Created local_db.json for storage');
    } catch(e) {
      console.error('❌ [Server] Failed to create local DB file:', e.message);
    }
  }
  serverMode = 'local_fs';
};

// --- Endpoints (Aliased to handle both /api/storage and /api/storage.php) ---

// Health Check
app.get(['/api/health', '/api/health.php'], (req, res) => {
  res.json({ 
    status: 'ok', 
    mode: serverMode, 
    timestamp: new Date().toISOString() 
  });
});

// Get Data
app.get(['/api/storage', '/api/storage.php'], async (req, res) => {
  try {
    if (serverMode === 'mysql' && pool) {
      const [rows] = await pool.query('SELECT data FROM aura_storage WHERE id = 1');
      const data = rows[0] ? JSON.parse(rows[0].data) : { orders: [], lastUpdated: 0 };
      return res.json(data);
    } else {
      // Local FS
      if (fs.existsSync(LOCAL_DB_PATH)) {
        const raw = fs.readFileSync(LOCAL_DB_PATH, 'utf8');
        return res.json(JSON.parse(raw));
      }
      return res.json({ orders: [], lastUpdated: 0 });
    }
  } catch (err) {
    console.error('Read Error:', err);
    res.status(500).json({ error: 'Storage read failed', details: err.message });
  }
});

// Save Data
app.post(['/api/storage', '/api/storage.php'], async (req, res) => {
  try {
    const dataStr = JSON.stringify(req.body);
    
    if (serverMode === 'mysql' && pool) {
      await pool.query('INSERT INTO aura_storage (id, data) VALUES (1, ?) ON DUPLICATE KEY UPDATE data = ?', [dataStr, dataStr]);
    } else {
      // Local FS
      fs.writeFileSync(LOCAL_DB_PATH, dataStr);
    }
    
    res.json({ success: true, mode: serverMode });
  } catch (err) {
    console.error('Write Error:', err);
    res.status(500).json({ error: 'Storage write failed', details: err.message });
  }
});

// Gold Rates Proxy
app.get(['/api/rates', '/api/rates.php'], (req, res) => {
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

// Static Files
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (req.url.startsWith('/api/')) return res.status(404).json({ error: 'API route not found' });
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Start
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 [Server] Running on http://localhost:${PORT}`);
  await initSystem();
});
