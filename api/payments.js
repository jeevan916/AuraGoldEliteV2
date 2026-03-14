
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

        // 2. Authenticate using fetchToken API (OAuth)
        const tokenResponse = await fetch('https://prod.setu.co/api/v2/auth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                clientID: config.clientId,
                secret: config.secret
            })
        });

        if (!tokenResponse.ok) {
            const err = await tokenResponse.text();
            throw new Error(`Setu fetchToken failed: ${err}`);
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.data.token;

        const uniqueBillId = billerBillID || (orderId ? `${orderId}_${Date.now()}` : `bill_${Date.now()}`);

        const safeName = name ? name.replace(/[^a-zA-Z0-9 ]/g, "").substring(0, 50).trim() : 'Customer';
        const safeNote = orderId ? `Order ${orderId}`.replace(/[^a-zA-Z0-9 ]/g, "").substring(0, 50).trim() : 'Payment';

        // 3. Create Payment Link
        const paymentLinkResponse = await fetch('https://prod.setu.co/api/v2/payment-links', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'X-Setu-Product-Instance-ID': config.schemeId
            },
            body: JSON.stringify({
                amount: {
                    currencyCode: 'INR',
                    value: Math.round(amount * 100)
                },
                billerBillID: uniqueBillId,
                amountExactness: 'EXACT_DOWN',
                name: safeName || 'Customer',
                transactionNote: safeNote || 'Payment'
            })
        });

        if (!paymentLinkResponse.ok) {
            const err = await paymentLinkResponse.text();
            throw new Error(`Setu paymentLink failed: ${err}`);
        }

        const paymentLinkData = await paymentLinkResponse.json();

        res.json({ success: true, data: paymentLinkData.data });

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

// Setu Webhook Notification Endpoint
router.post('/setu/webhook', ensureDb, async (req, res) => {
    try {
        const payload = req.body;
        console.log("Setu Webhook Received:", JSON.stringify(payload, null, 2));
        
        // Acknowledge receipt immediately to Setu
        res.status(200).json({ success: true });
        
        // Process the payment status update asynchronously
        if (payload && payload.paymentDetails && payload.paymentDetails.paymentStatus === 'SUCCESS') {
            const billerBillID = payload.billerBillID;
            const amountPaid = payload.paymentDetails.amountPaid.value / 100; // Convert paisa to rupees
            const upiTransactionID = payload.paymentDetails.upiTransactionID;
            
            // Extract orderId from billerBillID (e.g., "ORD123_1678900000" -> "ORD123")
            const orderId = billerBillID.split('_')[0];
            
            const pool = getPool();
            const connection = await pool.getConnection();
            
            // Find the order
            const [rows] = await connection.query('SELECT data FROM orders');
            const orderRow = rows.find(r => {
                const o = JSON.parse(r.data);
                return o.id === orderId;
            });
            
            if (orderRow) {
                const order = JSON.parse(orderRow.data);
                
                // Check if payment is already recorded
                const alreadyRecorded = order.payments.some(p => p.reference === upiTransactionID);
                
                if (!alreadyRecorded) {
                    order.payments.push({
                        id: `pay_${Date.now()}`,
                        amount: amountPaid,
                        date: new Date().toISOString(),
                        method: 'UPI',
                        reference: upiTransactionID,
                        status: 'SUCCESS'
                    });
                    
                    // Update milestones
                    let remaining = amountPaid;
                    for (const milestone of order.paymentPlan.milestones) {
                        if (milestone.status !== 'PAID' && remaining > 0) {
                            if (remaining >= milestone.targetAmount) {
                                milestone.status = 'PAID';
                                remaining -= milestone.targetAmount;
                            } else {
                                milestone.status = 'PARTIAL';
                                remaining = 0;
                            }
                        }
                    }
                    
                    await connection.query('UPDATE orders SET data = ? WHERE JSON_EXTRACT(data, "$.id") = ?', [JSON.stringify(order), orderId]);
                    console.log(`Order ${orderId} updated with Setu payment ${upiTransactionID}`);
                }
            }
            connection.release();
        }
    } catch (e) {
        console.error("Setu Webhook Error:", e);
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
