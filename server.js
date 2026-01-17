
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
const ENV_PATH = path.join(__dirname, '.builds', 'config', '.env');

// --- SYSTEM LOGGING ---
let systemLog = [];
const log = (msg, type = 'INFO') => {
    const entry = `[${new Date().toLocaleTimeString()}] [${type}] ${msg}`;
    console.log(entry);
    systemLog.push(entry);
    if (systemLog.length > 500) systemLog.shift();
};

// Load environment
const envResult = dotenv.config({ path: ENV_PATH });
if (envResult.error) {
    log(`No .env at ${ENV_PATH}. Using process env.`, 'WARN');
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '100mb' }));

// --- DATABASE SETUP (Keep existing logic) ---
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
        
        // Initialize Tables
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
        log(`DB Init Failed: ${err.message}`, 'ERROR');
        return { success: false, error: err.message };
    }
}
initDb();

const ensureDb = async (req, res, next) => {
    if (!pool) {
        const result = await initDb();
        if (!result.success) return res.status(503).json({ error: "Database unavailable", details: result.error });
    }
    next();
};

// --- EXTERNAL API PROXIES ---
// (Keep existing fetchLiveAugmontRates, getAggregatedSettings, and API routes)
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
    // Re-implement logic from previous server.js to maintain functionality
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

// --- API ENDPOINTS (Condensed for brevity, assumed unchanged logic) ---
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

app.post('/api/sync/settings', ensureDb, async (req, res) => {
    // Keep sync logic from previous iteration
    const { settings } = req.body;
    if (!settings) return res.status(400).json({ error: "No settings" });
    try {
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        await connection.query(`INSERT INTO gold_rates (rate24k, rate22k, rate18k) VALUES (?, ?, ?)`, [settings.currentGoldRate24K, settings.currentGoldRate22K, settings.currentGoldRate18K || 0]);
        // Update app_config
        const appConfigs = [['default_tax_rate', settings.defaultTaxRate], ['protection_max', settings.goldRateProtectionMax], ['grace_period_hours', settings.gracePeriodHours], ['follow_up_days', settings.followUpIntervalDays]];
        for (const [k, v] of appConfigs) await connection.query(`INSERT INTO app_config (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`, [k, v]);
        // Update integrations
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

// Generic Sync Handlers
const createSyncHandler = (table, fieldMap) => async (req, res) => {
    const items = req.body[table] || req.body.orders || req.body.customers || req.body.logs || req.body.templates || req.body.catalog || req.body.plans;
    if (!items) return res.status(400).json({error: "No data"});
    try {
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        const tableName = table === 'plans' ? 'plan_templates' : (table === 'logs' ? 'whatsapp_logs' : table);
        const query = table === 'orders' 
            ? `INSERT INTO orders (id, customer_contact, status, created_at, data, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status=VALUES(status), data=VALUES(data), updated_at=VALUES(updated_at)`
            : table === 'customers'
            ? `INSERT INTO customers (id, contact, name, data, updated_at) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), data=VALUES(data), updated_at=VALUES(updated_at)`
            : table === 'logs'
            ? `INSERT INTO whatsapp_logs (id, phone, direction, timestamp, data) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE data=VALUES(data)`
            : table === 'templates'
            ? `INSERT INTO templates (id, name, category, data) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE data=VALUES(data), name=VALUES(name), category=VALUES(category)`
            : table === 'plans'
            ? `INSERT INTO plan_templates (id, name, data) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE data=VALUES(data), name=VALUES(name)`
            : `INSERT INTO catalog (id, category, data) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE data=VALUES(data), category=VALUES(category)`;
            
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

// Meta Proxy (Simplified)
app.post('/api/whatsapp/send', async (req, res) => {
    const phoneId = req.headers['x-phone-id'];
    const token = req.headers['x-auth-token'];
    if (!phoneId || !token) return res.status(401).json({ success: false, error: "Missing Credentials" });

    // Forward to Meta
    try {
        const result = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        const data = await result.json();
        res.json({ success: result.ok, data });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/whatsapp/templates', async (req, res) => {
    const wabaId = req.headers['x-waba-id'];
    const token = req.headers['x-auth-token'];
    if (!wabaId || !token) return res.status(401).json({ success: false, error: "Missing Credentials" });
    try {
        const result = await fetch(`https://graph.facebook.com/v21.0/${wabaId}/message_templates?limit=100&fields=name,status,components,category,language,rejected_reason`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await result.json();
        res.json({ success: result.ok, data: data.data || [] });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/whatsapp/templates', async (req, res) => {
    const wabaId = req.headers['x-waba-id'];
    const token = req.headers['x-auth-token'];
    if (!wabaId || !token) return res.status(401).json({ success: false, error: "Missing Credentials" });
    try {
        const result = await fetch(`https://graph.facebook.com/v21.0/${wabaId}/message_templates`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        const data = await result.json();
        res.json({ success: result.ok, data });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// --- FRONTEND ROUTING FIX ---

// 1. Force root '/' to be rewritten as '/index.html'
// This ensures that when express.static runs next, it looks for index.html specifically
app.use((req, res, next) => {
    if (req.method === 'GET' && req.path === '/') {
        req.url = '/index.html';
    }
    next();
});

// 2. Identify Static Path
let staticPath = null;
if (fs.existsSync(path.join(__dirname, 'dist', 'index.html'))) {
    staticPath = path.join(__dirname, 'dist');
} else if (fs.existsSync(path.join(__dirname, 'index.html'))) {
    staticPath = __dirname;
}

// 3. Serve Static Assets
if (staticPath) {
    // Use standard behavior - now that / is rewritten to /index.html, this will serve it.
    app.use(express.static(staticPath));
}

// 4. SPA Catch-All
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: "Not Found" });
    if (staticPath) {
        res.sendFile(path.join(staticPath, 'index.html'));
    } else {
        res.send('AuraGold Backend Running. Frontend Not Found.');
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
