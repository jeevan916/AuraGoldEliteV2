
import React, { useState, useMemo } from 'react';
// Added CheckCheck to imports from lucide-react
import { ArrowLeft, Box, CreditCard, MessageSquare, FileText, Lock, AlertTriangle, Archive, CheckCircle2, CheckCheck, History, ExternalLink, RefreshCw, XCircle, TrendingUp, ShieldAlert, ShieldCheck, Scale, Camera, Send } from 'lucide-react';
import { Order, GlobalSettings, WhatsAppLogEntry, ProductionStatus, ProtectionStatus, OrderStatus } from '../types';
import { generateOrderPDF } from '../services/pdfGenerator';
import { whatsappService } from '../services/whatsappService';
import { Button } from './shared/BaseUI';
import { compressImage } from '../services/imageOptimizer';

// Importing Clusters (Plug & Play Units)
import { PaymentWidget } from './clusters/PaymentWidget';
import { CommunicationWidget } from './clusters/CommunicationWidget';

interface OrderDetailsProps {
  order: Order;
  settings: GlobalSettings;
  onBack: () => void;
  onUpdateStatus: (itemId: string, status: ProductionStatus) => void;
  onRecordPayment: (orderId: string, amount: number, method: string, date: string, note: string) => void;
  onOrderUpdate: (updatedOrder: Order) => void; 
  logs?: WhatsAppLogEntry[];
  onAddLog?: (log: WhatsAppLogEntry) => void;
}

const OrderDetails: React.FC<OrderDetailsProps> = ({ 
    order, onBack, onOrderUpdate, logs = [], onAddLog, settings, onUpdateStatus
}) => {
  const [activeTab, setActiveTab] = useState<'ITEMS' | 'FINANCIAL' | 'LOGS' | 'PROOF'>('FINANCIAL');
  const [isUpdatingWeight, setIsUpdatingWeight] = useState<string | null>(null); // Track item ID being edited
  const [newWeight, setNewWeight] = useState('');
  const [sendingAgreement, setSendingAgreement] = useState(false);

  const handlePaymentUpdate = (updatedOrder: Order) => {
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
          
          if (allMilestones.length > 5) {
              const firstFew = allMilestones.slice(0, 4).map((m, i) => {
                  const date = new Date(m.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                  return `${i+1}. ${date}: ₹${m.targetAmount.toLocaleString()}`;
              }).join('\n');
              scheduleString = `${firstFew}\n...and ${allMilestones.length - 4} more installments.`;
          } else if (allMilestones.length > 0) {
              scheduleString = allMilestones.map((m, i) => {
                  const date = new Date(m.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                  return `${i+1}. ${date}: ₹${m.targetAmount.toLocaleString()}`;
              }).join('\n');
          } else {
              scheduleString = "Visit portal for full details.";
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
                  order.totalAmount.toLocaleString(),      // {{3}} Total
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
              alert(`Send Failed: ${res.error}`);
          }
      } catch (e: any) {
          alert("Network Error: " + e.message);
      } finally {
          setSendingAgreement(false);
      }
  };

  // --- GOLD RATE PROTECTION LOGIC ---
  const liabilityState = useMemo(() => {
      if (order.paymentPlan.protectionStatus !== ProtectionStatus.ACTIVE) return null;
      
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
          const wastageValue = metalValue * (item.wastagePercentage / 100);
          const laborValue = item.makingChargesPerGram * item.netWeight;
          const subTotal = metalValue + wastageValue + laborValue + item.stoneCharges;
          const tax = subTotal * (settings.defaultTaxRate / 100);
          
          return { ...item, baseMetalValue: metalValue, wastageValue, totalLaborValue: laborValue, taxAmount: tax, finalAmount: subTotal + tax };
      });

      const newTotal = updatedItems.reduce((s, i) => s + i.finalAmount, 0);
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

      const updatedOrder: Order = {
          ...order,
          items: updatedItems,
          totalAmount: newTotal,
          goldRateAtBooking: newEffectiveRate, 
          paymentPlan: {
              ...order.paymentPlan,
              milestones: newMilestones as any[],
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

  const handleUpdateItemWeight = async (itemId: string) => {
      const w = parseFloat(newWeight);
      if (!w || w <= 0) return alert("Invalid Weight");
      
      const targetItem = order.items.find(i => i.id === itemId);
      if (!targetItem) return;

      const oldWeight = targetItem.netWeight;
      const oldTotal = order.totalAmount;
      const rate = order.goldRateAtBooking; 
      
      let scaling = 1;
      if (targetItem.purity === '24K') scaling = 24/22;
      if (targetItem.purity === '18K') scaling = 18/22;
      
      const usedRate = rate * scaling;
      const metalValue = w * usedRate;
      const wastageValue = metalValue * (targetItem.wastagePercentage / 100);
      const laborValue = targetItem.makingChargesPerGram * w;
      const subTotal = metalValue + wastageValue + laborValue + targetItem.stoneCharges;
      const tax = subTotal * (settings.defaultTaxRate / 100);
      const newFinalAmount = subTotal + tax;

      const updatedItems = order.items.map(i => i.id === itemId ? {
          ...i,
          netWeight: w,
          baseMetalValue: metalValue,
          wastageValue,
          totalLaborValue: laborValue,
          taxAmount: tax,
          finalAmount: newFinalAmount
      } : i);

      const newTotal = updatedItems.reduce((s, i) => s + i.finalAmount, 0);
      const valueChange = newTotal - oldTotal;

      const newMilestones = [...order.paymentPlan.milestones];
      const last = newMilestones[newMilestones.length - 1];
      if (last.status !== 'PAID') {
          last.targetAmount += valueChange;
          last.cumulativeTarget += valueChange;
      } else {
          newMilestones.push({
              id: `ADJ-WT-${Date.now()}`,
              dueDate: new Date().toISOString().split('T')[0],
              targetAmount: valueChange,
              cumulativeTarget: newTotal,
              status: 'PENDING',
              warningCount: 0,
              description: 'Weight Adjustment'
          } as any);
      }

      const updatedOrder = { ...order, items: updatedItems, totalAmount: newTotal, paymentPlan: { ...order.paymentPlan, milestones: newMilestones } };

      try {
          await whatsappService.sendTemplateMessage(
              updatedOrder.customerContact,
              'auragold_weight_update',
              'en_US',
              [updatedOrder.customerName, targetItem.category, w.toString(), oldWeight.toString(), Math.abs(Math.round(valueChange)).toLocaleString()],
              updatedOrder.customerName
          );
      } catch (e) {}

      onOrderUpdate(updatedOrder as Order);
      setIsUpdatingWeight(null);
      setNewWeight('');
      alert("Weight updated and Customer notified.");
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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, itemId: string) => {
      if (e.target.files && e.target.files[0]) {
          try {
              const compressed = await compressImage(e.target.files[0]);
              const updatedItems = order.items.map(i => i.id === itemId ? { ...i, photoUrls: [compressed, ...i.photoUrls] } : i);
              const updatedOrder = { ...order, items: updatedItems };
              onOrderUpdate(updatedOrder as Order);

              if (confirm("Send this photo to customer via WhatsApp?")) {
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
          const wastageValue = metalValue * (item.wastagePercentage / 100);
          const laborValue = item.makingChargesPerGram * item.netWeight;
          const subTotal = metalValue + wastageValue + laborValue + item.stoneCharges;
          const tax = subTotal * (settings.defaultTaxRate / 100);
          return { ...item, baseMetalValue: metalValue, wastageValue, totalLaborValue: laborValue, taxAmount: tax, finalAmount: subTotal + tax };
      });

      const newTotal = updatedItems.reduce((s, i) => s + i.finalAmount, 0);
      const totalPaid = order.payments.reduce((acc, p) => acc + p.amount, 0);
      const remainingBalance = newTotal - totalPaid;

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

      const updatedOrder: Order = { ...order, items: updatedItems, totalAmount: newTotal, goldRateAtBooking: currentRate, paymentPlan: { ...order.paymentPlan, milestones: [...paidMilestones, ...newPendingMilestones].sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()), protectionStatus: ProtectionStatus.ACTIVE, protectionRateBooked: currentRate } };

      whatsappService.sendTemplateMessage(updatedOrder.customerContact, 'auragold_order_revised', 'en_US', [updatedOrder.customerName, updatedOrder.id, newTotal.toLocaleString(), 'Rate Repopulation', updatedOrder.shareToken], updatedOrder.customerName);
      onOrderUpdate(updatedOrder);
      alert("Order Repopulated!");
  };

  const handleLapseProtection = () => {
      if(confirm("Revoke Gold Rate Protection?")) {
          onOrderUpdate({ ...order, originalSnapshot: { timestamp: new Date().toISOString(), originalTotal: order.totalAmount, originalRate: order.goldRateAtBooking, itemsSnapshot: [...order.items], reason: 'Manual Admin Revocation' }, paymentPlan: { ...order.paymentPlan, protectionStatus: ProtectionStatus.LAPSED } });
      }
  };

  const handleRefundCancel = () => {
      if(!confirm("Cancel Order?")) return;
      onOrderUpdate({ ...order, status: OrderStatus.CANCELLED, paymentPlan: { ...order.paymentPlan, protectionStatus: ProtectionStatus.LAPSED } });
  };

  const handleHandover = () => {
      if(confirm("Confirm Handover? Marks as DELIVERED.")) {
          onOrderUpdate({ ...order, status: OrderStatus.DELIVERED, items: order.items.map(i => ({...i, productionStatus: ProductionStatus.DELIVERED})) });
          onBack(); 
      }
  };

  const isFullyPaid = order.payments.reduce((acc, p) => acc + p.amount, 0) >= order.totalAmount - 1;
  const isLapsed = order.paymentPlan.protectionStatus === ProtectionStatus.LAPSED;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 animate-fadeIn">
      <div className="flex justify-between items-center">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-bold text-sm">
          <ArrowLeft size={20} /> Back
        </button>
        <div className="flex gap-2">
           <Button size="sm" variant="secondary" onClick={handleResendAgreement} loading={sendingAgreement}><Send size={14} /> Resend Agreement</Button>
           <Button size="sm" variant="secondary" onClick={handleOpenCustomerLink}><ExternalLink size={14} /> Customer View</Button>
           <Button size="sm" variant="secondary" onClick={() => generateOrderPDF(order)}><FileText size={14} /> Contract PDF</Button>
        </div>
      </div>

      <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden">
         <div className="relative z-10">
            <h1 className="text-3xl font-black tracking-tight mb-1">{order.customerName}</h1>
            <p className="text-slate-400 font-medium text-sm flex items-center gap-4">
                <span>{order.customerContact}</span>
                <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
                <span>{order.items.length} Items</span>
                {order.status === OrderStatus.DELIVERED && <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-emerald-500/30">Archived</span>}
            </p>
         </div>
         <div className="absolute top-6 right-8">
             <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border backdrop-blur-md ${isLapsed ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'}`}>
                 {isLapsed ? <AlertTriangle size={16} /> : <Lock size={16} />}
                 <div className="text-right">
                     <p className="text-[9px] font-black uppercase tracking-widest">{isLapsed ? 'Protection Revoked' : 'Rate Protected'}</p>
                     <p className="text-sm font-bold">₹{order.paymentPlan.protectionRateBooked || order.goldRateAtBooking}/g</p>
                 </div>
             </div>
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
            <PaymentWidget order={order} onPaymentRecorded={handlePaymentUpdate} onAddLog={onAddLog} variant="FULL" />
            {order.status !== OrderStatus.DELIVERED && (
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                    <h3 className="font-black text-slate-800 text-sm uppercase tracking-wide">Contract Controls</h3>
                    <div className="flex flex-col md:flex-row gap-4">
                        {!isLapsed && <button onClick={handleLapseProtection} className="flex-1 bg-rose-50 border border-rose-100 text-rose-700 py-4 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-rose-100 transition-colors flex items-center justify-center gap-2"><AlertTriangle size={16} /> Revoke Rate Protection</button>}
                        {isFullyPaid ? <button onClick={handleHandover} className="flex-1 bg-slate-900 text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 shadow-lg"><CheckCheck size={16} /> Handover & Archive Order</button> : <div className="flex-1 border border-dashed border-slate-300 rounded-xl flex items-center justify-center text-slate-400 text-xs font-bold uppercase py-4 bg-slate-50"><Archive size={16} className="mr-2" /> Handover Locked</div>}
                    </div>
                </div>
            )}
          </div>
        )}

        {activeTab === 'LOGS' && <div className="animate-fadeIn h-[600px]"><CommunicationWidget logs={logs} customerPhone={order.customerContact} customerName={order.customerName} onLogAdded={(l) => onAddLog && onAddLog(l)} /></div>}

        {activeTab === 'ITEMS' && (
          <div className="space-y-4 animate-fadeIn">
             {order.items.map((item, idx) => (
               <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-100 flex flex-col md:flex-row gap-4 relative">
                  <div className="w-20 h-20 bg-slate-100 rounded-xl overflow-hidden shrink-0 relative group">
                    <img src={item.photoUrls[0]} className="w-full h-full object-cover" />
                    <label className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"><Camera size={16} className="text-white" /><input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoUpload(e, item.id)} /></label>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                        <div><h3 className="font-bold text-slate-800">{item.category}</h3><p className="text-xs text-slate-500">{item.purity} • {item.netWeight}g</p></div>
                        <div className="text-right"><p className="text-sm font-black text-slate-900">₹{item.finalAmount.toLocaleString()}</p><button onClick={() => setIsUpdatingWeight(item.id)} className="text-[9px] font-bold text-blue-600 flex items-center gap-1 mt-1 justify-end"><Scale size={10} /> Update Weight</button></div>
                    </div>
                    <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{Object.values(ProductionStatus).map(s => <button key={s} onClick={() => handleStatusChange(item.id, s)} className={`text-[8px] font-black uppercase px-2 py-1 rounded border ${item.productionStatus === s ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-400'}`}>{s.replace('_', ' ')}</button>)}</div>
                    {isUpdatingWeight === item.id && <div className="mt-3 bg-blue-50 p-3 rounded-xl flex gap-2 items-center animate-slideDown"><input type="number" className="flex-1 bg-white border border-blue-200 rounded-lg p-2 text-xs font-bold outline-none" placeholder="New Weight (g)" value={newWeight} onChange={e => setNewWeight(e.target.value)} /><button onClick={() => handleUpdateItemWeight(item.id)} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-[10px] font-black uppercase">Save</button><button onClick={() => setIsUpdatingWeight(null)} className="text-slate-400"><XCircle size={16}/></button></div>}
                  </div>
               </div>
             ))}
          </div>
        )}

        {activeTab === 'PROOF' && (
            <div className="animate-fadeIn space-y-6">
                <div className="bg-amber-50 border border-amber-200 rounded-[2rem] p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-4"><History size={24} className="text-amber-600" /><div><h3 className="font-black text-amber-900 text-lg">Lapse Recovery</h3><p className="text-xs text-amber-700">Contract violated.</p></div></div>
                    {order.originalSnapshot ? (
                        <div className="bg-white rounded-xl p-4 border border-amber-100 space-y-2 mb-6"><div className="flex justify-between items-center text-sm"><span className="text-slate-500 font-bold">Reason</span><span className="font-black text-rose-600 uppercase">{order.originalSnapshot.reason}</span></div><div className="flex justify-between items-center text-sm"><span className="text-slate-500 font-bold">Original Price</span><span className="font-black text-slate-800">₹{order.originalSnapshot.originalTotal.toLocaleString()}</span></div><div className="flex justify-between items-center text-sm"><span className="text-slate-500 font-bold">Original Rate</span><span className="font-black text-slate-800">₹{order.originalSnapshot.originalRate}/g</span></div></div>
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
