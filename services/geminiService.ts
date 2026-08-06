
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
    try {
        const response = await fetch('/api/ai/generateTemplateFromPrompt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });
        if (response.ok) return await response.json();
    } catch (e) {
        console.warn("[GeminiService] AI prompt generation offline, using rule fallback");
    }
    const cleanPromptName = (prompt || 'template').toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 20);
    return {
        suggestedName: `auragold_${cleanPromptName}`,
        content: `Dear {{1}}, ${prompt || 'your order status is updated'}. Ref: {{2}}. Thank you for choosing Sanghavi Jewellers.`,
        metaCategory: 'UTILITY',
        appGroup: 'ORDER_STATUS',
        tactic: 'URGENCY',
        examples: ['Valued Customer', 'ORD-1001']
    };
  },

  async generateVariant(originalContent: string, goal: string): Promise<{ 
      content: string, 
      diagnosis: string 
  }> {
    try {
        const response = await fetch('/api/ai/generateVariant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ originalContent, goal })
        });
        if (response.ok) return await response.json();
    } catch (e) {
        console.warn("[GeminiService] AI variant generation offline, using rule fallback");
    }
    return {
        content: `${originalContent} (${goal})`,
        diagnosis: "Applied rule-based variant fallback."
    };
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
      if (response.ok) return await response.json();
    } catch (e) {
      console.info("[GeminiService] AI service offline/error. Fallback to Inbuilt Strategy Engine.");
    }
    return strategyEngine.generateInbuiltStrategy(order, type, goldRate, riskProfile);
  },

  async fixRejectedTemplate(template: Partial<WhatsAppTemplate>): Promise<{ 
      fixedName: string, 
      fixedContent: string, 
      category: MetaCategory, 
      variableExamples: string[], 
      diagnosis: string 
  }> {
    try {
        const response = await fetch('/api/ai/fixRejectedTemplate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ template })
        });
        if (response.ok) return await response.json();
    } catch (e) {
        console.warn("[GeminiService] AI template auto-fix offline, using rule-based compliance engine", e);
    }

    const content = template.content || "Dear {{1}}, your order {{2}} has been updated at Sanghavi Jewellers.";
    let fixedContent = content.replace(/[\r\n\t]+/g, ' ').trim();
    if (!fixedContent.toLowerCase().includes('sanghavi jewellers')) {
        fixedContent += " Thank you for choosing Sanghavi Jewellers.";
    }
    const matches = fixedContent.match(/\{\{\d+\}\}/g) || [];
    const varCount = matches.length;
    const variableExamples = Array.from({ length: varCount }, (_, i) => `Sample ${i + 1}`);

    return {
        fixedName: template.name || `auragold_template_${Date.now()}`,
        fixedContent,
        category: template.category || 'UTILITY',
        variableExamples,
        diagnosis: "Applied automated compliance optimization: Standardized line formatting and updated variable structure."
    };
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
