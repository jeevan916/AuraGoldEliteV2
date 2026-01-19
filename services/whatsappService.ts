
import { WhatsAppLogEntry, GlobalSettings, WhatsAppTemplate } from "../types";
import { storageService } from "./storageService";
import { errorService } from "./errorService";

export interface WhatsAppResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  logEntry?: WhatsAppLogEntry;
}

// Meta API v22.0 Alignment
const API_VERSION = "v22.0";

export const whatsappService = {
  formatPhoneNumber(phone: string): string {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.length === 11 && cleaned.startsWith('0')) {
        cleaned = cleaned.substring(1);
    }
    
    if (cleaned.length === 10) return `91${cleaned}`;
    if (cleaned.length === 12 && cleaned.startsWith('91')) return cleaned;
    
    return cleaned;
  },

  getSettings(): GlobalSettings {
    return storageService.getSettings();
  },

  async validateCredentials(): Promise<{ success: boolean; message: string }> {
      const settings = this.getSettings();
      if (!settings.whatsappPhoneNumberId || !settings.whatsappBusinessToken) {
          return { success: false, message: "Missing Credentials" };
      }
      return { success: true, message: "Credentials Configured (Proxy Mode)" };
  },

  async fetchMetaTemplates(): Promise<any[]> {
     errorService.logActivity('API_CALL', `Fetching Meta Templates (${API_VERSION})...`);
     const settings = this.getSettings();
     const token = settings.whatsappBusinessToken?.trim();
     
     if (!settings.whatsappBusinessAccountId || !token) {
         errorService.logWarning("WhatsApp API", "Credentials missing for template fetch.");
         return [];
     }

     try {
         const response = await fetch('/api/whatsapp/templates', {
             method: 'GET',
             headers: {
                 'Content-Type': 'application/json',
                 'x-waba-id': settings.whatsappBusinessAccountId,
                 'x-auth-token': token
             }
         });

         const data = await response.json();
         if (!data.success) throw new Error(data.error || "Failed to fetch templates via proxy");
         
         errorService.logActivity('API_SUCCESS', `Fetched ${data.data?.length || 0} templates from Meta.`);
         return data.data || [];
     } catch (e: any) {
         errorService.logError("WhatsApp API", `Template Fetch Failed: ${e.message}`, "MEDIUM");
         return [];
     }
  },

  async createMetaTemplate(template: WhatsAppTemplate): Promise<{ success: boolean; finalName?: string; error?: any; debugPayload?: any; rawResponse?: any }> {
     errorService.logActivity('API_CALL', `Creating Template (${API_VERSION}): ${template.name}`);
     const settings = this.getSettings();
     const token = settings.whatsappBusinessToken?.trim();
     
     if (!settings.whatsappBusinessAccountId || !token) {
         return { success: false, error: { message: "Credentials missing in Settings" } };
     }

     const finalName = template.name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
     const components = [];
     
     if (template.structure && template.structure.length > 0) {
         components.push(...template.structure);
     } else if (template.content) {
         const bodyComponent: any = {
             type: "BODY",
             text: template.content
         };
         if (template.variableExamples && template.variableExamples.length > 0) {
             bodyComponent.example = { body_text: [template.variableExamples] };
         }
         components.push(bodyComponent);
     }
     
     const payload = {
         name: finalName,
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
                 'x-auth-token': token
             },
             body: JSON.stringify(payload)
         });

         const data = await response.json();
         
         if (!data.success) {
             errorService.logError('WhatsApp API', `Template Creation Failed: ${JSON.stringify(data.error)}`);
             return { 
                 success: false, 
                 error: { message: data.error }, 
                 debugPayload: payload,
                 rawResponse: data 
             };
         }

         errorService.logActivity('API_SUCCESS', `Template Created: ${finalName}`);
         return {
             success: true,
             finalName: data.data.name || finalName,
             rawResponse: data
         };

     } catch (e: any) {
         errorService.logError('WhatsApp API', `Network Error: ${e.message}`);
         return { success: false, error: e, debugPayload: payload };
     }
  },

  async editMetaTemplate(templateId: string, template: WhatsAppTemplate): Promise<{ success: boolean; error?: any; debugPayload?: any; rawResponse?: any }> {
      errorService.logActivity('API_CALL', `Editing Template ID: ${templateId} (${API_VERSION})`);
      const settings = this.getSettings();
      const token = settings.whatsappBusinessToken?.trim();
      
      if (!settings.whatsappBusinessAccountId || !token) {
          return { success: false, error: { message: "Credentials missing" } };
      }

      const components = [];
      if (template.structure && template.structure.length > 0) {
          components.push(...template.structure);
      } else if (template.content) {
          const bodyComponent: any = { type: "BODY", text: template.content };
          if (template.variableExamples && template.variableExamples.length > 0) {
              bodyComponent.example = { body_text: [template.variableExamples] };
          }
          components.push(bodyComponent);
      }

      const payload = { components: components };

      try {
          const response = await fetch(`/api/whatsapp/templates/${templateId}`, {
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
              errorService.logError('WhatsApp API', `Edit Failed: ${JSON.stringify(data.error)}`);
              return { success: false, error: { message: data.error || "Edit Failed" }, debugPayload: payload, rawResponse: data };
          }

          errorService.logActivity('API_SUCCESS', `Template Edited Successfully`);
          return { success: true, rawResponse: data };

      } catch (e: any) {
          errorService.logError('WhatsApp API', `Edit Network Error: ${e.message}`);
          return { success: false, error: e, debugPayload: payload };
      }
  },

  async deleteMetaTemplate(templateName: string): Promise<{ success: boolean; error?: string }> {
      errorService.logActivity('API_CALL', `Deleting Template: ${templateName} (${API_VERSION})`);
      const settings = this.getSettings();
      const token = settings.whatsappBusinessToken?.trim();
      
      if (!settings.whatsappBusinessAccountId || !token) {
          return { success: false, error: "Credentials missing in Settings" };
      }

      try {
          const response = await fetch(`/api/whatsapp/templates?name=${templateName}`, {
              method: 'DELETE',
              headers: {
                  'x-waba-id': settings.whatsappBusinessAccountId,
                  'x-auth-token': token
              }
          });

          const data = await response.json();
          if (!data.success) throw new Error(data.error || "Deletion Failed");
          
          errorService.logActivity('API_SUCCESS', `Template Deleted`);
          return { success: true };
      } catch (e: any) {
          errorService.logError('WhatsApp API', `Delete Error: ${e.message}`);
          return { success: false, error: e.message };
      }
  },

  async sendTemplateMessage(to: string, templateName: string, languageCode: string = 'en_US', bodyVariables: string[] = [], customerName: string, buttonVariable?: string): Promise<WhatsAppResponse> {
    const recipient = this.formatPhoneNumber(to);
    
    if (!recipient) {
        errorService.logError("WhatsApp API", "Invalid Phone Number - Cannot Send", "MEDIUM");
        return { success: false, error: "Invalid Phone Number" };
    }

    errorService.logActivity('TEMPLATE_SENT', `Sending '${templateName}' to ${customerName} (${recipient}) using v22.0...`);

    const settings = this.getSettings();
    const token = settings.whatsappBusinessToken?.trim();
    
    if (!settings.whatsappPhoneNumberId || !token) {
        errorService.logError("WhatsApp API", "Credentials Missing - Cannot Send", "HIGH");
        return { success: false, error: "API Credentials Missing" };
    }

    try {
        const components: any[] = [];

        if (bodyVariables.length > 0) {
            components.push({
                type: "body",
                parameters: bodyVariables.map(v => ({ type: "text", text: v }))
            });
        }

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
                'x-auth-token': token
            },
            body: JSON.stringify({
                to: recipient,
                templateName,
                language: languageCode,
                components: components
            })
        });

        const data = await response.json();
        
        if (!data.success || !data.data || !data.data.messages || data.data.messages.length === 0) {
            throw new Error(data.data?.error?.message || JSON.stringify(data.error) || "Message not queued by Meta (v22.0)");
        }

        errorService.logActivity('API_SUCCESS', `Template delivered (v22.0). ID: ${data.data?.messages?.[0]?.id}`);

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
        errorService.logError("WhatsApp API", `Send Failed (v22.0): ${error.message}`, "MEDIUM");
        return { success: false, error: error.message };
    }
  },

  async sendMessage(to: string, message: string, customerName: string): Promise<WhatsAppResponse> {
    const recipient = this.formatPhoneNumber(to);
    
    if (!recipient) {
        errorService.logError("WhatsApp API", "Invalid Phone Number - Cannot Send", "MEDIUM");
        return { success: false, error: "Invalid Phone Number" };
    }

    errorService.logActivity('MANUAL_MESSAGE_SENT', `Sending message to ${customerName} (v22.0)...`);

    const settings = this.getSettings();
    const token = settings.whatsappBusinessToken?.trim();
    
    if (!settings.whatsappPhoneNumberId || !token) {
        errorService.logError("WhatsApp API", "Credentials Missing - Cannot Send", "HIGH");
        return { success: false, error: "API Credentials Missing" };
    }

    try {
      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'x-phone-id': settings.whatsappPhoneNumberId,
            'x-auth-token': token
        },
        body: JSON.stringify({
            to: recipient,
            message
        })
      });

      const data = await response.json();
      
      if (!data.success || !data.data || !data.data.messages || data.data.messages.length === 0) {
          throw new Error(data.data?.error?.message || JSON.stringify(data.error) || "Message not queued by Meta (v22.0)");
      }

      errorService.logActivity('API_SUCCESS', `Message sent (v22.0). ID: ${data.data?.messages?.[0]?.id}`);

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
        errorService.logError("WhatsApp API", `Send Failed (v22.0): ${e.message}`, "MEDIUM");
        return { success: false, error: e.message }; 
    }
  }
};
