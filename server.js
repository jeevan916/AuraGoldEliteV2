
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
            console.log(`[System] Loading .env from: ${p}`);
            dotenv.config({ path: p });
            loaded = true;
            break;
        }
    }
    
    if (!loaded) {
        console.warn('[System] WARNING: No .env file found in search paths. Using system environment variables.');
    }
};
loadEnv();

// --- DEPLOYMENT AUTO-FIX ---
const resolveRootConflict = () => {
    const distIndex = path.join(__dirname, 'dist', 'index.html');
    const rootIndex = path.join(__dirname, 'index.html');
    const backupIndex = path.join(__dirname, 'index.html.original_source');

    if (fs.existsSync(distIndex) && fs.existsSync(rootIndex)) {
        try {
            const content = fs.readFileSync(rootIndex, 'utf-8');
            if (content.includes('src="./index.tsx"') || content.includes('src="/index.tsx"')) {
                fs.renameSync(rootIndex, backupIndex);
            }
        } catch (e) {}
    }
};
resolveRootConflict();

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
        console.error("DB Init Failed:", err.message);
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

// --- WHATSAPP WEBHOOK: VERIFICATION (GET) ---
app.get('/api/whatsapp/webhook', (req, res) => {
    const verify_token = process.env.WHATSAPP_VERIFY_TOKEN || "auragold_elite_secure_2025";
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === verify_token) {
            console.log(`[Webhook] Meta Verification Successful (v22.0)`);
            return res.status(200).send(challenge);
        } else {
            console.warn(`[Webhook] Meta Verification Failed: Token mismatch`);
            return res.sendStatus(403);
        }
    }
    res.sendStatus(400);
});

// --- WHATSAPP WEBHOOK: EVENT HANDLER (POST) ---
app.post('/api/whatsapp/webhook', ensureDb, async (req, res) => {
    // Acknowledge receipt to Meta immediately
    res.status(200).send('EVENT_RECEIVED');

    try {
        const body = req.body;
        if (!body.entry || !body.entry[0].changes) return;

        const change = body.entry[0].changes[0].value;
        const connection = await pool.getConnection();

        // CASE 1: Incoming Message
        if (change.messages && change.messages[0]) {
            const msg = change.messages[0];
            const from = msg.from; // Sender's phone
            const msgBody = msg.text?.body || `[Media/Unsupported: ${msg.type}]`;
            const timestamp = new Date(parseInt(msg.timestamp) * 1000).toISOString();
            const contactName = change.contacts?.[0]?.profile?.name || "Customer";

            console.log(`[Webhook] New Message from ${from}: ${msgBody}`);

            const logEntry = {
                id: msg.id,
                customerName: contactName,
                phoneNumber: from,
                message: msgBody,
                status: 'READ',
                timestamp,
                direction: 'inbound',
                type: 'INBOUND'
            };

            await connection.query(
                `INSERT INTO whatsapp_logs (id, phone, direction, timestamp, data) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE data=VALUES(data)`,
                [logEntry.id, from, 'inbound', new Date(timestamp), JSON.stringify(logEntry)]
            );
        }

        // CASE 2: Status Update (Sent, Delivered, Read)
        if (change.statuses && change.statuses[0]) {
            const statusUpdate = change.statuses[0];
            const msgId = statusUpdate.id;
            const newStatus = statusUpdate.status.toUpperCase(); // SENT, DELIVERED, READ, FAILED

            // Update existing log entry in DB
            const [rows] = await connection.query('SELECT data FROM whatsapp_logs WHERE id = ?', [msgId]);
            if (rows.length > 0) {
                const existingData = JSON.parse(rows[0].data);
                existingData.status = newStatus;
                await connection.query(
                    'UPDATE whatsapp_logs SET data = ? WHERE id = ?',
                    [JSON.stringify(existingData), msgId]
                );
                console.log(`[Webhook] Message ${msgId} status updated to: ${newStatus}`);
            }
        }

        connection.release();
    } catch (e) {
        console.error("[Webhook Error]:", e.message);
    }
});

app.get('/api/health', async (req, res) => {
    res.json({ status: 'ok', time: new Date(), api_version: META_API_VERSION });
});

const createSyncHandler = (table) => async (req, res) => {
    const items = req.body[table] || req.body.orders || req.body.customers || req.body.logs || req.body.templates || req.body.catalog || req.body.plans;
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

app.post('/api/whatsapp/send', async (req, res) => {
    const { to, message, templateName, language, components } = req.body;
    const phoneId = req.headers['x-phone-id'];
    const token = req.headers['x-auth-token'];
    
    let payload = { messaging_product: "whatsapp", recipient_type: "individual", to };
    
    if (templateName) {
        payload.type = "template"; 
        payload.template = { name: templateName, language: { code: language || "en_US" } };
        if (components) {
            payload.template.components = components;
        }
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
        res.status(r.status).json({ success: r.ok, data });
    } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('/api/whatsapp/templates', async (req, res) => {
    const wabaId = req.headers['x-waba-id'];
    const token = req.headers['x-auth-token'];
    try {
        const r = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${wabaId}/message_templates?limit=100&fields=name,status,components,category,rejected_reason`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
        const data = await r.json();
        res.status(r.status).json({ success: r.ok, data: data.data });
    } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/whatsapp/templates', async (req, res) => {
    const wabaId = req.headers['x-waba-id'];
    const token = req.headers['x-auth-token'];
    try {
        const r = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${wabaId}/message_templates`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        const data = await r.json();
        res.status(r.status).json({ success: r.ok, data });
    } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/whatsapp/templates/:id', async (req, res) => {
    const token = req.headers['x-auth-token'];
    try {
        const r = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${req.params.id}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        const data = await r.json();
        res.status(r.status).json({ success: r.ok, data });
    } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

app.delete('/api/whatsapp/templates', async (req, res) => {
    const wabaId = req.headers['x-waba-id'];
    const token = req.headers['x-auth-token'];
    const name = req.query.name;
    try {
        const r = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${wabaId}/message_templates?name=${name}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
        const data = await r.json();
        res.status(r.status).json({ success: r.ok, data });
    } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// SETU AND RAZORPAY PROXIES
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

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on ${PORT} | Meta v22.0 Active`));
