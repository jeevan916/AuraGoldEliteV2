
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Order } from '../types';

export const generateOrderPDF = (order: Order) => {
  const doc = new jsPDF();
  const margin = 15;
  let yPos = 20;

  // Header
  doc.setFontSize(22);
  doc.setTextColor(217, 119, 6); // Amber-600
  doc.text("AuraGold", margin, yPos);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("Luxury Jewelry & Custom Designs", margin, yPos + 6);
  doc.text("Mumbai, India | +91 98765 43210", margin, yPos + 11);

  // Invoice Details
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text(`Order Agreement #: ${order.id}`, 140, yPos);
  doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`, 140, yPos + 6);

  yPos += 30;

  // Customer Details
  doc.setDrawColor(200);
  doc.line(margin, yPos - 5, 195, yPos - 5);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Customer Details", margin, yPos);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  yPos += 6;
  doc.text(`Name: ${order.customerName}`, margin, yPos);
  // Fix: Order uses customerContact instead of phone for consistency with Form
  doc.text(`Contact: ${order.customerContact}`, margin, yPos + 5);
  // Fix: Order uses customerEmail
  doc.text(`Email: ${order.customerEmail || 'N/A'}`, margin, yPos + 10);

  yPos += 20;

  // Items Table
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Order Items", margin, yPos);
  yPos += 5;

  const itemRows = order.items.map(item => [
    // Fix: JewelryDetail properties (metalColor, purity)
    `${item.category} (${item.metalColor} ${item.purity})`,
    `${item.netWeight}g`,
    // Fix: wastagePercentage instead of wastagePercent
    `${item.wastagePercentage}%`,
    `₹${item.stoneCharges}`,
    // Fix: finalAmount instead of priceAtBooking
    `₹${item.finalAmount.toLocaleString()}`
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['Item Description', 'Net Wt', 'VA%', 'Stone', 'Total Price']],
    body: itemRows,
    theme: 'grid',
    headStyles: { fillColor: [217, 119, 6], textColor: 255 },
    styles: { fontSize: 9 },
    foot: [['', '', '', 'GRAND TOTAL:', `₹${order.totalAmount.toLocaleString()}`]],
    footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' }
  });

  yPos = (doc as any).lastAutoTable.finalY + 20;

  // Payment Plan
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Payment Schedule Agreement", margin, yPos);
  yPos += 5;

  // Fix: Order uses paymentPlan.milestones
  const planRows = order.paymentPlan.milestones.map((m, idx) => [
    idx === 0 ? 'Advance / Downpayment' : `Installment ${idx}`,
    new Date(m.dueDate).toLocaleDateString(),
    `₹${m.targetAmount.toLocaleString()}`,
    m.status
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['Milestone', 'Due Date', 'Amount', 'Status']],
    body: planRows,
    theme: 'striped',
    styles: { fontSize: 9 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 20;

  // Terms & Legal
  if (yPos > 240) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Terms & Conditions", margin, yPos);
  yPos += 8;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80);

  const terms = [
    "1. Gold Rate Protection: Locked for the duration of the plan up to the cap limit.",
    "2. Cancellations: Deduction on labor/making charges incurred.",
    "3. Late Payments: Penalty may apply after 7 days overdue.",
    "4. Delivery: Handed over only after 100% settlement.",
    "5. Weight: Final weight may vary +/- 5%; differences adjusted in final payment."
  ];

  terms.forEach(term => {
    doc.text(term, margin, yPos);
    yPos += 5;
  });

  // Signatures
  yPos += 20;
  if (yPos > 260) {
    doc.addPage();
    yPos = 40;
  }

  doc.setDrawColor(0);
  doc.line(margin, yPos, margin + 60, yPos);
  doc.line(130, yPos, 190, yPos);
  
  doc.text("Customer Signature", margin, yPos + 5);
  doc.text("Authorized Signatory (AuraGold)", 130, yPos + 5);

  doc.save(`AuraGold_Agreement_${order.id}.pdf`);
};
