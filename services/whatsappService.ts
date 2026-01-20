
import { WhatsAppLogEntry, GlobalSettings, WhatsAppTemplate, MetaCategory, AppTemplateGroup } from "../types";
import { storageService } from "./storageService";
import { errorService } from "./errorService";
import { REQUIRED_SYSTEM_TEMPLATES } from "../constants";

export interface WhatsAppResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  raw?: any;
  logEntry?: WhatsAppLogEntry;
}

const API_BASE = process.env.VITE_API_BASE_URL || '';

export const whatsappService = {
  formatPhoneNumber(phone: string): string {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('0')) cleaned = cleaned.substring(1);
    if (cleaned.length === 10) return `91${cleaned}`;
    if (cleaned.length === 12 && cleaned.startsWith('91')) return cleaned;
    return cleaned;
  },

  getSettings(): GlobalSettings {
    return storageService.getSettings();
  },

  async fetchMetaTemplates(): Promise<any[]> {
     const settings = this.getSettings();
     const token = settings.whatsappBusinessToken?.trim();
     if (!settings.whatsappBusinessAccountId || !token) return [];

     try {
         const response = await fetch(`${API_BASE}/api/whatsapp/templates`, {
             method: 'GET',
             headers: {
                 'Content-Type': 'application/json',
                 'x-waba-id': settings.whatsappBusinessAccountId,
                 'x-auth-token': token
             }
         });
         const data = await response.json();
         if (!data.success) throw data; 
         return data.data || [];
     } catch (e: any) {
         errorService.logError('Meta_Fetch', e.error || e.message, 'MEDIUM', undefined, undefined, e);
         return [];
     }
  },

  async createMetaTemplate(template: WhatsAppTemplate): Promise<{ success: boolean; finalName?: string; error?: any }> {
     const settings = this.getSettings();
     const token = settings.whatsappBusinessToken?.trim();
     if (!settings.whatsappBusinessAccountId || !token) return { success: false, error: { message: "Credentials missing" } };

     const finalName = template.name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
     const components = template.structure || [{ type: "BODY", text: template.content }];
     
     const payload = { name: finalName, category: template.category || "UTILITY", language: "en_US", components };

     try {
         const response = await fetch(`${API_BASE}/api/whatsapp/templates`, {
             method: 'POST',
             headers: {
                 'Content-Type': 'application/json',
                 'x-waba-id': settings.whatsappBusinessAccountId,
                 'x-auth-token': token
             },
             body: JSON.stringify(payload)
         });
         const data = await response.json();
         if (!data.success) throw data;
         return { success: true, finalName: data.data?.name || finalName };
     } catch (e: any) {
         errorService.logError('Meta_Create', e.error || 'Failed to create template', 'MEDIUM', undefined, undefined, e);
         return { success: false, error: e };
     }
  },

  async editMetaTemplate(templateId: string, template: WhatsAppTemplate): Promise<{ success: boolean; error?: any }> {
      const settings = this.getSettings();
      const token = settings.whatsappBusinessToken?.trim();
      if (!settings.whatsappBusinessAccountId || !token) return { success: false, error: { message: "Credentials missing" } };

      const components = template.structure || [{ type: "BODY", text: template.content }];
      const payload = { components };

      try {
          const response = await fetch(`${API_BASE}/api/whatsapp/templates/${templateId}`, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'x-waba-id': settings.whatsappBusinessAccountId,
                  'x-auth-token': token
              },
              body: JSON.stringify(payload)
          });
          const data = await response.json();
          if (!data.success) throw data;
          return { success: true };
      } catch (e: any) {
          errorService.logError('Meta_Edit', e.error || 'Failed to edit template', 'MEDIUM', undefined, undefined, e);
          return { success: false, error: e };
      }
  },

  // Add missing deleteMetaTemplate method
  async deleteMetaTemplate(name: string): Promise<{ success: boolean; error?: any }> {
      const settings = this.getSettings();
      const token = settings.whatsappBusinessToken?.trim();
      if (!settings.whatsappBusinessAccountId || !token) return { success: false, error: { message: "Credentials missing" } };

      try {
          const response = await fetch(`${API_BASE}/api/whatsapp/templates?name=${name}`, {
              method: 'DELETE',
              headers: {
                  'Content-Type': 'application/json',
                  'x-waba-id': settings.whatsappBusinessAccountId,
                  'x-auth-token': token
              }
          });
          const data = await response.json();
          if (!data.success) throw data;
          return { success: true };
      } catch (e: any) {
          errorService.logError('Meta_Delete', e.error || 'Failed to delete template', 'MEDIUM', undefined, undefined, e);
          return { success: false, error: e };
      }
  },

  async sendTemplateMessage(to: string, templateName: string, languageCode: string = 'en_US', bodyVariables: string[] = [], customerName: string, buttonVariable?: string, retryCount = 0): Promise<WhatsAppResponse> {
    const recipient = this.formatPhoneNumber(to);
    if (!recipient) return { success: false, error: "Invalid Phone Number" };

    const settings = this.getSettings();
    const token = settings.whatsappBusinessToken?.trim();
    if (!settings.whatsappPhoneNumberId || !token) return { success: false, error: "API Credentials Missing" };

    try {
        const components: any[] = [];
        if (bodyVariables.length > 0) {
            components.push({ type: "body", parameters: bodyVariables.map(v => ({ type: "text", text: v })) });
        }
        if (buttonVariable) {
            components.push({ type: "button", sub_type: "url", index: 0, parameters: [{ type: "text", text: buttonVariable }] });
        }

        const response = await fetch(`${API_BASE}/api/whatsapp/send`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-phone-id': settings.whatsappPhoneNumberId,
                'x-auth-token': token
            },
            body: JSON.stringify({ to: recipient, templateName, language: languageCode, components, customerName })
        });

        const data = await response.json();
        
        if (!data.success) {
            // Log the RAW data to ErrorService for AI Healing
            errorService.logError('WhatsApp_Send', `Meta API Failure for ${templateName}`, 'HIGH', undefined, undefined, data);
            
            if (retryCount < 1) {
                const errorMsg = JSON.stringify(data.error || "").toLowerCase();
                if (errorMsg.includes("not found") || errorMsg.includes("exist") || errorMsg.includes("parameter")) {
                    console.log("[WhatsApp] Triggering Auto-Heal Strategy...");
                    // Logic handled in errorService
                }
            }
            throw new Error(data.error || "Meta API Error");
        }

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
        return { success: false, error: error.message };
    }
  },

  async sendMessage(to: string, message: string, customerName: string): Promise<WhatsAppResponse> {
    const recipient = this.formatPhoneNumber(to);
    if (!recipient) return { success: false, error: "Invalid Phone Number" };

    const settings = this.getSettings();
    const token = settings.whatsappBusinessToken?.trim();
    if (!settings.whatsappPhoneNumberId || !token) return { success: false, error: "API Credentials Missing" };

    try {
      const response = await fetch(`${API_BASE}/api/whatsapp/send`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'x-phone-id': settings.whatsappPhoneNumberId,
            'x-auth-token': token
        },
        body: JSON.stringify({ to: recipient, message, customerName })
      });

      const data = await response.json();
      if (!data.success) throw data;

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
        errorService.logError('WhatsApp_Custom', e.error || e.message, 'MEDIUM', undefined, undefined, e);
        return { success: false, error: e.message || "Send Failed" }; 
    }
  }
};
