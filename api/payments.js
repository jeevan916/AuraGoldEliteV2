import express from 'express';
import { getPool, ensureDb, journalTransaction } from './db.js';
import { authenticateToken, requireRole, optionalAuth } from './auth.js';

// Modular Submodules
import { 
    getSetuHeaders, 
    getSetuToken, 
    getSetuBackoffStatus, 
    activateSetuBackoff, 
    clearSetuBackoff 
} from './payments/setuClient.js';
import { 
    handleSetuPaymentSuccess, 
    processSuccessfulPayment, 
    processSuccessfulExternalPayment, 
    extractSetuAmount 
} from './payments/reconciliation.js';
import { resolvePaymentIntent, renderRedirectHtml } from './payments/intentResolver.js';
import { startSetuPoller } from './payments/poller.js';
import { SETU_ALLOWED_WEBHOOK_IPS } from './payments/constants.js';

const router = express.Router();

// ---------------------------------------------------------
// SETU PAYMENT LINK CREATION
// ---------------------------------------------------------
router.post('/setu/create-link', ensureDb, async (req, res) => {
    let { amount, billerBillID, customerID, name, orderId, externalPaymentId } = req.body;
    
    if (!amount || amount <= 0) {
        return res.status(400).json({ success: false, error: "Invalid Amount. Value must be greater than 0." });
    }

    try {
        const pool = getPool();
        const connection = await pool.getConnection();

        if ((!customerID || !name) && orderId) {
            const [orderRows] = await connection.query("SELECT data FROM orders WHERE id = ?", [orderId]);
            if (orderRows.length > 0) {
                const orderData = JSON.parse(orderRows[0].data);
                customerID = customerID || orderData.customerContact;
                name = name || orderData.customerName;
            }
        } else if ((!customerID || !name) && externalPaymentId) {
            const [extRows] = await connection.query("SELECT data FROM external_payments WHERE id = ?", [externalPaymentId]);
            if (extRows.length > 0) {
                const extData = JSON.parse(extRows[0].data);
                customerID = customerID || extData.customerContact;
                name = name || extData.customerName;
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

        let token;
        try {
            token = await getSetuToken(connection, config, false, true);
        } catch (tokenErr) {
            connection.release();
            throw tokenErr;
        }

        connection.release();

        const uniqueBillId = billerBillID || (externalPaymentId ? `${externalPaymentId}_${Date.now()}` : (orderId ? `${orderId}_${Date.now()}` : `bill_${Date.now()}`));
        const safeName = name ? name.replace(/[^a-zA-Z0-9 ]/g, "").substring(0, 50).trim() : 'Customer';
        const safeNote = externalPaymentId ? `External Pay ${externalPaymentId}`.replace(/[^a-zA-Z0-9 ]/g, "").substring(0, 50).trim() : (orderId ? `Order ${orderId}`.replace(/[^a-zA-Z0-9 ]/g, "").substring(0, 50).trim() : 'Payment');
        const schemeId = config.schemeId || config.productInstanceId || config.product_instance_id || '';

        const makeLinkRequest = async (authToken) => {
            return await fetch(`${baseUrl}/payment-links`, {
                method: 'POST',
                headers: getSetuHeaders(authToken, schemeId, { 'Content-Type': 'application/json' }),
                body: JSON.stringify({
                    billerBillID: uniqueBillId,
                    amount: {
                        value: Math.round(amount * 100),
                        currencyCode: "INR"
                    },
                    amountExactness: "EXACT",
                    name: safeName,
                    transactionNote: safeNote,
                    expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                    additionalInfo: {
                        orderId: orderId || "",
                        externalPaymentId: externalPaymentId || "",
                        customerID: customerID || ""
                    }
                })
            });
        };

        let linkResponse;
        try {
            linkResponse = await makeLinkRequest(token);
            if (linkResponse.status === 401 || linkResponse.status === 403) {
                console.warn(`[Setu Link Gen] Received ${linkResponse.status} from Setu. Refreshing token and retrying...`);
                const retryConn = await pool.getConnection();
                try {
                    token = await getSetuToken(retryConn, config, true, true);
                    linkResponse = await makeLinkRequest(token);
                } finally {
                    retryConn.release();
                }
            }
        } catch (fetchErr) {
            console.error(`[Setu Link Gen] Network request to Setu failed: ${fetchErr.message}`);
            throw {
                message: "System busy, please try again in a few minutes",
                status: 503,
                isBlocked: true
            };
        }

        const linkText = await linkResponse.text();
        let linkData;
        try {
            linkData = JSON.parse(linkText);
        } catch (e) {
            const isHtml = linkText.trim().toLowerCase().startsWith('<!doctype') || linkText.trim().toLowerCase().startsWith('<html');
            if (isHtml) {
                activateSetuBackoff(5 * 60 * 1000, `WAF_HTML_LinkGen`, null, config);
            }
            throw {
                message: "System busy, please try again in a few minutes",
                rawResponse: linkText,
                status: 503,
                isBlocked: true
            };
        }

        if (!linkResponse.ok || !linkData.success) {
            if (linkResponse.status === 429) {
                activateSetuBackoff(5 * 60 * 1000, `HTTP_429_RateLimit_LinkGen`, null, config);
                throw {
                    message: "System busy, please try again in a few minutes",
                    response: { status: linkResponse.status, data: linkData },
                    rawResponse: linkText,
                    status: 503,
                    isBlocked: true
                };
            }
            throw {
                message: linkData.error?.detail || linkData.error?.message || linkData.message || "Setu Link Creation Failed",
                response: { status: linkResponse.status, data: linkData },
                rawResponse: linkText,
                status: linkResponse.status
            };
        }

        // Normalize paymentLink fields
        const setuPayload = linkData.data || linkData;
        if (setuPayload && setuPayload.paymentLink) {
            const pl = setuPayload.paymentLink;
            const url = pl.shortUrl || pl.shortURL || pl.shortLink || pl.url || '';
            pl.shortUrl = url;
            pl.shortURL = url;
            pl.shortLink = url;
            
            const rawVpa = pl.upiID || pl.upiId || pl.vpa || '';
            pl.upiID = rawVpa;

            let intentUrl = pl.upiURL || pl.upiLink || pl.upiIntentLink || '';
            if (!intentUrl && rawVpa && rawVpa.includes('@')) {
                intentUrl = `upi://pay?pa=${rawVpa}&pn=Sanghavi%20Jewellers&tr=${setuPayload.platformBillID || orderId || externalPaymentId || ''}&am=${amount || ''}&cu=INR`;
            }
            pl.upiURL = intentUrl;
            pl.upiLink = intentUrl;
            pl.upiIntentLink = intentUrl;
        }

        // Save platformBillID to order or external payment for background reconciliation
        const billID = setuPayload?.platformBillID || linkData?.data?.platformBillID || linkData?.platformBillID;
        if (orderId && billID) {
            const processConn = await getPool().getConnection();
            try {
                const [orderRows] = await processConn.query('SELECT data FROM orders WHERE id = ?', [orderId]);
                if (orderRows.length > 0) {
                    const order = JSON.parse(orderRows[0].data);
                    order.platformBillID = billID;
                    if (setuPayload?.paymentLink) {
                        order.shortLink = setuPayload.paymentLink.shortUrl;
                        order.upiIntentLink = setuPayload.paymentLink.upiIntentLink || setuPayload.paymentLink.upiURL || setuPayload.paymentLink.upiLink;
                    }
                    if (!order.pendingSetuPayments) order.pendingSetuPayments = [];
                    order.pendingSetuPayments.push({
                        platformBillID: billID,
                        amount: amount,
                        createdAt: new Date().toISOString()
                    });
                    await processConn.query('UPDATE orders SET data = ? WHERE id = ?', [JSON.stringify(order), orderId]);
                    await journalTransaction('ORDER', orderId, 'PENDING_UPI_CREATE', order, processConn);
                }
            } catch (err) {
                console.error("Failed to save pending Setu payment:", err);
            } finally {
                processConn.release();
            }
        } else if (externalPaymentId && billID) {
            const processConn = await getPool().getConnection();
            try {
                const [extRows] = await processConn.query('SELECT data FROM external_payments WHERE id = ?', [externalPaymentId]);
                if (extRows.length > 0) {
                    const extRecord = JSON.parse(extRows[0].data);
                    extRecord.platformBillID = billID;
                    if (setuPayload?.paymentLink) {
                        extRecord.shortLink = setuPayload.paymentLink.shortUrl;
                        extRecord.upiIntentLink = setuPayload.paymentLink.upiIntentLink || setuPayload.paymentLink.upiURL || setuPayload.paymentLink.upiLink;
                    }
                    if (!extRecord.pendingSetuPayments) extRecord.pendingSetuPayments = [];
                    extRecord.pendingSetuPayments.push({
                        platformBillID: billID,
                        amount: amount,
                        createdAt: new Date().toISOString()
                    });
                    await processConn.query('UPDATE external_payments SET data = ?, updated_at = ? WHERE id = ?', [JSON.stringify(extRecord), Date.now(), externalPaymentId]);
                    await journalTransaction('EXTERNAL_PAYMENT', externalPaymentId, 'PENDING_UPI_CREATE', extRecord, processConn);
                }
            } catch (err) {
                console.error("Failed to save pending Setu external payment:", err);
            } finally {
                processConn.release();
            }
        }

        res.json({ success: true, data: linkData });

    } catch (e) { 
        console.error("Setu Link Gen Error:", e);
        
        let errMsg = e.message || "Setu Link Generation Error";
        const isBackoffOrBusy = e.isBlocked || 
            errMsg.includes("System busy") || 
            errMsg.includes("back-off") || 
            errMsg.includes("Cloudflare") || 
            errMsg.includes("WAF") || 
            e.status === 403 || 
            e.status === 429 || 
            e.status === 503;

        if (isBackoffOrBusy) {
            errMsg = "System busy, please try again in a few minutes";
        }

        const rawResponse = e.rawResponse || e.response?.data || e;
        const statusCode = isBackoffOrBusy ? 503 : (e.status || e.response?.status || 500);

        res.status(statusCode).json({ 
            success: false, 
            isBlocked: isBackoffOrBusy,
            error: errMsg,
            message: errMsg,
            rawSetuResponse: rawResponse,
            raw: e
        }); 
    }
});

// Setu Back-off status query endpoint
router.get('/setu/backoff-status', ensureDb, async (req, res) => {
    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        const [rows] = await connection.query("SELECT config FROM integrations WHERE provider = ?", ['setu']);
        let config = rows.length > 0 ? rows[0].config : null;
        if (typeof config === 'string') {
            try { config = JSON.parse(config); } catch (e) {}
        }
        connection.release();
        const status = getSetuBackoffStatus(config);
        res.json({ success: true, ...status });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Setu Live Status Check Endpoint for Single Bill
router.get('/setu/status/:platformBillID', ensureDb, async (req, res) => {
    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        const [rows] = await connection.query("SELECT config FROM integrations WHERE provider = ?", ['setu']);
        if (rows.length === 0) {
            connection.release();
            return res.status(400).json({ success: false, error: "Setu Integration not configured." });
        }

        let config = rows[0].config;
        if (typeof config === 'string') config = JSON.parse(config);
        
        const isProduction = (config.mode || 'PRODUCTION') === 'PRODUCTION';
        const baseUrl = isProduction ? 'https://prod.setu.co/api/v2' : 'https://uat.setu.co/api/v2';
        
        let token;
        try {
            token = await getSetuToken(connection, config);
        } catch (tokenErr) {
            connection.release();
            throw tokenErr;
        }

        const platformBillID = req.params.platformBillID;
        const schemeId = config.schemeId || config.productInstanceId || config.product_instance_id || '';

        let statusResponse = await fetch(`${baseUrl}/payment-links/${platformBillID}`, {
            headers: getSetuHeaders(token, schemeId)
        });
        
        if (statusResponse.status === 401) {
            try {
                token = await getSetuToken(connection, config, true);
                statusResponse = await fetch(`${baseUrl}/payment-links/${platformBillID}`, {
                    headers: getSetuHeaders(token, schemeId)
                });
            } catch (retryErr) {
                console.error("[Setu Status] Token refresh retry failed:", retryErr.message);
            }
        } else if (statusResponse.status === 403) {
            activateSetuBackoff(15 * 60 * 1000, 'WAF_403_Status', connection, config);
            connection.release();
            return res.status(403).json({
                success: false,
                error: "Setu API access blocked by edge WAF (HTTP 403). Back-off active."
            });
        }
        
        const statusResponseText = await statusResponse.text();
        let statusData;
        try {
            statusData = JSON.parse(statusResponseText);
        } catch (e) {
            connection.release();
            return res.status(500).json({ 
                success: false, 
                error: "Invalid response from Setu", 
                rawSetuResponse: statusResponseText,
                status: statusResponse.status 
            });
        }
        connection.release();
        
        if (statusData.success && statusData.data && ['PAYMENT_SUCCESSFUL', 'SUCCESS', 'BILL_FULFILLED', 'CREDIT_RECEIVED'].includes(statusData.data.status)) {
            await handleSetuPaymentSuccess(statusData.data, req);
        }

        res.json(statusData);
    } catch (e) {
        console.error("Setu Poll Error:", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// Setu Comprehensive Sync & Reconciliation Endpoint
router.post(['/setu/sync-all', '/setu/reconcile-all'], ensureDb, async (req, res) => {
    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        const [rows] = await connection.query("SELECT config FROM integrations WHERE provider = ?", ['setu']);
        if (rows.length === 0) {
            connection.release();
            return res.status(400).json({ success: false, error: "Setu Integration not configured." });
        }

        let config = rows[0].config;
        if (typeof config === 'string') config = JSON.parse(config);

        const isProduction = (config.mode || 'PRODUCTION') === 'PRODUCTION';
        const baseUrl = isProduction ? 'https://prod.setu.co/api/v2' : 'https://uat.setu.co/api/v2';
        const schemeId = config.schemeId || config.productInstanceId || config.product_instance_id || '';

        let token = await getSetuToken(connection, config, true, true);
        connection.release();

        const billIdsToCheck = new Set();
        if (Array.isArray(req.body.platformBillIDs)) {
            req.body.platformBillIDs.forEach(id => {
                if (id) billIdsToCheck.add(String(id).trim());
            });
        }

        const scanConn = await pool.getConnection();
        const [extRows] = await scanConn.query("SELECT id, data FROM external_payments");
        const [orderRows] = await scanConn.query("SELECT id, data FROM orders");
        scanConn.release();

        for (const row of extRows) {
            try {
                const rec = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
                if (rec.platformBillID) billIdsToCheck.add(String(rec.platformBillID).trim());
                if (Array.isArray(rec.pendingSetuPayments)) {
                    rec.pendingSetuPayments.forEach(p => {
                        if (p.platformBillID) billIdsToCheck.add(String(p.platformBillID).trim());
                    });
                }
            } catch (e) {}
        }

        for (const row of orderRows) {
            try {
                const ord = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
                if (ord.platformBillID) billIdsToCheck.add(String(ord.platformBillID).trim());
                if (Array.isArray(ord.pendingSetuPayments)) {
                    ord.pendingSetuPayments.forEach(p => {
                        if (p.platformBillID) billIdsToCheck.add(String(p.platformBillID).trim());
                    });
                }
            } catch (e) {}
        }

        const results = [];
        let updatedCount = 0;

        for (const billId of billIdsToCheck) {
            if (!billId || billId.length < 5) continue;
            try {
                let statusRes = await fetch(`${baseUrl}/payment-links/${billId}`, {
                    headers: getSetuHeaders(token, schemeId),
                    signal: AbortSignal.timeout(5000)
                });

                if (statusRes.status === 401) {
                    const refConn = await pool.getConnection();
                    token = await getSetuToken(refConn, config, true, true);
                    refConn.release();
                    statusRes = await fetch(`${baseUrl}/payment-links/${billId}`, {
                        headers: getSetuHeaders(token, schemeId),
                        signal: AbortSignal.timeout(5000)
                    });
                }

                const resText = await statusRes.text();
                if (!resText.trim().startsWith('{')) continue;
                const statusJson = JSON.parse(resText);

                if (statusJson.success && statusJson.data && ['PAYMENT_SUCCESSFUL', 'SUCCESS', 'BILL_FULFILLED', 'CREDIT_RECEIVED'].includes(statusJson.data.status)) {
                    await handleSetuPaymentSuccess(statusJson.data, req);
                    updatedCount++;
                    results.push({ billId, status: statusJson.data.status, success: true });
                } else {
                    results.push({ billId, status: statusJson.data?.status || 'PENDING', success: false });
                }
            } catch (err) {
                results.push({ billId, error: err.message, success: false });
            }
        }

        res.json({
            success: true,
            totalChecked: billIdsToCheck.size,
            updatedCount,
            results
        });
    } catch (e) {
        console.error("Setu Sync-All Error:", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// Setu Expire Payment Link
router.post('/setu/expire-link/:platformBillID', ensureDb, authenticateToken, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        const [rows] = await connection.query("SELECT config FROM integrations WHERE provider = ?", ['setu']);
        if (rows.length === 0) {
            connection.release();
            return res.status(400).json({ success: false, error: "Setu Integration not configured." });
        }

        let config = rows[0].config;
        if (typeof config === 'string') config = JSON.parse(config);
        
        const isProduction = (config.mode || 'PRODUCTION') === 'PRODUCTION';
        const baseUrl = isProduction ? 'https://prod.setu.co/api/v2' : 'https://uat.setu.co/api/v2';
        const schemeId = config.schemeId || config.productInstanceId || config.product_instance_id || '';

        let token = await getSetuToken(connection, config);
        connection.release();

        const platformBillID = req.params.platformBillID;
        const response = await fetch(`${baseUrl}/payment-links/${platformBillID}/expire`, {
            method: 'POST',
            headers: getSetuHeaders(token, schemeId, { 'Content-Type': 'application/json' })
        });

        const text = await response.text();
        try {
            const data = JSON.parse(text);
            return res.status(response.status).json(data);
        } catch (e) {
            return res.status(response.status).send(text);
        }
    } catch (e) {
        console.error("Setu Expire Link Error:", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// Setu Refund Payment Link
router.post('/setu/refund', ensureDb, authenticateToken, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
    try {
        const { platformBillID, amount } = req.body;
        if (!platformBillID) {
            return res.status(400).json({ success: false, error: "platformBillID is required for refund" });
        }

        const pool = getPool();
        const connection = await pool.getConnection();
        const [rows] = await connection.query("SELECT config FROM integrations WHERE provider = ?", ['setu']);
        if (rows.length === 0) {
            connection.release();
            return res.status(400).json({ success: false, error: "Setu Integration not configured." });
        }

        let config = rows[0].config;
        if (typeof config === 'string') config = JSON.parse(config);
        
        const isProduction = (config.mode || 'PRODUCTION') === 'PRODUCTION';
        const baseUrl = isProduction ? 'https://prod.setu.co/api/v2' : 'https://uat.setu.co/api/v2';
        const schemeId = config.schemeId || config.productInstanceId || config.product_instance_id || '';

        let token = await getSetuToken(connection, config);
        connection.release();

        const refundPayload = {
            refund: {
                type: amount ? "PARTIAL" : "FULL",
                parameter: {
                    refId: platformBillID
                }
            }
        };

        if (amount) {
            refundPayload.refund.amount = {
                value: Math.round(amount * 100),
                currencyCode: "INR"
            };
        }

        const response = await fetch(`${baseUrl}/payment-links/refund`, {
            method: 'POST',
            headers: getSetuHeaders(token, schemeId, { 'Content-Type': 'application/json' }),
            body: JSON.stringify(refundPayload)
        });

        const text = await response.text();
        try {
            const data = JSON.parse(text);
            return res.status(response.status).json(data);
        } catch (e) {
            return res.status(response.status).send(text);
        }
    } catch (e) {
        console.error("Setu Refund Error:", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// Setu Test Connection
router.post(['/setu/test-connection', '/payments/setu/test-connection'], ensureDb, authenticateToken, requireRole('ADMIN'), async (req, res) => {
    const { clientId, secret, mode } = req.body;
    
    if (!clientId || !secret) {
        return res.status(400).json({ success: false, error: "Client ID and Secret are required." });
    }

    const baseUrl = mode === 'SANDBOX' ? 'https://uat.setu.co/api/v2' : 'https://prod.setu.co/api/v2';

    try {
        const tokenResponse = await fetch(`${baseUrl}/auth/token`, {
            method: 'POST',
            headers: getSetuHeaders(null, null, { 'Content-Type': 'application/json' }),
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
                error: `Setu returned non-JSON response (Status ${tokenResponse.status}). Check environment (Sandbox/Production).`,
                rawSetuResponse: tokenText
            });
        }

        if (!tokenResponse.ok || !tokenData.success) {
            return res.status(401).json({ 
                success: false, 
                error: tokenData.error?.detail || tokenData.error?.message || "Authentication Failed. Check Client ID and Secret.",
                rawSetuResponse: tokenText
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

// Setu Intent Redirector
router.get(['/setu/pay/:encodedIntent', '/setu/pay'], async (req, res) => {
    try {
        let rawIntent = req.params.encodedIntent || req.query.intent || req.query.s || '';
        if (!rawIntent) {
            const sub = req.path.replace(/^\/setu\/pay\/?/, '');
            if (sub) rawIntent = sub;
        }
        
        if (!rawIntent) {
            return res.status(400).send("Missing payment intent.");
        }

        const resolved = resolvePaymentIntent(rawIntent);
        let intent = '';
        if (resolved.startsWith('upi://') || resolved.startsWith('https://') || resolved.startsWith('http://')) {
            intent = resolved;
        } else if (resolved.includes('@') && !resolved.includes('://')) {
            intent = `upi://pay?pa=${encodeURIComponent(resolved)}&pn=Sanghavi%20Jewellers&cu=INR`;
        } else if (/^[a-zA-Z0-9_-]+$/.test(resolved)) {
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
            intent = `https://${setuHost}/upi/s/${resolved}`;
        } else {
            return res.status(400).send("Invalid payment intent. Link must start with upi:// or https://, or be a valid Setu link ID.");
        }

        res.send(renderRedirectHtml(intent));
    } catch (e) {
        res.status(400).send("Malformed payment link. Please try again.");
    }
});

// Setu Webhook Notifications
router.post(['/setu/notifications', '/setu/webhook', '/webhooks/setu'], express.text({ type: '*/*' }), async (req, res) => {
    try {
        let clientIP = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
        if (typeof clientIP === 'string') {
            clientIP = clientIP.split(',')[0].trim();
        }
        if (clientIP && clientIP.startsWith('::ffff:')) {
            clientIP = clientIP.replace('::ffff:', '');
        }

        if (clientIP && !SETU_ALLOWED_WEBHOOK_IPS.includes(clientIP)) {
            console.warn(`[Setu Webhook] Request from unverified IP: ${clientIP}`);
        }

        // Acknowledge receipt immediately to Setu
        res.status(200).json({ success: true, message: "OK" });

        const { initDb, getPool } = await import('./db.js');
        if (!getPool()) {
            await initDb();
        }

        let payload = req.body;
        if (typeof payload === 'string') {
            try { payload = JSON.parse(payload); } catch(e) {}
        }

        try {
            const pool = getPool();
            const logConn = await pool.getConnection();
            const eventType = (payload && payload.events && payload.events[0]) ? payload.events[0].type : `RAW_${req.method}`;
            
            await logConn.query(
                "INSERT INTO webhook_logs (provider, event_type, payload) VALUES (?, ?, ?)",
                ['setu', eventType, JSON.stringify({ body: payload, headers: req.headers, query: req.query, method: req.method })]
            );
            logConn.release();
        } catch (e) {
            console.error("Failed to log webhook to db:", e);
        }
        
        const eventsToProcess = [];
        if (payload && payload.events && Array.isArray(payload.events)) {
            eventsToProcess.push(...payload.events);
        } else if (payload && Array.isArray(payload.data)) {
            payload.data.forEach(item => {
                eventsToProcess.push({
                    type: item.status || item.type || payload.type || payload.event || 'PAYMENT_SUCCESSFUL',
                    data: item
                });
            });
        } else if (payload && payload.data && typeof payload.data === 'object') {
            eventsToProcess.push({
                type: payload.data.status || payload.type || payload.event || payload.eventType || 'PAYMENT_SUCCESSFUL',
                data: payload.data
            });
        } else if (payload && payload.resource && typeof payload.resource === 'object') {
            eventsToProcess.push({
                type: payload.resource.status || payload.event || payload.type || 'PAYMENT_SUCCESSFUL',
                data: payload.resource
            });
        } else if (payload && (payload.billerBillID || payload.platformBillID || payload.id || payload.paymentLinkID || payload.paymentLinkId || payload.transactionId || payload.txnId || payload.status)) {
            eventsToProcess.push({
                type: payload.status || payload.type || payload.event || 'PAYMENT_SUCCESSFUL',
                data: payload
            });
        }
        
        for (const event of eventsToProcess) {
            const eventData = event.data || event.resource || event;
            const eventType = String(event.type || event.event || event.eventType || eventData.status || eventData.paymentStatus || '').toUpperCase();
            const status = String(eventData.status || eventData.paymentStatus || eventData.transactionStatus || '').toUpperCase();

            const isSuccess = 
                ['PAYMENT_SUCCESSFUL', 'SUCCESS', 'BILL_FULFILLED', 'BILL_FULFILMENT_SUCCESS', 'PAYMENT_LINK_PAID', 'CREDIT_RECEIVED', 'SETU_TRANSACTION_SUCCESS', 'TRANSACTION_SUCCESSFUL', 'COLLECT_REQUEST_SUCCESS', 'PAID'].includes(status) ||
                ['PAYMENT_SUCCESSFUL', 'SUCCESS', 'BILL_FULFILLED', 'BILL_FULFILMENT_SUCCESS', 'PAYMENT_LINK_PAID', 'CREDIT_RECEIVED', 'SETU_TRANSACTION_SUCCESS', 'TRANSACTION_SUCCESSFUL', 'COLLECT_REQUEST_SUCCESS', 'PAID'].includes(eventType) ||
                (eventData.amountPaid && (Number(eventData.amountPaid?.value || eventData.amountPaid) > 0));

            if (isSuccess) {
                await handleSetuPaymentSuccess(eventData, req);
            }
        }
    } catch (e) {
        console.error("Setu Webhook Error:", e);
    }
});

// Dedicated Manual Setu Reconcile Endpoint
router.post('/setu/reconcile-txn', ensureDb, async (req, res) => {
    try {
        const { externalPaymentId, orderId, platformBillID, billerBillID, txnId, amount } = req.body;
        const pool = getPool();
        const connection = await pool.getConnection();

        if (externalPaymentId) {
            const [rows] = await connection.query("SELECT id, data FROM external_payments WHERE id = ?", [externalPaymentId]);
            if (rows.length > 0) {
                const record = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data;
                const numericAmount = Number(amount) > 0 ? Number(amount) : (Number(record.amount) - (Number(record.amountPaid) || 0));
                const finalTxnId = txnId || platformBillID || billerBillID || `manual_${Date.now()}`;
                
                connection.release();
                await processSuccessfulExternalPayment(externalPaymentId, numericAmount, finalTxnId, 'SETU_VERIFIED', req);

                const [updatedRows] = await (getPool()).query("SELECT data FROM external_payments WHERE id = ?", [externalPaymentId]);
                const updatedRecord = updatedRows.length > 0 ? JSON.parse(updatedRows[0].data) : null;
                return res.json({ success: true, message: `Reconciled External Payment ${externalPaymentId}`, record: updatedRecord });
            }
        }

        if (orderId) {
            const [rows] = await connection.query("SELECT id, data FROM orders WHERE id = ?", [orderId]);
            if (rows.length > 0) {
                const numericAmount = Number(amount) || 0;
                const finalTxnId = txnId || platformBillID || billerBillID || `manual_${Date.now()}`;
                connection.release();
                await processSuccessfulPayment(orderId, numericAmount, finalTxnId, 'SETU_VERIFIED', req);
                return res.json({ success: true, message: `Reconciled Order ${orderId}` });
            }
        }

        connection.release();

        await handleSetuPaymentSuccess({
            platformBillID,
            billerBillID,
            transactionId: txnId,
            amountPaid: amount ? { value: Math.round(Number(amount) * 100) } : undefined,
            status: 'PAYMENT_SUCCESSFUL',
            additionalInfo: { externalPaymentId, orderId }
        }, req);

        return res.json({ success: true, message: "Reconciliation triggered." });
    } catch (e) {
        console.error("Setu reconcile error:", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// Razorpay Order Creation Proxy
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
router.post('/orders/:id/accept-liability', ensureDb, optionalAuth, async (req, res) => {
    const orderId = req.params.id;
    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        
        const [rows] = await connection.query('SELECT data FROM orders WHERE id = ?', [orderId]);
        if (rows.length === 0) {
            connection.release();
            return res.status(404).json({ success: false, error: "Order not found" });
        }
        
        const order = JSON.parse(rows[0].data);
        const clientShareToken = req.body.shareToken || req.headers['x-share-token'];
        const isStaff = req.user && ['ADMIN', 'MANAGER', 'SALES'].includes(req.user.role);

        if (!isStaff && (!clientShareToken || clientShareToken !== order.shareToken)) {
            connection.release();
            console.warn(`[Security Alert: IDOR Prevention] Unauthorized attempt to accept liability for Order ${orderId}`);
            return res.status(403).json({ 
                success: false, 
                error: "IDOR Protection: Access Denied. Valid share token or staff authorization required." 
            });
        }
        
        order.requiresLiabilityAcceptance = false;
        order.liabilityGapAcceptedAt = new Date().toISOString();
        
        await connection.query('UPDATE orders SET data = ? WHERE id = ?', [JSON.stringify(order), orderId]);
        await journalTransaction('ORDER', orderId, 'ACCEPT_LIABILITY', order, connection);
        connection.release();
        
        if (req.io) {
            req.io.emit('orders_sync', [order]);
        }
        
        res.json({ success: true, order });
    } catch (e) {
        console.error("Accept Liability Error:", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// Re-exports for Backward Compatibility
export { 
    processSuccessfulPayment, 
    processSuccessfulExternalPayment, 
    getSetuToken, 
    getSetuHeaders, 
    handleSetuPaymentSuccess, 
    startSetuPoller,
    extractSetuAmount,
    getSetuBackoffStatus,
    activateSetuBackoff,
    clearSetuBackoff
};

export default router;
