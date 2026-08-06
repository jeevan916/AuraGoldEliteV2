
import express from 'express';
import { getPool, ensureDb, journalTransaction } from './db.js';
import { refreshInterval } from './rateService.js';
import { processOrderImages } from './imageStore.js';

const router = express.Router();

router.post('/orders', ensureDb, async (req, res) => {
    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        for (let order of req.body.orders) {
            // Intercept and extract any base64 images, saving them on the server drive
            order = processOrderImages(order);

            await connection.query('INSERT INTO orders (id, customer_contact, status, created_at, share_token, data, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status=VALUES(status), share_token=VALUES(share_token), data=VALUES(data), updated_at=VALUES(updated_at)', [order.id, order.customerContact, order.status, new Date(order.createdAt), order.shareToken, JSON.stringify(order), Date.now()]);
            await journalTransaction('ORDER', order.id, 'SYNC_WRITE', order, connection);
            
            // Explicitly sync Customer so they aren't lost if order is deleted
            if (order.customerContact) {
                const customId = `CUST-${order.customerContact.replace(/\D/g, '').slice(-10)}`;
                const customerData = {
                    id: customId,
                    name: order.customerName || 'Unknown',
                    contact: order.customerContact,
                    email: order.customerEmail || '',
                    secondaryContact: order.secondaryContact || '',
                    joinDate: order.createdAt
                };
                await connection.query(
                    `INSERT INTO customers (id, contact, name, data, updated_at) 
                     VALUES (?, ?, ?, ?, ?) 
                     ON DUPLICATE KEY UPDATE name=VALUES(name), data=VALUES(data), updated_at=VALUES(updated_at)`,
                    [customId, order.customerContact, order.customerName || 'Unknown', JSON.stringify(customerData), Date.now()]
                );
            }

            // Sync payments to a relational table so they aren't lost
            if (Array.isArray(order.payments)) {
                for (const payment of order.payments) {
                    if (!payment.id) continue;
                    await connection.query(
                        `INSERT INTO payments_log (id, order_id, customer_contact, amount, method, status, timestamp, data) 
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                         ON DUPLICATE KEY UPDATE status=VALUES(status), data=VALUES(data)`,
                        [
                            payment.id, 
                            order.id, 
                            order.customerContact,
                            payment.amount || 0,
                            payment.method || 'Unknown',
                            payment.status || 'SUCCESS',
                            new Date(payment.timestamp || Date.now()),
                            JSON.stringify(payment)
                        ]
                    );
                }
            }

            if (order.paymentPlan && order.paymentPlan.milestones) {
                const milestoneIds = order.paymentPlan.milestones.map(m => m.id);
                if (milestoneIds.length > 0) {
                    await connection.query(`DELETE FROM payment_schedules WHERE orderId = ? AND id NOT IN (?)`, [order.id, milestoneIds]);
                } else {
                    await connection.query(`DELETE FROM payment_schedules WHERE orderId = ?`, [order.id]);
                }
                
                for (const m of order.paymentPlan.milestones) {
                    await connection.query(
                        `INSERT INTO payment_schedules (id, orderId, dueDate, targetAmount, cumulativeTarget, status, warningCount) 
                         VALUES (?, ?, ?, ?, ?, ?, ?) 
                         ON DUPLICATE KEY UPDATE dueDate=VALUES(dueDate), targetAmount=VALUES(targetAmount), cumulativeTarget=VALUES(cumulativeTarget), status=VALUES(status)`,
                        [m.id, order.id, new Date(m.dueDate), m.targetAmount, m.cumulativeTarget, m.status, m.warningCount || 0]
                    );
                }
            } else {
                await connection.query(`DELETE FROM payment_schedules WHERE orderId = ?`, [order.id]);
            }
        }
        connection.release();
        
        // SOCKET IO BROADCAST: Notify all clients about the new/updated orders immediately
        if (req.io) {
            console.log(`[Socket] Broadcasting ${req.body.orders.length} order updates`);
            req.io.emit('orders_sync', req.body.orders);
        }

        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/orders/:id', ensureDb, async (req, res) => {
    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        
        // Fetch order details first so we have a restorable backup in the journal
        const [rows] = await connection.query('SELECT data FROM orders WHERE id = ?', [req.params.id]);
        if (rows.length > 0) {
            const orderData = JSON.parse(rows[0].data);
            await journalTransaction('ORDER', req.params.id, 'DELETE', orderData, connection);
        } else {
            await journalTransaction('ORDER', req.params.id, 'DELETE', { info: "Order data was not present in DB before deletion" }, connection);
        }

        await connection.query('DELETE FROM payment_schedules WHERE orderId = ?', [req.params.id]);
        await connection.query('DELETE FROM orders WHERE id = ?', [req.params.id]);
        connection.release();
        
        // Broadcast deletion event to clients
        if (req.io) {
            req.io.emit('order_deleted', req.params.id);
        }
        
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/customers', ensureDb, async (req, res) => {
    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        for (const cust of req.body.customers) {
            await connection.query('INSERT INTO customers (id, contact, name, data, updated_at) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), data=VALUES(data), updated_at=VALUES(updated_at)', [cust.id, cust.contact, cust.name, JSON.stringify(cust), Date.now()]);
            await journalTransaction('CUSTOMER', cust.id, 'SYNC_WRITE', cust, connection);
        }
        connection.release();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/templates', ensureDb, async (req, res) => {
    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        // Clear old templates and insert current active set
        await connection.query('DELETE FROM templates');
        if (Array.isArray(req.body.templates)) {
            for (const tpl of req.body.templates) {
                await connection.query(
                    `INSERT INTO templates (id, name, category, data) VALUES (?, ?, ?, ?) 
                     ON DUPLICATE KEY UPDATE name=VALUES(name), category=VALUES(category), data=VALUES(data)`,
                    [tpl.id, tpl.name, tpl.category || 'UNCATEGORIZED', JSON.stringify(tpl)]
                );
            }
        }
        connection.release();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/catalog', ensureDb, async (req, res) => {
    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        for (const item of req.body.catalog) {
            await connection.query(
                `INSERT INTO catalog (id, category, data) VALUES (?, ?, ?) 
                 ON DUPLICATE KEY UPDATE category=VALUES(category), data=VALUES(data)`,
                [item.id, item.category, JSON.stringify(item)]
            );
        }
        connection.release();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/external-payments', ensureDb, async (req, res) => {
    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        if (Array.isArray(req.body.externalPayments)) {
            for (const item of req.body.externalPayments) {
                await connection.query(
                    `INSERT INTO external_payments (id, customer_contact, status, created_at, share_token, data, updated_at) 
                     VALUES (?, ?, ?, ?, ?, ?, ?) 
                     ON DUPLICATE KEY UPDATE status=VALUES(status), share_token=VALUES(share_token), data=VALUES(data), updated_at=VALUES(updated_at)`,
                    [item.id, item.customerContact || '', item.status || 'PENDING', new Date(item.createdAt || Date.now()), item.shareToken || item.share_token || '', JSON.stringify(item), Date.now()]
                );
            }
        }
        connection.release();
        if (req.io) {
            req.io.emit('external_payments_sync', req.body.externalPayments);
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/plan-templates', ensureDb, async (req, res) => {
    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        
        // Clear old templates and insert the complete current active set
        await connection.query('DELETE FROM plan_templates');
        
        if (Array.isArray(req.body.planTemplates)) {
            for (const tpl of req.body.planTemplates) {
                await connection.query(
                    'INSERT INTO plan_templates (id, name, data) VALUES (?, ?, ?)',
                    [tpl.id, tpl.name, JSON.stringify(tpl)]
                );
            }
        }
        connection.release();
        res.json({ success: true });
    } catch (e) {
        console.error("[API Plan Templates Sync Error]", e);
        res.status(500).json({ error: e.message });
    }
});

router.post('/settings', ensureDb, async (req, res) => {
    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        const { settings } = req.body;

        // 1. Persist Core Application Settings
        const coreConfig = {
            currentGoldRate24K: settings.currentGoldRate24K,
            currentGoldRate22K: settings.currentGoldRate22K,
            currentGoldRate18K: settings.currentGoldRate18K,
            currentSilverRate: settings.currentSilverRate,
            defaultTaxRate: settings.defaultTaxRate,
            goldRateProtectionMax: settings.goldRateProtectionMax,
            gracePeriodHours: settings.gracePeriodHours,
            followUpIntervalDays: settings.followUpIntervalDays,
            goldRateFetchIntervalMinutes: settings.goldRateFetchIntervalMinutes,
            preferredRateProvider: settings.preferredRateProvider, // Persist Provider Preference
            breachBufferMinutes: settings.breachBufferMinutes,
            cooldownHours: settings.cooldownHours,
            reminderScheduleDays: settings.reminderScheduleDays,
            overdueFrequencyDays: settings.overdueFrequencyDays,
            maxRemindersPerMilestone: settings.maxRemindersPerMilestone,
            whatsappEnabled: settings.whatsappEnabled !== undefined ? !!settings.whatsappEnabled : true
        };
        await connection.query("INSERT INTO integrations (provider, config) VALUES (?, ?) ON DUPLICATE KEY UPDATE config=VALUES(config)", ['core_settings', JSON.stringify(coreConfig)]);

        // Notify rate service about potential interval change
        if (settings.goldRateFetchIntervalMinutes) {
            refreshInterval(settings.goldRateFetchIntervalMinutes);
        }

        // 2. Persist WhatsApp Credentials
        if (settings.whatsappPhoneNumberId || settings.whatsappVerifyToken) {
            const waConfig = { 
                phoneId: settings.whatsappPhoneNumberId, 
                accountId: settings.whatsappBusinessAccountId, 
                token: settings.whatsappBusinessToken,
                verifyToken: settings.whatsappVerifyToken
            };
            await connection.query("INSERT INTO integrations (provider, config) VALUES (?, ?) ON DUPLICATE KEY UPDATE config=VALUES(config)", ['whatsapp', JSON.stringify(waConfig)]);
        }

        // 3. Persist Setu Credentials
        if (settings.setuClientId) {
            const setuConfig = { 
                clientId: settings.setuClientId, 
                secret: settings.setuSecret, 
                schemeId: settings.setuSchemeId,
                mode: settings.setuMode || 'PRODUCTION'
            };
            await connection.query("INSERT INTO integrations (provider, config) VALUES (?, ?) ON DUPLICATE KEY UPDATE config=VALUES(config)", ['setu', JSON.stringify(setuConfig)]);
        }

        // 4. Persist Other Gateways
        if (settings.razorpayKeyId) {
            const rzpConfig = { keyId: settings.razorpayKeyId, secret: settings.razorpayKeySecret };
            await connection.query("INSERT INTO integrations (provider, config) VALUES (?, ?) ON DUPLICATE KEY UPDATE config=VALUES(config)", ['razorpay', JSON.stringify(rzpConfig)]);
        }

        await journalTransaction('SETTINGS', 'APPLICATION', 'SYNC_WRITE', settings, connection);

        connection.release();
        res.json({ success: true });
    } catch (e) { 
        console.error("[API Settings Sync Error]", e);
        res.status(500).json({ error: e.message }); 
    }
});

export default router;
