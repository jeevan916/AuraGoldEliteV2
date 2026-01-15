
import { storageService } from "./storageService";
import { errorService } from "./errorService";
import { WhatsAppLogEntry } from "../types";

export interface SmsResponse {
  success: boolean;
  error?: string;
  logEntry?: WhatsAppLogEntry;
}

export const smsService = {
  getSettings() {
    return storageService.getSettings();
  },

  async sendSMS(to: string, message: string, customerName: string): Promise<SmsResponse> {
    const settings = this.getSettings();
    // Assuming msg91AuthKey is added to GlobalSettings interface in a real scenario
    // For now using generic fields or assuming they are in settings
    const authKey = settings.msg91AuthKey; 
    const senderId = settings.msg91SenderId || "AURGLD";

    if (!authKey) return { success: false, error: "Msg91 Auth Key missing in settings" };

    try {
      const response = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authKey,
          senderId,
          to,
          message
        })
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error || "SMS Proxy Failed");

      return {
        success: true,
        logEntry: {
          id: `sms-${Date.now()}`,
          customerName, 
          phoneNumber: to, 
          message: `[SMS] ${message}`,
          status: 'SENT', 
          timestamp: new Date().toISOString(), 
          type: 'CUSTOM', 
          direction: 'outbound'
        }
      };
    } catch (e: any) {
      errorService.logError("SMS API", e.message, "MEDIUM");
      return { success: false, error: e.message };
    }
  }
};
