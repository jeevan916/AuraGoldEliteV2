import { getPool, journalTransaction } from '../db.js';
import { SETU_SUCCESS_STATUSES } from './constants.js';

export function extractSetuAmount(data) {
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
export async function handleSetuPaymentSuccess(data, req) {
    if (!data) return;
    const paymentLinkData = data.paymentLink || data.bill || data.resource || data.payment || {};
    const billerBillID = String(data.billerBillID || data.paymentLinkID || paymentLinkData.billerBillID || '').trim();
    const platformBillID = String(data.platformBillID || paymentLinkData.platformBillID || data.id || data.bill?.id || data.paymentLinkId || data.paymentLinkID || '').trim();
    
    let amountPaid = extractSetuAmount(data);
    const upiTransactionID = String(data.transactionId || data.txnId || data.bankReferenceNumber || data.rrn || data.utr || data.reference || platformBillID || `setu_${Date.now()}`).trim();
    const payerVpa = data.payerVpa || data.sourceAccount?.number || data.payerAccount?.vpa || data.payer || null;

    let explicitExtId = String(data.additionalInfo?.externalPaymentId || data.additionalInfo?.externalPaymentID || paymentLinkData.additionalInfo?.externalPaymentId || paymentLinkData.additionalInfo?.externalPaymentID || '').trim();
    let explicitOrderId = String(data.additionalInfo?.orderId || data.additionalInfo?.orderID || paymentLinkData.additionalInfo?.orderId || paymentLinkData.additionalInfo?.orderID || '').trim();

    const pool = getPool();
    if (!pool) return;
    const connection = await pool.getConnection();

    try {
        const [allExtRows] = await connection.query("SELECT id, data FROM external_payments");
        const [allOrderRows] = await connection.query("SELECT id, data FROM orders");

        let matchedExternalRecordId = null;
        let matchedOrderId = null;

        // --- STEP 1: EXACT MATCH BY PLATFORM BILL ID (Most accurate and unique) ---
        if (platformBillID) {
            for (const row of allExtRows) {
                try {
                    const rec = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
                    if (String(rec.platformBillID || '').trim() === platformBillID ||
                        (Array.isArray(rec.pendingSetuPayments) && rec.pendingSetuPayments.some(p => String(p.platformBillID || '').trim() === platformBillID))) {
                        matchedExternalRecordId = row.id;
                        break;
                    }
                } catch (e) {}
            }

            if (!matchedExternalRecordId) {
                for (const row of allOrderRows) {
                    try {
                        const order = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
                        if (String(order.platformBillID || '').trim() === platformBillID ||
                            (Array.isArray(order.pendingSetuPayments) && order.pendingSetuPayments.some(p => String(p.platformBillID || '').trim() === platformBillID))) {
                            matchedOrderId = row.id;
                            break;
                        }
                    } catch (e) {}
                }
            }
        }

        // --- STEP 2: EXACT MATCH BY EXPLICIT ID IN ADDITIONAL INFO ---
        if (!matchedExternalRecordId && !matchedOrderId) {
            if (explicitExtId) {
                const found = allExtRows.find(r => r.id === explicitExtId || r.id.toUpperCase() === explicitExtId.toUpperCase());
                if (found) matchedExternalRecordId = found.id;
            }
            if (explicitOrderId && !matchedExternalRecordId) {
                const found = allOrderRows.find(r => r.id === explicitOrderId || r.id.toUpperCase() === explicitOrderId.toUpperCase());
                if (found) matchedOrderId = found.id;
            }
        }

        // --- STEP 3: STRICT BILLER BILL ID PREFIX / EXACT MATCH ---
        // (billerBillID is generated as `${id}_${Date.now()}` or `${id}`)
        if (!matchedExternalRecordId && !matchedOrderId && billerBillID) {
            for (const row of allExtRows) {
                if (billerBillID === row.id || billerBillID.startsWith(`${row.id}_`)) {
                    matchedExternalRecordId = row.id;
                    break;
                }
            }
            if (!matchedExternalRecordId) {
                for (const row of allOrderRows) {
                    if (billerBillID === row.id || billerBillID.startsWith(`${row.id}_`)) {
                        matchedOrderId = row.id;
                        break;
                    }
                }
            }
        }

        // --- STEP 4: STRICT TOKEN MATCH FROM TRANSACTION NOTE (e.g. "External Pay EXT-8137" or "Order ORD-1001") ---
        if (!matchedExternalRecordId && !matchedOrderId) {
            const noteSources = [
                data.transactionNote || '',
                paymentLinkData.transactionNote || '',
                data.description || '',
                paymentLinkData.description || ''
            ].join(' ');

            const extTokens = noteSources.match(/EXT[\-_][0-9A-Za-z\-_]+/gi) || [];
            for (const token of extTokens) {
                const normToken = token.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                const found = allExtRows.find(r => r.id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === normToken);
                if (found) {
                    matchedExternalRecordId = found.id;
                    break;
                }
            }

            if (!matchedExternalRecordId) {
                const ordTokens = noteSources.match(/ORD[\-_][0-9A-Za-z\-_]+/gi) || [];
                for (const token of ordTokens) {
                    const normToken = token.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                    const found = allOrderRows.find(r => r.id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === normToken);
                    if (found) {
                        matchedOrderId = found.id;
                        break;
                    }
                }
            }
        }

        if (matchedExternalRecordId) {
            connection.release();
            if (amountPaid <= 0) {
                const [targetRows] = await (getPool()).query("SELECT data FROM external_payments WHERE id = ?", [matchedExternalRecordId]);
                if (targetRows.length > 0) {
                    const tRec = JSON.parse(targetRows[0].data);
                    amountPaid = Number(tRec.amount) - (Number(tRec.amountPaid) || 0);
                }
            }
            await processSuccessfulExternalPayment(matchedExternalRecordId, amountPaid, upiTransactionID, payerVpa, req);
            return;
        }

        if (matchedOrderId) {
            connection.release();
            await processSuccessfulPayment(matchedOrderId, amountPaid, upiTransactionID, payerVpa, req);
            return;
        }

        console.warn("[Setu Matcher] Could not match Setu payment to any external payment or order:", {
            platformBillID,
            billerBillID,
            explicitExtId,
            explicitOrderId,
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

// Helper to record payment and send WhatsApp
export async function processSuccessfulPayment(orderId, amountPaid, upiTransactionID, payerVpa, req) {
    const pool = getPool();
    if (!pool) return;
    const connection = await pool.getConnection();

    try {
        // Global deduplication: ensure upiTransactionID is never credited to multiple records
        if (upiTransactionID) {
            const [allOrd] = await connection.query("SELECT id, data FROM orders");
            for (const r of allOrd) {
                try {
                    const ord = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
                    if (ord.payments && ord.payments.some(p => p.reference === upiTransactionID || p.transactionId === upiTransactionID)) {
                        if (r.id !== orderId) {
                            console.warn(`[Reconciliation Security] Transaction ${upiTransactionID} is already credited to order ${r.id}. Rejecting cross-customer credit to ${orderId}.`);
                            return;
                        } else {
                            return;
                        }
                    }
                } catch(e) {}
            }

            const [allExt] = await connection.query("SELECT id, data FROM external_payments");
            for (const r of allExt) {
                try {
                    const rec = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
                    if (rec.partialPayments && rec.partialPayments.some(p => p.txnId === upiTransactionID || p.platformBillID === upiTransactionID || p.reference === upiTransactionID)) {
                        console.warn(`[Reconciliation Security] Transaction ${upiTransactionID} is already credited to external payment ${r.id}. Rejecting cross-customer credit to Order ${orderId}.`);
                        return;
                    }
                } catch(e) {}
            }
        }

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
                
                const { sendWhatsAppMessage } = await import('../whatsapp.js');
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
export async function processSuccessfulExternalPayment(externalId, amountPaid, upiTransactionID, payerVpa, req) {
    const pool = getPool();
    if (!pool) return;
    const connection = await pool.getConnection();

    try {
        // Global deduplication: ensure upiTransactionID is never credited to multiple records
        if (upiTransactionID) {
            const [allExt] = await connection.query("SELECT id, data FROM external_payments");
            for (const r of allExt) {
                try {
                    const rec = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
                    if (rec.partialPayments && rec.partialPayments.some(p => p.txnId === upiTransactionID || (p.platformBillID && p.platformBillID === upiTransactionID) || (p.reference && p.reference === upiTransactionID))) {
                        if (r.id !== externalId) {
                            console.warn(`[Reconciliation Security] Transaction ${upiTransactionID} is already credited to external payment ${r.id}. Rejecting cross-customer credit to ${externalId}.`);
                            return;
                        } else {
                            return;
                        }
                    }
                } catch(e) {}
            }

            const [allOrd] = await connection.query("SELECT id, data FROM orders");
            for (const r of allOrd) {
                try {
                    const ord = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
                    if (ord.payments && ord.payments.some(p => p.reference === upiTransactionID || p.transactionId === upiTransactionID)) {
                        console.warn(`[Reconciliation Security] Transaction ${upiTransactionID} is already credited to order ${r.id}. Rejecting cross-customer credit to External Payment ${externalId}.`);
                        return;
                    }
                } catch(e) {}
            }
        }

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
                const { sendWhatsAppMessage } = await import('../whatsapp.js');
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
