
import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, Clock, MapPin, ShieldCheck, Box, CreditCard, 
  Smartphone, Lock, AlertCircle, ArrowRight, QrCode
} from 'lucide-react';
import { Order, ProductionStatus } from '../types';
import QRCode from 'qrcode';

interface CustomerOrderViewProps {
  order: Order;
}

const CustomerOrderView: React.FC<CustomerOrderViewProps> = ({ order }) => {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const totalPaid = order.payments.reduce((acc, p) => acc + p.amount, 0);
  const remaining = order.totalAmount - totalPaid;
  const nextPayment = order.paymentPlan.milestones.find(m => m.status !== 'PAID');

  useEffect(() => {
    if (remaining > 0) {
        const amount = nextPayment ? nextPayment.targetAmount : remaining;
        const upi = `upi://pay?pa=auragold@upi&pn=AuraGold%20Jewellers&tr=${order.id}&am=${amount}&cu=INR`;
        QRCode.toDataURL(upi, { margin: 2 }).then(setQrUrl);
    }
  }, [remaining, nextPayment]);

  const upiLink = `upi://pay?pa=auragold@upi&pn=AuraGold%20Jewellery&tr=${order.id}&am=${nextPayment ? nextPayment.targetAmount : remaining}&cu=INR&tn=Order%20${order.id}`;

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
          </div>
        </div>
      </div>

      <div className="px-6 -mt-16 relative z-20 space-y-6">
        
        {remaining > 0 && (
          <div className="bg-white p-6 rounded-3xl shadow-lg border border-amber-100 flex flex-col items-center">
             {qrUrl && <img src={qrUrl} className="w-40 h-40 mb-4 border p-2 rounded-xl" />}
             <div className="text-center mb-6">
                <h3 className="font-bold text-slate-800 text-lg">Balance Due: ₹{remaining.toLocaleString()}</h3>
                <p className="text-xs text-slate-500">Scan QR or tap below to pay via UPI</p>
             </div>
             <a 
              href={upiLink}
              className="w-full bg-slate-900 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 shadow-xl"
            >
              <Smartphone size={16} /> Pay via GPay / PhonePe
            </a>
          </div>
        )}

        <div className="space-y-4">
          <h3 className="text-sm font-black uppercase text-slate-400 tracking-widest ml-1">Order Status</h3>
          {order.items.map((item) => (
             <div key={item.id} className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex gap-4 items-center">
               <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-300">
                  <Box size={24} />
               </div>
               <div className="flex-1">
                 <h2 className="text-sm font-black text-slate-800">{item.category}</h2>
                 <p className="text-[10px] text-slate-500 uppercase">{item.metalColor} • {item.purity}</p>
                 <div className="mt-2 inline-block px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[9px] font-black uppercase tracking-wide">
                    {item.productionStatus}
                 </div>
               </div>
             </div>
          ))}
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2"><Clock size={16} className="text-blue-500" /> Milestone History</h3>
          <div className="space-y-3">
             {order.paymentPlan.milestones.map((m, i) => (
               <div key={i} className="flex justify-between items-center p-3 border rounded-xl bg-slate-50/50">
                 <div>
                   <p className="text-xs font-bold text-slate-700">{i === 0 ? 'Advance' : `Installment ${i}`}</p>
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
           <p className="text-[10px] font-bold text-slate-500">AuraGold Secure Order Portal</p>
        </div>
      </div>
    </div>
  );
};

export default CustomerOrderView;
