
import { GoogleGenAI, Type } from "@google/genai";
import { Order, CollectionTone, Customer, WhatsAppLogEntry, CreditworthinessReport, AiChatInsight, WhatsAppTemplate, AppResolutionPath, ActivityLogEntry, MetaCategory, AppTemplateGroup, PsychologicalTactic, PaymentPlanTemplate } from "../types";
import { RECOVERY_TEMPLATES } from "../constants";

const PRO_MODEL = 'gemini-3-pro-preview';
const FAST_MODEL = 'gemini-flash-lite-latest';
const STANDARD_MODEL = 'gemini-3-flash-preview';

const getAI = () => {
    const key = process.env.API_KEY;
    if (!key || key.includes('API_KEY')) return null;
    return new GoogleGenAI({ apiKey: key });
};

export const geminiService = {
  async diagnoseError(message: string, source: string, stack?: string, rawContext?: any): Promise<{ 
      explanation: string, 
      fixType: 'AUTO' | 'MANUAL_CODE' | 'CONFIG', 
      implementationPrompt?: string, 
      action?: 'REPAIR_TEMPLATE' | 'RETRY_API', 
      resolutionPath?: AppResolutionPath
  }> {
    const ai = getAI();
    if (!ai) return { explanation: "AI Gateway Offline", fixType: 'MANUAL_CODE' };

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
        contents: `Meta Template Check: Name: ${requiredName} Category: ${category} Content: "${requiredContent}"`,
        config: {
            responseMimeType: "application/json",
            systemInstruction: "Analyze for promotional language or forbidden variables. Return JSON: isCompliant, optimizedContent, explanation."
        }
    });
    return JSON.parse(response.text || "{}");
  },

  async generatePaymentPlan(prompt: string): Promise<Partial<PaymentPlanTemplate>> {
    const ai = getAI();
    if (!ai) return { name: "Manual Plan", months: 6 };
    const response = await ai.models.generateContent({
        model: FAST_MODEL,
        contents: `Generate a payment plan based on: ${prompt}`,
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

  async analyzeChatContext(messages: WhatsAppLogEntry[], templates: WhatsAppTemplate[], customerName: string): Promise<AiChatInsight> {
    const ai = getAI();
    if (!ai) return { intent: "unknown", tone: "neutral", suggestedReply: "Hello" };
    const response = await ai.models.generateContent({
        model: STANDARD_MODEL,
        contents: `Analyze chat with ${customerName} History: ${JSON.stringify(messages.slice(-5))}`,
        config: {
            responseMimeType: "application/json",
            systemInstruction: "Determine customer intent. Return JSON: intent, tone, suggestedReply."
        }
    });
    return JSON.parse(response.text || "{}");
  },

  async generateTemplateFromPrompt(prompt: string): Promise<{ suggestedName: string, content: string, metaCategory: MetaCategory, appGroup: AppTemplateGroup, tactic: PsychologicalTactic, examples: string[] }> {
    const ai = getAI();
    if (!ai) throw new Error("AI Offline");
    const response = await ai.models.generateContent({
        model: PRO_MODEL,
        contents: `Architect a Meta Template for: ${prompt}`,
        config: {
            responseMimeType: "application/json",
            systemInstruction: "Design a template. Return JSON: suggestedName, content, metaCategory, appGroup, tactic, examples."
        }
    });
    return JSON.parse(response.text || "{}");
  },

  async generateStrategicNotification(order: Order, type: 'UPCOMING' | 'OVERDUE', goldRate: number): Promise<{ tone: CollectionTone, reasoning: string, templateId: string, variables: string[], message: string }> {
    const ai = getAI();
    if (!ai) throw new Error("AI Offline");
    const response = await ai.models.generateContent({
        model: PRO_MODEL,
        contents: `Generate strategic notification for ${order.customerName}. Status: ${order.status} Type: ${type}`,
        config: {
            responseMimeType: "application/json",
            systemInstruction: "Select tone and template. Return JSON: tone, reasoning, templateId, variables, message."
        }
    });
    return JSON.parse(response.text || "{}");
  },

  // Added missing fixRejectedTemplate method to resolve property missing error in WhatsAppTemplates.tsx
  async fixRejectedTemplate(template: WhatsAppTemplate): Promise<{ fixedName: string, fixedContent: string, category: MetaCategory, variableExamples: string[], diagnosis: string }> {
    const ai = getAI();
    if (!ai) throw new Error("AI Offline");
    const response = await ai.models.generateContent({
        model: PRO_MODEL,
        contents: `Meta Template Rejected: Name: ${template.name} Category: ${template.category} Content: "${template.content}" Rejection Reason: ${template.rejectionReason || 'Unknown'}`,
        config: {
            responseMimeType: "application/json",
            systemInstruction: "Analyze why the WhatsApp template was rejected by Meta and provide a fixed version that complies with policies. Return JSON: fixedName, fixedContent, category, variableExamples, diagnosis."
        }
    });
    return JSON.parse(response.text || "{}");
  }
};
