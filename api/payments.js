
import express from 'express';
import { getPool, ensureDb, journalTransaction, isMock } from './db.js';
import { sendWhatsAppMessage } from './whatsapp.js';

export const SETU_DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

export function getSetuHeaders(token = null, schemeId = null, extraHeaders = {}) {
    const headers = {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': SETU_DEFAULT_USER_AGENT,
        'Cache-Control': 'no-cache',
        ...extraHeaders
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    if (schemeId) {
        headers['X-Setu-Product-Instance-ID'] = schemeId;
    }
    return headers;
}

// Helper to obtain or refresh Setu OAuth token with auto-retry and cache handling
async function getSetuToken(connection, config, forceRefresh = false, allowWafBypass = false) {
    const now = Math.floor(Date.now() / 1000);
    const mode = (config.mode || 'PRODUCTION').toUpperCase();
    const isProduction = mode === 'PRODUCTION' || mode === 'PROD';
    const baseUrl = isProduction ? 'https://prod.setu.co/api/v2' : 'https://uat.setu.co/api/v2';

    const clientId = config.clientId || config.clientID || config.client_id;
    const secret = config.secret || config.clientSecret || config.client_secret;
    const schemeId = config.schemeId || config.productInstanceId || config.product_instance_id || '';

    const isInvalidCredential = (val) => !val || typeof val !== 'string' || val.trim() === '' || val.includes('default') || val.includes('YOUR_SETU');
    if (isInvalidCredential(clientId) || isInvalidCredential(secret) || config.enabled === false) {
        throw new Error("Setu Integration is not configured with valid credentials in Settings.");
    }

    if (!allowWafBypass && config.wafBlockedUntil && Date.now() < config.wafBlockedUntil) {
        const remainingSec = Math.ceil((config.wafBlockedUntil - Date.now()) / 1000);
        const err = new Error(`Setu API endpoint temporarily back-off active due to Cloudflare/WAF block (${remainingSec}s remaining). Retry later or update settings.`);
        err.status = 403;
        throw err;
    }

    if (!forceRefresh && config.cachedToken && config.tokenExpiresAt && config.tokenExpiresAt > (now + 60)) {
        return config.cachedToken;
    }

    console.log(`[Setu Token Manager] Fetching new OAuth token from ${baseUrl} (Force refresh: ${forceRefresh})...`);
    let tokenResponse;
    try {
        tokenResponse = await fetch(`${baseUrl}/auth/token`, {
            method: 'POST',
            headers: getSetuHeaders(null, null, { 'Content-Type': 'application/json' }),
            body: JSON.stringify({
                clientID: clientId,
                secret: secret
            })
        });
    } catch (fetchErr) {
        console.warn(`[Setu Token Manager] Network request to Setu failed: ${fetchErr.message}`);
        throw new Error(`Setu network request failed: ${fetchErr.message}`);
    }

    const tokenText = await tokenResponse.text();
    let tokenData;
    try {
        tokenData = JSON.parse(tokenText);
    } catch (e) {
        const isHtml = tokenText.trim().toLowerCase().startsWith('<!doctype') || 
                      tokenText.trim().toLowerCase().startsWith('<html') ||
                      tokenText.includes('<!-- a padding to disable MSIE');
        
        // Temporarily back off for 15 minutes if Setu edge returned WAF block or HTML error
        config.wafBlockedUntil = Date.now() + 15 * 60 * 1000;
        if (connection) {
            try {
                await connection.query("UPDATE integrations SET config = ? WHERE provider = ?", [JSON.stringify(config), 'setu']);
            } catch (dbErr) {}
        }

        const summary = isHtml ? "HTML Error Page (Cloudflare/WAF block or invalid endpoint)" : tokenText.substring(0, 150);
        console.warn(`[Setu Token Manager] Setu returned HTTP ${tokenResponse.status}: ${summary}`);
        const err = new Error(`Setu returned HTTP ${tokenResponse.status}: ${summary}`);
        err.rawResponse = tokenText;
        err.status = tokenResponse.status;
        throw err;
    }

    if (!tokenResponse.ok || !tokenData.success) {
        if (tokenResponse.status === 403 || tokenResponse.status === 429) {
            config.wafBlockedUntil = Date.now() + 15 * 60 * 1000;
            if (connection) {
                try {
                    await connection.query("UPDATE integrations SET config = ? WHERE provider = ?", [JSON.stringify(config), 'setu']);
                } catch (dbErr) {}
            }
        }
        console.warn(`[Setu Token Manager] Auth Response Error (Status ${tokenResponse.status}):`, tokenData.error?.message || tokenText);
        const err = new Error(tokenData.error?.message || tokenData.error?.detail || tokenData.message || "Setu Authentication Failed");
        err.response = { status: tokenResponse.status, data: tokenData };
        err.rawResponse = tokenText;
        err.status = tokenResponse.status;
        throw err;
    }

    const token = tokenData.data.token;
    const expiresIn = tokenData.data.expiresIn || 1800;
    
    config.cachedToken = token;
    config.tokenExpiresAt = now + expiresIn;
    delete config.wafBlockedUntil;
    
    if (connection) {
        try {
            await connection.query("UPDATE integrations SET config = ? WHERE provider = ?", [JSON.stringify(config), 'setu']);
        } catch (dbErr) {}
    }
    console.log(`[Setu Token Manager] New token cached successfully. Expires in ${expiresIn}s`);
    return token;
}

const router = express.Router();

// Setu Payment Proxy
router.post('/setu/create-link', ensureDb, async (req, res) => {
    let { amount, billerBillID, customerID, name, orderId, externalPaymentId } = req.body;
    
    // 1. Guideline Compliance: Validate Required Fields
    if (!amount || amount <= 0) {
        return res.status(400).json({ success: false, error: "Invalid Amount. Value must be greater than 0." });
    }

    try {
        const pool = getPool();
        const connection = await pool.getConnection();

        // If customerID or name is missing, try to fetch from order or external payment request
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
                config = typeof config === "string" ? JSON.parse(config) : config;
            } catch (e) {
                connection.release();
                throw new Error("Invalid Setu configuration format.");
            }
        }

        const isProduction = (config.mode || 'PRODUCTION') === 'PRODUCTION';
        const baseUrl = isProduction ? 'https://prod.setu.co/api/v2' : 'https://uat.setu.co/api/v2';

        // 2. Token Management using the helper function
        let token;
        try {
            const shouldForce = req.body.forceRefresh === true || req.body.force === true;
            token = await getSetuToken(connection, config, shouldForce, true);
        } catch (tokenErr) {
            if (!req.body.forceRefresh && (tokenErr.message?.includes('back-off') || tokenErr.status === 401)) {
                try {
                    token = await getSetuToken(connection, config, true, true);
                } catch (retryErr) {
                    connection.release();
                    throw retryErr;
                }
            } else {
                connection.release();
                throw tokenErr;
            }
        }

        connection.release();

        const uniqueBillId = billerBillID || (externalPaymentId ? `${externalPaymentId}_${Date.now()}` : (orderId ? `${orderId}_${Date.now()}` : `bill_${Date.now()}`));
        const safeName = name ? name.replace(/[^a-zA-Z0-9 ]/g, "").substring(0, 50).trim() : 'Customer';
        const safeNote = externalPaymentId ? `External Pay ${externalPaymentId}`.replace(/[^a-zA-Z0-9 ]/g, "").substring(0, 50).trim() : (orderId ? `Order ${orderId}`.replace(/[^a-zA-Z0-9 ]/g, "").substring(0, 50).trim() : 'Payment');

        const schemeId = config.schemeId || config.productInstanceId || config.product_instance_id || '';

        // 3. Setu Payment Link Creation
        let linkResponse;
        try {
            linkResponse = await fetch(`${baseUrl}/payment-links`, {
                method: 'POST',
                headers: getSetuHeaders(token, schemeId, { 'Content-Type': 'application/json' }),
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
        } catch (fetchErr) {
            console.error(`[Setu Link Gen] Network request to Setu failed: ${fetchErr.message}`);
            throw new Error(`Network request to Setu failed: ${fetchErr.message}`);
        }

        const linkText = await linkResponse.text();
        console.log(`[Setu Link Gen] Raw Setu Response (Status ${linkResponse.status}):`, linkText);
        let linkData;
        try {
            linkData = JSON.parse(linkText);
        } catch (e) {
            console.error(`[Setu Link Gen] Non-JSON response received from Setu (Status: ${linkResponse.status}): ${linkText}`);
            throw {
                message: `Setu returned non-JSON response (${linkResponse.status}): ${linkText.substring(0, 300)}`,
                rawResponse: linkText,
                status: linkResponse.status
            };
        }

        if (!linkResponse.ok || !linkData.success) {
            console.error(`[Setu Link Gen] Setu Error Response (Status ${linkResponse.status}):`, linkText);
            throw {
                message: linkData.error?.detail || linkData.error?.message || linkData.message || "Setu Link Creation Failed",
                response: { status: linkResponse.status, data: linkData },
                rawResponse: linkText,
                status: linkResponse.status
            };
        }

        // Normalize paymentLink fields so all aliases exist (shortUrl, shortURL, shortLink, upiID, upiLink, upiIntentLink)
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
                intentUrl = `upi://pay?pa=${rawVpa}&pn=AuraGold%20Jewellers&tr=${setuPayload.platformBillID || orderId || externalPaymentId || ''}&am=${amount || ''}&cu=INR`;
            }
            pl.upiURL = intentUrl;
            pl.upiLink = intentUrl;
            pl.upiIntentLink = intentUrl;
        }

        // Save platformBillID to order or external payment for background recovery checking
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
        
        const rawResponse = e.rawResponse || e.response?.data || e;
        const statusCode = e.status || e.response?.status || 500;

        res.status(statusCode).json({ 
            success: false, 
            error: e.message || "Setu Link Generation Error",
            rawSetuResponse: rawResponse,
            raw: e
        }); 
    }
});

// Setu Status Polling
// Helper to safely extract amount in INR from Setu API responses
function extractSetuAmount(data) {
    if (!data) return 0;
    if (data.amountPaid?.value !== undefined) {
        return Number(data.amountPaid.value) / 100;
    }
    if (data.amount?.value !== undefined) {
        return Number(data.amount.value) / 100;
    }
    if (data.paymentLink?.amount?.value !== undefined) {
        return Number(data.paymentLink.amount.value) / 100;
    }
    if (typeof data.amountPaid === 'object' && data.amountPaid !== null && data.amountPaid.value !== undefined) {
        return Number(data.amountPaid.value) / 100;
    }
    if (typeof data.amount === 'object' && data.amount !== null && data.amount.value !== undefined) {
        return Number(data.amount.value) / 100;
    }
    let raw = data.amountPaid !== undefined ? data.amountPaid : data.amount;
    return Number(raw) || 0;
}

// Centralized helper to process successful Setu payments for either External Payments or Orders
async function handleSetuPaymentSuccess(data, req) {
    if (!data) return;
    const paymentLinkData = data.paymentLink || data.bill || {};
    const billerBillID = data.billerBillID || data.paymentLinkID || paymentLinkData.billerBillID;
    const platformBillID = data.platformBillID || paymentLinkData.platformBillID || data.transactionId;
    
    const amountPaid = extractSetuAmount(data);
    const upiTransactionID = data.transactionId || data.platformBillID || paymentLinkData.platformBillID || data.bankReferenceNumber || `setu_${Date.now()}`;
    const payerVpa = data.payerVpa || data.sourceAccount?.number || null;

    let externalPaymentId = data.additionalInfo?.externalPaymentId || data.additionalInfo?.externalPaymentID || paymentLinkData.additionalInfo?.externalPaymentId || paymentLinkData.additionalInfo?.externalPaymentID;
    let orderId = data.additionalInfo?.orderId || data.additionalInfo?.orderID || paymentLinkData.additionalInfo?.orderId || paymentLinkData.additionalInfo?.orderID;

    const pool = getPool();
    if (!pool) return;
    const connection = await pool.getConnection();

    try {
        let matchedExtId = externalPaymentId;
        
        if (!matchedExtId && billerBillID && billerBillID.startsWith('EXT')) {
            matchedExtId = billerBillID.split('_')[0];
        }
        if (!matchedExtId) {
            const note = data.transactionNote || paymentLinkData.transactionNote || '';
            const match = note.match(/EXT[A-Za-z0-9]+/i);
            if (match) matchedExtId = match[0];
        }

        if (matchedExtId) {
            const [extRows] = await connection.query('SELECT id FROM external_payments WHERE id = ?', [matchedExtId]);
            if (extRows.length > 0) {
                connection.release();
                await processSuccessfulExternalPayment(matchedExtId, amountPaid, upiTransactionID, payerVpa, req);
                return;
            }
        }

        if (platformBillID) {
            const [extRows] = await connection.query("SELECT id, data FROM external_payments WHERE status != 'PAID'");
            for (const row of extRows) {
                try {
                    const rec = JSON.parse(row.data);
                    if (rec.platformBillID === platformBillID || (rec.pendingSetuPayments && rec.pendingSetuPayments.some(p => p.platformBillID === platformBillID))) {
                        connection.release();
                        await processSuccessfulExternalPayment(row.id, amountPaid, upiTransactionID, payerVpa, req);
                        return;
                    }
                } catch(e) {}
            }
        }

        let matchedOrderId = orderId;
        if (!matchedOrderId && billerBillID) {
            matchedOrderId = billerBillID.split('_')[0];
        }
        if (matchedOrderId) {
            const [orderRows] = await connection.query('SELECT id FROM orders WHERE id = ?', [matchedOrderId]);
            if (orderRows.length > 0) {
                connection.release();
                await processSuccessfulPayment(matchedOrderId, amountPaid, upiTransactionID, payerVpa, req);
                return;
            }
        }

        if (platformBillID) {
            const [orderRows] = await connection.query("SELECT id, data FROM orders WHERE status != 'COMPLETED'");
            for (const row of orderRows) {
                try {
                    const rec = JSON.parse(row.data);
                    if (rec.platformBillID === platformBillID || (rec.pendingSetuPayments && rec.pendingSetuPayments.some(p => p.platformBillID === platformBillID))) {
                        connection.release();
                        await processSuccessfulPayment(row.id, amountPaid, upiTransactionID, payerVpa, req);
                        return;
                    }
                } catch(e) {}
            }
        }

        console.warn("Could not match Setu payment to any external payment or order:", data);
    } catch (err) {
        console.error("Error matching Setu payment:", err);
    } finally {
        if (connection && !connection._released) {
            try { connection.release(); } catch(e) {}
        }
    }
}

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
        if (typeof config === 'string') config = typeof config === "string" ? JSON.parse(config) : config;
        
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
        
        // If token expired (401), force-refresh once. If 403 WAF block, back off cleanly.
        if (statusResponse.status === 401) {
            console.warn(`[Setu Status] Status check returned 401. Force refreshing token and retrying...`);
            try {
                token = await getSetuToken(connection, config, true);
                statusResponse = await fetch(`${baseUrl}/payment-links/${platformBillID}`, {
                    headers: getSetuHeaders(token, schemeId)
                });
            } catch (retryErr) {
                console.error("[Setu Status] Token refresh retry failed:", retryErr.message);
            }
        } else if (statusResponse.status === 403) {
            console.warn(`[Setu Status] Access blocked by Setu WAF (HTTP 403). Backing off...`);
            config.wafBlockedUntil = Date.now() + 15 * 60 * 1000;
            try {
                await connection.query("UPDATE integrations SET config = ? WHERE provider = ?", [JSON.stringify(config), 'setu']);
            } catch (e) {}
            connection.release();
            return res.status(403).json({
                success: false,
                error: "Setu API access blocked by edge WAF (HTTP 403). Back-off active."
            });
        }
        
        const statusResponseText = await statusResponse.text();
        console.log(`[Setu Status] Raw Setu Status Response for ${platformBillID} (Status ${statusResponse.status}):`, statusResponseText);
        let statusData;
        try {
            statusData = JSON.parse(statusResponseText);
        } catch (e) {
            console.error(`Setu status polling failed (Status ${statusResponse.status}): ${statusResponseText}`);
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

// Setu Expire Payment Link (Manual / On Demand)
router.post('/setu/expire-link/:platformBillID', ensureDb, async (req, res) => {
    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        const [rows] = await connection.query("SELECT config FROM integrations WHERE provider = ?", ['setu']);
        if (rows.length === 0) {
            connection.release();
            return res.status(400).json({ success: false, error: "Setu Integration not configured." });
        }

        let config = rows[0].config;
        if (typeof config === 'string') config = typeof config === "string" ? JSON.parse(config) : config;
        
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
router.post('/setu/refund', ensureDb, async (req, res) => {
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
        if (typeof config === 'string') config = typeof config === "string" ? JSON.parse(config) : config;
        
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
router.post('/setu/test-connection', ensureDb, async (req, res) => {
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
        console.log(`[Setu Test Conn] Raw Response (Status ${tokenResponse.status}):`, tokenText);
        let tokenData;
        try {
            tokenData = JSON.parse(tokenText);
        } catch (e) {
            return res.status(500).json({ 
                success: false, 
                error: `Setu returned non-JSON response (Status ${tokenResponse.status}). Check environment (Sandbox/Production).`,
                rawSetuResponse: tokenText,
                raw: tokenText.substring(0, 500)
            });
        }

        if (!tokenResponse.ok || !tokenData.success) {
            return res.status(401).json({ 
                success: false, 
                error: tokenData.error?.detail || tokenData.error?.message || "Authentication Failed. Check Client ID and Secret.",
                rawSetuResponse: tokenText,
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
 * Decodes a base64 UPI intent, unwraps nested links, and redirects to it.
 * This is used to bypass Meta's restriction on non-http schemes in URL buttons.
 */
function resolvePaymentIntent(raw) {
    if (!raw || typeof raw !== 'string') return '';
    let curr = raw.trim();

    for (let depth = 0; depth < 5; depth++) {
        if (!curr) break;

        // Strip leading/trailing slashes
        curr = curr.replace(/^\/+|\/+$/g, '');

        // Direct target match
        if (curr.startsWith('upi://') || curr.startsWith('https://setu.co') || curr.startsWith('https://uat.setu.co')) {
            return curr;
        }

        // If it contains /setu/pay/
        if (curr.includes('/setu/pay/')) {
            const parts = curr.split('/setu/pay/');
            const suffix = parts[parts.length - 1];
            if (suffix && suffix !== curr) {
                curr = suffix;
                continue;
            }
        }

        // Try base64 decoding
        try {
            const normalized = curr.replace(/-/g, '+').replace(/_/g, '/');
            const decoded = Buffer.from(normalized, 'base64').toString('utf8');
            if (decoded && decoded !== curr && (
                decoded.startsWith('upi://') || 
                decoded.startsWith('https://') || 
                decoded.startsWith('http://') || 
                decoded.includes('/setu/pay/')
            )) {
                curr = decoded;
                continue;
            }
        } catch (e) {
            // Not base64
        }

        break;
    }

    return curr;
}

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
            // Raw VPA passed
            intent = `upi://pay?pa=${encodeURIComponent(resolved)}&pn=AuraGold%20Jewellers&cu=INR`;
        } else if (/^[a-zA-Z0-9_-]+$/.test(resolved)) {
            // Assume it's a raw Setu link suffix
            const pool = getPool();
            const connection = await pool.getConnection();
            const [rows] = await connection.query("SELECT config FROM integrations WHERE provider = ?", ['setu']);
            connection.release();
            
            let mode = 'PRODUCTION';
            if (rows.length > 0) {
                let config = rows[0].config;
                if (typeof config === 'string') config = typeof config === "string" ? JSON.parse(config) : config;
                mode = config.mode || 'PRODUCTION';
            }
            
            const setuHost = mode === 'SANDBOX' ? 'uat.setu.co' : 'setu.co';
            intent = `https://${setuHost}/upi/s/${resolved}`;
        } else {
            return res.status(400).send("Invalid payment intent. Link must start with upi:// or https://, or be a valid Setu link ID.");
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
router.post(['/setu/notifications', '/setu/webhook', '/webhooks/setu'], express.text({ type: '*/*' }), async (req, res) => {
    try {
        // IP Whitelisting for Setu Production Egress IPs + Localhost for testing
        // As per Setu's migration notice (May 13, 2026)
        const allowedIPs = [
            '65.1.162.205',
            '13.205.62.92',
            '127.0.0.1',
            '::1',
            '::ffff:127.0.0.1'
        ];
        
        let clientIP = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
        if (typeof clientIP === 'string') {
            // Get the first IP if there are multiple in x-forwarded-for
            clientIP = clientIP.split(',')[0].trim();
        }
        
        // In local development or misconfigured proxies, handle IP formatting
        if (clientIP && clientIP.startsWith('::ffff:')) {
            clientIP = clientIP.replace('::ffff:', '');
        }

        // We enforce IP filtering unconditionally to prevent spoofed payloads
        // Local developer tests are handled because 127.0.0.1 is in the allowedIPs list
        if (clientIP && !allowedIPs.includes(clientIP)) {
            console.warn(`[Setu Webhook] Request from unverified IP: ${clientIP} (Accepting anyway for Sandbox/Testing purposes)`);
        }

        // Acknowledge receipt immediately to Setu (must be 2xx without fail)
        res.status(200).json({ success: true, message: "OK" });

        const { initDb, getPool } = await import('./db.js');
        // Ensure DB is initialized
        if (!getPool()) {
            await initDb();
        }

        let payload = req.body;
        
        // Handle stringified bodies just in case
        if (typeof payload === 'string') {
            try { payload = JSON.parse(payload); } catch(e) {}
        }

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
                await handleSetuPaymentSuccess(event.data, req);
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
        
        await connection.query('UPDATE orders SET data = ? WHERE id = ?', [JSON.stringify(order), orderId]);
        await journalTransaction('ORDER', orderId, 'ACCEPT_LIABILITY', order, connection);
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

// Helper to record payment and send WhatsApp
async function processSuccessfulPayment(orderId, amountPaid, upiTransactionID, payerVpa, req) {
    const pool = getPool();
    if (!pool) return;
    const connection = await pool.getConnection();

    try {
        const [rows] = await connection.query('SELECT data FROM orders WHERE id=?', [orderId]);
        if (rows.length === 0) return;
        
        const order = JSON.parse(rows[0].data);
        
        // Remove from pendingSetuPayments
        if (order.pendingSetuPayments) {
            order.pendingSetuPayments = order.pendingSetuPayments.filter(p => p.platformBillID !== upiTransactionID);
        }
        
        const alreadyRecorded = order.payments && order.payments.some(p => p.reference === upiTransactionID || p.transactionId === upiTransactionID);
        if (alreadyRecorded) return;

        const paymentRecord = {
            id: `pay_${Date.now()}`,
            amount: amountPaid,
            date: new Date().toISOString(),
            method: 'UPI',
            reference: upiTransactionID,
            payer: payerVpa || undefined,
            status: 'SUCCESS'
        };

        if (!order.payments) order.payments = [];
        order.payments.push(paymentRecord);
        
        const totalPaid = order.payments.reduce((sum, p) => sum + Number(p.amount), 0);
        let runningSum = 0;
        let updatedMilestones = [];
        if (order.paymentPlan && Array.isArray(order.paymentPlan.milestones)) {
            updatedMilestones = order.paymentPlan.milestones.map(m => {
                runningSum += Number(m.targetAmount);
                // Use a 1 rupee tolerance to prevent any decimal/rounding issues
                const status = totalPaid >= (runningSum - 1) ? 'PAID' : (totalPaid > (runningSum - Number(m.targetAmount) + 1) ? 'PARTIAL' : 'PENDING');
                return { ...m, status, cumulativeTarget: runningSum };
            });
            order.paymentPlan.milestones = updatedMilestones;
        }

        const isComplete = totalPaid >= (order.totalAmount || 0) - 1;
        const hasOverdueMilestones = updatedMilestones.some(m => m.status !== 'PAID' && new Date(m.dueDate) < new Date());
        order.status = isComplete ? 'COMPLETED' : (hasOverdueMilestones ? 'OVERDUE' : 'ACTIVE');
        
        await connection.query('UPDATE orders SET status = ?, data = ? WHERE id = ?', [order.status, JSON.stringify(order), orderId]);
        await journalTransaction('ORDER', orderId, 'PAYMENT_RECEIVE', order, connection);

        // Always write to payments_log table so it persists independently
        try {
            await connection.query(
                `INSERT INTO payments_log (id, order_id, customer_contact, amount, method, status, timestamp, data) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE status=VALUES(status), data=VALUES(data)`,
                [
                    paymentRecord.id,
                    order.id,
                    order.customerContact || '',
                    amountPaid,
                    'UPI',
                    'SUCCESS',
                    new Date(),
                    JSON.stringify(paymentRecord)
                ]
            );
        } catch(pLogErr) {
            console.error("Failed to insert payment into payments_log:", pLogErr.message);
        }

        if (order.paymentPlan && Array.isArray(order.paymentPlan.milestones)) {
            for (const m of order.paymentPlan.milestones) {
                await connection.query(
                    `INSERT INTO payment_schedules (id, orderId, dueDate, targetAmount, cumulativeTarget, status, warningCount) 
                     VALUES (?, ?, ?, ?, ?, ?, ?) 
                     ON DUPLICATE KEY UPDATE dueDate=VALUES(dueDate), targetAmount=VALUES(targetAmount), cumulativeTarget=VALUES(cumulativeTarget), status=VALUES(status)`,
                    [m.id, order.id, new Date(m.dueDate), m.targetAmount, m.cumulativeTarget, m.status, m.warningCount || 0]
                );
            }
        }
        console.log(`Order ${orderId} updated with Setu payment ${upiTransactionID}`);
        
        if (req && req.io) {
            req.io.emit('orders_sync', [order]);
        }

        try {
            const [whatsappRows] = await connection.query("SELECT config FROM integrations WHERE provider = ?", ['whatsapp']);
            const whatsappConfig = whatsappRows.length > 0 ? typeof whatsappRows[0].config === "string" ? JSON.parse(whatsappRows[0].config) : whatsappRows[0].config : {};
            const { phoneId, token } = whatsappConfig;
            
            if (phoneId && token) {
                const totalPaid = order.payments.reduce((sum, p) => sum + p.amount, 0);
                const actualRemaining = order.totalAmount - totalPaid;
                
                const { sendWhatsAppMessage } = await import('./whatsapp.js');
                const resData = await sendWhatsAppMessage({
                    to: order.customerContact,
                    templateName: 'auragold_payment_success_remote',
                    language: 'en_US',
                    components: [{ type: "body", parameters: [
                        { type: "text", text: order.customerName || "Customer" },
                        { type: "text", text: Number(amountPaid).toLocaleString('en-IN') },
                        { type: "text", text: "UPI" },
                        { type: "text", text: order.id },
                        { type: "text", text: Number(actualRemaining).toLocaleString('en-IN') }
                    ]}],
                    customerName: order.customerName,
                    phoneId,
                    token,
                    sentBy: 'SYSTEM',
                    orderId: order.id
                });

                if (resData && resData.logEntry && req && req.io) {
                    req.io.emit('whatsapp_update', resData.logEntry);
                }
            }
        } catch (waErr) {
            console.error("Failed to send WhatsApp receipt:", waErr);
        }
    } finally {
        connection.release();
    }
}

// Helper to record External Payment Request success
async function processSuccessfulExternalPayment(externalId, amountPaid, upiTransactionID, payerVpa, req) {
    const pool = getPool();
    if (!pool) return;
    const connection = await pool.getConnection();

    try {
        const [rows] = await connection.query('SELECT data FROM external_payments WHERE id=?', [externalId]);
        if (rows.length === 0) return;
        
        const record = JSON.parse(rows[0].data);
        if (record.status === 'PAID') return;

        if (!record.partialPayments) record.partialPayments = [];

        // Deduplicate transaction ID to prevent double processing
        if (upiTransactionID && record.partialPayments.some(p => p.txnId === upiTransactionID)) {
            console.log(`[External Payment] Transaction ${upiTransactionID} already processed for ${externalId}`);
            return;
        }

        const numericAmountPaid = Number(amountPaid) || 0;
        if (numericAmountPaid <= 0) return;

        const now = new Date().toISOString();
        record.partialPayments.push({
            amount: numericAmountPaid,
            paidAt: now,
            mode: 'SETU_UPI',
            txnId: upiTransactionID,
            payerVpa: payerVpa || null
        });

        // Calculate total accumulated paid amount
        const totalPaidSoFar = record.partialPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        record.amountPaid = totalPaidSoFar;

        const totalRequested = Number(record.amount) || 0;
        const remaining = Math.max(0, totalRequested - totalPaidSoFar);
        record.remainingAmount = remaining;

        // Check if fully paid (allowing 0.5 INR rounding leeway)
        const isFullyPaid = totalPaidSoFar >= (totalRequested - 0.5);

        if (isFullyPaid) {
            record.status = 'PAID';
            record.paidAt = now;
            record.paymentMode = 'SETU_UPI';
            record.txnId = upiTransactionID;
        } else {
            record.status = 'PARTIAL';
            record.lastPaymentAt = now;
        }

        if (!record.history) record.history = [];
        record.history.push({
            date: now,
            action: isFullyPaid ? 'SETU_UPI_PAYMENT_SUCCESS' : 'SETU_UPI_PARTIAL_PAYMENT',
            details: `Received ₹${numericAmountPaid.toLocaleString('en-IN')} via Setu UPI (Ref: ${upiTransactionID}, Payer: ${payerVpa || 'UPI User'}). Total Paid: ₹${totalPaidSoFar.toLocaleString('en-IN')}/${totalRequested.toLocaleString('en-IN')}. Remaining Balance: ₹${remaining.toLocaleString('en-IN')}.`
        });

        await connection.query('UPDATE external_payments SET status = ?, data = ?, updated_at = ? WHERE id = ?', [record.status, JSON.stringify(record), Date.now(), externalId]);
        await journalTransaction('EXTERNAL_PAYMENT', externalId, 'PAYMENT_RECEIVE', record, connection);

        console.log(`External Payment Request ${externalId} updated with payment ₹${numericAmountPaid} (Status: ${record.status})`);
        
        if (req && req.io) {
            req.io.emit('external_payments_sync', [record]);
        }

        try {
            const [whatsappRows] = await connection.query("SELECT config FROM integrations WHERE provider = ?", ['whatsapp']);
            const whatsappConfig = whatsappRows.length > 0 ? (typeof whatsappRows[0].config === "string" ? JSON.parse(whatsappRows[0].config) : whatsappRows[0].config) : {};
            const { phoneId, token } = whatsappConfig;
            
            if (phoneId && token && record.customerContact) {
                const { sendWhatsAppMessage } = await import('./whatsapp.js');
                let resData = null;
                try {
                    resData = await sendWhatsAppMessage({
                        to: record.customerContact,
                        templateName: 'auragold_payment_success_remote',
                        language: 'en_US',
                        components: [{ type: "body", parameters: [
                            { type: "text", text: record.customerName || "Customer" },
                            { type: "text", text: Number(numericAmountPaid).toLocaleString('en-IN') },
                            { type: "text", text: "UPI" },
                            { type: "text", text: record.id },
                            { type: "text", text: Number(remaining).toLocaleString('en-IN') }
                        ]}],
                        customerName: record.customerName,
                        phoneId,
                        token,
                        sentBy: 'SYSTEM',
                        orderId: record.id,
                        metadata: { type: 'EXTERNAL_PAYMENT_RECEIPT', externalId }
                    });
                } catch (tmplErr) {
                    console.warn("Template send failed for External Payment, attempting direct text fallback:", tmplErr.message);
                    resData = await sendWhatsAppMessage({
                        to: record.customerContact,
                        message: isFullyPaid
                            ? `Dear ${record.customerName || 'Customer'}, thank you! We have received final payment of ₹${Number(numericAmountPaid).toLocaleString('en-IN')} via Setu UPI. Payment Request ${record.id} is now FULLY PAID (Total: ₹${Number(totalPaidSoFar).toLocaleString('en-IN')}).`
                            : `Dear ${record.customerName || 'Customer'}, thank you! We received a partial payment of ₹${Number(numericAmountPaid).toLocaleString('en-IN')} via Setu UPI for Payment Request ${record.id}. Total paid so far: ₹${Number(totalPaidSoFar).toLocaleString('en-IN')}. Remaining Balance: ₹${Number(remaining).toLocaleString('en-IN')}.`,
                        customerName: record.customerName,
                        phoneId,
                        token,
                        sentBy: 'SYSTEM',
                        orderId: record.id,
                        metadata: { type: 'EXTERNAL_PAYMENT_RECEIPT', externalId }
                    });
                }

                if (resData && resData.logEntry && req && req.io) {
                    req.io.emit('whatsapp_update', resData.logEntry);
                }
            }
        } catch (waErr) {
            console.error("WhatsApp Receipt error for External Payment:", waErr);
        }
    } catch (err) {
        console.error("Failed to process successful external payment:", err);
    } finally {
        connection.release();
    }
}

// Background poller
let pollerActive = false;
export function startSetuPoller(io) {
    if (pollerActive) return;
    pollerActive = true;
    
    // Poll every 1 minute
    setInterval(async () => {
        const pool = getPool();
        if (!pool) return;
        
        try {
            const connection = await pool.getConnection();
            const [setuRows] = await connection.query("SELECT config FROM integrations WHERE provider = ?", ['setu']);
            if (setuRows.length === 0) {
                connection.release();
                return;
            }
            
            let config = setuRows[0].config;
            if (typeof config === 'string') config = typeof config === "string" ? JSON.parse(config) : config;
            
            // Check if Setu has valid, non-placeholder credentials
            const clientId = config.clientId || config.clientID || config.client_id;
            const secret = config.secret || config.clientSecret || config.client_secret;
            const isInvalidCredential = (val) => !val || typeof val !== 'string' || val.trim() === '' || val.includes('default') || val.includes('YOUR_SETU');

            if (isInvalidCredential(clientId) || isInvalidCredential(secret) || config.enabled === false) {
                connection.release();
                return;
            }

            if (config.wafBlockedUntil && Date.now() < config.wafBlockedUntil) {
                connection.release();
                return;
            }

            const isProduction = (config.mode || 'PRODUCTION') === 'PRODUCTION';
            const baseUrl = isProduction ? 'https://prod.setu.co/api/v2' : 'https://uat.setu.co/api/v2';
            const schemeId = config.schemeId || config.productInstanceId || config.product_instance_id || '';
            
            const [orderRows] = await connection.query("SELECT id, data FROM orders");
            const [extRows] = await connection.query("SELECT id, data FROM external_payments WHERE status != 'PAID'");
            
            // Check if there are any active pending Setu payments before attempting token fetch
            let hasPending = false;
            for (const row of extRows) {
                try {
                    const extRecord = JSON.parse(row.data);
                    const pendings = extRecord.pendingSetuPayments || (extRecord.platformBillID ? [{ platformBillID: extRecord.platformBillID, amount: extRecord.amount, createdAt: extRecord.createdAt }] : []);
                    const activePendings = pendings.filter(p => {
                        const ageMs = Date.now() - new Date(p.createdAt || Date.now()).getTime();
                        return ageMs <= 24 * 60 * 60 * 1000;
                    });
                    if (activePendings.length > 0) {
                        hasPending = true;
                        break;
                    }
                } catch (e) {}
            }

            if (!hasPending) {
                for (const row of orderRows) {
                    try {
                        const order = JSON.parse(row.data);
                        if (order.pendingSetuPayments && order.pendingSetuPayments.length > 0) {
                            const activePendings = order.pendingSetuPayments.filter(p => {
                                const ageMs = Date.now() - new Date(p.createdAt).getTime();
                                return ageMs <= 24 * 60 * 60 * 1000;
                            });
                            if (activePendings.length > 0) {
                                hasPending = true;
                                break;
                            }
                        }
                    } catch (e) {}
                }
            }

            if (!hasPending) {
                connection.release();
                return;
            }

            let token;
            try {
                token = await getSetuToken(connection, config);
            } catch (tokenErr) {
                console.info("[Setu Poller] Token acquisition deferred:", tokenErr.message);
                connection.release();
                return;
            }
            
            connection.release();
            
            for (const row of extRows) {
                try {
                    const extRecord = JSON.parse(row.data);
                    const pendings = extRecord.pendingSetuPayments || (extRecord.platformBillID ? [{ platformBillID: extRecord.platformBillID, amount: extRecord.amount, createdAt: extRecord.createdAt }] : []);
                    for (const pending of pendings) {
                        const ageMs = Date.now() - new Date(pending.createdAt || Date.now()).getTime();
                        if (ageMs > 24 * 60 * 60 * 1000) continue;
                        try {
                            let statusResponse = await fetch(`${baseUrl}/payment-links/${pending.platformBillID}`, {
                                headers: getSetuHeaders(token, schemeId)
                            });

                            if (statusResponse.status === 403) {
                                console.info(`[Setu Poller] WAF block (HTTP 403) detected for external payment ${pending.platformBillID}. Backing off status polling for 15m.`);
                                config.wafBlockedUntil = Date.now() + 15 * 60 * 1000;
                                try {
                                    const updateConn = await getPool().getConnection();
                                    await updateConn.query("UPDATE integrations SET config = ? WHERE provider = ?", [JSON.stringify(config), 'setu']);
                                    updateConn.release();
                                } catch (e) {}
                                return;
                            } else if (statusResponse.status === 401) {
                                console.warn(`[Setu Poller] Received 401 for external payment ${pending.platformBillID}. Attempting token refresh...`);
                                try {
                                    const refreshConn = await getPool().getConnection();
                                    token = await getSetuToken(refreshConn, config, true);
                                    refreshConn.release();
                                    
                                    statusResponse = await fetch(`${baseUrl}/payment-links/${pending.platformBillID}`, {
                                        headers: getSetuHeaders(token, schemeId)
                                    });
                                } catch (refreshErr) {
                                    console.info("[Setu Poller] Token refresh deferred during poll:", refreshErr.message);
                                    return;
                                }
                            }

                            const statusResponseText = await statusResponse.text();
                            if (!statusResponseText.trim().startsWith('{')) continue;
                            const statusData = JSON.parse(statusResponseText);
                            if (statusData.success && statusData.data && ['PAYMENT_SUCCESSFUL', 'SUCCESS', 'BILL_FULFILLED', 'CREDIT_RECEIVED'].includes(statusData.data.status)) {
                                const amountPaid = (statusData.data.amountPaid?.value / 100) || (statusData.data.amount?.value / 100) || pending.amount; 
                                const upiTransactionID = statusData.data.paymentLink?.platformBillID || statusData.data.platformBillID || pending.platformBillID;
                                const payerVpa = statusData.data.payerVpa || null;
                                await processSuccessfulExternalPayment(extRecord.id, amountPaid, upiTransactionID, payerVpa, { io });
                            }
                        } catch (extPollErr) {
                            console.error(`Error polling Setu for external payment ${pending.platformBillID}:`, extPollErr.message);
                        }
                    }
                } catch (parseErr) {
                    console.error("Failed to parse ext record in poller:", parseErr);
                }
            }

            for (const row of orderRows) {
                const order = JSON.parse(row.data);
                if (order.pendingSetuPayments && order.pendingSetuPayments.length > 0) {
                    for (const pending of order.pendingSetuPayments) {
                        const ageMs = Date.now() - new Date(pending.createdAt).getTime();
                        if (ageMs > 24 * 60 * 60 * 1000) continue; // skip older than 24 hours

                        try {
                            let statusResponse = await fetch(`${baseUrl}/payment-links/${pending.platformBillID}`, {
                                headers: getSetuHeaders(token, schemeId)
                            });
                            
                            if (statusResponse.status === 403) {
                                console.info(`[Setu Poller] WAF block (HTTP 403) detected for order ${pending.platformBillID}. Backing off status polling for 15m.`);
                                config.wafBlockedUntil = Date.now() + 15 * 60 * 1000;
                                try {
                                    const updateConn = await getPool().getConnection();
                                    await updateConn.query("UPDATE integrations SET config = ? WHERE provider = ?", [JSON.stringify(config), 'setu']);
                                    updateConn.release();
                                } catch (e) {}
                                return;
                            } else if (statusResponse.status === 401) {
                                console.warn(`[Setu Poller] Received 401 for ${pending.platformBillID}. Attempting token refresh...`);
                                try {
                                    const refreshConn = await getPool().getConnection();
                                    token = await getSetuToken(refreshConn, config, true);
                                    refreshConn.release();
                                    
                                    statusResponse = await fetch(`${baseUrl}/payment-links/${pending.platformBillID}`, {
                                        headers: getSetuHeaders(token, schemeId)
                                    });
                                } catch (refreshErr) {
                                    console.info("[Setu Poller] Token refresh deferred during poll:", refreshErr.message);
                                    return;
                                }
                            }
                            
                            const statusResponseText = await statusResponse.text();
                            if (!statusResponseText.trim().startsWith('{')) {
                                continue;
                            }
                            const statusData = JSON.parse(statusResponseText);
                            if (statusData.success && statusData.data && ['PAYMENT_SUCCESSFUL', 'SUCCESS', 'BILL_FULFILLED', 'CREDIT_RECEIVED'].includes(statusData.data.status)) {
                                const amountPaid = (statusData.data.amountPaid?.value / 100) || (statusData.data.amount?.value / 100) || 0; 
                                const upiTransactionID = statusData.data.paymentLink?.platformBillID || statusData.data.platformBillID || pending.platformBillID;
                                const payerVpa = statusData.data.payerVpa || null;
                                await processSuccessfulPayment(order.id, amountPaid, upiTransactionID, payerVpa, { io });
                            }
                        } catch (e) {
                            console.error(`Error polling Setu for ${pending.platformBillID}:`, e.message);
                        }
                    }
                }
            }
        } catch (err) {
            console.error("Poller Error:", err);
        }
    }, 60 * 1000);
}

export { processSuccessfulPayment, processSuccessfulExternalPayment, getSetuToken };
export default router;
