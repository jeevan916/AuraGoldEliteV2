import React, { useState } from 'react';
import { ArrowLeft, Box, CreditCard, MessageSquare, FileText, Lock, AlertTriangle, Archive, CheckCheck } from 'lucide-react';
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
    order, onBack, onOrderUpdate, logs = [], onAddLog 
}) => {
  const [activeTab, setActiveTab] = useState<'ITEMS' | 'FINANCIAL' | 'LOGS'>('FINANCIAL');

  const handlePaymentUpdate = (updatedOrder: Order) => {
    onOrderUpdate(updatedOrder);
  };

  const handleLapseProtection = () => {
      if(confirm("Are you sure you want to REVOKE Gold Rate Protection? The customer will be liable for current market rates.")) {
          const updated = {
              ...order,
              paymentPlan: {
                  ...order.paymentPlan,
                  protectionStatus: ProtectionStatus.LAPSED
              }
          };
          onOrderUpdate(updated);
      }
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
      <div className="flex bg-white p-1 rounded-2xl border shadow-sm">
        <TabButton active={activeTab === 'FINANCIAL'} onClick={() => setActiveTab('FINANCIAL')} icon={CreditCard} label="Ledger & Pay" />
        <TabButton active={activeTab === 'ITEMS'} onClick={() => setActiveTab('ITEMS')} icon={Box} label="Items" />
        <TabButton active={activeTab === 'LOGS'} onClick={() => setActiveTab('LOGS')} icon={MessageSquare} label="Chats" />
      </div>

      {/* 3. Plug & Play Content Zones */}
      <div>
        {activeTab === 'FINANCIAL' && (
          <div className="animate-fadeIn space-y-6">
            {/* Plugging in the Payment Cluster */}
            <PaymentWidget 
              order={order} 
              onPaymentRecorded={handlePaymentUpdate}
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