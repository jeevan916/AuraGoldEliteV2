
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
    // Priority search for .env files based on Hostinger and standard deployments
    const searchPaths = [
        path.resolve(process.cwd(), '.builds/config/.env'), // User specified path
        path.resolve(process.cwd(), '.env'),
        path.resolve(__dirname, '.builds/config/.env'),
        path.resolve(__dirname, '.env'),
        '/home/public_html/.builds/config/.env',
        '/home/public_html/.env',
        path.join(process.cwd(), '..', '.builds/config/.env')
    ];

    let loaded = false;
    for (const p of searchPaths) {
        if (fs.existsSync(p)) {
            dotenv.config({ path: p });
            console.log(`[System] Configuration loaded from: ${p}`);
            loaded = true;
            break;
        }
    }
    
    if (!loaded) {
        console.warn("[System] Warning: No .env file found in expected locations. Relying on system-level environment variables.");
    }
};
loadEnv();

// --- CONFLICT RESOLUTION ---
// Hostinger specific: Ensures root index.html doesn't block the Node process
const resolveIndexConflict = () => {
    const rootDir = process.cwd();
    const rootIndex = path.join(rootDir, 'index.html');
    const distIndex = path.join(rootDir, 'dist', 'index.html');
    
    if (fs.existsSync(rootIndex) && fs.existsSync(distIndex)) {
        try {
            const content = fs.readFileSync(rootIndex, 'utf8');
            if (content.includes('src="./index.tsx"') || content.includes('type="module"')) {
                const timestamp = Date.now();
                const backupName = `index.html.source_backup_${timestamp}`;
                fs.renameSync(rootIndex, path.join(rootDir, backupName));
                console.log(`[System] Resolved routing conflict: Renamed root source file to ${backupName}`);
            }
        } catch (e) {
            console.error("[System] Conflict resolution failed:", e.message);
        }
    }
};
resolveIndexConflict();

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1); 
app.use(compression());    
app.use(cors());
app.use(express.json({ limit: '100mb' }));

// --- API CLUSTERING ---
app.use('/api', ratesRouter);
app.use('/api', paymentsRouter);
app.use('/api/whatsapp', whatsappRouter);
app.use('/api/sync', syncRouter);
app.use('/api', coreRouter);

// JSON 404 for unmatched API routes
app.use('/api/*', (req, res) => res.status(404).json({ error: `API route ${req.originalUrl} not found.` }));

// --- STATIC SERVING ---
const possibleDistPaths = [
    path.join(process.cwd(), 'dist'),
    path.join(__dirname, 'dist'),
    __dirname 
];

let finalDistPath = possibleDistPaths.find(p => fs.existsSync(path.join(p, 'index.html')));

if (finalDistPath) {
    console.log(`[System] Serving static assets from: ${finalDistPath}`);
    app.use(express.static(finalDistPath));
    app.get('*', (req, res) => {
        if (!req.path.startsWith('/api')) {
            res.sendFile(path.join(finalDistPath, 'index.html'));
        }
    });
} else {
    app.get('/', (req, res) => res.status(200).send(`
        <div style="font-family: sans-serif; padding: 40px; text-align: center;">
            <h1 style="color: #B8860B;">AuraGold Engine Online</h1>
            <p>The backend is running, but the frontend build (dist/) was not found.</p>
            <p>Please run <code>npm run build</code> and ensure the dist folder is uploaded.</p>
        </div>
    `));
}

// Init DB & Start Server
initDb().then((result) => {
    if (result.success) {
        console.log("[Database] Connectivity verified.");
    } else {
        console.error("[Database] Initialization failed:", result.error);
    }
    
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`[Server] Cluster operational on port ${PORT}`);
    });
});
