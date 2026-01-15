
import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// --- SMART STATIC PATH DETECTION ---
// The server needs to find the 'dist' folder.
// Scenario A: Running in Project Root (Dev/VPS) -> dist/ exists.
// Scenario B: Running inside Dist (Deployment) -> current dir is dist.

let staticPath = null;
const possibleDist = path.join(__dirname, 'dist');
const hasViteConfig = fs.existsSync(path.join(__dirname, 'vite.config.ts'));

if (fs.existsSync(possibleDist) && fs.existsSync(path.join(possibleDist, 'index.html'))) {
    // Scenario A: We are at root, and dist exists.
    staticPath = possibleDist;
    console.log(`[SERVER] Linked to build folder: ${staticPath}`);
} else if (!hasViteConfig && fs.existsSync(path.join(__dirname, 'index.html'))) {
    // Scenario B: We are likely inside the dist folder already (and not in source root).
    staticPath = __dirname;
    console.log(`[SERVER] Running inside build folder: ${staticPath}`);
} else {
    // Scenario C: We are in source root, but no build exists.
    console.warn(`[SERVER] WARNING: No production build found.`);
}

// 1. Force Content-Type for JS/CSS
// This fixes the "MIME type" errors if a 404 is returned as text/html
app.use((req, res, next) => {
    if (req.url.endsWith('.js') || req.url.endsWith('.mjs')) {
        res.setHeader('Content-Type', 'application/javascript');
    }
    if (req.url.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css');
    }
    next();
});

// 2. Serve Static Assets (Only if we found a valid path)
if (staticPath) {
    app.use(express.static(staticPath));
}

// 3. Database Connection
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

// --- CATCH-ALL ---
app.get('*', (req, res) => {
    // API 404
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: "API Endpoint Not Found" });
    }

    // Asset 404 (Prevent serving HTML for missing JS)
    if (req.path.includes('.') && !req.path.endsWith('.html')) {
        return res.status(404).send('Not Found');
    }

    // Serve Index HTML
    if (staticPath && fs.existsSync(path.join(staticPath, 'index.html'))) {
        res.sendFile(path.join(staticPath, 'index.html'));
    } else {
        // Critical Error Page if build is missing
        res.status(500).send(`
            <html>
            <head><title>AuraGold - Build Missing</title></head>
            <body style="font-family:sans-serif; text-align:center; padding:50px; background:#f8fafc; color:#334155;">
                <h1 style="color:#ef4444;">Application Not Built</h1>
                <p>The server is running, but the frontend application build could not be found.</p>
                <div style="background:#e2e8f0; padding:20px; border-radius:10px; display:inline-block; text-align:left;">
                    <strong>Solution:</strong><br/>
                    1. Run <code>npm run build</code> in your console.<br/>
                    2. Ensure the <code>dist</code> folder is created.<br/>
                    3. Restart the Node.js server.
                </div>
            </body>
            </html>
        `);
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 AuraGold Server running on port ${PORT}`);
});
