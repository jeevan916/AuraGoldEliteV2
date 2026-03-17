
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

        const isProduction = (config.mode || 'PRODUCTION') === 'PRODUCTION';
        const baseUrl = isProduction ? 'https://prod.setu.co/api/v2' : 'https://uat.setu.co/api/v2';

        // 2. Manual Token Generation (OAuth) - Matching PHP setuGenerateToken
        const tokenResponse = await fetch(`${baseUrl}/auth/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                clientID: config.clientId,
                secret: config.secret
            })
        });

        const tokenData = await tokenResponse.json();
        if (!tokenResponse.ok || !tokenData.success) {
            throw {
                message: "Setu Authentication Failed",
                response: {
                    status: tokenResponse.status,
                    data: tokenData
                }
            };
        }

        const token = tokenData.data.token;

        // 3. Manual Payment Link Creation - Matching PHP createOrder
        const orderData = {
            schemeId: config.schemeId,
            amount: {
                currencyCode: "INR",
                value: Math.round(amount * 100), // formatAmount usually converts to smallest unit
            },
            paymentMethods: {
                upi: {
                    expiry: 15, // minutes
                },
            },
            productConfigId: 'default',
            merchantId: config.clientId,
            merchantReferenceId: uniqueBillId,
            paymentDescription: safeNote,
            customerMobileNumber: customerID,
            showQR: true,
        };

        const linkResponse = await fetch(`${baseUrl}/payments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'X-Setu-Product-Instance-ID': config.schemeId
            },
            body: JSON.stringify(orderData)
        });

        const linkData = await linkResponse.json();
        if (!linkResponse.ok || !linkData.success) {
            throw {
                message: "Setu Link Creation Failed",
                response: {
                    status: linkResponse.status,
                    data: linkData
                }
            };
        }

        res.json({ success: true, data: linkData });

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

/**
 * Setu UPI Redirector
 * Decodes a base64 UPI intent and redirects to it.
 * This is used to bypass Meta's restriction on non-http schemes in URL buttons.
 */
router.get(['/setu/pay/:encodedIntent', '/setu/pay'], (req, res) => {
    try {
        const encodedIntent = req.params.encodedIntent || req.query.intent || req.query.s;
        
        if (!encodedIntent) {
            return res.status(400).send("Missing payment intent.");
        }

        let intent = '';
        
        // Normalize URL-safe base64 if needed
        const normalized = encodedIntent.replace(/-/g, '+').replace(/_/g, '/');

        // Try decoding as base64 first
        try {
            const decoded = Buffer.from(normalized, 'base64').toString('utf8');
            if (decoded.startsWith('upi://') || decoded.startsWith('https://')) {
                intent = decoded;
            }
        } catch (e) {
            // Ignore base64 decode errors
        }

        // If it wasn't a valid base64 upi/https link, assume it's a raw Setu link suffix
        if (!intent) {
            if (/^[a-zA-Z0-9_-]+$/.test(encodedIntent)) {
                intent = `https://setu.co/upi/s/${encodedIntent}`;
            } else {
                return res.status(400).send("Invalid payment intent. Link must start with upi:// or https://, or be a valid Setu link ID.");
            }
        }

        // Return a simple HTML that redirects
        // This is more reliable than res.redirect for deep links on mobile
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Redirecting to UPI...</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { 
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
                        display: flex; 
                        flex-direction: column; 
                        align-items: center; 
                        justify-content: center; 
                        height: 100vh; 
                        margin: 0; 
                        background: #f8fafc; 
                        color: #1e293b;
                    }
                    .card { 
                        background: white; 
                        padding: 2.5rem; 
                        border-radius: 1.5rem; 
                        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1); 
                        text-align: center; 
                        max-width: 400px; 
                        width: 90%;
                    }
                    .logo {
                        font-size: 2rem;
                        font-weight: 900;
                        color: #10b981;
                        margin-bottom: 1rem;
                        letter-spacing: -0.025em;
                    }
                    .btn { 
                        display: inline-block; 
                        margin-top: 2rem; 
                        padding: 1rem 2rem; 
                        background: #10b981; 
                        color: white; 
                        text-decoration: none; 
                        border-radius: 0.75rem; 
                        font-weight: bold; 
                        transition: transform 0.2s;
                    }
                    .btn:active { transform: scale(0.95); }
                    .loader { 
                        border: 3px solid #f1f5f9; 
                        border-top: 3px solid #10b981; 
                        border-radius: 50%; 
                        width: 40px; 
                        height: 40px; 
                        animation: spin 1s linear infinite; 
                        margin: 1.5rem auto; 
                    }
                    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                    p { color: #64748b; font-size: 0.95rem; line-height: 1.5; }
                    .footer { margin-top: 2rem; font-size: 0.75rem; color: #94a3b8; }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="logo">AuraGold</div>
                    <h2>Opening UPI App</h2>
                    <div class="loader"></div>
                    <p>Please wait while we securely redirect you to your payment application.</p>
                    <a href="${intent}" class="btn">Pay Now</a>
                    <div class="footer">Secure Payment via Setu UPI</div>
                </div>
                <script>
                    // Attempt automatic redirect
                    window.location.href = "${intent}";
                    
                    // If the app doesn't open automatically (e.g. on some iOS versions), 
                    // the user can still click the "Pay Now" button.
                </script>
            </body>
            </html>
        `);
    } catch (e) {
        res.status(400).send("Malformed payment link. Please try again.");
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
