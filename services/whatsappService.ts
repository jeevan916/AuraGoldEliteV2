
import { WhatsAppLogEntry, GlobalSettings, WhatsAppTemplate, MetaCategory, AppTemplateGroup } from "../types";
import { storageService } from "./storageService";
import { errorService } from "./errorService";
import { REQUIRED_SYSTEM_TEMPLATES } from "../constants";

export interface WhatsAppResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  logEntry?: WhatsAppLogEntry;
}

// Meta API v22.0 Alignment
const API_VERSION = "v22.0";
const API_BASE = process.env.VITE_API_BASE_URL || '';

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
     const settings = this.getSettings();
     const token = settings.whatsappBusinessToken?.trim();
     
     if (!settings.whatsappBusinessAccountId || !token) {
         return [];
     }

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
         if (!data.success) throw new Error(data.error || "Failed to fetch templates");
         return data.data || [];
     } catch (e: any) {
         return [];
     }
  },

  async createMetaTemplate(template: WhatsAppTemplate): Promise<{ success: boolean; finalName?: string; error?: any; debugPayload?: any; rawResponse?: any }> {
     const settings = this.getSettings();
     const token = settings.whatsappBusinessToken?.trim();
     
     if (!settings.whatsappBusinessAccountId || !token) {
         return { success: false, error: { message: "Credentials missing" } };
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
             return { success: false, error: { message: data.error } };
         }

         return { success: true, finalName: data.data.name || finalName };

     } catch (e: any) {
         return { success: false, error: e };
     }
  },

  async editMetaTemplate(templateId: string, template: WhatsAppTemplate): Promise<{ success: boolean; error?: any; debugPayload?: any; rawResponse?: any }> {
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
          return { success: data.success, error: data.error };
      } catch (e: any) {
          return { success: false, error: e };
      }
  },

  async deleteMetaTemplate(templateName: string): Promise<{ success: boolean; error?: string }> {
      const settings = this.getSettings();
      const token = settings.whatsappBusinessToken?.trim();
      
      if (!settings.whatsappBusinessAccountId || !token) {
          return { success: false, error: "Credentials missing" };
      }

      try {
          const response = await fetch(`${API_BASE}/api/whatsapp/templates?name=${templateName}`, {
              method: 'DELETE',
              headers: {
                  'x-waba-id': settings.whatsappBusinessAccountId,
                  'x-auth-token': token
              }
          });

          const data = await response.json();
          return { success: data.success, error: data.error };
      } catch (e: any) {
          return { success: false, error: e.message };
      }
  },

  // Main sending function with Advanced Auto-Heal
  async sendTemplateMessage(to: string, templateName: string, languageCode: string = 'en_US', bodyVariables: string[] = [], customerName: string, buttonVariable?: string, retryCount = 0): Promise<WhatsAppResponse> {
    const recipient = this.formatPhoneNumber(to);
    if (!recipient) return { success: false, error: "Invalid Phone Number" };

    const settings = this.getSettings();
    const token = settings.whatsappBusinessToken?.trim();
    
    if (!settings.whatsappPhoneNumberId || !token) {
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
            components.push({ type: "button", sub_type: "url", index: 0, parameters: [{ type: "text", text: buttonVariable }] });
        }

        const response = await fetch(`${API_BASE}/api/whatsapp/send`, {
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
                components: components,
                customerName // Passed for server-side logging
            })
        });

        const data = await response.json();
        
        if (!data.success) {
            const errorMsg = JSON.stringify(data.error || "").toLowerCase();
            
            // ADVANCED AUTO-HEAL
            if (retryCount < 2) {
                let healAction: 'CREATE' | 'EDIT' | null = null;

                // Case 1: Template Missing
                if (errorMsg.includes("does not exist") || errorMsg.includes("not found")) {
                    healAction = 'CREATE';
                }
                // Case 2: Parameter Mismatch (Implies structure changed)
                else if (errorMsg.includes("parameter") || errorMsg.includes("match") || errorMsg.includes("format")) {
                    healAction = 'EDIT';
                }

                if (healAction) {
                    console.log(`[WhatsApp] Auto-Heal Triggered: ${healAction} for ${templateName}`);
                    
                    const definition = REQUIRED_SYSTEM_TEMPLATES.find(t => t.name === templateName);
                    if (definition) {
                        const payload: WhatsAppTemplate = {
                            id: `auto-${Date.now()}`,
                            name: definition.name,
                            content: definition.content,
                            category: definition.category as MetaCategory,
                            variableExamples: definition.examples,
                            appGroup: definition.appGroup as AppTemplateGroup,
                            tactic: 'AUTHORITY',
                            targetProfile: 'REGULAR',
                            isAiGenerated: false,
                            source: 'LOCAL'
                        };

                        if (healAction === 'CREATE') {
                            const createRes = await this.createMetaTemplate(payload);
                            if (createRes.success) {
                                await new Promise(r => setTimeout(r, 2000));
                                return this.sendTemplateMessage(to, templateName, languageCode, bodyVariables, customerName, buttonVariable, retryCount + 1);
                            }
                            // If creation failed because name exists, force switch to edit
                            if (createRes.error?.message?.toLowerCase().includes("name")) {
                                healAction = 'EDIT';
                            }
                        }

                        if (healAction === 'EDIT') {
                            // To edit, we need the ID. Fetch all templates to find it.
                            const allTemplates = await this.fetchMetaTemplates();
                            const match = allTemplates.find(t => t.name === templateName);
                            if (match) {
                                const editRes = await this.editMetaTemplate(match.id, payload);
                                if (editRes.success) {
                                    await new Promise(r => setTimeout(r, 2000));
                                    return this.sendTemplateMessage(to, templateName, languageCode, bodyVariables, customerName, buttonVariable, retryCount + 1);
                                }
                            }
                        }
                    }
                }
            }
            
            throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
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
    
    if (!settings.whatsappPhoneNumberId || !token) {
        return { success: false, error: "API Credentials Missing" };
    }

    try {
      const response = await fetch(`${API_BASE}/api/whatsapp/send`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'x-phone-id': settings.whatsappPhoneNumberId,
            'x-auth-token': token
        },
        body: JSON.stringify({
            to: recipient,
            message,
            customerName // Passed for server-side logging
        })
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
    } catch (e: any) { 
        return { success: false, error: e.message }; 
    }
  }
};
