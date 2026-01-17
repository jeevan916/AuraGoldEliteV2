
import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

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
} else {
    log(`Loaded config from ${ENV_PATH}`, 'SUCCESS');
}

const app = express();
const PORT = process.env.PORT || 3000;

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
    log(`Connecting to MySQL at ${config.host}...`, 'INFO');
    
    if (pool) { try { await pool.end(); } catch(e) {} pool = null; }

    try {
        pool = mysql.createPool(config);
        const connection = await pool.getConnection();
        log(`Database Connected: ${config.database}`, 'SUCCESS');
        
        // --- DATA TABLES INITIALIZATION ---
        const tables = [
            // 1. Gold Rates (History Table)
            `CREATE TABLE IF NOT EXISTS gold_rates (
                id INT AUTO_INCREMENT PRIMARY KEY,
                rate24k DECIMAL(10, 2) NOT NULL,
                rate22k DECIMAL(10, 2) NOT NULL,
                rate18k DECIMAL(10, 2) NOT NULL,
                recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            // 2. Integrations (WhatsApp, Razorpay, etc.)
            `CREATE TABLE IF NOT EXISTS integrations (
                provider VARCHAR(50) PRIMARY KEY, 
                config JSON,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )`,
            // 3. General App Config (Tax, Logic)
            `CREATE TABLE IF NOT EXISTS app_config (
                setting_key VARCHAR(50) PRIMARY KEY,
                setting_value VARCHAR(255)
            )`,
            // 4. Business Data Tables
            `CREATE TABLE IF NOT EXISTS customers (
                id VARCHAR(100) PRIMARY KEY,
                contact VARCHAR(50),
                name VARCHAR(255),
                data LONGTEXT,
                updated_at BIGINT
            )`,
            `CREATE TABLE IF NOT EXISTS orders (
                id VARCHAR(100) PRIMARY KEY,
                customer_contact VARCHAR(50),
                status VARCHAR(50),
                created_at DATETIME,
                data LONGTEXT,
                updated_at BIGINT
            )`,
            `CREATE TABLE IF NOT EXISTS whatsapp_logs (
                id VARCHAR(100) PRIMARY KEY,
                phone VARCHAR(50),
                direction VARCHAR(20),
                timestamp DATETIME,
                data LONGTEXT
            )`,
            `CREATE TABLE IF NOT EXISTS templates (
                id VARCHAR(100) PRIMARY KEY,
                name VARCHAR(255),
                category VARCHAR(50),
                data LONGTEXT
            )`,
            `CREATE TABLE IF NOT EXISTS plan_templates (
                id VARCHAR(100) PRIMARY KEY,
                name VARCHAR(255),
                data LONGTEXT
            )`,
            `CREATE TABLE IF NOT EXISTS catalog (
                id VARCHAR(100) PRIMARY KEY,
                category VARCHAR(100),
                data LONGTEXT
            )`
        ];

        for (const sql of tables) {
            await connection.query(sql);
        }

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
        if (!result.success) {
            return res.status(503).json({ error: "Database unavailable", details: result.error });
        }
    }
    next();
};

// --- EXTERNAL RATE FETCHING ---
async function fetchLiveAugmontRates() {
    try {
        log("Fetching live rates from Augmont UAT...", "INFO");
        // Timeout set to 8 seconds to prevent hanging
        const response = await fetch('https://uat.batuk.in/augmont/gold', {
            signal: AbortSignal.timeout(8000) 
        });
        
        if (!response.ok) throw new Error(`Augmont API responded with ${response.status}`);
        
        const json = await response.json();
        // Augmont Structure: { data: [ [ { gSell: "..." } ] ] }
        const dataNode = json.data?.[0]?.[0];
        
        if (dataNode && dataNode.gSell) {
            const gSell = parseFloat(dataNode.gSell);
            if (!isNaN(gSell)) {
                return {
                    rate24k: gSell,
                    // Standard industry calculation: 22K is 91.66%, 18K is 75%
                    rate22k: Math.round(gSell * (22/24)), 
                    rate18k: Math.round(gSell * (18/24))
                };
            }
        }
        return null;
    } catch (e) {
        log(`Augmont Fetch Failed: ${e.message}`, "ERROR");
        return null;
    }
}

// --- HELPER: Construct Global Settings Object ---
async function getAggregatedSettings(connection) {
    try {
        // 1. Get Latest Gold Rate
        const [rateRows] = await connection.query('SELECT * FROM gold_rates ORDER BY id DESC LIMIT 1');
        const rates = rateRows[0] || { rate24k: 7200, rate22k: 6600, rate18k: 5400 };

        // 2. Get App Config (Key-Value)
        const [configRows] = await connection.query('SELECT * FROM app_config');
        const configMap = {};
        configRows.forEach(row => configMap[row.setting_key] = row.setting_value);

        // 3. Get Integrations
        const [intRows] = await connection.query('SELECT * FROM integrations');
        const intMap = {};
        
        intRows.forEach(row => {
            let conf = row.config;
            // Robust Parsing: Handle double-encoded strings or raw objects
            try {
                while (typeof conf === 'string') {
                    conf = JSON.parse(conf);
                }
            } catch (e) {
                console.error(`Failed to parse config for ${row.provider}`, e);
                conf = {};
            }
            intMap[row.provider] = conf || {};
        });

        // 4. Merge into Frontend Structure
        const mergedSettings = {
            currentGoldRate24K: Number(rates.rate24k),
            currentGoldRate22K: Number(rates.rate22k),
            currentGoldRate18K: Number(rates.rate18k),
            
            defaultTaxRate: Number(configMap['default_tax_rate'] || 3),
            goldRateProtectionMax: Number(configMap['protection_max'] || 500),
            gracePeriodHours: Number(configMap['grace_period_hours'] || 24),
            followUpIntervalDays: Number(configMap['follow_up_days'] || 3),

            // WhatsApp
            whatsappPhoneNumberId: intMap['whatsapp']?.phoneId || '',
            whatsappBusinessAccountId: intMap['whatsapp']?.accountId || '',
            whatsappBusinessToken: intMap['whatsapp']?.token || '',

            // Razorpay
            razorpayKeyId: intMap['razorpay']?.keyId || '',
            razorpayKeySecret: intMap['razorpay']?.keySecret || '',

            // Msg91
            msg91AuthKey: intMap['msg91']?.authKey || '',
            msg91SenderId: intMap['msg91']?.senderId || '',

            // Setu
            setuSchemeId: intMap['setu']?.schemeId || '',
            setuSecret: intMap['setu']?.secret || ''
        };
        
        return mergedSettings;
    } catch (e) {
        log(`Error aggregating settings: ${e.message}`, 'ERROR');
        return null;
    }
}

// --- DATA SYNC API ---

// 1. Bootstrap: Load ALL data
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

        const state = {
            settings: settings || {}, // Ensure not null
            customers: customerRows.map(r => typeof r.data === 'string' ? JSON.parse(r.data) : r.data),
            orders: orderRows.map(r => typeof r.data === 'string' ? JSON.parse(r.data) : r.data),
            logs: logRows.map(r => typeof r.data === 'string' ? JSON.parse(r.data) : r.data),
            templates: templateRows.map(r => typeof r.data === 'string' ? JSON.parse(r.data) : r.data),
            planTemplates: planRows.map(r => typeof r.data === 'string' ? JSON.parse(r.data) : r.data),
            catalog: catalogRows.map(r => typeof r.data === 'string' ? JSON.parse(r.data) : r.data),
            lastUpdated: Date.now()
        };

        res.json({ success: true, data: state });
    } catch (e) {
        log(`Bootstrap Error: ${e.message}`, 'ERROR');
        res.status(500).json({ error: e.message });
    }
});

// 2. Sync Settings (Split into Tables)
app.post('/api/sync/settings', ensureDb, async (req, res) => {
    const { settings } = req.body;
    if (!settings) return res.status(400).json({ error: "No settings provided" });

    try {
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        // A. Insert Gold Rate (Create new history record)
        await connection.query(
            `INSERT INTO gold_rates (rate24k, rate22k, rate18k) VALUES (?, ?, ?)`,
            [settings.currentGoldRate24K, settings.currentGoldRate22K, settings.currentGoldRate18K || 0]
        );

        // B. Update App Config
        const appConfigs = [
            ['default_tax_rate', settings.defaultTaxRate],
            ['protection_max', settings.goldRateProtectionMax],
            ['grace_period_hours', settings.gracePeriodHours],
            ['follow_up_days', settings.followUpIntervalDays]
        ];
        for (const [k, v] of appConfigs) {
            await connection.query(
                `INSERT INTO app_config (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
                [k, v]
            );
        }

        // C. Update Integrations (JSON Configs)
        const integrations = [
            {
                provider: 'whatsapp',
                config: {
                    phoneId: settings.whatsappPhoneNumberId || '',
                    accountId: settings.whatsappBusinessAccountId || '',
                    token: settings.whatsappBusinessToken || ''
                }
            },
            {
                provider: 'razorpay',
                config: {
                    keyId: settings.razorpayKeyId || '',
                    keySecret: settings.razorpayKeySecret || ''
                }
            },
            {
                provider: 'msg91',
                config: {
                    authKey: settings.msg91AuthKey || '',
                    senderId: settings.msg91SenderId || ''
                }
            },
            {
                provider: 'setu',
                config: {
                    schemeId: settings.setuSchemeId || '',
                    secret: settings.setuSecret || ''
                }
            }
        ];

        for (const integ of integrations) {
            await connection.query(
                `INSERT INTO integrations (provider, config) VALUES (?, ?) ON DUPLICATE KEY UPDATE config = VALUES(config)`,
                [integ.provider, JSON.stringify(integ.config)]
            );
        }

        await connection.commit();
        connection.release();
        log('Settings Saved Successfully', 'SUCCESS');
        res.json({ success: true });
    } catch (e) {
        log(`Settings Save Error: ${e.message}`, 'ERROR');
        res.status(500).json({ error: e.message });
    }
});

// --- Other Entity Sync Endpoints ---

app.post('/api/sync/orders', ensureDb, async (req, res) => {
    const { orders } = req.body;
    try {
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        for (const order of orders) {
            await connection.query(
                `INSERT INTO orders (id, customer_contact, status, created_at, data, updated_at) 
                 VALUES (?, ?, ?, ?, ?, ?) 
                 ON DUPLICATE KEY UPDATE status = VALUES(status), data = VALUES(data), updated_at = VALUES(updated_at)`,
                [order.id, order.customerContact, order.status, new Date(order.createdAt), JSON.stringify(order), Date.now()]
            );
        }
        await connection.commit();
        connection.release();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/sync/customers', ensureDb, async (req, res) => {
    const { customers } = req.body;
    try {
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        for (const cust of customers) {
            await connection.query(
                `INSERT INTO customers (id, contact, name, data, updated_at) VALUES (?, ?, ?, ?, ?) 
                 ON DUPLICATE KEY UPDATE name = VALUES(name), data = VALUES(data), updated_at = VALUES(updated_at)`,
                [cust.id, cust.contact, cust.name, JSON.stringify(cust), Date.now()]
            );
        }
        await connection.commit();
        connection.release();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/sync/logs', ensureDb, async (req, res) => {
    const { logs } = req.body;
    try {
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        const latestLogs = logs.slice(0, 50);
        for (const logItem of latestLogs) {
            await connection.query(
                `INSERT INTO whatsapp_logs (id, phone, direction, timestamp, data) VALUES (?, ?, ?, ?, ?) 
                 ON DUPLICATE KEY UPDATE data = VALUES(data)`,
                [logItem.id, logItem.phoneNumber, logItem.direction, new Date(logItem.timestamp), JSON.stringify(logItem)]
            );
        }
        await connection.commit();
        connection.release();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/sync/templates', ensureDb, async (req, res) => {
    const { templates } = req.body;
    try {
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        for (const t of templates) {
            await connection.query(
                `INSERT INTO templates (id, name, category, data) VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE data = VALUES(data), name = VALUES(name), category = VALUES(category)`,
                [t.id, t.name, t.category || 'UTILITY', JSON.stringify(t)]
            );
        }
        await connection.commit();
        connection.release();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/sync/plans', ensureDb, async (req, res) => {
    const { plans } = req.body;
    try {
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        for (const p of plans) {
            await connection.query(
                `INSERT INTO plan_templates (id, name, data) VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE data = VALUES(data), name = VALUES(name)`,
                [p.id, p.name, JSON.stringify(p)]
            );
        }
        await connection.commit();
        connection.release();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/sync/catalog', ensureDb, async (req, res) => {
    const { catalog } = req.body;
    try {
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        for (const c of catalog) {
            await connection.query(
                `INSERT INTO catalog (id, category, data) VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE data = VALUES(data), category = VALUES(category)`,
                [c.id, c.category, JSON.stringify(c)]
            );
        }
        await connection.commit();
        connection.release();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- UTILITY ROUTES ---

// Get Live Gold Rate (From Augmont or Database History)
app.get('/api/gold-rate', ensureDb, async (req, res) => {
    let liveRates = null;
    let externalError = null;

    // 1. Try fetching live from External API (with short timeout)
    try {
        liveRates = await fetchLiveAugmontRates();
    } catch (e) {
        externalError = e;
    }

    try {
        const connection = await pool.getConnection();
        
        if (liveRates) {
            // Save to DB for history if live fetch succeeded
            await connection.query(
                `INSERT INTO gold_rates (rate24k, rate22k, rate18k) VALUES (?, ?, ?)`,
                [liveRates.rate24k, liveRates.rate22k, liveRates.rate18k]
            );
            connection.release();
            
            return res.json({ 
                k24: liveRates.rate24k, 
                k22: liveRates.rate22k, 
                k18: liveRates.rate18k, 
                timestamp: Date.now(), 
                source: 'augmont_live_api' 
            });
        }

        // 2. Fallback to DB if external fetch fails
        const [rows] = await connection.query('SELECT rate24k, rate22k, rate18k FROM gold_rates ORDER BY id DESC LIMIT 1');
        connection.release();

        if (rows.length > 0) {
            res.json({ 
                k24: Number(rows[0].rate24k), 
                k22: Number(rows[0].rate22k), 
                k18: Number(rows[0].rate18k), 
                timestamp: Date.now(), 
                source: 'database_fallback',
                debugError: externalError?.message
            });
        } else {
            // 3. Hard fallback
            res.json({ k24: 7950, k22: 7300, k18: 5980, timestamp: Date.now(), source: 'default_static' });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- META WHATSAPP PROXY ---

async function callMeta(endpoint, method, token, body = null) {
    const url = `https://graph.facebook.com/v21.0/${endpoint}`;
    
    // Sanitize Token: Remove whitespace and accidental 'Bearer' prefix which causes Malformed token error
    const cleanToken = (token || '').toString().trim().replace(/^Bearer\s+/i, '');

    console.log(`[Meta Proxy] ${method} ${url}`);
    
    const options = {
        method,
        headers: {
            'Authorization': `Bearer ${cleanToken}`,
            'Content-Type': 'application/json'
        }
    };
    if (body) options.body = JSON.stringify(body);

    try {
        const response = await fetch(url, options);
        let data;
        
        // Handle non-JSON responses (e.g. empty body or HTML errors)
        const text = await response.text();
        try {
            data = text ? JSON.parse(text) : {};
        } catch (e) {
            console.error(`[Meta Proxy] JSON Parse Error:`, text.substring(0, 200));
            data = { error: { message: "Invalid JSON response from Meta", raw: text } };
        }
        
        if (!response.ok) {
            console.error(`[Meta Proxy Error] ${response.status}:`, JSON.stringify(data));
        }
        
        return { ok: response.ok, status: response.status, data };
    } catch (networkError) {
        console.error(`[Meta Proxy] Network Error:`, networkError);
        return { ok: false, status: 502, data: { error: { message: "Upstream Network Error" } } };
    }
}

// 1. Get Templates (GET)
app.get('/api/whatsapp/templates', async (req, res) => {
    const wabaId = req.headers['x-waba-id'];
    const token = req.headers['x-auth-token'];
    if (!wabaId || !token) return res.status(401).json({ success: false, error: "Missing Credentials" });

    // Fetch templates from Meta (Explicitly request fields to ensure data integrity)
    // Requesting fields: name, status, components (structure), category, language, rejection reason
    const result = await callMeta(
        `${wabaId}/message_templates?limit=100&fields=name,status,components,category,language,rejected_reason`, 
        'GET', 
        token
    );
    
    if (!result.ok) {
        return res.status(result.status).json({ success: false, error: result.data.error?.message || "Meta Error" });
    }
    
    res.json({ success: true, data: result.data.data });
});

// 2. Create Template (POST)
app.post('/api/whatsapp/templates', async (req, res) => {
    const wabaId = req.headers['x-waba-id'];
    const token = req.headers['x-auth-token'];
    if (!wabaId || !token) return res.status(401).json({ success: false, error: "Missing Credentials" });

    const result = await callMeta(`${wabaId}/message_templates`, 'POST', token, req.body);
    
    if (!result.ok) {
        return res.status(result.status).json({ success: false, error: result.data.error?.message || "Creation Failed", data: result.data });
    }

    res.json({ success: true, data: result.data });
});

// 3. Edit Template (POST to ID)
app.post('/api/whatsapp/templates/:id', async (req, res) => {
    const token = req.headers['x-auth-token'];
    if (!token) return res.status(401).json({ success: false, error: "Missing Credentials" });
    
    const result = await callMeta(`${req.params.id}`, 'POST', token, req.body);
    
    if (!result.ok) {
        return res.status(result.status).json({ success: false, error: result.data.error?.message || "Edit Failed", data: result.data });
    }

    res.json({ success: true, data: result.data });
});

// 4. Delete Template (DELETE by Name)
app.delete('/api/whatsapp/templates', async (req, res) => {
    const wabaId = req.headers['x-waba-id'];
    const token = req.headers['x-auth-token'];
    const name = req.query.name;
    if (!wabaId || !token || !name) return res.status(400).json({ success: false, error: "Missing Parameters" });

    const result = await callMeta(`${wabaId}/message_templates?name=${name}`, 'DELETE', token);
    
    if (!result.ok) {
        return res.status(result.status).json({ success: false, error: result.data.error?.message || "Deletion Failed" });
    }

    res.json({ success: true });
});

// 5. Send Message (POST)
app.post('/api/whatsapp/send', async (req, res) => {
    const phoneId = req.headers['x-phone-id'];
    const token = req.headers['x-auth-token'];
    if (!phoneId || !token) return res.status(401).json({ success: false, error: "Missing Credentials" });

    const { to, message, templateName, language, variables } = req.body;
    
    let payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to
    };

    // Determine payload type
    if (templateName) {
        payload.type = "template";
        payload.template = {
            name: templateName,
            language: { code: language || "en_US" }
        };
        // Convert array of string vars to component params
        if (variables && variables.length > 0) {
            payload.template.components = [{
                type: "body",
                parameters: variables.map(v => ({ type: "text", text: v }))
            }];
        }
    } else if (message) {
        payload.type = "text";
        payload.text = { body: message };
    } else {
        return res.status(400).json({ success: false, error: "Invalid payload: provide 'message' or 'templateName'" });
    }

    const result = await callMeta(`${phoneId}/messages`, 'POST', token, payload);
    
    if (!result.ok) {
        return res.status(result.status).json({ success: false, error: result.data.error?.message || "Send Failed", debug: result.data });
    }

    res.json({ success: true, data: result.data });
});

app.post('/api/debug/configure', async (req, res) => {
    res.json({ success: true });
});

// --- SERVE STATIC ---
let staticPath = null;
const possibleDist = path.join(__dirname, 'dist');
const rootDist = __dirname; // Fallback to current directory if files are flat in root

// Check both possible locations for index.html to handle various deployment structures
if (fs.existsSync(path.join(possibleDist, 'index.html'))) {
    staticPath = possibleDist;
} else if (fs.existsSync(path.join(rootDist, 'index.html'))) {
    staticPath = rootDist;
}

if (staticPath) {
    // Explicitly set index to true, though it's default
    app.use(express.static(staticPath, { index: 'index.html' }));
}

// Route to handle root / if not caught by static (e.g. if index: false was set or weird priority)
app.get('/', (req, res) => {
    if (staticPath) res.sendFile(path.join(staticPath, 'index.html'));
    else res.send('AuraGold Backend Running - Frontend Not Found');
});

// Catch-all for SPA
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: "Not Found" });
    if (staticPath) res.sendFile(path.join(staticPath, 'index.html'));
    else res.send('Server Running. Frontend files not found.');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
