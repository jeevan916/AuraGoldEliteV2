
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
        if (!req.path.startsWith('/api') && !req.path.startsWith('/socket.io')) {
            res.sendFile(path.join(finalDistPath, 'index.html'));
        }
    });
} else {
    app.get('/', (req, res) => res.status(200).send('Backend Online. Frontend dist not found.'));
}

// Init DB & Start Server
initDb().then((result) => {
    if (result.success) {
        console.log("[Database] Connectivity verified.");
    } else {
        console.error("[Database] Initialization failed:", result.error);
    }
    
    // Use httpServer.listen instead of app.listen to support WebSockets
    httpServer.listen(PORT, '0.0.0.0', () => {
        console.log(`[Server] Cluster operational on port ${PORT} (HTTP + WebSocket)`);
    });
});
