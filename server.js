
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
import authRouter from './api/auth.js';
import { migrateExistingDbImages } from './api/imageStore.js';
import ratesRouter from './api/rates.js';
import paymentsRouter, { startSetuPoller } from './api/payments.js';
import whatsappRouter from './api/whatsapp.js';
import syncRouter from './api/sync.js';
import coreRouter from './api/core.js';
import architectRouter from './api/architect.js';
import aiRouter from './api/ai.js';
import backupsRouter, { initBackupScheduler } from './api/backups.js';

// Background Services
import { initRateService, setRateServiceIo, fetchAndSaveRate, initSocketRates } from './api/rateService.js';
import { runPaymentReminders } from './api/reminderService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const loadEnv = () => {
    const searchPaths = [
        path.resolve(process.cwd(), '.builds/config/.env'),
        path.resolve(process.cwd(), '.env'),
        path.resolve(__dirname, '.builds/config/.env'),
        path.resolve(__dirname, '.env'),
        path.resolve(process.cwd(), '../public_html/.builds/config/.env'),
        path.resolve(__dirname, '../public_html/.builds/config/.env'),
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

process.on('uncaughtException', (err) => {
    console.error('[System] Uncaught Exception:', err?.message || err);
});
process.on('unhandledRejection', (reason) => {
    console.error('[System] Unhandled Rejection:', reason?.message || reason);
});

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3000;

const io = new Server(httpServer, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);
    
    // Client-Side Heartbeat: Allows a browser to force-wake the server
    socket.on('client_heartbeat', async () => {
        console.log(`[Socket] Heartbeat received from ${socket.id}. Refreshing rates...`);
        try {
            await fetchAndSaveRate();
        } catch (e) {
            console.error("[Socket] Heartbeat update failed:", e.message);
        }
    });
});

// Inject IO into services
setRateServiceIo(io);

// Initialize Socket Rates if configured
// if (process.env.EXTERNAL_RATES_URL && process.env.EXTERNAL_RATES_API_KEY) {
//     initSocketRates(process.env.EXTERNAL_RATES_URL, process.env.EXTERNAL_RATES_API_KEY);
// }

app.set('trust proxy', 1); 
app.use(compression());    
app.use(cors());
app.use(express.json({ limit: '100mb', type: ['application/json', 'application/*+json', 'application/vnd.setu*'] }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

app.use((req, res, next) => {
    req.io = io;
    next();
});

// Serve physical uploaded files from the server drive
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use('/uploads', express.static(UPLOADS_DIR));

// Debug Routes (Before other API routes)
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.get('/test-proxy', (req, res) => {
    res.send(`
        <div style="font-family: sans-serif; padding: 2rem;">
            <h1>Proxy is Working</h1>
            <p>Time: ${new Date().toISOString()}</p>
            <p>If you see this, the Node.js server is correctly receiving requests.</p>
            <hr/>
            <p><a href="/api/debug/paths">View Debug Paths</a></p>
        </div>
    `);
});

// Fallback for Setu webhooks configured without /api
app.all(['/setu/notifications', '/setu/webhook'], (req, res, next) => {
    req.url = `/api${req.url}`;
    next();
});

// Fallback for WhatsApp webhooks matching alternative patterns
app.all(['/whatsapp/webhook', '/api/webhooks/whatsapp'], (req, res, next) => {
    req.url = '/api/whatsapp/webhook';
    next();
});

// Routes
app.use('/api', authRouter); // Auth Routes
app.use('/api', ratesRouter);
app.use('/api', paymentsRouter);
app.use('/', paymentsRouter); // Fallback for root level Setu webhooks
app.use('/api/whatsapp', whatsappRouter);
app.use('/api/sync', syncRouter);
app.use('/api', coreRouter);
app.use('/api/architect', architectRouter);
app.use('/api/ai', aiRouter);
app.use('/api', backupsRouter);

app.use('/api', (req, res) => res.status(404).json({ error: `API route ${req.originalUrl} not found.` }));

// Static File Serving Configuration
const getValidDistPath = () => {
    const distPath = path.join(__dirname, 'dist');
    const cwdDistPath = path.join(process.cwd(), 'dist');
    const publicHtmlDistPath = path.resolve(process.cwd(), '../public_html/dist');
    const publicHtmlRootPath = path.resolve(process.cwd(), '../public_html');
    const rootPath = __dirname;
    const cwdPath = process.cwd();

    if (fs.existsSync(path.join(distPath, 'index.html'))) {
        console.log(`[System] Serving production build from: ${distPath}`);
        return distPath;
    }
    
    if (fs.existsSync(path.join(cwdDistPath, 'index.html'))) {
        console.log(`[System] Serving production build from CWD: ${cwdDistPath}`);
        return cwdDistPath;
    }

    if (fs.existsSync(path.join(publicHtmlDistPath, 'index.html'))) {
        console.log(`[System] Serving production build from public_html/dist: ${publicHtmlDistPath}`);
        return publicHtmlDistPath;
    }

    if (fs.existsSync(path.join(publicHtmlRootPath, 'index.html'))) {
        console.log(`[System] Serving production build from public_html root: ${publicHtmlRootPath}`);
        return publicHtmlRootPath;
    }
    
    if (fs.existsSync(path.join(rootPath, 'index.html'))) {
        console.warn(`[System] Warning: 'dist/index.html' not found. Falling back to root: ${rootPath}`);
        return rootPath;
    }

    if (fs.existsSync(path.join(cwdPath, 'index.html'))) {
        console.warn(`[System] Warning: 'dist/index.html' not found. Falling back to CWD root: ${cwdPath}`);
        return cwdPath;
    }

    return null;
};

const finalDistPath = getValidDistPath();
const isDev = (process.env.NODE_ENV === 'development' || (process.env.APPLET_ID && !finalDistPath)) && process.env.NODE_ENV !== 'production';

if (isDev) {
    import('vite').then(async ({ createServer: createViteServer }) => {
        try {
            const vite = await createViteServer({
                server: { middlewareMode: true },
                appType: 'spa',
            });
            app.use(vite.middlewares);
            console.log("[System] Vite middleware integrated for development.");
        } catch (e) {
            console.warn("[System] Vite integration failed, falling back to static serving:", e.message);
            if (finalDistPath) {
                app.use(express.static(finalDistPath));
            }
        }
    }).catch((e) => {
        console.warn("[System] Vite dynamic import skipped or failed:", e.message);
        if (finalDistPath) {
            app.use(express.static(finalDistPath));
        }
    });
} else if (finalDistPath) {
    console.log(`[System] Static serving enabled for: ${finalDistPath}`);
    app.use(express.static(finalDistPath));
    
    // Explicit Root Route
    app.get('/', (req, res) => {
        const indexPath = path.join(finalDistPath, 'index.html');
        console.log(`[System] Root request received. Serving: ${indexPath}`);
        
        if (fs.existsSync(indexPath)) {
            res.sendFile(indexPath);
        } else {
            console.error(`[System] Root Index Not Found at: ${indexPath}`);
            res.status(404).send(`
                <div style="font-family: sans-serif; padding: 2rem; text-align: center;">
                    <h1>AuraGold Elite - Deployment Status</h1>
                    <p>The server is running, but the application files (dist/index.html) were not found.</p>
                    <p>Path checked: <code>${indexPath}</code></p>
                    <hr/>
                    <p><strong>Auto-Deployment Tip:</strong> Ensure 'npm run build' has completed successfully on the server.</p>
                </div>
            `);
        }
    });

    // SPA Fallback
    app.get(/.*/, (req, res, next) => {
        // Skip API and Socket.io routes
        if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
            return next();
        }
        
        const indexPath = path.join(finalDistPath, 'index.html');
        if (fs.existsSync(indexPath)) {
            res.sendFile(indexPath);
        } else {
            res.status(404).send("Application Index Not Found. Please run 'npm run build'.");
        }
    });
} else {
    console.error("[System] Critical Error: No index.html found in 'dist' or root. Static serving disabled.");
    
    app.get('/', (req, res) => {
        res.status(200).send(`
            <div style="font-family: sans-serif; padding: 2rem; text-align: center;">
                <h1>AuraGold Elite - Server Running</h1>
                <p>The backend is operational, but the frontend build (dist/index.html) is missing.</p>
            </div>
        `);
    });
}

initDb().then(async (result) => {
    if (result.success) {
        initRateService();
        runPaymentReminders();
        setInterval(runPaymentReminders, 24 * 60 * 60 * 1000);
        startSetuPoller(io);
        initBackupScheduler();
        
        // Asynchronously run DB image analysis and migration
        migrateExistingDbImages().catch(err => {
            console.error("[System] Startup image migration failed:", err.message);
        });
    } else {
        console.error(`[System] Database initialization failed: ${result.error}`);
    }
});

const isSocketPath = typeof PORT === 'string' && (PORT.startsWith('/') || PORT.startsWith('\\\\') || isNaN(Number(PORT)));

httpServer.on('error', (err) => {
    console.error('[Server Error]', err?.message || err);
    if (err?.code === 'EADDRINUSE') {
        if (isSocketPath) {
            console.warn(`[Server] Socket ${PORT} is in use. Unlinking stale socket...`);
            try {
                if (fs.existsSync(PORT)) {
                    fs.unlinkSync(PORT);
                }
                httpServer.listen(PORT);
            } catch (unlinkErr) {
                console.error(`[Server] Failed to unlink socket ${PORT}:`, unlinkErr?.message);
            }
        } else {
            console.error(`[Server] Port ${PORT} is already in use.`);
        }
    }
});

if (isSocketPath) {
    httpServer.listen(PORT, () => {
        console.log(`[Server] Operational on socket: ${PORT}`);
        console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
    });
} else {
    const numericPort = Number(PORT);
    httpServer.listen(numericPort, '0.0.0.0', () => {
        console.log(`[Server] Operational on port ${numericPort}`);
        console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
    });
}
