
import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import compression from 'compression';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- ROBUST ENV LOADING ---
const loadEnv = () => {
    const searchPaths = [
        path.resolve(process.cwd(), '.env'),           
        path.resolve(__dirname, '.env'),               
        path.resolve(__dirname, '..', '.env'),         
        path.resolve(process.cwd(), '.builds/config/.env'),
        path.resolve(__dirname, '.builds/config/.env'),
        '/public_html/.builds/config/.env',            
        path.resolve('/home/public_html/.env'),
        path.resolve(process.cwd(), '../.builds/config/.env')
    ];

    let loaded = false;
    for (const p of searchPaths) {
        if (fs.existsSync(p)) {
            dotenv.config({ path: p });
            loaded = true;
            break;
        }
    }
};
loadEnv();

const app = express();
const PORT = process.env.PORT || 3000;
const META_API_VERSION = "v22.0";

app.set('trust proxy', 1); 
app.use(compression());    
app.use(cors());
app.use(express.json({ limit: '100mb' }));

let pool = null;

// Helper to normalize phone numbers for DB consistency
const normalizePhone = (p) => p ? p.replace(/\D/g, '').slice(-12) : '';

async function initDb() {
    try {
        if (pool) await pool.end();
        const dbConfig = {
            host: process.env.DB_HOST || '127.0.0.1',
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: 3306,
            waitForConnections: true,
            connectionLimit: 10,
            connectTimeout: 20000,
            enableKeepAlive: true
        };
        pool = mysql.createPool(dbConfig);
        const connection = await pool.getConnection();
        const tables = [
            `CREATE TABLE IF NOT EXISTS gold_rates (id INT AUTO_INCREMENT PRIMARY KEY, rate24k DECIMAL(10, 2), rate22k DECIMAL(10, 2), rate18k DECIMAL(10, 2), recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
            `CREATE TABLE IF NOT EXISTS integrations (provider VARCHAR(50) PRIMARY KEY, config JSON, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`,
            `CREATE TABLE IF NOT EXISTS app_config (setting_key VARCHAR(50) PRIMARY KEY, setting_value VARCHAR(255))`,
            `CREATE TABLE IF NOT EXISTS customers (id VARCHAR(100) PRIMARY KEY, contact VARCHAR(50), name VARCHAR(255), data LONGTEXT, updated_at BIGINT)`,
            `CREATE TABLE IF NOT EXISTS orders (id VARCHAR(100) PRIMARY KEY, customer_contact VARCHAR(50), status VARCHAR(50), created_at DATETIME, data LONGTEXT, updated_at BIGINT)`,
            `CREATE TABLE IF NOT EXISTS whatsapp_logs (id VARCHAR(100) PRIMARY KEY, phone VARCHAR(50), direction VARCHAR(20), timestamp DATETIME, data LONGTEXT)`,
            `CREATE TABLE IF NOT EXISTS templates (id VARCHAR(100) PRIMARY KEY, name VARCHAR(255), category VARCHAR(50), data LONGTEXT)`,
            `CREATE TABLE IF NOT EXISTS plan_templates (id VARCHAR(100) PRIMARY KEY, name VARCHAR(255), data LONGTEXT)`,
            `CREATE TABLE IF NOT EXISTS catalog (id VARCHAR(100) PRIMARY KEY, category VARCHAR(100), data LONGTEXT)`
        ];
        for (const sql of tables) await connection.query(sql);
        connection.release();
        return { success: true };
    } catch (err) {
        pool = null; 
        return { success: false, error: err.message };
    }
}
initDb();

const ensureDb = async (req, res, next) => {
    if (!pool) {
        const result = await initDb();
        if (!result.success) return res.status(503).json({ error: "Database Unavailable" });
    }
    next();
};

/**
 * GOLD RATE API (THE BASIC METHOD)
 */
app.get('/api/gold-rate', ensureDb, async (req, res) => {
    try {
        let rate24k = 0;
        let source = 'Local DB';

        // 1. Try to fetch from a basic public API first
        try {
            const externalRes = await fetch('https://api.gold-api.com/price/XAU');
            if (externalRes.ok) {
                const extData = await externalRes.json();
                // Formula: (Price per Ounce / 31.1035) * USD_TO_INR
                const usdToInr = 83.5; 
                const gramUsd = extData.price / 31.1035;
                rate24k = Math.round(gramUsd * usdToInr);
                source = 'Live Market (Global)';
            }
        } catch (e) {
            console.warn("External Gold API failed, using DB");
        }

        const connection = await pool.getConnection();

        // 2. If external failed, get last stored
        if (rate24k === 0) {
            const [rows] = await connection.query('SELECT rate24k FROM gold_rates ORDER BY recorded_at DESC LIMIT 1');
            if (rows.length > 0) {
                rate24k = parseFloat(rows[0].rate24k);
            } else {
                rate24k = 7500; // Hard fallback for first-time run
            }
        }

        // 3. Calculate variants (Basic 91.6% and 75% formulas)
        const rate22k = Math.round(rate24k * 0.916);
        const rate18k = Math.round(rate24k * 0.75);

        // 4. Save to DB for historical tracking
        await connection.query(
            'INSERT INTO gold_rates (rate24k, rate22k, rate18k) VALUES (?, ?, ?)',
            [rate24k, rate22k, rate18k]
        );
        connection.release();

        res.json({
            success: true,
            k24: rate24k,
            k22: rate22k,
            k18: rate18k,
            source
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * WHATSAPP WEBHOOK HANDLERS
 */

app.get('/api/whatsapp/webhook', (req, res) => {
    const verify_token = process.env.WHATSAPP_VERIFY_TOKEN || "auragold_elite_secure_2025";
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === verify_token) {
            return res.status(200).send(challenge);
        } else {
            return res.sendStatus(403);
        }
    }
    res.sendStatus(400);
});

app.post('/api/whatsapp/webhook', ensureDb, async (req, res) => {
    res.status(200).send('EVENT_RECEIVED');
    try {
        const body = req.body;
        if (!body.entry || !body.entry[0].changes) return;

        const change = body.entry[0].changes[0].value;
        const connection = await pool.getConnection();

        if (change.messages && change.messages[0]) {
            const msg = change.messages[0];
            const fromFormatted = normalizePhone(msg.from);
            const msgBody = msg.text?.body || `[Media: ${msg.type}]`;
            const timestamp = new Date(parseInt(msg.timestamp) * 1000).toISOString();
            const contactName = change.contacts?.[0]?.profile?.name || "Customer";

            const logEntry = {
                id: msg.id,
                customerName: contactName,
                phoneNumber: fromFormatted,
                message: msgBody,
                status: 'READ', 
                timestamp,
                direction: 'inbound',
                type: 'INBOUND'
            };

            await connection.query(
                `INSERT INTO whatsapp_logs (id, phone, direction, timestamp, data) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE data=VALUES(data)`,
                [logEntry.id, fromFormatted, 'inbound', new Date(timestamp), JSON.stringify(logEntry)]
            );
        }

        if (change.statuses && change.statuses[0]) {
            const statusUpdate = change.statuses[0];
            const msgId = statusUpdate.id;
            const newStatus = statusUpdate.status.toUpperCase(); 

            const [rows] = await connection.query('SELECT data FROM whatsapp_logs WHERE id = ?', [msgId]);
            if (rows.length > 0) {
                const existingData = JSON.parse(rows[0].data);
                existingData.status = newStatus;
                await connection.query('UPDATE whatsapp_logs SET data = ? WHERE id = ?', [JSON.stringify(existingData), msgId]);
            }
        }
        connection.release();
    } catch (e) { console.error(e); }
});

app.get('/api/whatsapp/logs/poll', ensureDb, async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.query('SELECT data FROM whatsapp_logs ORDER BY timestamp DESC LIMIT 150');
        connection.release();
        const logs = rows.map(r => typeof r.data === 'string' ? JSON.parse(r.data) : r.data);
        res.json({ success: true, logs });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/whatsapp/send', ensureDb, async (req, res) => {
    const { to, message, templateName, language, components, customerName } = req.body;
    const phoneId = req.headers['x-phone-id'];
    const token = req.headers['x-auth-token'];
    const formattedTo = normalizePhone(to);
    
    let payload = { messaging_product: "whatsapp", recipient_type: "individual", to: formattedTo };
    if (templateName) {
        payload.type = "template"; 
        payload.template = { name: templateName, language: { code: language || "en_US" }, components };
    } else { 
        payload.type = "text"; 
        payload.text = { body: message }; 
    }
    
    try {
        const r = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${phoneId}/messages`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await r.json();

        if (r.ok && data.messages && data.messages[0]) {
            const connection = await pool.getConnection();
            const logEntry = {
                id: data.messages[0].id,
                customerName: customerName || "Customer",
                phoneNumber: formattedTo,
                message: templateName ? `[Template: ${templateName}]` : message,
                status: 'SENT',
                timestamp: new Date().toISOString(),
                direction: 'outbound',
                type: templateName ? 'TEMPLATE' : 'CUSTOM'
            };
            await connection.query(
                `INSERT INTO whatsapp_logs (id, phone, direction, timestamp, data) VALUES (?, ?, ?, ?, ?)`,
                [logEntry.id, formattedTo, 'outbound', new Date(logEntry.timestamp), JSON.stringify(logEntry)]
            );
            connection.release();
        }
        res.status(r.status).json({ success: r.ok, data });
    } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('/api/bootstrap', ensureDb, async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [orders] = await connection.query('SELECT data FROM orders ORDER BY created_at DESC');
        const [customers] = await connection.query('SELECT data FROM customers');
        const [logs] = await connection.query('SELECT data FROM whatsapp_logs ORDER BY timestamp DESC LIMIT 500');
        const [templates] = await connection.query('SELECT data FROM templates');
        const [planTemplates] = await connection.query('SELECT data FROM plan_templates');
        const [catalog] = await connection.query('SELECT data FROM catalog');
        const [intRows] = await connection.query('SELECT * FROM integrations');
        const intMap = {}; intRows.forEach(r => { try { intMap[r.provider] = JSON.parse(r.config); } catch(e){} });
        connection.release();
        
        res.json({ success: true, data: {
            orders: orders.map(r => typeof r.data === 'string' ? JSON.parse(r.data) : r.data),
            customers: customers.map(r => typeof r.data === 'string' ? JSON.parse(r.data) : r.data),
            logs: logs.map(r => typeof r.data === 'string' ? JSON.parse(r.data) : r.data),
            templates: templates.map(r => typeof r.data === 'string' ? JSON.parse(r.data) : r.data),
            planTemplates: planTemplates.map(r => typeof r.data === 'string' ? JSON.parse(r.data) : r.data),
            catalog: catalog.map(r => typeof r.data === 'string' ? JSON.parse(r.data) : r.data),
            settings: {
                whatsappPhoneNumberId: intMap['whatsapp']?.phoneId || '',
                whatsappBusinessAccountId: intMap['whatsapp']?.accountId || '',
                whatsappBusinessToken: intMap['whatsapp']?.token || '',
                setuClientId: intMap['setu']?.clientId || '',
                setuSecret: intMap['setu']?.secret || '',
                setuSchemeId: intMap['setu']?.schemeId || ''
            }
        }});
    } catch(e) { res.status(500).json({ error: e.message }); }
});

const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        if (!req.path.startsWith('/api')) res.sendFile(path.join(distPath, 'index.html'));
    });
}

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on ${PORT}`));
