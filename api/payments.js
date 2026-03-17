
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
        const [rows] = await connection.query("SELECT config FROM integrations WHERE provider = ?", ['setu']);
        connection.release();
        
        if (rows.length === 0) throw new Error("Setu Integration not configured in Settings.");
        let config = rows[0].config;
        if (typeof config === 'string') {
            try {
                config = JSON.parse(config);
            } catch (e) {
                throw new Error("Invalid Setu configuration format.");
            }
        }

        const uniqueBillId = billerBillID || (orderId ? `${orderId}_${Date.now()}` : `bill_${Date.now()}`);

        const safeName = name ? name.replace(/[^a-zA-Z0-9 ]/g, "").substring(0, 50).trim() : 'Customer';
        const safeNote = orderId ? `Order ${orderId}`.replace(/[^a-zA-Z0-9 ]/g, "").substring(0, 50).trim() : 'Payment';

        // 2. Authenticate and Create Link using SDK
        const upidl = SetuUPIDeepLink({
            schemeID: config.clientId, // Maps to Setu Scheme ID
            secret: config.secret,
            productInstanceID: config.schemeId, // Maps to Product Instance ID
            mode: config.mode || 'PRODUCTION',
            authType: 'JWT',
        });

        const paymentLinkResponse = await upidl.createPaymentLink({
            amountValue: Math.round(amount * 100),
            billerBillID: uniqueBillId,
            amountExactness: 'EXACT_DOWN',
            payeeName: safeName || 'Customer',
            transactionNote: safeNote || 'Payment'
        });

        res.json({ success: true, data: paymentLinkResponse });

    } catch (e) { 
        console.error("Setu Link Gen Error:", e);
        
        let errorData = {
            message: e.message || "Failed to generate Setu UPI link",
            stack: process.env.NODE_ENV === 'development' ? e.stack : undefined,
        };

        if (e.response) {
            errorData = {
                ...errorData,
                status: e.response.status,
                data: e.response.data,
                headers: e.response.headers
            };
        } else if (e.title || e.detail) {
            errorData = {
                ...errorData,
                title: e.title,
                detail: e.detail
            };
        }

        res.status(500).json({ 
            success: false, 
            error: typeof errorData.data === 'string' ? errorData.data : JSON.stringify(errorData, null, 2),
            raw: errorData 
        }); 
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
        const [rows] = await connection.query("SELECT config FROM integrations WHERE provider = ?", ['razorpay']);
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
