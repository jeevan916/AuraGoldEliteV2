import React from 'react';
import { Zap, ArrowRight, CheckCircle2, BrainCircuit, MessageSquare, FileText, ScrollText, TrendingUp } from 'lucide-react';
import { Order, OrderStatus } from '../types';
import { Card, SectionHeader, Badge, Button } from './shared/BaseUI';
import { PaymentWidget } from './clusters/PaymentWidget';

interface DashboardProps {
  orders: Order[];
  currentRates?: { k24: number, k22: number };
}

const Dashboard: React.FC<DashboardProps> = ({ orders, currentRates }) => {
  const today = new Date().toISOString().split('T')[0];
  
  // Filter: Exclude Archived/Delivered orders from "Live" Dashboard
  const liveOrders = orders.filter(o => o.status !== OrderStatus.DELIVERED && o.status !== OrderStatus.CANCELLED);

  // Logic to find overdue/due today orders
  const criticalOrders = liveOrders.filter(o => 
    o.paymentPlan.milestones.some(m => m.status !== 'PAID' && m.dueDate <= today)
  );

  return (
    <div className="space-y-8 pb-24 animate-fadeIn">
      
      {/* 1. AI CASH FLOW ENGINE (Renamed from Recovery) */}
      <div className="bg-gradient-to-r from-emerald-900 to-slate-900 rounded-[2rem] p-6 text-white relative overflow-hidden shadow-xl border border-emerald-500/30">
        <div className="relative z-10">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="font-black text-lg flex items-center gap-2 text-emerald-300">
                        <BrainCircuit className="text-amber-400" /> AI Cash Flow Engine
                    </h3>
                    <p className="text-emerald-100/60 text-xs font-medium mt-1 max-w-[200px]">
                        Payment Assurance & Gold Rate Protection Monitor active.
                    </p>
                </div>
                <button 
                    onClick={() => (window as any).dispatchView('STRATEGY')} 
                    className="bg-white text-emerald-900 px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest shadow-md hover:bg-emerald-50 transition-colors flex items-center gap-2"
                >
                    Launch Console <ArrowRight size={12} />
                </button>
            </div>
            <div className="mt-6 flex gap-3 overflow-x-auto pb-1">
                 <div className="bg-white/5 p-3 rounded-xl backdrop-blur-md border border-white/10 min-w-[100px]">
                     <p className="text-[9px] uppercase font-bold text-emerald-300 tracking-wider">Collections Due</p>
                     <p className="text-2xl font-black text-white">{criticalOrders.length}</p>
                 </div>
                 <div className="bg-white/5 p-3 rounded-xl backdrop-blur-md border border-white/10 min-w-[100px]">
                     <p className="text-[9px] uppercase font-bold text-amber-300 tracking-wider">Active Contracts</p>
                     <p className="text-2xl font-black text-white">{liveOrders.length}</p>
                 </div>
            </div>
        </div>
        {/* Decor */}
        <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-1/4 translate-y-1/4">
            <TrendingUp size={180} />
        </div>
      </div>

      {/* 2. Live Rates & Quick Links */}
      <div className="grid grid-cols-2 gap-3">
         <Card className="p-4 bg-white border-slate-200">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Standard 22K</p>
            <div className="flex items-end gap-1">
                <p className="text-xl font-black text-slate-800">₹{currentRates?.k22?.toLocaleString()}</p>
                <span className="text-[9px] font-bold text-slate-400 mb-1">/g</span>
            </div>
         </Card>
         <div className="grid grid-cols-2 gap-2">
            <button onClick={() => (window as any).dispatchView('TEMPLATES')} className="bg-blue-50 hover:bg-blue-100 rounded-2xl flex flex-col items-center justify-center text-blue-700 transition-colors">
                <FileText size={18} />
                <span className="text-[8px] font-black uppercase mt-1">Templates</span>
            </button>
            <button onClick={() => (window as any).dispatchView('LOGS')} className="bg-emerald-50 hover:bg-emerald-100 rounded-2xl flex flex-col items-center justify-center text-emerald-700 transition-colors">
                <ScrollText size={18} />
                <span className="text-[8px] font-black uppercase mt-1">Logs</span>
            </button>
         </div>
      </div>

      {/* 3. Collection Queue (Strictly active commitments) */}
      <div>
        <SectionHeader 
          title="Collection Queue" 
          subtitle="Contractual milestones requiring attention" 
          action={<Badge label={`${criticalOrders.length} Pending`} variant="danger" />}
        />
        
        <div className="space-y-4">
          {criticalOrders.length === 0 ? (
             <div className="py-12 text-center opacity-30">
               <CheckCircle2 size={48} className="mx-auto text-emerald-500 mb-2"/>
               <p className="font-bold text-xs uppercase">Cash Flow Healthy</p>
             </div>
          ) : (
            criticalOrders.map(order => (
              <div key={order.id} className="animate-fadeIn">
                <div className="flex justify-between items-center mb-2 px-1">
                  <span className="text-xs font-bold text-slate-800">{order.customerName}</span>
                  <span className="text-[9px] font-black text-rose-500 uppercase">Payment Due</span>
                </div>
                {/* PLUG AND PLAY: Using the PaymentWidget in Compact Mode */}
                <PaymentWidget 
                  order={order} 
                  variant="COMPACT" 
                  onPaymentRecorded={(updated) => console.log('Updated via Dash', updated)} 
                />
              </div>
            ))
          )}
        </div>
      </div>

      {/* 4. New Booking CTA */}
      <button 
        onClick={() => (window as any).dispatchView('ORDER_NEW')}
        className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-transform"
      >
        <Zap size={20} className="text-amber-400" /> Start New Booking
      </button>
    </div>
  );
};

export default Dashboard;