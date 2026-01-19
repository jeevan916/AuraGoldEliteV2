
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
        
        // 1. Fetch Orders & Logs
        const [orders] = await connection.query('SELECT data FROM orders');
        const [logs] = await connection.query('SELECT data FROM whatsapp_logs ORDER BY timestamp DESC LIMIT 200');
        const [intRows] = await connection.query('SELECT * FROM integrations');
        
        // 2. PROFESSIONAL DATA AGGREGATION: Backend-side Customer Analysis
        // This replaces the derivedCustomers logic in App.tsx
        const [customersFromDb] = await connection.query('SELECT data FROM customers');
        
        const intMap = {}; 
        intRows.forEach(r => { try { intMap[r.provider] = JSON.parse(r.config); } catch(e){} });
        const core = intMap.core_settings || {};
        
        const parsedOrders = orders.map(r => JSON.parse(r.data));
        const manualCustomers = customersFromDb.map(r => JSON.parse(r.data));

        // Group by 10-digit phone
        const customerMap = new Map();
        
        // Seed with manual profiles
        manualCustomers.forEach(c => {
            const key = c.contact.replace(/\D/g, '').slice(-10);
            if (key) customerMap.set(key, { ...c, totalSpent: 0, orderIds: [] });
        });

        // Enrich with transactional data
        parsedOrders.forEach(o => {
            const key = o.customerContact.replace(/\D/g, '').slice(-10);
            if (!key) return;
            const existing = customerMap.get(key);
            if (existing) {
                if (!existing.orderIds.includes(o.id)) {
                    existing.orderIds.push(o.id);
                    existing.totalSpent += o.totalAmount;
                }
                if (!existing.name) existing.name = o.customerName;
            } else {
                customerMap.set(key, {
                    id: `CUST-${key}`,
                    name: o.customerName,
                    contact: o.customerContact,
                    orderIds: [o.id],
                    totalSpent: o.totalAmount,
                    joinDate: o.createdAt
                });
            }
        });

        const finalCustomers = Array.from(customerMap.values()).sort((a,b) => b.totalSpent - a.totalSpent);
        
        connection.release();
        
        res.json({ success: true, data: {
            orders: parsedOrders,
            customers: finalCustomers,
            logs: logs.map(r => JSON.parse(r.data)),
            settings: { 
                currentGoldRate24K: core.currentGoldRate24K || 7500,
                currentGoldRate22K: core.currentGoldRate22K || 6870,
                currentGoldRate18K: core.currentGoldRate18K || 5625,
                purityFactor22K: core.purityFactor22K || 0.916,
                purityFactor18K: core.purityFactor18K || 0.75,
                defaultTaxRate: core.defaultTaxRate || 3,
                goldRateProtectionMax: core.goldRateProtectionMax || 500,
                gracePeriodHours: core.gracePeriodHours || 24,
                followUpIntervalDays: core.followUpIntervalDays || 3,
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
