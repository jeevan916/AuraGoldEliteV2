
import { 
  Order, CollectionTone, Customer, WhatsAppLogEntry, 
  AiChatInsight, WhatsAppTemplate, AppResolutionPath, 
  MetaCategory, AppTemplateGroup, PsychologicalTactic, 
  PaymentPlanTemplate, RiskProfile 
} from "../types";
import { strategyEngine } from "./strategyEngine";

export const geminiService = {
  async diagnoseError(message: string, source: string, stack?: string, rawContext?: any): Promise<{ 
      explanation: string, 
      fixType: 'AUTO' | 'MANUAL_CODE' | 'CONFIG', 
      implementationPrompt?: string, 
      fixingPrompt?: string,
      action?: 'REPAIR_TEMPLATE' | 'RETRY_API', 
      resolutionPath?: AppResolutionPath
  }> {
    try {
        const response = await fetch('/api/ai/diagnoseError', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, source, stack, rawContext })
        });
        return await response.json();
    } catch (e) { return { explanation: "Diagnostic engine timeout.", fixType: 'MANUAL_CODE', resolutionPath: 'none' }; }
  },

  async analyzeChatContext(messages: WhatsAppLogEntry[], templates: WhatsAppTemplate[], customerName: string): Promise<AiChatInsight> {
    try {
        const response = await fetch('/api/ai/analyzeChatContext', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages, templates, customerName })
        });
        return await response.json();
    } catch (e) { return { intent: "unknown", tone: "neutral", suggestedReply: "I'm checking your order details now." }; }
  },

  async generateTemplateFromPrompt(prompt: string): Promise<{ 
      suggestedName: string, 
      content: string, 
      metaCategory: MetaCategory, 
      appGroup: AppTemplateGroup, 
      tactic: PsychologicalTactic, 
      examples: string[] 
  }> {
    const response = await fetch('/api/ai/generateTemplateFromPrompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
    });
    if (!response.ok) throw new Error("AI Offline");
    return await response.json();
  },

  async generateVariant(originalContent: string, goal: string): Promise<{ 
      content: string, 
      diagnosis: string 
  }> {
    const response = await fetch('/api/ai/generateVariant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalContent, goal })
    });
    if (!response.ok) throw new Error("AI Offline");
    return await response.json();
  },

  async generateStrategicNotification(order: Order, type: 'UPCOMING' | 'OVERDUE' | 'SYSTEM', goldRate: number, riskProfile: RiskProfile = 'REGULAR'): Promise<{ 
      tone: CollectionTone, 
      reasoning: string, 
      templateId: string, 
      variables: string[], 
      message: string 
  }> {
    try {
      const response = await fetch('/api/ai/generateStrategicNotification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order, type, goldRate, riskProfile })
      });
      if (!response.ok) throw new Error("AI Endpoint Unavailable");
      return await response.json();
    } catch (e) {
      console.info("[GeminiService] AI service offline/error. Fallback to Inbuilt Strategy Engine.");
      return strategyEngine.generateInbuiltStrategy(order, type, goldRate, riskProfile);
    }
  },

  async fixRejectedTemplate(template: Partial<WhatsAppTemplate>): Promise<{ 
      fixedName: string, 
      fixedContent: string, 
      category: MetaCategory, 
      variableExamples: string[], 
      diagnosis: string 
  }> {
    const response = await fetch('/api/ai/fixRejectedTemplate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template })
    });
    if (!response.ok) throw new Error("AI Offline");
    return await response.json();
  },

  async generatePaymentPlan(prompt: string): Promise<Partial<PaymentPlanTemplate>> {
    try {
        const response = await fetch('/api/ai/generatePaymentPlan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });
        return await response.json();
    } catch (e) { return { name: "Manual Plan", months: 6 }; }
  },

  async validateAndFixTemplate(requiredContent: string, requiredName: string, category: string): Promise<{ isCompliant: boolean, optimizedContent: string, explanation: string }> {
    try {
        const response = await fetch('/api/ai/validateAndFixTemplate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requiredContent, requiredName, category })
        });
        return await response.json();
    } catch (e) {
        return { isCompliant: true, optimizedContent: requiredContent, explanation: "Fallback compliance check." };
    }
  }
};
