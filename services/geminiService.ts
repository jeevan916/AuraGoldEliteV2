
import { GoogleGenAI, Type } from "@google/genai";
import { Order, CollectionTone, Customer, WhatsAppLogEntry, CreditworthinessReport, AiChatInsight, WhatsAppTemplate, AppResolutionPath, ActivityLogEntry, MetaCategory, AppTemplateGroup, PsychologicalTactic, PaymentPlanTemplate } from "../types";
import { RECOVERY_TEMPLATES } from "../constants";

const PRO_MODEL = 'gemini-3-pro-preview';
// Corrected FAST_MODEL to follow naming guidelines
const FAST_MODEL = 'gemini-flash-lite-latest';
const STANDARD_MODEL = 'gemini-3-flash-preview';

const getAI = () => {
    const key = process.env.API_KEY;
    if (!key || key.includes('API_KEY')) return null;
    return new GoogleGenAI({ apiKey: key });
};

export const geminiService = {
  // Existing collection & analysis methods...
  
  async diagnoseError(message: string, source: string, stack?: string, rawContext?: any): Promise<{ 
      explanation: string, 
      fixType: 'AUTO' | 'MANUAL_CODE' | 'CONFIG', 
      implementationPrompt?: string, 
      action?: 'REPAIR_TEMPLATE' | 'RETRY_API', 
      resolutionPath?: AppResolutionPath
  }> {
    const ai = getAI();
    if (!ai) return { explanation: "AI Gateway Offline", fixType: 'MANUAL_CODE' };

    // Meta Error #100 Specialization
    const isMetaError100 = message.includes('(#100)') || (rawContext?.error?.code === 100);

    try {
        const response = await ai.models.generateContent({
        model: PRO_MODEL,
        contents: `
        [CORE DIAGNOSTIC REQUEST]
        Source: ${source}
        Error Message: ${message}
        Context: ${rawContext ? JSON.stringify(rawContext) : 'None'}
        Meta Code: ${isMetaError100 ? '100 (Policy/Validation/Missing)' : 'Generic'}

        Task: Provide a high-precision fix. If it's a Meta Template #100 error, compare the variables in the request vs the known template schema.
        `,
        config: { 
            responseMimeType: "application/json",
            systemInstruction: "Return JSON: explanation, fixType, implementationPrompt, resolutionPath. Be extremely surgical."
        }
        });
        
        return JSON.parse(response.text || "{}");
    } catch (e) { return { explanation: "Diagnostic engine timeout.", fixType: 'MANUAL_CODE' }; }
  },

  async validateAndFixTemplate(requiredContent: string, requiredName: string, category: string): Promise<{ isCompliant: boolean, optimizedContent: string, explanation: string }> {
    const ai = getAI();
    if (!ai) return { isCompliant: true, optimizedContent: requiredContent, explanation: "Validation bypassed." };

    const response = await ai.models.generateContent({
        model: FAST_MODEL,
        contents: `
        Meta Template Check:
        Name: ${requiredName}
        Category: ${category}
        Content: "${requiredContent}"
        `,
        config: {
            responseMimeType: "application/json",
            systemInstruction: "Analyze for promotional language, forbidden variables, or length issues. Return JSON: isCompliant, optimizedContent, explanation."
        }
    });
    return JSON.parse(response.text || "{}");
  },

  // Added generatePaymentPlan method to fix Property 'generatePaymentPlan' does not exist error in PlanManager.tsx
  async generatePaymentPlan(prompt: string): Promise<Partial<PaymentPlanTemplate>> {
    const ai = getAI();
    if (!ai) return { name: "Manual Plan", months: 6, interestPercentage: 0, advancePercentage: 10 };

    const response = await ai.models.generateContent({
        model: FAST_MODEL,
        contents: `Generate a payment plan based on this requirement: ${prompt}`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    months: { type: Type.NUMBER },
                    interestPercentage: { type: Type.NUMBER },
                    advancePercentage: { type: Type.NUMBER }
                },
                required: ["name", "months", "interestPercentage", "advancePercentage"]
            }
        }
    });
    return JSON.parse(response.text || "{}");
  },

  // Added analyzeChatContext method to fix Property 'analyzeChatContext' does not exist error in WhatsAppPanel.tsx
  async analyzeChatContext(messages: WhatsAppLogEntry[], templates: WhatsAppTemplate[], customerName: string): Promise<AiChatInsight> {
    const ai = getAI();
    if (!ai) return { intent: "unknown", tone: "neutral", suggestedReply: "Hello" };

    const response = await ai.models.generateContent({
        model: STANDARD_MODEL,
        contents: `Analyze this chat history with ${customerName} and suggest a reply using available templates if relevant.
        History: ${JSON.stringify(messages.slice(-5))}
        Available Templates: ${JSON.stringify(templates.map(t => ({ id: t.id, name: t.name, content: t.content })))}`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    intent: { type: Type.STRING },
                    tone: { type: Type.STRING },
                    suggestedReply: { type: Type.STRING },
                    recommendedTemplateId: { type: Type.STRING }
                },
                required: ["intent", "tone", "suggestedReply"]
            }
        }
    });
    return JSON.parse(response.text || "{}");
  },

  // Added generateTemplateFromPrompt method to fix Property 'generateTemplateFromPrompt' does not exist error in WhatsAppTemplates.tsx
  async generateTemplateFromPrompt(prompt: string): Promise<{ 
      suggestedName: string, 
      content: string, 
      metaCategory: MetaCategory, 
      appGroup: AppTemplateGroup, 
      tactic: PsychologicalTactic, 
      examples: string[] 
  }> {
    const ai = getAI();
    if (!ai) throw new Error("AI Offline");

    const response = await ai.models.generateContent({
        model: PRO_MODEL,
        contents: `Architect a Meta WhatsApp Template for: ${prompt}`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    suggestedName: { type: Type.STRING },
                    content: { type: Type.STRING },
                    metaCategory: { type: Type.STRING },
                    appGroup: { type: Type.STRING },
                    tactic: { type: Type.STRING },
                    examples: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["suggestedName", "content", "metaCategory", "appGroup", "tactic", "examples"]
            }
        }
    });
    return JSON.parse(response.text || "{}");
  },

  // Added generateStrategicNotification method to fix Property 'generateStrategicNotification' does not exist error in PaymentCollections.tsx
  async generateStrategicNotification(order: Order, type: 'UPCOMING' | 'OVERDUE', goldRate: number): Promise<{
      tone: CollectionTone,
      reasoning: string,
      templateId: string,
      variables: string[],
      message: string
  }> {
    const ai = getAI();
    if (!ai) throw new Error("AI Offline");

    const response = await ai.models.generateContent({
        model: PRO_MODEL,
        contents: `Generate a strategic payment notification for ${order.customerName}. 
        Order Status: ${order.status}. 
        Type: ${type}. 
        Current Gold Rate: ${goldRate}. 
        Total Amount: ${order.totalAmount}.
        Milestones: ${JSON.stringify(order.paymentPlan.milestones)}`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    tone: { type: Type.STRING },
                    reasoning: { type: Type.STRING },
                    templateId: { type: Type.STRING },
                    variables: { type: Type.ARRAY, items: { type: Type.STRING } },
                    message: { type: Type.STRING }
                },
                required: ["tone", "reasoning", "templateId", "variables", "message"]
            }
        }
    });
    return JSON.parse(response.text || "{}");
  }
};
