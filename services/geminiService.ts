
import { GoogleGenAI } from "@google/genai";
import { Order, CollectionTone, Customer, WhatsAppLogEntry, CreditworthinessReport, AiChatInsight, WhatsAppTemplate, AppResolutionPath, ActivityLogEntry, MetaCategory, AppTemplateGroup, PsychologicalTactic, PaymentPlanTemplate } from "../types";

// Safe access to API_KEY from environment
const getAI = () => {
    const key = process.env.API_KEY;
    if (!key || key.includes('API_KEY')) {
        // Return a dummy object if key is missing to prevent crash on init
        console.warn("Gemini API Key missing or invalid.");
        return null;
    }
    return new GoogleGenAI({ apiKey: key });
};

export const geminiService = {
  async analyzeCollectionRisk(overdueOrders: Order[]): Promise<string> {
    const ai = getAI();
    if (!ai || overdueOrders.length === 0) return "No collection risks identified.";

    const riskSummary = overdueOrders.map(o => {
      const paid = o.payments.reduce((acc, p) => acc + p.amount, 0);
      return `${o.customerName}: ₹${(o.totalAmount - paid).toLocaleString()} outstanding.`;
    }).join('\n');

    try {
        const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analyze these overdue jewelry accounts: \n${riskSummary}\nProvide a 3-point executive recovery strategy for a high-end jewelry store.`,
        config: {
            
        }
        });
        return response.text || "Unable to analyze risk.";
    } catch (e) {
        return "AI Service Unavailable";
    }
  },

  async generateStrategicNotification(
    order: Order, 
    type: 'UPCOMING' | 'OVERDUE',
    currentGoldRate: number
  ): Promise<{ message: string, tone: CollectionTone, reasoning: string }> {
    const ai = getAI();
    if (!ai) return { message: "Payment Reminder", tone: "POLITE", reasoning: "AI Offline" };
    
    const paid = order.payments.reduce((acc, p) => acc + p.amount, 0);
    const balance = order.totalAmount - paid;

    try {
        const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Create a WhatsApp reminder for ${order.customerName}. Balance: ₹${balance}. Status: ${type}. Current Gold Rate: ₹${currentGoldRate}.`,
        config: { 
            responseMimeType: "application/json",
            systemInstruction: "You are an elite jewelry store manager. Use high-end, persuasive language. Return JSON with keys: message, tone (POLITE, FIRM, URGENT, ENCOURAGING), reasoning."
        }
        });
        return JSON.parse(response.text || "{}");
    } catch(e) {
        return { message: "Reminder: Payment Due", tone: "POLITE", reasoning: "Fallback" };
    }
  },

  async generateDeepCustomerAnalysis(customer: Customer, orders: Order[], logs: WhatsAppLogEntry[]): Promise<CreditworthinessReport> {
    const ai = getAI();
    if (!ai) return {} as any;

    try {
        const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analyze this customer for a luxury jewelry boutique: 
        Profile: ${JSON.stringify(customer)}
        Purchase History: ${JSON.stringify(orders)}
        Communication History: ${JSON.stringify(logs)}`,
        config: {
            responseMimeType: "application/json",
            systemInstruction: "Perform a behavioral and financial analysis. Return JSON with keys: riskLevel (LOW, MODERATE, HIGH, CRITICAL), persona (a luxury-centric title), nextBestAction, communicationStrategy, negotiationLeverage."
        }
        });
        return JSON.parse(response.text || "{}");
    } catch(e) { return {} as any; }
  },

  async analyzeChatContext(messages: WhatsAppLogEntry[], templates: WhatsAppTemplate[], customerName: string): Promise<AiChatInsight> {
    const ai = getAI();
    if (!ai) return {} as any;

    try {
        const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analyze the current chat with ${customerName}. 
        Recent Messages: ${JSON.stringify(messages.slice(-5))}
        Available Templates: ${JSON.stringify(templates.map(t => ({id: t.id, name: t.name, content: t.content})))}`,
        config: {
            responseMimeType: "application/json",
            systemInstruction: "Determine customer intent. Suggest a high-quality reply and recommend a template if appropriate. Return JSON with keys: intent, tone, suggestedReply, recommendedTemplateId."
        }
        });
        return JSON.parse(response.text || "{}");
    } catch(e) { return {} as any; }
  },

  async generateTemplateFromPrompt(prompt: string): Promise<{ suggestedName: string, content: string, metaCategory: MetaCategory, appGroup: AppTemplateGroup, tactic: PsychologicalTactic, examples: string[] }> {
    const ai = getAI();
    if (!ai) throw new Error("AI Key Missing");

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate a Meta-compliant WhatsApp template based on: ${prompt}`,
      config: {
        responseMimeType: "application/json",
        systemInstruction: "Design a template for a jewelry store. Suggested name must be snake_case. Return JSON with keys: suggestedName, content (use {{1}}, {{2}} for variables), metaCategory (UTILITY, MARKETING), appGroup (PAYMENT_COLLECTION, ORDER_STATUS, etc.), tactic, examples (array of matching strings for placeholders)."
      }
    });
    return JSON.parse(response.text || "{}");
  },

  async fixRejectedTemplate(template: WhatsAppTemplate): Promise<{ diagnosis: string, fixedContent: string, category: MetaCategory, fixedName: string, variableExamples: string[] }> {
    const ai = getAI();
    if (!ai) throw new Error("AI Key Missing");

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `This WhatsApp template was REJECTED by Meta.
      
      Name: ${template.name}
      Content: "${template.content}"
      Category: ${template.category}
      META REJECTION REASON: "${template.rejectionReason || 'Generic Policy Violation'}"
      
      Act as a Meta Policy Expert. Analyze the rejection reason and the content. 
      
      CRITICAL COMPLIANCE RULES:
      1. Naming: DO NOT CHANGE THE NAME. DO NOT ADD SUFFIXES LIKE '_v2'. We will use the Edit API to fix it in-place to avoid spam filters.
      2. Utility Tone: The 'UTILITY' category requires a strictly transactional tone. DO NOT use generic greetings like 'Hello {{1}}'. DO NOT use promotional phrases or 'ensure your order is processed'.
      3. Variables: Provide valid 'variableExamples'.
      
      Rewrite the template content to be STRICTLY compliant.
      `,
      config: {
        responseMimeType: "application/json",
        systemInstruction: "Return JSON with keys: diagnosis (explain specifically why it was rejected based on the log), fixedContent (the rewritten compliant text), category (the correct category), fixedName (MUST BE IDENTICAL to original name), variableExamples (array of strings matching {{1}}, {{2}} variables - MANDATORY)."
      }
    });
    return JSON.parse(response.text || "{}");
  },

  async generatePaymentPlan(prompt: string): Promise<Partial<PaymentPlanTemplate>> {
    const ai = getAI();
    if (!ai) throw new Error("AI Key Missing");

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Create a jewelry gold purchase plan based on this strategy: "${prompt}"`,
        config: {
            responseMimeType: "application/json",
            systemInstruction: "Return JSON with keys: name (short marketing name), months (number), interestPercentage (number 0-20), advancePercentage (number 0-100). optimize for cash flow."
        }
    });
    return JSON.parse(response.text || "{}");
  },

  async diagnoseError(message: string, source: string): Promise<{ explanation: string, path: AppResolutionPath, cta: string, action?: 'REPAIR_TEMPLATE' | 'RETRY_API', suggestedFixData?: any }> {
    const ai = getAI();
    if (!ai) return { explanation: "AI Unavailable", path: 'none', cta: 'Check Logs' };

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Error: ${message}. Source: ${source}. Diagnose and provide resolution steps.`,
      config: {
        responseMimeType: "application/json",
        systemInstruction: "Analyze technical errors in the AuraGold jewelry app. Provide a fix path. Return JSON with keys: explanation, path (settings, templates, whatsapp, none), cta (call to action text), action, suggestedFixData."
      }
    });
    return JSON.parse(response.text || "{}");
  },

  async analyzeSystemLogsForImprovements(activities: ActivityLogEntry[]): Promise<any> {
    const ai = getAI();
    if (!ai) return {};

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze these system activities for performance or business bottlenecks: ${JSON.stringify(activities.slice(0, 30))}`,
      config: {
        responseMimeType: "application/json",
        systemInstruction: "As a CTO advisor, find patterns and optimization opportunities. Return JSON with detailed insights and actionable advice."
      }
    });
    return JSON.parse(response.text || "{}");
  }
};
