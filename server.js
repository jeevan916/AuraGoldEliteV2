
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
 * WHATSAPP WEBHOOK HANDLERS
 */

app.get('/api/whatsapp/webhook', (req, res) => {
    const verify_token = process.env.WHATSAPP_VERIFY_TOKEN || "auragold_elite_secure_2025";
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === verify_token) {
            console.log(`[Webhook] Verification Successful for version ${META_API_VERSION}`);
            return res.status(200).send(challenge);
        } else {
            console.error("[Webhook] Verification Failed: Token Mismatch");
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

        // INCOMING CUSTOMER MESSAGE (RECEIVE LIVE)
        if (change.messages && change.messages[0]) {
            const msg = change.messages[0];
            const from = msg.from; 
            const msgBody = msg.text?.body || `[Non-text message: ${msg.type}]`;
            const timestamp = new Date(parseInt(msg.timestamp) * 1000).toISOString();
            const contactName = change.contacts?.[0]?.profile?.name || "Customer";

            const logEntry = {
                id: msg.id,
                customerName: contactName,
                phoneNumber: from,
                message: msgBody,
                status: 'READ', // Mark as read by receiver implicitly
                timestamp,
                direction: 'inbound',
                type: 'INBOUND'
            };

            await connection.query(
                `INSERT INTO whatsapp_logs (id, phone, direction, timestamp, data) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE data=VALUES(data)`,
                [logEntry.id, from, 'inbound', new Date(timestamp), JSON.stringify(logEntry)]
            );
            console.log(`[Webhook] Live Inbound Stored: ${from}`);
        }

        // STATUS UPDATE
        if (change.statuses && change.statuses[0]) {
            const statusUpdate = change.statuses[0];
            const msgId = statusUpdate.id;
            const newStatus = statusUpdate.status.toUpperCase(); 

            const [rows] = await connection.query('SELECT data FROM whatsapp_logs WHERE id = ?', [msgId]);
            if (rows.length > 0) {
                const existingData = JSON.parse(rows[0].data);
                existingData.status = newStatus;
                await connection.query(
                    'UPDATE whatsapp_logs SET data = ? WHERE id = ?',
                    [JSON.stringify(existingData), msgId]
                );
            }
        }

        connection.release();
    } catch (e) {
        console.error("[Webhook Error]:", e.message);
    }
});

/**
 * AJAX POLLING ENDPOINT (GET RECENT LOGS)
 */
app.get('/api/whatsapp/logs/poll', ensureDb, async (req, res) => {
    try {
        const lastSync = req.query.lastSync || 0;
        const connection = await pool.getConnection();
        // Return logs from the last hour or specifically since last request for efficiency
        const [rows] = await connection.query(
            'SELECT data FROM whatsapp_logs ORDER BY timestamp DESC LIMIT 100'
        );
        connection.release();
        const logs = rows.map(r => typeof r.data === 'string' ? JSON.parse(r.data) : r.data);
        res.json({ success: true, logs });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * STANDARD API ROUTES
 */

const createSyncHandler = (table) => async (req, res) => {
    const items = req.body[table] || req.body.orders || req.body.customers || req.body.logs || req.body.templates || req.body.catalog || req.body.plans;
    if (!items) return res.status(400).json({error: "No data payload"});
    try {
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        let query = '';
        if (table === 'orders') query = `INSERT INTO orders (id, customer_contact, status, created_at, data, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status=VALUES(status), data=VALUES(data), updated_at=VALUES(updated_at)`;
        else if (table === 'customers') query = `INSERT INTO customers (id, contact, name, data, updated_at) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), data=VALUES(data), updated_at=VALUES(updated_at)`;
        else if (table === 'logs') query = `INSERT INTO whatsapp_logs (id, phone, direction, timestamp, data) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE data=VALUES(data)`;
        else if (table === 'templates') query = `INSERT INTO templates (id, name, category, data) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE data=VALUES(data), name=VALUES(name), category=VALUES(category)`;
        else if (table === 'plans') query = `INSERT INTO plan_templates (id, name, data) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE data=VALUES(data), name=VALUES(name)`;
        else query = `INSERT INTO catalog (id, category, data) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE data=VALUES(data), category=VALUES(category)`;

        for (const item of items) {
            let params = [];
            if(table === 'orders') params = [item.id, item.customerContact, item.status, new Date(item.createdAt), JSON.stringify(item), Date.now()];
            else if(table === 'customers') params = [item.id, item.contact, item.name, JSON.stringify(item), Date.now()];
            else if(table === 'logs') params = [item.id, item.phoneNumber, item.direction, new Date(item.timestamp), JSON.stringify(item)];
            else if(table === 'templates') params = [item.id, item.name, item.category || 'UTILITY', JSON.stringify(item)];
            else if(table === 'plans') params = [item.id, item.name, JSON.stringify(item)];
            else params = [item.id, item.category, JSON.stringify(item)];
            await connection.query(query, params);
        }
        await connection.commit();
        connection.release();
        res.json({success: true});
    } catch(e) { res.status(500).json({error: e.message}); }
};

app.post('/api/sync/orders', ensureDb, createSyncHandler('orders'));
app.post('/api/sync/customers', ensureDb, createSyncHandler('customers'));
app.post('/api/sync/logs', ensureDb, createSyncHandler('logs'));
app.post('/api/sync/templates', ensureDb, createSyncHandler('templates'));
app.post('/api/sync/plans', ensureDb, createSyncHandler('plans'));
app.post('/api/sync/catalog', ensureDb, createSyncHandler('catalog'));

app.get('/api/bootstrap', ensureDb, async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [orders] = await connection.query('SELECT data FROM orders ORDER BY created_at DESC');
        const [customers] = await connection.query('SELECT data FROM customers');
        const [logs] = await connection.query('SELECT data FROM whatsapp_logs ORDER BY timestamp DESC LIMIT 200');
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

app.post('/api/whatsapp/send', ensureDb, async (req, res) => {
    const { to, message, templateName, language, components, customerName } = req.body;
    const phoneId = req.headers['x-phone-id'];
    const token = req.headers['x-auth-token'];
    
    let payload = { messaging_product: "whatsapp", recipient_type: "individual", to };
    
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
            // IMMEDIATE LOCAL PERSISTENCE FOR OUTBOUND
            const connection = await pool.getConnection();
            const logEntry = {
                id: data.messages[0].id,
                customerName: customerName || "Customer",
                phoneNumber: to,
                message: templateName ? `[Template: ${templateName}]` : message,
                status: 'SENT',
                timestamp: new Date().toISOString(),
                direction: 'outbound',
                type: templateName ? 'TEMPLATE' : 'CUSTOM'
            };
            await connection.query(
                `INSERT INTO whatsapp_logs (id, phone, direction, timestamp, data) VALUES (?, ?, ?, ?, ?)`,
                [logEntry.id, to, 'outbound', new Date(logEntry.timestamp), JSON.stringify(logEntry)]
            );
            connection.release();
        }

        res.status(r.status).json({ success: r.ok, data });
    } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// SETU UPI V2 PROXY
app.post('/api/setu/create-link', ensureDb, async (req, res) => {
    try {
        const { amount, billerBillID, customerID, name, orderId } = req.body;
        const connection = await pool.getConnection();
        const [rows] = await connection.query('SELECT config FROM integrations WHERE provider = ?', ['setu']);
        connection.release();
        if (!rows.length) throw new Error("Setu not configured");
        const config = JSON.parse(rows[0].config);
        
        const authRes = await fetch('https://prod.setu.co/api/v2/auth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientID: config.clientId, secret: config.secret })
        });
        const authData = await authRes.json();
        
        const linkRes = await fetch('https://prod.setu.co/api/v2/payment-links', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Setu-Product-Instance-ID': config.schemeId, 'Authorization': `Bearer ${authData.data.token}` },
            body: JSON.stringify({
                billerBillID,
                amount: { value: Math.round(amount * 100), currencyCode: "INR" },
                amountExactness: "EXACT",
                name: name || "Customer",
                additionalInfo: { customerID, orderId }
            })
        });
        const linkData = await linkRes.json();
        res.json({ success: linkRes.ok, data: linkData });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// STATIC SERVING
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        if (!req.path.startsWith('/api')) res.sendFile(path.join(distPath, 'index.html'));
    });
}

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on ${PORT} | AJAX Polling Enabled`));
