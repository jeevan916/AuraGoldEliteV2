import React, { useState } from 'react';
import { ArrowLeft, Box, CreditCard, MessageSquare, FileText, Lock, AlertTriangle, Archive, CheckCheck, History, RefreshCw, XCircle, ExternalLink } from 'lucide-react';
import { Order, GlobalSettings, WhatsAppLogEntry, ProductionStatus, ProtectionStatus, OrderStatus } from '../types';
import { generateOrderPDF } from '../services/pdfGenerator';
import { Button, SectionHeader } from './shared/BaseUI';
import { pricingService } from '../services/pricingService';
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

const OrderDetails: React.FC<OrderDetailsProps> = ({ order, onBack, onOrderUpdate, logs = [], onAddLog, settings }) => {
  const [activeTab, setActiveTab] = useState<'ITEMS' | 'FINANCIAL' | 'LOGS' | 'PROOF'>('FINANCIAL');

  const handleOpenCustomerLink = () => window.open(`${window.location.origin}/?token=${order.shareToken}`, '_blank');

  const handleLapseProtection = () => {
      if(confirm("REVOKE Gold Rate Protection?")) {
          onOrderUpdate({
              ...order,
              originalSnapshot: { timestamp: new Date().toISOString(), originalTotal: order.totalAmount, originalRate: order.goldRateAtBooking, itemsSnapshot: [...order.items], reason: 'Manual Revocation' },
              paymentPlan: { ...order.paymentPlan, protectionStatus: ProtectionStatus.LAPSED }
          });
      }
  };

  const handleRepopulateOrder = () => {
      if(!confirm(`Recalculate at market rate (₹${settings.currentGoldRate24K}/g)?`)) return;
      const updatedOrder = pricingService.repopulateOrderAtMarketRate(order, settings.currentGoldRate24K, settings);
      onOrderUpdate(updatedOrder);
      alert("Order Repopulated!");
  };

  const handleHandover = () => {
      if(confirm("Confirm Final Handover?")) {
          onOrderUpdate({ ...order, status: OrderStatus.DELIVERED, items: order.items.map(i => ({...i, productionStatus: ProductionStatus.DELIVERED})) });
          onBack();
      }
  };

  const totalPaid = order.payments.reduce((acc, p) => acc + p.amount, 0);
  const isFullyPaid = pricingService.round(totalPaid) >= pricingService.round(order.totalAmount);
  const isLapsed = order.paymentPlan.protectionStatus === ProtectionStatus.LAPSED;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 animate-fadeIn">
      <div className="flex justify-between items-center">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 font-bold text-sm leading-none"><ArrowLeft size={20} /> Back</button>
        <div className="flex gap-2">
           <Button size="sm" variant="secondary" onClick={handleOpenCustomerLink}><ExternalLink size={14} /> Portal</Button>
           <Button size="sm" variant="secondary" onClick={() => generateOrderPDF(order)}><FileText size={14} /> PDF</Button>
        </div>
      </div>

      <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden">
         <div className="relative z-10">
            <h1 className="text-3xl font-black mb-1">{order.customerName}</h1>
            <p className="text-slate-400 text-sm flex items-center gap-4">
                <span>{order.customerContact}</span>
                <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
                <span>{order.items.length} Items</span>
            </p>
         </div>
         <div className="absolute top-6 right-8">
             <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border backdrop-blur-md ${isLapsed ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'}`}>
                 {isLapsed ? <AlertTriangle size={16} /> : <Lock size={16} />}
                 <div className="text-right">
                     <p className="text-[9px] font-black uppercase">{isLapsed ? 'Lapsed' : 'Locked'}</p>
                     <p className="text-sm font-bold">₹{order.goldRateAtBooking}/g</p>
                 </div>
             </div>
         </div>
      </div>

      <div className="flex bg-white p-1 rounded-2xl border shadow-sm">
        <TabButton active={activeTab === 'FINANCIAL'} onClick={() => setActiveTab('FINANCIAL')} icon={CreditCard} label="Ledger" />
        <TabButton active={activeTab === 'ITEMS'} onClick={() => setActiveTab('ITEMS')} icon={Box} label="Items" />
        <TabButton active={activeTab === 'LOGS'} onClick={() => setActiveTab('LOGS')} icon={MessageSquare} label="Chats" />
        {isLapsed && <TabButton active={activeTab === 'PROOF'} onClick={() => setActiveTab('PROOF')} icon={History} label="Recovery" />}
      </div>

      <div>
        {activeTab === 'FINANCIAL' && (
          <div className="animate-fadeIn space-y-6">
            <PaymentWidget order={order} onPaymentRecorded={onOrderUpdate} onAddLog={onAddLog} variant="FULL" />
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                <h3 className="font-black text-slate-800 text-sm uppercase">Contract Controls</h3>
                <div className="flex gap-4">
                    {!isLapsed && <button onClick={handleLapseProtection} className="flex-1 bg-rose-50 text-rose-700 py-4 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2"><AlertTriangle size={16} /> Revoke Protection</button>}
                    {isFullyPaid ? <button onClick={handleHandover} className="flex-1 bg-slate-900 text-white py-4 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 shadow-lg"><CheckCheck size={16} /> Final Handover</button> : <div className="flex-1 border border-dashed border-slate-300 rounded-xl flex items-center justify-center text-slate-400 text-xs font-bold py-4 bg-slate-50"><Archive size={16} className="mr-2" /> Dues Pending</div>}
                </div>
            </div>
          </div>
        )}

        {activeTab === 'LOGS' && <div className="animate-fadeIn h-[600px]"><CommunicationWidget logs={logs} customerPhone={order.customerContact} customerName={order.customerName} onLogAdded={(l) => onAddLog && onAddLog(l)} /></div>}

        {activeTab === 'ITEMS' && (
          <div className="space-y-4 animate-fadeIn">
             {order.items.map((item, idx) => (
               <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-100 flex gap-4">
                  <div className="w-20 h-20 bg-slate-100 rounded-xl overflow-hidden shrink-0"><img src={item.photoUrls[0]} className="w-full h-full object-cover" /></div>
                  <div><h3 className="font-bold text-slate-800">{item.category}</h3><p className="text-xs text-slate-500">{item.purity} • {item.netWeight}g</p><p className="text-sm font-black text-slate-900 mt-1">₹{item.finalAmount.toLocaleString()}</p></div>
               </div>
             ))}
          </div>
        )}

        {activeTab === 'PROOF' && (
            <div className="animate-fadeIn space-y-6">
                <div className="bg-amber-50 border border-amber-200 rounded-[2rem] p-6">
                    <div className="flex items-center gap-3 mb-4"><History size={24} className="text-amber-600" /><div><h3 className="font-black text-amber-900 text-lg">Recovery Interface</h3><p className="text-xs text-amber-700">Contract violated.</p></div></div>
                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={handleRepopulateOrder} className="bg-emerald-600 text-white p-4 rounded-xl flex flex-col items-center gap-2 shadow-lg"><RefreshCw size={24} /><span className="font-black text-xs uppercase">Accept New Rate</span></button>
                        <button onClick={() => onOrderUpdate({...order, status: OrderStatus.CANCELLED})} className="bg-rose-600 text-white p-4 rounded-xl flex flex-col items-center gap-2 shadow-lg"><XCircle size={24} /><span className="font-black text-xs uppercase">Refund & Cancel</span></button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

const TabButton = ({ active, onClick, icon: Icon, label }: any) => (
  <button onClick={onClick} className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 text-xs font-black uppercase transition-all ${active ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}><Icon size={16} /> {label}</button>
);

export default OrderDetails;