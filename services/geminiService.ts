
import { GoogleGenAI, Type } from "@google/genai";
import { 
  Order, CollectionTone, Customer, WhatsAppLogEntry, 
  AiChatInsight, WhatsAppTemplate, AppResolutionPath, 
  MetaCategory, AppTemplateGroup, PsychologicalTactic, 
  PaymentPlanTemplate, RiskProfile 
} from "../types";

// Latest Model Definitions
const PRO_MODEL = 'gemini-3-pro-preview';
const FLASH_MODEL = 'gemini-3-flash-preview';

const getAI = () => {
    const key = process.env.API_KEY;
    if (!key || key.includes('API_KEY')) return null;
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const geminiService = {
  /**
   * Deep Error Diagnosis & Code Patcher
   */
  async diagnoseError(message: string, source: string, stack?: string, rawContext?: any): Promise<{ 
      explanation: string, 
      fixType: 'AUTO' | 'MANUAL_CODE' | 'CONFIG', 
      implementationPrompt?: string, 
      fixingPrompt?: string,
      action?: 'REPAIR_TEMPLATE' | 'RETRY_API', 
      resolutionPath?: AppResolutionPath
  }> {
    const ai = getAI();
    if (!ai) return { explanation: "AI Gateway Offline", fixType: 'MANUAL_CODE' };

    try {
        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: `You are a Senior TypeScript/React Engineer debugging a production error in a Jewelry CRM.
            
            ERROR DETAILS:
            Source: ${source}
            Message: ${message}
            Stack Trace: ${stack || 'N/A'}
            
            DATA CONTEXT: 
            ${JSON.stringify(rawContext || {}, null, 2)}
            
            CRITICAL KNOWLEDGE BASE:
            1. Meta WhatsApp API strictly REJECTS parameters containing newline characters (\\n) or tabs (\\t).
            2. Template variable count in payload MUST match the template definition on Meta.
            
            TASK:
            Analyze why the code failed and provide a fix.`,
            config: { 
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        explanation: { type: Type.STRING },
                        fixType: { type: Type.STRING, enum: ['AUTO', 'MANUAL_CODE', 'CONFIG'] },
                        implementationPrompt: { type: Type.STRING },
                        fixingPrompt: { type: Type.STRING },
                        action: { type: Type.STRING, enum: ['REPAIR_TEMPLATE', 'RETRY_API'] },
                        resolutionPath: { type: Type.STRING, enum: ['settings', 'templates', 'whatsapp', 'none'] }
                    },
                    required: ["explanation", "fixType", "resolutionPath"]
                }
            }
        });
        return JSON.parse(response.text);
    } catch (e) { return { explanation: "Diagnostic engine timeout.", fixType: 'MANUAL_CODE', resolutionPath: 'none' }; }
  },

  /**
   * Real-time Chat Intelligence
   */
  async analyzeChatContext(messages: WhatsAppLogEntry[], templates: WhatsAppTemplate[], customerName: string): Promise<AiChatInsight> {
    const ai = getAI();
    if (!ai) return { intent: "unknown", tone: "neutral", suggestedReply: "Hello" };

    try {
        const response = await ai.models.generateContent({
            model: FLASH_MODEL,
            contents: `Analyze jewelry customer chat history for ${customerName}. Suggest a reply.`,
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
        return JSON.parse(response.text);
    } catch (e) { return { intent: "unknown", tone: "neutral", suggestedReply: "I'm checking your order details now." }; }
  },

  /**
   * Generative Architect
   */
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
        contents: `Architect a high-converting WhatsApp template for a luxury jewelry business based on: ${prompt}`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    suggestedName: { type: Type.STRING },
                    content: { type: Type.STRING },
                    metaCategory: { type: Type.STRING, enum: ['UTILITY', 'MARKETING', 'AUTHENTICATION'] },
                    appGroup: { type: Type.STRING, enum: ['PAYMENT_COLLECTION', 'ORDER_STATUS', 'MARKETING_PROMO', 'GENERAL_SUPPORT', 'SYSTEM_NOTIFICATIONS', 'SETU_PAYMENT', 'UNCATEGORIZED'] },
                    tactic: { type: Type.STRING, enum: ['LOSS_AVERSION', 'SOCIAL_PROOF', 'AUTHORITY', 'RECIPROCITY', 'URGENCY', 'EMPATHY'] },
                    examples: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["suggestedName", "content", "metaCategory", "appGroup", "tactic", "examples"]
            }
        }
    });
    return JSON.parse(response.text);
  },

  /**
   * Strategic Nudge Generation
   */
  async generateStrategicNotification(order: Order, type: 'UPCOMING' | 'OVERDUE' | 'SYSTEM', goldRate: number, riskProfile: RiskProfile = 'REGULAR'): Promise<{ 
      tone: CollectionTone, 
      reasoning: string, 
      templateId: string, 
      variables: string[], 
      message: string 
  }> {
    const ai = getAI();
    if (!ai) throw new Error("AI Offline");

    const paid = order.payments.reduce((s, p) => s + p.amount, 0);
    const balance = order.totalAmount - paid;

    const response = await ai.models.generateContent({
        model: PRO_MODEL,
        contents: `Generate collection strategy. Customer: ${order.customerName}, Balance: ${balance}, Status: ${type}, Risk: ${riskProfile}`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    tone: { type: Type.STRING, enum: ['POLITE', 'FIRM', 'URGENT', 'ENCOURAGING'] },
                    reasoning: { type: Type.STRING },
                    templateId: { type: Type.STRING },
                    variables: { type: Type.ARRAY, items: { type: Type.STRING } },
                    message: { type: Type.STRING }
                },
                required: ["tone", "reasoning", "templateId", "variables", "message"]
            }
        }
    });
    return JSON.parse(response.text);
  },

  /**
   * Auto-Fix Rejected Templates (Enhanced for API Errors)
   */
  async fixRejectedTemplate(template: Partial<WhatsAppTemplate>): Promise<{ 
      fixedName: string, 
      fixedContent: string, 
      category: MetaCategory, 
      variableExamples: string[], 
      diagnosis: string 
  }> {
    const ai = getAI();
    if (!ai) throw new Error("AI Offline");

    const variableCount = (template.content?.match(/{{[0-9]+}}/g) || []).length;

    const response = await ai.models.generateContent({
        model: PRO_MODEL,
        contents: `You are a Meta WhatsApp Template Compliance Officer.
        
        PROBLEM: A template failed submission to Meta.
        Content: "${template.content}"
        API Error / Rejection Reason: "${template.rejectionReason || 'Invalid Parameter / Structure'}"
        Current Category: ${template.category}
        
        CRITICAL RULES FOR FIXING:
        1. "Invalid Parameter" or "Ratio" Error: The content is too short for the number of variables. You MUST add more static text (formal, professional sentences) to lower the variable-to-word ratio.
        2. "Promotional" Error: Remove words like "offer", "sale", "free", "gift". Make it purely transactional.
        3. "Formatting": Ensure variables are {{1}}, {{2}}... sequentially.
        4. Do NOT change the NUMBER of variables if possible, just surround them with more text.
        
        TASK: Rewrite the content to be compliant while keeping the original intent.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    fixedName: { type: Type.STRING },
                    fixedContent: { type: Type.STRING },
                    category: { type: Type.STRING, enum: ['UTILITY', 'MARKETING', 'AUTHENTICATION'] },
                    variableExamples: { type: Type.ARRAY, items: { type: Type.STRING } },
                    diagnosis: { type: Type.STRING, description: "Explain specifically what was changed to fix the error" }
                },
                required: ["fixedName", "fixedContent", "category", "diagnosis"]
            }
        }
    });
    return JSON.parse(response.text);
  },

  /**
   * Payment Plan Gen
   */
  async generatePaymentPlan(prompt: string): Promise<Partial<PaymentPlanTemplate>> {
    const ai = getAI();
    if (!ai) return { name: "Manual Plan", months: 6 };

    const response = await ai.models.generateContent({
        model: FLASH_MODEL,
        contents: `Create jewelry payment scheme: ${prompt}`,
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
    return JSON.parse(response.text);
  },

  /**
   * Pre-flight Check
   */
  async validateAndFixTemplate(requiredContent: string, requiredName: string, category: string): Promise<{ isCompliant: boolean, optimizedContent: string, explanation: string }> {
    const ai = getAI();
    if (!ai) return { isCompliant: true, optimizedContent: requiredContent, explanation: "Validation bypassed." };

    try {
        const response = await ai.models.generateContent({
            model: FLASH_MODEL,
            contents: `Check compliance for Meta Template: ${requiredName} (${category}). Content: "${requiredContent}"
            If category is UTILITY, ensure no promotional words.
            If valid, return true. If not, rewrite content to be compliant.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        isCompliant: { type: Type.BOOLEAN },
                        optimizedContent: { type: Type.STRING },
                        explanation: { type: Type.STRING }
                    },
                    required: ["isCompliant", "optimizedContent", "explanation"]
                }
            }
        });
        return JSON.parse(response.text);
    } catch (e) {
        return { isCompliant: true, optimizedContent: requiredContent, explanation: "Fallback compliance check." };
    }
  }
};
