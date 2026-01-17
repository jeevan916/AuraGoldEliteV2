
import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- STRICT ENV LOADING ---
// Prioritize the .env file in the SAME directory as this script.
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
    console.log(`[System] Loading .env from: ${envFile}`);
    dotenv.config({ path: envFile });
} else {
    // Fallback to standard lookup
    console.log('[System] .env not found in script dir, attempting standard load...');
    dotenv.config();
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '100mb' }));

// --- DATABASE CONFIGURATION ---
const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER, // Do not default to root to force error if env missing
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10,
    connectTimeout: 20000
};

// Log config for debugging (hiding password)
console.log(`[Database] Attempting connection to ${dbConfig.host} as user: ${dbConfig.user}, db: ${dbConfig.database}`);

let pool = null;

async function initDb() {
    try {
        // Create pool
        pool = mysql.createPool(dbConfig);
        
        // Test connection immediately
        const connection = await pool.getConnection();
        console.log("[Database] Connection Successful!");
        
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
        console.error("DB Init Failed:", err.message);
        return { success: false, error: err.message };
    }
}

// Initial connection attempt
initDb();

// Middleware to ensure DB is ready or retry
const ensureDb = async (req, res, next) => {
    if (!pool) {
        console.log("[Database] Pool is null, retrying init...");
        const result = await initDb();
        if (!result.success) {
            return res.status(503).json({ 
                error: "Database Connection Failed", 
                details: result.error,
                config: { host: dbConfig.host, user: dbConfig.user, db: dbConfig.database } // Helpful for debugging
            });
        }
    }
    next();
};

// --- API ROUTES ---
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// Debug Route to check connectivity explicitly
app.get('/api/debug/db', async (req, res) => {
    try {
        if (!pool) await initDb();
        const connection = await pool.getConnection();
        await connection.ping();
        connection.release();
        res.json({ connected: true, user: dbConfig.user, db: dbConfig.database });
    } catch (e) {
        res.status(500).json({ connected: false, error: e.message, config: { user: dbConfig.user, host: dbConfig.host } });
    }
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

app.get('/api/bootstrap', ensureDb, async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [rateRows] = await connection.query('SELECT * FROM gold_rates ORDER BY id DESC LIMIT 1');
        const [configRows] = await connection.query('SELECT * FROM app_config');
        const [intRows] = await connection.query('SELECT * FROM integrations');
        
        const rates = rateRows[0] || { rate24k: 7200, rate22k: 6600, rate18k: 5400 };
        const configMap = {}; configRows.forEach(r => configMap[r.setting_key] = r.setting_value);
        const intMap = {}; intRows.forEach(r => { try { intMap[r.provider] = JSON.parse(r.config); } catch(e){} });

        const settings = {
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

        const [orders] = await connection.query('SELECT data FROM orders ORDER BY created_at DESC');
        const [customers] = await connection.query('SELECT data FROM customers');
        const [logs] = await connection.query('SELECT data FROM whatsapp_logs ORDER BY timestamp DESC LIMIT 100');
        const [templates] = await connection.query('SELECT data FROM templates');
        const [planTemplates] = await connection.query('SELECT data FROM plan_templates');
        const [catalog] = await connection.query('SELECT data FROM catalog');
        
        connection.release();
        
        res.json({ success: true, data: {
            settings,
            orders: orders.map(r => typeof r.data === 'string' ? JSON.parse(r.data) : r.data),
            customers: customers.map(r => typeof r.data === 'string' ? JSON.parse(r.data) : r.data),
            logs: logs.map(r => typeof r.data === 'string' ? JSON.parse(r.data) : r.data),
            templates: templates.map(r => typeof r.data === 'string' ? JSON.parse(r.data) : r.data),
            planTemplates: planTemplates.map(r => typeof r.data === 'string' ? JSON.parse(r.data) : r.data),
            catalog: catalog.map(r => typeof r.data === 'string' ? JSON.parse(r.data) : r.data),
            lastUpdated: Date.now()
        }});
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/sync/settings', ensureDb, async (req, res) => {
    const { settings } = req.body;
    try {
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        await connection.query(`INSERT INTO gold_rates (rate24k, rate22k, rate18k) VALUES (?, ?, ?)`, [settings.currentGoldRate24K, settings.currentGoldRate22K, settings.currentGoldRate18K || 0]);
        
        const configs = [
            ['default_tax_rate', settings.defaultTaxRate], ['protection_max', settings.goldRateProtectionMax],
            ['grace_period_hours', settings.gracePeriodHours], ['follow_up_days', settings.followUpIntervalDays]
        ];
        for(const [k, v] of configs) await connection.query(`INSERT INTO app_config (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)`, [k, v]);

        const integrations = [
            {p: 'whatsapp', c: {phoneId: settings.whatsappPhoneNumberId, accountId: settings.whatsappBusinessAccountId, token: settings.whatsappBusinessToken}},
            {p: 'razorpay', c: {keyId: settings.razorpayKeyId, keySecret: settings.razorpayKeySecret}},
            {p: 'msg91', c: {authKey: settings.msg91AuthKey, senderId: settings.msg91SenderId}},
            {p: 'setu', c: {schemeId: settings.setuSchemeId, secret: settings.setuSecret}}
        ];
        for(const i of integrations) await connection.query(`INSERT INTO integrations (provider, config) VALUES (?, ?) ON DUPLICATE KEY UPDATE config=VALUES(config)`, [i.p, JSON.stringify(i.c)]);
        
        await connection.commit();
        connection.release();
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/gold-rate', ensureDb, async (req, res) => {
    try {
        const response = await fetch('https://uat.batuk.in/augmont/gold', { signal: AbortSignal.timeout(5000) });
        if (response.ok) {
            const json = await response.json();
            const gSell = parseFloat(json.data?.[0]?.[0]?.gSell);
            if (!isNaN(gSell)) {
                return res.json({ k24: gSell, k22: Math.round(gSell * (22/24)), source: 'live' });
            }
        }
        const connection = await pool.getConnection();
        const [rows] = await connection.query('SELECT rate24k, rate22k FROM gold_rates ORDER BY id DESC LIMIT 1');
        connection.release();
        if(rows.length) res.json({ k24: Number(rows[0].rate24k), k22: Number(rows[0].rate22k), source: 'db' });
        else res.json({ k24: 7900, k22: 7200, source: 'default' });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

async function callMeta(endpoint, method, token, body) {
    try {
        const r = await fetch(`https://graph.facebook.com/v21.0/${endpoint}`, {
            method, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined
        });
        const data = await r.json();
        return { ok: r.ok, status: r.status, data };
    } catch(e) { return { ok: false, status: 500, data: { error: { message: e.message } } }; }
}

app.post('/api/whatsapp/send', async (req, res) => {
    const { to, message, templateName, language, variables } = req.body;
    const phoneId = req.headers['x-phone-id'];
    const token = req.headers['x-auth-token'];
    let payload = { messaging_product: "whatsapp", recipient_type: "individual", to };
    if (templateName) {
        payload.type = "template";
        payload.template = { name: templateName, language: { code: language || "en_US" } };
        if (variables) payload.template.components = [{ type: "body", parameters: variables.map(v => ({ type: "text", text: v })) }];
    } else {
        payload.type = "text";
        payload.text = { body: message };
    }
    const result = await callMeta(`${phoneId}/messages`, 'POST', token, payload);
    res.status(result.status).json({ success: result.ok, data: result.data });
});

app.get('/api/whatsapp/templates', async (req, res) => {
    const result = await callMeta(`${req.headers['x-waba-id']}/message_templates?limit=100&fields=name,status,components,category,rejected_reason`, 'GET', req.headers['x-auth-token']);
    res.status(result.status).json({ success: result.ok, data: result.data.data });
});

app.post('/api/whatsapp/templates', async (req, res) => {
    const result = await callMeta(`${req.headers['x-waba-id']}/message_templates`, 'POST', req.headers['x-auth-token'], req.body);
    res.status(result.status).json({ success: result.ok, data: result.data });
});

// --- STATIC FILES (SPA SETUP) ---
let distPath = __dirname;
if (fs.existsSync(path.join(__dirname, 'dist', 'index.html'))) {
    distPath = path.join(__dirname, 'dist');
}

// Serve static assets with index: false to prevent hijacking root
app.use(express.static(distPath, { index: false }));

// EXPLICIT ROOT HANDLER
// Ensures the root route '/' and '/index' serve the BUILT index.html correctly.
app.get(['/', '/index'], (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
});

// SPA CATCH-ALL
// For any other route (like /dashboard), serve index.html to support React Router.
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: "API Endpoint Not Found" });
    }
    res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on ${PORT} serving ${distPath}`));
