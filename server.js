
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
let pool;

async function initDb() {
  console.log(`[${new Date().toISOString()}] Initializing AuraGold Management Backend...`);
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
    
    const connection = await pool.getConnection();
    console.log('✅ Database connected successfully');
    
    await connection.query(`
      CREATE TABLE IF NOT EXISTS aura_app_state (
        id INT PRIMARY KEY,
        content LONGTEXT NOT NULL,
        last_updated BIGINT NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    
    connection.release();
  } catch (err) {
    console.error('❌ Database initialization error:', err.message);
  }
}

initDb();

// --- PROXY API ROUTES (Fixes CORS Issues) ---

// WhatsApp Proxy
app.post('/api/whatsapp/send', async (req, res) => {
  const { phoneId, token, to, message, templateName, language, variables } = req.body;
  
  if (!phoneId || !token) return res.status(400).json({ error: "Missing Credentials" });

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
        body = {
            messaging_product: "whatsapp",
            to,
            type: "text",
            text: { body: message }
        };
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
    console.error("WhatsApp Proxy Error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Msg91 Proxy
app.post('/api/sms/send', async (req, res) => {
  const { authKey, senderId, to, message, templateId } = req.body;
  
  if (!authKey) return res.status(400).json({ error: "Missing Auth Key" });

  try {
    // Basic Flow/Template API for Msg91
    const url = 'https://control.msg91.com/api/v5/flow/';
    const body = {
        template_id: templateId || 'your_default_template_id', 
        sender: senderId || 'AURGLD',
        short_url: "0",
        mobiles: to,
        // Assuming template variables mapping, usually passed as 'var1', 'var2' etc in real implementation
        // For simple text fallback if flow not used (legacy API):
        // url = `https://api.msg91.com/api/sendhttp.php?authkey=${authKey}&mobiles=${to}&message=${encodeURIComponent(message)}...`
        // Using Flow API format (modern):
        recipients: [
            {
                mobiles: to,
                message: message // If using message variable in flow
            }
        ]
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'authkey': authKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    const data = await response.json();
    res.json({ success: true, data });
  } catch (error) {
    console.error("SMS Proxy Error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// App State Routes
app.get("/api/state", async (req, res) => {
  try {
    if (!pool) return res.status(503).json({ error: "DB not initialized" });
    const [rows] = await pool.query('SELECT content FROM aura_app_state WHERE id = 1');
    if (rows.length > 0) {
      res.json(JSON.parse(rows[0].content));
    } else {
      res.json({ orders: [], logs: [], lastUpdated: 0 });
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to load state" });
  }
});

app.post("/api/state", async (req, res) => {
  try {
    if (!pool) return res.status(503).json({ error: "DB not initialized" });
    const content = JSON.stringify(req.body);
    const now = Date.now();
    await pool.query(
      'INSERT INTO aura_app_state (id, content, last_updated) VALUES (1, ?, ?) ON DUPLICATE KEY UPDATE content = ?, last_updated = ?',
      [content, now, content, now]
    );
    res.json({ success: true, timestamp: now });
  } catch (err) {
    res.status(500).json({ error: "Failed to save state" });
  }
});

app.get('/api/gold-rate', (req, res) => {
  res.json({ k24: 7920, k22: 7260, k18: 5940, timestamp: Date.now() });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "active", db: pool ? "ready" : "not_initialized", port: PORT });
});

// --- STATIC ASSETS (SECURE) ---
// Only serve assets folder and index.html to prevent exposing server.js code
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// SPA Fallback
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: "API endpoint not found" });
  }
  res.sendFile(path.resolve(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 AuraGold Elite Server running at port ${PORT}`);
});
