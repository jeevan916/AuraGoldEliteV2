
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

  /**
   * Sanitizes variable parameters for the Meta Graph API.
   * 1. Strips invisible characters (like non-breaking spaces) that cause #100 errors.
   * 2. Truncates to 1024 characters (Meta's hard limit for variables).
   */
  sanitizeParam(val: string | number | undefined | null): string {
      if (val === undefined || val === null) return " ";
      const str = val.toString();
      // Remove common invisible characters/whitespace that break the Meta API JSON parser
      const cleaned = str.replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, " ").trim();
      // Enforce 1024 character limit
      return cleaned.slice(0, 1020);
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
        
        // Use sanitized variables to prevent #100 errors
        const sanitizedVars = bodyVariables.map(v => ({ 
            type: "text", 
            text: this.sanitizeParam(v) 
        }));

        if (sanitizedVars.length > 0) {
            components.push({ type: "body", parameters: sanitizedVars });
        }
        
        if (buttonVariable) {
            components.push({ 
                type: "button", 
                sub_type: "url", 
                index: 0, 
                parameters: [{ type: "text", text: this.sanitizeParam(buttonVariable) }] 
            });
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
            // Log raw payload to allow Gemini Self-Healing logic to analyze the specific parameter rejection
            errorService.logError('WhatsApp_Send', `Meta API Failure (#100/Invalid) for ${templateName}`, 'HIGH', undefined, undefined, data);
            
            // Check for structural mismatch or parameter errors
            const errorMsg = JSON.stringify(data.raw || data.error || "").toLowerCase();
            const isStructuralError = errorMsg.includes("100") || errorMsg.includes("parameter") || errorMsg.includes("not found");

            if (isStructuralError && retryCount < 1) {
                console.warn(`[WhatsApp] Meta #100 detected for ${templateName}. Variable count: ${bodyVariables.length}. Attempting AI-Audit.`);
                // Trigger diagnostic run which can lead to Auto-Heal (REPAIR_TEMPLATE)
                errorService.runIntelligentAnalysis(`meta-failure-${Date.now()}`);
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

    const settings =