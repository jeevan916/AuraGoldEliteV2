
import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// --- ROBUST STATIC PATH DETECTION ---
let staticPath = null;
const possibleDist = path.join(__dirname, 'dist');

/**
 * Checks if the index.html at the given path is a Production Build.
 * Returns FALSE if it contains references to .tsx files (Source Code).
 */
const isValidBuild = (dirPath) => {
    const indexPath = path.join(dirPath, 'index.html');
    if (!fs.existsSync(indexPath)) return false;
    
    try {
        const content = fs.readFileSync(indexPath, 'utf8');
        // If HTML references .tsx, it is SOURCE code, not BUILD code.
        if (content.includes('src="./index.tsx"') || content.includes('src="/index.tsx"')) {
            return false;
        }
        return true;
    } catch (e) {
        return false;
    }
};

// 1. Check if we are running inside a valid 'dist' folder (Production)
if (isValidBuild(__dirname)) {
    staticPath = __dirname;
    console.log(`[SERVER] Running inside valid build folder: ${staticPath}`);
} 
// 2. Check if a valid 'dist' folder exists in root
else if (isValidBuild(possibleDist)) {
    staticPath = possibleDist;
    console.log(`[SERVER] Found valid build in dist: ${staticPath}`);
} 
// 3. Auto-Build Recovery
else {
    console.warn(`[SERVER] ⚠️ Valid Build Not Found. Detected Source Code.`);
    console.log(`[SERVER] Starting Auto-Build... (This may take 60s)`);
    try {
        // Attempt build
        execSync('npm run build', { stdio: 'inherit', timeout: 120000 }); // 2 min timeout
        
        // Re-check after build
        if (isValidBuild(possibleDist)) {
            staticPath = possibleDist;
            console.log(`[SERVER] ✅ Auto-build success! Serving: ${staticPath}`);
        } else {
            console.error(`[SERVER] ❌ Auto-build finished but 'dist/index.html' is still missing or invalid.`);
        }
    } catch (e) {
        console.error(`[SERVER] ❌ Auto-build failed:`, e.message);
    }
}

// 4. Serve Static Assets
if (staticPath) {
    // Force JS MIME type
    app.use((req, res, next) => {
        if (req.url.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
        next();
    });
    app.use(express.static(staticPath));
}

// 5. Database Connection
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
        console.log(`[DB] Connected to ${DB_CONFIG.database}`);
        
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
        console.error('[DB] Connection Failed:', err.message);
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

// --- CATCH-ALL FOR SPA ---
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: "API Endpoint Not Found" });
    }

    // Determine correct index.html
    let indexPath = null;
    if (staticPath && fs.existsSync(path.join(staticPath, 'index.html'))) {
        indexPath = path.join(staticPath, 'index.html');
    }

    if (indexPath) {
        res.sendFile(indexPath);
    } else {
        // Fallback Maintenance Page if build failed entirely
        res.status(503).send(`
            <html>
            <head>
                <title>AuraGold - System Building</title>
                <meta http-equiv="refresh" content="10">
                <style>body{font-family:sans-serif;text-align:center;padding:50px;background:#f8fafc;color:#334155;}</style>
            </head>
            <body>
                <h1 style="color:#eab308;">System Optimization in Progress</h1>
                <p>The application is compiling its assets for first-time use.</p>
                <p>This page will automatically refresh in 10 seconds.</p>
                <hr style="max-width:300px;opacity:0.2;margin:30px auto;">
                <small>Server Status: Active | Build: Pending</small>
            </body>
            </html>
        `);
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 AuraGold Server running on port ${PORT}`);
});
