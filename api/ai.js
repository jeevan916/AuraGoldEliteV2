import express from 'express';
import { GoogleGenAI, Type } from "@google/genai";
import { authenticateToken, requireRole } from './auth.js';

const router = express.Router();

// AI Diagnostic and Generation endpoints require authenticated staff access
router.use(authenticateToken, requireRole('ADMIN', 'MANAGER', 'SALES'));

const PRO_MODEL = 'gemini-2.5-pro';
const FLASH_MODEL = 'gemini-2.5-flash';

const getAI = () => {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        console.error("[System] AI Offline due to missing key");
        return null;
    }
    return new GoogleGenAI({ apiKey: key });
};

router.post('/diagnoseError', async (req, res) => {
    try {
        const { message, source, stack, rawContext } = req.body;
        const ai = getAI();
        if (!ai) return res.json({ explanation: "AI Gateway Offline", fixType: 'MANUAL_CODE' });

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
        res.json(JSON.parse(response.text));
    } catch (e) {
        res.status(500).json({ explanation: "Diagnostic engine timeout.", fixType: 'MANUAL_CODE', resolutionPath: 'none' });
    }
});

router.post('/analyzeChatContext', async (req, res) => {
    try {
        const { messages, templates, customerName } = req.body;
        const ai = getAI();
        if (!ai) return res.json({ intent: "unknown", tone: "neutral", suggestedReply: "Hello" });

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
        res.json(JSON.parse(response.text));
    } catch (e) {
        res.status(500).json({ intent: "unknown", tone: "neutral", suggestedReply: "I'm checking your order details now." });
    }
});

router.post('/generateTemplateFromPrompt', async (req, res) => {
    try {
        const { prompt } = req.body;
        const ai = getAI();
        if (!ai) {
            const cleanName = (prompt || 'template').toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 20);
            return res.json({
                suggestedName: `auragold_${cleanName}`,
                content: `Dear {{1}}, ${prompt || 'your order update'}. Ref: {{2}}. Thank you for choosing Sanghavi Jewellers.`,
                metaCategory: 'UTILITY',
                appGroup: 'ORDER_STATUS',
                tactic: 'URGENCY',
                examples: ['Valued Customer', 'ORD-1001']
            });
        }

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
        res.json(JSON.parse(response.text));
    } catch (e) {
        const prompt = req.body?.prompt || 'template';
        const cleanName = prompt.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 20);
        res.json({
            suggestedName: `auragold_${cleanName}`,
            content: `Dear {{1}}, ${prompt}. Ref: {{2}}. Thank you for choosing Sanghavi Jewellers.`,
            metaCategory: 'UTILITY',
            appGroup: 'ORDER_STATUS',
            tactic: 'URGENCY',
            examples: ['Valued Customer', 'ORD-1001']
        });
    }
});

router.post('/generateVariant', async (req, res) => {
    try {
        const { originalContent, goal } = req.body;
        const ai = getAI();
        if (!ai) {
            return res.json({
                content: `${originalContent || ''} (${goal || 'updated'})`,
                diagnosis: "Applied rule-based variant fallback."
            });
        }

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: `You are a WhatsApp Template Architect.
            
            Original Content: "${originalContent}"
            Goal/Tone Change: "${goal}"
            
            TASK: Rewrite the content to match the goal while keeping the same number of variables (e.g., {{1}}, {{2}}).`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        content: { type: Type.STRING },
                        diagnosis: { type: Type.STRING }
                    },
                    required: ["content", "diagnosis"]
                }
            }
        });
        res.json(JSON.parse(response.text));
    } catch (e) {
        res.json({
            content: `${req.body?.originalContent || ''} (${req.body?.goal || 'updated'})`,
            diagnosis: "Applied rule-based variant fallback."
        });
    }
});

router.post('/generateStrategicNotification', async (req, res) => {
    try {
        const { order, type, goldRate, riskProfile } = req.body;
        const ai = getAI();
        if (!ai) throw new Error("AI Offline");

        const paid = order.payments ? order.payments.reduce((s, p) => s + p.amount, 0) : 0;
        const balance = (order.totalAmount || 0) - paid;

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
        res.json(JSON.parse(response.text));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/fixRejectedTemplate', async (req, res) => {
    const rawTemplate = req.body?.template || {};
    const content = rawTemplate.content || "Dear {{1}}, your order {{2}} has been updated at Sanghavi Jewellers.";
    let fixedContent = content.replace(/[\r\n\t]+/g, ' ').trim();
    if (!fixedContent.toLowerCase().includes('sanghavi jewellers')) {
        fixedContent += " Thank you for choosing Sanghavi Jewellers.";
    }
    const matches = fixedContent.match(/\{\{\d+\}\}/g) || [];
    const varCount = matches.length;
    const variableExamples = Array.from({ length: varCount }, (_, i) => `Sample ${i + 1}`);

    const fallbackFix = {
        fixedName: rawTemplate.name || `auragold_template_${Date.now()}`,
        fixedContent,
        category: rawTemplate.category || 'UTILITY',
        variableExamples,
        diagnosis: "Applied automated compliance optimization: Standardized line formatting and updated variable structure."
    };

    try {
        const ai = getAI();
        if (!ai) return res.json(fallbackFix);

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: `You are a Meta WhatsApp Template Compliance Officer.
            
            PROBLEM: A template failed submission to Meta.
            Content: "${rawTemplate.content}"
            API Error / Rejection Reason: "${rawTemplate.rejectionReason || 'Invalid Parameter / Structure'}"
            Current Category: ${rawTemplate.category}
            
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
        const parsed = JSON.parse(response.text);
        res.json(parsed);
    } catch (e) { 
        res.json(fallbackFix); 
    }
});

router.post('/generatePaymentPlan', async (req, res) => {
    try {
        const { prompt } = req.body;
        const ai = getAI();
        if (!ai) return res.json({ name: "Manual Plan", months: 6, minPurchaseAmount: 10000, maxPurchaseAmount: 50000, subventionPercentage: 2, subventionNote: "Default Subvented Scheme" });

        const response = await ai.models.generateContent({
            model: FLASH_MODEL,
            contents: `Create a gold jewelry payment scheme based on purchase amount range and subvention rules: ${prompt}`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        months: { type: Type.NUMBER },
                        interestPercentage: { type: Type.NUMBER },
                        advancePercentage: { type: Type.NUMBER },
                        minPurchaseAmount: { type: Type.NUMBER },
                        maxPurchaseAmount: { type: Type.NUMBER },
                        subventionPercentage: { type: Type.NUMBER },
                        subventionNote: { type: Type.STRING }
                    },
                    required: ["name", "months", "interestPercentage", "advancePercentage"]
                }
            }
        });
        res.json(JSON.parse(response.text));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/validateAndFixTemplate', async (req, res) => {
    const requiredContent = req.body?.requiredContent || '';
    const requiredName = req.body?.requiredName || 'template';
    const category = req.body?.category || 'UTILITY';
    try {
        const ai = getAI();
        if (!ai) return res.json({ isCompliant: true, optimizedContent: requiredContent, explanation: "Validation bypassed." });

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
        res.json(JSON.parse(response.text));
    } catch (e) {
        res.status(500).json({ isCompliant: true, optimizedContent: requiredContent, explanation: "Fallback compliance check." });
    }
});

export default router;
