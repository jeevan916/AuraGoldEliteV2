
/**
 * WhatsApp Business API Service
 * Handles automated messaging to customers for payment reminders and order updates.
 */

import { WhatsAppLogEntry, MessageStatus, GlobalSettings, WhatsAppTemplate } from "../types";
import { REQUIRED_SYSTEM_TEMPLATES } from "../constants";
import { errorService } from "./errorService";

export interface WhatsAppResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  logEntry?: WhatsAppLogEntry;
  rawResponse?: any; // New field for diagnostics
}

const API_VERSION = "v21.0";

export const whatsappService = {
  /**
   * Formats a phone number for the WhatsApp API (removes non-digits, adds 91 if missing)
   */
  formatPhoneNumber(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) return `91${cleaned}`;
    return cleaned;
  },

  getSettings(): GlobalSettings | null {
    try {
        const settingsStr = localStorage.getItem('aura_settings');
        return settingsStr ? JSON.parse(settingsStr) : null;
    } catch (e) {
        console.warn("Failed to load settings from storage", e);
        return null;
    }
  },

  /**
   * Fetches existing templates from Meta Account
   */
  async fetchMetaTemplates(): Promise<any[]> {
    const settings = this.getSettings();
    if (!settings?.whatsappBusinessToken) {
        return [];
    }

    let wabaId = settings.whatsappBusinessAccountId;

    try {
        if (!wabaId && settings.whatsappPhoneNumberId) {
            const wabaReq = await fetch(`https://graph.facebook.com/${API_VERSION}/${settings.whatsappPhoneNumberId}?fields=business_account`, {
                headers: { 'Authorization': `Bearer ${settings.whatsappBusinessToken}` }
            });
            const wabaData = await wabaReq.json();
            wabaId = wabaData?.business_account?.id;
        }

        if (!wabaId) throw new Error("Business Account ID (WABA ID) missing.");

        let allTemplates: any[] = [];
        let nextUrl: string | null = `https://graph.facebook.com/${API_VERSION}/${wabaId}/message_templates?limit=100`;

        while (nextUrl) {
            const tplReq = await fetch(nextUrl, {
                headers: { 'Authorization': `Bearer ${settings.whatsappBusinessToken}` }
            });
            const tplData = await tplReq.json();
            
            if (tplData.error) {
                errorService.logError('WhatsApp API', `Meta Template Fetch Failed: ${tplData.error.message}`, 'MEDIUM');
                throw new Error(tplData.error.message);
            }

            if (tplData.data) {
                allTemplates = [...allTemplates, ...tplData.data];
            }
            
            nextUrl = tplData.paging?.next || null;
        }
        
        return allTemplates.map((t: any) => ({
            ...t,
            source: 'META' 
        }));
    } catch (e: any) {
        errorService.logError('WhatsApp API', `Critical Error fetching Meta templates: ${e.message}`, 'CRITICAL');
        throw e;
    }
  },

  /**
   * Deletes a template from Meta by name
   */
  async deleteMetaTemplate(templateName: string): Promise<boolean> {
      const settings = this.getSettings();
      if (!settings?.whatsappBusinessToken) return false;

      let wabaId = settings.whatsappBusinessAccountId;
      if (!wabaId) return false;

      try {
        const response = await fetch(`https://graph.facebook.com/${API_VERSION}/${wabaId}/message_templates?name=${templateName}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${settings.whatsappBusinessToken}`
            }
        });
        const data = await response.json();
        
        if (data.success) return true;
        
        if (data.error) {
            if (data.error.code === 100) return true; 
            errorService.logError('WhatsApp API', `Template Delete Failed (${templateName}): ${data.error.message}`, 'MEDIUM');
            return false;
        }
        return true;
      } catch (e: any) {
          errorService.logError('WhatsApp API', `Delete Exception: ${e.message}`, 'MEDIUM');
          return false;
      }
  },

  async createMetaTemplate(template: WhatsAppTemplate): Promise<{ success: boolean; error?: any; finalName?: string; rawResponse?: any; usedStrategy?: string; debugPayload?: any }> {
      const settings = this.getSettings();
      if (!settings?.whatsappBusinessToken) return { success: false, error: { message: "No Token" } };

      let wabaId = settings.whatsappBusinessAccountId;

      try {
        if (!wabaId && settings.whatsappPhoneNumberId) {
            const wabaReq = await fetch(`https://graph.facebook.com/${API_VERSION}/${settings.whatsappPhoneNumberId}?fields=business_account`, {
                headers: { 'Authorization': `Bearer ${settings.whatsappBusinessToken}` }
            });
            const wabaData = await wabaReq.json();
            wabaId = wabaData?.business_account?.id;
        }

        if (!wabaId) throw new Error("WABA ID missing.");

        const baseName = template.name.toLowerCase().replace(/[^a-z0-9_]/g, '_').substring(0, 512);
        let bodyText = (template.content || " ").trim();

        if (/^\s*\{\{/.test(bodyText)) bodyText = "Hello " + bodyText.trimStart();
        if (/\{\{[^}]+\}\}[^a-zA-Z0-9]*$/.test(bodyText)) bodyText = bodyText.replace(/[^a-zA-Z0-9]*$/, "") + " for details.";

        let paramCounter = 1;
        bodyText = bodyText.replace(/{{(.*?)}}/g, () => `{{${paramCounter++}}}`);

        const varCount = (bodyText.match(/{{[0-9]+}}/g) || []).length;
        let examples: string[] = template.variableExamples || [];
        
        if (examples.length === 0) {
           const originalName = baseName.replace(/_v\d+$/, '');
           const sysTemplate = REQUIRED_SYSTEM_TEMPLATES.find(t => t.name === originalName || t.name === baseName);
           if (sysTemplate && sysTemplate.examples) examples = sysTemplate.examples;
        }
        
        if (examples.length < varCount) {
            for(let i = examples.length; i < varCount; i++) examples.push(`sample_val_${i+1}`);
        }

        const bodyComponent: any = { type: "BODY", text: bodyText };
        if (varCount > 0 && examples.length > 0) {
            bodyComponent.example = { body_text: [ examples.slice(0, varCount) ] };
        }

        const components: any[] = [bodyComponent];
        
        if (template.structure) {
            template.structure.forEach((c: any) => {
                if (c.type === 'BODY') return;
                const newC = { ...c };
                if (newC.type === 'HEADER' && newC.format === 'TEXT' && newC.text && newC.text.includes('{{1}}')) {
                    const hVarCount = (newC.text.match(/{{[0-9]+}}/g) || []).length;
                    if (hVarCount > 0 && !newC.example) {
                        newC.example = { header_text: [ Array(hVarCount).fill('HeaderVal') ] };
                    }
                }
                components.push(newC);
            });
        }

        let attempt = 0;
        const maxAttempts = 5;
        let currentVersion = 0;
        let useFallbackCategory = false;
        let lastErrorResponse: any = null;
        let lastPayload: any = null;
        const baseCategory = template.category || "UTILITY";

        while(attempt < maxAttempts) {
            attempt++;
            const nameSuffix = currentVersion === 0 ? '' : `_v${currentVersion + 1}`;
            const currentName = `${baseName.replace(/_v\d+$/, '')}${nameSuffix}`;

            let currentCategory = baseCategory;
            if (useFallbackCategory && (baseCategory === 'UTILITY' || baseCategory === 'MARKETING')) {
                currentCategory = baseCategory === 'UTILITY' ? 'MARKETING' : 'UTILITY';
            }

            const payload = {
                name: currentName,
                category: currentCategory, 
                language: "en_US",
                components: components
            };
            lastPayload = payload;

            const response = await fetch(`https://graph.facebook.com/${API_VERSION}/${wabaId}/message_templates`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${settings.whatsappBusinessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const resData = await response.json();
            lastErrorResponse = resData;
            
            if (resData.success || resData.id) return { success: true, finalName: currentName, rawResponse: resData, debugPayload: payload };

            if (resData.error) {
                const msg = resData.error.message?.toLowerCase() || "";
                if (resData.error.code === 2388299) {
                    if (!bodyText.includes("for details")) bodyText = bodyText + " for details.";
                    bodyComponent.text = bodyText; 
                    components[0] = bodyComponent;
                    continue;
                }
                if (msg.includes("name") && (msg.includes("exist") || msg.includes("duplicate"))) {
                     currentVersion++;
                     continue;
                }
                if (!useFallbackCategory) {
                    useFallbackCategory = true;
                    continue;
                }
            }
            break; 
        }

        errorService.logError('WhatsApp API', `Template Creation Exhausted: ${lastErrorResponse?.error?.message}`, 'MEDIUM');
        return { success: false, error: lastErrorResponse?.error, rawResponse: lastErrorResponse, debugPayload: lastPayload };
        
      } catch (e: any) {
          errorService.logError('WhatsApp API', `Create Exception: ${e.message}`, 'CRITICAL');
          return { success: false, error: { message: e.message } };
      }
  },

  async sendTemplateMessage(
      to: string, 
      templateName: string, 
      languageCode: string = 'en_US', 
      variables: string[] = [], 
      customerName: string,
      structure?: any[]
  ): Promise<WhatsAppResponse> {
    const recipient = this.formatPhoneNumber(to);
    const settings = this.getSettings();
    const phoneNumberId = settings?.whatsappPhoneNumberId;
    const token = settings?.whatsappBusinessToken;

    if (!phoneNumberId || !token) return { success: false, error: "Missing Credentials" };

    const sendAttempt = async (name: string): Promise<any> => {
        const body: any = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: recipient,
            type: "template",
            template: {
                name: name,
                language: { code: languageCode || 'en_US' },
                components: []
            }
        };

        let bodyParamCount = variables.length;
        if (bodyParamCount > 0) {
            body.template.components.push({
                type: "body",
                parameters: variables.map(v => ({ type: "text", text: (v === undefined || v === null) ? "" : String(v) }))
            });
        }

        const response = await fetch(`https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        return await response.json();
    };

    try {
        let data = await sendAttempt(templateName);

        if (data.error && (data.error.code === 132001 || data.error.code === 404)) {
            data = await sendAttempt(`${templateName}_v2`);
            if (data.error && data.error.code === 132001) data = await sendAttempt(`${templateName}_v3`);
        }

        if (data.error) {
           errorService.logError('WhatsApp API', `Send Failed (${data.error.code}): ${data.error.message}`, 'CRITICAL');
           return { success: false, error: data.error.message, rawResponse: data };
        }

        const messageId = data.messages?.[0]?.id || `wamid.${Date.now()}`;
        errorService.logActivity('TEMPLATE_SENT', `Template ${templateName} sent to ${customerName}`);
        return { 
            success: true, messageId, rawResponse: data,
            logEntry: {
                id: messageId, customerName, phoneNumber: recipient, message: `[Template: ${templateName}]`,
                status: 'SENT', timestamp: new Date().toISOString(), type: 'TEMPLATE', direction: 'outbound'
            }
        };
    } catch (error: any) {
        errorService.logError('WhatsApp API', `Send Exception: ${error.message}`, 'MEDIUM');
        return { success: false, error: error.message };
    }
  },

  async sendMessage(to: string, message: string, customerName: string, context: string = 'General'): Promise<WhatsAppResponse> {
    const recipient = this.formatPhoneNumber(to);
    const settings = this.getSettings();
    
    if (settings?.whatsappPhoneNumberId && settings?.whatsappBusinessToken) {
      try {
        const response = await fetch(`https://graph.facebook.com/${API_VERSION}/${settings.whatsappPhoneNumberId}/messages`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${settings.whatsappBusinessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: recipient,
            type: "text",
            text: { body: message }
          })
        });
        const data = await response.json();
        if (data.error) {
            errorService.logError('WhatsApp API', `Direct Message Failed: ${data.error.message}`, 'MEDIUM');
            return { success: false, error: data.error.message, rawResponse: data };
        }

        errorService.logActivity('MANUAL_MESSAGE_SENT', `Message sent to ${customerName}`);
        return {
          success: true,
          messageId: data.messages?.[0]?.id,
          rawResponse: data,
          logEntry: {
            id: data.messages?.[0]?.id || `wamid.${Date.now()}`,
            customerName, phoneNumber: recipient, message,
            status: 'SENT', timestamp: new Date().toISOString(), type: 'CUSTOM', direction: 'outbound'
          }
        };
      } catch (e: any) { 
          errorService.logError('WhatsApp API', `Direct Send Exception: ${e.message}`, 'MEDIUM');
          return { success: false, error: e.message }; 
      }
    } 
    return { success: false, error: "Credentials not configured" };
  },

  simulateStatusUpdate(currentStatus: MessageStatus): MessageStatus {
    const r = Math.random();
    if (currentStatus === 'SENT') return r > 0.1 ? 'DELIVERED' : 'FAILED';
    if (currentStatus === 'DELIVERED') return r > 0.2 ? 'READ' : 'DELIVERED';
    return currentStatus;
  },

  async simulateIncomingReply(to: string, customerName: string): Promise<WhatsAppLogEntry> {
      await new Promise(resolve => setTimeout(resolve, 3000));
      return {
          id: `wamid.inbound.${Date.now()}`,
          customerName,
          phoneNumber: this.formatPhoneNumber(to),
          message: "Okay, thanks for the update!",
          status: 'READ',
          timestamp: new Date().toISOString(),
          type: 'INBOUND',
          direction: 'inbound'
      };
  },

  getDeepLink(to: string, message: string): string {
    const recipient = this.formatPhoneNumber(to);
    return `https://wa.me/${recipient}?text=${encodeURIComponent(message)}`;
  }
};
