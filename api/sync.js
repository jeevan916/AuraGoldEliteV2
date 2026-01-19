import express from 'express';
import { getPool, ensureDb } from './db.js';

const router = express.Router();

router.post('/orders', ensureDb, async (req, res) => {
    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        for (const order of req.body.orders) {
            await connection.query('INSERT INTO orders (id, customer_contact, status, created_at, data, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status=VALUES(status), data=VALUES(data), updated_at=VALUES(updated_at)', [order.id, order.customerContact, order.status, new Date(order.createdAt), JSON.stringify(order), Date.now()]);
        }
        connection.release();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/customers', ensureDb, async (req, res) => {
    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        for (const cust of req.body.customers) {
            await connection.query('INSERT INTO customers (id, contact, name, data, updated_at) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), data=VALUES(data), updated_at=VALUES(updated_at)', [cust.id, cust.contact, cust.name, JSON.stringify(cust), Date.now()]);
        }
        connection.release();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/templates', ensureDb, async (req, res) => {
    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        for (const tpl of req.body.templates) {
            await connection.query('INSERT INTO templates (id, name, category, data) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), category=VALUES(category), data=VALUES(data)', [tpl.id, tpl.name, tpl.category || 'UTILITY', JSON.stringify(tpl)]);
        }
        connection.release();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// NEW: Persistence for Catalog Items
router.post('/catalog', ensureDb, async (req, res) => {
    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        // Clear and reload catalog for consistency
        await connection.query('DELETE FROM catalog'); 
        for (const item of req.body.catalog) {
            await connection.query('INSERT INTO catalog (id, category, data) VALUES (?, ?, ?)', [item.id, item.category, JSON.stringify(item)]);
        }
        connection.release();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// NEW: Persistence for Plan Templates
router.post('/plan-templates', ensureDb, async (req, res) => {
    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        await connection.query('DELETE FROM plan_templates');
        for (const plan of req.body.planTemplates) {
            await connection.query('INSERT INTO plan_templates (id, name, data) VALUES (?, ?, ?)', [plan.id, plan.name, JSON.stringify(plan)]);
        }
        connection.release();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/settings', ensureDb, async (req, res) => {
    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        const { settings } = req.body;

        const coreConfig = {
            currentGoldRate24K: settings.currentGoldRate24K,
            currentGoldRate22K: settings.currentGoldRate22K,
            currentGoldRate18K: settings.currentGoldRate18K,
            purityFactor22K: settings.purityFactor22K,
            purityFactor18K: settings.purityFactor18K,
            defaultTaxRate: settings.defaultTaxRate,
            goldRateProtectionMax: settings.goldRateProtectionMax,
            gracePeriodHours: settings.gracePeriodHours,
            followUpIntervalDays: settings.followUpIntervalDays
        };
        await connection.query("INSERT INTO integrations (provider, config) VALUES (?, ?) ON DUPLICATE KEY UPDATE config=VALUES(config)", ['core_settings', JSON.stringify(coreConfig)]);

        if (settings.whatsappPhoneNumberId) {
            const waConfig = { phoneId: settings.whatsappPhoneNumberId, accountId: settings.whatsappBusinessAccountId, token: settings.whatsappBusinessToken };
            await connection.query("INSERT INTO integrations (provider, config) VALUES (?, ?) ON DUPLICATE KEY UPDATE config=VALUES(config)", ['whatsapp', JSON.stringify(waConfig)]);
        }

        if (settings.setuClientId) {
            const setuConfig = { clientId: settings.setuClientId, secret: settings.setuSecret, schemeId: settings.setuSchemeId };
            await connection.query("INSERT INTO integrations (provider, config) VALUES (?, ?) ON DUPLICATE KEY UPDATE config=VALUES(config)", ['setu', JSON.stringify(setuConfig)]);
        }

        if (settings.razorpayKeyId) {
            const rzpConfig = { keyId: settings.razorpayKeyId, secret: settings.razorpayKeySecret };
            await connection.query("INSERT INTO integrations (provider, config) VALUES (?, ?) ON DUPLICATE KEY UPDATE config=VALUES(config)", ['razorpay', JSON.stringify(rzpConfig)]);
        }

        connection.release();
        res.json({ success: true });
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    }
});

export default router;