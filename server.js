
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
        console.log('[System] Searched in:', searchPaths);
    } else {
        console.log('[System] Environment variables loaded.');
    }
};
loadEnv();

const app = express();
const PORT = process.env.PORT || 3000;

// --- PRODUCTION OPTIMIZATIONS ---
app.set('trust proxy', 1); 
app.use(compression());    
app.use(cors());
app.use(express.json({ limit: '100mb' }));

// --- SECURITY MIDDLEWARE ---
app.use((req, res, next) => {
    if (['/server.js', '/package.json', '/.env', '/vite.config.ts'].includes(req.path)) {
        return res.status(403).send('Forbidden');
    }
    if (req.path === '/metadata.json' || req.path === '/manifest.json') return next();
    
    // Allow access to built assets but block source files if exposed
    const forbiddenExtensions = ['.ts', '.tsx', '.jsx', '.env', '.config', '.lock', '.json'];
    if (forbiddenExtensions.some(ext => req.path.toLowerCase().endsWith(ext))) {
        // Exception for manifest/metadata which might be json
        if (!req.path.endsWith('manifest.json') && !req.path.endsWith('metadata.json')) {
             return res.status(403).send('Forbidden: Access to source code is denied.');
        }
    }
    next();
});

// --- DB SETUP ---
let pool = null;

async function initDb() {
    try {
        if (pool) await pool.end();

        console.log(`[Database] Connecting to ${process.env.DB_HOST || 'localhost'} as ${process.env.DB_USER}...`);

        const dbConfig = {
            host: process.env.DB_HOST || '127.0.0.1',
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: 3306,
            waitForConnections: true,
            connectionLimit: 10,
            connectTimeout: 20000,
            enableKeepAlive: true,
            keepAliveInitialDelay: 0
        };

        pool = mysql.createPool(dbConfig);
        
        const connection = await pool.getConnection();
        console.log("[Database] Connection Successful!");
        
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
            return res.status(503).json({ error: "Database Unavailable", details: result.error, code: result.code });
        }
    }
    next();
};

// --- EXTERNAL GOLD RATE FETCHER ---
async function fetchExternalGoldRate() {
    try {
        console.log("[System] Fetching live gold rates from Augmont Proxy (Batuk)...");
        const response = await fetch('https://uat.batuk.in/augmont/gold', {
            headers: { 'User-Agent': 'AuraGold/5.0' },
            timeout: 8000
        });
        
        if (!response.ok) throw new Error(`Augmont API Error: ${response.status}`);
        
        const data = await response.json();
        console.log("[System] Augmont Rate Data:", JSON.stringify(data));

        let rate24k = 0;
        
        if (typeof data.rate === 'number') rate24k = data.rate;
        else if (typeof data.price === 'number') rate24k = data.price;
        else if (typeof data.gold === 'number') rate24k = data.gold;
        else if (data.gold?.buy) rate24k = Number(data.gold.buy);
        else if (data.rates?.goldBuy) rate24k = Number(data.rates.goldBuy);
        else if (data.data?.rate) rate24k = Number(data.data.rate);

        if (!rate24k || isNaN(rate24k)) {
            throw new Error("Could not parse rate from Batuk response.");
        }

        if (rate24k > 20000) rate24k = Math.round(rate24k / 10);

        const rate22k = Math.round(rate24k * 0.916);
        const rate18k = Math.round(rate24k * 0.750);
        
        return { rate24k, rate22k, rate18k, success: true };
    } catch (e) {
        console.error("[System] Primary Gold Fetch Failed:", e.message);
        return { success: false };
    }
}

// --- API ROUTES ---

app.get('/api/health', async (req, res) => {
    let dbStatus = 'disconnected';
    let dbError = null;
    let configUsed = { 
        host: process.env.DB_HOST ? '[SET]' : '[MISSING]', 
        user: process.env.DB_USER ? '[SET]' : '[MISSING]', 
        db: process.env.DB_NAME ? '[SET]' : '[MISSING]' 
    };
    
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
    res.json({ 
        status: 'ok', 
        db: dbStatus, 
        dbError, 
        configStatus: configUsed, 
        time: new Date(),
        mode: fs.existsSync(path.join(__dirname, 'index.html')) ? 'PRODUCTION' : 'DEVELOPMENT'
    });
});

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
    } catch(e) { 
        console.error(`Sync Error [${table}]:`, e.message);
        res.status(500).json({error: e.message}); 
    }
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
        
        let rates = rateRows[0];
        
        if (!rates) {
            const extRates = await fetchExternalGoldRate();
            if (extRates.success) {
                rates = extRates;
                await connection.query('INSERT INTO gold_rates (rate24k, rate22k, rate18k) VALUES (?, ?, ?)', [rates.rate24k, rates.rate22k, rates.rate18k]);
            } else {
                rates = { rate24k: 7800, rate22k: 7150, rate18k: 5850 }; // Valid fallback for late 2024/2025
            }
        }

        const configMap = {}; configRows.forEach(r => configMap[r.setting_key] = r.setting_value);
        const intMap = {}; intRows.forEach(r => { try { intMap[r.provider] = JSON.parse(r.config); } catch(e){} });

        const settings = {
            currentGoldRate24K: Number(rates.rate24k), currentGoldRate22K: Number(rates.rate22k), currentGoldRate18K: Number(rates.rate18k),
            defaultTaxRate: Number(configMap['default_tax_rate'] || 3), goldRateProtectionMax: Number(configMap['protection_max'] || 500),
            gracePeriodHours: Number(configMap['grace_period_hours'] || 24), followUpIntervalDays: Number(configMap['follow_up_days'] || 3),
            whatsappPhoneNumberId: intMap['whatsapp']?.phoneId || '', whatsappBusinessAccountId: intMap['whatsapp']?.accountId || '', whatsappBusinessToken: intMap['whatsapp']?.token || '',
            razorpayKeyId: intMap['razorpay']?.keyId || '', razorpayKeySecret: intMap['razorpay']?.keySecret || '',
            msg91AuthKey: intMap['msg91']?.authKey || '', msg91SenderId: intMap['msg91']?.senderId || '',
            setuSchemeId: intMap['setu']?.schemeId || '', setuSecret: intMap['setu']?.secret || ''
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

app.get('/api/gold-rate', ensureDb, async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.query('SELECT rate24k, rate22k, recorded_at FROM gold_rates ORDER BY id DESC LIMIT 1');
        
        let rateData = rows[0];
        let isStale = !rateData || (new Date() - new Date(rateData.recorded_at) > 1000 * 60 * 60 * 4); // 4 Hours

        if (isStale) {
            const ext = await fetchExternalGoldRate();
            if (ext.success) {
                rateData = ext;
                connection.query('INSERT INTO gold_rates (rate24k, rate22k, rate18k) VALUES (?, ?, ?)', [ext.rate24k, ext.rate22k, ext.rate18k]);
            }
        }
        connection.release();

        if (rateData) {
            res.json({ k24: Number(rateData.rate24k), k22: Number(rateData.rate22k), source: 'active' });
        } else {
            res.json({ k24: 7800, k22: 7150, source: 'fallback_default' });
        }
    } catch(e) { res.status(500).json({ error: e.message }); }
});

async function callMeta(endpoint, method, token, body) {
    try {
        const r = await fetch(`https://graph.facebook.com/v21.0/${endpoint}`, { method, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
        const data = await r.json(); return { ok: r.ok, status: r.status, data };
    } catch(e) { return { ok: false, status: 500, data: { error: { message: e.message } } }; }
}

app.post('/api/whatsapp/send', async (req, res) => {
    const { to, message, templateName, language, variables } = req.body;
    const phoneId = req.headers['x-phone-id'];
    const token = req.headers['x-auth-token'];
    let payload = { messaging_product: "whatsapp", recipient_type: "individual", to };
    if (templateName) {
        payload.type = "template"; payload.template = { name: templateName, language: { code: language || "en_US" } };
        if (variables) payload.template.components = [{ type: "body", parameters: variables.map(v => ({ type: "text", text: v })) }];
    } else { payload.type = "text"; payload.text = { body: message }; }
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

app.post('/api/whatsapp/templates/:id', async (req, res) => {
    const result = await callMeta(`${req.params.id}`, 'POST', req.headers['x-auth-token'], req.body);
    res.status(result.status).json({ success: result.ok, data: result.data });
});

app.delete('/api/whatsapp/templates', async (req, res) => {
    const name = req.query.name;
    const result = await callMeta(`${req.headers['x-waba-id']}/message_templates?name=${name}`, 'DELETE', req.headers['x-auth-token']);
    res.status(result.status).json({ success: result.ok, data: result.data });
});

// --- SMART STATIC SERVING ---
let staticPath = null;
let indexPath = null;

// Determine absolute paths for potential build locations
const distPath = path.join(__dirname, 'dist');
const rootIndexPath = path.join(__dirname, 'index.html');

// Helper to check if file is source code
const isSourceCode = (filePath) => {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        // Check for TSX import which indicates source code
        return content.includes('src="./index.tsx"') || content.includes('src="/index.tsx"');
    } catch (e) {
        return false;
    }
};

// Priority 1: Check for DIST folder (Standard Build Output)
if (fs.existsSync(path.join(distPath, 'index.html'))) {
    staticPath = distPath;
    indexPath = path.join(distPath, 'index.html');
    console.log("[System] Mode: SERVING FROM /dist");
} 
// Priority 2: Check for Flattened Deployment (Production) in Root
else if (fs.existsSync(rootIndexPath)) {
    if (isSourceCode(rootIndexPath)) {
        console.error("CRITICAL: Root index.html detected as SOURCE CODE. Skipping static serve to prevent crash.");
        // Do NOT set staticPath to root if it contains source code.
        // This forces the catch-all to handle it, where we can show a friendly error.
    } else {
        staticPath = __dirname;
        indexPath = rootIndexPath;
        console.log("[System] Mode: PRODUCTION (Serving from root)");
    }
}

// MIME Types map to ensure JS modules load correctly
const MIME_TYPES = {
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.css': 'text/css',
    '.html': 'text/html',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml'
};

if (staticPath) {
    // Aggressive caching for assets, no-cache for app entry
    app.use(express.static(staticPath, { 
        index: false, // Let the catch-all handle index.html to control headers
        setHeaders: (res, filePath) => {
            const ext = path.extname(filePath).toLowerCase();
            if (MIME_TYPES[ext]) {
                res.setHeader('Content-Type', MIME_TYPES[ext]);
            }
            if (filePath.includes('/assets/')) {
                res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            } else {
                res.setHeader('Cache-Control', 'public, max-age=0');
            }
        }
    }));
} else {
    console.error("CRITICAL: No valid build found. Please run 'npm run build'.");
}

app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: "API Endpoint Not Found" });
    }
    
    // Safety check: If we have an indexPath, verify it's not source code before serving
    if (indexPath && isSourceCode(indexPath)) {
        return res.status(500).send(`
            <div style="font-family:sans-serif; text-align:center; padding:50px;">
                <h1>Application Not Built</h1>
                <p>The server detected source code (index.tsx) instead of production code.</p>
                <p>Please run <code>npm run build</code> and ensure the <code>dist/</code> folder is present.</p>
            </div>
        `);
    }

    if (!staticPath || !indexPath) {
        return res.status(500).send('<h1>App Not Built</h1><p>Please run <code>npm run build</code>.</p>');
    }
    
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.sendFile(indexPath);
});

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on ${PORT}`));
