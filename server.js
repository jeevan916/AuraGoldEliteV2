
import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// --- SYSTEM DIAGNOSTICS & AUTO-BUILD ---
let staticPath = null;
let systemLog = [];

const log = (msg, type = 'INFO') => {
    const entry = `[${new Date().toLocaleTimeString()}] [${type}] ${msg}`;
    console.log(entry);
    systemLog.push(entry);
};

const runCommand = (command) => {
    log(`Executing: ${command}`);
    try {
        const output = execSync(command, { encoding: 'utf8', stdio: 'pipe', maxBuffer: 1024 * 1024 * 10 });
        log(output);
        return true;
    } catch (e) {
        log(`COMMAND FAILED: ${command}`, 'ERROR');
        log(`Error Message: ${e.message}`, 'ERROR');
        if (e.stdout) log(`STDOUT: ${e.stdout}`, 'ERROR');
        if (e.stderr) log(`STDERR: ${e.stderr}`, 'ERROR');
        return false;
    }
};

const possibleDist = path.join(__dirname, 'dist');

const isValidBuild = (dirPath) => {
    const indexPath = path.join(dirPath, 'index.html');
    if (!fs.existsSync(indexPath)) return false;
    try {
        const content = fs.readFileSync(indexPath, 'utf8');
        return !content.includes('src="./index.tsx"'); 
    } catch (e) { return false; }
};

// --- INITIALIZATION SEQUENCE ---
log("Starting Server Initialization...");

// 1. Clean Vite Cache (Fix for css/postcss ghost errors)
const viteCachePath = path.join(__dirname, 'node_modules', '.vite');
if (fs.existsSync(viteCachePath)) {
    log("Cleaning Vite cache...", 'WARN');
    try {
        fs.rmSync(viteCachePath, { recursive: true, force: true });
    } catch (e) {
        log("Failed to clean Vite cache: " + e.message, 'ERROR');
    }
}

// 2. Dependency Check
const nodeModulesPath = path.join(__dirname, 'node_modules');
if (!fs.existsSync(nodeModulesPath)) {
    log("node_modules not found. Running install...", 'WARN');
    runCommand('npm install --legacy-peer-deps');
}

// 3. Build Logic
if (isValidBuild(__dirname)) {
    staticPath = __dirname;
    log(`Serving pre-built app from root.`);
} else if (isValidBuild(possibleDist)) {
    staticPath = possibleDist;
    log(`Serving pre-built app from /dist.`);
} else {
    log("Valid build not found. Starting Auto-Build...", 'WARN');
    
    // Clear dist if exists to ensure clean build
    if (fs.existsSync(possibleDist)) {
        fs.rmSync(possibleDist, { recursive: true, force: true });
    }

    const buildSuccess = runCommand('npx vite build');
    
    if (buildSuccess && isValidBuild(possibleDist)) {
        staticPath = possibleDist;
        log("Auto-Build Successful!", 'SUCCESS');
    } else {
        log("Auto-Build Failed. Check logs below.", 'CRITICAL');
    }
}

// 4. Asset Config
if (staticPath) {
    app.use((req, res, next) => {
        if (req.url.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript');
        if (req.url.endsWith('.css')) res.setHeader('Content-Type', 'text/css');
        next();
    });
    app.use(express.static(staticPath));
}

// 5. Database Config
let pool = null;
const DB_CONFIG = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'u477692720_jeevan1',
    password: process.env.DB_PASSWORD || 'AuraGold@2025',
    database: process.env.DB_NAME || 'u477692720_AuraGoldElite',
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

async function initDb() {
    try {
        pool = mysql.createPool(DB_CONFIG);
        const connection = await pool.getConnection();
        log(`Database Connected: ${DB_CONFIG.database}`, 'SUCCESS');
        
        await connection.query(`
            CREATE TABLE IF NOT EXISTS aura_app_state (
                id INT PRIMARY KEY,
                content LONGTEXT NOT NULL,
                last_updated BIGINT NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        connection.release();
        return true;
    } catch (err) {
        log(`Database Connection Failed: ${err.message}`, 'ERROR');
        return false;
    }
}

initDb();

const ensureDb = async (req, res, next) => {
    if (!pool) {
        const success = await initDb();
        if (!success) return res.status(503).json({ error: "Database unavailable" });
    }
    next();
};

// --- API ROUTES ---

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), db: !!pool });
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

// --- CATCH-ALL & DIAGNOSTIC PAGE ---
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: "API Endpoint Not Found" });
    }

    if (staticPath && fs.existsSync(path.join(staticPath, 'index.html'))) {
        res.sendFile(path.join(staticPath, 'index.html'));
    } else {
        // SERVE DIAGNOSTIC LOGS
        res.status(500).send(`
            <html>
            <head>
                <title>AuraGold - System Diagnostics</title>
                <style>
                    body { font-family: monospace; background: #0f172a; color: #f8fafc; padding: 20px; }
                    .container { max-width: 900px; margin: 0 auto; }
                    h1 { color: #f59e0b; border-bottom: 1px solid #334155; padding-bottom: 10px; }
                    .log-window { background: #1e293b; padding: 15px; border-radius: 8px; overflow-x: auto; white-space: pre-wrap; border: 1px solid #334155; max-height: 70vh; }
                    .entry { margin-bottom: 5px; border-bottom: 1px solid #334155; padding-bottom: 2px; }
                    .ERROR { color: #ef4444; font-weight: bold; }
                    .SUCCESS { color: #10b981; font-weight: bold; }
                    .WARN { color: #f59e0b; }
                    .INFO { color: #94a3b8; }
                    .refresh { margin-top: 20px; padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; font-size: 16px; }
                    .refresh:hover { background: #1d4ed8; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>⚠️ Application Build Failed</h1>
                    <p>The server attempted to build the application but encountered errors. Please review the logs below.</p>
                    
                    <div class="log-window">
                        ${systemLog.map(l => {
                            const type = l.includes('[ERROR]') || l.includes('CRITICAL') ? 'ERROR' : 
                                         l.includes('[SUCCESS]') ? 'SUCCESS' : 
                                         l.includes('[WARN]') ? 'WARN' : 'INFO';
                            return `<div class="entry ${type}">${l}</div>`;
                        }).join('')}
                    </div>

                    <div style="display: flex; gap: 10px; margin-top: 20px;">
                        <button class="refresh" onclick="window.location.reload()">Retry / Refresh</button>
                        <form action="/api/health" method="GET">
                            <button class="refresh" style="background:#475569">Check API Health</button>
                        </form>
                    </div>
                </div>
            </body>
            </html>
        `);
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 AuraGold Server running on port ${PORT}`);
});
