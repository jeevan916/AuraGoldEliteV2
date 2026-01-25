
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
 */
const sanitizeForMeta = (text: string | number | undefined | null): string => {
    if (text === null || text === undefined) return " ";
    return text.toString()
        .replace(/[\r\n]+/g, ' ')
        .replace(/\t/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
};

/**
 * Helper to construct the Meta Components array correctly.
 * HANDLES: Body variables AND Button URL variables.
 */
const constructMetaComponents = (content: string, variableExamples: string[] = [], structure?: any[]) => {
    // 1. Start with provided structure or empty array
    let components = structure ? JSON.parse(JSON.stringify(structure)) : [];
    
    // 2. Locate or Create BODY
    let bodyIndex = components.findIndex((c: any) => c.type === 'BODY');
    
    // Calculate body variables
    const bodyMatches = content.match(/{{([0-9]+)}}/g) || [];
    const bodyIndices = bodyMatches.map(m => parseInt(m.replace(/[^0-9]/g, ''), 10));
    const maxBodyIndex = bodyIndices.length > 0 ? Math.max(...bodyIndices) : 0;

    const bodyComponent: any = {
        type: 'BODY',
        text: content
    };

    // 3. Inject Body Examples
    if (maxBodyIndex > 0) {
        const safeExamples = [...variableExamples];
        while(safeExamples.length < maxBodyIndex) {
            safeExamples.push(`sample_${safeExamples.length + 1}`);
        }
        // Slice specifically for BODY (assuming body vars come first or are the main ones)
        // Note: Complex splitting between body/button vars usually requires strict index mapping.
        // For AuraGold, we assume provided examples cover body vars first.
        const bodyEx = safeExamples.slice(0, maxBodyIndex);

        bodyComponent.example = {
            body_text: [bodyEx]
        };
    }

    if (bodyIndex >= 0) {
        components[bodyIndex] = { ...components[bodyIndex], ...bodyComponent };
    } else {
        components.push(bodyComponent);
    }

    // 4. Handle BUTTONS (URL Variables)
    // Templates like 'auragold_setu_payment' have {{1}} in the URL. Meta requires an example for this too.
    const buttonIndex = components.findIndex((c: any) => c.type === 'BUTTONS');
    if (buttonIndex >= 0) {
        const buttons = components[buttonIndex].buttons || [];
        // Check for URL buttons with dynamic parts
        const urlButtonIndex = buttons.findIndex((b: any) => b.type === 'URL' && b.url.includes('{{1}}'));
        
        if (urlButtonIndex >= 0) {
            // We need a separate example for the URL variable
            // Since we often pass a generic list of examples, let's grab the last one or a generic one
            const urlExample = variableExamples.length > 0 ? variableExamples[variableExamples.length - 1] : "123456";
            
            // Meta requires the 'example' field on the root of the URL button object
            if (!buttons[urlButtonIndex].example) {
                 buttons[urlButtonIndex].example = [urlExample]; 
            }
        }
        components[buttonIndex].buttons = buttons;
    }

    return components;
};

export const whatsappService = {
  formatPhoneNumber(phone: string): string {
    if (!phone) return '';
    // Strip non-digits
    let cleaned = phone.replace(/\D/g, '');
    
    // Handle India specific logic (AuraGold Primary Market)
    // 10 digits -> Add 91
    if (cleaned.length === 10) return `91${cleaned}`;
    
    // 11 digits starting with 0 -> Replace 0 with 91
    if (cleaned.length === 11 && cleaned.startsWith('0')) return `91${cleaned.substring(1)}`;
    
    // 12 digits starting with 91 -> Valid
    if (cleaned.length === 12 && cleaned.startsWith('91')) return cleaned;

    // For other lengths (e.g. international), just return digits.
    // The previous logic cleaned.length === 12 && startsWith('91') was exclusive.
    // Now we allow others to pass through for international compatibility.
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

  async createMetaTemplate(template: WhatsAppTemplate): Promise<{ success: boolean; finalName?: string; error?: any; rawError?: any }> {
     const settings = this.getSettings();
     const token = settings.whatsappBusinessToken?.trim();
     if (!settings.whatsappBusinessAccountId || !token) return { success: false, error: { message: "Credentials missing" } };

     // STRICT POLICY: All AuraGold templates MUST start with 'auragold_'
     let finalName = template.name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
     if (!finalName.startsWith('auragold_')) {
         finalName = `auragold_${finalName}`;
     }

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
             return { success: false, error: { message: errorMsg }, rawError: data.raw || data };
         }
         return { success: true, finalName: data.data?.name || finalName };
     } catch (e: any) {
         return { success: false, error: { message: e.message || "Network Error" } };
     }
  },

  async editMetaTemplate(templateId: string, template: WhatsAppTemplate): Promise<{ success: boolean; error?: any; rawError?: any }> {
      const settings = this.getSettings();
      const token = settings.whatsappBusinessToken?.trim();
      if (!settings.whatsappBusinessAccountId || !token) return { success: false, error: { message: "Credentials missing" } };

      const components = constructMetaComponents(template.content, template.variableExamples, template.structure);
      const payload = { components };

      if (templateId.startsWith('sys-') || templateId.startsWith('local-')) {
          return { success: false, error: { message: `Cannot edit using local ID (${templateId}). Please sync first.` } };
      }

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
              return { success: false, error: { message: errorMsg }, rawError: data.raw || data };
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
        
        if (headerImageUrl) {
            components.push({
                type: "header",
                parameters: [{
                    type: "image",
                    image: { link: headerImageUrl }
                }]
            });
        }

        if (bodyVariables.length > 0) {
            components.push({ 
                type: "body", 
                parameters: bodyVariables.map(v => ({ 
                    type: "text", 
                    text: sanitizeForMeta(v) 
                })) 
            });
        }

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
            errorService.logError('WhatsApp_Send', `Failed to send ${safeTemplateName}: ${errDetail}`, 'HIGH', undefined, undefined, data);
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
