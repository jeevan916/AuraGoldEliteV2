
import express from 'express';
import { getPool, ensureDb } from './db.js';

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

        // 2. Authenticate (Bridge v2)
        const authRes = await fetch('https://bridge.setu.co/auth/v2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientId: config.clientId, clientSecret: config.secret })
        });
        
        const authData = await authRes.json();
        if (!authRes.ok) throw new Error(`Auth Failed: ${authData.error || authData.message || 'Unknown Auth Error'}`);

        // 3. Create Link
        const linkRes = await fetch('https://bridge.setu.co/api/v2/payment-links', {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${authData.data.token}`, 
                'Content-Type': 'application/json', 
                'X-Setu-Product-Instance-ID': config.schemeId 
            },
            body: JSON.stringify({ 
                amount: { value: Math.round(amount * 100), currencyCode: "INR" }, 
                billerBillID, 
                customer: { mobileNumber: customerID, name }, 
                transactionNote: `Order ${orderId}` 
            })
        });

        // 4. Robust Response Handling
        const linkData = await linkRes.json();
        
        if (!linkRes.ok) {
            // Log deep error details for debugging
            console.error("Setu Link Gen Error:", JSON.stringify(linkData));
            throw new Error(linkData.error?.message || linkData.message || "Gateway refused connection.");
        }

        res.status(linkRes.status).json({ success: true, data: linkData });

    } catch (e) { 
        res.status(500).json({ success: false, error: e.message }); 
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
