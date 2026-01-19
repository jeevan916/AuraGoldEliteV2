
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
// On Hostinger, Apache often serves index.html before Node.js. 
// We must rename the SOURCE index.html to ensure the Node app handles the request.
const resolveIndexConflict = () => {
    const rootDir = process.cwd();
    const rootIndex = path.join(rootDir, 'index.html');
    const distIndex = path.join(rootDir, 'dist', 'index.html');
    
    // If we have a dist/index.html, we are in production.
    if (fs.existsSync(distIndex) && fs.existsSync(rootIndex)) {
        try {
            const content = fs.readFileSync(rootIndex, 'utf8');
            // Only rename if it's the source version (containing index.tsx)
            if (content.includes('src="./index.tsx"')) {
                const backupName = `index.source.html.bak`;
                fs.renameSync(rootIndex, path.join(rootDir, backupName));
                console.log(`[System] Moved source index.html to ${backupName} to prevent production conflicts.`);
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
    // 1. Serve static files from dist
    app.use(express.static(distPath, {
        index: false // Don't serve index.html automatically to control SPA behavior
    }));

    // 2. SPA Fallback: Serve index.html for all non-file, non-API requests
    app.get('*', (req, res) => {
        // Prevent accidental serving of index.html for missing assets (prevents MIME type errors)
        if (req.path.startsWith('/api') || req.path.includes('.')) {
            return res.status(404).send('Not Found');
        }
        res.sendFile(path.join(distPath, 'index.html'));
    });
} else {
    // Fallback if build is missing
    app.get('/', (req, res) => {
        res.status(200).send(`
            <div style="font-family: sans-serif; padding: 50px; text-align: center; background: #f8f9fa; height: 100vh;">
                <h1 style="color: #B8860B;">AuraGold Engine - Build Required</h1>
                <p>The backend is running, but the <b>dist/</b> folder (frontend) is missing.</p>
                <p style="background: #eee; padding: 10px; display: inline-block; border-radius: 5px;">Run <code>npm run build</code> locally and upload the <b>dist</b> folder to your server.</p>
            </div>
        `);
    });
}

initDb().then((result) => {
    if (result.success) console.log("[Database] Connected.");
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`[Server] Cluster operational on port ${PORT}`);
    });
});
