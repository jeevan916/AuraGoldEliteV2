
import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CONFIGURATION PATH ---
// Attempt to load .env from standard locations
const envPaths = [
    path.join(__dirname, '.env'),
    path.join(__dirname, '.builds', 'config', '.env')
];

for (const p of envPaths) {
    if (fs.existsSync(p)) {
        dotenv.config({ path: p });
        console.log(`Loaded config from ${p}`);
        break;
    }
}

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '100mb' }));

// --- DATABASE CONNECTION ---
let pool = null;

const getConfig = () => {
    let host = process.env.DB_HOST || '127.0.0.1';
    if (host === 'localhost') host = '127.0.0.1'; 
    
    return {
        host: host, 
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'auragold_db',
        port: 3306,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        connectTimeout: 20000
    };
};

async function initDb() {
    const config = getConfig();
    if (pool) { try { await pool.end(); } catch(e) {} pool = null; }

    try {
        pool = mysql.createPool(config);
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

        for (const sql of tables) {
            await connection.query(sql);
        }

        connection.release();
        return { success: true };
    } catch (err) {
        console.error(`DB Init Failed: ${err.message}`);
        return { success: false, error: err.message };
    }
}

initDb();

const ensureDb = async (req, res, next) => {
    if (!pool) {
        const result = await initDb();
        if (!result.success) {
            return res.status(503).json({ error: "Database unavailable", details: result.error });
        }
    }
    next();
};

// --- DATA LOGIC ---
async function fetchLiveAugmontRates() {
    try {
        const response = await fetch('https://uat.batuk.in/augmont/gold', { signal: AbortSignal.timeout(8000) });
        if (!response.ok) throw new Error(`Augmont API ${response.status}`);
        const json = await response.json();
        const dataNode = json.data?.[0]?.[0];
        if (dataNode && dataNode.gSell) {
            const gSell = parseFloat(dataNode.gSell);
            if (!isNaN(gSell)) return { rate24k: gSell, rate22k: Math.round(gSell * (22/24)), rate18k: Math.round(gSell * (18/24)) };
        }
        return null;
    } catch (e) { return null; }
}

async function getAggregatedSettings(connection) {
    const [rateRows] = await connection.query('SELECT * FROM gold_rates ORDER BY id DESC LIMIT 1');
    const rates = rateRows[0] || { rate24k: 7200, rate22k: 6600, rate18k: 5400 };
    const [configRows] = await connection.query('SELECT * FROM app_config');
    const configMap = {};
    configRows.forEach(row => configMap[row.setting_key] = row.setting_value);
    const [intRows] = await connection.query('SELECT * FROM integrations');
    const intMap = {};
    intRows.forEach(row => {
        try { intMap[row.provider] = typeof row.config === 'string' ? JSON.parse(row.config) : row.config; } catch (e) { intMap[row.provider] = {}; }
    });
    return {
        currentGoldRate24K: Number(rates.rate24k),
        currentGoldRate22K: Number(rates.rate22k),
        currentGoldRate18K: Number(rates.rate18k),
        defaultTaxRate: Number(configMap['default_tax_rate'] || 3),
        goldRateProtectionMax: Number(configMap['protection_max'] || 500),
        gracePeriodHours: Number(configMap['grace_period_hours'] || 24),
        followUpIntervalDays: Number(configMap['follow_up_days'] || 3),
        whatsappPhoneNumberId: intMap['whatsapp']?.phoneId || '',
        whatsappBusinessAccountId: intMap['whatsapp']?.accountId || '',
        whatsappBusinessToken: intMap['whatsapp']?.token || '',
        razorpayKeyId: intMap['razorpay']?.keyId || '',
        razorpayKeySecret: intMap['razorpay']?.keySecret || '',
        msg91AuthKey: intMap['msg91']?.authKey || '',
        msg91SenderId: intMap['msg91']?.senderId || '',
        setuSchemeId: intMap['setu']?.schemeId || '',
        setuSecret: intMap['setu']?.secret || ''
    };
}

// --- API ROUTES ---

// Bootstrap
app.get('/api/bootstrap', ensureDb, async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const settings = await getAggregatedSettings(connection);
        const [customerRows] = await connection.query('SELECT data FROM customers');
        const [orderRows] = await connection.query('SELECT data FROM orders ORDER BY created_at DESC');
        const [logRows] = await connection.query('SELECT data FROM whatsapp_logs ORDER BY timestamp DESC LIMIT 500');
        const [templateRows] = await connection.query('SELECT data FROM templates');
        const [planRows] = await connection.query('SELECT data FROM plan_templates');
        const [catalogRows] = await connection.query('SELECT data FROM catalog');
        connection.release();
        
        res.json({ success: true, data: {
            settings,
            customers: customerRows.map(r => typeof r.data === 'string' ? JSON.parse(r.data) : r.data),
            orders: orderRows.map(r => typeof r.data === 'string' ? JSON.parse(r.data) : r.data),
            logs: logRows.map(r => typeof r.data === 'string' ? JSON.parse(r.data) : r.data),
            templates: templateRows.map(r => typeof r.data === 'string' ? JSON.parse(r.data) : r.data),
            planTemplates: planRows.map(r => typeof r.data === 'string' ? JSON.parse(r.data) : r.data),
            catalog: catalogRows.map(r => typeof r.data === 'string' ? JSON.parse(r.data) : r.data),
            lastUpdated: Date.now()
        }});
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Settings Sync
app.post('/api/sync/settings', ensureDb, async (req, res) => {
    const { settings } = req.body;
    if (!settings) return res.status(400).json({ error: "No settings" });
    try {
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        await connection.query(`INSERT INTO gold_rates (rate24k, rate22k, rate18k) VALUES (?, ?, ?)`, [settings.currentGoldRate24K, settings.currentGoldRate22K, settings.currentGoldRate18K || 0]);
        const appConfigs = [['default_tax_rate', settings.defaultTaxRate], ['protection_max', settings.goldRateProtectionMax], ['grace_period_hours', settings.gracePeriodHours], ['follow_up_days', settings.followUpIntervalDays]];
        for (const [k, v] of appConfigs) await connection.query(`INSERT INTO app_config (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`, [k, v]);
        const ints = [
            {p: 'whatsapp', c: {phoneId: settings.whatsappPhoneNumberId, accountId: settings.whatsappBusinessAccountId, token: settings.whatsappBusinessToken}},
            {p: 'razorpay', c: {keyId: settings.razorpayKeyId, keySecret: settings.razorpayKeySecret}},
            {p: 'msg91', c: {authKey: settings.msg91AuthKey, senderId: settings.msg91SenderId}},
            {p: 'setu', c: {schemeId: settings.setuSchemeId, secret: settings.setuSecret}}
        ];
        for (const i of ints) await connection.query(`INSERT INTO integrations (provider, config) VALUES (?, ?) ON DUPLICATE KEY UPDATE config = VALUES(config)`, [i.p, JSON.stringify(i.c)]);
        await connection.commit();
        connection.release();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

const createSyncHandler = (table) => async (req, res) => {
    const items = req.body[table] || req.body.orders || req.body.customers || req.body.logs || req.body.templates || req.body.catalog || req.body.plans;
    if (!items) return res.status(400).json({error: "No data"});
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

// Live Gold Rate
app.get('/api/gold-rate', ensureDb, async (req, res) => {
    try {
        const liveRates = await fetchLiveAugmontRates();
        const connection = await pool.getConnection();
        if (liveRates) {
            await connection.query(`INSERT INTO gold_rates (rate24k, rate22k, rate18k) VALUES (?, ?, ?)`, [liveRates.rate24k, liveRates.rate22k, liveRates.rate18k]);
            connection.release();
            return res.json({ k24: liveRates.rate24k, k22: liveRates.rate22k, k18: liveRates.rate18k, source: 'augmont_live' });
        }
        const [rows] = await connection.query('SELECT rate24k, rate22k, rate18k FROM gold_rates ORDER BY id DESC LIMIT 1');
        connection.release();
        if (rows.length > 0) res.json({ k24: Number(rows[0].rate24k), k22: Number(rows[0].rate22k), k18: Number(rows[0].rate18k), source: 'db_fallback' });
        else res.json({ k24: 7950, k22: 7300, k18: 5980, source: 'static_fallback' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Meta Proxy
app.post('/api/whatsapp/send', async (req, res) => {
    const phoneId = req.headers['x-phone-id'];
    const token = req.headers['x-auth-token'];
    if (!phoneId || !token) return res.status(401).json({ success: false, error: "Missing Credentials" });
    try {
        const result = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        const data = await result.json();
        res.json({ success: result.ok, data });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// WhatsApp Template Proxies
async function callMeta(endpoint, method, token, body = null) {
    try {
        const response = await fetch(`https://graph.facebook.com/v21.0/${endpoint}`, {
            method,
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined
        });
        const data = await response.json();
        return { ok: response.ok, status: response.status, data };
    } catch (e) { return { ok: false, status: 502, data: { error: { message: e.message } } }; }
}

app.get('/api/whatsapp/templates', async (req, res) => {
    const wabaId = req.headers['x-waba-id'];
    const token = req.headers['x-auth-token'];
    const result = await callMeta(`${wabaId}/message_templates?limit=100&fields=name,status,components,category,language,rejected_reason`, 'GET', token);
    res.status(result.status).json({ success: result.ok, data: result.data.data, error: result.data.error?.message });
});

app.post('/api/whatsapp/templates', async (req, res) => {
    const wabaId = req.headers['x-waba-id'];
    const token = req.headers['x-auth-token'];
    const result = await callMeta(`${wabaId}/message_templates`, 'POST', token, req.body);
    res.status(result.status).json({ success: result.ok, data: result.data, error: result.data.error?.message });
});

app.delete('/api/whatsapp/templates', async (req, res) => {
    const wabaId = req.headers['x-waba-id'];
    const token = req.headers['x-auth-token'];
    const name = req.query.name;
    const result = await callMeta(`${wabaId}/message_templates?name=${name}`, 'DELETE', token);
    res.status(result.status).json({ success: result.ok, data: result.data, error: result.data.error?.message });
});

// --- STATIC SERVING ---
// Resolve the path to the current directory where index.html resides
// In the flat deployment structure (server.js, index.html in same root), we use __dirname
let staticRoot = __dirname;

// If a 'dist' folder exists (development or nested deploy), prefer that
if (fs.existsSync(path.join(__dirname, 'dist', 'index.html'))) {
    staticRoot = path.join(__dirname, 'dist');
}

console.log(`Serving static files from: ${staticRoot}`);

// 1. Serve Static Assets (JS, CSS, Images)
// We set 'index: false' to prevent express.static from automatically serving index.html for the root path.
// This allows us to handle the root path explicitly below.
app.use(express.static(staticRoot, { index: false }));

// 2. Explicit Root Handler
// This ensures that hitting '/' specifically sends the app entry point.
app.get('/', (req, res) => {
    res.sendFile(path.join(staticRoot, 'index.html'));
});

// 3. SPA Catch-All
// For any other route not handled by API or static files, serve index.html (client-side routing)
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: "API Endpoint Not Found" });
    }
    res.sendFile(path.join(staticRoot, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
