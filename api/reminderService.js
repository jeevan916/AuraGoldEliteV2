import { getPool, isMock, normalizePhone } from './db.js';
import { sendWhatsAppMessage } from './whatsapp.js';

export async function runPaymentReminders(specificOrderId = null) {
    console.log("[ReminderService] Starting payment reminder check...", specificOrderId ? `For Order ${specificOrderId}` : "For all active orders");
    const results = {
        processedOrders: 0,
        schedulesChecked: 0,
        remindersSent: 0,
        skipped: 0,
        details: []
    };

    try {
        if (isMock) {
            console.log("[ReminderService] Running in Mock DB mode. Skipping actual DB query.");
            return results;
        }

        const pool = getPool();
        if (!pool) {
            console.warn("[ReminderService] DB pool not initialized.");
            return results;
        }

        const connection = await pool.getConnection();

        // 1. Fetch Core Settings
        let config = {};
        try {
            const [settingsRows] = await connection.query("SELECT config FROM integrations WHERE provider = ?", ['core_settings']);
            if (settingsRows.length > 0) {
                config = typeof settingsRows[0].config === "string" ? JSON.parse(settingsRows[0].config) : settingsRows[0].config;
            }
        } catch (e) {
            console.warn("[ReminderService] Warning loading core_settings:", e.message);
        }

        // Global WhatsApp toggle check
        if (config.whatsappEnabled === false) {
            console.log("[ReminderService] WhatsApp messaging is globally turned OFF in settings. Aborting reminder run.");
            connection.release();
            return results;
        }

        const reminderScheduleDays = config.reminderScheduleDays || [15, 7, 3, 1];
        const overdueFrequencyDays = config.overdueFrequencyDays || 1;
        const maxRemindersPerMilestone = config.maxRemindersPerMilestone || 5;

        // 2. Fetch WhatsApp Credentials with robust fallback
        let whatsappConfig = {};
        try {
            const [whatsappRows] = await connection.query("SELECT config FROM integrations WHERE provider = ?", ['whatsapp']);
            if (whatsappRows.length > 0) {
                whatsappConfig = typeof whatsappRows[0].config === "string" ? JSON.parse(whatsappRows[0].config) : whatsappRows[0].config;
            }
        } catch (e) {
            console.warn("[ReminderService] Warning loading whatsapp integration:", e.message);
        }

        const phoneId = whatsappConfig.phoneId || whatsappConfig.phone_number_id || whatsappConfig.phoneNumberId || process.env.WHATSAPP_PHONE_ID;
        const token = whatsappConfig.token || whatsappConfig.accessToken || whatsappConfig.access_token || whatsappConfig.system_token || process.env.WHATSAPP_TOKEN;

        if (!phoneId || !token) {
            console.warn("[ReminderService] Missing WhatsApp Phone ID or Token. Cannot dispatch automated reminders.");
            connection.release();
            return results;
        }

        // 3. Query Active Orders
        let orderQuery = "SELECT id, customer_contact, status, data, share_token FROM orders WHERE status NOT IN ('DELIVERED', 'CANCELLED', 'REFUNDED')";
        let queryParams = [];
        if (specificOrderId) {
            orderQuery += " AND id = ?";
            queryParams.push(specificOrderId);
        }

        const [orderRows] = await connection.query(orderQuery, queryParams);
        results.processedOrders = orderRows.length;

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        for (const orderRow of orderRows) {
            let orderData;
            try {
                orderData = typeof orderRow.data === 'string' ? JSON.parse(orderRow.data) : orderRow.data;
            } catch (e) {
                console.error(`[ReminderService] Invalid JSON for order ${orderRow.id}`);
                continue;
            }

            if (!orderData || !orderData.paymentPlan || !Array.isArray(orderData.paymentPlan.milestones)) {
                continue;
            }

            const customerName = orderData.customerName || "Customer";
            const customerPhone = orderData.customerContact || orderData.customerPhone || orderRow.customer_contact;
            if (!customerPhone) continue;

            const normalizedPhone = normalizePhone(customerPhone);
            const shareToken = orderData.shareToken || orderRow.share_token || "";
            const paymentLink = `https://order.auragoldelite.com/?token=${shareToken}`;
            const totalPaid = (orderData.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);

            // Check collision avoidance: Skip if recent rate breach alert sent in last 24h
            const [breachLogRows] = await connection.query(
                "SELECT COUNT(*) as count FROM whatsapp_logs WHERE phone = ? AND (data LIKE '%auragold_rate_adjustment_alert%' OR data LIKE '%auragold_rate_stabilized%') AND timestamp > ?",
                [normalizedPhone, new Date(now.getTime() - 24 * 60 * 60 * 1000)]
            );
            if (breachLogRows[0]?.count > 0) {
                console.log(`[ReminderService] Skipping order ${orderData.id} due to recent rate breach alert.`);
                results.skipped++;
                continue;
            }

            for (const milestone of orderData.paymentPlan.milestones) {
                results.schedulesChecked++;
                if (milestone.status === 'PAID') continue;

                const dueDateRaw = new Date(milestone.dueDate);
                if (isNaN(dueDateRaw.getTime())) continue;
                const dueDate = new Date(dueDateRaw.getFullYear(), dueDateRaw.getMonth(), dueDateRaw.getDate());

                // diffDays > 0 => Due in future
                // diffDays = 0 => Due TODAY
                // diffDays < 0 => Overdue / Breached promise date
                const diffTime = dueDate.getTime() - today.getTime();
                const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

                let templateName = null;
                let tone = null;

                if (diffDays > 0 && reminderScheduleDays.includes(diffDays)) {
                    // Soft Upcoming Reminder
                    templateName = 'auragold_gentle_reminder';
                    tone = 'UPCOMING_REMINDER';
                } else if (diffDays === 0) {
                    // Due Today Soft Reminder
                    templateName = 'auragold_gentle_reminder';
                    tone = 'DUE_TODAY';
                } else if (diffDays < 0) {
                    // Overdue Payment / Breached Promise Date
                    const overdueDays = Math.abs(diffDays);
                    // Trigger on day 1 overdue or according to overdueFrequencyDays
                    if (overdueDays === 1 || (overdueDays % overdueFrequencyDays === 0)) {
                        if (overdueDays <= 3) {
                            templateName = 'auragold_payment_overdue';
                            tone = 'OVERDUE_ALERT';
                        } else {
                            templateName = 'auragold_urgent_lapse';
                            tone = 'URGENT_LAPSE';
                        }
                    }
                }

                if (!templateName) continue;

                // Daily duplicate check: Avoid sending multiple reminders for the same milestone on the same day
                const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const [dailyLogRows] = await connection.query(
                    "SELECT COUNT(*) as count FROM whatsapp_logs WHERE phone = ? AND data LIKE ? AND timestamp >= ?",
                    [normalizedPhone, `%${milestone.id}%`, startOfToday]
                );

                if (dailyLogRows[0]?.count > 0) {
                    console.log(`[ReminderService] Already sent a reminder for milestone ${milestone.id} today. Skipping.`);
                    results.skipped++;
                    continue;
                }

                // Check total warning count over milestone lifetime
                const [totalLogRows] = await connection.query(
                    "SELECT COUNT(*) as count FROM whatsapp_logs WHERE phone = ? AND data LIKE ?",
                    [normalizedPhone, `%${milestone.id}%`]
                );
                if (totalLogRows[0]?.count >= maxRemindersPerMilestone) {
                    console.log(`[ReminderService] Max reminders (${maxRemindersPerMilestone}) reached for milestone ${milestone.id}. Skipping.`);
                    results.skipped++;
                    continue;
                }

                // Calculate remaining balance for partial vs pending milestones
                const milestoneIndex = orderData.paymentPlan.milestones.findIndex(m => m.id === milestone.id);
                const previousTargets = orderData.paymentPlan.milestones
                    .slice(0, milestoneIndex)
                    .reduce((sum, m) => sum + m.targetAmount, 0);
                const paidTowardsThis = Math.max(0, totalPaid - previousTargets);
                const dueAmount = Math.max(0, milestone.targetAmount - paidTowardsThis);
                const amountStr = `₹${Math.round(dueAmount).toLocaleString('en-IN')}`;

                let parameters = [];
                if (templateName === 'auragold_gentle_reminder') {
                    // Dear {{1}}, reminder that your installment of {{2}} for order {{3}} is due. Pay here: {{4}}
                    parameters = [
                        { type: "text", text: customerName },
                        { type: "text", text: amountStr },
                        { type: "text", text: orderData.id },
                        { type: "text", text: paymentLink }
                    ];
                } else if (templateName === 'auragold_payment_overdue') {
                    // Dear {{1}}, we noticed your payment of {{2}} is overdue. Clear dues via: {{3}}
                    parameters = [
                        { type: "text", text: customerName },
                        { type: "text", text: amountStr },
                        { type: "text", text: paymentLink }
                    ];
                } else if (templateName === 'auragold_payment_overdue_alert') {
                    // Dear {{1}}, your payment of {{2}} for Order {{3}} is overdue.
                    parameters = [
                        { type: "text", text: customerName },
                        { type: "text", text: amountStr },
                        { type: "text", text: orderData.id }
                    ];
                } else if (templateName === 'auragold_urgent_lapse') {
                    // URGENT {{1}}: Your Gold Rate Protection for order {{2}} expires in 24 hours. Pay {{3}} immediately: {{4}}
                    parameters = [
                        { type: "text", text: customerName },
                        { type: "text", text: orderData.id },
                        { type: "text", text: amountStr },
                        { type: "text", text: paymentLink }
                    ];
                }

                const components = parameters.length > 0 ? [{ type: "body", parameters }] : [];

                try {
                    const sendRes = await sendWhatsAppMessage({
                        to: customerPhone,
                        templateName,
                        components,
                        customerName,
                        phoneId,
                        token,
                        sentBy: 'SYSTEM_REMINDER',
                        metadata: { scheduleId: milestone.id, tone, diffDays },
                        orderId: orderData.id
                    });

                    results.remindersSent++;
                    results.details.push({
                        orderId: orderData.id,
                        customerName,
                        customerPhone,
                        milestoneId: milestone.id,
                        templateName,
                        tone,
                        diffDays,
                        status: 'SENT',
                        res: sendRes
                    });
                    console.log(`[ReminderService] Successfully sent ${tone} reminder to ${customerPhone} (${templateName})`);
                } catch (sendErr) {
                    console.error(`[ReminderService] Failed to send ${templateName} to ${customerPhone}:`, sendErr.message);
                    results.details.push({
                        orderId: orderData.id,
                        customerName,
                        customerPhone,
                        milestoneId: milestone.id,
                        templateName,
                        tone,
                        diffDays,
                        status: 'FAILED',
                        error: sendErr.message
                    });
                }
            }
        }

        connection.release();
        return results;
    } catch (e) {
        console.error("[ReminderService] Fatal Error in runPaymentReminders:", e);
        results.error = e.message;
        return results;
    }
}
