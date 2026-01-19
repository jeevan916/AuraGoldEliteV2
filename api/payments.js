import express from 'express';
import { getPool, ensureDb } from './db.js';

const router = express.Router();

// Setu Payment Proxy
router.post('/setu/create-link', ensureDb, async (req, res) => {
    const { amount, billerBillID, customerID, name, orderId, expiry } = req.body;

    // 1. Pre-request validation for mandatory fields
    if (!amount || typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ success: false, error: "Invalid or missing amount. Must be a positive number." });
    }
    if (!billerBillID || typeof billerBillID !== 'string') {
        return res.status(400).json({ success: false, error: "Missing or invalid billerBillID (Transaction ID)." });
    }
    if (!customerID) {
        return res.status(400).json({ success: false, error: "Missing customer mobile number." });
    }

    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        const [rows] = await connection.query("SELECT config FROM integrations WHERE provider = 'setu'");
        connection.release();

        if (rows.length === 0) throw new Error("Setu gateway is not configured in system integrations.");
        const config = rows[0].config;

        // STEP 1: AUTHENTICATION
        const authRes = await fetch('https://bridge.setu.co/auth/v2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientId: config.clientId, clientSecret: config.secret })
        });

        const authContentType = authRes.headers.get('content-type') || '';
        let authData = {};

        if (authContentType.includes('application/json')) {
            try {
                authData = await authRes.json();
            } catch (parseErr) {
                const rawAuth = await authRes.text();
                console.error("[Setu Auth JSON Parse Error]:", rawAuth);
                throw new Error("Failed to parse Setu authentication response.");
            }
        } else {
            const rawAuthBody = await authRes.text();
            console.error("[Setu Auth Non-JSON Error]: Status", authRes.status, "Body:", rawAuthBody);
            throw new Error(`Authentication gateway returned non-JSON response (${authRes.status})`);
        }

        if (!authRes.ok) {
            throw new Error(authData.message || authData.error || `Authentication failed with status ${authRes.status}`);
        }

        // STEP 2: CREATE PAYMENT LINK
        // Setu V2 Link payload
        const payload = {
            amount: { 
                value: Math.round(amount * 100), // Convert to paise
                currencyCode: "INR" 
            },
            billerBillID,
            customer: { 
                mobileNumber: customerID.replace(/\D/g, '').slice(-10), // Ensure 10 digits
                name: name || "Valued Customer" 
            },
            transactionNote: `Payment for Order ${orderId || 'AuraGold'}`,
        };

        // Add expiry if provided, otherwise default to 48 hours for retail flexibility
        if (expiry) {
            payload.expiryDate = expiry;
        }

        const linkRes = await fetch('https://bridge.setu.co/api/v2/payment-links', {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${authData.data.token}`, 
                'Content-Type': 'application/json', 
                'X-Setu-Product-Instance-ID': config.schemeId 
            },
            body: JSON.stringify(payload)
        });

        const linkContentType = linkRes.headers.get('content-type') || '';
        let linkData = null;

        if (linkContentType.includes('application/json')) {
            try {
                linkData = await linkRes.json();
            } catch (linkParseErr) {
                const rawLinkBody = await linkRes.text();
                console.error("[Setu Link Creation JSON Parse Error]:", rawLinkBody);
                throw new Error("Gateway returned invalid JSON during link creation.");
            }
        } else {
            const rawLinkErrorBody = await linkRes.text();
            // Log raw response body for debugging XML/HTML errors (common on 500s)
            console.error("[Setu Link Creation Non-JSON Error]: Status", linkRes.status, "Body:", rawLinkErrorBody);
            return res.status(linkRes.status).json({ 
                success: false, 
                error: `Gateway returned an unexpected response format (${linkRes.status}).`,
                raw: rawLinkErrorBody.substring(0, 1000) // Truncated for response safety
            });
        }

        // Final response mapping
        if (!linkRes.ok) {
            return res.status(linkRes.status).json({ 
                success: false, 
                error: linkData?.message || linkData?.error || "Gateway link creation failed",
                details: linkData
            });
        }

        res.json({ success: true, data: linkData });

    } catch (e) { 
        console.error("[Setu Integration Exception]:", e.message);
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