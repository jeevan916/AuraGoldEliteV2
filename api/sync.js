
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
        if (settings.whatsappPhoneNumberId) {
            await connection.query("INSERT INTO integrations (provider, config) VALUES (?, ?) ON DUPLICATE KEY UPDATE config=VALUES(config)", ['whatsapp', JSON.stringify({ phoneId: settings.whatsappPhoneNumberId, accountId: settings.whatsappBusinessAccountId, token: settings.whatsappBusinessToken })]);
        }
        if (settings.setuClientId) {
            await connection.query("INSERT INTO integrations (provider, config) VALUES (?, ?) ON DUPLICATE KEY UPDATE config=VALUES(config)", ['setu', JSON.stringify({ clientId: settings.setuClientId, secret: settings.setuSecret, schemeId: settings.setuSchemeId })]);
        }
        connection.release();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
