
import React, { useState } from 'react';
import { ArrowLeft, Box, CreditCard, MessageSquare, FileText, Lock, AlertTriangle, Archive, CheckCheck, History, RefreshCw, XCircle, ExternalLink } from 'lucide-react';
import { Order, GlobalSettings, WhatsAppLogEntry, ProductionStatus, ProtectionStatus, OrderStatus } from '../types';
import { generateOrderPDF } from '../services/pdfGenerator';
import { Button, SectionHeader } from './shared/BaseUI';
import { financialService } from '../services/financialService';

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

  const handleOpenCustomerLink = () => {
      const link = `${window.location.origin}/?token=${order.shareToken}`;
      window.open(link, '_blank');
  };

  const handleLapseProtection = () => {
      if(confirm("Revoke Gold Rate Protection?")) {
          const snapshot = {
              timestamp: new Date().toISOString(),
              originalTotal: order.totalAmount,
              originalRate: order.goldRateAtBooking,
              itemsSnapshot: [...order.items],
              reason: 'Manual Admin Revocation'
          };
          onOrderUpdate({ ...order, originalSnapshot: snapshot, paymentPlan: { ...order.paymentPlan, protectionStatus: ProtectionStatus.LAPSED } });
      }
  };

  const handleRepopulateOrder = () => {
      if(!confirm(`Repopulate at ₹${settings.currentGoldRate22K}?`)) return;
      const updatedOrder = financialService.repopulateOrderAtMarket(order, settings);
      onOrderUpdate(updatedOrder);
      alert("Order Updated to Market Rate.");
  };

  const isFullyPaid = order.payments.reduce((acc, p) => acc + p.amount, 0) >= order.totalAmount - 1;
  const isLapsed = order.paymentPlan.protectionStatus === ProtectionStatus.LAPSED;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 animate-fadeIn">
      <div className="flex justify-between items-center">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 font-bold text-sm hover:text-slate-900"><ArrowLeft size={20} /> Back</button>
        <div className="flex gap-2">
           <Button size="sm" variant="secondary" onClick={handleOpenCustomerLink}><ExternalLink size={14} /> View</Button>
           <Button size="sm" variant="secondary" onClick={() => generateOrderPDF(order)}><FileText size={14} /> PDF</Button>
        </div>
      </div>

      <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden">
         <div className="relative z-10">
            <h1 className="text-3xl font-black tracking-tight mb-1">{order.customerName}</h1>
            <p className="text-slate-400 font-medium text-sm">{order.customerContact} • {order.items.length} Items</p>
         </div>
         <div className="absolute top-6 right-8">
             <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border backdrop-blur-md ${isLapsed ? 'bg-rose-500/10 border-rose-500/30' : 'bg-emerald-500/10 border-emerald-500/30'}`}>
                 {isLapsed ? <AlertTriangle size={16} /> : <Lock size={16} />}
                 <div className="text-right">
                     <p className="text-[9px] font-black uppercase tracking-widest">{isLapsed ? 'Lapsed' : 'Protected'}</p>
                     <p className="text-sm font-bold">₹{order.paymentPlan.protectionRateBooked || order.goldRateAtBooking}/g</p>
                 </div>
             </div>
         </div>
      </div>

      <div className="flex bg-white p-1 rounded-2xl border shadow-sm overflow-x-auto">
        <TabButton active={activeTab === 'FINANCIAL'} onClick={() => setActiveTab('FINANCIAL'} icon={CreditCard} label="Ledger" />
        <TabButton active={activeTab === 'ITEMS'} onClick={() => setActiveTab('ITEMS'} icon={Box} label="Items" />
        <TabButton active={activeTab === 'LOGS'} onClick={() => setActiveTab('LOGS'} icon={MessageSquare} label="Chats" />
        {isLapsed && <TabButton active={activeTab === 'PROOF'} onClick={() => setActiveTab('PROOF'} icon={History} label="Recovery" />}
      </div>

      <div>
        {activeTab === 'FINANCIAL' && (
          <div className="animate-fadeIn space-y-6">
            {isLapsed && <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl text-rose-700 text-sm font-bold flex justify-between items-center">
                <span>Ledger is frozen due to lapse.</span>
                <button onClick={() => setActiveTab('PROOF')} className="underline">View Recovery Options</button>
            </div>}
            <PaymentWidget order={order} onPaymentRecorded={onOrderUpdate} onAddLog={onAddLog} variant="FULL" />
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                <Button variant={isFullyPaid ? 'primary' : 'ghost'} disabled={!isFullyPaid} className="w-full" onClick={() => onOrderUpdate({...order, status: OrderStatus.DELIVERED})}>
                    <Archive size={16} /> Mark Order Handover
                </Button>
            </div>
          </div>
        )}

        {activeTab === 'LOGS' && <div className="h-[600px]"><CommunicationWidget logs={logs} customerPhone={order.customerContact} customerName={order.customerName} onLogAdded={(l) => onAddLog && onAddLog(l)} /></div>}

        {activeTab === 'ITEMS' && <div className="space-y-4 animate-fadeIn">
             {order.items.map((item, idx) => (
               <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-100 flex gap-4">
                  <img src={item.photoUrls[0]} className="w-20 h-20 bg-slate-100 rounded-xl object-cover shrink-0" />
                  <div>
                    <h3 className="font-bold text-slate-800">{item.category}</h3>
                    <p className="text-sm font-black text-slate-900 mt-1">₹{item.finalAmount.toLocaleString()}</p>
                  </div>
               </div>
             ))}
          </div>}

        {activeTab === 'PROOF' && <div className="animate-fadeIn space-y-6">
            <div className="bg-amber-50 border border-amber-200 rounded-[2rem] p-6 shadow-sm flex flex-col gap-4">
                <div className="flex items-center gap-3">
                    <RefreshCw size={24} className="text-amber-600" />
                    <div><h3 className="font-black text-amber-900 text-lg">Repopulate at Market Rate</h3><p className="text-xs">Adjust order value to today's rates.</p></div>
                </div>
                <button onClick={handleRepopulateOrder} className="bg-emerald-600 text-white p-4 rounded-xl font-black uppercase text-xs">Update Rates & Ledger</button>
            </div>
        </div>}
      </div>
    </div>
  );
};

const TabButton = ({ active, onClick, icon: Icon, label }: any) => (
  <button onClick={onClick} className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 text-xs font-black uppercase transition-all ${active ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-50'}`}>
    <Icon size={16} /> {label}
  </button>
);

export default OrderDetails;
