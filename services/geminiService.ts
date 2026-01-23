
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
   * Acts as a Senior Engineer debugging your failed API calls.
   */
  async diagnoseError(message: string, source: string, stack?: string, rawContext?: any): Promise<{ 
      explanation: string, 
      fixType: 'AUTO' | 'MANUAL_CODE' | 'CONFIG', 
      implementationPrompt?: string, 
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
            
            DATA CONTEXT (Payload/State): 
            ${JSON.stringify(rawContext || {}, null, 2)}
            
            TASK:
            1. Analyze why the code failed. 
            2. If it's a WhatsApp Meta API error (e.g., param count mismatch, invalid format), compare the 'payload' sent vs the 'error' received.
            3. If the code logic is faulty (e.g., sending 3 params instead of 4), GENERATE THE CORRECT TYPESCRIPT CODE SNIPPET to fix it.
            
            OUTPUT RULES:
            - If it requires a code change, set fixType to 'MANUAL_CODE'.
            - In 'implementationPrompt', provide the EXACT code block to replace the faulty logic.
            - If it's just a template sync issue, set fixType to 'AUTO' and action to 'REPAIR_TEMPLATE'.`,
            config: { 
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        explanation: { type: Type.STRING, description: "Concise technical root cause." },
                        fixType: { type: Type.STRING, enum: ['AUTO', 'MANUAL_CODE', 'CONFIG'] },
                        implementationPrompt: { type: Type.STRING, description: "Markdown code block with the fix." },
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
   * Real-time Chat Intelligence for Sales & Recovery
   */
  async analyzeChatContext(messages: WhatsAppLogEntry[], templates: WhatsAppTemplate[], customerName: string): Promise<AiChatInsight> {
    const ai = getAI();
    if (!ai) return { intent: "unknown", tone: "neutral", suggestedReply: "Hello" };

    try {
        const response = await ai.models.generateContent({
            model: FLASH_MODEL,
            contents: `Analyze jewelry customer chat. 
            Customer: ${customerName}
            History: ${JSON.stringify(messages.slice(-8))}
            Available Action Templates: ${JSON.stringify(templates.map(t => ({ id: t.id, name: t.name, content: t.content })))}`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        intent: { type: Type.STRING, description: "Customer's goal (e.g., asking for price, complaining about delay, confirming payment)" },
                        tone: { type: Type.STRING, description: "Sentiment (e.g., impatient, grateful, suspicious)" },
                        suggestedReply: { type: Type.STRING, description: "A highly personal, luxury-standard response draft" },
                        recommendedTemplateId: { type: Type.STRING, description: "The ID of the meta template most suitable for this context" }
                    },
                    required: ["intent", "tone", "suggestedReply"]
                }
            }
        });
        return JSON.parse(response.text);
    } catch (e) { return { intent: "unknown", tone: "neutral", suggestedReply: "I'm checking your order details now." }; }
  },

  /**
   * Generative Architect for Psychographic Templates
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
        contents: `Architect a high-converting WhatsApp template for a luxury jewelry business.
        Context: ${prompt}
        
        Rules:
        1. Use {{1}}, {{2}} for variables.
        2. Tone must be professional and high-end.
        3. Category must be Meta compliant.`,
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
   * Advanced Strategic Nudge Generation (The "Brain" of Debt Recovery)
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
    const rateDiff = goldRate - order.goldRateAtBooking;

    const response = await ai.models.generateContent({
        model: PRO_MODEL,
        contents: `Generate a payment collection strategy.
        Customer: ${order.customerName}
        Order ID: ${order.id}
        Status: ${type}
        Risk Profile: ${riskProfile}
        Balance Due: ₹${balance}
        Gold Price Change: ₹${rateDiff}/g since booking.
        
        Strategy Goal: Secure payment while maintaining relationship. Use 'LOSS_AVERSION' if gold rate is rising. Use 'EMPATHY' if regular customer.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    tone: { type: Type.STRING, enum: ['POLITE', 'FIRM', 'URGENT', 'ENCOURAGING'] },
                    reasoning: { type: Type.STRING },
                    templateId: { type: Type.STRING },
                    variables: { type: Type.ARRAY, items: { type: Type.STRING } },
                    message: { type: Type.STRING, description: "Raw message for SMS if template is not used" }
                },
                required: ["tone", "reasoning", "templateId", "variables", "message"]
            }
        }
    });
    return JSON.parse(response.text);
  },

  /**
   * Auto-Fix Rejected Templates
   */
  async fixRejectedTemplate(template: WhatsAppTemplate): Promise<{ 
      fixedName: string, 
      fixedContent: string, 
      category: MetaCategory, 
      variableExamples: string[], 
      diagnosis: string 
  }> {
    const ai = getAI();
    if (!ai) throw new Error("AI Offline");

    const variableCount = (template.content.match(/{{[0-9]+}}/g) || []).length;

    const response = await ai.models.generateContent({
        model: PRO_MODEL,
        contents: `You are a Meta WhatsApp Template Compliance Officer.
        
        Problem: A template was rejected by Meta.
        Template Name: ${template.name}
        Content: "${template.content}"
        Rejection Reason: ${template.rejectionReason || 'Format/Policy Violation'}
        Current Category: ${template.category}
        Target Variable Count: ${variableCount} (Preserve this count if possible, unless it causes the issue).

        TASKS:
        1. If reason is "Promotional", REWRITE content to be purely transactional/informational. Remove words like "offer", "sale", "chance", "happy to".
        2. If reason is "Format", ensure variables {{1}} are correctly placed.
        3. If category is wrong, suggest the correct one (UTILITY vs MARKETING).
        4. Keep the tone professional for a Jewelry brand.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    fixedName: { type: Type.STRING, description: "Keep strictly snake_case, lowercase" },
                    fixedContent: { type: Type.STRING },
                    category: { type: Type.STRING, enum: ['UTILITY', 'MARKETING', 'AUTHENTICATION'] },
                    variableExamples: { type: Type.ARRAY, items: { type: Type.STRING } },
                    diagnosis: { type: Type.STRING, description: "Explain what was fixed" }
                },
                required: ["fixedName", "fixedContent", "category", "diagnosis"]
            }
        }
    });
    return JSON.parse(response.text);
  },

  /**
   * Smart Payment Plan Generation
   */
  async generatePaymentPlan(prompt: string): Promise<Partial<PaymentPlanTemplate>> {
    const ai = getAI();
    if (!ai) return { name: "Manual Plan", months: 6 };

    const response = await ai.models.generateContent({
        model: FLASH_MODEL,
        contents: `Create a jewelry payment installment scheme based on: ${prompt}`,
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
   * Template Structural Compliance Check (Internal)
   */
  async validateAndFixTemplate(requiredContent: string, requiredName: string, category: string): Promise<{ isCompliant: boolean, optimizedContent: string, explanation: string }> {
    const ai = getAI();
    if (!ai) return { isCompliant: true, optimizedContent: requiredContent, explanation: "Validation bypassed." };

    try {
        const response = await ai.models.generateContent({
            model: FLASH_MODEL,
            contents: `Check compliance for Meta Template: ${requiredName} (${category}). Content: "${requiredContent}"
            
            If category is UTILITY, content MUST NOT contain promotional words (sale, offer, discount, buy now).
            If it violates, rewrite it to be neutral.`,
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
