
import React, { useState } from 'react';
import { ArrowLeft, Box, CreditCard, MessageSquare, FileText, Lock, AlertTriangle, Archive, CheckCheck, History, Eye, RefreshCw, XCircle, ExternalLink, Share2 } from 'lucide-react';
import { Order, GlobalSettings, WhatsAppLogEntry, ProductionStatus, ProtectionStatus, OrderStatus } from '../types';
import { generateOrderPDF } from '../services/pdfGenerator';
import { Button, SectionHeader } from './shared/BaseUI';

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
    order, onBack, onOrderUpdate, logs = [], onAddLog, settings
}) => {
  const [activeTab, setActiveTab] = useState<'ITEMS' | 'FINANCIAL' | 'LOGS' | 'PROOF'>('FINANCIAL');

  const handlePaymentUpdate = (updatedOrder: Order) => {
    onOrderUpdate(updatedOrder);
  };

  const handleOpenCustomerLink = () => {
      const link = `${window.location.origin}/?token=${order.shareToken}`;
      window.open(link, '_blank');
  };

  const handleLapseProtection = () => {
      if(confirm("Are you sure you want to REVOKE Gold Rate Protection? The customer will be liable for current market rates.")) {
          const snapshot = {
              timestamp: new Date().toISOString(),
              originalTotal: order.totalAmount,
              originalRate: order.goldRateAtBooking,
              itemsSnapshot: [...order.items],
              reason: 'Manual Admin Revocation'
          };
          const updated = {
              ...order,
              originalSnapshot: snapshot,
              paymentPlan: {
                  ...order.paymentPlan,
                  protectionStatus: ProtectionStatus.LAPSED
              }
          };
          onOrderUpdate(updated);
      }
  };

  const handleRepopulateOrder = () => {
      if(!confirm(`Recalculate order at current rate of ₹${settings.currentGoldRate22K}/g? This will compress remaining payments.`)) return;

      const currentRate = settings.currentGoldRate22K;
      
      // 1. Recalculate Items
      const updatedItems = order.items.map(item => {
          const metalValue = item.netWeight * currentRate;
          const wastageValue = metalValue * (item.wastagePercentage / 100);
          const laborValue = item.makingChargesPerGram * item.netWeight;
          const subTotal = metalValue + wastageValue + laborValue + item.stoneCharges;
          const tax = subTotal * (settings.defaultTaxRate / 100);
          return {
              ...item,
              baseMetalValue: metalValue,
              wastageValue,
              totalLaborValue: laborValue,
              taxAmount: tax,
              finalAmount: subTotal + tax
          };
      });

      const newTotal = updatedItems.reduce((s, i) => s + i.finalAmount, 0);
      const totalPaid = order.payments.reduce((acc, p) => acc + p.amount, 0);
      const remainingBalance = newTotal - totalPaid;

      // 2. Recalculate Milestones (Compress into existing timeline)
      // Filter out PAID milestones
      const paidMilestones = order.paymentPlan.milestones.filter(m => m.status === 'PAID');
      const pendingMilestones = order.paymentPlan.milestones.filter(m => m.status !== 'PAID');

      if (pendingMilestones.length === 0 && remainingBalance > 0) {
          // Edge case: All milestones marked paid but rate increased balance. Add 'Final Adjustment' milestone.
          pendingMilestones.push({
              id: `ADJ-${Date.now()}`,
              dueDate: order.paymentPlan.milestones[order.paymentPlan.milestones.length - 1].dueDate, // Same last date
              targetAmount: 0,
              cumulativeTarget: 0,
              status: 'PENDING',
              warningCount: 0
          });
      }

      // Distribute remaining balance equally among pending milestones
      const newPerMilestone = Math.round(remainingBalance / pendingMilestones.length);
      let runningSum = totalPaid;

      const newPendingMilestones = pendingMilestones.map((m, idx) => {
          const amount = (idx === pendingMilestones.length - 1) 
              ? (remainingBalance - (newPerMilestone * (pendingMilestones.length - 1))) // Handle rounding on last one
              : newPerMilestone;
          
          runningSum += amount;
          return {
              ...m,
              targetAmount: amount,
              cumulativeTarget: runningSum,
              status: 'PENDING' as const, // Reset status logic just in case, though they were pending
              warningCount: 0 // Reset warnings
          };
      });

      const newMilestones = [...paidMilestones, ...newPendingMilestones].sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

      // 3. Commit Update
      const updatedOrder: Order = {
          ...order,
          items: updatedItems,
          totalAmount: newTotal,
          goldRateAtBooking: currentRate,
          status: OrderStatus.ACTIVE, // Reactivate
          paymentPlan: {
              ...order.paymentPlan,
              milestones: newMilestones,
              protectionStatus: ProtectionStatus.ACTIVE, // Re-protect at new rate
              protectionRateBooked: currentRate
          }
      };

      onOrderUpdate(updatedOrder);
      alert("Order Repopulated! Client is now on the new rate.");
  };

  const handleRefundCancel = () => {
      if(!confirm("Process Refund & Cancel Order? This action terminates the contract.")) return;
      
      const updated: Order = {
          ...order,
          status: OrderStatus.CANCELLED,
          paymentPlan: {
              ...order.paymentPlan,
              protectionStatus: ProtectionStatus.LAPSED // Remains lapsed/cancelled
          }
      };
      onOrderUpdate(updated);
      alert("Order Cancelled. Please process manual refund of collected amount.");
  };

  const handleHandover = () => {
      if(confirm("Confirm Handover: This will mark the order as DELIVERED and move it to the Archive. This action is final.")) {
          const updated = {
              ...order,
              status: OrderStatus.DELIVERED,
              items: order.items.map(i => ({...i, productionStatus: ProductionStatus.DELIVERED}))
          };
          onOrderUpdate(updated);
          onBack(); // Go back to dashboard
      }
  };

  const isFullyPaid = order.payments.reduce((acc, p) => acc + p.amount, 0) >= order.totalAmount - 1;
  const isLapsed = order.paymentPlan.protectionStatus === ProtectionStatus.LAPSED;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 animate-fadeIn">
      
      {/* 1. Universal Header */}
      <div className="flex justify-between items-center">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-bold text-sm">
          <ArrowLeft size={20} /> Back
        </button>
        <div className="flex gap-2">
           <Button size="sm" variant="secondary" onClick={handleOpenCustomerLink}>
             <ExternalLink size={14} /> Customer View
           </Button>
           <Button size="sm" variant="secondary" onClick={() => generateOrderPDF(order)}>
             <FileText size={14} /> Contract PDF
           </Button>
        </div>
      </div>

      <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden">
         <div className="relative z-10">
            <h1 className="text-3xl font-black tracking-tight mb-1">{order.customerName}</h1>
            <p className="text-slate-400 font-medium text-sm flex items-center gap-4">
                <span>{order.customerContact}</span>
                <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
                <span>{order.items.length} Items</span>
                {order.status === OrderStatus.DELIVERED && (
                    <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border border-emerald-500/30">Archived</span>
                )}
            </p>
         </div>
         
         {/* Rate Protection Status Indicator */}
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

      {/* 2. Navigation Tabs */}
      <div className="flex bg-white p-1 rounded-2xl border shadow-sm overflow-x-auto">
        <TabButton active={activeTab === 'FINANCIAL'} onClick={() => setActiveTab('FINANCIAL')} icon={CreditCard} label="Ledger & Pay" />
        <TabButton active={activeTab === 'ITEMS'} onClick={() => setActiveTab('ITEMS')} icon={Box} label="Items" />
        <TabButton active={activeTab === 'LOGS'} onClick={() => setActiveTab('LOGS')} icon={MessageSquare} label="Chats" />
        {isLapsed && <TabButton active={activeTab === 'PROOF'} onClick={() => setActiveTab('PROOF')} icon={History} label="Lapse Recovery" />}
      </div>

      {/* 3. Plug & Play Content Zones */}
      <div>
        {activeTab === 'FINANCIAL' && (
          <div className="animate-fadeIn space-y-6">
            
            {/* If Lapsed, show Alert Banner directing to Recovery Tab */}
            {isLapsed && (
                <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex justify-between items-center">
                    <div className="flex items-center gap-3 text-rose-700">
                        <AlertTriangle size={20} />
                        <div>
                            <p className="font-bold text-sm">Contract Lapsed</p>
                            <p className="text-xs">Ledger is frozen. Go to 'Lapse Recovery' to handle.</p>
                        </div>
                    </div>
                    <button onClick={() => setActiveTab('PROOF')} className="text-xs font-black bg-rose-200 text-rose-800 px-3 py-2 rounded-lg hover:bg-rose-300">Fix Now</button>
                </div>
            )}

            {/* Plugging in the Payment Cluster */}
            <PaymentWidget 
              order={order} 
              onPaymentRecorded={handlePaymentUpdate}
              onAddLog={onAddLog}
              variant="FULL"
            />

            {/* Lifecycle Controls */}
            {order.status !== OrderStatus.DELIVERED && (
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                    <h3 className="font-black text-slate-800 text-sm uppercase tracking-wide">Contract Controls</h3>
                    <div className="flex flex-col md:flex-row gap-4">
                        {!isLapsed && (
                            <button 
                                onClick={handleLapseProtection}
                                className="flex-1 bg-rose-50 border border-rose-100 text-rose-700 py-4 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-rose-100 transition-colors flex items-center justify-center gap-2"
                            >
                                <AlertTriangle size={16} /> Revoke Rate Protection
                            </button>
                        )}
                        
                        {isFullyPaid ? (
                            <button 
                                onClick={handleHandover}
                                className="flex-1 bg-slate-900 text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 shadow-lg"
                            >
                                <CheckCheck size={16} /> Handover & Archive Order
                            </button>
                        ) : (
                            <div className="flex-1 border border-dashed border-slate-300 rounded-xl flex items-center justify-center text-slate-400 text-xs font-bold uppercase tracking-widest py-4 bg-slate-50">
                                <Archive size={16} className="mr-2" /> Handover Locked (Pending Dues)
                            </div>
                        )}
                    </div>
                    <p className="text-[10px] text-slate-400 text-center">
                        Actions taken here are legally binding based on the contract terms. Archiving removes this order from live metrics.
                    </p>
                </div>
            )}
          </div>
        )}

        {activeTab === 'LOGS' && (
          <div className="animate-fadeIn h-[600px]">
            {/* Plugging in the Communication Cluster */}
            <CommunicationWidget 
              logs={logs}
              customerPhone={order.customerContact}
              customerName={order.customerName}
              onLogAdded={(l) => onAddLog && onAddLog(l)}
            />
          </div>
        )}

        {activeTab === 'ITEMS' && (
          <div className="space-y-4 animate-fadeIn">
             {order.items.map((item, idx) => (
               <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-100 flex gap-4">
                  <div className="w-20 h-20 bg-slate-100 rounded-xl overflow-hidden shrink-0">
                    <img src={item.photoUrls[0]} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">{item.category}</h3>
                    <p className="text-xs text-slate-500">{item.purity} • {item.netWeight}g</p>
                    <p className="text-sm font-black text-slate-900 mt-1">₹{item.finalAmount.toLocaleString()}</p>
                  </div>
               </div>
             ))}
          </div>
        )}

        {activeTab === 'PROOF' && (
            <div className="animate-fadeIn space-y-6">
                <div className="bg-amber-50 border border-amber-200 rounded-[2rem] p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <History size={24} className="text-amber-600" />
                        <div>
                            <h3 className="font-black text-amber-900 text-lg">Lapse Recovery Interface</h3>
                            <p className="text-xs text-amber-700">Contract violated. Awaiting customer decision.</p>
                        </div>
                    </div>
                    
                    {order.originalSnapshot ? (
                        <div className="bg-white rounded-xl p-4 border border-amber-100 space-y-2 mb-6">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 font-bold">Lapse Reason</span>
                                <span className="font-black text-rose-600 uppercase">{order.originalSnapshot.reason}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 font-bold">Original Locked Price</span>
                                <span className="font-black text-slate-800">₹{order.originalSnapshot.originalTotal.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 font-bold">Original Rate</span>
                                <span className="font-black text-slate-800">₹{order.originalSnapshot.originalRate}/g</span>
                            </div>
                        </div>
                    ) : (
                        <div className="text-xs text-amber-600 mb-4 italic">No lapse snapshot available. Order was manually lapsed without snapshot.</div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4">
                        <button 
                            onClick={handleRepopulateOrder}
                            className="bg-emerald-600 text-white p-4 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-emerald-700 shadow-lg active:scale-95 transition-all"
                        >
                            <RefreshCw size={24} />
                            <div className="text-center">
                                <span className="block font-black text-xs uppercase tracking-widest">Repopulate</span>
                                <span className="text-[9px] opacity-80">Accept New Rate (₹{settings.currentGoldRate22K}/g)</span>
                            </div>
                        </button>
                        
                        <button 
                            onClick={handleRefundCancel}
                            className="bg-rose-600 text-white p-4 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-rose-700 shadow-lg active:scale-95 transition-all"
                        >
                            <XCircle size={24} />
                            <div className="text-center">
                                <span className="block font-black text-xs uppercase tracking-widest">Refund</span>
                                <span className="text-[9px] opacity-80">Cancel & Return Funds</span>
                            </div>
                        </button>
                    </div>
                    
                    <p className="text-[9px] text-amber-800/60 text-center mt-4">
                        *Repopulating will update all items to current market price and compress remaining due into the existing timeline.
                    </p>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

const TabButton = ({ active, onClick, icon: Icon, label }: any) => (
  <button 
    onClick={onClick}
    className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest transition-all ${active ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
  >
    <Icon size={16} /> {label}
  </button>
);

export default OrderDetails;
