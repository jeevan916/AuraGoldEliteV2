
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

// --- ENV LOADING ---
const loadEnv = () => {
    const searchPaths = [
        path.resolve(process.cwd(), '.env'),           
        path.resolve(__dirname, '.env'),               
        path.resolve('/home/public_html/.env')
    ];
    for (const p of searchPaths) {
        if (fs.existsSync(p)) {
            dotenv.config({ path: p });
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
    if (fs.existsSync(rootIndex) && fs.existsSync(distIndex)) {
        try {
            const content = fs.readFileSync(rootIndex, 'utf8');
            if (content.includes('src="./index.tsx"') || content.includes('type="module"')) {
                fs.renameSync(rootIndex, path.join(rootDir, `index.html.bak_${Date.now()}`));
            }
        } catch (e) {}
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
const possibleDistPaths = [path.join(process.cwd(), 'dist'), path.join(__dirname, 'dist'), __dirname];
let finalDistPath = possibleDistPaths.find(p => fs.existsSync(path.join(p, 'index.html')));

if (finalDistPath) {
    app.use(express.static(finalDistPath));
    app.get('*', (req, res) => {
        if (!req.path.startsWith('/api')) res.sendFile(path.join(finalDistPath, 'index.html'));
    });
} else {
    app.get('/', (req, res) => res.status(200).send("<h1>AuraGold Engine Online</h1><p>Run <code>npm run build</code> to see dashboard.</p>"));
}

// Init DB & Start Server
initDb().then(() => {
    app.listen(PORT, '0.0.0.0', () => console.log(`[Server] Cluster operational on port ${PORT}`));
});
