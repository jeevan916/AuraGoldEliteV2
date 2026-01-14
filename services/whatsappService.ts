
/**
 * WhatsApp Business API Service - Production Version
 * Strict implementation of Meta Graph API for jewelry order notifications.
 */

import { WhatsAppLogEntry, GlobalSettings, WhatsAppTemplate } from "../types";
import { INITIAL_SETTINGS } from "../constants";
import { errorService } from "./errorService";
import { storageService } from "./storageService";

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
      const phoneId = settings.whatsappPhoneNumberId;
      const token = settings.whatsappBusinessToken;

      if (!phoneId || !token) {
          return { success: false, message: "WhatsApp API credentials are not configured in settings." };
      }

      try {
          const response = await fetch(`https://graph.facebook.com/${API_VERSION}/${phoneId}`, {
              headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await response.json();
          if (data.error) throw new Error(data.error.message);
          return { success: true, message: "Meta API connectivity verified." };
      } catch (e: any) {
          return { success: false, message: `Validation Failed: ${e.message}` };
      }
  },

  // Added missing method to fetch templates from Meta Graph API
  async fetchMetaTemplates(): Promise<any[]> {
    const settings = this.getSettings();
    const wabaId = settings.whatsappBusinessAccountId;
    const token = settings.whatsappBusinessToken;
    
    if (!wabaId || !token) return [];

    try {
      const response = await fetch(`https://graph.facebook.com/${API_VERSION}/${wabaId}/message_templates`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      return data.data || [];
    } catch (error: any) {
      errorService.logError("WhatsApp API", `Fetch Templates Failed: ${error.message}`, "MEDIUM");
      return [];
    }
  },

  // Added missing method to create/deploy templates to Meta Graph API
  async createMetaTemplate(template: WhatsAppTemplate): Promise<{ success: boolean; finalName?: string; error?: any; debugPayload?: any; rawResponse?: any }> {
    const settings = this.getSettings();
    const wabaId = settings.whatsappBusinessAccountId;
    const token = settings.whatsappBusinessToken;
    
    if (!wabaId || !token) return { success: false, error: { message: "API Credentials Missing" } };

    const body = {
      name: template.name,
      category: template.category || "UTILITY",
      allow_category_change: true,
      language: "en_US",
      components: [
        {
          type: "BODY",
          text: template.content,
          example: template.variableExamples && template.variableExamples.length > 0 ? {
              body_text: [template.variableExamples]
          } : undefined
        }
      ]
    };

    try {
      const response = await fetch(`https://graph.facebook.com/${API_VERSION}/${wabaId}/message_templates`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      
      if (data.error) {
          return { 
              success: false, 
              error: data.error, 
              debugPayload: body, 
              rawResponse: data 
          };
      }

      return { 
          success: true, 
          finalName: template.name, 
          debugPayload: body, 
          rawResponse: data 
      };
    } catch (error: any) {
      return { 
          success: false, 
          error: { message: error.message }, 
          debugPayload: body 
      };
    }
  },

  async sendTemplateMessage(to: string, templateName: string, languageCode: string = 'en_US', variables: string[] = [], customerName: string): Promise<WhatsAppResponse> {
    const recipient = this.formatPhoneNumber(to);
    const settings = this.getSettings();
    const phoneId = settings.whatsappPhoneNumberId;
    const token = settings.whatsappBusinessToken;
    
    if (!phoneId || !token) return { success: false, error: "API Credentials Missing" };

    try {
        const body = {
            messaging_product: "whatsapp",
            to: recipient,
            type: "template",
            template: { 
                name: templateName, 
                language: { code: languageCode }, 
                components: variables.length > 0 ? [{
                    type: "body",
                    parameters: variables.map(v => ({ type: "text", text: String(v) }))
                }] : []
            }
        };

        const response = await fetch(`https://graph.facebook.com/${API_VERSION}/${phoneId}/messages`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await response.json();

        if (data.error) throw new Error(data.error.message);

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
        errorService.logError("WhatsApp API", error.message, "MEDIUM");
        return { success: false, error: error.message };
    }
  },

  async sendMessage(to: string, message: string, customerName: string): Promise<WhatsAppResponse> {
    const recipient = this.formatPhoneNumber(to);
    const settings = this.getSettings();
    const phoneId = settings.whatsappPhoneNumberId;
    const token = settings.whatsappBusinessToken;
    
    if (!phoneId || !token) return { success: false, error: "API Credentials Missing" };

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
      if (data.error) throw new Error(data.error.message);

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
        errorService.logError("WhatsApp API", e.message, "MEDIUM");
        return { success: false, error: e.message }; 
    }
  }
};
