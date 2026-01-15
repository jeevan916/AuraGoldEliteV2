
import { WhatsAppLogEntry, GlobalSettings, WhatsAppTemplate } from "../types";
import { storageService } from "./storageService";
import { errorService } from "./errorService";

export interface WhatsAppResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  logEntry?: WhatsAppLogEntry;
}

const API_VERSION = "v21.0";

export const whatsappService = {
  formatPhoneNumber(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) return `91${cleaned}`;
    return cleaned;
  },

  getSettings(): GlobalSettings {
    return storageService.getSettings();
  },

  async validateCredentials(): Promise<{ success: boolean; message: string }> {
      const settings = this.getSettings();
      // Simple check of settings existence, actual validation happens on first send via proxy
      if (!settings.whatsappPhoneNumberId || !settings.whatsappBusinessToken) {
          return { success: false, message: "Missing Credentials" };
      }
      return { success: true, message: "Credentials Configured (Proxy Mode)" };
  },

  async fetchMetaTemplates(): Promise<any[]> {
     // Template management still requires direct API or sophisticated proxying. 
     // For now, we return empty or implement a proxy route if strictly needed.
     // Skipping mainly to focus on Messaging reliability.
     return [];
  },

  async createMetaTemplate(template: WhatsAppTemplate): Promise<{ success: boolean; finalName?: string; error?: any; debugPayload?: any; rawResponse?: any }> {
     // Simplified for stability. In a real app, this would POST to Facebook Graph API via proxy.
     return { 
        success: false, 
        error: { message: "Template creation requires advanced proxy setup." },
        debugPayload: { template },
        rawResponse: { status: 'mock_not_implemented' }
     };
  },

  async sendTemplateMessage(to: string, templateName: string, languageCode: string = 'en_US', variables: string[] = [], customerName: string): Promise<WhatsAppResponse> {
    const recipient = this.formatPhoneNumber(to);
    const settings = this.getSettings();
    
    if (!settings.whatsappPhoneNumberId || !settings.whatsappBusinessToken) {
        return { success: false, error: "API Credentials Missing" };
    }

    try {
        // Call OUR backend, not Meta directly
        const response = await fetch('/api/whatsapp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phoneId: settings.whatsappPhoneNumberId,
                token: settings.whatsappBusinessToken,
                to: recipient,
                templateName,
                language: languageCode,
                variables
            })
        });

        const data = await response.json();
        if (!data.success) throw new Error(data.error || "Proxy Error");

        return {
          success: true,
          messageId: data.data?.messages?.[0]?.id,
          logEntry: {
            id: data.data?.messages?.[0]?.id || `wamid.${Date.now()}`,
            customerName, phoneNumber: recipient, message: `[Template: ${templateName}]`,
            status: 'SENT', timestamp: new Date().toISOString(), type: 'TEMPLATE', direction: 'outbound'
          }
        };
    } catch (error: any) {
        errorService.logError("WhatsApp API", error.message, "MEDIUM");
        return { success: false, error: error.message };
    }
  },

  async sendMessage(to: string, message: string, customerName: string): Promise<WhatsAppResponse> {
    const recipient = this.formatPhoneNumber(to);
    const settings = this.getSettings();
    
    if (!settings.whatsappPhoneNumberId || !settings.whatsappBusinessToken) {
        return { success: false, error: "API Credentials Missing" };
    }

    try {
      // Call OUR backend
      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            phoneId: settings.whatsappPhoneNumberId,
            token: settings.whatsappBusinessToken,
            to: recipient,
            message
        })
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error || "Proxy Error");

      return {
        success: true,
        messageId: data.data?.messages?.[0]?.id,
        logEntry: {
          id: data.data?.messages?.[0]?.id || `wamid.${Date.now()}`,
          customerName, phoneNumber: recipient, message,
          status: 'SENT', timestamp: new Date().toISOString(), type: 'CUSTOM', direction: 'outbound'
        }
      };
    } catch (e: any) { 
        errorService.logError("WhatsApp API", e.message, "MEDIUM");
        return { success: false, error: e.message }; 
    }
  }
};
