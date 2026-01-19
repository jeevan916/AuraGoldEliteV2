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
            // If the root index is the source file, move it out of the way
            if (content.includes('src="/index.tsx"') || content.includes('src="./index.tsx"')) {
                const backupName = `index.source.html.bak`;
                if (fs.existsSync(path.join(rootDir, backupName))) {
                    fs.unlinkSync(path.join(rootDir, backupName));
                }
                fs.renameSync(rootIndex, path.join(rootDir, backupName));
                console.log(`[System] De-conflicted: Source index.html moved to ${backupName}`);
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
app.use(express.json({ limit: '50mb' }));

// --- API ROUTES ---
app.use('/api', ratesRouter);
app.use('/api', paymentsRouter);
app.use('/api/whatsapp', whatsappRouter);
app.use('/api/sync', syncRouter);
app.use('/api', coreRouter);

// --- STATIC ASSETS & SPA ROUTING ---
const distPath = path.join(process.cwd(), 'dist');

if (fs.existsSync(path.join(distPath, 'index.html'))) {
    // 1. Serve built assets (js, css, images)
    app.use(express.static(distPath, {
        index: false,
        setHeaders: (res, filePath) => {
            if (filePath.endsWith('.html')) {
                res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            } else {
                res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            }
        }
    }));

    // 2. Explicitly handle common aliases
    app.get(['/index', '/home'], (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
    });

    // 3. SPA Fallback: Serve index.html for navigation, 404 for missing assets
    app.get('*', (req, res) => {
        // If the path looks like a file (has a dot) or is an API call, it's a real 404
        if (req.path.includes('.') || req.path.startsWith('/api')) {
            return res.status(404).send('Not Found');
        }
        res.sendFile(path.join(distPath, 'index.html'));
    });
} else {
    app.get('/', (req, res) => res.status(200).send(`
        <div style="font-family: sans-serif; padding: 50px; text-align: center; background: #f8f9fa; min-height: 100vh;">
            <h1 style="color: #B8860B;">AuraGold Elite - Build Required</h1>
            <p>The backend is active but the <b>dist/</b> folder is missing.</p>
            <p>Run <code>npm run build</code> locally and upload the folder to your server.</p>
        </div>
    `));
}

initDb().then((result) => {
    if (result.success) console.log("[Database] Operational.");
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`[Server] Operational on port ${PORT}`);
    });
});