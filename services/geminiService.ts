
import { GoogleGenAI } from "@google/genai";
import { Order, CollectionTone, Customer, WhatsAppLogEntry, CreditworthinessReport, AiChatInsight, WhatsAppTemplate, AppResolutionPath, ActivityLogEntry, MetaCategory, AppTemplateGroup, PsychologicalTactic, PaymentPlanTemplate } from "../types";
import { RECOVERY_TEMPLATES } from "../constants";

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
  ): Promise<{ message: string, tone: CollectionTone, reasoning: string, templateId?: string, variables?: string[] }> {
    const ai = getAI();
    // Fallback if AI unavailable
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
        model: 'gemini-3-flash-preview',
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
            "mappedVariables": ["string", "string", ...], (Extract values for {{1}}, {{2}} etc from context),
            "reasoning": "string",
            "previewMessage": "string (the final text with variables filled)"
        }
        `,
        config: { 
            responseMimeType: "application/json",
            systemInstruction: "You are a Compliance Officer for a Jewelry Brand. You must strictly select a pre-approved template ID. Do not hallucinage new templates."
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

  // --- INTELLIGENT DIAGNOSTICS & IMPLEMENTATION GENERATOR ---
  async diagnoseError(message: string, source: string, stack?: string): Promise<{ 
      explanation: string, 
      fixType: 'AUTO' | 'MANUAL_CODE' | 'CONFIG', 
      implementationPrompt?: string, // The golden code prompt
      action?: 'REPAIR_TEMPLATE' | 'RETRY_API', 
      suggestedFixData?: any,
      resolutionPath?: AppResolutionPath
  }> {
    const ai = getAI();
    if (!ai) return { explanation: "AI Unavailable", fixType: 'MANUAL_CODE', resolutionPath: 'none' };

    try {
        const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `
        SYSTEM ERROR DETECTED:
        Source: ${source}
        Message: ${message}
        Stack Trace: ${stack || 'N/A'}

        Your Role: Senior React Native/Web Engineer & System Architect.

        Task:
        1. Analyze the root cause.
        2. Determine if this can be auto-fixed (e.g., missing data that can be re-fetched, missing template that can be re-created) or if it requires a CODE CHANGE.
        3. If it requires a code change, generate a specific, copy-pasteable prompt that the user can give to an AI coding assistant to fix the file.

        Output JSON Format:
        {
            "explanation": "Human readable summary of what broke",
            "fixType": "AUTO" | "MANUAL_CODE" | "CONFIG",
            "implementationPrompt": "Strictly technical prompt for AI Studio. E.g., 'Update OrderForm.tsx to handle null coalescing on items array...'",
            "action": "REPAIR_TEMPLATE" (only if missing template) | "RETRY_API" | null,
            "suggestedFixData": { ...any context data for auto fix... },
            "resolutionPath": "settings" | "templates" | "whatsapp" | "none"
        }
        `,
        config: {
            responseMimeType: "application/json"
        }
        });
        
        return JSON.parse(response.text || "{}");
    } catch (e) {
        return { explanation: "Diagnosis failed.", fixType: 'MANUAL_CODE' };
    }
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
