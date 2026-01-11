
import React from 'react';
import { 
  CheckCircle2, Clock, MapPin, ShieldCheck, Box, CreditCard, 
  Smartphone, Lock, AlertCircle, ArrowRight 
} from 'lucide-react';
import { Order, ProductionStatus } from '../types';

interface CustomerOrderViewProps {
  order: Order;
}

const CustomerOrderView: React.FC<CustomerOrderViewProps> = ({ order }) => {
  const totalPaid = order.payments.reduce((acc, p) => acc + p.amount, 0);
  const remaining = order.totalAmount - totalPaid;
  const nextPayment = order.paymentPlan.milestones.find(m => m.status !== 'PAID');

  const merchantVPA = "auragold@upi"; 
  const upiLink = `upi://pay?pa=${merchantVPA}&pn=AuraGold%20Jewellery&tr=${order.id}&am=${nextPayment ? nextPayment.targetAmount : remaining}&cu=INR&tn=Order%20${order.id}`;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-slate-900 text-white p-6 pb-24 rounded-b-[3rem] shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-2xl font-black text-amber-500 tracking-tighter">AuraGold</h1>
              <p className="text-[10px] uppercase font-bold tracking-widest opacity-60">Customer Portal</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/20">
               <span className="text-[10px] font-bold flex items-center gap-1">
                 <Lock size={10} /> Secure View
               </span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-black uppercase opacity-50 tracking-widest mb-2">Total Order Value</p>
            <p className="text-5xl font-black text-white">₹{order.totalAmount.toLocaleString()}</p>
            <p className="text-sm font-medium opacity-70 mt-2">{order.items.length} Item(s) in Order</p>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500 opacity-10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
      </div>

      <div className="px-6 -mt-16 relative z-20 space-y-6">
        
        {/* Items List */}
        <div className="space-y-4">
          {order.items.map((item, idx) => (
             <div key={item.id} className="bg-white p-4 rounded-3xl shadow-lg border border-slate-100 flex gap-4 items-center">
               <div className="w-20 h-20 bg-slate-100 rounded-2xl overflow-hidden shrink-0 border">
                  {item.photoUrls && item.photoUrls.length > 0 ? (
                    <img src={item.photoUrls[0]} className="w-full h-full object-cover" alt="Jewelry" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300"><Box size={24} /></div>
                  )}
               </div>
               <div className="flex-1">
                 <h2 className="text-lg font-black text-slate-800">{item.category}</h2>
                 <p className="text-xs text-slate-500 mb-2">{item.metalColor} • {item.purity}</p>
                 <div className="inline-block px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-[10px] font-black uppercase tracking-wide">
                    {item.productionStatus}
                 </div>
               </div>
             </div>
          ))}
        </div>

        {/* Financial Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Paid So Far</p>
            <p className="text-xl font-black text-emerald-600">₹{totalPaid.toLocaleString()}</p>
          </div>
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Balance Due</p>
            <p className="text-xl font-black text-rose-500">₹{remaining.toLocaleString()}</p>
          </div>
        </div>

        {/* Payment Action */}
        {remaining > 0 && (
          <div className="bg-white p-6 rounded-3xl shadow-lg border border-amber-100">
            <div className="flex justify-between items-start mb-4">
               <div>
                 <h3 className="font-bold text-slate-800 flex items-center gap-2"><CreditCard size={18} className="text-amber-500" /> Payment Due</h3>
                 <p className="text-xs text-slate-500 mt-1">Next installment is pending.</p>
               </div>
               {nextPayment && (
                 <div className="text-right">
                   <p className="text-[10px] font-black uppercase text-slate-400">Due Date</p>
                   <p className="text-xs font-bold text-rose-500">{new Date(nextPayment.dueDate).toLocaleDateString()}</p>
                 </div>
               )}
            </div>
            
            <a 
              href={upiLink}
              className="w-full bg-slate-900 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 hover:bg-slate-800 transition-all shadow-xl"
            >
              <Smartphone size={16} /> Pay ₹{(nextPayment ? nextPayment.targetAmount : remaining).toLocaleString()} via UPI
            </a>
            <p className="text-[10px] text-center text-slate-400 mt-3 flex items-center justify-center gap-1">
              <ShieldCheck size={12} /> Secure Payment to AuraGold Business
            </p>
          </div>
        )}

        {/* Ledger */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2"><Clock size={16} className="text-blue-500" /> Payment Schedule</h3>
          <div className="space-y-3">
             {order.paymentPlan.milestones.map((m, i) => (
               <div key={i} className="flex justify-between items-center p-3 border rounded-xl bg-slate-50/50">
                 <div>
                   <p className="text-xs font-bold text-slate-700">{i === 0 ? 'Initial Advance' : `Installment ${i}`}</p>
                   <p className="text-[10px] text-slate-400">{new Date(m.dueDate).toLocaleDateString()}</p>
                 </div>
                 <div className="text-right">
                   <p className="text-xs font-black text-slate-800">₹{m.targetAmount.toLocaleString()}</p>
                   <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${m.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                     {m.status}
                   </span>
                 </div>
               </div>
             ))}
          </div>
        </div>

        <div className="text-center pb-8 opacity-40">
           <p className="text-[10px] font-bold text-slate-500">Powered by AuraGold Backend System</p>
        </div>
      </div>
    </div>
  );
};

export default CustomerOrderView;
