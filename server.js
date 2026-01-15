
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

// --- STATIC FILE CONFIGURATION ---
// Critical Fix: Correctly determine if we are in development (root with dist folder) 
// or production (inside the build folder).

let staticPath = __dirname; // Default to current directory (Production/Hostinger behavior)
const potentialDist = path.join(__dirname, 'dist');

// If 'dist' folder exists and has index.html, we are likely at project root (Dev/Local)
// We must serve 'dist', otherwise we mistakenly serve the source index.html which causes MIME errors.
if (fs.existsSync(potentialDist) && fs.existsSync(path.join(potentialDist, 'index.html'))) {
    staticPath = potentialDist;
    console.log(`[SERVER] Detected 'dist' folder. Serving from: ${staticPath}`);
} else {
    console.log(`[SERVER] No 'dist' subdirectory found. Serving from current directory: ${staticPath}`);
}

// 1. Force Content-Type for JS/CSS to prevent strict MIME type checking errors in some environments
app.use((req, res, next) => {
    if (req.url.endsWith('.js') || req.url.endsWith('.mjs')) {
        res.setHeader('Content-Type', 'application/javascript');
    }
    if (req.url.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css');
    }
    next();
});

// 2. Serve Static Assets
app.use(express.static(staticPath));

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
        
        // Ensure state table exists
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

// Initialize DB immediately
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
    // Fallback static rate, usually fetched from external API
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
    // Proxy for WhatsApp/SMS calls to avoid CORS on client
    // For now, mocking success if no credentials provided in env
    res.json({ success: true, messageId: `mock-${Date.now()}` });
});

// --- CATCH-ALL FOR SPA ---
// IMPORTANT: This must be the last route.
// It returns index.html for any route NOT handled above (like /dashboard, /orders).
app.get('*', (req, res) => {
    // If the request looks like a file (has extension) but wasn't handled by express.static, send 404.
    // This prevents "index.html" being sent for "script.js" (MIME error).
    if (req.path.includes('.') && !req.path.includes('.html')) {
        return res.status(404).send('Not Found');
    }
    
    // Explicitly send the correct index.html
    const indexPath = path.join(staticPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('Application Build Not Found. Please run "npm run build".');
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 AuraGold Server running on port ${PORT}`);
});
