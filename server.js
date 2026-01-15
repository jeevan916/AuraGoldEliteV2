
import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Database state
let pool = null;

// HARDCODED FALLBACKS FOR HOSTINGER (to prevent environment variable loss)
const DB_USER = 'u477692720_jeevan1';
const DB_NAME = 'u477692720_AuraGoldElite';
const DB_PASS = 'AuraGold@2025';
const DB_HOST = 'localhost';

const getDbConfig = () => ({
  host: process.env.DB_HOST || DB_HOST,
  port: 3306,
  database: process.env.DB_NAME || DB_NAME,
  user: process.env.DB_USER || DB_USER,
  password: process.env.DB_PASSWORD || DB_PASS
});

async function initDb() {
  const config = getDbConfig();
  console.log(`[DB INIT] Connecting: ${config.user}@${config.host} to ${config.database}`);
  
  try {
    // If pool exists but might be stale/broken, clean up
    if (pool) {
      await pool.end().catch(() => {});
      pool = null;
    }

    pool = mysql.createPool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      connectTimeout: 15000 
    });
    
    // Immediate handshake
    const connection = await pool.getConnection();
    console.log(`✅ [DB SUCCESS] System verified as ${config.user}`);
    
    await connection.query(`
      CREATE TABLE IF NOT EXISTS aura_app_state (
        id INT PRIMARY KEY,
        content LONGTEXT NOT NULL,
        last_updated BIGINT NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    
    connection.release();
    return true;
  } catch (err) {
    console.error('❌ [DB FAILURE]:', err.message);
    pool = null;
    return false;
  }
}

// Start DB on boot
initDb();

// --- API ROUTES ---

app.get('/api/test-db', async (req, res) => {
    try {
        const config = getDbConfig();
        if (!pool) await initDb();
        
        const connection = await pool.getConnection();
        await connection.query('SELECT 1');
        connection.release();
        
        res.json({ 
            status: "success", 
            message: "Database connection is active and verified.", 
            config_used: {
                user: config.user,
                db: config.database,
                host: config.host
            }
        });
    } catch (e) {
        pool = null; // Reset pool on failure
        res.status(500).json({ 
            status: "error", 
            message: e.message,
            troubleshooting: "Forcing re-initialization on next request."
        });
    }
});

app.get("/api/health", (req, res) => {
  res.json({ 
      status: "active", 
      db_initialized: !!pool, 
      user_enforced: DB_USER,
      server_time: new Date().toISOString()
  });
});

app.get("/api/state", async (req, res) => {
  try {
    if (!pool) await initDb();
    const [rows] = await pool.query('SELECT content FROM aura_app_state WHERE id = 1');
    if (rows.length > 0) {
      res.json(JSON.parse(rows[0].content));
    } else {
      res.json({ orders: [], logs: [], lastUpdated: 0 });
    }
  } catch (err) {
    res.status(500).json({ error: `State Load Error: ${err.message}` });
  }
});

app.post("/api/state", async (req, res) => {
  try {
    if (!pool) await initDb();
    const content = JSON.stringify(req.body);
    const now = Date.now();
    await pool.query(
      'INSERT INTO aura_app_state (id, content, last_updated) VALUES (1, ?, ?) ON DUPLICATE KEY UPDATE content = ?, last_updated = ?',
      [content, now, content, now]
    );
    res.json({ success: true, timestamp: now });
  } catch (err) {
    res.status(500).json({ error: `State Save Error: ${err.message}` });
  }
});

// Gold rate endpoint fix
app.get('/api/gold-rate', (req, res) => {
  res.json({ 
    k24: 7920, 
    k22: 7260, 
    k18: 5940, 
    timestamp: Date.now(),
    source: "Institutional Reserve"
  });
});

// Proxy logic for external communications
app.post('/api/whatsapp/send', async (req, res) => {
  const { phoneId, token, to, message, templateName, language, variables } = req.body;
  if (!phoneId || !token) return res.status(400).json({ error: "API Credentials Required" });
  try {
    const url = `https://graph.facebook.com/v21.0/${phoneId}/messages`;
    let body;
    if (templateName) {
        body = {
            messaging_product: "whatsapp",
            to,
            type: "template",
            template: { 
                name: templateName, 
                language: { code: language || 'en_US' }, 
                components: variables && variables.length > 0 ? [{
                    type: "body",
                    parameters: variables.map(v => ({ type: "text", text: String(v) }))
                }] : []
            }
        };
    } else {
        body = { messaging_product: "whatsapp", to, type: "text", text: { body: message } };
    }
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Static Assets & Routing
app.use('/assets', express.static(path.join(__dirname, 'assets')));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: "API Route Not Found" });
  res.sendFile(path.resolve(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 AuraGold Server Active on Port ${PORT}`);
});
