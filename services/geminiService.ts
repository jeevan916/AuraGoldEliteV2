
// @google/genai guidelines followed:
// - Always use const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
// - Use ai.models.generateContent
// - Do not use response.text()
import { GoogleGenAI } from "@google/genai";
import { Order, CollectionTone, Customer, WhatsAppLogEntry, CreditworthinessReport, AiChatInsight, WhatsAppTemplate, MetaCategory, AppTemplateGroup, PsychologicalTactic, ActivityLogEntry } from "../types";

// Safety wrapper to prevent crash if API Key is missing during dev
const getAI = () => {
    const key = process.env.API_KEY;
    if (!key) {
        console.warn("Gemini API Key is missing. AI features will run in mock mode.");
        return null;
    }
    return new GoogleGenAI({ apiKey: key });
};

export const geminiService = {
  /**
   * Analyzes overdue orders and provides a strategic collection report.
   */
  async analyzeCollectionRisk(overdueOrders: Order[]): Promise<string> {
    const ai = getAI();
    if (!ai || overdueOrders.length === 0) return "No collection risks identified or AI offline.";

    const riskSummary = overdueOrders.map(o => {
      const paid = o.payments.reduce((acc, p) => acc + p.amount, 0);
      return `${o.customerName}: ₹${(o.totalAmount - paid).toLocaleString()} outstanding.`;
    }).join('\n');

    const prompt = `
      Act as a Lead Collection Strategist for a luxury jewelry brand. 
      Analyze the following overdue accounts and provide a summary of the cash flow at risk, 
      prioritize the top 3 customers to contact, and suggest a tone for the reminders.
      
      Overdue Accounts:
      ${riskSummary}

      Return a professional, concise executive summary in bullet points.
    `;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
      });
      return response.text || "Unable to analyze risk at this time.";
    } catch (error) {
      console.error("AI Analysis Error:", error);
      return "AI Risk Analysis Engine is offline. Please review manually.";
    }
  },

  /**
   * Generates a specific strategic message for a customer.
   */
  async generateStrategicNotification(
    order: Order, 
    type: 'UPCOMING' | 'OVERDUE',
    currentGoldRate: number
  ): Promise<{ message: string, tone: CollectionTone, reasoning: string }> {
    const ai = getAI();
    const paid = order.payments.reduce((acc, p) => acc + p.amount, 0);
    const balance = order.totalAmount - paid;
    
    // Fallback if AI offline
    if (!ai) {
         return { 
            tone: 'POLITE', 
            reasoning: 'AI Offline - Default Polite Message', 
            message: `Hello ${order.customerName}, a friendly reminder for your upcoming jewelry payment of ₹${balance.toLocaleString()}.`
          };
    }

    const prompt = `
      Jewelry Order: ${order.customerName}
      Pending Balance: ₹${balance.toLocaleString()}
      Status: ${type} payment milestone.
      Locked Gold Rate: ₹${order.paymentPlan.protectionRateBooked}/g
      Current Market Rate: ₹${currentGoldRate}/g

      Create a persuasive WhatsApp message. 
      If OVERDUE, mention that their Gold Rate Protection is at risk. 
      Tone options: "POLITE", "FIRM", "URGENT", or "ENCOURAGING".
      
      Return JSON: { "tone": "POLITE" | "FIRM" | "URGENT" | "ENCOURAGING", "reasoning": "...", "message": "..." }
    `;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      return JSON.parse(response.text || "{}");
    } catch (e) {
      return { 
        tone: 'POLITE', 
        reasoning: 'AI Fallback', 
        message: `Hello ${order.customerName}, a friendly reminder for your upcoming jewelry payment of ₹${balance.toLocaleString()}.`
      };
    }
  },

  /**
   * Generates a deep behavioral analysis for a customer profile.
   */
  async generateDeepCustomerAnalysis(customer: Customer, orders: Order[], logs: WhatsAppLogEntry[]): Promise<CreditworthinessReport> {
    const ai = getAI();
    if (!ai) throw new Error("AI Key missing");

    const prompt = `
      Analyze this jewelry customer for a luxury brand:
      Name: ${customer.name}
      Total Spent: ₹${customer.totalSpent}
      Orders: ${JSON.stringify(orders.map(o => ({ id: o.id, status: o.status, total: o.totalAmount })))}
      Recent Communication: ${JSON.stringify(logs.slice(0, 5).map(l => ({ msg: l.message, direction: l.direction })))}

      Provide a Creditworthiness Report in JSON format:
      {
        "riskLevel": "LOW" | "MODERATE" | "HIGH" | "CRITICAL",
        "persona": "Description of customer behavior",
        "nextBestAction": "What the store should do next",
        "communicationStrategy": "How to talk to them",
        "negotiationLeverage": "What to use to convince them"
      }
    `;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      return JSON.parse(response.text || "{}");
    } catch (e) {
      throw e;
    }
  },

  /**
   * Analyzes live chat context to provide assistance.
   */
  async analyzeChatContext(messages: WhatsAppLogEntry[], templates: WhatsAppTemplate[], customerName: string): Promise<AiChatInsight> {
    const ai = getAI();
    if (!ai) return { intent: "Unknown", tone: "Neutral", suggestedReply: "How can I help you today?" };

    const prompt = `
      Customer: ${customerName}
      Messages: ${JSON.stringify(messages.slice(-10).map(m => ({ text: m.message, dir: m.direction })))}
      Available Templates: ${JSON.stringify(templates.map(t => ({ id: t.id, name: t.name })))}

      Analyze intent and suggest next reply.
      Return JSON: { "intent": "string", "tone": "string", "suggestedReply": "string", "recommendedTemplateId": "string | null" }
    `;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      return JSON.parse(response.text || "{}");
    } catch (e) {
      return { intent: "Unknown", tone: "Neutral", suggestedReply: "How can I help you today?" };
    }
  },

  /**
   * Generates a template based on a natural language prompt.
   */
  async generateTemplateFromPrompt(userInput: string): Promise<any> {
    const ai = getAI();
    if (!ai) throw new Error("AI Key Missing");

    const prompt = `
      User wants a WhatsApp template for: "${userInput}"
      Generate a compliant Meta WhatsApp template.
      Return JSON: 
      {
        "suggestedName": "lowercase_snake_case",
        "content": "Message text with {{1}} placeholders",
        "metaCategory": "UTILITY" | "MARKETING",
        "appGroup": "PAYMENT_COLLECTION" | "ORDER_STATUS" | "MARKETING_PROMO" | "GENERAL_SUPPORT" | "SYSTEM_NOTIFICATIONS",
        "tactic": "LOSS_AVERSION" | "SOCIAL_PROOF" | "AUTHORITY" | "RECIPROCITY" | "URGENCY" | "EMPATHY",
        "examples": ["example value for {{1}}", ...]
      }
    `;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      return JSON.parse(response.text || "{}");
    } catch (e) {
      throw e;
    }
  },

  /**
   * Diagnoses a system error and suggests a fix.
   */
  async diagnoseError(errorMessage: string, source: string): Promise<any> {
    const ai = getAI();
    if (!ai) return { explanation: "AI unavailable.", path: "none", cta: "Review Manually", action: "NONE" };

    const prompt = `
      Diagnose this application error:
      Source: ${source}
      Message: ${errorMessage}

      Return JSON:
      {
        "explanation": "Human readable explanation",
        "path": "settings" | "templates" | "whatsapp" | "none",
        "cta": "Button text",
        "action": "REPAIR_TEMPLATE" | "RETRY_API" | "NONE",
        "suggestedFixData": {}
      }
    `;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      return JSON.parse(response.text || "{}");
    } catch (e) {
      return { explanation: "AI could not diagnose error.", path: "none", cta: "Review Manually", action: "NONE" };
    }
  },

  /**
   * Analyzes application activity logs to suggest improvements.
   */
  async analyzeSystemLogsForImprovements(activities: ActivityLogEntry[]): Promise<any> {
    const ai = getAI();
    if (!ai) return { suggestions: [] };

    const prompt = `
      Analyze these application activity logs for a luxury jewelry brand backend:
      ${JSON.stringify(activities.slice(0, 50).map(a => ({ type: a.actionType, msg: a.details })))}

      Suggest 3 high-impact improvements for the store's operations or app features based on patterns in these logs.
      Return JSON: { "suggestions": [{ "title": "string", "reason": "string", "impact": "LOW" | "MEDIUM" | "HIGH" }] }
    `;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      return JSON.parse(response.text || "{}");
    } catch (e) {
      return { suggestions: [] };
    }
  }
};
