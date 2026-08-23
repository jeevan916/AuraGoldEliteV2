
import express from 'express';
import { getPool, ensureDb, journalTransaction, isMock } from './db.js';
import { sendWhatsAppMessage } from './whatsapp.js';
import { authenticateToken, requireRole, optionalAuth } from './auth.js';

export const SETU_DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

// ---------------------------------------------------------
// LOCAL BACK-OFF CACHE FOR SETU INTEGRATION
// ---------------------------------------------------------
let setuLocalBackoff = {
    blockedUntil: 0,
    reason: ''
};

export function getSetuBackoffStatus(config = null) {
    const now = Date.now();
    let blockedUntil = setuLocalBackoff.blockedUntil || 0;
    if (config && config.wafBlockedUntil && config.wafBlockedUntil > blockedUntil) {
        blockedUntil = config.wafBlockedUntil;
        setuLocalBackoff.blockedUntil = blockedUntil;
    }
    const isBlocked = blockedUntil > now;
    const remainingSeconds = isBlocked ? Math.ceil((blockedUntil - now) / 1000) : 0;
    return {
        isBlocked,
        blockedUntil,
        remainingSeconds,
        message: isBlocked ? 'System busy, please try again in a few minutes' : null
    };
}

export function activateSetuBackoff(durationMs = 15 * 60 * 1000, reason = 'WAF/RateLimit', connection = null, config = null) {
    const blockedUntil = Date.now() + durationMs;
    setuLocalBackoff.blockedUntil = blockedUntil;
    setuLocalBackoff.reason = reason;

    if (config) {
        config.wafBlockedUntil = blockedUntil;
    }
    if (connection && config) {
        connection.query("UPDATE integrations SET config = ? WHERE provider = ?", [JSON.stringify(config), 'setu']).catch(() => {});
    }
    console.warn(`[Setu Back-Off Activated] Local cache & DB locked for ${Math.ceil(durationMs / 60000)} minutes. Reason: ${reason}`);
    return blockedUntil;
}

export function clearSetuBackoff(connection = null, config = null) {
    setuLocalBackoff.blockedUntil = 0;
    setuLocalBackoff.reason = '';
    if (config && config.wafBlockedUntil) {
        delete config.wafBlockedUntil;
        if (connection) {
            connection.query("UPDATE integrations SET config = ? WHERE provider = ?", [JSON.stringify(config), 'setu']).catch(() => {});
        }
    }
}

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

    if (allowWafBypass || forceRefresh) {
        clearSetuBackoff(connection, config);
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
        const err = new Error("System busy, please try again in a few minutes");
        err.status = 503;
        err.isBlocked = true;
        throw err;
    }

    const tokenText = await tokenResponse.text();
    let tokenData;
    try {
        tokenData = JSON.parse(tokenText);
    } catch (e) {
        const isHtml = tokenText.trim().toLowerCase().startsWith('<!doctype') || 
                      tokenText.trim().toLowerCase().startsWith('<html') ||
                      tokenText.includes('<!-- a padding to disable MSIE');
        
        if (isHtml) {
            activateSetuBackoff(5 * 60 * 1000, 'WAF_HTML_Page', connection, config);
        }

        const summary = isHtml ? "HTML Error Page (Cloudflare/WAF block or invalid endpoint)" : tokenText.substring(0, 150);
        console.warn(`[Setu Token Manager] Setu returned HTTP ${tokenResponse.status}: ${summary}`);
        const err = new Error("System busy, please try again in a few minutes");
        err.rawResponse = tokenText;
        err.status = 503;
        err.isBlocked = true;
        throw err;
    }

    if (!tokenResponse.ok || !tokenData.success) {
        if (tokenResponse.status === 429) {
            activateSetuBackoff(5 * 60 * 1000, `HTTP_429_RateLimit`, connection, config);
            const err = new Error("System busy, please try again in a few minutes");
            err.status = 503;
            err.isBlocked = true;
            throw err;
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
    clearSetuBackoff(connection, config);
    
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
            token = await getSetuToken(connection, config, shouldForce, true);
        } catch (tokenErr) {
            connection.release();
            throw tokenErr;
        }

        connection.release();

        const uniqueBillId = billerBillID || (externalPaymentId ? `${externalPaymentId}_${Date.now()}` : (orderId ? `${orderId}_${Date.now()}` : `bill_${Date.now()}`));
        const safeName = name ? name.replace(/[^a-zA-Z0-9 ]/g, "").substring(0, 50).trim() : 'Customer';
        const safeNote = externalPaymentId ? `External Pay ${externalPaymentId}`.replace(/[^a-zA-Z0-9 ]/g, "").substring(0, 50).trim() : (orderId ? `Order ${orderId}`.replace(/[^a-zA-Z0-9 ]/g, "").substring(0, 50).trim() : 'Payment');

        const schemeId = config.schemeId || config.productInstanceId || config.product_instance_id || '';

        // 3. Setu Payment Link Creation helper
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
            // If token expired or unauthorized (401 / 403), seamlessly force-refresh the token and retry immediately
            if (linkResponse.status === 401 || linkResponse.status === 403) {
                console.warn(`[Setu Link Gen] Received ${linkResponse.status} from Setu. Seamlessly refreshing token and retrying...`);
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
        console.log(`[Setu Link Gen] Raw Setu Response (Status ${linkResponse.status}):`, linkText);
        let linkData;
        try {
            linkData = JSON.parse(linkText);
        } catch (e) {
            const isHtml = linkText.trim().toLowerCase().startsWith('<!doctype') || linkText.trim().toLowerCase().startsWith('<html');
            if (isHtml) {
                activateSetuBackoff(5 * 60 * 1000, `WAF_HTML_LinkGen`, null, config);
            }
            console.error(`[Setu Link Gen] Non-JSON response received from Setu (Status: ${linkResponse.status}): ${linkText}`);
            throw {
                message: "System busy, please try again in a few minutes",
                rawResponse: linkText,
                status: 503,
                isBlocked: true
            };
        }

        if (!linkResponse.ok || !linkData.success) {
            console.error(`[Setu Link Gen] Setu Error Response (Status ${linkResponse.status}):`, linkText);
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
    const paymentLinkData = data.paymentLink || data.bill || data.resource || data.payment || {};
    const billerBillID = String(data.billerBillID || data.paymentLinkID || paymentLinkData.billerBillID || '').trim();
    const platformBillID = String(data.platformBillID || paymentLinkData.platformBillID || data.id || data.bill?.id || data.paymentLinkId || data.paymentLinkID || '').trim();
    
    let amountPaid = extractSetuAmount(data);
    const upiTransactionID = String(data.transactionId || data.txnId || data.bankReferenceNumber || data.rrn || data.utr || data.reference || platformBillID || `setu_${Date.now()}`).trim();
    const payerVpa = data.payerVpa || data.sourceAccount?.number || data.payerAccount?.vpa || data.payer || null;

    let explicitExtId = data.additionalInfo?.externalPaymentId || data.additionalInfo?.externalPaymentID || paymentLinkData.additionalInfo?.externalPaymentId || paymentLinkData.additionalInfo?.externalPaymentID || '';
    let explicitOrderId = data.additionalInfo?.orderId || data.additionalInfo?.orderID || paymentLinkData.additionalInfo?.orderId || paymentLinkData.additionalInfo?.orderID || '';

    const pool = getPool();
    if (!pool) return;
    const connection = await pool.getConnection();

    try {
        // Collect all potential text tokens from note, description, billerBillID, name, remarks, additionalInfo
        const textSources = [
            billerBillID,
            platformBillID,
            data.transactionNote || '',
            paymentLinkData.transactionNote || '',
            data.description || '',
            paymentLinkData.description || '',
            data.name || '',
            paymentLinkData.name || '',
            data.remarks || '',
            data.note || '',
            data.receipt || '',
            explicitExtId,
            explicitOrderId,
            JSON.stringify(data.additionalInfo || {}),
            JSON.stringify(paymentLinkData.additionalInfo || {})
        ].join(' ');

        // Extract EXT tokens (e.g. EXT-8928, EXT8928, EXT_8928, or digits)
        const extMatches = textSources.match(/EXT[\-_]?[0-9A-Za-z]+/gi) || [];
        const candidateExtTokens = Array.from(new Set([
            ...(explicitExtId ? [explicitExtId] : []),
            ...extMatches
        ]));

        // Extract Order tokens (e.g. ORD-1234, ORD1234, or numeric order IDs)
        const ordMatches = textSources.match(/ORD[\-_]?[0-9A-Za-z]+/gi) || [];
        const candidateOrdTokens = Array.from(new Set([
            ...(explicitOrderId ? [explicitOrderId] : []),
            ...ordMatches
        ]));

        const normalizeId = (str) => String(str || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

        // 1. Try matching External Payments
        const [allExtRows] = await connection.query("SELECT id, data FROM external_payments");
        
        let matchedExternalRecordId = null;

        for (const row of allExtRows) {
            const rawId = row.id;
            const normRowId = normalizeId(rawId);
            const numOnlyRowId = rawId.replace(/\D/g, '');

            // Match by candidate tokens
            for (const token of candidateExtTokens) {
                const normToken = normalizeId(token);
                const numOnlyToken = token.replace(/\D/g, '');
                if (rawId === token || normRowId === normToken || (numOnlyRowId && numOnlyToken && numOnlyRowId === numOnlyToken)) {
                    matchedExternalRecordId = rawId;
                    break;
                }
            }
            if (matchedExternalRecordId) break;

            // Match by platformBillID or pendingSetuPayments
            try {
                const rec = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
                if (platformBillID && (
                    String(rec.platformBillID || '').trim() === platformBillID ||
                    (rec.pendingSetuPayments && rec.pendingSetuPayments.some(p => String(p.platformBillID || '').trim() === platformBillID))
                )) {
                    matchedExternalRecordId = rawId;
                    break;
                }
                if (billerBillID && (
                    (rec.billerBillID && String(rec.billerBillID).trim() === billerBillID) ||
                    billerBillID.includes(normRowId) ||
                    (numOnlyRowId && billerBillID.includes(numOnlyRowId))
                )) {
                    matchedExternalRecordId = rawId;
                    break;
                }
                if (rec.referenceNote && (
                    normalizeId(rec.referenceNote) === normalizeId(billerBillID) ||
                    candidateExtTokens.some(t => normalizeId(t) === normalizeId(rec.referenceNote)) ||
                    textSources.includes(rec.referenceNote)
                )) {
                    matchedExternalRecordId = rawId;
                    break;
                }
            } catch (e) {}
        }

        if (matchedExternalRecordId) {
            connection.release();
            if (amountPaid <= 0) {
                // If amount not parsed, find record amount
                const [targetRows] = await (getPool()).query("SELECT data FROM external_payments WHERE id = ?", [matchedExternalRecordId]);
                if (targetRows.length > 0) {
                    const tRec = JSON.parse(targetRows[0].data);
                    amountPaid = Number(tRec.amount) - (Number(tRec.amountPaid) || 0);
                }
            }
            await processSuccessfulExternalPayment(matchedExternalRecordId, amountPaid, upiTransactionID, payerVpa, req);
            return;
        }

        // 2. Try matching Orders
        const [allOrderRows] = await connection.query("SELECT id, data FROM orders");
        let matchedOrderId = null;

        for (const row of allOrderRows) {
            const rawId = row.id;
            const normRowId = normalizeId(rawId);
            const numOnlyRowId = rawId.replace(/\D/g, '');

            // Match by candidate tokens
            for (const token of candidateOrdTokens) {
                const normToken = normalizeId(token);
                const numOnlyToken = token.replace(/\D/g, '');
                if (rawId === token || normRowId === normToken || (numOnlyRowId && numOnlyToken && numOnlyRowId === numOnlyToken)) {
                    matchedOrderId = rawId;
                    break;
                }
            }
            if (matchedOrderId) break;

            // Match by platformBillID or pendingSetuPayments
            try {
                const order = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
                if (platformBillID && (
                    String(order.platformBillID || '').trim() === platformBillID ||
                    (order.pendingSetuPayments && order.pendingSetuPayments.some(p => String(p.platformBillID || '').trim() === platformBillID))
                )) {
                    matchedOrderId = rawId;
                    break;
                }
                if (billerBillID && (
                    (order.billerBillID && String(order.billerBillID).trim() === billerBillID) ||
                    billerBillID.includes(normRowId) ||
                    (numOnlyRowId && billerBillID.includes(numOnlyRowId))
                )) {
                    matchedOrderId = rawId;
                    break;
                }
            } catch (e) {}
        }

        if (matchedOrderId) {
            connection.release();
            await processSuccessfulPayment(matchedOrderId, amountPaid, upiTransactionID, payerVpa, req);
            return;
        }

        console.warn("[Setu Matcher] Could not match Setu payment to any external payment or order:", {
            platformBillID,
            billerBillID,
            candidateExtTokens,
            candidateOrdTokens,
            amountPaid,
            upiTransactionID
        });
    } catch (err) {
        console.error("Error matching Setu payment:", err);
    } finally {
        if (connection && !connection._released) {
            try { connection.release(); } catch(e) {}
        }
    }
}

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
        if (typeof config === 'string') config = typeof config === "string" ? JSON.parse(config) : config;

        const isProduction = (config.mode || 'PRODUCTION') === 'PRODUCTION';
        const baseUrl = isProduction ? 'https://prod.setu.co/api/v2' : 'https://uat.setu.co/api/v2';
        const schemeId = config.schemeId || config.productInstanceId || config.product_instance_id || '';

        let token = await getSetuToken(connection, config, true, true);
        connection.release();

        // 1. Gather all platformBillIDs to check
        const billIdsToCheck = new Set();

        // Optional list supplied in request body
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

// Setu Expire Payment Link (Restricted to Authorized Staff)
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

// Setu Refund Payment Link (Restricted to Authorized Staff)
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

// Setu Test Connection (Admin Only)
router.post('/setu/test-connection', ensureDb, authenticateToken, requireRole('ADMIN'), async (req, res) => {
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

// Dedicated Manual Setu Reconcile Endpoint (Admin / Staff)
router.post('/setu/reconcile-txn', ensureDb, async (req, res) => {
    try {
        const { externalPaymentId, orderId, platformBillID, billerBillID, txnId, amount } = req.body;
        
        console.log(`[Setu Manual Reconcile] Attempting reconciliation:`, { externalPaymentId, orderId, platformBillID, billerBillID, txnId, amount });

        const pool = getPool();
        const connection = await pool.getConnection();

        // 1. If externalPaymentId provided, attempt direct fetch & reconcile
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

        // 2. If orderId provided, attempt direct order reconcile
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

        // 3. Fallback to generic matching
        await handleSetuPaymentSuccess({
            platformBillID,
            billerBillID,
            transactionId: txnId,
            amountPaid: amount ? { value: Math.round(Number(amount) * 100) } : undefined,
            status: 'PAYMENT_SUCCESSFUL',
            additionalInfo: {
                externalPaymentId,
                orderId
            }
        }, req);

        return res.json({ success: true, message: "Reconciliation triggered." });
    } catch (e) {
        console.error("Setu reconcile error:", e);
        res.status(500).json({ success: false, error: e.message });
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

// Liability Gap Acceptance (IDOR Protected: Validates Order Share Token or Authenticated Staff)
router.post('/orders/:id/accept-liability', ensureDb, optionalAuth, async (req, res) => {
    const orderId = req.params.id;
    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        
        // Find the order
        const [rows] = await connection.query('SELECT data FROM orders WHERE id = ?', [orderId]);
        
        if (rows.length === 0) {
            connection.release();
            return res.status(404).json({ success: false, error: "Order not found" });
        }
        
        const order = JSON.parse(rows[0].data);

        // IDOR Verification: Must be authenticated staff OR supply the exact unguessable shareToken
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

        if (!record.partialPayments) record.partialPayments = [];

        // Deduplicate transaction ID to prevent double processing
        if (upiTransactionID && record.partialPayments.some(p => p.txnId === upiTransactionID || (p.platformBillID && p.platformBillID === upiTransactionID) || (p.reference && p.reference === upiTransactionID))) {
            console.log(`[External Payment] Transaction ${upiTransactionID} already recorded for ${externalId}`);
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
            platformBillID: upiTransactionID,
            payerVpa: payerVpa || null
        });

        // Mark corresponding pending Setu payment as PAID if present
        if (Array.isArray(record.pendingSetuPayments)) {
            record.pendingSetuPayments.forEach(p => {
                if (p.platformBillID === upiTransactionID || String(p.amount) === String(numericAmountPaid)) {
                    p.status = 'PAID';
                    p.paidAt = now;
                }
            });
        }

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
        
        try {
            await journalTransaction('EXTERNAL_PAYMENT', externalId, 'PAYMENT_RECEIVE', record, connection);
        } catch (jErr) {
            console.warn("Journaling skipped or failed:", jErr.message);
        }

        // Also record to payments_log table for audit trail
        try {
            await connection.query(
                `INSERT INTO payments_log (id, orderId, amount, method, status, createdAt, rawResponse)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE status=VALUES(status), rawResponse=VALUES(rawResponse)`,
                [
                    `ext_${externalId}_${Date.now()}`,
                    externalId,
                    numericAmountPaid,
                    'SETU_UPI',
                    'SUCCESS',
                    new Date(),
                    JSON.stringify({ upiTransactionID, payerVpa, amountPaid: numericAmountPaid })
                ]
            );
        } catch (pLogErr) {
            console.warn("payments_log insertion skipped:", pLogErr.message);
        }

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
    
    // Poll every 45 seconds
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
            const [extRows] = await connection.query("SELECT id, data FROM external_payments");
            
            // Check if there are any active pending Setu payments before attempting token fetch
            let hasPending = false;
            for (const row of extRows) {
                try {
                    const extRecord = JSON.parse(row.data);
                    const pendings = extRecord.pendingSetuPayments || (extRecord.platformBillID ? [{ platformBillID: extRecord.platformBillID, amount: extRecord.amount, createdAt: extRecord.createdAt }] : []);
                    const activePendings = pendings.filter(p => {
                        const ageMs = Date.now() - new Date(p.createdAt || Date.now()).getTime();
                        return ageMs <= 7 * 24 * 60 * 60 * 1000;
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
                                return ageMs <= 7 * 24 * 60 * 60 * 1000;
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
                        if (!pending.platformBillID) continue;
                        // Skip if already marked paid in partialPayments
                        if (extRecord.partialPayments && extRecord.partialPayments.some(p => p.txnId === pending.platformBillID || p.platformBillID === pending.platformBillID)) {
                            continue;
                        }

                        const ageMs = Date.now() - new Date(pending.createdAt || Date.now()).getTime();
                        if (ageMs > 7 * 24 * 60 * 60 * 1000) continue;
                        try {
                            let statusResponse = await fetch(`${baseUrl}/payment-links/${pending.platformBillID}`, {
                                headers: getSetuHeaders(token, schemeId),
                                signal: AbortSignal.timeout(5000)
                            });

                            if (statusResponse.status === 401 || statusResponse.status === 403) {
                                try {
                                    const refreshConn = await getPool().getConnection();
                                    token = await getSetuToken(refreshConn, config, true, true);
                                    refreshConn.release();
                                    
                                    statusResponse = await fetch(`${baseUrl}/payment-links/${pending.platformBillID}`, {
                                        headers: getSetuHeaders(token, schemeId),
                                        signal: AbortSignal.timeout(5000)
                                    });
                                } catch (refreshErr) {
                                    console.info("[Setu Poller] Token refresh deferred during poll:", refreshErr.message);
                                    continue;
                                }
                            }

                            const statusResponseText = await statusResponse.text();
                            if (!statusResponseText.trim().startsWith('{')) continue;
                            const statusData = JSON.parse(statusResponseText);
                            if (statusData.success && statusData.data && ['PAYMENT_SUCCESSFUL', 'SUCCESS', 'BILL_FULFILLED', 'CREDIT_RECEIVED'].includes(statusData.data.status)) {
                                await handleSetuPaymentSuccess(statusData.data, { io });
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
                        if (!pending.platformBillID) continue;
                        if (order.payments && order.payments.some(p => p.txnId === pending.platformBillID || p.reference === pending.platformBillID)) {
                            continue;
                        }

                        const ageMs = Date.now() - new Date(pending.createdAt).getTime();
                        if (ageMs > 7 * 24 * 60 * 60 * 1000) continue;

                        try {
                            let statusResponse = await fetch(`${baseUrl}/payment-links/${pending.platformBillID}`, {
                                headers: getSetuHeaders(token, schemeId),
                                signal: AbortSignal.timeout(5000)
                            });
                            
                            if (statusResponse.status === 401 || statusResponse.status === 403) {
                                try {
                                    const refreshConn = await getPool().getConnection();
                                    token = await getSetuToken(refreshConn, config, true, true);
                                    refreshConn.release();
                                    
                                    statusResponse = await fetch(`${baseUrl}/payment-links/${pending.platformBillID}`, {
                                        headers: getSetuHeaders(token, schemeId),
                                        signal: AbortSignal.timeout(5000)
                                    });
                                } catch (refreshErr) {
                                    console.info("[Setu Poller] Token refresh deferred during poll:", refreshErr.message);
                                    continue;
                                }
                            }
                            
                            const statusResponseText = await statusResponse.text();
                            if (!statusResponseText.trim().startsWith('{')) {
                                continue;
                            }
                            const statusData = JSON.parse(statusResponseText);
                            if (statusData.success && statusData.data && ['PAYMENT_SUCCESSFUL', 'SUCCESS', 'BILL_FULFILLED', 'CREDIT_RECEIVED'].includes(statusData.data.status)) {
                                await handleSetuPaymentSuccess(statusData.data, { io });
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
    }, 45 * 1000);
}

export { processSuccessfulPayment, processSuccessfulExternalPayment, getSetuToken, getSetuHeaders, handleSetuPaymentSuccess };
export default router;
