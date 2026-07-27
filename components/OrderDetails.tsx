import React, { useState, useMemo, useEffect, useRef } from 'react';
// Added CheckCheck to imports from lucide-react
import { ArrowLeft, Box, CreditCard, MessageSquare, FileText, Lock, AlertTriangle, Archive, CheckCircle2, CheckCheck, History, ExternalLink, RefreshCw, XCircle, TrendingUp, ShieldAlert, ShieldCheck, Scale, Camera, Send, CalendarDays, Clock, ChevronDown, ChevronUp, Plus, Edit2, Printer, Download, Image as ImageIcon, Sparkles, Calculator, Percent, Tag, ReceiptIndianRupee } from 'lucide-react';
import { Order, GlobalSettings, WhatsAppLogEntry, ProductionStatus, ProtectionStatus, OrderStatus, JewelryDetail } from '../types';
import { generateOrderPDF, generateReceiptPDF } from '../services/pdfGenerator';
import { whatsappService } from '../services/whatsappService';
import { Button } from './shared/BaseUI';
import { compressImage } from '../services/imageOptimizer';

// Importing Clusters (Plug & Play Units)
import { PaymentWidget } from './clusters/PaymentWidget';
import { CommunicationWidget } from './clusters/CommunicationWidget';

import { applyLateFees, reconcileOrderTotalsAndMilestones } from '../services/orderUtils';

interface OrderDetailsProps {
  order: Order;
  settings: GlobalSettings;
  onBack: () => void;
  onUpdateStatus: (itemId: string, status: ProductionStatus) => void;
  onRecordPayment: (orderId: string, amount: number, method: string, date: string, note: string) => void;
  onOrderUpdate: (updatedOrder: Order) => void; 
  onDeleteOrder?: (id: string) => void;
  logs?: WhatsAppLogEntry[];
  onAddLog?: (log: WhatsAppLogEntry) => void;
}

const OrderDetails: React.FC<OrderDetailsProps> = ({ 
    order, onBack, onOrderUpdate, onDeleteOrder, logs = [], onAddLog, settings, onUpdateStatus
}) => {
  const [activeTab, setActiveTab] = useState<'ITEMS' | 'FINANCIAL' | 'LOGS' | 'PROOF'>('FINANCIAL');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemForm, setEditItemForm] = useState({
      netWeight: '',
      wastagePercentage: '',
      makingChargesPerGram: '',
      stoneCharges: '',
      otherCharges: '',
      customizationDetails: '',
      backendNotes: ''
  });
  const [isUpdatingDiscount, setIsUpdatingDiscount] = useState(false);
  const [newDiscount, setNewDiscount] = useState('');
  const [isUpdatingWaiveLateFee, setIsUpdatingWaiveLateFee] = useState(false);
  const [newWaiveLateFee, setNewWaiveLateFee] = useState('');
  const [sendingAgreement, setSendingAgreement] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const lateFeeCheckedRef = useRef(false);
  
  // Schedule View State
  const [showOriginalSchedule, setShowOriginalSchedule] = useState(false);

  useEffect(() => {
      if (!lateFeeCheckedRef.current) {
          lateFeeCheckedRef.current = true;
          const clonedOrder = JSON.parse(JSON.stringify(order));
          const lateFeeChanged = applyLateFees(clonedOrder);
          const reconChanged = reconcileOrderTotalsAndMilestones(clonedOrder);

          if (lateFeeChanged || reconChanged) {
              onOrderUpdate(clonedOrder);
          }
      }
  }, [order, onOrderUpdate]);

  const handlePaymentUpdate = (updatedOrder: Order) => {
    reconcileOrderTotalsAndMilestones(updatedOrder);
    onOrderUpdate(updatedOrder);
  };

  const handleOpenCustomerLink = () => {
      const link = `${window.location.origin}/?token=${order.shareToken}`;
      window.open(link, '_blank');
  };

  const handleResendAgreement = async () => {
      if(!confirm("Resend original Order Agreement via WhatsApp?")) return;
      setSendingAgreement(true);

      try {
          // 1. Prepare Variables with strict sanitization
          const itemName = (order.items.length > 0 
            ? order.items[0].category + (order.items.length > 1 ? ` & ${order.items.length - 1} others` : '') 
            : 'Jewellery').trim() || 'Jewellery';
            
          const termsText = (`${order.paymentPlan.months || 1} Months Installment`).trim() || 'Custom Terms';
          
          // 2. Generate Schedule String with Safety Truncation & No Empty Strings
          const allMilestones = order.paymentPlan.milestones;
          let scheduleString = '';
          
          // Limit list to top 4 to prevent excessively long messages that Meta might reject
          if (allMilestones.length > 0) {
              const displayLimit = Math.min(allMilestones.length, 4);
              scheduleString = allMilestones.slice(0, displayLimit).map((m, i) => {
                  const date = new Date(m.dueDate).toLocaleDateString('en-IN');
                  return `${i+1}. ${date}: ₹${Math.round(m.targetAmount).toLocaleString('en-IN')}`;
              }).join('\n');
              
              if (allMilestones.length > displayLimit) {
                  scheduleString += `\n...and ${allMilestones.length - displayLimit} more.`;
              }
          } else {
              scheduleString = "Details in link.";
          }
          
          // Final safety fallback
          if (!scheduleString.trim()) scheduleString = "Schedule details provided in secure link.";

          const res = await whatsappService.sendTemplateMessage(
              order.customerContact,
              'auragold_order_agreement',
              'en_US',
              [
                  order.customerName || 'Customer',         // {{1}} Name
                  itemName,                                // {{2}} Item
                  Math.round(order.totalAmount).toLocaleString('en-IN'),      // {{3}} Total
                  termsText,                               // {{4}} Terms
                  scheduleString,                          // {{5}} Schedule
                  order.shareToken                         // {{6}} Link Token
              ],
              order.customerName || 'Customer'
          );

          if (res.success) {
              alert("Agreement Sent Successfully!");
              if (res.logEntry && onAddLog) onAddLog(res.logEntry);
          } else {
              alert(`Send Failed: ${res.error}. Check System Logs for details.`);
          }
      } catch (e: any) {
          alert("Network Error: " + e.message);
      } finally {
          setSendingAgreement(false);
      }
  };

  // --- GOLD RATE PROTECTION LOGIC ---
  const liabilityState = useMemo(() => {
      if (order.paymentPlan.protectionStatus !== ProtectionStatus.ACTIVE || order.paymentPlan.goldRateProtection === false) return null;
      if (order.status === OrderStatus.DELIVERED || order.status === OrderStatus.CANCELLED) return null;
      
      const currentRate = settings.currentGoldRate22K;
      const bookedRate = order.paymentPlan.protectionRateBooked || order.goldRateAtBooking;
      const limit = order.paymentPlan.protectionLimit || 0;
      
      const diff = currentRate - bookedRate;
      const isLiability = diff > limit;
      const surchargePerGram = isLiability ? diff - limit : 0;
      
      const totalWeight = order.items.reduce((sum, item) => sum + item.netWeight, 0);
      const estimatedImpact = surchargePerGram * totalWeight * (1 + (settings.defaultTaxRate/100));

      return { currentRate, bookedRate, limit, diff, isLiability, surchargePerGram, estimatedImpact };
  }, [order, settings]);

  const handleApplySurcharge = async () => {
      if (!liabilityState || !liabilityState.isLiability) return;
      
      if (!confirm(`SECURITY ALERT: Market rate rose by ₹${liabilityState.diff}/g, exceeding protection limit of ₹${liabilityState.limit}/g.\n\nApply ₹${Math.round(liabilityState.estimatedImpact).toLocaleString()} adjustment?`)) return;

      const newEffectiveRate = liabilityState.bookedRate + liabilityState.surchargePerGram;

      const updatedItems = order.items.map(item => {
          let scaling = 1;
          if (item.purity === '24K') scaling = 24/22;
          if (item.purity === '18K') scaling = 18/22;
          
          const usedRate = newEffectiveRate * scaling;
          const metalValue = item.netWeight * usedRate;
          const wastageValue = item.netWeight * usedRate * (item.wastagePercentage / 100);
          const laborValue = item.makingChargesPerGram * item.netWeight;
          const subTotal = metalValue + wastageValue + laborValue + item.stoneCharges;
          const tax = subTotal * (settings.defaultTaxRate / 100);
          
          return { ...item, baseMetalValue: metalValue, wastageValue, totalLaborValue: laborValue, taxAmount: tax, finalAmount: subTotal + tax };
      });

      const netLateFee = Math.max(0, (order.lateFeeAmount || 0) - (order.lateFeeWaived || 0));
      const newTotal = Math.max(0, updatedItems.reduce((s, i) => s + i.finalAmount, 0) - (order.discountAmount || 0) + netLateFee);
      const paid = order.payments.reduce((s, p) => s + p.amount, 0);
      const remaining = newTotal - paid;

      const pendingMilestones = order.paymentPlan.milestones.filter(m => m.status !== 'PAID');
      const paidMilestones = order.paymentPlan.milestones.filter(m => m.status === 'PAID');
      
      let newMilestones = [];
      if (pendingMilestones.length > 0) {
          const perMilestone = remaining / pendingMilestones.length;
          let runningSum = paid;
          newMilestones = [...paidMilestones, ...pendingMilestones.map(m => {
              const amt = Math.round(perMilestone);
              runningSum += amt;
              return { ...m, targetAmount: amt, cumulativeTarget: runningSum, description: m.description ? (m.description.includes('(Adj)') ? m.description : m.description + ' (Adj)') : 'Installment (Adj)' };
          })];
      } else {
          newMilestones = [...paidMilestones, {
              id: `SUR-${Date.now()}`,
              dueDate: new Date().toISOString().split('T')[0],
              targetAmount: Math.round(remaining),
              cumulativeTarget: Math.round(newTotal),
              status: 'PENDING',
              warningCount: 0,
              description: 'Limit Surcharge'
          }];
      }

      // Preserve original milestones if not already saved
      const originalMilestones = order.paymentPlan.originalMilestones || JSON.parse(JSON.stringify(order.paymentPlan.milestones));

      const updatedOrder: Order = {
          ...order,
          items: updatedItems,
          totalAmount: newTotal,
          goldRateAtBooking: newEffectiveRate, 
          paymentPlan: {
              ...order.paymentPlan,
              milestones: newMilestones as any[],
              originalMilestones,
              protectionRateBooked: newEffectiveRate 
          }
      };
      
      try {
          await whatsappService.sendTemplateMessage(
              updatedOrder.customerContact,
              'auragold_rate_adjustment_alert',
              'en_US',
              [updatedOrder.customerName, Math.round(liabilityState.estimatedImpact).toLocaleString(), updatedOrder.id, newEffectiveRate.toString(), updatedOrder.shareToken],
              updatedOrder.customerName
          );
      } catch (e) {}

      onOrderUpdate(updatedOrder);
      alert("Contract Updated & Customer Notified.");
  };

  const handleUpdateItemDetails = async (itemId: string) => {
      const w = parseFloat(editItemForm.netWeight) || 0;
      const wastagePct = parseFloat(editItemForm.wastagePercentage) || 0;
      const makingCharges = parseFloat(editItemForm.makingChargesPerGram) || 0;
      const stoneChg = parseFloat(editItemForm.stoneCharges) || 0;
      const otherChg = parseFloat(editItemForm.otherCharges) || 0;

      if (!w || w <= 0) return alert("Invalid Weight");
      
      const targetItem = order.items.find(i => i.id === itemId);
      if (!targetItem) return;

      const oldWeight = targetItem.netWeight;
      const oldTotal = order.totalAmount;
      // We calculate the effective rate used per gram from existing data to preserve the booking lock
      const effectiveRate = targetItem.netWeight > 0 ? (targetItem.baseMetalValue / targetItem.netWeight) : order.goldRateAtBooking;
      
      const metalValue = w * effectiveRate;
      const wastageValue = metalValue * (wastagePct / 100);
      const laborValue = makingCharges * w;
      const subTotal = metalValue + wastageValue + laborValue + stoneChg + otherChg;
      const tax = subTotal * (settings.defaultTaxRate / 100);
      const newFinalAmount = subTotal + tax;

      const updatedItems = order.items.map(i => i.id === itemId ? {
          ...i,
          netWeight: w,
          wastagePercentage: wastagePct,
          makingChargesPerGram: makingCharges,
          stoneCharges: stoneChg,
          otherCharges: otherChg,
          customizationDetails: editItemForm.customizationDetails,
          backendNotes: editItemForm.backendNotes,
          baseMetalValue: metalValue,
          wastageValue,
          totalLaborValue: laborValue,
          taxAmount: tax,
          finalAmount: newFinalAmount
      } : i);

      const netLateFee = Math.max(0, (order.lateFeeAmount || 0) - (order.lateFeeWaived || 0));
      const newTotal = Math.max(0, updatedItems.reduce((s, i) => s + i.finalAmount, 0) - (order.discountAmount || 0) + netLateFee);
      const valueChange = newTotal - oldTotal;

      const newMilestones = JSON.parse(JSON.stringify(order.paymentPlan.milestones));
      const last = newMilestones[newMilestones.length - 1];
      if (last && last.status !== 'PAID') {
          last.targetAmount = Math.max(0, last.targetAmount + valueChange);
          last.cumulativeTarget = Math.max(0, last.cumulativeTarget + valueChange);
      } else if (valueChange !== 0) {
          newMilestones.push({
              id: `ADJ-WT-${Date.now()}`,
              dueDate: new Date().toISOString().split('T')[0],
              targetAmount: valueChange,
              cumulativeTarget: newTotal,
              status: 'PENDING',
              warningCount: 0,
              description: 'Order Adjustment'
          } as any);
      }

      // Preserve original milestones if not already saved
      const originalMilestones = order.paymentPlan.originalMilestones || JSON.parse(JSON.stringify(order.paymentPlan.milestones));

      const updatedOrder: Order = { 
          ...order, 
          items: updatedItems, 
          totalAmount: newTotal, 
          paymentPlan: { 
              ...order.paymentPlan, 
              milestones: newMilestones,
              originalMilestones 
          } 
      };

      try {
          if (w !== oldWeight) {
              await whatsappService.sendTemplateMessage(
                  updatedOrder.customerContact,
                  'auragold_weight_update',
                  'en_US',
                  [updatedOrder.customerName, targetItem.category, w.toString(), oldWeight.toString(), Math.abs(Math.round(valueChange)).toLocaleString()],
                  updatedOrder.customerName
              );
          }
      } catch (e) {}

      onOrderUpdate(updatedOrder);
      setEditingItemId(null);
      alert("Item details updated successfully & order totals recalculated.");
  };

  const handleUpdateDiscount = () => {
      const discount = Number(newDiscount);
      if (isNaN(discount) || discount < 0) return alert("Invalid discount amount");

      const oldTotal = order.totalAmount;
      const itemsTotal = order.items.reduce((s, i) => s + i.finalAmount, 0);
      const netLateFee = Math.max(0, (order.lateFeeAmount || 0) - (order.lateFeeWaived || 0));
      const newTotal = Math.max(0, itemsTotal - discount + netLateFee);
      const valueChange = newTotal - oldTotal;

      const newMilestones = JSON.parse(JSON.stringify(order.paymentPlan.milestones));
      const last = newMilestones[newMilestones.length - 1];
      if (last && last.status !== 'PAID') {
          last.targetAmount = Math.max(0, last.targetAmount + valueChange);
          last.cumulativeTarget = Math.max(0, last.cumulativeTarget + valueChange);
      } else if (valueChange !== 0) {
          newMilestones.push({
              id: `ADJ-DISC-${Date.now()}`,
              dueDate: new Date().toISOString().split('T')[0],
              targetAmount: valueChange,
              cumulativeTarget: newTotal,
              status: 'PENDING',
              warningCount: 0,
              description: 'Discount Adjustment'
          } as any);
      }

      const originalMilestones = order.paymentPlan.originalMilestones || JSON.parse(JSON.stringify(order.paymentPlan.milestones));

      const updatedOrder = { 
          ...order, 
          discountAmount: discount,
          totalAmount: newTotal, 
          paymentPlan: { 
              ...order.paymentPlan, 
              milestones: newMilestones,
              originalMilestones 
          } 
      };

      reconcileOrderTotalsAndMilestones(updatedOrder as Order);
      onOrderUpdate(updatedOrder as Order);
      setIsUpdatingDiscount(false);
      setNewDiscount('');
      alert("Discount updated successfully.");
  };

  const handleUpdateWaiveLateFee = () => {
      const waived = Number(newWaiveLateFee);
      if (isNaN(waived) || waived < 0) return alert("Invalid waive amount");
      
      const maxWaivable = order.lateFeeAmount || 0;
      if (waived > maxWaivable) return alert("Cannot waive more than accumulated late fee");

      const oldTotal = order.totalAmount;
      const itemsTotal = order.items.reduce((s, i) => s + i.finalAmount, 0);
      const discount = order.discountAmount || 0;
      const netLateFee = Math.max(0, (order.lateFeeAmount || 0) - waived);
      const newTotal = Math.max(0, itemsTotal - discount + netLateFee);
      const valueChange = newTotal - oldTotal;

      const newMilestones = JSON.parse(JSON.stringify(order.paymentPlan.milestones));
      const pendingMilestones = newMilestones.filter((m: any) => m.status !== 'PAID');
      
      if (pendingMilestones.length > 0) {
          const last = pendingMilestones[pendingMilestones.length - 1];
          last.targetAmount = Math.max(0, last.targetAmount + valueChange);
          last.cumulativeTarget = Math.max(0, last.cumulativeTarget + valueChange);
      } else if (newMilestones.length > 0) {
          const last = newMilestones[newMilestones.length - 1];
          last.targetAmount = Math.max(0, last.targetAmount + valueChange);
          last.cumulativeTarget = Math.max(0, last.cumulativeTarget + valueChange);
      }

      const updatedOrder = { 
          ...order, 
          lateFeeWaived: waived,
          totalAmount: newTotal, 
          paymentPlan: { 
              ...order.paymentPlan, 
              milestones: newMilestones
          } 
      };

      reconcileOrderTotalsAndMilestones(updatedOrder as Order);
      onOrderUpdate(updatedOrder as Order);
      setIsUpdatingWaiveLateFee(false);
      setNewWaiveLateFee('');
      alert("Late fee waiver updated successfully.");
  };

  const handleStatusChange = async (itemId: string, newStatus: ProductionStatus) => {
      onUpdateStatus(itemId, newStatus);
      const item = order.items.find(i => i.id === itemId);
      if (item) {
          try {
              await whatsappService.sendTemplateMessage(
                  order.customerContact,
                  'auragold_production_update',
                  'en_US',
                  [order.customerName, item.category, order.id, newStatus.replace('_', ' '), order.shareToken],
                  order.customerName
              );
              if (onAddLog) onAddLog({
                  id: `SYS-${Date.now()}`,
                  customerName: order.customerName,
                  phoneNumber: order.customerContact,
                  message: `[System] Updated ${item.category} status to ${newStatus}`,
                  status: 'SENT',
                  timestamp: new Date().toISOString(),
                  type: 'TEMPLATE',
                  direction: 'outbound'
              });
          } catch(e) {}
      }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, itemId: string, type: 'ordered' | 'ready' = 'ready') => {
      if (e.target.files && e.target.files.length > 0) {
          try {
              const compressedList: string[] = [];
              for (let i = 0; i < e.target.files.length; i++) {
                  const compressed = await compressImage(e.target.files[i]);
                  compressedList.push(compressed);
              }
              
              const updatedItems = order.items.map(i => {
                  if (i.id === itemId) {
                      if (type === 'ordered') {
                          return { ...i, photoUrls: [...(i.photoUrls || []), ...compressedList] };
                      } else {
                          return { ...i, readyPhotoUrls: [...(i.readyPhotoUrls || []), ...compressedList] };
                      }
                  }
                  return i;
              });
              
              const updatedOrder = { ...order, items: updatedItems };
              onOrderUpdate(updatedOrder as Order);

              if (type === 'ready' && confirm("Send notification to customer via WhatsApp about finished product?")) {
                  // MAPPED CORRECTLY: 2 Body Variables, 1 Button Variable
                  await whatsappService.sendTemplateMessage(
                      order.customerContact, 
                      'auragold_finished_item_showcase', 
                      'en_US', 
                      [order.customerName, order.id], 
                      order.customerName,
                      order.shareToken
                  );
                  alert("Notification Sent!");
              }
          } catch(e) { alert("Photo upload failed"); }
      }
  };

  const handleRepopulateOrder = () => {
      if(!confirm(`Recalculate order at current rate of ₹${settings.currentGoldRate22K}/g?`)) return;

      const currentRate = settings.currentGoldRate22K;
      const updatedItems = order.items.map(item => {
          const metalValue = item.netWeight * currentRate;
          const wastageValue = item.netWeight * currentRate * (item.wastagePercentage / 100);
          const laborValue = item.makingChargesPerGram * item.netWeight;
          const subTotal = metalValue + wastageValue + laborValue + item.stoneCharges;
          const tax = subTotal * (settings.defaultTaxRate / 100);
          return { ...item, baseMetalValue: metalValue, wastageValue, totalLaborValue: laborValue, taxAmount: tax, finalAmount: subTotal + tax };
      });

      const netLateFee = Math.max(0, (order.lateFeeAmount || 0) - (order.lateFeeWaived || 0));
      const newTotal = Math.max(0, updatedItems.reduce((s, i) => s + i.finalAmount, 0) - (order.discountAmount || 0) + netLateFee);
      const totalPaid = order.payments.reduce((acc, p) => acc + p.amount, 0);
      const remainingBalance = Number((newTotal - totalPaid).toFixed(2));

      const paidMilestones = order.paymentPlan.milestones.filter(m => m.status === 'PAID');
      const pendingMilestones = order.paymentPlan.milestones.filter(m => m.status !== 'PAID');

      if (pendingMilestones.length === 0 && remainingBalance > 0) {
          pendingMilestones.push({ id: `ADJ-${Date.now()}`, dueDate: order.paymentPlan.milestones[order.paymentPlan.milestones.length - 1].dueDate, targetAmount: 0, cumulativeTarget: 0, status: 'PENDING', warningCount: 0 } as any);
      }

      const newPerMilestone = Math.round(remainingBalance / pendingMilestones.length);
      let runningSum = totalPaid;

      const newPendingMilestones = pendingMilestones.map((m, idx) => {
          const amount = (idx === pendingMilestones.length - 1) ? (remainingBalance - (newPerMilestone * (pendingMilestones.length - 1))) : newPerMilestone;
          runningSum += amount;
          return { ...m, targetAmount: amount, cumulativeTarget: runningSum, status: 'PENDING' as const, warningCount: 0 };
      });

      // Preserve original milestones
      const originalMilestones = order.paymentPlan.originalMilestones || JSON.parse(JSON.stringify(order.paymentPlan.milestones));

      const updatedOrder: Order = { 
          ...order, 
          items: updatedItems, 
          totalAmount: newTotal, 
          goldRateAtBooking: currentRate, 
          paymentPlan: { 
              ...order.paymentPlan, 
              milestones: [...paidMilestones, ...newPendingMilestones].sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()), 
              originalMilestones,
              protectionStatus: ProtectionStatus.ACTIVE, 
              protectionRateBooked: currentRate 
          } 
      };

      whatsappService.sendTemplateMessage(updatedOrder.customerContact, 'auragold_order_revised', 'en_US', [updatedOrder.customerName, updatedOrder.id, Math.round(newTotal).toLocaleString('en-IN'), 'Rate Repopulation', updatedOrder.shareToken], updatedOrder.customerName);
      onOrderUpdate(updatedOrder);
      alert("Order Repopulated!");
  };

  const handleLapseProtection = () => {
      if(confirm("Revoke Gold Rate Protection?")) {
          onOrderUpdate({ 
              ...order, 
              originalSnapshot: { timestamp: new Date().toISOString(), originalTotal: order.totalAmount, originalRate: order.goldRateAtBooking, itemsSnapshot: [...order.items], reason: 'Manual Admin Revocation' }, 
              paymentPlan: { ...order.paymentPlan, protectionStatus: ProtectionStatus.LAPSED },
              protectionRevokedAt: new Date().toISOString()
          });
      }
  };

  const handleRefundCancel = () => {
      if(!confirm("Cancel Order?")) return;
      
      const isBankTransfer = confirm("Was this refund issued via Bank Transfer?\n(Click OK for Transfer, Cancel for Cash)");
      const refundMethod = isBankTransfer ? 'TRANSFER' : 'CASH';

      onOrderUpdate({ 
          ...order, 
          status: OrderStatus.CANCELLED, 
          cancelledAt: new Date().toISOString(),
          refundMethod,
          paymentPlan: { ...order.paymentPlan, protectionStatus: ProtectionStatus.LAPSED } 
      });
  };

  const handleHandover = () => {
      if(confirm("Confirm Handover? Marks as DELIVERED.")) {
          onOrderUpdate({ 
              ...order, 
              status: OrderStatus.DELIVERED, 
              deliveredAt: new Date().toISOString(),
              items: order.items.map(i => ({...i, productionStatus: ProductionStatus.DELIVERED})) 
          });
          onBack(); 
      }
  };

  const handleDeleteOrder = () => {
      if (!onDeleteOrder) return;
      if (confirm("Are you sure you want to permanently delete this order? This action cannot be undone and will remove all associated items and payments.")) {
          onDeleteOrder(order.id);
      }
  };

  const isFullyPaid = order.payments.reduce((acc, p) => acc + p.amount, 0) >= order.totalAmount - 1;
  const isLapsed = order.paymentPlan.protectionStatus === ProtectionStatus.LAPSED;

  const displayMilestones = showOriginalSchedule && order.paymentPlan.originalMilestones 
      ? order.paymentPlan.originalMilestones 
      : order.paymentPlan.milestones;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 animate-fadeIn">
      <div className="flex justify-between items-center">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-bold text-sm">
          <ArrowLeft size={20} /> Back
        </button>
        <div className="flex gap-2">
           <Button size="sm" variant="secondary" onClick={async () => {
                if(!confirm("Trigger test breach check for this order?")) return;
                try {
                    const res = await fetch(`/api/whatsapp/test-breach/${order.id}`, { method: 'POST' });
                    const data = await res.json();
                    if (data.success) alert("Test triggered successfully!");
                    else alert("Failed: " + data.error);
                } catch(e: any) { alert("Error: " + e.message); }
            }}><ShieldAlert size={14} /> Test Breach</Button>
           <Button size="sm" variant="secondary" onClick={handleResendAgreement} loading={sendingAgreement}><Send size={14} /> Resend Agreement</Button>
           <Button size="sm" variant="secondary" onClick={handleOpenCustomerLink}><ExternalLink size={14} /> Customer View</Button>
           <Button size="sm" variant="secondary" onClick={() => generateReceiptPDF(order)}><Printer size={14} /> Print Receipt</Button>
           <Button size="sm" variant="secondary" onClick={() => generateOrderPDF(order)}><FileText size={14} /> Contract PDF</Button>
           {onDeleteOrder && (
               <Button size="sm" variant="danger" onClick={handleDeleteOrder}><XCircle size={14} /> Delete Order</Button>
           )}
        </div>
      </div>

      <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row justify-between items-start gap-6">
         <div className="relative z-10 flex-1 min-w-0">
            <h1 className="text-3xl font-black tracking-tight mb-1 break-words leading-tight">{order.customerName}</h1>
            <div className="space-y-2">
                <p className="text-slate-400 font-medium text-sm flex flex-wrap items-center gap-3">
                    <span>{order.customerContact}</span>
                    <span className="w-1 h-1 bg-slate-600 rounded-full shrink-0"></span>
                    <span className="shrink-0">{order.items.length} Items</span>
                    {order.createdBy && (
                        <>
                            <span className="w-1 h-1 bg-slate-600 rounded-full shrink-0"></span>
                            <span className="bg-white/10 text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-white/20 shrink-0">
                                Created By: {order.createdBy}
                            </span>
                        </>
                    )}
                    {order.status === OrderStatus.DELIVERED && <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-emerald-500/30 shrink-0">Archived</span>}
                    {order.status === OrderStatus.CANCELLED && <span className="bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-rose-500/30 shrink-0">Cancelled</span>}
                </p>
                {(order.deliveredAt || order.cancelledAt || order.protectionRevokedAt) && (
                    <div className="flex flex-wrap gap-2 text-[10px] uppercase font-bold tracking-wider">
                        {order.deliveredAt && <span className="text-emerald-400/80 bg-emerald-400/10 px-2 py-1 rounded">Delivered on {new Date(order.deliveredAt).toLocaleString()}</span>}
                        {order.cancelledAt && <span className="text-rose-400/80 bg-rose-400/10 px-2 py-1 rounded">Cancelled on {new Date(order.cancelledAt).toLocaleString()}{order.refundMethod ? ` (Refunded via ${order.refundMethod})` : ''}</span>}
                        {isLapsed && order.protectionRevokedAt && <span className="text-amber-400/80 bg-amber-400/10 px-2 py-1 rounded">Protection Revoked on {new Date(order.protectionRevokedAt).toLocaleString()}</span>}
                    </div>
                )}
            </div>
         </div>
         <div className="relative z-10 shrink-0">
             {order.paymentPlan.protectionStatus !== ProtectionStatus.NONE && order.paymentPlan.goldRateProtection !== false && (
                 <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border backdrop-blur-md ${isLapsed ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'}`}>
                     {isLapsed ? <AlertTriangle size={16} /> : <Lock size={16} />}
                     <div className="text-right">
                         <p className="text-[9px] font-black uppercase tracking-widest">{isLapsed ? 'Protection Revoked' : 'Rate Protected'}</p>
                         <p className="text-sm font-bold">₹{order.paymentPlan.protectionRateBooked || order.goldRateAtBooking}/g</p>
                     </div>
                 </div>
             )}
         </div>
      </div>

      <div className="flex bg-white p-1 rounded-2xl border shadow-sm overflow-x-auto">
        <TabButton active={activeTab === 'FINANCIAL'} onClick={() => setActiveTab('FINANCIAL')} icon={CreditCard} label="Ledger & Pay" />
        <TabButton active={activeTab === 'ITEMS'} onClick={() => setActiveTab('ITEMS')} icon={Box} label="Items" />
        <TabButton active={activeTab === 'LOGS'} onClick={() => setActiveTab('LOGS')} icon={MessageSquare} label="Chats" />
        {isLapsed && <TabButton active={activeTab === 'PROOF'} onClick={() => setActiveTab('PROOF')} icon={History} label="Lapse Recovery" />}
      </div>

      <div>
        {activeTab === 'FINANCIAL' && (
          <div className="animate-fadeIn space-y-6">
            {liabilityState && (
                <div className={`p-5 rounded-[2rem] border transition-all ${liabilityState.isLiability ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-100'}`}>
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-2">
                            {liabilityState.isLiability ? <ShieldAlert className="text-amber-600" size={20} /> : <ShieldCheck className="text-emerald-500" size={20} />}
                            <div><h3 className={`font-black text-sm uppercase tracking-wide ${liabilityState.isLiability ? 'text-amber-800' : 'text-slate-700'}`}>Protection Monitor</h3><p className="text-[10px] text-slate-500">Jeweler liability limit check.</p></div>
                        </div>
                        <div className="text-right"><p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Market Status</p><div className="flex items-center gap-2"><span className="text-xs font-bold text-slate-600">Current: ₹{liabilityState.currentRate}</span><span className={`text-xs font-bold ${liabilityState.diff > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{liabilityState.diff > 0 ? '+' : ''}{liabilityState.diff}</span></div></div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div className="bg-white/50 p-3 rounded-xl border border-black/5"><p className="text-[9px] font-black uppercase text-slate-400">Booked Rate</p><p className="font-bold text-slate-800">₹{liabilityState.bookedRate}</p></div>
                        <div className="bg-white/50 p-3 rounded-xl border border-black/5"><p className="text-[9px] font-black uppercase text-slate-400">Limit (Absorbed)</p><p className="font-bold text-slate-800">Up to +₹{liabilityState.limit}</p></div>
                        <div className={`p-3 rounded-xl border ${liabilityState.isLiability ? 'bg-rose-100 border-rose-200 text-rose-800' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`}><p className="text-[9px] font-black uppercase opacity-70">Liability Gap</p><p className="font-black">₹{Math.max(0, liabilityState.diff - liabilityState.limit)} /g</p></div>
                        {liabilityState.isLiability && <div className="bg-amber-100 border-amber-200 text-amber-800 p-3 rounded-xl border"><p className="text-[9px] font-black uppercase opacity-70">Est. Surcharge</p><p className="font-black">+₹{Math.round(liabilityState.estimatedImpact).toLocaleString()}</p></div>}
                    </div>
                    {liabilityState.isLiability && <button onClick={handleApplySurcharge} className="w-full bg-amber-600 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-amber-700 shadow-md flex items-center justify-center gap-2"><TrendingUp size={16} /> Apply Market Adjustment</button>}
                </div>
            )}
            
            {/* Active Payment Plan & EMI Calculation Breakdown */}
            {(() => {
              const plan = order.paymentPlan;
              if (!plan || plan.type === 'MANUAL') return null;
              const netOrderValue = order.totalAmount;
              
              const advanceMilestone = plan.milestones.find(m => m.id === 'ADV' || m.description?.toLowerCase().includes('advance') || m.description?.toLowerCase().includes('down'));
              const advanceAmount = advanceMilestone ? Math.round(advanceMilestone.targetAmount) : Math.round(netOrderValue * ((plan.advancePercentage || 0) / 100));
              
              const principalFinanced = Math.max(0, netOrderValue - advanceAmount);
              const interestPercentage = plan.interestPercentage || 0;
              const months = plan.months || 1;
              const estimatedInterestCharge = Math.round(principalFinanced * (interestPercentage / 100) * (months / 12));
              
              const emiMilestones = plan.milestones.filter(m => m.id !== 'ADV' && !m.description?.toLowerCase().includes('advance') && !m.description?.toLowerCase().includes('down'));
              const emiAmount = emiMilestones.length > 0 
                ? Math.round(emiMilestones[0].targetAmount) 
                : (months > 0 ? Math.round((principalFinanced + estimatedInterestCharge) / months) : principalFinanced);

              const planTitle = plan.planName || (plan.type === 'PRE_CREATED' ? `${months}-Month Pre-Created Scheme` : `Custom ${months}-Month Installment Plan`);
              const isZeroCost = interestPercentage === 0;

              return (
                <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-6 rounded-[2rem] shadow-xl space-y-5 border border-indigo-900/50">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/10 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-widest bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
                          Active Payment Plan
                        </span>
                        {isZeroCost ? (
                          <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle2 size={10} /> 0% Interest Zero-Cost
                          </span>
                        ) : (
                          <span className="text-[10px] font-black uppercase tracking-widest bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 px-2.5 py-0.5 rounded-full">
                            {interestPercentage}% p.a. Interest Scheme
                          </span>
                        )}
                      </div>
                      <h3 className="text-xl font-black text-white mt-1.5 flex items-center gap-2">
                        <Sparkles className="text-amber-400" size={20} /> {planTitle}
                      </h3>
                      <p className="text-xs text-slate-300 font-medium mt-0.5">
                        Tenure: <strong className="text-white">{months} Months</strong> • Down Payment: <strong className="text-white">{plan.advancePercentage}%</strong> ({plan.type === 'PRE_CREATED' ? 'Template Scheme' : 'Manual Plan'})
                      </p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/20 text-right self-stretch sm:self-auto">
                      <p className="text-[9px] font-black uppercase text-amber-300 tracking-widest">Monthly EMI</p>
                      <p className="text-2xl font-black text-white">₹{emiAmount.toLocaleString('en-IN')}<span className="text-xs text-slate-300 font-normal">/mo</span></p>
                    </div>
                  </div>

                  {/* EMI & Interest Math Calculation Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white/10 backdrop-blur-sm p-3.5 rounded-2xl border border-white/10">
                      <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Order Total</p>
                      <p className="text-base font-black text-white mt-0.5">₹{Math.round(netOrderValue).toLocaleString('en-IN')}</p>
                      <p className="text-[10px] text-slate-400 font-medium">Net Order Value</p>
                    </div>

                    <div className="bg-white/10 backdrop-blur-sm p-3.5 rounded-2xl border border-white/10">
                      <p className="text-[9px] font-black uppercase text-amber-300 tracking-widest">Advance Down Payment</p>
                      <p className="text-base font-black text-amber-400 mt-0.5">₹{advanceAmount.toLocaleString('en-IN')}</p>
                      <p className="text-[10px] text-amber-200/80 font-medium">{plan.advancePercentage}% Advance</p>
                    </div>

                    <div className="bg-white/10 backdrop-blur-sm p-3.5 rounded-2xl border border-white/10">
                      <p className="text-[9px] font-black uppercase text-indigo-300 tracking-widest">Principal Financed</p>
                      <p className="text-base font-black text-indigo-200 mt-0.5">₹{principalFinanced.toLocaleString('en-IN')}</p>
                      <p className="text-[10px] text-slate-300 font-medium">Order - Advance</p>
                    </div>

                    <div className={`p-3.5 rounded-2xl border ${isZeroCost ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-300">Interest Charge</p>
                      <p className={`text-base font-black mt-0.5 ${isZeroCost ? 'text-emerald-300' : 'text-amber-300'}`}>
                        {isZeroCost ? '₹0 (0% Int)' : `₹${estimatedInterestCharge.toLocaleString('en-IN')}`}
                      </p>
                      <p className="text-[10px] opacity-80 font-medium">Rate: {interestPercentage}% p.a.</p>
                    </div>
                  </div>

                  {/* Formula & Explanation Callout */}
                  <div className="bg-black/30 p-3.5 rounded-2xl border border-white/10 text-xs text-slate-300 flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                    <div className="flex items-center gap-2">
                      <Calculator size={16} className="text-amber-400 shrink-0" />
                      <span>
                        <strong className="text-white">EMI Formula:</strong> [Financed (₹{principalFinanced.toLocaleString('en-IN')}) + Int (₹{estimatedInterestCharge.toLocaleString('en-IN')})] ÷ {months} Months = <strong className="text-amber-300">₹{emiAmount.toLocaleString('en-IN')}/mo</strong>
                      </span>
                    </div>
                    {plan.subventionPercentage ? (
                      <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/20 px-2.5 py-1 rounded-lg border border-emerald-500/30 shrink-0">
                        Subvention Discount: {plan.subventionPercentage}%
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })()}

            <PaymentWidget order={order} onPaymentRecorded={handlePaymentUpdate} onAddLog={onAddLog} variant="FULL" />
            
            {/* Payment Schedule Visualization */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="font-black text-slate-800 text-sm uppercase tracking-wide flex items-center gap-2">
                        <CalendarDays size={16} className="text-blue-500" /> Payment Schedule
                    </h3>
                    {order.paymentPlan.originalMilestones && (
                        <div className="flex bg-slate-100 p-1 rounded-lg">
                            <button 
                                onClick={() => setShowOriginalSchedule(false)}
                                className={`px-3 py-1 rounded-md text-[10px] font-black uppercase transition-all ${!showOriginalSchedule ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}
                            >
                                Current
                            </button>
                            <button 
                                onClick={() => setShowOriginalSchedule(true)}
                                className={`px-3 py-1 rounded-md text-[10px] font-black uppercase transition-all ${showOriginalSchedule ? 'bg-white shadow text-slate-600' : 'text-slate-400'}`}
                            >
                                Original
                            </button>
                        </div>
                    )}
                </div>
                
                <div className="space-y-3 relative before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100">
                    {displayMilestones.map((m, i) => {
                        const isPaid = m.status === 'PAID';
                        const isOverdue = m.status !== 'PAID' && new Date(m.dueDate) < new Date();
                        const isOriginalView = showOriginalSchedule;

                        return (
                            <div key={i} className={`flex gap-4 relative ${isOriginalView ? 'opacity-70 grayscale' : ''}`}>
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-4 border-white z-10 ${isPaid && !isOriginalView ? 'bg-emerald-100 text-emerald-600' : isOverdue && !isOriginalView ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-400'}`}>
                                    {isPaid && !isOriginalView ? <CheckCircle2 size={16} /> : <Clock size={16} />}
                                </div>
                                <div className="flex-1 bg-slate-50/50 p-3 rounded-xl border border-slate-100 flex justify-between items-center">
                                    <div>
                                        <p className="text-xs font-bold text-slate-700">{m.description || (i === 0 ? 'Advance' : `Installment ${i}`)}</p>
                                        <p className="text-[10px] text-slate-400 font-medium">{new Date(m.dueDate).toLocaleDateString('en-IN')}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-sm font-black ${isPaid && !isOriginalView ? 'text-emerald-600' : 'text-slate-800'}`}>₹{Math.round(m.targetAmount).toLocaleString('en-IN')}</p>
                                        <span className={`text-[8px] font-black uppercase ${isPaid && !isOriginalView ? 'text-emerald-600' : 'text-slate-400'}`}>
                                            {isOriginalView ? 'Snapshot' : m.status}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {order.status !== OrderStatus.DELIVERED && (
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                    <h3 className="font-black text-slate-800 text-sm uppercase tracking-wide">Contract Controls</h3>
                    <div className="flex flex-col md:flex-row gap-4">
                        {order.paymentPlan.protectionStatus === ProtectionStatus.ACTIVE && order.paymentPlan.goldRateProtection !== false && <button onClick={handleLapseProtection} className="flex-1 bg-rose-50 border border-rose-100 text-rose-700 py-4 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-rose-100 transition-colors flex items-center justify-center gap-2"><AlertTriangle size={16} /> Revoke Rate Protection</button>}
                        {isFullyPaid ? <button onClick={handleHandover} className="flex-1 bg-slate-900 text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 shadow-lg"><CheckCheck size={16} /> Handover & Archive Order</button> : <div className="flex-1 border border-dashed border-slate-300 rounded-xl flex items-center justify-center text-slate-400 text-xs font-bold uppercase py-4 bg-slate-50"><Archive size={16} className="mr-2" /> Handover Locked</div>}
                    </div>
                </div>
            )}
          </div>
        )}

        {activeTab === 'LOGS' && <div className="animate-fadeIn h-[600px]"><CommunicationWidget logs={logs} customerPhone={order.customerContact} customerName={order.customerName} orderId={order.id} onLogAdded={(l) => onAddLog && onAddLog(l)} /></div>}

        {activeTab === 'ITEMS' && (
          <div className="space-y-4 animate-fadeIn">
             {order.items.map((item, idx) => {
               // Calculate display rate for this item
               const appliedRate = item.netWeight > 0 ? Math.round(item.baseMetalValue / item.netWeight) : 0;
               const isExpanded = expandedItem === item.id;

               return (
               <div key={idx} className="bg-white p-5 rounded-3xl border border-slate-100 flex flex-col gap-4 relative transition-all">
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-slate-800">{item.category}</h3>
                                {item.isReadyProduct ? (
                                    <span className="text-blue-600 font-extrabold bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider">Ready</span>
                                ) : (
                                    <span className="text-amber-600 font-extrabold bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider">To Make</span>
                                )}
                            </div>
                            <p className="text-xs text-slate-500">{item.purity} • {item.netWeight}g <span className="text-emerald-600 font-bold ml-1">@ ₹{Math.round(appliedRate).toLocaleString('en-IN')}/g</span></p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm font-black text-slate-900">₹{Math.round(item.finalAmount).toLocaleString('en-IN')}</p>
                            <div className="flex items-center gap-3 justify-end mt-1">
                                <button onClick={() => {
                                    setEditingItemId(item.id);
                                    setEditItemForm({
                                        netWeight: item.netWeight.toString(),
                                        wastagePercentage: (item.wastagePercentage || 0).toString(),
                                        makingChargesPerGram: (item.makingChargesPerGram || 0).toString(),
                                        stoneCharges: (item.stoneCharges || 0).toString(),
                                        otherCharges: (item.otherCharges || 0).toString(),
                                        customizationDetails: item.customizationDetails || '',
                                        backendNotes: item.backendNotes || ''
                                    });
                                }} className="text-[9px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-md border border-blue-100 transition-colors">
                                    <Edit2 size={10} /> Edit Item
                                </button>
                                <button onClick={() => setExpandedItem(isExpanded ? null : item.id)} className="text-[9px] font-bold text-slate-400 flex items-center gap-1">
                                    {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />} Breakdown
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    {/* Grid of Ordered and Ready Product Photos */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100 mt-3">
                        {/* Ordered reference pictures */}
                        <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                                <ImageIcon size={10} className="text-slate-500" /> Ordered Reference Images
                            </p>
                            <div className="flex flex-wrap gap-2 items-center">
                                {/* Capture / Upload Button */}
                                <div className="relative shrink-0 w-16 h-16 bg-white hover:bg-slate-100 border border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-400 transition-colors cursor-pointer shadow-sm">
                                    <Camera size={16} />
                                    <span className="text-[8px] font-bold mt-1 uppercase">Upload</span>
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        multiple 
                                        className="absolute inset-0 opacity-0 cursor-pointer" 
                                        onChange={(e) => handlePhotoUpload(e, item.id, 'ordered')} 
                                    />
                                </div>
                                {/* Render Images */}
                                {(!item.photoUrls || item.photoUrls.length === 0) ? (
                                    <span className="text-[10px] text-slate-400 italic font-medium ml-2">No reference pictures</span>
                                ) : (
                                    item.photoUrls.map((url, imgIdx) => (
                                        <div key={imgIdx} className="relative w-16 h-16 group bg-white rounded-xl overflow-hidden border border-slate-200 shrink-0 shadow-sm">
                                            <img src={url} className="w-full h-full object-cover" />
                                            <button 
                                                onClick={() => {
                                                    const link = document.createElement('a');
                                                    link.href = url;
                                                    link.download = `ordered-product-${idx}-${imgIdx}.jpg`;
                                                    document.body.appendChild(link);
                                                    link.click();
                                                    document.body.removeChild(link);
                                                }}
                                                className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white hover:bg-black/60"
                                                title="Download Image"
                                            >
                                                <Download size={14} />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Ready product showcase pictures */}
                        <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                                <CheckCircle2 size={10} className="text-emerald-500" /> Ready Product Images (Showcase)
                            </p>
                            <div className="flex flex-wrap gap-2 items-center">
                                {/* Capture / Upload Button */}
                                <div className="relative shrink-0 w-16 h-16 bg-white hover:bg-slate-100 border border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-400 transition-colors cursor-pointer shadow-sm">
                                    <Camera size={16} />
                                    <span className="text-[8px] font-bold mt-1 uppercase">Upload</span>
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        multiple 
                                        className="absolute inset-0 opacity-0 cursor-pointer" 
                                        onChange={(e) => handlePhotoUpload(e, item.id, 'ready')} 
                                    />
                                </div>
                                {/* Render Images */}
                                {(!item.readyPhotoUrls || item.readyPhotoUrls.length === 0) ? (
                                    <span className="text-[10px] text-slate-400 italic font-medium ml-2">No final images yet</span>
                                ) : (
                                    item.readyPhotoUrls.map((url, imgIdx) => (
                                        <div key={imgIdx} className="relative w-16 h-16 group bg-white rounded-xl overflow-hidden border border-slate-200 shrink-0 shadow-sm">
                                            <img src={url} className="w-full h-full object-cover" />
                                            <button 
                                                onClick={() => {
                                                    const link = document.createElement('a');
                                                    link.href = url;
                                                    link.download = `ready-product-${idx}-${imgIdx}.jpg`;
                                                    document.body.appendChild(link);
                                                    link.click();
                                                    document.body.removeChild(link);
                                                }}
                                                className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white hover:bg-black/60"
                                                title="Download Image"
                                            >
                                                <Download size={14} />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                    
                    {/* Bill Breakdown Section */}
                    {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-slate-100 text-[10px] grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-slate-500 bg-slate-50/50 p-3 rounded-xl animate-slideDown">
                            <div>
                                <span className="block font-bold uppercase tracking-wider text-slate-400 text-[8px]">Booking Rate</span>
                                <span className="font-mono text-emerald-700 font-bold">₹{Math.round(appliedRate).toLocaleString('en-IN')}/g</span>
                            </div>
                            <div>
                                <span className="block font-bold uppercase tracking-wider text-slate-400 text-[8px]">Metal Value</span>
                                <span className="font-mono text-slate-700">₹{Math.round(item.baseMetalValue).toLocaleString()}</span>
                            </div>
                            <div>
                                <span className="block font-bold uppercase tracking-wider text-slate-400 text-[8px]">VA / Wastage %</span>
                                <span className="font-mono text-amber-700 font-bold">{item.wastagePercentage}% (₹{Math.round(item.wastageValue).toLocaleString()})</span>
                            </div>
                            <div>
                                <span className="block font-bold uppercase tracking-wider text-slate-400 text-[8px]">Making Charges (₹/g)</span>
                                <span className="font-mono text-indigo-700 font-bold">₹{item.makingChargesPerGram}/g (₹{Math.round(item.totalLaborValue).toLocaleString()})</span>
                            </div>
                            <div>
                                <span className="block font-bold uppercase tracking-wider text-slate-400 text-[8px]">Stone Charges</span>
                                <span className="font-mono text-slate-700">₹{Math.round(item.stoneCharges).toLocaleString('en-IN')}</span>
                            </div>
                            <div>
                                <span className="block font-bold uppercase tracking-wider text-slate-400 text-[8px]">Other</span>
                                <span className="font-mono text-slate-700">₹{Math.round(item.otherCharges || 0).toLocaleString('en-IN')}</span>
                            </div>
                            <div>
                                <span className="block font-bold uppercase tracking-wider text-slate-400 text-[8px]">Tax (GST)</span>
                                <span className="font-mono text-slate-700">₹{Math.round(item.taxAmount).toLocaleString()}</span>
                            </div>
                        </div>
                    )}

                    <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{Object.values(ProductionStatus).map(s => <button key={s} onClick={() => handleStatusChange(item.id, s)} className={`text-[8px] font-black uppercase px-2 py-1 rounded border ${item.productionStatus === s ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-400'}`}>{s.replace('_', ' ')}</button>)}</div>
                    
                    {editingItemId === item.id && (() => {
                        const w = parseFloat(editItemForm.netWeight) || 0;
                        const vaPct = parseFloat(editItemForm.wastagePercentage) || 0;
                        const mcPerGram = parseFloat(editItemForm.makingChargesPerGram) || 0;
                        const stone = parseFloat(editItemForm.stoneCharges) || 0;
                        const other = parseFloat(editItemForm.otherCharges) || 0;
                        const effRate = item.netWeight > 0 ? (item.baseMetalValue / item.netWeight) : order.goldRateAtBooking;

                        const metalVal = w * effRate;
                        const wastageVal = metalVal * (vaPct / 100);
                        const laborVal = mcPerGram * w;
                        const subT = metalVal + wastageVal + laborVal + stone + other;
                        const taxVal = subT * (settings.defaultTaxRate / 100);
                        const calculatedTotal = subT + taxVal;

                        return (
                            <div className="mt-3 bg-blue-50/80 border border-blue-200 p-4 rounded-xl flex flex-col gap-3 animate-slideDown shadow-sm">
                                <div className="flex items-center justify-between border-b border-blue-200/60 pb-2">
                                    <span className="text-xs font-black uppercase text-blue-900 tracking-wider flex items-center gap-1.5">
                                        <Edit2 size={13} className="text-blue-600" /> Edit Item Specifications & Calculations
                                    </span>
                                    <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                                        Applied Rate: ₹{Math.round(effRate).toLocaleString('en-IN')}/g
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-600 block mb-1">Net Wt (g)</label>
                                        <input type="number" step="0.001" className="w-full bg-white border border-blue-200 rounded-lg p-2 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-400" placeholder="0.000" value={editItemForm.netWeight} onChange={e => setEditItemForm({...editItemForm, netWeight: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-amber-700 block mb-1">VA / Wastage (%)</label>
                                        <input type="number" step="0.1" className="w-full bg-white border border-blue-200 rounded-lg p-2 text-xs font-bold outline-none text-amber-800 focus:ring-2 focus:ring-amber-400" placeholder="VA %" value={editItemForm.wastagePercentage} onChange={e => setEditItemForm({...editItemForm, wastagePercentage: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-indigo-700 block mb-1">Making (₹/g)</label>
                                        <input type="number" step="1" className="w-full bg-white border border-blue-200 rounded-lg p-2 text-xs font-bold outline-none text-indigo-800 focus:ring-2 focus:ring-indigo-400" placeholder="Making ₹/g" value={editItemForm.makingChargesPerGram} onChange={e => setEditItemForm({...editItemForm, makingChargesPerGram: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-600 block mb-1">Stone Charges (₹)</label>
                                        <input type="number" className="w-full bg-white border border-blue-200 rounded-lg p-2 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-400" placeholder="Stone ₹" value={editItemForm.stoneCharges} onChange={e => setEditItemForm({...editItemForm, stoneCharges: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-600 block mb-1">Other Charges (₹)</label>
                                        <input type="number" className="w-full bg-white border border-blue-200 rounded-lg p-2 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-400" placeholder="Other ₹" value={editItemForm.otherCharges} onChange={e => setEditItemForm({...editItemForm, otherCharges: e.target.value})} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-600 block mb-1">Customer Notes / Customization</label>
                                        <input type="text" className="w-full bg-white border border-blue-200 rounded-lg p-2 text-xs outline-none focus:ring-2 focus:ring-blue-400" placeholder="Notes for customer" value={editItemForm.customizationDetails} onChange={e => setEditItemForm({...editItemForm, customizationDetails: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-600 block mb-1">Karigar Internal Notes</label>
                                        <input type="text" className="w-full bg-white border border-blue-200 rounded-lg p-2 text-xs outline-none focus:ring-2 focus:ring-blue-400" placeholder="Internal instructions" value={editItemForm.backendNotes} onChange={e => setEditItemForm({...editItemForm, backendNotes: e.target.value})} />
                                    </div>
                                </div>

                                {/* Live Calculation Breakdown Box */}
                                <div className="bg-white/90 border border-blue-200/80 p-3 rounded-lg text-xs space-y-1.5">
                                    <div className="flex justify-between items-center text-slate-600 font-medium">
                                        <span>Metal Value ({w}g × ₹{Math.round(effRate).toLocaleString('en-IN')}):</span>
                                        <span className="font-mono font-bold text-slate-800">₹{Math.round(metalVal).toLocaleString('en-IN')}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-amber-700 font-medium">
                                        <span>VA / Wastage ({vaPct}% of metal):</span>
                                        <span className="font-mono font-bold text-amber-800">+₹{Math.round(wastageVal).toLocaleString('en-IN')}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-indigo-700 font-medium">
                                        <span>Making Charges ({mcPerGram} ₹/g × {w}g):</span>
                                        <span className="font-mono font-bold text-indigo-800">+₹{Math.round(laborVal).toLocaleString('en-IN')}</span>
                                    </div>
                                    {(stone > 0 || other > 0) && (
                                        <div className="flex justify-between items-center text-slate-600 font-medium">
                                            <span>Stone & Other Charges:</span>
                                            <span className="font-mono font-bold text-slate-800">+₹{Math.round(stone + other).toLocaleString('en-IN')}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center text-slate-500 font-medium border-t border-slate-100 pt-1">
                                        <span>GST Tax ({settings.defaultTaxRate}%):</span>
                                        <span className="font-mono font-bold text-slate-700">+₹{Math.round(taxVal).toLocaleString('en-IN')}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-slate-900 font-black border-t border-blue-200 pt-1.5 text-sm">
                                        <span>Recalculated Item Total:</span>
                                        <span className="font-mono text-emerald-700 text-base">₹{Math.round(calculatedTotal).toLocaleString('en-IN')}</span>
                                    </div>
                                </div>

                                <div className="flex gap-2 justify-end pt-1">
                                    <button onClick={() => setEditingItemId(null)} className="text-slate-500 hover:text-slate-700 font-bold text-[10px] uppercase px-3 py-2 border border-slate-200 rounded-lg bg-white">Cancel</button>
                                    <button onClick={() => handleUpdateItemDetails(item.id)} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-[10px] font-black uppercase shadow-md transition-colors">Save & Recalculate</button>
                                </div>
                            </div>
                        );
                    })()}
                  </div>
               </div>
             )})}
             
             <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 mt-6">
                 <div className="space-y-3 text-sm">
                     <div className="flex justify-between items-center text-slate-500 font-bold">
                         <span>Items Subtotal (Incl. GST)</span>
                         <span>₹{Math.round(order.items.reduce((s, i) => s + i.finalAmount, 0)).toLocaleString('en-IN')}</span>
                     </div>
                     {order.discountAmount ? (
                         <div className="flex justify-between items-center text-emerald-700 font-bold bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-100">
                             <div className="flex items-center gap-2">
                                 <span>Order Discount</span>
                                 <button 
                                     onClick={() => { setIsUpdatingDiscount(true); setNewDiscount(order.discountAmount?.toString() || ''); }} 
                                     className="text-blue-600 hover:text-blue-800 bg-white border border-blue-200 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 shadow-sm transition-all"
                                 >
                                     <Edit2 size={10} /> Edit Discount
                                 </button>
                             </div>
                             <span className="text-emerald-800 text-base font-black">-₹{Math.round(order.discountAmount).toLocaleString('en-IN')}</span>
                         </div>
                     ) : (
                         <div className="flex justify-between items-center text-slate-500 font-bold bg-slate-100/70 p-2.5 rounded-xl border border-slate-200">
                             <span>Order Discount</span>
                             <button 
                                 onClick={() => { setIsUpdatingDiscount(true); setNewDiscount(''); }} 
                                 className="text-xs bg-blue-600 text-white hover:bg-blue-700 px-3 py-1 rounded-lg font-bold flex items-center gap-1 shadow-sm transition-all"
                             >
                                 <Plus size={12} /> Add Discount
                             </button>
                         </div>
                     )}
                     
                     {isUpdatingDiscount && (
                         <div className="mt-3 bg-blue-50 p-3 rounded-xl flex gap-2 items-center animate-slideDown">
                             <input type="number" className="flex-1 bg-white border border-blue-200 rounded-lg p-2 text-xs font-bold outline-none" placeholder="Discount Amount (₹)" value={newDiscount} onChange={e => setNewDiscount(e.target.value)} />
                             <button onClick={handleUpdateDiscount} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-[10px] font-black uppercase">Save</button>
                             <button onClick={() => setIsUpdatingDiscount(false)} className="text-slate-400"><XCircle size={16}/></button>
                         </div>
                     )}

                     {/* Late Fee Display */}
                     {order.lateFeeAmount ? (
                         <div className="flex justify-between items-center text-rose-600 font-bold group mt-2">
                             <div className="flex flex-col">
                                 <div className="flex items-center gap-2">
                                     <span>Late Fee & Overdue</span>
                                     <button onClick={() => { setIsUpdatingWaiveLateFee(true); setNewWaiveLateFee(order.lateFeeWaived?.toString() || ''); }} className="opacity-0 group-hover:opacity-100 text-blue-500 hover:text-blue-700 transition-opacity"><Edit2 size={12} /></button>
                                 </div>
                                 {order.lateFeeWaived ? <span className="text-[9px] text-rose-400">Waived: ₹{Math.round(order.lateFeeWaived).toLocaleString('en-IN')}</span> : null}
                             </div>
                             <span>+₹{Math.round(order.lateFeeAmount - (order.lateFeeWaived || 0)).toLocaleString('en-IN')}</span>
                         </div>
                     ) : null}

                     {isUpdatingWaiveLateFee && (
                         <div className="mt-3 bg-rose-50 p-3 rounded-xl flex gap-2 items-center animate-slideDown">
                             <input type="number" className="flex-1 bg-white border border-rose-200 rounded-lg p-2 text-xs font-bold outline-none" placeholder="Amount to Waive (₹)" value={newWaiveLateFee} onChange={e => setNewWaiveLateFee(e.target.value)} />
                             <button onClick={handleUpdateWaiveLateFee} className="bg-rose-600 text-white px-3 py-2 rounded-lg text-[10px] font-black uppercase">Waive</button>
                             <button onClick={() => setIsUpdatingWaiveLateFee(false)} className="text-slate-400"><XCircle size={16}/></button>
                         </div>
                     )}

                     <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-lg font-black text-slate-900">
                         <span>Grand Total (Total Payable)</span>
                         <span>₹{Math.round(Math.max(0, order.items.reduce((s, i) => s + i.finalAmount, 0) - (order.discountAmount || 0) + Math.max(0, (order.lateFeeAmount || 0) - (order.lateFeeWaived || 0)))).toLocaleString('en-IN')}</span>
                     </div>
                 </div>
             </div>
          </div>
        )}

        {activeTab === 'PROOF' && (
            <div className="animate-fadeIn space-y-6">
                <div className="bg-amber-50 border border-amber-200 rounded-[2rem] p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-4"><History size={24} className="text-amber-600" /><div><h3 className="font-black text-amber-900 text-lg">Lapse Recovery</h3><p className="text-xs text-amber-700">Contract violated.</p></div></div>
                    {order.originalSnapshot ? (
                        <div className="bg-white rounded-xl p-4 border border-amber-100 space-y-2 mb-6"><div className="flex justify-between items-center text-sm"><span className="text-slate-500 font-bold">Reason</span><span className="font-black text-rose-600 uppercase">{order.originalSnapshot.reason}</span></div><div className="flex justify-between items-center text-sm"><span className="text-slate-500 font-bold">Original Price</span><span className="font-black text-slate-800">₹{Math.round(order.originalSnapshot.originalTotal).toLocaleString('en-IN')}</span></div><div className="flex justify-between items-center text-sm"><span className="text-slate-500 font-bold">Original Rate</span><span className="font-black text-slate-800">₹{order.originalSnapshot.originalRate}/g</span></div></div>
                    ) : <div className="text-xs text-amber-600 mb-4 italic">No snapshot available.</div>}
                    <div className="grid grid-cols-2 gap-4"><button onClick={handleRepopulateOrder} className="bg-emerald-600 text-white p-4 rounded-xl flex flex-col items-center justify-center gap-2 shadow-lg"><RefreshCw size={24} /><div className="text-center"><span className="block font-black text-xs uppercase">Repopulate</span><span className="text-[9px] opacity-80">Accept New Rate</span></div></button><button onClick={handleRefundCancel} className="bg-rose-600 text-white p-4 rounded-xl flex flex-col items-center justify-center gap-2 shadow-lg"><XCircle size={24} /><div className="text-center"><span className="block font-black text-xs uppercase">Refund</span><span className="text-[9px] opacity-80">Cancel Funds</span></div></button></div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

const TabButton = ({ active, onClick, icon: Icon, label }: any) => (
  <button onClick={onClick} className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest transition-all ${active ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}><Icon size={16} /> {label}</button>
);

export default OrderDetails;
