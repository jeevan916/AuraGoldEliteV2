
import express from 'express';
import { getPool, ensureDb } from './db.js';

const router = express.Router();

router.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// --- NEW: FETCH ERROR LOGS ---
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
            status: 'NEW' // Default status for viewing
        }));
        
        res.json({ success: true, errors });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// --- NEW: SAVE ERROR LOG ---
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
        console.error("Failed to write error log to DB:", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// --- NEW PUBLIC ENDPOINT ---
router.get('/public/order/:token', ensureDb, async (req, res) => {
    try {
        const token = req.params.token;
        if (!token) return res.status(400).json({ success: false, error: "Token required" });

        const pool = getPool();
        const connection = await pool.getConnection();
        
        // Fetch raw data (Optimization: In production, add a generated column for shareToken to index it)
        const [rows] = await connection.query('SELECT data FROM orders');
        connection.release();
        
        // Find matching order in JS (Safe for <10k active orders)
        const order = rows.map(r => JSON.parse(r.data)).find(o => o.shareToken === token);
        
        if (order) {
            // Security: Strip internal notes or cost prices if necessary before sending
            res.json({ success: true, order });
        } else {
            res.status(404).json({ success: false, error: "Invalid or Expired Order Link" });
        }
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

router.get('/debug/db', async (req, res) => {
    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        await connection.query('SELECT 1');
        connection.release();
        res.json({ success: true, config: { host: process.env.DB_HOST, database: process.env.DB_NAME } });
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
                // Core Values
                currentGoldRate24K: core.currentGoldRate24K || 7500,
                currentGoldRate22K: core.currentGoldRate22K || 6870,
                currentGoldRate18K: core.currentGoldRate18K || 5625,
                currentSilverRate: core.currentSilverRate || 90,
                defaultTaxRate: core.defaultTaxRate || 3,
                goldRateProtectionMax: core.goldRateProtectionMax || 500,
                gracePeriodHours: core.gracePeriodHours || 24,
                followUpIntervalDays: core.followUpIntervalDays || 3,
                goldRateFetchIntervalMinutes: core.goldRateFetchIntervalMinutes || 60,
                
                // Integration Mappings
                whatsappPhoneNumberId: intMap.whatsapp?.phoneId, 
                whatsappBusinessAccountId: intMap.whatsapp?.accountId, 
                whatsappBusinessToken: intMap.whatsapp?.token,
                setuClientId: intMap.setu?.clientId,
                setuSecret: intMap.setu?.secret,
                setuSchemeId: intMap.setu?.schemeId,
                razorpayKeyId: intMap.razorpay?.keyId,
                razorpayKeySecret: intMap.razorpay?.secret
            }
        }});
    } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
