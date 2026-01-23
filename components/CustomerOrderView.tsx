
import React, { useState, useEffect, useRef } from 'react';
import { 
  CheckCircle2, Clock, MapPin, ShieldCheck, Box, CreditCard, 
  Smartphone, Lock, AlertCircle, ArrowRight, QrCode, CalendarDays, LocateFixed
} from 'lucide-react';
import { Order, ProductionStatus } from '../types';
import { errorService } from '../services/errorService';

interface CustomerOrderViewProps {
  order: Order;
}

const CustomerOrderView: React.FC<CustomerOrderViewProps> = ({ order }) => {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [locationStatus, setLocationStatus] = useState<'PENDING' | 'GRANTED' | 'DENIED'>('PENDING');
  const loggedRef = useRef(false);

  const totalPaid = order.payments.reduce((acc, p) => acc + p.amount, 0);
  const remaining = order.totalAmount - totalPaid;
  const nextPayment = order.paymentPlan.milestones.find(m => m.status !== 'PAID');

  useEffect(() => {
    // Basic View Logging on Mount (One time)
    if (!loggedRef.current) {
        loggedRef.current = true;
        // Server already logs the basic access via middleware in api/core.js
        // We add client-specific details here that server can't see (Screen size, etc)
        errorService.logActivity('USER_ACTION', `Customer viewing order: ${order.id}`, {
            orderId: order.id,
            screen: `${window.innerWidth}x${window.innerHeight}`,
            referrer: document.referrer
        });
    }

    if (remaining > 0) {
        const amount = nextPayment ? nextPayment.targetAmount : remaining;
        const upi = `upi://pay?pa=auragold@upi&pn=AuraGold%20Jewellers&tr=${order.id}&am=${amount}&cu=INR`;
        setQrUrl(`https://quickchart.io/qr?text=${encodeURIComponent(upi)}&margin=2&size=300`);
    }
  }, [remaining, nextPayment, order.id]);

  const requestLocation = () => {
      if (!navigator.geolocation) return;
      
      navigator.geolocation.getCurrentPosition(
          (pos) => {
              setLocationStatus('GRANTED');
              errorService.logActivity('GPS_VERIFIED', `Customer Location: ${order.customerName}`, {
                  lat: pos.coords.latitude,
                  lng: pos.coords.longitude,
                  accuracy: pos.coords.accuracy,
                  orderId: order.id
              });
          },
          (err) => {
              setLocationStatus('DENIED');
              console.warn("Geo denied", err);
          }
      );
  };

  const upiLink = `upi://pay?pa=auragold@upi&pn=AuraGold%20Jewellery&tr=${order.id}&am=${nextPayment ? nextPayment.targetAmount : remaining}&cu=INR&tn=Order%20${order.id}`;

  const displayMilestones = showOriginal && order.paymentPlan.originalMilestones 
      ? order.paymentPlan.originalMilestones 
      : order.paymentPlan.milestones;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-slate-900 text-white p-6 pb-24 rounded-b-[3rem] shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-2xl font-black text-amber-500 tracking-tighter">AuraGold</h1>
              <p className="text-[10px] uppercase font-bold tracking-widest opacity-60">Customer Portal</p>
            </div>
            <div className="flex flex-col gap-2 items-end">
                <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/20">
                    <span className="text-[10px] font-bold flex items-center gap-1">
                        <Lock size={10} /> Secure View
                    </span>
                </div>
                {locationStatus === 'PENDING' && (
                    <button onClick={requestLocation} className="text-[9px] bg-emerald-500/20 hover:bg-emerald-500/40 border border-emerald-500/50 text-emerald-300 px-2 py-1 rounded-full flex items-center gap-1 transition-colors">
                        <LocateFixed size={10} /> Enable Location Security
                    </button>
                )}
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
             {qrUrl && <img src={qrUrl} className="w-40 h-40 mb-4 border p-2 rounded-xl" alt="Payment QR" />}
             <div className="text-center mb-6">
                <h3 className="font-bold text-slate-800 text-lg">Balance Due: ₹{remaining.toLocaleString()}</h3>
                <p className="text-xs text-slate-500">Scan QR or tap below to pay via UPI</p>
             </div>
             <a 
              href={upiLink}
              className="w-full bg-slate-900 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all"
            >
              <Smartphone size={16} /> Pay via GPay / PhonePe
            </a>
          </div>
        )}

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
          <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <CalendarDays size={16} className="text-blue-500" /> Payment Schedule
              </h3>
              {order.paymentPlan.originalMilestones && (
                  <div className="flex bg-slate-100 p-1 rounded-lg">
                      <button 
                          onClick={() => setShowOriginal(false)}
                          className={`px-3 py-1 rounded-md text-[9px] font-black uppercase transition-all ${!showOriginal ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}
                      >
                          Current
                      </button>
                      <button 
                          onClick={() => setShowOriginal(true)}
                          className={`px-3 py-1 rounded-md text-[9px] font-black uppercase transition-all ${showOriginal ? 'bg-white shadow text-slate-600' : 'text-slate-400'}`}
                      >
                          Original
                      </button>
                  </div>
              )}
          </div>
          
          <div className="space-y-4 relative before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100">
             {displayMilestones.map((m, i) => {
               const isPaid = m.status === 'PAID';
               const isOverdue = m.status !== 'PAID' && new Date(m.dueDate) < new Date();
               const isOriginalView = showOriginal;
               
               return (
                 <div key={i} className={`flex gap-4 relative ${isOriginalView ? 'opacity-70 grayscale' : ''}`}>
                   <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-4 border-white z-10 ${isPaid && !isOriginalView ? 'bg-emerald-100 text-emerald-600' : isOverdue && !isOriginalView ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-400'}`}>
                      {isPaid && !isOriginalView ? <CheckCircle2 size={16} /> : <Clock size={16} />}
                   </div>
                   <div className="flex-1 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                     <div className="flex justify-between items-start mb-1">
                       <div>
                         <p className="text-xs font-bold text-slate-700">{m.description || (i === 0 ? 'Advance' : `Installment ${i}`)}</p>
                         <p className="text-[10px] text-slate-400 font-medium">{new Date(m.dueDate).toLocaleDateString()}</p>
                       </div>
                       <div className="text-right">
                         <p className={`text-sm font-black ${isPaid && !isOriginalView ? 'text-emerald-600' : 'text-slate-800'}`}>₹{m.targetAmount.toLocaleString()}</p>
                       </div>
                     </div>
                     <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full inline-block ${isPaid && !isOriginalView ? 'bg-emerald-100 text-emerald-700' : isOverdue && !isOriginalView ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-600'}`}>
                        {isOriginalView ? 'Snapshot' : (isPaid ? 'Paid Successfully' : isOverdue ? 'Overdue' : 'Scheduled')}
                     </span>
                   </div>
                 </div>
               );
             })}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-black uppercase text-slate-400 tracking-widest ml-1">Order Details</h3>
          {order.items.map((item) => (
             <div key={item.id} className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex gap-4 items-center">
               <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-300 overflow-hidden">
                  {item.photoUrls?.[0] ? <img src={item.photoUrls[0]} className="w-full h-full object-cover" /> : <Box size={24} />}
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

        <div className="text-center pb-8 opacity-40">
           <p className="text-[10px] font-bold text-slate-500">AuraGold Secure Order Portal</p>
        </div>
      </div>
    </div>
  );
};

export default CustomerOrderView;
