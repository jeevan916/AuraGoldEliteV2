
import { GoogleGenAI } from "@google/genai";
import { Order, CollectionTone, Customer, WhatsAppLogEntry, CreditworthinessReport, AiChatInsight, WhatsAppTemplate, AppResolutionPath, ActivityLogEntry, MetaCategory, AppTemplateGroup, PsychologicalTactic, PaymentPlanTemplate } from "../types";
import { RECOVERY_TEMPLATES } from "../constants";

// Use gemini-2.5-flash-preview as the default engine for speed + intelligence
const DEFAULT_MODEL = 'gemini-2.5-flash-preview';

const getAI = () => {
    const key = process.env.API_KEY;
    if (!key || key.includes('API_KEY')) {
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
        model: DEFAULT_MODEL,
        contents: `Analyze these overdue jewelry accounts: \n${riskSummary}\nProvide a 3-point executive recovery strategy for a high-end jewelry store.`,
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
  ): Promise<{ message: string, tone: CollectionTone, reasoning: string, templateId?: string, variables?: string[] }> {
    const ai = getAI();
    const fallbackTemplate = RECOVERY_TEMPLATES[0];
    const paid = order.payments.reduce((acc, p) => acc + p.amount, 0);
    const balance = order.totalAmount - paid;
    const fallbackVars = [order.customerName, `₹${balance}`, order.id, `https://order.auragold.com/?token=${order.shareToken}`];
    
    if (!ai) return { 
        message: fallbackTemplate.text.replace('{{1}}', fallbackVars[0]).replace('{{2}}', fallbackVars[1]).replace('{{3}}', fallbackVars[2]).replace('{{4}}', fallbackVars[3]), 
        tone: "POLITE", 
        reasoning: "AI Offline",
        templateId: fallbackTemplate.id,
        variables: fallbackVars
    };
    
    const dueDate = order.paymentPlan.milestones.find(m => m.status !== 'PAID')?.dueDate || 'Today';

    try {
        const response = await ai.models.generateContent({
        model: DEFAULT_MODEL,
        contents: `
        Context:
        - Customer: ${order.customerName}
        - Balance: ₹${balance}
        - Status: ${type} (Due: ${dueDate})
        - Current Gold Rate: ₹${currentGoldRate}
        - Link: https://order.auragoldelite.com/?token=${order.shareToken}
        - OrderID: ${order.id}

        Task: Select the most appropriate template from the list below for a WhatsApp API message. Do NOT generate new text.
        
        Available Templates:
        ${JSON.stringify(RECOVERY_TEMPLATES)}

        Return JSON:
        {
            "selectedTemplateId": "string (must match one id from list)",
            "mappedVariables": ["string", "string", ...],
            "reasoning": "string",
            "previewMessage": "string"
        }
        `,
        config: { 
            responseMimeType: "application/json",
            systemInstruction: "You are a Compliance Officer for a Jewelry Brand. You must strictly select a pre-approved template ID. Do not hallucinate new templates."
        }
        });
        
        const data = JSON.parse(response.text || "{}");
        
        return {
            message: data.previewMessage || "Message Preview Unavailable",
            tone: data.selectedTemplateId?.includes('urgent') ? 'URGENT' : (data.selectedTemplateId?.includes('firm') ? 'FIRM' : 'POLITE'),
            reasoning: data.reasoning || "AI Selection",
            templateId: data.selectedTemplateId,
            variables: data.mappedVariables
        };

    } catch(e) {
        console.error("AI Generation Error", e);
        return { 
            message: fallbackTemplate.text, 
            tone: "POLITE", 
            reasoning: "Fallback Error", 
            templateId: fallbackTemplate.id,
            variables: fallbackVars
        };
    }
  },

  async generateDeepCustomerAnalysis(customer: Customer, orders: Order[], logs: WhatsAppLogEntry[]): Promise<CreditworthinessReport> {
    const ai = getAI();
    if (!ai) return {} as any;

    try {
        const response = await ai.models.generateContent({
        model: DEFAULT_MODEL,
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
        model: DEFAULT_MODEL,
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
      model: DEFAULT_MODEL,
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
      model: DEFAULT_MODEL,
      contents: `
      URGENT: This WhatsApp template was REJECTED by Meta. You must fix it.
      
      Current Name: "${template.name}"
      Current Category: "${template.category}"
      Current Content: "${template.content}"
      REJECTION REASON (from Meta): "${template.rejectionReason || 'Generic Policy Violation'}"
      
      Your Role: Meta Policy Compliance Expert.
      
      RULES FOR FIXING:
      1. UTILITY vs MARKETING: If the content contains ANY promotional words (offer, sale, discount, limited time, exclusive, happy to help), it MUST be categorized as 'MARKETING'.
      2. If category is 'UTILITY', rewrite content to be strictly transactional, dry, and specific (e.g., "Your order #{{1}} is updated."). Remove all greetings and polite fluff.
      3. FORMATTING: Ensure variables {{1}} are sequential. Ensure examples are provided.
      4. DO NOT change the name if possible, unless the rejection was due to the name format.
      
      Return JSON:
      {
        "diagnosis": "Detailed reason why it was rejected and what was fixed.",
        "fixedContent": "The rewritten compliant message string.",
        "category": "UTILITY" or "MARKETING" or "AUTHENTICATION",
        "fixedName": "same_name_as_input",
        "variableExamples": ["example1", "example2"]
      }
      `,
      config: {
        responseMimeType: "application/json",
        systemInstruction: "You are a Meta WhatsApp Policy Expert. Fix the template to ensure 100% approval probability."
      }
    });
    return JSON.parse(response.text || "{}");
  },

  async validateAndFixTemplate(requiredContent: string, requiredName: string, category: string): Promise<{ isCompliant: boolean, optimizedContent: string, explanation: string }> {
    const ai = getAI();
    if (!ai) return { isCompliant: true, optimizedContent: requiredContent, explanation: "AI Unavailable" };

    const response = await ai.models.generateContent({
        model: DEFAULT_MODEL,
        contents: `
        Analyze this Core WhatsApp Template required by our App.
        Name: ${requiredName}
        Category: ${category}
        Content: "${requiredContent}"

        Task: Check if this content is likely to be rejected by Meta. 
        Rules:
        1. Variable count {{1}}, {{2}} MUST remain exactly the same as input.
        2. If Category is UTILITY, tone must be transactional.
        3. If Category is MARKETING, tone can be promotional.

        If it violates rules, rewrite it to be compliant while KEEPING VARIABLES intact.
        `,
        config: {
            responseMimeType: "application/json",
            systemInstruction: "Return JSON: isCompliant (boolean), optimizedContent (string, same variables), explanation (string)."
        }
    });
    return JSON.parse(response.text || "{}");
  },

  async generatePaymentPlan(prompt: string): Promise<Partial<PaymentPlanTemplate>> {
    const ai = getAI();
    if (!ai) throw new Error("AI Key Missing");

    const response = await ai.models.generateContent({
        model: DEFAULT_MODEL,
        contents: `Create a jewelry gold purchase plan based on this strategy: "${prompt}"`,
        config: {
            responseMimeType: "application/json",
            systemInstruction: "Return JSON with keys: name (short marketing name), months (number), interestPercentage (number 0-20), advancePercentage (number 0-100). optimize for cash flow."
        }
    });
    return JSON.parse(response.text || "{}");
  },

  // --- SELF-HEALING INTELLIGENCE UPGRADE (V2.5) ---
  async diagnoseError(message: string, source: string, stack?: string, rawContext?: any): Promise<{ 
      explanation: string, 
      fixType: 'AUTO' | 'MANUAL_CODE' | 'CONFIG', 
      implementationPrompt?: string, 
      action?: 'REPAIR_TEMPLATE' | 'RETRY_API', 
      suggestedFixData?: any,
      resolutionPath?: AppResolutionPath
  }> {
    const ai = getAI();
    if (!ai) return { explanation: "AI Unavailable", fixType: 'MANUAL_CODE', resolutionPath: 'none' };

    try {
        const response = await ai.models.generateContent({
        model: DEFAULT_MODEL,
        contents: `
        [CORE ARCHITECT DIAGNOSTICS]
        Source Component/Service: ${source}
        Error Message: ${message}
        Stack Trace: ${stack || 'N/A'}
        
        [RAW DATA PAYLOAD]
        ${rawContext ? JSON.stringify(rawContext, null, 2) : 'No raw context available.'}

        Your Role: Lead Systems Engineer for AuraGold Elite.

        Goal: 
        Analyze the raw payload to find hidden API errors (e.g. Meta code 100, Razorpay 400).
        If it's a structural code error, provide a high-precision implementation prompt to change the app code.

        Guidelines for Prompt Generation:
        - Be EXTREMELY specific. Use file names and function names.
        - E.g., "In services/whatsappService.ts, the sendTemplateMessage function expects 6 variables but only 4 are provided. Add the missing 'schedule' and 'token' variables."

        Output JSON Format:
        {
            "explanation": "Summarize the failure from the raw data. E.g., 'Meta rejected variable 5 for being too long.'",
            "fixType": "AUTO" | "MANUAL_CODE" | "CONFIG",
            "implementationPrompt": "Strictly technical directive for a coding AI to fix the file. MUST use markdown style instructions.",
            "action": "REPAIR_TEMPLATE" | "RETRY_API" | null,
            "suggestedFixData": { ...context... },
            "resolutionPath": "settings" | "templates" | "whatsapp" | "none"
        }
        `,
        config: {
            responseMimeType: "application/json"
        }
        });
        
        return JSON.parse(response.text || "{}");
    } catch (e) {
        return { explanation: "Deep diagnosis failed.", fixType: 'MANUAL_CODE' };
    }
  },

  async analyzeSystemLogsForImprovements(activities: ActivityLogEntry[]): Promise<any> {
    const ai = getAI();
    if (!ai) return {};

    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: `Analyze these system activities for performance or business bottlenecks: ${JSON.stringify(activities.slice(0, 30))}`,
      config: {
        responseMimeType: "application/json",
        systemInstruction: "As a CTO advisor, find patterns and optimization opportunities. Return JSON with detailed insights and actionable advice."
      }
    });
    return JSON.parse(response.text || "{}");
  }
};
