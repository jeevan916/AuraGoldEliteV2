
import express from 'express';
import { getPool, ensureDb } from './db.js';

const router = express.Router();

// Setu Payment Proxy
router.post('/setu/create-link', ensureDb, async (req, res) => {
    const { amount, billerBillID, customerID, name, orderId } = req.body;
    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        const [rows] = await connection.query("SELECT config FROM integrations WHERE provider = 'setu'");
        connection.release();
        if (rows.length === 0) throw new Error("Setu not configured.");
        const config = rows[0].config;
        const authRes = await fetch('https://bridge.setu.co/auth/v2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientId: config.clientId, clientSecret: config.secret })
        });
        const authData = await authRes.json();
        if (!authRes.ok) throw new Error(authData.message || "Auth failed");
        const linkRes = await fetch('https://bridge.setu.co/api/v2/payment-links', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authData.data.token}`, 'Content-Type': 'application/json', 'X-Setu-Product-Instance-ID': config.schemeId },
            body: JSON.stringify({ amount: { value: Math.round(amount * 100), currencyCode: "INR" }, billerBillID, customer: { mobileNumber: customerID, name }, transactionNote: `Payment for Order ${orderId}` })
        });
        const linkData = await linkRes.json();
        res.status(linkRes.status).json({ success: linkRes.ok, data: linkData });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Razorpay Proxy
router.post('/razorpay/create-order', ensureDb, async (req, res) => {
    const { amount, currency, receipt } = req.body;
    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        const [rows] = await connection.query("SELECT config FROM integrations WHERE provider = 'razorpay'");
        connection.release();
        if (rows.length === 0) throw new Error("Razorpay not configured.");
        const config = rows[0].config;
        const auth = Buffer.from(`${config.keyId}:${config.secret}`).toString('base64');
        const response = await fetch('https://api.razorpay.com/v1/orders', {
            method: 'POST',
            headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: Math.round(amount * 100), currency: currency || "INR", receipt })
        });
        const data = await response.json();
        res.status(response.status).json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
