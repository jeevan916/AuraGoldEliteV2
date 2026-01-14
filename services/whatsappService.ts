
/**
 * WhatsApp Business API Service
 * Handles automated messaging to customers for payment reminders and order updates.
 */

import { WhatsAppLogEntry, MessageStatus, GlobalSettings, WhatsAppTemplate } from "../types";
import { REQUIRED_SYSTEM_TEMPLATES, INITIAL_SETTINGS } from "../constants";
import { errorService } from "./errorService";

export interface WhatsAppResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  logEntry?: WhatsAppLogEntry;
  rawResponse?: any; 
}

const API_VERSION = "v21.0";

export const whatsappService = {
  formatPhoneNumber(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) return `91${cleaned}`;
    return cleaned;
  },

  getSettings(): GlobalSettings {
    try {
        const settingsStr = localStorage.getItem('aura_settings');
        if (settingsStr) {
            const saved = JSON.parse(settingsStr);
            // MERGE LOGIC: Prioritize Environment Variables if storage fields are empty/missing
            return {
                ...INITIAL_SETTINGS,
                ...saved,
                whatsappPhoneNumberId: saved.whatsappPhoneNumberId || INITIAL_SETTINGS.whatsappPhoneNumberId,
                whatsappBusinessAccountId: saved.whatsappBusinessAccountId || INITIAL_SETTINGS.whatsappBusinessAccountId,
                whatsappBusinessToken: saved.whatsappBusinessToken || INITIAL_SETTINGS.whatsappBusinessToken,
            };
        }
        return INITIAL_SETTINGS;
    } catch (e) {
        return INITIAL_SETTINGS;
    }
  },

  async validateCredentials(): Promise<{ success: boolean; message: string }> {
      const settings = this.getSettings();
      
      const phoneId = settings.whatsappPhoneNumberId;
      const token = settings.whatsappBusinessToken;

      if (!phoneId || !token) {
          const missing = [];
          if (!token) missing.push("Token");
          if (!phoneId) missing.push("Phone ID");
          return { success: false, message: `Configuration Error: ${missing.join(' and ')} missing from environment.` };
      }

      try {
          const response = await fetch(`https://graph.facebook.com/${API_VERSION}/${phoneId}`, {
              headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await response.json();
          
          if (data.error) {
              return { success: false, message: `Meta Error: ${data.error.message}` };
          }
          
          if (data.id) {
              return { success: true, message: "AuraGold Connection Verified!" };
          }
          
          return { success: false, message: "Handshake failed (Malformed response)." };
      } catch (e: any) {
          return { success: false, message: `Network Failure: ${e.message}` };
      }
  },

  async fetchMetaTemplates(): Promise<any[]> {
    const settings = this.getSettings();
    const token = settings.whatsappBusinessToken;
    if (!token) return [];

    let wabaId = settings.whatsappBusinessAccountId;

    try {
        if (!wabaId && settings.whatsappPhoneNumberId) {
            const wabaReq = await fetch(`https://graph.facebook.com/${API_VERSION}/${settings.whatsappPhoneNumberId}?fields=business_account`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const wabaData = await wabaReq.json();
            wabaId = wabaData?.business_account?.id;
        }

        if (!wabaId) return [];

        const tplReq = await fetch(`https://graph.facebook.com/${API_VERSION}/${wabaId}/message_templates?limit=100`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const tplData = await tplReq.json();
        
        if (tplData.data) {
            return tplData.data.map((t: any) => ({ ...t, source: 'META' }));
        }
        return [];
    } catch (e: any) {
        return [];
    }
  },

  async createMetaTemplate(template: WhatsAppTemplate): Promise<{ success: boolean; error?: any; finalName?: string; rawResponse?: any; debugPayload?: any }> {
      const settings = this.getSettings();
      const token = settings.whatsappBusinessToken;
      if (!token) return { success: false, error: { message: "Auth Token missing." } };

      let wabaId = settings.whatsappBusinessAccountId;

      try {
        if (!wabaId && settings.whatsappPhoneNumberId) {
            const wabaReq = await fetch(`https://graph.facebook.com/${API_VERSION}/${settings.whatsappPhoneNumberId}?fields=business_account`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const wabaData = await wabaReq.json();
            wabaId = wabaData?.business_account?.id;
        }

        if (!wabaId) throw new Error("WABA ID missing.");

        const baseName = template.name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
        const bodyText = template.content.replace(/{{(.*?)}}/g, (_, i) => `{{${parseInt(i) || 1}}}`);

        const payload = {
            name: baseName,
            category: template.category || "UTILITY", 
            language: "en_US",
            components: [
                {
                    type: "BODY",
                    text: bodyText,
                    example: template.variableExamples ? { body_text: [ template.variableExamples ] } : undefined
                }
            ]
        };

        const response = await fetch(`https://graph.facebook.com/${API_VERSION}/${wabaId}/message_templates`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const resData = await response.json();
        if (resData.success || resData.id) return { success: true, finalName: baseName, rawResponse: resData };
        return { success: false, error: resData.error, rawResponse: resData };
      } catch (e: any) {
          return { success: false, error: { message: e.message } };
      }
  },

  async sendTemplateMessage(to: string, templateName: string, languageCode: string = 'en_US', variables: string[] = [], customerName: string): Promise<WhatsAppResponse> {
    const recipient = this.formatPhoneNumber(to);
    const settings = this.getSettings();
    const phoneId = settings.whatsappPhoneNumberId;
    const token = settings.whatsappBusinessToken;
    
    if (!phoneId || !token) return { success: false, error: "Missing Credentials" };

    try {
        const body: any = {
            messaging_product: "whatsapp",
            to: recipient,
            type: "template",
            template: { 
                name: templateName, 
                language: { code: languageCode }, 
                components: variables.length > 0 ? [{
                    type: "body",
                    parameters: variables.map(v => ({ type: "text", text: String(v || "") }))
                }] : []
            }
        };

        const response = await fetch(`https://graph.facebook.com/${API_VERSION}/${phoneId}/messages`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await response.json();

        if (data.error) return { success: false, error: data.error.message, rawResponse: data };

        return {
          success: true,
          messageId: data.messages?.[0]?.id,
          logEntry: {
            id: data.messages?.[0]?.id || `wamid.${Date.now()}`,
            customerName, phoneNumber: recipient, message: `[Template: ${templateName}]`,
            status: 'SENT', timestamp: new Date().toISOString(), type: 'TEMPLATE', direction: 'outbound'
          }
        };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
  },

  async sendMessage(to: string, message: string, customerName: string): Promise<WhatsAppResponse> {
    const recipient = this.formatPhoneNumber(to);
    const settings = this.getSettings();
    const phoneId = settings.whatsappPhoneNumberId;
    const token = settings.whatsappBusinessToken;
    
    if (!phoneId || !token) return { success: false, error: "Credentials not configured" };

    try {
      const response = await fetch(`https://graph.facebook.com/${API_VERSION}/${phoneId}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: recipient,
          type: "text",
          text: { body: message }
        })
      });
      const data = await response.json();
      if (data.error) return { success: false, error: data.error.message, rawResponse: data };

      return {
        success: true,
        messageId: data.messages?.[0]?.id,
        logEntry: {
          id: data.messages?.[0]?.id || `wamid.${Date.now()}`,
          customerName, phoneNumber: recipient, message,
          status: 'SENT', timestamp: new Date().toISOString(), type: 'CUSTOM', direction: 'outbound'
        }
      };
    } catch (e: any) { 
        return { success: false, error: e.message }; 
    }
  },

  async simulateIncomingReply(to: string, customerName: string): Promise<WhatsAppLogEntry> {
      await new Promise(resolve => setTimeout(resolve, 2000));
      return {
          id: `wamid.inbound.${Date.now()}`,
          customerName,
          phoneNumber: this.formatPhoneNumber(to),
          message: "Payment confirmed, thank you.",
          status: 'READ',
          timestamp: new Date().toISOString(),
          type: 'INBOUND',
          direction: 'inbound'
      };
  },

  getDeepLink(to: string, message: string): string {
    const recipient = this.formatPhoneNumber(to);
    return `https://wa.me/${recipient}?text=${encodeURIComponent(message)}`;
  }
};
