
import { GoogleGenAI } from "@google/genai";
import { Order, CollectionTone, Customer, WhatsAppLogEntry, CreditworthinessReport, AiChatInsight, WhatsAppTemplate, AppResolutionPath, ActivityLogEntry, MetaCategory, AppTemplateGroup, PsychologicalTactic } from "../types";

// Always use named parameter for apiKey and initialize inside or just before use
const getAI = () => {
    const key = process.env.API_KEY;
    if (!key) return null;
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

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Analyze these overdue jewelry accounts: \n${riskSummary}\nProvide a 3-point executive recovery strategy for a high-end jewelry store.`,
      config: {
        thinkingConfig: { thinkingBudget: 2000 }
      }
    });
    // Corrected: use .text property, not .text()
    return response.text || "Unable to analyze risk.";
  },

  async generateStrategicNotification(
    order: Order, 
    type: 'UPCOMING' | 'OVERDUE',
    currentGoldRate: number
  ): Promise<{ message: string, tone: CollectionTone, reasoning: string }> {
    const ai = getAI();
    if (!ai) throw new Error("API Key Missing");

    const paid = order.payments.reduce((acc, p) => acc + p.amount, 0);
    const balance = order.totalAmount - paid;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Create a WhatsApp reminder for ${order.customerName}. Balance: ₹${balance}. Status: ${type}. Current Gold Rate: ₹${currentGoldRate}.`,
      config: { 
        responseMimeType: "application/json",
        systemInstruction: "You are an elite jewelry store manager. Use high-end, persuasive language. Return JSON with keys: message, tone (POLITE, FIRM, URGENT, ENCOURAGING), reasoning."
      }
    });
    // Corrected: use .text property, not .text()
    return JSON.parse(response.text || "{}");
  },

  async generateDeepCustomerAnalysis(customer: Customer, orders: Order[], logs: WhatsAppLogEntry[]): Promise<CreditworthinessReport> {
    const ai = getAI();
    if (!ai) throw new Error("API Key Missing");

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Analyze this customer for a luxury jewelry boutique: 
      Profile: ${JSON.stringify(customer)}
      Purchase History: ${JSON.stringify(orders)}
      Communication History: ${JSON.stringify(logs)}`,
      config: {
        responseMimeType: "application/json",
        systemInstruction: "Perform a behavioral and financial analysis. Return JSON with keys: riskLevel (LOW, MODERATE, HIGH, CRITICAL), persona (a luxury-centric title), nextBestAction, communicationStrategy, negotiationLeverage."
      }
    });
    // Corrected: use .text property, not .text()
    return JSON.parse(response.text || "{}");
  },

  async analyzeChatContext(messages: WhatsAppLogEntry[], templates: WhatsAppTemplate[], customerName: string): Promise<AiChatInsight> {
    const ai = getAI();
    if (!ai) throw new Error("API Key Missing");

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
    // Corrected: use .text property, not .text()
    return JSON.parse(response.text || "{}");
  },

  async generateTemplateFromPrompt(prompt: string): Promise<{ suggestedName: string, content: string, metaCategory: MetaCategory, appGroup: AppTemplateGroup, tactic: PsychologicalTactic, examples: string[] }> {
    const ai = getAI();
    if (!ai) throw new Error("API Key Missing");

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate a Meta-compliant WhatsApp template based on: ${prompt}`,
      config: {
        responseMimeType: "application/json",
        systemInstruction: "Design a template for a jewelry store. Suggested name must be snake_case. Return JSON with keys: suggestedName, content (use {{1}}, {{2}} for variables), metaCategory (UTILITY, MARKETING), appGroup (PAYMENT_COLLECTION, ORDER_STATUS, etc.), tactic, examples (array of matching strings for placeholders)."
      }
    });
    // Corrected: use .text property, not .text()
    return JSON.parse(response.text || "{}");
  },

  async diagnoseError(message: string, source: string): Promise<{ explanation: string, path: AppResolutionPath, cta: string, action?: 'REPAIR_TEMPLATE' | 'RETRY_API', suggestedFixData?: any }> {
    const ai = getAI();
    if (!ai) throw new Error("API Key Missing");

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Error: ${message}. Source: ${source}. Diagnose and provide resolution steps.`,
      config: {
        responseMimeType: "application/json",
        systemInstruction: "Analyze technical errors in the AuraGold jewelry app. Provide a fix path. Return JSON with keys: explanation, path (settings, templates, whatsapp, none), cta (call to action text), action, suggestedFixData."
      }
    });
    // Corrected: use .text property, not .text()
    return JSON.parse(response.text || "{}");
  },

  async analyzeSystemLogsForImprovements(activities: ActivityLogEntry[]): Promise<any> {
    const ai = getAI();
    if (!ai) throw new Error("API Key Missing");

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Analyze these system activities for performance or business bottlenecks: ${JSON.stringify(activities.slice(0, 30))}`,
      config: {
        responseMimeType: "application/json",
        systemInstruction: "As a CTO advisor, find patterns and optimization opportunities. Return JSON with detailed insights and actionable advice."
      }
    });
    // Corrected: use .text property, not .text()
    return JSON.parse(response.text || "{}");
  }
};
