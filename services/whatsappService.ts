
/**
 * WhatsApp Business API Service
 * Handles automated messaging to customers for payment reminders and order updates.
 */

import { WhatsAppLogEntry, MessageStatus, GlobalSettings, WhatsAppTemplate } from "../types";
import { REQUIRED_SYSTEM_TEMPLATES, INITIAL_SETTINGS } from "../constants";
import { errorService } from "./errorService";

export interface WhatsAppResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  logEntry?: WhatsAppLogEntry;
  rawResponse?: any; 
}

const API_VERSION = "v21.0";

export const whatsappService = {
  formatPhoneNumber(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) return `91${cleaned}`;
    return cleaned;
  },

  getSettings(): GlobalSettings {
    try {
        const settingsStr = localStorage.getItem('aura_settings');
        if (settingsStr) {
            const saved = JSON.parse(settingsStr);
            return {
                ...INITIAL_SETTINGS,
                ...saved,
                // Critical: Explicitly fallback to Env Vars if LocalStorage has empty strings
                whatsappPhoneNumberId: saved.whatsappPhoneNumberId || INITIAL_SETTINGS.whatsappPhoneNumberId,
                whatsappBusinessAccountId: saved.whatsappBusinessAccountId || INITIAL_SETTINGS.whatsappBusinessAccountId,
                whatsappBusinessToken: saved.whatsappBusinessToken || INITIAL_SETTINGS.whatsappBusinessToken,
            };
        }
        return INITIAL_SETTINGS;
    } catch (e) {
        console.warn("Failed to load settings from storage", e);
        return INITIAL_SETTINGS;
    }
  },

  async validateCredentials(): Promise<{ success: boolean; message: string }> {
      const settings = this.getSettings();
      
      // Detailed diagnostics for missing keys
      if (!settings.whatsappBusinessToken || !settings.whatsappPhoneNumberId) {
          const missing = [];
          if (!settings.whatsappBusinessToken) missing.push("Token");
          if (!settings.whatsappPhoneNumberId) missing.push("Phone ID");
          return { success: false, message: `Missing Config: ${missing.join(', ')}. Please check .env or Settings.` };
      }

      try {
          const response = await fetch(`https://graph.facebook.com/${API_VERSION}/${settings.whatsappPhoneNumberId}`, {
              headers: { 'Authorization': `Bearer ${settings.whatsappBusinessToken}` }
          });
          const data = await response.json();
          
          if (data.error) {
              return { success: false, message: `Meta API Error: ${data.error.message}` };
          }
          
          if (data.id) {
              return { success: true, message: "Credentials Verified Successfully!" };
          }
          
          return { success: false, message: "Invalid response from Meta (No ID returned)." };
      } catch (e: any) {
          return { success: false, message: `Network Error: ${e.message}` };
      }
  },

  async fetchMetaTemplates(): Promise<any[]> {
    const settings = this.getSettings();
    if (!settings?.whatsappBusinessToken) return [];

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
            
            if (tplData.error) throw new Error(tplData.error.message);

            if (tplData.data) {
                allTemplates = [...allTemplates, ...tplData.data];
            }
            
            nextUrl = tplData.paging?.next || null;
        }
        
        return allTemplates.map((t: any) => ({ ...t, source: 'META' }));
    } catch (e: any) {
        errorService.logError('WhatsApp API', `Critical Error fetching Meta templates: ${e.message}`, 'CRITICAL');
        throw e;
    }
  },

  async deleteMetaTemplate(templateName: string): Promise<boolean> {
      const settings = this.getSettings();
      if (!settings?.whatsappBusinessToken) return false;
      let wabaId = settings.whatsappBusinessAccountId;
      if (!wabaId) return false;

      try {
        const response = await fetch(`https://graph.facebook.com/${API_VERSION}/${wabaId}/message_templates?name=${templateName}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${settings.whatsappBusinessToken}` }
        });
        const data = await response.json();
        if (data.success || (data.error && data.error.code === 100)) return true;
        
        errorService.logError('WhatsApp API', `Template Delete Failed: ${data.error?.message}`, 'MEDIUM');
        return false;
      } catch (e: any) {
          return false;
      }
  },

  async createMetaTemplate(template: WhatsAppTemplate): Promise<{ success: boolean; error?: any; finalName?: string; rawResponse?: any; debugPayload?: any }> {
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
                    if (hVarCount > 0 && !newC.example) newC.example = { header_text: [ Array(hVarCount).fill('HeaderVal') ] };
                }
                components.push(newC);
            });
        }

        let attempt = 0;
        let currentVersion = 0;
        let useFallbackCategory = false;
        let lastErrorResponse: any = null;
        let lastPayload: any = null;
        const baseCategory = template.category || "UTILITY";

        while(attempt < 5) {
            attempt++;
            const nameSuffix = currentVersion === 0 ? '' : `_v${currentVersion + 1}`;
            const currentName = `${baseName.replace(/_v\d+$/, '')}${nameSuffix}`;
            let currentCategory = useFallbackCategory ? (baseCategory === 'UTILITY' ? 'MARKETING' : 'UTILITY') : baseCategory;

            const payload = {
                name: currentName,
                category: currentCategory, 
                language: "en_US",
                components: components
            };
            lastPayload = payload;

            const response = await fetch(`https://graph.facebook.com/${API_VERSION}/${wabaId}/message_templates`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${settings.whatsappBusinessToken}`, 'Content-Type': 'application/json' },
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

        return { success: false, error: lastErrorResponse?.error, rawResponse: lastErrorResponse, debugPayload: lastPayload };
      } catch (e: any) {
          return { success: false, error: { message: e.message } };
      }
  },

  async sendTemplateMessage(to: string, templateName: string, languageCode: string = 'en_US', variables: string[] = [], customerName: string, structure?: any[]): Promise<WhatsAppResponse> {
    const recipient = this.formatPhoneNumber(to);
    const settings = this.getSettings();
    if (!settings?.whatsappPhoneNumberId || !settings?.whatsappBusinessToken) return { success: false, error: "Missing Credentials" };

    try {
        const body: any = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: recipient,
            type: "template",
            template: { name: templateName, language: { code: languageCode }, components: [] }
        };

        if (variables.length > 0) {
            body.template.components.push({
                type: "body",
                parameters: variables.map(v => ({ type: "text", text: String(v || "") }))
            });
        }

        const response = await fetch(`https://graph.facebook.com/${API_VERSION}/${settings.whatsappPhoneNumberId}/messages`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${settings.whatsappBusinessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await response.json();

        if (data.error) {
           return { success: false, error: data.error.message, rawResponse: data };
        }

        const messageId = data.messages?.[0]?.id || `wamid.${Date.now()}`;
        return { 
            success: true, messageId, rawResponse: data,
            logEntry: {
                id: messageId, customerName, phoneNumber: recipient, message: `[Template: ${templateName}]`,
                status: 'SENT', timestamp: new Date().toISOString(), type: 'TEMPLATE', direction: 'outbound'
            }
        };
    } catch (error: any) {
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
            return { success: false, error: data.error.message, rawResponse: data };
        }

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
          return { success: false, error: e.message }; 
      }
    } 
    return { success: false, error: "Credentials not configured" };
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
