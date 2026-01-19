import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Order } from '../types';

export const generateOrderPDF = (order: Order) => {
  const doc = new jsPDF();
  const margin = 15;
  let yPos = 20;

  // Header
  doc.setFontSize(22);
  doc.setTextColor(217, 119, 6); 
  doc.text("AuraGold Elite", margin, yPos);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("Bespoke Luxury Jewelry & Bullion", margin, yPos + 6);
  doc.text("Authorized Manufacturer & Retailer", margin, yPos + 11);

  // Invoice Details
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text(`Digital Agreement #: ${order.id}`, 140, yPos);
  doc.text(`Booking Date: ${new Date(order.createdAt).toLocaleDateString()}`, 140, yPos + 6);

  yPos += 30;

  // Customer Details
  doc.setDrawColor(200);
  doc.line(margin, yPos - 5, 195, yPos - 5);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Client Identification", margin, yPos);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  yPos += 6;
  doc.text(`Name: ${order.customerName}`, margin, yPos);
  doc.text(`Mobile: ${order.customerContact}`, margin, yPos + 5);
  doc.text(`Email: ${order.customerEmail || 'N/A'}`, margin, yPos + 10);

  yPos += 20;

  // Items Table
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Jewellery Specification", margin, yPos);
  yPos += 5;

  const itemRows = order.items.map(item => [
    `${item.category} (${item.metalColor} ${item.purity})\nStones: ${item.stoneEntries.length} items`,
    `${item.netWeight}g`,
    `${item.wastagePercentage}%`,
    `₹${item.stoneCharges.toLocaleString()}`,
    `₹${Math.round(item.finalAmount).toLocaleString()}`
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['Description & Detail', 'Net Wt', 'VA %', 'Stones', 'Gross Price']],
    body: itemRows,
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    styles: { fontSize: 8 },
    foot: [['', '', '', 'CART TOTAL:', `₹${Math.round(order.totalAmount).toLocaleString()}`]],
    footStyles: { fillColor: [248, 249, 250], textColor: 0, fontStyle: 'bold' }
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  // Old Gold Exchange Section (If exists)
  if (order.oldGoldExchange && order.oldGoldExchange.length > 0) {
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Old Gold Exchange Deduction", margin, yPos);
      yPos += 5;

      const exchangeRows = order.oldGoldExchange.map(e => [
          e.description,
          `${e.grossWeight}g`,
          `${e.purityPercent}%`,
          `₹${e.rate}`,
          `₹${Math.round(e.totalValue).toLocaleString()}`
      ]);

      autoTable(doc, {
          startY: yPos,
          head: [['Exchanged Item', 'Gross Wt', 'Purity', 'Rate', 'Valuation']],
          body: exchangeRows,
          theme: 'striped',
          headStyles: { fillColor: [5, 150, 105], textColor: 255 },
          styles: { fontSize: 8 },
          foot: [['', '', '', 'TOTAL DEDUCTION:', `₹${Math.round(order.exchangeValue).toLocaleString()}`]],
          footStyles: { fillColor: [240, 253, 244], textColor: [6, 95, 70], fontStyle: 'bold' }
      });
      yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // Net Summary
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.5);
  doc.rect(margin, yPos, 180, 15);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("NET PAYABLE AMOUNT:", margin + 5, yPos + 10);
  doc.text(`INR ${Math.round(order.netPayable).toLocaleString()}`, 145, yPos + 10);
  yPos += 25;

  // Payment Plan
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Contracted Payment Schedule", margin, yPos);
  yPos += 5;

  const planRows = order.paymentPlan.milestones.map((m, idx) => [
    m.description || (idx === 0 ? 'Advance' : `Installment ${idx}`),
    new Date(m.dueDate).toLocaleDateString(),
    `₹${m.targetAmount.toLocaleString()}`,
    m.status
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['Phase', 'Due Date', 'Target Amount', 'Current Status']],
    body: planRows,
    theme: 'grid',
    styles: { fontSize: 8 },
    headStyles: { fillColor: [217, 119, 6] }
  });

  yPos = (doc as any).lastAutoTable.finalY + 20;

  // Terms & Signatures
  if (yPos > 240) { doc.addPage(); yPos = 20; }

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Contractual Terms & Conditions", margin, yPos);
  yPos += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100);

  const terms = [
    "1. RATE PROTECTION: Gold rate is locked only for payments cleared on or before scheduled dates.",
    "2. LAPSE CLAUSE: Late payments exceeding 48 hours revoke rate protection; balance recalculated at market price.",
    "3. WEIGHT VARIATION: Final item weight may vary by +/- 3%. Difference settled during handover.",
    "4. DELIVERY: Physical handover strictly after 100% financial settlement.",
    "5. KYC: Government ID (PAN/Aadhar) mandatory for valuations above INR 2,00,000."
  ];

  terms.forEach(term => { doc.text(term, margin, yPos); yPos += 4; });

  yPos += 15;
  doc.setDrawColor(0);
  doc.line(margin, yPos, margin + 50, yPos);
  doc.line(140, yPos, 190, yPos);
  doc.text("Authorized Signatory", margin, yPos + 4);
  doc.text("Client Signature", 140, yPos + 4);

  doc.save(`AuraGold_Contract_${order.id}.pdf`);
};
