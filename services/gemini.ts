
import { GoogleGenAI } from "@google/genai";
import { Order } from "../types";

export const getRecoveryStrategy = async (order: Order, currentRate: number) => {
  // Use correct API key initialization
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  // Calculate pending amount correctly
  const totalPaid = order.payments.reduce((acc, p) => acc + p.amount, 0);
  const pendingAmount = order.totalAmount - totalPaid;
  
  // Access gold rate from payment plan or fallback
  const goldRateBooked = order.paymentPlan?.protectionRateBooked || order.goldRateAtBooking || 0;

  const prompt = `
    Analyze this jewellery order for a luxury gold seller:
    Customer: ${order.customerName}
    Balance Due: ₹${pendingAmount}
    Status: ${order.status}
    Gold Rate when booked: ₹${goldRateBooked}
    Current Market Gold Rate: ₹${currentRate}

    Provide a JSON response with:
    1. "tone": "POLITE" | "FIRM" | "URGENT"
    2. "message": "A persuasive WhatsApp message"
    3. "strategy": "One sentence reasoning"
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    // Use .text property instead of .text() method
    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("AI Error:", error);
    return { tone: 'POLITE', message: `Hello ${order.customerName}, just a reminder regarding your balance.`, strategy: 'Fallback due to AI error' };
  }
};
