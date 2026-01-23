
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

/**
 * Helper to sanitize text for Meta API.
 * Meta rejects payloads if parameters contain newlines (\n) or tabs (\t).
 * We replace them with a visual separator.
 */
const sanitizeForMeta = (text: string | number | undefined | null): string => {
    if (text === null || text === undefined) return " ";
    return text.toString()
        .replace(/[\r\n]+/g, ' | ') // Replace newlines with a pipe separator
        .replace(/\t/g, ' ')        // Replace tabs with space
        .replace(/\s{2,}/g, ' ')    // Collapse multiple spaces
        .trim();
};

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
    // Ensure we get the latest settings from storage
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
         if (!data.success) {
             console.error("❌ RAW META TEMPLATE ERROR:", JSON.stringify(data.raw || data.error, null, 2));
             throw data;
         } 
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
         if (!data.success) {
             console.error("❌ RAW META CREATE ERROR:", JSON.stringify(data.raw || data.error, null, 2));
             throw data;
         }
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
          if (!data.success) {
              console.error("❌ RAW META EDIT ERROR:", JSON.stringify(data.raw || data.error, null, 2));
              throw data;
          }
          return { success: true };
      } catch (e: any) {
          errorService.logError('Meta_Edit', e.error || 'Failed to edit template', 'MEDIUM', undefined, undefined, e);
          return { success: false, error: e };
      }
  },

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
          if (!data.success) {
              console.error("❌ RAW META DELETE ERROR:", JSON.stringify(data.raw || data.error, null, 2));
              throw data;
          }
          return { success: true };
      } catch (e: any) {
          errorService.logError('Meta_Delete', e.error || 'Failed to delete template', 'MEDIUM', undefined, undefined, e);
          return { success: false, error: e };
      }
  },

  async sendTemplateMessage(
    to: string, 
    templateName: string, 
    languageCode: string = 'en_US', 
    bodyVariables: string[] = [], 
    customerName: string, 
    buttonVariable?: string,
    headerImageUrl?: string
  ): Promise<WhatsAppResponse> {
    const recipient = this.formatPhoneNumber(to);
    if (!recipient) return { success: false, error: "Invalid Phone Number" };

    const settings = this.getSettings();
    const token = settings.whatsappBusinessToken?.trim();
    if (!settings.whatsappPhoneNumberId || !token) return { success: false, error: "WhatsApp API Credentials Missing in Settings" };

    // Meta template names must be lowercase
    const safeTemplateName = templateName.toLowerCase().trim();

    try {
        const components: any[] = [];
        
        // 1. Header Parameter (Images)
        if (headerImageUrl) {
            components.push({
                type: "header",
                parameters: [{
                    type: "image",
                    image: { link: headerImageUrl }
                }]
            });
        }

        // 2. Body Parameters (Must be lowercase 'body')
        // Even if empty, if the template expects params, we must send them. 
        // If not empty, we map.
        if (bodyVariables.length > 0) {
            components.push({ 
                type: "body", 
                parameters: bodyVariables.map(v => ({ 
                    type: "text", 
                    text: sanitizeForMeta(v) // <--- SANITIZATION APPLIED HERE
                })) 
            });
        }

        // 3. Button Parameters (Dynamic URLs)
        if (buttonVariable) {
            components.push({ 
                type: "button", 
                sub_type: "url", 
                index: 0, 
                parameters: [{ 
                    type: "text", 
                    text: sanitizeForMeta(buttonVariable) 
                }] 
            });
        }

        const payload = { 
            to: recipient, 
            templateName: safeTemplateName, 
            language: languageCode, 
            components, 
            customerName 
        };

        const response = await fetch(`${API_BASE}/api/whatsapp/send`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-phone-id': settings.whatsappPhoneNumberId,
                'x-auth-token': token
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        if (!data.success) {
            console.error(`[WhatsAppService] Send Failed for ${safeTemplateName}:`, data.error);
            console.error("❌ RAW META ERROR RESPONSE:", JSON.stringify(data.raw, null, 2));
            
            // Don't log HIGH severity for user errors like invalid number
            const severity = data.error?.includes('Receiver is incapable') ? 'LOW' : 'HIGH';
            errorService.logError('WhatsApp_Send', `Failed to send ${safeTemplateName}: ${data.error || 'Unknown Error'}`, severity, undefined, undefined, data);
            return { success: false, error: data.error, raw: data.raw };
        }

        return {
          success: true,
          messageId: data.data?.messages?.[0]?.id,
          logEntry: {
            id: data.data?.messages?.[0]?.id || `wamid.${Date.now()}`,
            customerName, 
            phoneNumber: recipient, 
            message: `[Template: ${safeTemplateName}]`,
            status: 'SENT', 
            timestamp: new Date().toISOString(), 
            type: 'TEMPLATE', 
            direction: 'outbound'
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
    if (!settings.whatsappPhoneNumberId || !token) return { success: false, error: "WhatsApp API Credentials Missing in Settings" };

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
      if (!data.success) {
          console.error("❌ RAW META MESSAGE ERROR:", JSON.stringify(data.raw || data.error, null, 2));
          throw data;
      }

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
        return { success: false, error: e.message || "Send Failed", raw: e.raw }; 
    }
  }
};
