
import { WhatsAppLogEntry, GlobalSettings, WhatsAppTemplate } from "../types";
import { storageService } from "./storageService";
import { errorService } from "./errorService";

export interface WhatsAppResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  logEntry?: WhatsAppLogEntry;
}

const API_VERSION = "v22.0";

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
     if (!settings.whatsappBusinessAccountId || !settings.whatsappBusinessToken) return [];
     try {
         const response = await fetch('/api/whatsapp/templates', {
             method: 'GET',
             headers: {
                 'Content-Type': 'application/json',
                 'x-waba-id': settings.whatsappBusinessAccountId,
                 'x-auth-token': settings.whatsappBusinessToken
             }
         });
         const data = await response.json();
         return data.success ? data.data : [];
     } catch (e) { return []; }
  },

  async createMetaTemplate(template: WhatsAppTemplate): Promise<{ success: boolean; finalName?: string; error?: any }> {
     const settings = this.getSettings();
     if (!settings.whatsappBusinessAccountId || !settings.whatsappBusinessToken) return { success: false, error: { message: "Credentials missing" } };

     const components = template.structure || [{ type: "BODY", text: template.content }];
     
     // Inject examples if missing for approval
     const bodyComp = components.find(c => c.type === 'BODY');
     if (bodyComp && template.variableExamples && !bodyComp.example) {
         bodyComp.example = { body_text: [template.variableExamples] };
     }

     const payload = {
         name: template.name.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
         category: template.category || "UTILITY",
         language: "en_US",
         components: components
     };

     try {
         const response = await fetch('/api/whatsapp/templates', {
             method: 'POST',
             headers: {
                 'Content-Type': 'application/json',
                 'x-waba-id': settings.whatsappBusinessAccountId,
                 'x-auth-token': settings.whatsappBusinessToken
             },
             body: JSON.stringify(payload)
         });
         const data = await response.json();
         return { success: data.success, finalName: data.data?.name, error: data.error ? { message: data.error } : null };
     } catch (e: any) { return { success: false, error: e }; }
  },

  // --- ADDED MISSING EDIT METHOD ---
  async editMetaTemplate(id: string, template: WhatsAppTemplate): Promise<{ success: boolean; error?: any }> {
    const settings = this.getSettings();
    if (!settings.whatsappBusinessAccountId || !settings.whatsappBusinessToken) return { success: false, error: { message: "Credentials missing" } };

    const payload = {
        category: template.category || "UTILITY",
        components: template.structure || [{ type: "BODY", text: template.content, example: template.variableExamples ? { body_text: [template.variableExamples] } : undefined }]
    };

    try {
        const response = await fetch(`/api/whatsapp/templates/${template.name}`, {
            method: 'POST', 
            headers: {
                'Content-Type': 'application/json',
                'x-waba-id': settings.whatsappBusinessAccountId,
                'x-auth-token': settings.whatsappBusinessToken
            },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        return { success: data.success, error: data.error ? { message: data.error } : null };
    } catch (e: any) { return { success: false, error: e }; }
  },

  // --- ADDED MISSING DELETE METHOD ---
  async deleteMetaTemplate(name: string): Promise<{ success: boolean; error?: any }> {
    const settings = this.getSettings();
    if (!settings.whatsappBusinessAccountId || !settings.whatsappBusinessToken) return { success: false, error: "Credentials missing" };
    try {
        const response = await fetch(`/api/whatsapp/templates/${name}`, {
            method: 'DELETE',
            headers: {
                'x-waba-id': settings.whatsappBusinessAccountId,
                'x-auth-token': settings.whatsappBusinessToken
            }
        });
        const data = await response.json();
        return { success: data.success, error: data.error };
    } catch (e: any) { return { success: false, error: e.message }; }
  },

  async sendTemplateMessage(
    to: string, 
    templateName: string, 
    languageCode: string = 'en_US', 
    bodyVariables: string[] = [], 
    customerName: string, 
    buttonVariable?: string
  ): Promise<WhatsAppResponse> {
    const recipient = this.formatPhoneNumber(to);
    const settings = this.getSettings();
    if (!settings.whatsappPhoneNumberId || !settings.whatsappBusinessToken) return { success: false, error: "API Credentials Missing" };

    try {
        const components: any[] = [];
        
        // 1. Map Body Parameters
        if (bodyVariables.length > 0) {
            components.push({
                type: "body",
                parameters: bodyVariables.map(v => ({ type: "text", text: v }))
            });
        }

        // 2. Map Button Parameters (Meta strictly requires index: 0 for single URL button)
        if (buttonVariable) {
            components.push({ 
                type: "button", 
                sub_type: "url", 
                index: 0, 
                parameters: [{ type: "text", text: buttonVariable }] 
            });
        }

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
                components: components,
                customerName
            })
        });

        const data = await response.json();
        if (!data.success) throw new Error(data.error || "Send Failed");

        return {
          success: true,
          messageId: data.data?.messages?.[0]?.id,
          logEntry: {
            id: data.data?.messages?.[0]?.id || `wamid.${Date.now()}`,
            customerName, phoneNumber: recipient, message: `[Interactive Template: ${templateName}]`,
            status: 'SENT', timestamp: new Date().toISOString(), type: 'TEMPLATE', direction: 'outbound'
          }
        };
    } catch (error: any) {
        errorService.logError("WhatsApp_Template_Service", error.message, "HIGH");
        return { success: false, error: error.message };
    }
  },

  async sendMessage(to: string, message: string, customerName: string): Promise<WhatsAppResponse> {
    const recipient = this.formatPhoneNumber(to);
    const settings = this.getSettings();
    if (!settings.whatsappPhoneNumberId || !settings.whatsappBusinessToken) return { success: false, error: "API Credentials Missing" };

    try {
      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'x-phone-id': settings.whatsappPhoneNumberId,
            'x-auth-token': settings.whatsappBusinessToken
        },
        body: JSON.stringify({ to: recipient, message, customerName })
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || "Send Failed");
      return {
        success: true,
        messageId: data.data?.messages?.[0]?.id,
        logEntry: {
          id: data.data?.messages?.[0]?.id || `wamid.${Date.now()}`,
          customerName, phoneNumber: recipient, message,
          status: 'SENT', timestamp: new Date().toISOString(), type: 'CUSTOM', direction: 'outbound'
        }
      };
    } catch (e: any) { return { success: false, error: e.message }; }
  }
};
