
import express from 'express';
import path from 'path';
import fs from 'fs';
import { getPool, ensureDb, logDbActivity, isMock, initDb } from './db.js';

const router = express.Router();

router.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

router.get('/debug/db', async (req, res) => {
    const host = process.env.DB_HOST;
    const user = process.env.DB_USER;
    const dbName = process.env.DB_NAME;
    
    let connectionTest = "Not attempted";
    let errorMsg = null;
    
    try {
        const pool = getPool();
        if (pool && !isMock) {
            const conn = await pool.getConnection();
            connectionTest = "Success";
            conn.release();
        } else {
            connectionTest = "Pool is null or running in Mock mode";
            // Try to force a real connection test right now
            if (host) {
                const result = await initDb();
                connectionTest = result.success ? "Success after forced init" : "Failed forced init";
                errorMsg = result.error;
            }
        }
    } catch (e) {
        connectionTest = "Failed";
        errorMsg = e.message;
    }

    res.json({
        config: {
            host: host || "MISSING",
            user: user || "MISSING",
            database: dbName || "MISSING",
            passwordLength: process.env.DB_PASSWORD ? process.env.DB_PASSWORD.length : 0,
            isMockMode: isMock
        },
        status: connectionTest,
        error: errorMsg,
        envKeys: Object.keys(process.env).filter(k => k.startsWith('DB_'))
    });
});

router.get('/debug/paths', (req, res) => {
    const rootDir = process.cwd();
    const distPath = path.join(rootDir, 'dist');
    const publicHtmlPath = path.resolve(rootDir, '../public_html');
    const envPath = path.resolve(rootDir, '../public_html/.builds/config/.env');
    
    res.json({
        success: true,
        message: "Debug paths retrieved",
        rootDir,
        distPath,
        publicHtmlPath,
        envPath,
        envExists: fs.existsSync(envPath),
        envLoaded: !!process.env.DB_HOST,
        env: process.env.NODE_ENV || 'development',
        distExists: fs.existsSync(distPath),
        distIndexExists: fs.existsSync(path.join(distPath, 'index.html')),
        rootIndexExists: fs.existsSync(path.join(rootDir, 'index.html')),
        publicHtmlIndexExists: fs.existsSync(path.join(publicHtmlPath, 'index.html'))
    });
});

// --- SYSTEM LOGS (ERRORS) ---
router.get('/logs/errors', ensureDb, async (req, res) => {
    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        const [rows] = await connection.query('SELECT * FROM system_errors ORDER BY timestamp DESC LIMIT 200');
        connection.release();
        
        const errors = rows.map(row => ({
            id: row.id,
            source: row.source,
            message: row.message,
            stack: row.stack,
            severity: row.severity,
            timestamp: row.timestamp,
            rawContext: row.context,
            status: 'NEW' 
        }));
        
        res.json({ success: true, errors });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

router.post('/logs/error', ensureDb, async (req, res) => {
    try {
        const { id, source, message, stack, severity, timestamp, rawContext } = req.body;
        const pool = getPool();
        const connection = await pool.getConnection();
        await connection.query(
            'INSERT INTO system_errors (id, source, message, stack, severity, timestamp, context) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [id, source, message, stack || '', severity || 'MEDIUM', new Date(timestamp), JSON.stringify(rawContext || {})]
        );
        connection.release();
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// --- NEW: ACTIVITY LOGS ---
router.get('/logs/activities', ensureDb, async (req, res) => {
    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        const [rows] = await connection.query('SELECT * FROM system_activities ORDER BY timestamp DESC LIMIT 300');
        connection.release();
        
        const activities = rows.map(row => ({
            id: row.id,
            actionType: row.action_type,
            details: row.details,
            timestamp: row.timestamp,
            metadata: {
                ...row.metadata,
                ip: row.ip_address,
                location: row.geo_location,
                device: row.device_info
            }
        }));
        res.json({ success: true, activities });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

router.post('/logs/activity', ensureDb, async (req, res) => {
    try {
        const { actionType, details, metadata } = req.body;
        // Pass req to capture IP of the reporter (Client)
        await logDbActivity(actionType, details, metadata, req);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// --- PUBLIC ORDER ACCESS ---
router.get('/public/order/:token', ensureDb, async (req, res) => {
    try {
        const token = req.params.token;
        const pool = getPool();
        const connection = await pool.getConnection();
        
        // Optimized query
        const [rows] = await connection.query('SELECT data FROM orders WHERE share_token = ?', [token]);
        connection.release();
        
        const order = rows.length > 0 ? JSON.parse(rows[0].data) : null;
        
        if (order) {
            // Log this specific access event with enriched metadata
            await logDbActivity('LINK_OPENED', `Customer viewed Order ${order.id}`, { orderId: order.id, customer: order.customerName }, req);
            
            // Sanitize PII
            const sanitizedOrder = {
                id: order.id,
                items: order.items,
                payments: order.payments,
                totalAmount: order.totalAmount,
                discountAmount: order.discountAmount,
                goldRateAtBooking: order.goldRateAtBooking,
                paymentPlan: order.paymentPlan,
                status: order.status,
                createdAt: order.createdAt,
                isRateBreached: order.isRateBreached,
                requiresLiabilityAcceptance: order.requiresLiabilityAcceptance,
                liabilityGapAcceptedAt: order.liabilityGapAcceptedAt
            };
            
            res.json({ success: true, order: sanitizedOrder });
        } else {
            // Log failed access attempt
            await logDbActivity('SECURITY_ALERT', `Invalid Order Link Attempt: ${token}`, { token }, req);
            res.status(404).json({ success: false, error: "Invalid or Expired Order Link" });
        }
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});



router.get('/bootstrap', ensureDb, async (req, res) => {
    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        const [orders] = await connection.query('SELECT data FROM orders');
        const [customers] = await connection.query('SELECT data FROM customers');
        const [logs] = await connection.query('SELECT data FROM whatsapp_logs LIMIT 100');
        const [templates] = await connection.query('SELECT data FROM templates');
        const [catalog] = await connection.query('SELECT data FROM catalog');
        const [intRows] = await connection.query('SELECT * FROM integrations');
        connection.release();
        
        const intMap = {}; 
        intRows.forEach(r => { try { intMap[r.provider] = JSON.parse(r.config); } catch(e){} });
        
        const core = intMap.core_settings || {};
        
        res.json({ success: true, data: {
            orders: orders.map(r => JSON.parse(r.data)),
            customers: customers.map(r => JSON.parse(r.data)),
            logs: logs.map(r => JSON.parse(r.data)),
            templates: templates.map(r => JSON.parse(r.data)),
            catalog: catalog.map(r => JSON.parse(r.data)),
            settings: { 
                currentGoldRate24K: core.currentGoldRate24K || 7500,
                currentGoldRate22K: core.currentGoldRate22K || 6870,
                currentGoldRate18K: core.currentGoldRate18K || 5625,
                currentSilverRate: core.currentSilverRate || 90,
                defaultTaxRate: core.defaultTaxRate || 3,
                goldRateProtectionMax: core.goldRateProtectionMax || 500,
                gracePeriodHours: core.gracePeriodHours || 24,
                followUpIntervalDays: core.followUpIntervalDays || 3,
                goldRateFetchIntervalMinutes: core.goldRateFetchIntervalMinutes || 60,
                whatsappPhoneNumberId: intMap.whatsapp?.phoneId, 
                whatsappBusinessAccountId: intMap.whatsapp?.accountId, 
                whatsappBusinessToken: intMap.whatsapp?.token,
                setuClientId: intMap.setu?.clientId,
                setuSecret: intMap.setu?.secret,
                setuSchemeId: intMap.setu?.schemeId,
                setuMode: intMap.setu?.mode || 'PRODUCTION',
                razorpayKeyId: intMap.razorpay?.keyId,
                razorpayKeySecret: intMap.razorpay?.secret,
                isMockMode: isMock
            }
        }});
    } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
