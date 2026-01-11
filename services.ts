
import { GoogleGenAI } from "@google/genai";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Order, JewelryDetail, GlobalSettings } from './types';

// AI Intelligence Service
export const aiService = {
  async getRecoveryStrategy(order: Order, currentRate: number) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    const paid = order.payments.reduce((sum, p) => sum + p.amount, 0);
    const balance = order.totalAmount - paid;
    
    const prompt = `
      Act as a luxury jewellery store manager. 
      Customer: ${order.customerName} owes ₹${balance}. 
      Order booked at ₹${order.goldRateAtBooking}/g. Current market: ₹${currentRate}/g. 
      Analyze the urgency and create a polite but firm WhatsApp reminder.
      Return JSON: { "message": "string", "tone": "POLITE" | "FIRM" | "URGENT" }
    `;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      return JSON.parse(response.text || '{}');
    } catch (error) {
      return { message: `Hi ${order.customerName}, a friendly reminder regarding your balance.`, tone: 'POLITE' };
    }
  }
};

// PDF Export Service
export const pdfService = {
  generateInvoice(order: Order) {
    const doc = new jsPDF();
    const paid = order.payments.reduce((sum, p) => sum + p.amount, 0);

    doc.setFontSize(22);
    doc.setTextColor(180, 140, 40); // Gold tone
    doc.text("AuraGold Elite", 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Order ID: ${order.id}`, 14, 28);
    doc.text(`Customer: ${order.customerName} (${order.customerContact})`, 14, 34);
    doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`, 14, 40);

    const body = order.items.map(i => [
      i.category,
      `${i.netWeight}g`,
      i.purity,
      `${i.wastagePercentage}%`,
      `₹${i.finalAmount.toLocaleString()}`
    ]);

    autoTable(doc, {
      startY: 50,
      head: [['Item', 'Weight', 'Purity', 'VA%', 'Subtotal']],
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [180, 140, 40] }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.text(`Total Amount: ₹${order.totalAmount.toLocaleString()}`, 140, finalY);
    doc.text(`Paid: ₹${paid.toLocaleString()}`, 140, finalY + 6);
    doc.setFont("helvetica", "bold");
    doc.text(`Balance: ₹${(order.totalAmount - paid).toLocaleString()}`, 140, finalY + 12);

    doc.save(`AuraGold_${order.id}.pdf`);
  }
};

// Financial Engine
export const calcItemPrice = (item: Partial<JewelryDetail>, settings: GlobalSettings): number => {
  const rate = item.purity === '24K' ? settings.currentGoldRate24K : item.purity === '22K' ? settings.currentGoldRate22K : settings.currentGoldRate18K;
  const metalValue = (item.netWeight || 0) * rate;
  const wastage = metalValue * ((item.wastagePercentage || 0) / 100);
  const labor = (item.makingChargesPerGram || 0) * (item.netWeight || 0);
  const base = metalValue + wastage + labor + (item.stoneCharges || 0);
  return base + (base * (settings.defaultTaxRate / 100));
};
