
import express from 'express';
import { getPool, ensureDb } from './db.js';
import { SetuUPIDeepLink } from '@setu/upi-deep-links';

const router = express.Router();

// Setu Payment Proxy
router.post('/setu/create-link', ensureDb, async (req, res) => {
    const { amount, billerBillID, customerID, name, orderId } = req.body;
    
    // 1. Guideline Compliance: Validate Required Fields
    if (!amount || amount <= 0) {
        return res.status(400).json({ success: false, error: "Invalid Amount. Value must be greater than 0." });
    }
    if (!customerID || !name) {
        return res.status(400).json({ success: false, error: "Customer Mobile Number and Name are required for Setu UPI." });
    }

    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        const [rows] = await connection.query("SELECT config FROM integrations WHERE provider = 'setu'");
        connection.release();
        
        if (rows.length === 0) throw new Error("Setu Integration not configured in Settings.");
        const config = rows[0].config;

        // 2. Authenticate and Create Link using SDK
        // In Setu UPI Deeplinks:
        // clientId -> schemeID
        // schemeId -> productInstanceID
        const upidl = SetuUPIDeepLink({
            schemeID: config.clientId,
            secret: config.secret,
            productInstanceID: config.schemeId,
            mode: 'PRODUCTION',
            authType: 'JWT',
        });

        const paymentLinkResponse = await upidl.createPaymentLink({
            amountValue: Math.round(amount * 100),
            billerBillID: billerBillID || orderId || `bill_${Date.now()}`,
            amountExactness: 'EXACT',
            payeeName: name,
            transactionNote: `Order ${orderId}`
        });

        res.json({ success: true, data: paymentLinkResponse });

    } catch (e) { 
        console.error("Setu Link Gen Error:", e);
        
        let errorMsg = "Failed to generate Setu UPI link";
        if (e.response && e.response.data) {
            console.error("Setu API Error Data:", e.response.data);
            errorMsg = JSON.stringify(e.response.data);
        } else if (e.title || e.detail) {
            errorMsg = `${e.title || 'Error'}: ${e.detail || ''}`;
        } else if (e.message) {
            errorMsg = e.message;
        } else if (typeof e === 'object') {
            errorMsg = JSON.stringify(e);
        }

        res.status(500).json({ success: false, error: errorMsg }); 
    }
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
