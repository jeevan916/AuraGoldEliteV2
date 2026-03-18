import { getPool } from './db.js';
import { sendWhatsAppMessage } from './whatsapp.js';

export async function runPaymentReminders() {
    console.log("[ReminderService] Starting daily payment reminder check...");
    try {
        const pool = getPool();
        const connection = await pool.getConnection();

        // Fetch settings
        const [settingsRows] = await connection.query("SELECT config FROM integrations WHERE provider = ?", ['core_settings']);
        const config = settingsRows.length > 0 ? JSON.parse(settingsRows[0].config) : {};
        const reminderScheduleDays = config.reminderScheduleDays || [15, 7, 3];
        const overdueFrequencyDays = config.overdueFrequencyDays || 2;
        const maxRemindersPerMilestone = config.maxRemindersPerMilestone || 5;

        // Fetch WhatsApp credentials
        const [whatsappRows] = await connection.query("SELECT config FROM integrations WHERE provider = ?", ['whatsapp']);
        const whatsappConfig = whatsappRows.length > 0 ? JSON.parse(whatsappRows[0].config) : {};
        const { phoneId, token } = whatsappConfig;

        // Fetch orders and their payment schedules
        // Assuming there is a payment_schedules table
        const [schedules] = await connection.query("SELECT ps.*, o.customerName, o.customerPhone FROM payment_schedules ps JOIN orders o ON ps.orderId = o.id WHERE ps.status = 'PENDING'");

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        for (const schedule of schedules) {
            const dueDate = new Date(schedule.dueDate);
            const diffTime = dueDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            let templateName = null;
            let tone = null;

            if (diffDays > 0 && reminderScheduleDays.includes(diffDays)) {
                // Upcoming
                if (diffDays === 15) { templateName = 'auragold_gentle_reminder'; tone = 'POLITE'; }
                else if (diffDays === 7) { templateName = 'auragold_payment_overdue'; tone = 'ENCOURAGING'; }
                else if (diffDays === 3) { templateName = 'auragold_urgent_lapse'; tone = 'FIRM'; }
            } else if (diffDays <= 0 && (Math.abs(diffDays) % overdueFrequencyDays === 0)) {
                // Overdue
                templateName = 'auragold_urgent_lapse';
                tone = 'URGENT';
            }

            if (templateName) {
                // Check if already sent too many
                const [logRows] = await connection.query("SELECT COUNT(*) as count FROM whatsapp_logs WHERE data LIKE ? AND timestamp > ?", [`%${schedule.id}%`, new Date(now.getTime() - 24 * 60 * 60 * 1000)]);
                if (logRows[0].count < maxRemindersPerMilestone) {
                    await sendWhatsAppMessage({
                        to: schedule.customerPhone,
                        templateName,
                        customerName: schedule.customerName,
                        phoneId,
                        token
                    });
                    console.log(`[ReminderService] Sent ${tone} reminder for schedule ${schedule.id}`);
                }
            }
        }
        connection.release();
    } catch (e) {
        console.error("[ReminderService] Error:", e);
    }
}
