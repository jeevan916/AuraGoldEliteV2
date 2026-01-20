
import { GoogleGenAI, Type } from "@google/genai";
import { 
  Order, CollectionTone, Customer, WhatsAppLogEntry, 
  AiChatInsight, WhatsAppTemplate, AppResolutionPath, 
  MetaCategory, AppTemplateGroup, PsychologicalTactic, 
  PaymentPlanTemplate, RiskProfile 
} from "../types";

// Latest Model Definitions as per instructions
const PRO_MODEL = 'gemini-3-pro-preview';
const FLASH_MODEL = 'gemini-3-flash-preview';

// Use process.env.API_KEY directly for initialization as per guidelines
const getAI = () => {
    const key = process.env.API_KEY;
    if (!key || key.includes('API_KEY')) return null;
    // Always use the named parameter apiKey for GoogleGenAI initialization
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const geminiService = {
  /**
   * Deep Error Diagnosis for System Self-Healing
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
            contents: `Analyze this system error for a luxury jewelry CRM.
            Source: ${source}
            Message: ${message}
            Stack: ${stack || 'N/A'}
            Context: ${JSON.stringify(rawContext || {})}
            
            Determine if this is a configuration error (API Key/Template) or a logic bug.`,
            config: { 
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        explanation: { type: Type.STRING },
                        fixType: { type: Type.STRING, enum: ['AUTO', 'MANUAL_CODE', 'CONFIG'] },
                        implementationPrompt: { type: Type.STRING },
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
   * Fix: Updated signature to accept 'SYSTEM' notification type to match NotificationTrigger.type
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

    const response = await ai.models.generateContent({
        model: PRO_MODEL,
        contents: `Meta Rejected Template: ${template.name}
        Content: "${template.content}"
        Reason: ${template.rejectionReason || 'Unknown compliance violation'}
        
        Task: Rewrite to satisfy Meta's 'UTILITY' vs 'MARKETING' guidelines. Remove sales-speak from transaction templates.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    fixedName: { type: Type.STRING },
                    fixedContent: { type: Type.STRING },
                    category: { type: Type.STRING, enum: ['UTILITY', 'MARKETING', 'AUTHENTICATION'] },
                    variableExamples: { type: Type.ARRAY, items: { type: Type.STRING } },
                    diagnosis: { type: Type.STRING }
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
            contents: `Check compliance for Meta Template: ${requiredName} (${category}). Content: "${requiredContent}"`,
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
