
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
// Rewired to .builds/config/.env as requested
const ENV_PATH = path.join(__dirname, '.builds', 'config', '.env');

// --- SYSTEM DIAGNOSTICS & LOGGING ---
let systemLog = [];
const log = (msg, type = 'INFO') => {
    const entry = `[${new Date().toLocaleTimeString()}] [${type}] ${msg}`;
    console.log(entry);
    systemLog.push(entry);
    if (systemLog.length > 500) systemLog.shift();
};

// Load environment variables immediately from custom path
const envResult = dotenv.config({ path: ENV_PATH });
if (envResult.error) {
    log(`No .env file found at ${ENV_PATH}. Using default/runtime credentials.`, 'WARN');
} else {
    log(`Configuration loaded from ${ENV_PATH}`, 'SUCCESS');
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// --- DATABASE CONFIGURATION ---
let pool = null;

// Dynamic configuration getter
const getConfig = () => ({
    host: process.env.DB_HOST || '127.0.0.1', // Force IPv4
    user: process.env.DB_USER || 'u477692720_jeevan1',
    password: process.env.DB_PASSWORD || 'AuraGold@2025',
    database: process.env.DB_NAME || 'u477692720_AuraGoldElite',
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 10000
});

// Helper to mask password
const maskConfig = (config) => ({
    ...config,
    password: config.password ? '****' : '(none)'
});

async function initDb() {
    const config = getConfig();
    log(`Attempting Database Connection to ${config.host}...`, 'INFO');
    
    // Close existing pool if any
    if (pool) {
        try { await pool.end(); } catch(e) {}
        pool = null;
    }

    try {
        pool = mysql.createPool(config);
        const connection = await pool.getConnection();
        log(`Database Connected Successfully: ${config.database}`, 'SUCCESS');
        
        await connection.query(`
            CREATE TABLE IF NOT EXISTS aura_app_state (
                id INT PRIMARY KEY,
                content LONGTEXT NOT NULL,
                last_updated BIGINT NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        connection.release();
        return { success: true };
    } catch (err) {
        log(`Database Connection Failed: ${err.message}`, 'ERROR');
        return { success: false, error: err.message };
    }
}

// Initial connection attempt
initDb();

const ensureDb = async (req, res, next) => {
    if (!pool) {
        const result = await initDb();
        if (!result.success) {
            return res.status(503).json({ 
                error: "Database unavailable", 
                details: result.error,
                config: maskConfig(getConfig())
            });
        }
    }
    next();
};

// --- BUILD & STATIC FILE SERVING ---
let staticPath = null;
const possibleDist = path.join(__dirname, 'dist');

const isValidBuild = (dirPath) => {
    const indexPath = path.join(dirPath, 'index.html');
    if (!fs.existsSync(indexPath)) return false;
    try {
        const content = fs.readFileSync(indexPath, 'utf8');
        return !content.includes('src="./index.tsx"'); 
    } catch (e) { return false; }
};

if (isValidBuild(__dirname)) {
    staticPath = __dirname;
    log(`Serving pre-built app from root.`);
} else if (isValidBuild(possibleDist)) {
    staticPath = possibleDist;
    log(`Serving pre-built app from /dist.`);
} else {
    log("Valid build not found. Triggering Auto-Build...", 'WARN');
    try {
        if (fs.existsSync(path.join(__dirname, 'node_modules', '.vite'))) {
            fs.rmSync(path.join(__dirname, 'node_modules', '.vite'), { recursive: true, force: true });
        }
        const buildOutput = execSync('npm install && npx vite build', { encoding: 'utf8', stdio: 'pipe' });
        log(buildOutput);
        if (isValidBuild(possibleDist)) staticPath = possibleDist;
    } catch (e) {
        log(`Auto-Build Failed: ${e.message}`, 'CRITICAL');
    }
}

if (staticPath) {
    app.use(express.static(staticPath));
}

// --- API ROUTES ---

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), db: !!pool });
});

app.get('/api/debug/db', async (req, res) => {
    const result = await initDb();
    res.json({
        connected: result.success,
        error: result.error || null,
        config: maskConfig(getConfig()),
        env: {
            DB_HOST: process.env.DB_HOST ? 'Set' : 'Missing',
            DB_USER: process.env.DB_USER ? 'Set' : 'Missing',
            DB_PASS: process.env.DB_PASSWORD ? 'Set' : 'Missing',
            DB_NAME: process.env.DB_NAME ? 'Set' : 'Missing',
            ENV_PATH: ENV_PATH // Show where we are looking
        }
    });
});

// Endpoint to update credentials from UI
app.post('/api/debug/configure', async (req, res) => {
    const { host, user, password, database } = req.body;
    
    // 1. Test the new credentials
    log(`Testing new configuration for user: ${user}`, 'INFO');
    try {
        const tempPool = mysql.createPool({ 
            host: host || '127.0.0.1', 
            user, 
            password, 
            database, 
            connectTimeout: 5000 
        });
        const conn = await tempPool.getConnection();
        await conn.ping();
        conn.release();
        await tempPool.end();
    } catch(e) {
        log(`Configuration test failed: ${e.message}`, 'ERROR');
        return res.status(400).json({ success: false, error: e.message });
    }

    // 2. Write to .env file at the new location
    const envContent = `DB_HOST=${host || '127.0.0.1'}\nDB_USER=${user}\nDB_PASSWORD=${password}\nDB_NAME=${database}\nPORT=${PORT}\n`;
    try {
        // Ensure directory exists
        const envDir = path.dirname(ENV_PATH);
        if (!fs.existsSync(envDir)) {
            fs.mkdirSync(envDir, { recursive: true });
        }
        
        fs.writeFileSync(ENV_PATH, envContent);
        
        // 3. Update runtime process.env
        process.env.DB_HOST = host || '127.0.0.1';
        process.env.DB_USER = user;
        process.env.DB_PASSWORD = password;
        process.env.DB_NAME = database;
        
        // 4. Re-initialize global DB connection
        await initDb();
        
        log(`Configuration updated successfully at ${ENV_PATH}.`, 'SUCCESS');
        res.json({ success: true });
    } catch(e) {
        log(`Failed to save .env to ${ENV_PATH}: ${e.message}`, 'ERROR');
        res.status(500).json({ success: false, error: "Failed to save configuration file." });
    }
});

app.get('/api/gold-rate', (req, res) => {
    res.json({ k24: 7950, k22: 7300, k18: 5980, timestamp: Date.now() });
});

app.get('/api/state', ensureDb, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT content FROM aura_app_state WHERE id = 1');
        if (rows.length > 0) {
            res.json(JSON.parse(rows[0].content));
        } else {
            res.json({ orders: [], logs: [], lastUpdated: 0 });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/state', ensureDb, async (req, res) => {
    try {
        const content = JSON.stringify(req.body);
        const now = Date.now();
        await pool.query(
            'INSERT INTO aura_app_state (id, content, last_updated) VALUES (1, ?, ?) ON DUPLICATE KEY UPDATE content = ?, last_updated = ?',
            [content, now, content, now]
        );
        res.json({ success: true, timestamp: now });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/whatsapp/send', async (req, res) => {
    res.json({ success: true, messageId: `mock-${Date.now()}` });
});

app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: "API Endpoint Not Found" });
    if (staticPath && fs.existsSync(path.join(staticPath, 'index.html'))) {
        res.sendFile(path.join(staticPath, 'index.html'));
    } else {
        res.status(500).send(`<h1>Server Error</h1><p>Application build not found.</p><pre>${systemLog.join('\n')}</pre>`);
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 AuraGold Server running on port ${PORT}`);
});
