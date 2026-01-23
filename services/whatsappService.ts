
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
 */
const sanitizeForMeta = (text: string | number | undefined | null): string => {
    if (text === null || text === undefined) return " ";
    return text.toString()
        .replace(/[\r\n]+/g, ' ')   // Replace newlines with space (Strict for variables)
        .replace(/\t/g, ' ')        // Replace tabs with space
        .replace(/\s{2,}/g, ' ')    // Collapse multiple spaces
        .trim();
};

/**
 * Helper to construct the Meta Components array correctly.
 * Crucial for templates with variables {{1}}, as they REQUIRE an 'example' field.
 */
const constructMetaComponents = (content: string, variableExamples: string[] = [], structure?: any[]) => {
    // If a structure is provided (e.g. Buttons/Headers), we use it but update the BODY
    const components = structure ? [...structure] : [];
    
    // Find or Create BODY component
    const bodyIndex = components.findIndex(c => c.type === 'BODY');
    const hasVariables = content.includes('{{1}}');

    const bodyComponent: any = {
        type: 'BODY',
        text: content
    };

    if (hasVariables && variableExamples.length > 0) {
        // Meta requires examples to be an array of arrays of strings
        // e.g. { body_text: [ ["John", "100"] ] }
        bodyComponent.example = {
            body_text: [variableExamples]
        };
    }

    if (bodyIndex >= 0) {
        components[bodyIndex] = bodyComponent;
    } else {
        components.push(bodyComponent);
    }

    return components;
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
             console.error("❌ META FETCH ERROR:", data);
             throw data;
         } 
         return data.data || [];
     } catch (e: any) {
         errorService.logError('Meta_Fetch', e.error?.message || e.message || 'Fetch failed', 'MEDIUM', undefined, undefined, e);
         return [];
     }
  },

  async createMetaTemplate(template: WhatsAppTemplate): Promise<{ success: boolean; finalName?: string; error?: any }> {
     const settings = this.getSettings();
     const token = settings.whatsappBusinessToken?.trim();
     if (!settings.whatsappBusinessAccountId || !token) return { success: false, error: { message: "Credentials missing" } };

     const finalName = template.name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
     
     // Construct components ensuring examples are present for variables
     const components = constructMetaComponents(template.content, template.variableExamples, template.structure);
     
     const payload = { 
         name: finalName, 
         category: template.category || "UTILITY", 
         language: "en_US", 
         components 
     };

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
             const errorMsg = data.error?.message || data.error || "Unknown Meta API Error";
             console.error("❌ META CREATE ERROR:", errorMsg);
             return { success: false, error: { message: errorMsg } };
         }
         return { success: true, finalName: data.data?.name || finalName };
     } catch (e: any) {
         return { success: false, error: { message: e.message || "Network Error" } };
     }
  },

  async editMetaTemplate(templateId: string, template: WhatsAppTemplate): Promise<{ success: boolean; error?: any }> {
      const settings = this.getSettings();
      const token = settings.whatsappBusinessToken?.trim();
      if (!settings.whatsappBusinessAccountId || !token) return { success: false, error: { message: "Credentials missing" } };

      // Ensure examples are packed for the update
      const components = constructMetaComponents(template.content, template.variableExamples, template.structure);
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
              const errorMsg = data.error?.message || (typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
              console.error("❌ META EDIT ERROR:", errorMsg);
              return { success: false, error: { message: errorMsg } };
          }
          return { success: true };
      } catch (e: any) {
          return { success: false, error: { message: e.message || "Network Error" } };
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
              return { success: false, error: { message: data.error?.message || "Delete Failed" } };
          }
          return { success: true };
      } catch (e: any) {
          return { success: false, error: { message: e.message } };
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

        // 2. Body Parameters
        if (bodyVariables.length > 0) {
            components.push({ 
                type: "body", 
                parameters: bodyVariables.map(v => ({ 
                    type: "text", 
                    text: sanitizeForMeta(v) 
                })) 
            });
        }

        // 3. Button Parameters
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
            const errDetail = data.error?.message || data.error || "Meta API Error";
            console.error(`[WhatsAppService] Send Failed for ${safeTemplateName}:`, errDetail);
            
            const severity = errDetail.includes('Receiver is incapable') ? 'LOW' : 'HIGH';
            errorService.logError('WhatsApp_Send', `Failed to send ${safeTemplateName}: ${errDetail}`, severity, undefined, undefined, data);
            return { success: false, error: errDetail, raw: data.raw };
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
          const errDetail = data.error?.message || data.error || "Meta Message Error";
          console.error("❌ RAW META MESSAGE ERROR:", errDetail);
          throw { message: errDetail, raw: data.raw };
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
        return { success: false, error: e.message || "Send Failed", raw: e.raw }; 
    }
  }
};
