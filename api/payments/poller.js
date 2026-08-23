import { getPool } from '../db.js';
import { getSetuHeaders, getSetuToken } from './setuClient.js';
import { handleSetuPaymentSuccess } from './reconciliation.js';

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
