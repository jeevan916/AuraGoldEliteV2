import { getPool, normalizePhone } from './db.js';
import { sendWhatsAppMessage } from './whatsapp.js';

export async function runPaymentReminders() {
    console.log("[ReminderService] Starting daily payment reminder check...");
    try {
        const pool = getPool();
        const connection = await pool.getConnection();

        // Fetch settings
        const [settingsRows] = await connection.query("SELECT config FROM integrations WHERE provider = ?", ['core_settings']);
        const config = settingsRows.length > 0 ? typeof settingsRows[0].config === "string" ? JSON.parse(settingsRows[0].config) : settingsRows[0].config : {};
        const reminderScheduleDays = config.reminderScheduleDays || [15, 7, 3];
        const overdueFrequencyDays = config.overdueFrequencyDays || 2;
        const maxRemindersPerMilestone = config.maxRemindersPerMilestone || 5;

        // Fetch WhatsApp credentials
        const [whatsappRows] = await connection.query("SELECT config FROM integrations WHERE provider = ?", ['whatsapp']);
        const whatsappConfig = whatsappRows.length > 0 ? typeof whatsappRows[0].config === "string" ? JSON.parse(whatsappRows[0].config) : whatsappRows[0].config : {};
        const { phoneId, token } = whatsappConfig;

        // Fetch orders and their payment schedules
        const [schedules] = await connection.query("SELECT ps.*, o.data as orderData FROM payment_schedules ps JOIN orders o ON ps.orderId = o.id WHERE ps.status = 'PENDING' AND o.status IN ('ACTIVE', 'OVERDUE')");

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // Check if the custom auragold_payment_overdue_alert template exists in the database
        const [overdueAlertRows] = await connection.query("SELECT id FROM templates WHERE name = ?", ["auragold_payment_overdue_alert"]);
        const useOverdueAlert = overdueAlertRows.length > 0;

        // Sort reminder schedule days descending to dynamically map templates (furthest -> closest)
        const sortedScheduleDays = [...reminderScheduleDays].sort((a, b) => b - a);

        for (const schedule of schedules) {
            const orderData = JSON.parse(schedule.orderData);
            const customerName = orderData.customerName;
            const customerPhone = orderData.customerContact || orderData.customerPhone;
            
            // Normalize dueDate and today to midnight to avoid hours/minutes/seconds offset issues
            const dueDateRaw = new Date(schedule.dueDate);
            const dueDate = new Date(dueDateRaw.getFullYear(), dueDateRaw.getMonth(), dueDateRaw.getDate());
            
            const diffTime = dueDate.getTime() - today.getTime();
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
            
            console.log(`[ReminderService] Checking schedule ${schedule.id} for ${customerName}. Due in ${diffDays} days.`);

            let templateName = null;
            let tone = null;

            if (diffDays > 0 && reminderScheduleDays.includes(diffDays)) {
                // Upcoming Reminder stage mapping
                const dayIndex = sortedScheduleDays.indexOf(diffDays);
                if (dayIndex === 0) {
                    // Furthest scheduled day
                    templateName = 'auragold_gentle_reminder';
                    tone = 'POLITE';
                } else if (dayIndex === sortedScheduleDays.length - 1) {
                    // Closest scheduled day
                    templateName = 'auragold_urgent_lapse';
                    tone = 'FIRM';
                } else {
                    // Intermediate scheduled days
                    templateName = useOverdueAlert ? 'auragold_payment_overdue_alert' : 'auragold_payment_overdue';
                    tone = 'ENCOURAGING';
                }
            } else if (diffDays <= 0 && (Math.abs(diffDays) % overdueFrequencyDays === 0)) {
                // Overdue Reminder
                templateName = 'auragold_urgent_lapse';
                tone = 'URGENT';
            }

            if (templateName) {
                // Collision Avoidance: Check for recent rate breach alerts (last 24 hours)
                const normalizedPhone = normalizePhone(customerPhone);
                const [breachLogRows] = await connection.query(
                    "SELECT COUNT(*) as count FROM whatsapp_logs WHERE phone = ? AND (data LIKE '%auragold_rate_adjustment_alert%' OR data LIKE '%auragold_rate_stabilized%') AND timestamp > ?",
                    [normalizedPhone, new Date(now.getTime() - 24 * 60 * 60 * 1000)]
                );

                if (breachLogRows[0].count > 0) {
                    console.log(`[ReminderService] Skipping reminder for ${customerPhone} due to recent rate breach alert.`);
                    continue;
                }

                // Strictly limit reminders to at most one per schedule milestone per calendar day (prevent server restart duplicate spam)
                const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const [dailyLogRows] = await connection.query(
                    "SELECT COUNT(*) as count FROM whatsapp_logs WHERE data LIKE ? AND timestamp >= ?",
                    [`%${schedule.id}%`, startOfToday]
                );

                if (dailyLogRows[0].count > 0) {
                    console.log(`[ReminderService] Already sent a reminder for schedule ${schedule.id} today. Skipping duplicate.`);
                    continue;
                }

                // Check total warning limit over the milestone lifetime
                const [totalLogRows] = await connection.query(
                    "SELECT COUNT(*) as count FROM whatsapp_logs WHERE data LIKE ?",
                    [`%${schedule.id}%`]
                );
                if (totalLogRows[0].count >= maxRemindersPerMilestone) {
                    console.log(`[ReminderService] Max reminders (${maxRemindersPerMilestone}) reached for schedule ${schedule.id}. Skipping.`);
                    continue;
                }

                // Fetch order to get shareToken
                const shareToken = orderData.shareToken || "";
                const paymentLink = `https://order.auragoldelite.com/?token=${shareToken}`;
                const amountStr = `₹${schedule.targetAmount.toLocaleString()}`;

                let parameters = [];
                if (templateName === 'auragold_gentle_reminder') {
                    parameters = [
                        { type: "text", text: customerName || "Customer" },
                        { type: "text", text: amountStr },
                        { type: "text", text: schedule.orderId },
                        { type: "text", text: paymentLink }
                    ];
                } else if (templateName === 'auragold_payment_overdue_alert') {
                    parameters = [
                        { type: "text", text: customerName || "Customer" },
                        { type: "text", text: amountStr },
                        { type: "text", text: schedule.orderId }
                    ];
                } else if (templateName === 'auragold_payment_overdue') {
                    parameters = [
                        { type: "text", text: customerName || "Customer" },
                        { type: "text", text: amountStr },
                        { type: "text", text: paymentLink }
                    ];
                } else if (templateName === 'auragold_urgent_lapse') {
                    parameters = [
                        { type: "text", text: customerName || "Customer" },
                        { type: "text", text: schedule.orderId },
                        { type: "text", text: amountStr },
                        { type: "text", text: paymentLink }
                    ];
                }

                const components = parameters.length > 0 ? [{ type: "body", parameters }] : [];

                try {
                    await sendWhatsAppMessage({
                        to: customerPhone,
                        templateName,
                        components,
                        customerName: customerName,
                        phoneId,
                        token,
                        metadata: { scheduleId: schedule.id },
                        orderId: schedule.orderId
                    });
                    console.log(`[ReminderService] Sent ${tone} reminder for schedule ${schedule.id} (${templateName})`);
                } catch (err) {
                    console.error(`[ReminderService] Failed to send ${templateName} to ${customerPhone}:`, err.message);
                }
            }
        }
        connection.release();
    } catch (e) {
        console.error("[ReminderService] Error:", e);
    }
}
