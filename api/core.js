
import express from 'express';
import path from 'path';
import fs from 'fs';
import { getPool, ensureDb, logDbActivity, isMock, initDb } from './db.js';
import { resolveContactNames } from './whatsapp.js';

const router = express.Router();

router.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

router.get('/debug/db', async (req, res) => {
    let connectionTest = "Not attempted";
    let errorMsg = null;
    
    try {
        const pool = getPool();
        if (pool && !isMock) {
            const conn = await pool.getConnection();
            connectionTest = "Success";
            conn.release();
        } else {
            connectionTest = "Pool is null or running in Mock mode";
        }
    } catch (e) {
        connectionTest = "Failed";
        errorMsg = "Database connection error. Please check server logs.";
    }

    res.json({
        config: {
            isMockMode: isMock
        },
        status: connectionTest,
        error: errorMsg
    });
});

// --- SYSTEM LOGS (ERRORS) ---
router.get('/logs/errors', ensureDb, async (req, res) => {
    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        const [rows] = await connection.query('SELECT * FROM system_errors ORDER BY timestamp DESC LIMIT 200');
        connection.release();
        
        const errors = rows.map(row => ({
            id: row.id,
            source: row.source,
            message: row.message,
            stack: row.stack,
            severity: row.severity,
            timestamp: row.timestamp,
            rawContext: row.context,
            status: 'NEW' 
        }));
        
        res.json({ success: true, errors });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

router.post('/logs/error', ensureDb, async (req, res) => {
    try {
        const { id, source, message, stack, severity, timestamp, rawContext } = req.body;
        const pool = getPool();
        const connection = await pool.getConnection();
        await connection.query(
            'INSERT INTO system_errors (id, source, message, stack, severity, timestamp, context) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [id, source, message, stack || '', severity || 'MEDIUM', new Date(timestamp), JSON.stringify(rawContext || {})]
        );
        connection.release();
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// --- NEW: ACTIVITY LOGS ---
router.get('/logs/activities', ensureDb, async (req, res) => {
    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        const [rows] = await connection.query('SELECT * FROM system_activities ORDER BY timestamp DESC LIMIT 300');
        connection.release();
        
        const activities = rows.map(row => ({
            id: row.id,
            actionType: row.action_type,
            details: row.details,
            timestamp: row.timestamp,
            metadata: {
                ...row.metadata,
                ip: row.ip_address,
                location: row.geo_location,
                device: row.device_info
            }
        }));
        res.json({ success: true, activities });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

router.get('/logs/webhooks', ensureDb, async (req, res) => {
    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        const [rows] = await connection.query("SELECT * FROM webhook_logs ORDER BY created_at DESC LIMIT 100");
        connection.release();
        
        // Parse the payloads back into JSON objects
        const logs = rows.map(r => {
            let parsedPayload = r.payload;
            if (typeof r.payload === 'string') {
                try {
                    parsedPayload = JSON.parse(r.payload);
                } catch (err) {
                    parsedPayload = { rawString: r.payload, parseError: err.message };
                }
            }
            return {
                ...r,
                payload: parsedPayload
            };
        });
        
        res.json({ success: true, logs });
    } catch (e) {
        console.error("Fetch webhooks error:", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

router.post('/logs/activity', ensureDb, async (req, res) => {
    try {
        const { actionType, details, metadata } = req.body;
        // Pass req to capture IP of the reporter (Client)
        await logDbActivity(actionType, details, metadata, req);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// --- PUBLIC ORDER ACCESS ---
router.get('/public/order/:token', ensureDb, async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        const token = req.params.token;
        const pool = getPool();
        const connection = await pool.getConnection();
        
        // Optimized query
        const [rows] = await connection.query('SELECT data FROM orders WHERE share_token = ?', [token]);
        
        let order = rows.length > 0 ? JSON.parse(rows[0].data) : null;

        if (order) {
            // Reconcile with any payments recorded in payments_log
            try {
                const [pRows] = await connection.query('SELECT data FROM payments_log WHERE order_id = ?', [order.id]);
                if (!Array.isArray(order.payments)) order.payments = [];
                for (const pRow of pRows) {
                    try {
                        const pData = JSON.parse(pRow.data);
                        if (pData && (pData.id || pData.reference)) {
                            const exists = order.payments.some(p => 
                                (p.id && p.id === pData.id) || 
                                (p.reference && pData.reference && p.reference === pData.reference) || 
                                (p.transactionId && pData.reference && p.transactionId === pData.reference)
                            );
                            if (!exists) order.payments.push(pData);
                        }
                    } catch(e) {}
                }
            } catch(e) {}

            connection.release();
            
            // Log this specific access event with enriched metadata
            await logDbActivity('LINK_OPENED', `Customer viewed Order ${order.id}`, { orderId: order.id, customer: order.customerName }, req);
            
            // Sanitize PII
            const sanitizedOrder = {
                id: order.id,
                customerName: order.customerName || '',
                customerContact: order.customerContact || '',
                customerEmail: order.customerEmail || '',
                secondaryContact: order.secondaryContact || '',
                shareToken: order.shareToken,
                items: order.items,
                payments: order.payments,
                totalAmount: order.totalAmount,
                discountAmount: order.discountAmount || 0,
                goldRateAtBooking: order.goldRateAtBooking,
                paymentPlan: order.paymentPlan,
                status: order.status,
                createdAt: order.createdAt,
                isRateBreached: order.isRateBreached,
                requiresLiabilityAcceptance: order.requiresLiabilityAcceptance,
                liabilityGapAcceptedAt: order.liabilityGapAcceptedAt,
                deliveredAt: order.deliveredAt,
                cancelledAt: order.cancelledAt,
                refundMethod: order.refundMethod,
                protectionRevokedAt: order.protectionRevokedAt,
                lateFeePeriodsApplied: order.lateFeePeriodsApplied || {},
                lateFeeAmount: order.lateFeeAmount || 0,
                lateFeeWaived: order.lateFeeWaived || 0
            };
            
            res.json({ success: true, order: sanitizedOrder });
        } else {
            connection.release();
            // Log failed access attempt
            await logDbActivity('SECURITY_ALERT', `Invalid Order Link Attempt: ${token}`, { token }, req);
            res.status(404).json({ success: false, error: "Invalid or Expired Order Link" });
        }
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// --- PUBLIC EXTERNAL PAYMENT ACCESS ---
router.get('/public/external-payment/:token', ensureDb, async (req, res) => {
    try {
        const token = req.params.token;
        const pool = getPool();
        const connection = await pool.getConnection();
        
        let rows = [];
        try {
            const [qRows] = await connection.query('SELECT data FROM external_payments WHERE share_token = ? OR id = ?', [token, token]);
            rows = qRows;
        } catch (dbErr) {
            console.warn("[Core] Direct share_token query failed, attempting JSON scan fallback:", dbErr.message);
        }

        if (!rows || rows.length === 0) {
            try {
                const [allRows] = await connection.query('SELECT data FROM external_payments');
                for (const row of allRows) {
                    try {
                        const parsed = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
                        if (parsed && (parsed.shareToken === token || parsed.share_token === token || parsed.id === token)) {
                            rows = [row];
                            break;
                        }
                    } catch (e) {}
                }
            } catch (scanErr) {
                console.error("[Core] JSON scan fallback failed:", scanErr.message);
            }
        }

        connection.release();
        
        let record = rows.length > 0 ? (typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data) : null;
        
        if (record) {
            // If link is pending but has a platformBillID, perform live status check
            if (record.status !== 'PAID' && record.platformBillID) {
                let statusConn;
                try {
                    statusConn = await getPool().getConnection();
                    const [setuRows] = await statusConn.query("SELECT config FROM integrations WHERE provider = ?", ['setu']);
                    if (setuRows.length > 0) {
                        let config = setuRows[0].config;
                        if (typeof config === 'string') config = typeof config === "string" ? JSON.parse(config) : config;
                        if (config.enabled !== false && (config.clientId || config.clientID) && (config.secret || config.clientSecret)) {
                            if (!config.wafBlockedUntil || Date.now() >= config.wafBlockedUntil) {
                                const isProduction = (config.mode || 'PRODUCTION') === 'PRODUCTION';
                                const baseUrl = isProduction ? 'https://prod.setu.co/api/v2' : 'https://uat.setu.co/api/v2';
                                const schemeId = config.schemeId || config.productInstanceId || config.product_instance_id || '';
                                const { getSetuToken, getSetuHeaders, processSuccessfulExternalPayment } = await import('./payments.js');
                                const tokenVal = await getSetuToken(statusConn, config);
                                const statusRes = await fetch(`${baseUrl}/payment-links/${record.platformBillID}`, {
                                    headers: getSetuHeaders(tokenVal, schemeId),
                                    signal: AbortSignal.timeout(3500)
                                });
                                const statusText = await statusRes.text();
                                if (statusText.trim().startsWith('{')) {
                                    const statusData = JSON.parse(statusText);
                                    if (statusData.success && statusData.data && ['PAYMENT_SUCCESSFUL', 'SUCCESS', 'BILL_FULFILLED', 'CREDIT_RECEIVED'].includes(statusData.data.status)) {
                                        let parsedAmt = statusData.data.amountPaid?.value !== undefined ? Number(statusData.data.amountPaid.value) / 100
                                                      : (statusData.data.amount?.value !== undefined ? Number(statusData.data.amount.value) / 100
                                                      : (statusData.data.amountPaid !== undefined ? Number(statusData.data.amountPaid) : Number(statusData.data.amount)));
                                        const amountPaid = !isNaN(parsedAmt) && parsedAmt > 0 ? parsedAmt : (record.amount - (record.amountPaid || 0));
                                        const upiTxnId = statusData.data.paymentLink?.platformBillID || statusData.data.platformBillID || record.platformBillID;
                                        await processSuccessfulExternalPayment(record.id, amountPaid, upiTxnId, statusData.data.payerVpa || null, req);
                                        
                                        // Re-read updated record from database
                                        const [updatedRows] = await statusConn.query('SELECT data FROM external_payments WHERE id = ?', [record.id]);
                                        if (updatedRows.length > 0) {
                                            record = JSON.parse(updatedRows[0].data);
                                        }
                                    }
                                }
                            }
                        }
                    }
                } catch (chkErr) {
                    console.info("[Public External Payment] Auto status check deferred:", chkErr.message);
                } finally {
                    if (statusConn) statusConn.release();
                }
            }

            await logDbActivity('LINK_OPENED', `Customer viewed External Payment Request ${record.id}`, { recordId: record.id, customer: record.customerName }, req);
            res.json({ success: true, record });
        } else {
            res.status(404).json({ success: false, error: "Invalid or Expired External Payment Request Link" });
        }
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

router.get('/bootstrap', ensureDb, async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        const pool = getPool();
        const connection = await pool.getConnection();
        const [orders] = await connection.query('SELECT data FROM orders');
        const [customers] = await connection.query('SELECT data FROM customers');
        const [logs] = await connection.query('SELECT data FROM whatsapp_logs ORDER BY timestamp DESC LIMIT 100');
        const [templates] = await connection.query('SELECT data FROM templates');
        const [catalog] = await connection.query('SELECT data FROM catalog');
        const [planTemplates] = await connection.query('SELECT data FROM plan_templates');
        const [externalPayments] = await connection.query('SELECT data FROM external_payments');
        const [intRows] = await connection.query('SELECT * FROM integrations');
        
        // Also fetch all payments_log to reconcile any missing payments in orders
        let paymentsLogMap = {};
        try {
            const [pLogs] = await connection.query('SELECT order_id, data FROM payments_log');
            for (const pl of pLogs) {
                if (!paymentsLogMap[pl.order_id]) paymentsLogMap[pl.order_id] = [];
                try {
                    const pData = JSON.parse(pl.data);
                    if (pData) paymentsLogMap[pl.order_id].push(pData);
                } catch(e) {}
            }
        } catch(e) {}

        connection.release();
        
        let parsedLogs = logs.map(r => JSON.parse(r.data));
        try {
            parsedLogs = await resolveContactNames(parsedLogs);
        } catch (resolveErr) {
            console.error("[Bootstrap] Failed to resolve contact names for logs:", resolveErr);
        }
        
        const intMap = {}; 
        intRows.forEach(r => { 
            try { 
                intMap[r.provider] = typeof r.config === "string" ? JSON.parse(r.config) : r.config; 
            } catch(e) {
                console.error("Failed to parse config for", r.provider, e);
            } 
        });
        
        const core = intMap.core_settings || {};

        const parsedOrders = orders.map(r => {
            const ord = JSON.parse(r.data);
            if (!Array.isArray(ord.payments)) ord.payments = [];
            const logged = paymentsLogMap[ord.id];
            if (Array.isArray(logged)) {
                for (const p of logged) {
                    const exists = ord.payments.some(ep => 
                        (ep.id && p.id && ep.id === p.id) || 
                        (ep.reference && p.reference && ep.reference === p.reference) ||
                        (ep.transactionId && p.reference && ep.transactionId === p.reference)
                    );
                    if (!exists) ord.payments.push(p);
                }
            }
            return ord;
        });
        
        res.json({ success: true, data: {
            orders: parsedOrders,
            customers: customers.map(r => JSON.parse(r.data)),
            logs: parsedLogs,
            templates: templates.map(r => JSON.parse(r.data)),
            catalog: catalog.map(r => JSON.parse(r.data)),
            planTemplates: planTemplates.map(r => JSON.parse(r.data)),
            externalPayments: externalPayments.map(r => JSON.parse(r.data)),
            settings: { 
                currentGoldRate24K: core.currentGoldRate24K || 7500,
                currentGoldRate22K: core.currentGoldRate22K || 6870,
                currentGoldRate18K: core.currentGoldRate18K || 5625,
                currentSilverRate: core.currentSilverRate || 90,
                defaultTaxRate: core.defaultTaxRate || 3,
                goldRateProtectionMax: core.goldRateProtectionMax || 500,
                gracePeriodHours: core.gracePeriodHours || 24,
                followUpIntervalDays: core.followUpIntervalDays || 3,
                goldRateFetchIntervalMinutes: core.goldRateFetchIntervalMinutes || 60,
                breachBufferMinutes: core.breachBufferMinutes !== undefined ? core.breachBufferMinutes : 30,
                cooldownHours: core.cooldownHours !== undefined ? core.cooldownHours : 24,
                reminderScheduleDays: core.reminderScheduleDays || [15, 7, 3],
                overdueFrequencyDays: core.overdueFrequencyDays !== undefined ? core.overdueFrequencyDays : 2,
                maxRemindersPerMilestone: core.maxRemindersPerMilestone !== undefined ? core.maxRemindersPerMilestone : 5,
                whatsappEnabled: core.whatsappEnabled !== undefined ? !!core.whatsappEnabled : true,
                whatsappPhoneNumberId: intMap.whatsapp?.phoneId, 
                whatsappBusinessAccountId: intMap.whatsapp?.accountId, 
                whatsappBusinessToken: intMap.whatsapp?.token,
                whatsappVerifyToken: intMap.whatsapp?.verifyToken || process.env.WHATSAPP_VERIFY_TOKEN || "auragold_elite_secure_2025",
                setuClientId: intMap.setu?.clientId,
                setuSecret: intMap.setu?.secret,
                setuSchemeId: intMap.setu?.schemeId,
                setuMode: intMap.setu?.mode || 'PRODUCTION',
                razorpayKeyId: intMap.razorpay?.keyId,
                razorpayKeySecret: intMap.razorpay?.secret,
                isMockMode: isMock
            }
        }});
    } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
