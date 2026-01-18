
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
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, '');
    
    // Remove leading '0' if it's an 11-digit number (common user entry error)
    if (cleaned.length === 11 && cleaned.startsWith('0')) {
        cleaned = cleaned.substring(1);
    }
    
    // If it's a 10 digit number (Standard India Mobile), add 91
    if (cleaned.length === 10) return `91${cleaned}`;
    
    // If it's already 12 digits and starts with 91, return as is
    if (cleaned.length === 12 && cleaned.startsWith('91')) return cleaned;
    
    // Fallback: return cleaned (might fail if no country code, but ensures we pass something)
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
     errorService.logActivity('API_CALL', 'Fetching Meta Templates...');
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
     errorService.logActivity('API_CALL', `Creating Template: ${template.name}`);
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
      errorService.logActivity('API_CALL', `Editing Template ID: ${templateId}`);
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
      errorService.logActivity('API_CALL', `Deleting Template: ${templateName}`);
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

    // LOG REQUEST START
    errorService.logActivity('TEMPLATE_SENT', `Sending '${templateName}' to ${customerName} (${recipient})...`);

    const settings = this.getSettings();
    const token = settings.whatsappBusinessToken?.trim();
    
    if (!settings.whatsappPhoneNumberId || !token) {
        errorService.logError("WhatsApp API", "Credentials Missing - Cannot Send", "HIGH");
        return { success: false, error: "API Credentials Missing" };
    }

    try {
        const components: any[] = [];

        // Add Body Variables
        if (bodyVariables.length > 0) {
            components.push({
                type: "body",
                parameters: bodyVariables.map(v => ({ type: "text", text: v }))
            });
        }

        // Add Button Variable (Dynamic URL Suffix)
        if (buttonVariable) {
            components.push({
                type: "button",
                sub_type: "url",
                index: 0, // First button in the structure
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
                // We construct the full template object manually instead of just passing variables list
                // This requires a slightly different payload structure on the server proxy or we handle it here.
                // The server proxy /api/whatsapp/send handles `variables` for simple body, but for complex components we need to pass `components` directly.
                // NOTE: We need to update the server proxy to accept `components` override or we assume the proxy handles this structure.
                // Based on previous server.js, it expects `variables`. Let's assume we update server.js or the proxy is smart enough.
                // Actually, looking at server.js: it constructs payload.template.components based on `variables`.
                // We need to bypass that logic or update server.js.
                // BUT wait, since we can't edit server.js in this step easily without risk, let's rely on the fact that we can pass `components` in the body if we modify the server call slightly?
                // NO, server.js explicitly constructs payload.
                
                // Let's assume the server.js is updated to check for `components` in req.body and use that if present.
                // IF NOT, we are stuck.
                // WAIT! I already edited server.js in the previous turn? No, I edited it to add Setu.
                // The current server.js implementation:
                // if (variables) payload.template.components = [{ type: "body", parameters: variables... }]
                
                // I will strictly pass `variables` as the `components` array itself if I can, but the server map function will break it.
                // I MUST update server.js logic conceptually, but I can't in this response block easily.
                // WORKAROUND: I will update the `variables` argument to be the full components array and assume the server uses it? No.
                
                // Let's look at the server code provided in previous turn:
                // if (variables) payload.template.components = [{ type: "body", parameters: variables.map(...) }];
                
                // CRITICAL FIX: The server.js logic prevents custom components. 
                // However, I can't change server.js in this exact step effectively if I assume the user didn't apply manual fixes.
                // I will try to pass the components array as `variables` but the map function `variables.map(v => ({ type: "text", text: v }))` will create garbage if I pass objects.
                
                // RE-READING: The user provided `server.js` content in the prompt.
                // I CAN update server.js here because I am updating the app.
                // I will include a server.js update to support raw `components` payload.
                
                components: components // Passing this new field which I will add support for in server.js
            })
        });

        const data = await response.json();
        
        // Strict Success Check
        if (!data.success || !data.data || !data.data.messages || data.data.messages.length === 0) {
            throw new Error(data.data?.error?.message || JSON.stringify(data.error) || "Message not queued by Meta (Check Sandbox/Window)");
        }

        // LOG SUCCESS
        errorService.logActivity('API_SUCCESS', `Template delivered. ID: ${data.data?.messages?.[0]?.id}`);

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
        // LOG FAILURE
        errorService.logError("WhatsApp API", `Send Failed: ${error.message}`, "MEDIUM");
        return { success: false, error: error.message };
    }
  },

  async sendMessage(to: string, message: string, customerName: string): Promise<WhatsAppResponse> {
    const recipient = this.formatPhoneNumber(to);
    
    if (!recipient) {
        errorService.logError("WhatsApp API", "Invalid Phone Number - Cannot Send", "MEDIUM");
        return { success: false, error: "Invalid Phone Number" };
    }

    // LOG REQUEST START
    errorService.logActivity('MANUAL_MESSAGE_SENT', `Sending message to ${customerName}...`);

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
      
      // Strict Success Check
      if (!data.success || !data.data || !data.data.messages || data.data.messages.length === 0) {
          throw new Error(data.data?.error?.message || JSON.stringify(data.error) || "Message not queued by Meta");
      }

      // LOG SUCCESS
      errorService.logActivity('API_SUCCESS', `Message sent. ID: ${data.data?.messages?.[0]?.id}`);

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
        // LOG FAILURE
        errorService.logError("WhatsApp API", `Send Failed: ${e.message}`, "MEDIUM");
        return { success: false, error: e.message }; 
    }
  }
};
