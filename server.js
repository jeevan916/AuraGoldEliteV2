
import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

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
    
    // Test connection
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
    return true;
  } catch (err) {
    console.error('❌ Database initialization error:', err.message);
    return false;
  }
}

initDb();

// --- SYSTEM ROUTES ---

// REPLACEMENT FOR test_db.php
app.get('/api/test-db', async (req, res) => {
    try {
        if (!pool) {
            const initialized = await initDb();
            if (!initialized) throw new Error("Database pool failed to initialize. Check server logs.");
        }
        const connection = await pool.getConnection();
        await connection.ping();
        connection.release();
        res.json({ status: "success", message: "Database Connected Successfully", timestamp: new Date() });
    } catch (e) {
        res.status(500).json({ status: "error", message: e.message });
    }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "active", db: pool ? "ready" : "not_initialized", port: PORT });
});

// --- PAYMENT GATEWAY ROUTES ---

// Create Razorpay Order
app.post('/api/razorpay/create-order', async (req, res) => {
    const { amount, currency = "INR", receipt } = req.body;
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
        return res.status(500).json({ error: "Razorpay credentials not configured on server" });
    }

    try {
        const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
        const response = await fetch('https://api.razorpay.com/v1/orders', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                amount: amount * 100, // Amount in paise
                currency,
                receipt,
                payment_capture: 1
            })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.description);
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Webhook for Auto-Recording Payments (Razorpay/Setu)
app.post('/api/webhooks/payment', async (req, res) => {
    // NOTE: This updates the main JSON blob. In a high-traffic app, 
    // you would use a separate 'payments' table to avoid race conditions.
    const event = req.body;
    
    try {
        // 1. Fetch current state
        const [rows] = await pool.query('SELECT content FROM aura_app_state WHERE id = 1');
        if (rows.length === 0) return res.status(200).send("OK"); // No state to update
        
        let state = JSON.parse(rows[0].content);
        let updated = false;

        // 2. Logic to find order and update payment
        // (Simplified for Razorpay payment.captured event)
        if (event.event === 'payment.captured') {
            const payment = event.payload.payment.entity;
            const orderId = payment.notes?.orderId; // Assuming passed in notes
            
            if (orderId) {
                const orderIndex = state.orders.findIndex(o => o.id === orderId);
                if (orderIndex > -1) {
                    const newPayment = {
                        id: `PAY-RZP-${payment.id}`,
                        date: new Date().toISOString(),
                        amount: payment.amount / 100,
                        method: 'RAZORPAY',
                        note: `Auto-recorded via Webhook (ID: ${payment.id})`
                    };
                    state.orders[orderIndex].payments.push(newPayment);
                    updated = true;
                }
            }
        }

        // 3. Save back if updated
        if (updated) {
            const content = JSON.stringify(state);
            const now = Date.now();
            await pool.query(
                'UPDATE aura_app_state SET content = ?, last_updated = ? WHERE id = 1',
                [content, now]
            );
            console.log("✅ Auto-recorded payment via webhook");
        }
        
        res.json({ status: "received" });
    } catch (e) {
        console.error("Webhook Error:", e);
        res.status(500).json({ error: "Webhook processing failed" });
    }
});


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
    const url = 'https://control.msg91.com/api/v5/flow/';
    // Check if using Flow or legacy API based on parameters. This is a generic implementation.
    // For simplicity, we use the message payload structure commonly used.
    
    const body = {
        template_id: templateId || 'your_default_template_id', 
        sender: senderId || 'AURGLD',
        short_url: "0",
        mobiles: to,
        recipients: [{ mobiles: to, message: message }]
    };
    
    // Fallback to simple send API if no templateId provided (Legacy Msg91)
    if (!templateId) {
        // NOTE: In production, use the exact API endpoint required by your Msg91 plan
        // This is a placeholder for the Flow API.
    }

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
    console.error("DB State Load Error:", err);
    // Auto-fix attempt: if table is missing, try creating it
    if (err.code === 'ER_NO_SUCH_TABLE') {
        try {
             await initDb();
             res.json({ orders: [], logs: [], lastUpdated: 0 }); // Return empty valid state
             return;
        } catch (recErr) {
             console.error("Recovery failed:", recErr);
        }
    }
    res.status(500).json({ error: `Failed to load state: ${err.message}` });
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
    res.status(500).json({ error: `Failed to save state: ${err.message}` });
  }
});

app.get('/api/gold-rate', (req, res) => {
  res.json({ k24: 7920, k22: 7260, k18: 5940, timestamp: Date.now() });
});

// --- STATIC ASSETS ---
app.use('/assets', express.static(path.join(__dirname, 'assets')));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: "API endpoint not found" });
  }
  res.sendFile(path.resolve(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 AuraGold Elite Server running at port ${PORT}`);
});
