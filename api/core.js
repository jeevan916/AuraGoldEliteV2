
import express from 'express';
import { getPool, ensureDb } from './db.js';

const router = express.Router();

router.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

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
        const [intRows] = await connection.query('SELECT * FROM integrations');
        connection.release();
        const intMap = {}; 
        intRows.forEach(r => { try { intMap[r.provider] = JSON.parse(r.config); } catch(e){} });
        res.json({ success: true, data: {
            orders: orders.map(r => JSON.parse(r.data)),
            customers: customers.map(r => JSON.parse(r.data)),
            logs: logs.map(r => JSON.parse(r.data)),
            settings: { 
                whatsappPhoneNumberId: intMap.whatsapp?.phoneId, 
                whatsappBusinessAccountId: intMap.whatsapp?.accountId, 
                whatsappBusinessToken: intMap.whatsapp?.token,
                setuClientId: intMap.setu?.clientId,
                setuSecret: intMap.setu?.secret,
                setuSchemeId: intMap.setu?.schemeId
            }
        }});
    } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
