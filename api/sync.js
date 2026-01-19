
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

router.post('/settings', ensureDb, async (req, res) => {
    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        const { settings } = req.body;

        // 1. Persist Core Application Settings
        const coreConfig = {
            currentGoldRate24K: settings.currentGoldRate24K,
            currentGoldRate22K: settings.currentGoldRate22K,
            currentGoldRate18K: settings.currentGoldRate18K,
            defaultTaxRate: settings.defaultTaxRate,
            goldRateProtectionMax: settings.goldRateProtectionMax,
            gracePeriodHours: settings.gracePeriodHours,
            followUpIntervalDays: settings.followUpIntervalDays
        };
        await connection.query("INSERT INTO integrations (provider, config) VALUES (?, ?) ON DUPLICATE KEY UPDATE config=VALUES(config)", ['core_settings', JSON.stringify(coreConfig)]);

        // 2. Persist WhatsApp Credentials
        if (settings.whatsappPhoneNumberId) {
            const waConfig = { 
                phoneId: settings.whatsappPhoneNumberId, 
                accountId: settings.whatsappBusinessAccountId, 
                token: settings.whatsappBusinessToken 
            };
            await connection.query("INSERT INTO integrations (provider, config) VALUES (?, ?) ON DUPLICATE KEY UPDATE config=VALUES(config)", ['whatsapp', JSON.stringify(waConfig)]);
        }

        // 3. Persist Setu Credentials
        if (settings.setuClientId) {
            const setuConfig = { 
                clientId: settings.setuClientId, 
                secret: settings.setuSecret, 
                schemeId: settings.setuSchemeId 
            };
            await connection.query("INSERT INTO integrations (provider, config) VALUES (?, ?) ON DUPLICATE KEY UPDATE config=VALUES(config)", ['setu', JSON.stringify(setuConfig)]);
        }

        // 4. Persist Other Gateways
        if (settings.razorpayKeyId) {
            const rzpConfig = { keyId: settings.razorpayKeyId, secret: settings.razorpayKeySecret };
            await connection.query("INSERT INTO integrations (provider, config) VALUES (?, ?) ON DUPLICATE KEY UPDATE config=VALUES(config)", ['razorpay', JSON.stringify(rzpConfig)]);
        }

        connection.release();
        res.json({ success: true });
    } catch (e) { 
        console.error("[API Settings Sync Error]", e);
        res.status(500).json({ error: e.message }); 
    }
});

export default router;
