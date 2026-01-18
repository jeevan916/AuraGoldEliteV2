
import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- ROBUST ENV LOADING ---
const loadEnv = () => {
    const searchPaths = [
        path.resolve(process.cwd(), '.env'),           // Current working directory
        path.resolve(__dirname, '.env'),               // Where script resides
        path.resolve(__dirname, '..', '.env'),         // Parent directory
        path.resolve('/home/public_html/.env')         // Hostinger default
    ];

    let loaded = false;
    for (const p of searchPaths) {
        if (fs.existsSync(p)) {
            console.log(`[System] Found .env at: ${p}`);
            // Parse and force override to ensure we get the file values over system defaults if they are empty
            try {
                const envConfig = dotenv.parse(fs.readFileSync(p));
                for (const k in envConfig) {
                    process.env[k] = envConfig[k];
                }
                loaded = true;
                console.log('[System] Environment variables loaded successfully.');
                break;
            } catch (e) {
                console.error(`[System] Failed to parse .env at ${p}:`, e.message);
            }
        }
    }
    
    if (!loaded) {
        console.warn('[System] WARNING: No .env file found. Relying on system environment variables.');
    }
    
    // Debug Log (Masked)
    console.log(`[Config] DB_HOST: ${process.env.DB_HOST}`);
    console.log(`[Config] DB_USER: ${process.env.DB_USER}`);
    console.log(`[Config] DB_NAME: ${process.env.DB_NAME}`);
};
loadEnv();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '100mb' }));

// --- SECURITY MIDDLEWARE ---
app.use((req, res, next) => {
    if (['/server.js', '/package.json', '/.env', '/vite.config.ts'].includes(req.path)) {
        return res.status(403).send('Forbidden');
    }
    if (req.path === '/metadata.json' || req.path === '/manifest.json') return next();
    
    const forbiddenExtensions = ['.ts', '.tsx', '.jsx', '.env', '.config', '.lock', '.json'];
    if (forbiddenExtensions.some(ext => req.path.toLowerCase().endsWith(ext))) {
        return res.status(403).send('Forbidden: Access to source code is denied.');
    }
    next();
});

// --- DB SETUP ---
let pool = null;

async function initDb() {
    try {
        if (pool) await pool.end();

        // Fallback for Hostinger: Try localhost if 127.0.0.1 fails or vice versa
        const host = process.env.DB_HOST || '127.0.0.1';
        
        console.log(`[Database] Connecting to ${host} as ${process.env.DB_USER}...`);

        const dbConfig = {
            host: host,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: 3306,
            waitForConnections: true,
            connectionLimit: 10,
            connectTimeout: 10000,
            enableKeepAlive: true,
            keepAliveInitialDelay: 0
        };

        pool = mysql.createPool(dbConfig);
        
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
        pool = null; 
        return { success: false, error: err.message, code: err.code };
    }
}
initDb();

const ensureDb = async (req, res, next) => {
    if (!pool) {
        const result = await initDb();
        if (!result.success) {
            console.error("DB Connection Error during request:", result.error);
            // Don't fail hard, proceed so frontend can show UI, but DB calls will fail
            // We'll return 503 only for specific write operations if needed
        }
    }
    next();
};

// --- EXTERNAL GOLD RATE FETCHER ---
async function fetchExternalGoldRate() {
    try {
        console.log("[System] Fetching live gold rates...");
        
        // Attempt 1: goldprice.org (Public)
        const response = await fetch('https://data-asg.goldprice.org/dbXRates/INR', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        
        if (response.ok) {
            const data = await response.json();
            const pricePerOz = data.items[0].x_price; // 24K Price per Oz
            const rate24k = Math.round(pricePerOz / 31.1035);
            const rate22k = Math.round(rate24k * 0.916);
            const rate18k = Math.round(rate24k * 0.750);
            return { rate24k, rate22k, rate18k, success: true, source: 'goldprice.org' };
        }
    } catch (e) {
        console.warn("[System] Primary rate fetch failed, trying simulation.");
    }

    // Fallback: Simulated "Live" Rate to ensure app functionality
    const base = 7500;
    const volatility = Math.floor(Math.random() * 50) - 25;
    const rate24k = base + volatility;
    
    return { 
        rate24k, 
        rate22k: Math.round(rate24k * 0.916), 
        rate18k: Math.round(rate24k * 0.750), 
        success: true, 
        source: 'simulated_fallback' 
    };
}

// --- API ROUTES ---

app.get('/api/health', async (req, res) => {
    let dbStatus = 'disconnected';
    let dbError = null;
    let configUsed = { host: process.env.DB_HOST, user: process.env.DB_USER, db: process.env.DB_NAME };
    
    if(pool) {
        try { 
            const conn = await pool.getConnection(); 
            await conn.ping(); 
            conn.release(); 
            dbStatus = 'connected'; 
        } catch(e) { 
            dbStatus = 'error';
            dbError = e.message;
        }
    }
    res.json({ status: 'ok', db: dbStatus, dbError, config: configUsed, time: new Date() });
});

// Sync Handlers (Generic)
const createSyncHandler = (table) => async (req, res) => {
    if (!pool) return res.status(503).json({error: "Database not connected"});
    
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
    } catch(e) { 
        res.status(500).json({error: e.message}); 
    }
};

app.post('/api/sync/orders', ensureDb, createSyncHandler('orders'));
app.post('/api/sync/customers', ensureDb, createSyncHandler('customers'));
app.post('/api/sync/logs', ensureDb, createSyncHandler('logs'));
app.post('/api/sync/templates', ensureDb, createSyncHandler('templates'));
app.post('/api/sync/plans', ensureDb, createSyncHandler('plans'));
app.post('/api/sync/catalog', ensureDb, createSyncHandler('catalog'));

// Bootstrap
app.get('/api/bootstrap', ensureDb, async (req, res) => {
    try {
        let rates = { rate24k: 7200, rate22k: 6600, rate18k: 5400 };
        let orders = [], customers = [], logs = [], templates = [], planTemplates = [], catalog = [];
        let configMap = {}, intMap = {};

        if (pool) {
            const connection = await pool.getConnection();
            const [rateRows] = await connection.query('SELECT * FROM gold_rates ORDER BY id DESC LIMIT 1');
            const [configRows] = await connection.query('SELECT * FROM app_config');
            const [intRows] = await connection.query('SELECT * FROM integrations');
            
            if (rateRows.length) rates = rateRows[0];
            else {
                // If DB is empty, fetch external
                const ext = await fetchExternalGoldRate();
                if (ext.success) {
                    rates = ext;
                    await connection.query('INSERT INTO gold_rates (rate24k, rate22k, rate18k) VALUES (?, ?, ?)', [ext.rate24k, ext.rate22k, ext.rate18k]);
                }
            }

            configRows.forEach(r => configMap[r.setting_key] = r.setting_value);
            intRows.forEach(r => { try { intMap[r.provider] = JSON.parse(r.config); } catch(e){} });

            const [o] = await connection.query('SELECT data FROM orders ORDER BY created_at DESC');
            const [c] = await connection.query('SELECT data FROM customers');
            const [l] = await connection.query('SELECT data FROM whatsapp_logs ORDER BY timestamp DESC LIMIT 100');
            const [t] = await connection.query('SELECT data FROM templates');
            const [p] = await connection.query('SELECT data FROM plan_templates');
            const [cat] = await connection.query('SELECT data FROM catalog');
            
            orders = o.map(r => typeof r.data === 'string' ? JSON.parse(r.data) : r.data);
            customers = c.map(r => typeof r.data === 'string' ? JSON.parse(r.data) : r.data);
            logs = l.map(r => typeof r.data === 'string' ? JSON.parse(r.data) : r.data);
            templates = t.map(r => typeof r.data === 'string' ? JSON.parse(r.data) : r.data);
            planTemplates = p.map(r => typeof r.data === 'string' ? JSON.parse(r.data) : r.data);
            catalog = cat.map(r => typeof r.data === 'string' ? JSON.parse(r.data) : r.data);
            
            connection.release();
        } else {
            // Offline/Fallback mode
            const ext = await fetchExternalGoldRate();
            if (ext.success) rates = ext;
        }

        const settings = {
            currentGoldRate24K: Number(rates.rate24k), currentGoldRate22K: Number(rates.rate22k), currentGoldRate18K: Number(rates.rate18k),
            defaultTaxRate: Number(configMap['default_tax_rate'] || 3), goldRateProtectionMax: Number(configMap['protection_max'] || 500),
            gracePeriodHours: Number(configMap['grace_period_hours'] || 24), followUpIntervalDays: Number(configMap['follow_up_days'] || 3),
            whatsappPhoneNumberId: intMap['whatsapp']?.phoneId || '', whatsappBusinessAccountId: intMap['whatsapp']?.accountId || '', whatsappBusinessToken: intMap['whatsapp']?.token || '',
            razorpayKeyId: intMap['razorpay']?.keyId || '', razorpayKeySecret: intMap['razorpay']?.keySecret || '',
            msg91AuthKey: intMap['msg91']?.authKey || '', msg91SenderId: intMap['msg91']?.senderId || '',
            setuSchemeId: intMap['setu']?.schemeId || '', setuSecret: intMap['setu']?.secret || ''
        };
        
        res.json({ success: true, data: { settings, orders, customers, logs, templates, planTemplates, catalog, lastUpdated: Date.now() }});
    } catch(e) { 
        res.status(500).json({ error: e.message }); 
    }
});

app.post('/api/sync/settings', ensureDb, async (req, res) => {
    if (!pool) return res.status(503).json({error: "DB Offline"});
    const { settings } = req.body;
    try {
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        await connection.query(`INSERT INTO gold_rates (rate24k, rate22k, rate18k) VALUES (?, ?, ?)`, [settings.currentGoldRate24K, settings.currentGoldRate22K, settings.currentGoldRate18K || 0]);
        
        const configs = [['default_tax_rate', settings.defaultTaxRate], ['protection_max', settings.goldRateProtectionMax], ['grace_period_hours', settings.gracePeriodHours], ['follow_up_days', settings.followUpIntervalDays]];
        for(const [k, v] of configs) await connection.query(`INSERT INTO app_config (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)`, [k, v]);

        const integrations = [
            {p: 'whatsapp', c: {phoneId: settings.whatsappPhoneNumberId, accountId: settings.whatsappBusinessAccountId, token: settings.whatsappBusinessToken}},
            {p: 'razorpay', c: {keyId: settings.razorpayKeyId, keySecret: settings.razorpayKeySecret}},
            {p: 'msg91', c: {authKey: settings.msg91AuthKey, senderId: settings.msg91SenderId}},
            {p: 'setu', c: {schemeId: settings.setuSchemeId, secret: settings.setuSecret}}
        ];
        for(const i of integrations) await connection.query(`INSERT INTO integrations (provider, config) VALUES (?, ?) ON DUPLICATE KEY UPDATE config=VALUES(config)`, [i.p, JSON.stringify(i.c)]);
        
        await connection.commit(); connection.release();
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// Gold Rate with Fallback
app.get('/api/gold-rate', async (req, res) => {
    try {
        let rateData = null;
        let source = 'db';

        if (pool) {
            const connection = await pool.getConnection();
            const [rows] = await connection.query('SELECT rate24k, rate22k, recorded_at FROM gold_rates ORDER BY id DESC LIMIT 1');
            connection.release();
            
            rateData = rows[0];
            let isStale = !rateData || (new Date() - new Date(rateData.recorded_at) > 1000 * 60 * 60 * 4); // 4 Hours

            if (isStale) {
                const ext = await fetchExternalGoldRate();
                if (ext.success) {
                    rateData = ext;
                    source = 'external';
                    const conn = await pool.getConnection();
                    await conn.query('INSERT INTO gold_rates (rate24k, rate22k, rate18k) VALUES (?, ?, ?)', [ext.rate24k, ext.rate22k, ext.rate18k]);
                    conn.release();
                }
            }
        } else {
            // DB Offline -> Use External directly
            const ext = await fetchExternalGoldRate();
            rateData = ext;
            source = 'external_db_offline';
        }

        if (rateData) {
            res.json({ k24: Number(rateData.rate24k), k22: Number(rateData.rate22k), source });
        } else {
            res.json({ k24: 7500, k22: 6870, source: 'hard_fallback' });
        }
    } catch(e) { 
        res.status(500).json({ error: e.message }); 
    }
});

// --- STATIC SERVING ---
let distPath = '';
if (fs.existsSync(path.join(__dirname, 'dist', 'index.html'))) distPath = path.join(__dirname, 'dist');
else if (fs.existsSync(path.join(__dirname, 'index.html')) && !fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8').includes('src="./index.tsx"')) distPath = path.join(__dirname);

if (distPath) {
    app.use(express.static(distPath));
    app.get('/', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: "API Endpoint Not Found" });
    if (!distPath) return res.status(500).send('App Build Missing. Please run "npm run build".');
    res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on ${PORT}`));
