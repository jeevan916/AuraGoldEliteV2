
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
     const settings = this.getSettings();
     if (!settings.whatsappBusinessAccountId || !settings.whatsappBusinessToken) {
         console.warn("[WhatsApp] Credentials missing for template fetch.");
         return [];
     }

     try {
         // Call our backend proxy
         const response = await fetch('/api/whatsapp/templates', {
             method: 'GET',
             headers: {
                 'Content-Type': 'application/json',
                 'x-waba-id': settings.whatsappBusinessAccountId,
                 'x-auth-token': settings.whatsappBusinessToken
             }
         });

         const data = await response.json();
         if (!data.success) throw new Error(data.error || "Failed to fetch templates via proxy");
         
         return data.data || [];
     } catch (e: any) {
         errorService.logError("WhatsApp API", `Template Fetch Failed: ${e.message}`, "MEDIUM");
         return [];
     }
  },

  async createMetaTemplate(template: WhatsAppTemplate): Promise<{ success: boolean; finalName?: string; error?: any; debugPayload?: any; rawResponse?: any }> {
     // Simplified for stability. In a real app, this would POST to Facebook Graph API via proxy.
     // For now, we mock success if in local mode, or implement a POST proxy if needed.
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
            headers: { 
                'Content-Type': 'application/json',
                'x-phone-id': settings.whatsappPhoneNumberId,
                'x-auth-token': settings.whatsappBusinessToken
            },
            body: JSON.stringify({
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
        headers: { 
            'Content-Type': 'application/json',
            'x-phone-id': settings.whatsappPhoneNumberId,
            'x-auth-token': settings.whatsappBusinessToken
        },
        body: JSON.stringify({
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
