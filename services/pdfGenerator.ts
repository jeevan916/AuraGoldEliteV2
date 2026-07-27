import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { Order } from '../types';

const fetchImageAsBase64 = async (url: string): Promise<string> => {
  if (!url) return '';
  if (url.startsWith('data:')) return url; // Already base64
  try {
    const absoluteUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
    const response = await fetch(absoluteUrl);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.error("Failed to fetch image as base64:", e);
    return url; // fallback
  }
};

const ensureBase64Photos = async (order: Order): Promise<Order> => {
  try {
    const cloned = JSON.parse(JSON.stringify(order)) as Order;
    if (cloned.items) {
      for (const item of cloned.items) {
        if (item.photoUrls && Array.isArray(item.photoUrls)) {
          const promises = item.photoUrls.map(url => fetchImageAsBase64(url));
          item.photoUrls = await Promise.all(promises);
        }
        if (item.readyPhotoUrls && Array.isArray(item.readyPhotoUrls)) {
          const promises = item.readyPhotoUrls.map(url => fetchImageAsBase64(url));
          item.readyPhotoUrls = await Promise.all(promises);
        }
      }
    }
    return cloned;
  } catch (err) {
    console.error("Error in ensureBase64Photos:", err);
    return order;
  }
};

export const generateOrderPDF = async (originalOrder: Order) => {
  const order = await ensureBase64Photos(originalOrder);
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
  doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString('en-IN')}`, 140, yPos + 6);

  try {
      const url = `${window.location.origin}/?order=${order.shareToken}`;
      const qrDataUrl = await QRCode.toDataURL(url);
      doc.addImage(qrDataUrl, 'PNG', 160, 20, 30, 30);
  } catch (e) {
      console.error("Failed to generate QR Code", e);
  }

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

  const itemsSubtotal1 = order.items.reduce((s, i) => s + i.finalAmount, 0);
  const discount1 = order.discountAmount || 0;
  const netLateFee1 = Math.max(0, (order.lateFeeAmount || 0) - (order.lateFeeWaived || 0));
  const grandTotal1 = Math.max(0, itemsSubtotal1 - discount1 + netLateFee1);

  const footRows1: string[][] = [
    ['', '', '', 'Subtotal:', `₹${Math.round(itemsSubtotal1).toLocaleString('en-IN')}`]
  ];
  if (discount1 > 0) {
    footRows1.push(['', '', '', 'Discount:', `-₹${Math.round(discount1).toLocaleString('en-IN')}`]);
  }
  if (netLateFee1 > 0) {
    footRows1.push(['', '', '', 'Late Fee / Overdue:', `+₹${Math.round(netLateFee1).toLocaleString('en-IN')}`]);
  }
  footRows1.push(['', '', '', 'GRAND TOTAL:', `₹${Math.round(grandTotal1).toLocaleString('en-IN')}`]);

  autoTable(doc, {
    startY: yPos,
    head: [['Item Description', 'Net Wt', 'VA%', 'Stone', 'Total Price']],
    body: itemRows,
    theme: 'grid',
    headStyles: { fillColor: [217, 119, 6], textColor: 255 },
    styles: { fontSize: 9 },
    foot: footRows1 as any,
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
    new Date(m.dueDate).toLocaleDateString('en-IN'),
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

  // Payment History
  if (order.payments && order.payments.length > 0) {
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Payment History", margin, yPos);
    yPos += 5;

    const paymentRows = order.payments.map(p => [
      new Date(p.date).toLocaleDateString('en-IN'),
      p.method,
      `₹${Math.round(p.amount).toLocaleString('en-IN')}`,
      p.note || ''
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Date', 'Method', 'Amount', 'Notes']],
      body: paymentRows,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129], textColor: 255 }, // Emerald green
      styles: { fontSize: 9 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 20;
  }

  // Visual Specifications & Design Reference Gallery
  const itemsWithPhotos = order.items.filter(item => item.photoUrls && item.photoUrls.length > 0);
  if (itemsWithPhotos.length > 0) {
    doc.addPage();
    yPos = 20;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(217, 119, 6); // Amber-600
    doc.text("Visual Design Specifications & Gallery", margin, yPos);
    yPos += 4;

    doc.setDrawColor(230, 230, 230);
    doc.line(margin, yPos, 195, yPos);
    yPos += 8;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text("The following images and reference designs represent the approved custom specifications for this order.", margin, yPos);
    yPos += 10;

    for (const item of itemsWithPhotos) {
      if (yPos > 220) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59); // Slate-800
      doc.text(`${item.category} (${item.metalColor} ${item.purity})`, margin, yPos);
      yPos += 5;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80);
      doc.text(`Net Weight: ${item.netWeight}g | Making Charges: ₹${item.makingChargesPerGram}/g | VA%: ${item.wastagePercentage}%`, margin, yPos);
      yPos += 4;

      if (item.customizationDetails) {
        const customText = `Customization: ${item.customizationDetails}`;
        const splitCustomText = doc.splitTextToSize(customText, 180);
        doc.text(splitCustomText, margin, yPos);
        yPos += (splitCustomText.length * 4) + 2;
      } else {
        yPos += 2;
      }

      let xPos = margin;
      const imgWidth = 40;
      const imgHeight = 40;
      const gap = 6;

      for (const photo of item.photoUrls) {
        if (xPos + imgWidth > 195) {
          xPos = margin;
          yPos += imgHeight + gap;
          if (yPos > 220) {
            doc.addPage();
            yPos = 20;
          }
        }

        try {
          doc.addImage(photo, 'JPEG', xPos, yPos, imgWidth, imgHeight);
          doc.setDrawColor(218, 218, 218);
          doc.rect(xPos, yPos, imgWidth, imgHeight, 'S');
        } catch (e) {
          console.error("Failed to add image to PDF", e);
          doc.setDrawColor(230);
          doc.setFillColor(245, 245, 245);
          doc.rect(xPos, yPos, imgWidth, imgHeight, 'FD');
          doc.setFontSize(8);
          doc.setTextColor(150);
          doc.text("Image Error", xPos + 10, yPos + 22);
        }

        xPos += imgWidth + gap;
      }

      yPos += imgHeight + 12;
    }
  }

  // Terms & Legal
  if (yPos > 180) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("Terms & Conditions & Booking Policy", margin, yPos);
  yPos += 6;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80);

  const terms = [
    "1. Gold Rate Protection & Lock: The booked gold rate of ₹" + Math.round(order.goldRateAtBooking).toLocaleString('en-IN') + "/g is fully locked and protected for the duration of this plan. To preserve this rate lock, you commit to paying each milestone on or before its due date.",
    "2. Rate Protection Suspension: Failure to pay any installment on time (subject to a standard 24-hour grace period) compromises your rate lock. The remaining gold weight may immediately revert to current market rates or carry a market adjustment surcharge.",
    "3. Late Fees & Volatility Surcharges: Unpaid milestones past their respective due dates trigger an active late fee of ₹250 per milestone to cover gold market volatility risk.",
    "4. Workshop Production Hold: Since custom jewelry is crafted specifically for you, crafting and workshop labor will be paused immediately if any milestone payment remains overdue past 5 days.",
    "5. Cancellations & Deduction Policy: Cancellation of this order at any point voids the gold rate lock. Cancellations are subject to a deduction fee of up to 10% of total order value to cover actual design labor, raw gold melting loss, and metal processing costs incurred.",
    "6. Delivery & Actual Weight Settlement: Handover of completed custom jewelry will only occur after 100% plan settlement. The final weight of custom pieces may vary up to +/- 5% from estimated booking weights; any differences will be adjusted in the final settlement."
  ];

  for (const term of terms) {
    const splitTerm = doc.splitTextToSize(term, 180);
    if (yPos + (splitTerm.length * 4) > 275) {
      doc.addPage();
      yPos = 20;
    }
    doc.text(splitTerm, margin, yPos);
    yPos += (splitTerm.length * 4.5) + 2;
  }

  // Signatures
  yPos += 15;
  if (yPos > 260) {
    doc.addPage();
    yPos = 40;
  }

  doc.setDrawColor(200);
  doc.line(margin, yPos, margin + 60, yPos);
  doc.line(130, yPos, 190, yPos);
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100);
  doc.text("Customer Signature", margin, yPos + 5);
  doc.text("Authorized Signatory (AuraGold)", 130, yPos + 5);

  doc.save(`AuraGold_Agreement_${order.id}.pdf`);
};

export const generateReceiptPDF = async (originalOrder: Order) => {
  const order = await ensureBase64Photos(originalOrder);
  const doc = new jsPDF();
  const margin = 15;
  let yPos = 20;

  // Header
  doc.setFontSize(22);
  doc.setTextColor(217, 119, 6);
  doc.text("AuraGold - Official Receipt", margin, yPos);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("Luxury Jewelry & Custom Designs", margin, yPos + 6);
  doc.text("Mumbai, India | +91 98765 43210", margin, yPos + 11);

  // Invoice Details
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text(`Receipt #: ${order.id}`, 140, yPos);
  doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 140, yPos + 6);

  try {
      const url = `${window.location.origin}/?order=${order.shareToken}`;
      const qrDataUrl = await QRCode.toDataURL(url);
      doc.addImage(qrDataUrl, 'PNG', 160, 20, 30, 30);
  } catch (e) {
      console.error("Failed to generate QR Code", e);
  }

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
  doc.text(`Contact: ${order.customerContact}`, margin, yPos + 5);
  doc.text(`Email: ${order.customerEmail || 'N/A'}`, margin, yPos + 10);

  yPos += 15;

  // Cost Breakdown
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Cost Breakdown", margin, yPos);
  yPos += 5;

  const itemRows = order.items.map(item => [
    `${item.category} (${item.metalColor} ${item.purity})`,
    `${item.netWeight}g`,
    `${item.wastagePercentage}%`,
    `₹${item.stoneCharges}`,
    `₹${Math.round(item.finalAmount).toLocaleString('en-IN')}`
  ]);

  const itemsSubtotal2 = order.items.reduce((s, i) => s + i.finalAmount, 0);
  const discount2 = order.discountAmount || 0;
  const netLateFee2 = Math.max(0, (order.lateFeeAmount || 0) - (order.lateFeeWaived || 0));
  const grandTotal2 = Math.max(0, itemsSubtotal2 - discount2 + netLateFee2);

  const footRows2: string[][] = [
    ['', '', '', 'Subtotal:', `₹${Math.round(itemsSubtotal2).toLocaleString('en-IN')}`]
  ];
  if (discount2 > 0) {
    footRows2.push(['', '', '', 'Discount:', `-₹${Math.round(discount2).toLocaleString('en-IN')}`]);
  }
  if (netLateFee2 > 0) {
    footRows2.push(['', '', '', 'Late Fee / Overdue:', `+₹${Math.round(netLateFee2).toLocaleString('en-IN')}`]);
  }
  footRows2.push(['', '', '', 'GRAND TOTAL:', `₹${Math.round(grandTotal2).toLocaleString('en-IN')}`]);

  autoTable(doc, {
    startY: yPos,
    head: [['Item Description', 'Net Wt', 'VA%', 'Stone', 'Total Price']],
    body: itemRows,
    theme: 'grid',
    headStyles: { fillColor: [217, 119, 6], textColor: 255 },
    styles: { fontSize: 9 },
    foot: footRows2 as any,
    footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' }
  });

  yPos = (doc as any).lastAutoTable.finalY + 20;

  // Payment Plan
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Payment Schedule", margin, yPos);
  yPos += 5;

  const planRows = order.paymentPlan.milestones.map((m, idx) => [
    idx === 0 ? 'Advance / Downpayment' : `Installment ${idx}`,
    new Date(m.dueDate).toLocaleDateString('en-IN'),
    `₹${Math.round(m.targetAmount).toLocaleString('en-IN')}`,
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

  // Payment History
  if (order.payments && order.payments.length > 0) {
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Payment History", margin, yPos);
    yPos += 5;

    const paymentRows = order.payments.map(p => [
      new Date(p.date).toLocaleDateString('en-IN'),
      p.method,
      `₹${Math.round(p.amount).toLocaleString('en-IN')}`,
      p.note || ''
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Date', 'Method', 'Amount', 'Notes']],
      body: paymentRows,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129], textColor: 255 }, // Emerald green
      styles: { fontSize: 9 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 20;
  }

  // Visual Specifications & Design Reference Gallery
  const itemsWithPhotos = order.items.filter(item => item.photoUrls && item.photoUrls.length > 0);
  if (itemsWithPhotos.length > 0) {
    doc.addPage();
    yPos = 20;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(217, 119, 6); // Amber-600
    doc.text("Visual Design Specifications & Gallery", margin, yPos);
    yPos += 4;

    doc.setDrawColor(230, 230, 230);
    doc.line(margin, yPos, 195, yPos);
    yPos += 8;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text("The following images represent the approved custom specifications and design gallery associated with this order.", margin, yPos);
    yPos += 10;

    for (const item of itemsWithPhotos) {
      if (yPos > 220) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59); // Slate-800
      doc.text(`${item.category} (${item.metalColor} ${item.purity})`, margin, yPos);
      yPos += 5;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80);
      doc.text(`Net Weight: ${item.netWeight}g | Making Charges: ₹${item.makingChargesPerGram}/g | VA%: ${item.wastagePercentage}%`, margin, yPos);
      yPos += 4;

      if (item.customizationDetails) {
        const customText = `Customization: ${item.customizationDetails}`;
        const splitCustomText = doc.splitTextToSize(customText, 180);
        doc.text(splitCustomText, margin, yPos);
        yPos += (splitCustomText.length * 4) + 2;
      } else {
        yPos += 2;
      }

      let xPos = margin;
      const imgWidth = 40;
      const imgHeight = 40;
      const gap = 6;

      for (const photo of item.photoUrls) {
        if (xPos + imgWidth > 195) {
          xPos = margin;
          yPos += imgHeight + gap;
          if (yPos > 220) {
            doc.addPage();
            yPos = 20;
          }
        }

        try {
          doc.addImage(photo, 'JPEG', xPos, yPos, imgWidth, imgHeight);
          doc.setDrawColor(218, 218, 218);
          doc.rect(xPos, yPos, imgWidth, imgHeight, 'S');
        } catch (e) {
          console.error("Failed to add image to PDF", e);
          doc.setDrawColor(230);
          doc.setFillColor(245, 245, 245);
          doc.rect(xPos, yPos, imgWidth, imgHeight, 'FD');
          doc.setFontSize(8);
          doc.setTextColor(150);
          doc.text("Image Error", xPos + 10, yPos + 22);
        }

        xPos += imgWidth + gap;
      }

      yPos += imgHeight + 12;
    }
  }

  // Terms & Legal
  if (yPos > 180) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("Terms & Conditions & Booking Policy", margin, yPos);
  yPos += 6;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80);

  const terms = [
    "1. Gold Rate Protection & Lock: The booked gold rate of ₹" + Math.round(order.goldRateAtBooking).toLocaleString('en-IN') + "/g is fully locked and protected for the duration of this plan. To preserve this rate lock, you commit to paying each milestone on or before its due date.",
    "2. Rate Protection Suspension: Failure to pay any installment on time (subject to a standard 24-hour grace period) compromises your rate lock. The remaining gold weight may immediately revert to current market rates or carry a market adjustment surcharge.",
    "3. Late Fees & Volatility Surcharges: Unpaid milestones past their respective due dates trigger an active late fee of ₹250 per milestone to cover gold market volatility risk.",
    "4. Workshop Production Hold: Since custom jewelry is crafted specifically for you, crafting and workshop labor will be paused immediately if any milestone payment remains overdue past 5 days.",
    "5. Cancellations & Deduction Policy: Cancellation of this order at any point voids the gold rate lock. Cancellations are subject to a deduction fee of up to 10% of total order value to cover actual design labor, raw gold melting loss, and metal processing costs incurred.",
    "6. Delivery & Actual Weight Settlement: Handover of completed custom jewelry will only occur after 100% plan settlement. The final weight of custom pieces may vary up to +/- 5% from estimated booking weights; any differences will be adjusted in the final settlement."
  ];

  for (const term of terms) {
    const splitTerm = doc.splitTextToSize(term, 180);
    if (yPos + (splitTerm.length * 4) > 275) {
      doc.addPage();
      yPos = 20;
    }
    doc.text(splitTerm, margin, yPos);
    yPos += (splitTerm.length * 4.5) + 2;
  }

  // Printing directive
  doc.autoPrint();

  // Open in new tab for print
  const blob = doc.output('blob');
  const blobURL = URL.createObjectURL(blob);
  window.open(blobURL, '_blank');
};
