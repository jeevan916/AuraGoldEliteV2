
import express from 'express';
import { getPool, ensureDb } from './db.js';

const router = express.Router();

// Setu Payment Proxy
router.post('/setu/create-link', ensureDb, async (req, res) => {
    let { amount, billerBillID, customerID, name, orderId } = req.body;
    
    // 1. Guideline Compliance: Validate Required Fields
    if (!amount || amount <= 0) {
        return res.status(400).json({ success: false, error: "Invalid Amount. Value must be greater than 0." });
    }

    try {
        const pool = getPool();
        const connection = await pool.getConnection();

        // If customerID or name is missing, try to fetch from order
        if ((!customerID || !name) && orderId) {
            const [orderRows] = await connection.query("SELECT data FROM orders WHERE id = ?", [orderId]);
            if (orderRows.length > 0) {
                const orderData = JSON.parse(orderRows[0].data);
                customerID = customerID || orderData.customerContact;
                name = name || orderData.customerName;
            }
        }

        if (!customerID || !name) {
            connection.release();
            return res.status(400).json({ success: false, error: "Customer Mobile Number and Name are required for Setu UPI." });
        }

        const [rows] = await connection.query("SELECT config FROM integrations WHERE provider = ?", ['setu']);
        
        if (rows.length === 0) {
            connection.release();
            throw new Error("Setu Integration not configured in Settings.");
        }

        let config = rows[0].config;
        if (typeof config === 'string') {
            try {
                config = JSON.parse(config);
            } catch (e) {
                connection.release();
                throw new Error("Invalid Setu configuration format.");
            }
        }

        const isProduction = (config.mode || 'PRODUCTION') === 'PRODUCTION';
        const baseUrl = isProduction ? 'https://prod.setu.co/api/v2' : 'https://uat.setu.co/api/v2';

        // 2. Token Management (OAuth with Caching)
        let token = config.cachedToken;
        const now = Math.floor(Date.now() / 1000);
        
        // If no token or token expires in less than 60 seconds, fetch a new one
        if (!token || !config.tokenExpiresAt || config.tokenExpiresAt < (now + 60)) {
            console.log("[Setu] Token expired or missing. Fetching new OAuth token...");
            const tokenResponse = await fetch(`${baseUrl}/auth/token`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                body: JSON.stringify({
                    clientID: config.clientId,
                    secret: config.secret
                })
            });

            const tokenText = await tokenResponse.text();
            let tokenData;
            try {
                tokenData = JSON.parse(tokenText);
            } catch (e) {
                connection.release();
                throw {
                    message: "Setu Authentication returned non-JSON response",
                    response: { status: tokenResponse.status, data: tokenText.substring(0, 500) }
                };
            }

            if (!tokenResponse.ok || !tokenData.success) {
                connection.release();
                throw {
                    message: "Setu Authentication Failed",
                    response: { status: tokenResponse.status, data: tokenData }
                };
            }

            token = tokenData.data.token;
            const expiresIn = tokenData.data.expiresIn || 1800;
            
            // Cache the token
            config.cachedToken = token;
            config.tokenExpiresAt = now + expiresIn;
            
            await connection.query("UPDATE integrations SET config = ? WHERE provider = ?", [JSON.stringify(config), 'setu']);
            console.log(`[Setu] New token cached. Expires in ${expiresIn}s`);
        } else {
            console.log("[Setu] Using cached OAuth token.");
        }

        connection.release();

        const uniqueBillId = billerBillID || (orderId ? `${orderId}_${Date.now()}` : `bill_${Date.now()}`);
        const safeName = name ? name.replace(/[^a-zA-Z0-9 ]/g, "").substring(0, 50).trim() : 'Customer';
        const safeNote = orderId ? `Order ${orderId}`.replace(/[^a-zA-Z0-9 ]/g, "").substring(0, 50).trim() : 'Payment';

        // 3. Manual Payment Link Creation
        const linkResponse = await fetch(`${baseUrl}/payment-links`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`,
                'X-Setu-Product-Instance-ID': config.schemeId,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            body: JSON.stringify({
                billerBillID: uniqueBillId,
                amount: {
                    value: Math.round(amount * 100),
                    currencyCode: "INR"
                },
                amountExactness: "EXACT",
                name: safeName,
                transactionNote: safeNote,
                additionalInfo: {
                    orderId: orderId || ""
                }
            })
        });

        const linkText = await linkResponse.text();
        let linkData;
        try {
            linkData = JSON.parse(linkText);
        } catch (e) {
            throw {
                message: "Setu Link Creation returned non-JSON response",
                response: { status: linkResponse.status, data: linkText.substring(0, 500) }
            };
        }

        if (!linkResponse.ok || !linkData.success) {
            throw {
                message: "Setu Link Creation Failed",
                response: { status: linkResponse.status, data: linkData }
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

// Setu Test Connection
router.post('/setu/test-connection', ensureDb, async (req, res) => {
    const { clientId, secret, mode } = req.body;
    
    if (!clientId || !secret) {
        return res.status(400).json({ success: false, error: "Client ID and Secret are required." });
    }

    const baseUrl = mode === 'SANDBOX' ? 'https://uat.setu.co/api/v2' : 'https://prod.setu.co/api/v2';

    try {
        const tokenResponse = await fetch(`${baseUrl}/auth/token`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            body: JSON.stringify({
                clientID: clientId,
                secret: secret
            })
        });

        const tokenText = await tokenResponse.text();
        let tokenData;
        try {
            tokenData = JSON.parse(tokenText);
        } catch (e) {
            return res.status(500).json({ 
                success: false, 
                error: "Setu returned non-JSON response. Check environment (Sandbox/Production).",
                raw: tokenText.substring(0, 500)
            });
        }

        if (!tokenResponse.ok || !tokenData.success) {
            return res.status(401).json({ 
                success: false, 
                error: tokenData.error?.detail || "Authentication Failed. Check Client ID and Secret.",
                raw: tokenData
            });
        }

        res.json({ 
            success: true, 
            message: "Connection Successful! OAuth token generated.",
            expiresIn: tokenData.data.expiresIn 
        });

    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * Setu UPI Redirector
 * Decodes a base64 UPI intent and redirects to it.
 * This is used to bypass Meta's restriction on non-http schemes in URL buttons.
 */
router.get(['/setu/pay/:encodedIntent', '/setu/pay'], async (req, res) => {
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
                // Fetch settings to determine mode
                const pool = getPool();
                const connection = await pool.getConnection();
                const [rows] = await connection.query("SELECT config FROM integrations WHERE provider = ?", ['setu']);
                connection.release();
                
                let mode = 'PRODUCTION';
                if (rows.length > 0) {
                    let config = rows[0].config;
                    if (typeof config === 'string') config = JSON.parse(config);
                    mode = config.mode || 'PRODUCTION';
                }
                
                const setuHost = mode === 'SANDBOX' ? 'uat.setu.co' : 'setu.co';
                intent = `https://${setuHost}/upi/s/${encodedIntent}`;
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

// Setu Webhook Notification Endpoint (Catch-All)
router.all(['/setu/notifications', '/setu/webhook'], async (req, res) => {
    try {
        // Acknowledge receipt immediately to Setu (must be 2xx without fail)
        res.status(200).send("OK");

        const { initDb, getPool } = await import('./db.js');
        // Ensure DB is initialized
        if (!getPool()) {
            await initDb();
        }

        const payload = req.body;
        const headers = req.headers;
        const method = req.method;
        const query = req.query;
        
        console.log(`[Setu Webhook] ${method} Received:`, JSON.stringify(payload, null, 2));
        
        try {
            const pool = getPool();
            const logConn = await pool.getConnection();
            const eventType = (payload && payload.events && payload.events[0]) ? payload.events[0].type : `RAW_${method}`;
            
            const logData = {
                body: payload,
                headers: headers,
                query: query,
                method: method
            };

            await logConn.query(
                "INSERT INTO webhook_logs (provider, event_type, payload) VALUES (?, ?, ?)",
                ['setu', eventType, JSON.stringify(logData)]
            );
            logConn.release();
        } catch (e) {
            console.error("Failed to log webhook to db:", e);
        }
        
        const eventsToProcess = [];
        if (payload && payload.events && Array.isArray(payload.events)) {
            eventsToProcess.push(...payload.events);
        } else if (payload && payload.billerBillID) {
            // Direct object from UPI Deep Link notifications
            eventsToProcess.push({
                type: payload.status || 'PAYMENT_SUCCESSFUL',
                data: payload
            });
        }
        
        for (const event of eventsToProcess) {
            const isSuccess = event.data && (
                    event.data.status === 'PAYMENT_SUCCESSFUL' || 
                    event.type === 'PAYMENT_SUCCESSFUL' ||
                    event.type === 'BILL_FULFILMENT_SUCCESS' ||
                    event.type === 'PAYMENT_LINK_PAID' ||
                    event.data.paymentStatus === 'SUCCESS' ||
                    event.data.status === 'SUCCESS'
                );

                if (isSuccess) {
                    const data = event.data;
                    const billerBillID = data.billerBillID || data.paymentLinkID; // Try fallback IDs
                    const amountPaid = (data.amountPaid?.value / 100) || (data.amount / 100) || 0; 
                    const upiTransactionID = data.transactionId || data.platformBillID || data.bankReferenceNumber || `setu_${Date.now()}`;
                    
                    // Extract orderId from additionalInfo if available, else fallback to billerBillID/paymentLinkID parsing
                    let orderId = data.additionalInfo?.orderId || data.additionalInfo?.orderID;
                    if (!orderId && billerBillID) {
                        orderId = billerBillID.split('_')[0];
                    }
                    
                    if (!orderId || amountPaid <= 0) {
                        console.error("Could not determine valid orderId or amountPaid from webhook data:", data);
                        continue;
                    }
                    
                    const pool = getPool();
                    if (!pool) continue;
                    const connection = await pool.getConnection();
                    
                    try {
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
                                
                                // Broadcast update to clients
                                if (req.io) {
                                    req.io.emit('orders_sync', [order]);
                                }
                            }
                        }
                    } finally {
                        connection.release();
                    }
                }
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

// Liability Gap Acceptance
router.post('/orders/:id/accept-liability', ensureDb, async (req, res) => {
    const orderId = req.params.id;
    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        
        // Find the order
        const [rows] = await connection.query('SELECT data FROM orders');
        const orderRow = rows.find(r => {
            const o = JSON.parse(r.data);
            return o.id === orderId;
        });
        
        if (!orderRow) {
            connection.release();
            return res.status(404).json({ success: false, error: "Order not found" });
        }
        
        const order = JSON.parse(orderRow.data);
        
        // Update order data
        order.requiresLiabilityAcceptance = false;
        order.liabilityGapAcceptedAt = new Date().toISOString();
        
        await connection.query('UPDATE orders SET data = ? WHERE JSON_EXTRACT(data, "$.id") = ?', [JSON.stringify(order), orderId]);
        connection.release();
        
        // Broadcast update to clients
        if (req.io) {
            req.io.emit('orders_sync', [order]);
        }
        
        res.json({ success: true, order });
    } catch (e) {
        console.error("Accept Liability Error:", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

export default router;
