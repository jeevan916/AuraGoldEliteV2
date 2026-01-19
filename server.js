import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import compression from 'compression';
import { fileURLToPath } from 'url';

// Shared Libs
import { initDb } from './api/db.js';

// Route Modules
import ratesRouter from './api/rates.js';
import paymentsRouter from './api/payments.js';
import whatsappRouter from './api/whatsapp.js';
import syncRouter from './api/sync.js';
import coreRouter from './api/core.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- ROBUST ENV LOADING ---
const loadEnv = () => {
    const searchPaths = [
        path.resolve(process.cwd(), '.env'),
        path.resolve(__dirname, '.env'),
        '/home/public_html/.env'
    ];

    for (const p of searchPaths) {
        if (fs.existsSync(p)) {
            dotenv.config({ path: p });
            console.log(`[System] Configuration loaded from: ${p}`);
            break;
        }
    }
};
loadEnv();

// --- CONFLICT RESOLUTION ---
const resolveIndexConflict = () => {
    const rootDir = process.cwd();
    const rootIndex = path.join(rootDir, 'index.html');
    const distIndex = path.join(rootDir, 'dist', 'index.html');
    
    if (fs.existsSync(distIndex) && fs.existsSync(rootIndex)) {
        try {
            const content = fs.readFileSync(rootIndex, 'utf8');
            if (content.includes('src="/index.tsx"') || content.includes('src="./index.tsx"')) {
                const backupName = `index.source.html.bak`;
                fs.renameSync(rootIndex, path.join(rootDir, backupName));
                console.log(`[System] Moved source index.html to ${backupName} to ensure the built version is served.`);
            }
        } catch (e) {
            console.error("[System] Conflict resolution failed:", e.message);
        }
    }
};
resolveIndexConflict();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(compression());    
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// --- API ROUTES ---
app.use('/api', ratesRouter);
app.use('/api', paymentsRouter);
app.use('/api/whatsapp', whatsappRouter);
app.use('/api/sync', syncRouter);
app.use('/api', coreRouter);

// --- STATIC ASSETS & SPA ROUTING ---
const distPath = path.join(process.cwd(), 'dist');

if (fs.existsSync(path.join(distPath, 'index.html'))) {
    // 1. Serve static files from dist folder
    // This handles all assets (CSS, JS images)
    app.use(express.static(distPath, {
        index: false // Disable default index serving to handle it via SPA route
    }));

    // 2. Handle specific common path aliases like /index
    app.get(['/index', '/home'], (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
    });

    // 3. SPA Fallback: Serve index.html for all other non-file requests
    app.get('*', (req, res) => {
        // If it looks like a file (has an extension) or an API call, return 404
        if (req.path.includes('.') || req.path.startsWith('/api')) {
            return res.status(404).send('Not Found');
        }
        res.sendFile(path.join(distPath, 'index.html'));
    });
} else {
    // Emergency fallback if dist is missing
    app.get('/', (req, res) => {
        res.status(200).send(`
            <div style="font-family: sans-serif; padding: 50px; text-align: center; background: #f8f9fa; height: 100vh;">
                <h1 style="color: #B8860B;">AuraGold Engine - Build Required</h1>
                <p>The system is running but the <b>dist/</b> directory is missing.</p>
                <p>Please run <code>npm run build</code> locally and upload the folder.</p>
            </div>
        `);
    });
}

initDb().then((result) => {
    if (result.success) console.log("[Database] Connected.");
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`[Server] Operational on port ${PORT}`);
    });
});