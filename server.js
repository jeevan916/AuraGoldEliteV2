
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

// HARDCODED CREDENTIALS - Hostinger Environment Enforcement
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
  console.log(`[DB ATTEMPT] User: ${config.user}, Host: ${config.host}, DB: ${config.database}`);
  
  try {
    if (pool) {
      console.log("[DB RESET] Ending existing pool...");
      await pool.end().catch((err) => console.error("Error ending pool:", err.message));
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
      connectTimeout: 20000 
    });
    
    const connection = await pool.getConnection();
    console.log(`✅ [DB SUCCESS] Handshake successful for ${config.database}`);
    
    await connection.query(`
      CREATE TABLE IF NOT EXISTS aura_app_state (
        id INT PRIMARY KEY,
        content LONGTEXT NOT NULL,
        last_updated BIGINT NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    
    connection.release();
    return { success: true };
  } catch (err) {
    console.error('❌ [DB FAILURE]:', err.message);
    pool = null;
    return { success: false, error: err.message };
  }
}

initDb().catch(e => console.error("[BOOT ERROR]", e));

const ensureDb = async (req, res, next) => {
    if (!pool) {
        console.log("[DB RECOVERY] Pool was null, attempting re-init...");
        const result = await initDb();
        if (!result.success) {
            return res.status(503).json({ 
                error: "Database Connection Failed", 
                details: "Pool could not be initialized.",
                system_error: result.error
            });
        }
    }
    next();
};

// --- STATIC FILES FIX ---
// Serve static files from the root (where server.js and index.html reside in dist)
// Explicitly set Content-Type for JS files to avoid MIME type strict checking errors
app.use(express.static(__dirname, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

// --- API ROUTES ---

app.get("/api/health", (req, res) => {
  res.json({ 
      status: "active", 
      db_pool_active: !!pool, 
      user_enforced: DB_USER,
      time: new Date().toISOString(),
      process_uptime: process.uptime()
  });
});

app.get('/api/test-db', async (req, res) => {
    try {
        let connection;
        let usedExisting = false;

        if (pool) {
            try {
                connection = await pool.getConnection();
                usedExisting = true;
            } catch (err) {
                console.log("Existing pool failed ping, will re-init. Error:", err.message);
                pool = null;
            }
        }

        if (!pool) {
            const initResult = await initDb();
            if (!initResult.success) {
                throw new Error(`Init failed: ${initResult.error}`);
            }
            connection = await pool.getConnection();
        }
        
        const [rows] = await connection.query('SELECT 1 as result');
        connection.release();
        
        res.json({ 
            status: "success", 
            message: "Database handshake verified.", 
            mode: usedExisting ? "reused_active_pool" : "fresh_connection",
            result: rows[0],
            db: DB_NAME,
            host: DB_HOST
        });
    } catch (e) {
        console.error("[TEST-DB ERROR]", e.message);
        res.status(500).json({ 
            status: "error", 
            message: e.message,
            tip: "Ensure localhost is allowed and user has privileges."
        });
    }
});

app.get("/api/state", ensureDb, async (req, res) => {
  try {
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

app.post("/api/state", ensureDb, async (req, res) => {
  try {
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

app.get('/api/gold-rate', (req, res) => {
  res.json({ k24: 7920, k22: 7260, k18: 5940, timestamp: Date.now() });
});

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

// --- SPA & 404 HANDLING ---

// 1. If a request has an extension (e.g. .js, .css) and wasn't handled by express.static above,
// it is a 404. Do NOT return index.html, because that causes "MIME type text/html" errors for scripts.
app.get('*', (req, res, next) => {
    if (req.path.includes('.') && !req.path.includes('.html')) {
        return res.status(404).send('Not Found'); 
    }
    next();
});

// 2. For everything else (routes like /dashboard, /orders), return index.html
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: "Route Not Found" });
  res.sendFile(path.resolve(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 AuraGold Elite Server Active: Port ${PORT}`);
});
