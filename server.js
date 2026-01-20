
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import compression from 'compression';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';

// Shared Libs
import { initDb } from './api/db.js';

// Route Modules
import ratesRouter from './api/rates.js';
import paymentsRouter from './api/payments.js';
import whatsappRouter from './api/whatsapp.js';
import syncRouter from './api/sync.js';
import coreRouter from './api/core.js';
import architectRouter from './api/architect.js';

// Background Services
import { initRateService } from './api/rateService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- ROBUST ENV LOADING ---
const loadEnv = () => {
    const searchPaths = [
        path.resolve(process.cwd(), '.builds/config/.env'),
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
        console.warn("[System] Warning: No .env file found. Relying on system environment variables.");
    }
};
loadEnv();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3000;

// --- SOCKET.IO SETUP ---
const io = new Server(httpServer, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);
    socket.on('disconnect', () => {
        // console.log('[Socket] Client disconnected');
    });
});

app.set('trust proxy', 1); 
app.use(compression());    
app.use(cors());
app.use(express.json({ limit: '100mb' }));

// Middleware to expose 'io' to all routes
app.use((req, res, next) => {
    req.io = io;
    next();
});

// --- API CLUSTERING ---
app.use('/api', ratesRouter);
app.use('/api', paymentsRouter);
app.use('/api/whatsapp', whatsappRouter);
app.use('/api/sync', syncRouter);
app.use('/api', coreRouter);
app.use('/api/architect', architectRouter);

app.use('/api/*', (req, res) => res.status(404).json({ error: `API route ${req.originalUrl} not found.` }));

// --- STATIC SERVING & AUTO-FIX ---

const distIndex = path.join(__dirname, 'dist', 'index.html');
const rootIndex = path.join(__dirname, 'index.html');

if (fs.existsSync(distIndex) && fs.existsSync(rootIndex)) {
    try {
        const content = fs.readFileSync(rootIndex, 'utf-8');
        if (content.includes('src="./index.tsx"') || content.includes('src="/index.tsx"')) {
            console.log("[System] Detected source index.html in root interfering with build.");
            const backupPath = path.join(__dirname, 'index.html.bkp');
            fs.renameSync(rootIndex, backupPath);
            console.log(`[System] Renamed root index.html -> ${backupPath}`);
        }
    } catch (e) {
        console.warn("[System] Failed to auto-rename root index.html", e.message);
    }
}

const getValidDistPath = () => {
    const distFolder = path.join(__dirname, 'dist');
    if (fs.existsSync(path.join(distFolder, 'index.html'))) {
        return distFolder;
    }
    const localIndex = path.join(__dirname, 'index.html');
    if (fs.existsSync(localIndex)) {
        try {
            const content = fs.readFileSync(localIndex, 'utf-8');
            if (!content.includes('src="./index.tsx"') && !content.includes('src="/index.tsx"')) {
                return __dirname;
            }
        } catch (e) {
            console.warn("[System] Error reading local index.html", e);
        }
    }
    return null;
};

let finalDistPath = getValidDistPath();

if (finalDistPath) {
    console.log(`[System] Serving static assets from: ${finalDistPath}`);
    app.use(express.static(finalDistPath));
    app.get('*', (req, res) => {
        if (!req.path.startsWith('/api') && !req.path.startsWith('/socket.io')) {
            res.sendFile(path.join(finalDistPath, 'index.html'));
        }
    });
} else {
    app.get('/', (req, res) => {
        res.status(200).send(`
            <html>
                <head><title>AuraGold Backend</title></head>
                <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                    <h1>Backend Online</h1>
                    <p>API services are operational.</p>
                </body>
            </html>
        `);
    });
}

// Init DB & Start Server
initDb().then((result) => {
    if (result.success) {
        console.log("[Database] Connectivity verified.");
        // Initialize Background Services
        initRateService();
    } else {
        console.error("[Database] Initialization failed:", result.error);
    }
    
    httpServer.listen(PORT, '0.0.0.0', () => {
        console.log(`[Server] Cluster operational on port ${PORT} (HTTP + WebSocket)`);
    });
});
