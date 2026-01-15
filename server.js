
import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

// Load environment variables immediately
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// --- SYSTEM DIAGNOSTICS & LOGGING ---
let systemLog = [];
const log = (msg, type = 'INFO') => {
    const entry = `[${new Date().toLocaleTimeString()}] [${type}] ${msg}`;
    console.log(entry);
    systemLog.push(entry);
    // Keep log size manageable
    if (systemLog.length > 500) systemLog.shift();
};

// --- DATABASE CONFIGURATION ---
let pool = null;

// Helper to mask password in logs
const maskConfig = (config) => ({
    ...config,
    password: config.password ? '****' : '(none)'
});

const DB_CONFIG = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'u477692720_jeevan1',
    password: process.env.DB_PASSWORD || 'AuraGold@2025',
    database: process.env.DB_NAME || 'u477692720_AuraGoldElite',
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 10000 // 10s timeout
};

async function initDb() {
    log(`Attempting Database Connection to ${DB_CONFIG.host}...`, 'INFO');
    try {
        pool = mysql.createPool(DB_CONFIG);
        const connection = await pool.getConnection();
        log(`Database Connected Successfully: ${DB_CONFIG.database}`, 'SUCCESS');
        
        // Ensure table exists
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
        // If pool was created but connection failed, end it to prevent leaks
        if (pool) {
            try { await pool.end(); } catch(e) {}
            pool = null;
        }
        return { success: false, error: err.message };
    }
}

// Initial connection attempt
initDb();

// Middleware to ensure DB is connected or try reconnecting
const ensureDb = async (req, res, next) => {
    if (!pool) {
        const result = await initDb();
        if (!result.success) {
            return res.status(503).json({ 
                error: "Database unavailable", 
                details: result.error,
                config: maskConfig(DB_CONFIG) // Send masked config for debugging
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
        // Basic check to see if it's a built file (usually has hashed filenames in scripts) or the raw source
        // If it contains src="./index.tsx", it's likely the source file, not built.
        return !content.includes('src="./index.tsx"'); 
    } catch (e) { return false; }
};

// Auto-Build Logic
if (isValidBuild(__dirname)) {
    staticPath = __dirname;
    log(`Serving pre-built app from root.`);
} else if (isValidBuild(possibleDist)) {
    staticPath = possibleDist;
    log(`Serving pre-built app from /dist.`);
} else {
    log("Valid build not found. Triggering Auto-Build...", 'WARN');
    try {
        // Clean previous failed builds
        if (fs.existsSync(path.join(__dirname, 'node_modules', '.vite'))) {
            fs.rmSync(path.join(__dirname, 'node_modules', '.vite'), { recursive: true, force: true });
        }
        
        const buildOutput = execSync('npm install && npx vite build', { encoding: 'utf8', stdio: 'pipe' });
        log(buildOutput);
        
        if (isValidBuild(possibleDist)) {
            staticPath = possibleDist;
            log("Auto-Build Successful!", 'SUCCESS');
        } else {
            log("Auto-Build finished but valid index.html not found.", 'ERROR');
        }
    } catch (e) {
        log(`Auto-Build Failed: ${e.message}`, 'CRITICAL');
        if (e.stdout) log(e.stdout);
        if (e.stderr) log(e.stderr);
    }
}

if (staticPath) {
    app.use(express.static(staticPath));
}

// --- API ROUTES ---

// Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), db: !!pool });
});

// Detailed Database Diagnostic Endpoint
app.get('/api/debug/db', async (req, res) => {
    const result = await initDb();
    res.json({
        connected: result.success,
        error: result.error || null,
        config: maskConfig(DB_CONFIG),
        env: {
            DB_HOST: process.env.DB_HOST ? 'Set' : 'Missing',
            DB_USER: process.env.DB_USER ? 'Set' : 'Missing',
            DB_PASS: process.env.DB_PASSWORD ? 'Set' : 'Missing',
            DB_NAME: process.env.DB_NAME ? 'Set' : 'Missing'
        }
    });
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

// Catch-all handler
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: "API Endpoint Not Found" });
    }
    
    if (staticPath && fs.existsSync(path.join(staticPath, 'index.html'))) {
        res.sendFile(path.join(staticPath, 'index.html'));
    } else {
        res.status(500).send(`<h1>Server Error</h1><p>Application build not found. Check server logs.</p><pre>${systemLog.join('\n')}</pre>`);
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 AuraGold Server running on port ${PORT}`);
});
