
import React, { useState, useEffect, useRef } from 'react';
import { 
  CheckCircle2, Clock, MapPin, ShieldCheck, Box, CreditCard, 
  Smartphone, Lock, AlertCircle, ArrowRight, QrCode, CalendarDays, 
  LocateFixed, ReceiptIndianRupee, TrendingUp, ChevronDown, ChevronUp, Scale, Info, ShieldAlert
} from 'lucide-react';
import { Order, ProductionStatus, ProtectionStatus } from '../types';
import { errorService } from '../services/errorService';
import { goldRateService } from '../services/goldRateService';

interface CustomerOrderViewProps {
  order: Order;
}

const CustomerOrderView: React.FC<CustomerOrderViewProps> = ({ order }) => {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [locationStatus, setLocationStatus] = useState<'PENDING' | 'GRANTED' | 'DENIED'>('PENDING');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [liveRate, setLiveRate] = useState<number>(0);
  const loggedRef = useRef(false);

  const totalPaid = order.payments.reduce((acc, p) => acc + p.amount, 0);
  const remaining = order.totalAmount - totalPaid;
  const nextPayment = order.paymentPlan.milestones.find(m => m.status !== 'PAID');

  useEffect(() => {
    // 1. Log Access
    if (!loggedRef.current) {
        loggedRef.current = true;
        errorService.logActivity('USER_ACTION', `Customer viewing order: ${order.id}`, {
            orderId: order.id,
            screen: `${window.innerWidth}x${window.innerHeight}`,
            referrer: document.referrer
        });
    }

    // 2. QR Code Gen
    if (remaining > 0) {
        const amount = nextPayment ? nextPayment.targetAmount : remaining;
        const upi = `upi://pay?pa=st.sanghavijeweller@pineaxis&pn=Sanghavi%20Jewellers&tr=${order.id}&am=${amount}&cu=INR`;
        setQrUrl(`https://quickchart.io/qr?text=${encodeURIComponent(upi)}&margin=2&size=300`);
    }

    // 3. Fetch Live Rate for Protection Monitor
    const fetchRate = async () => {
        const res = await goldRateService.fetchLiveRate();
        if (res.success) {
            setLiveRate(res.rate22K);
        }
    };
    fetchRate();
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

  const upiLink = `upi://pay?pa=st.sanghavijeweller@pineaxis&pn=Sanghavi%20Jewellers&tr=${order.id}&am=${nextPayment ? nextPayment.targetAmount : remaining}&cu=INR&tn=Order%20${order.id}`;

  const displayMilestones = showOriginal && order.paymentPlan.originalMilestones 
      ? order.paymentPlan.originalMilestones 
      : order.paymentPlan.milestones;

  // PROTECTION CALCS
  const bookedRate = order.paymentPlan.protectionRateBooked || order.goldRateAtBooking;
  const protectionLimit = order.paymentPlan.protectionLimit || 0; // Max Allowed Increase
  const maxProtectedRate = bookedRate + protectionLimit;
  
  const isProtected = order.paymentPlan.protectionStatus === ProtectionStatus.ACTIVE;
  
  // Logic: 
  // 1. Savings = If Live Rate > Booked Rate (But under Limit)
  // 2. Liability = If Live Rate > MaxProtectedRate (Limit Breached)
  
  const totalGoldWeight = order.items.reduce((sum, item) => item.metalColor !== 'Silver' ? sum + item.netWeight : sum, 0);
  
  const isLimitBreached = liveRate > maxProtectedRate;
  const surchargePerGram = isLimitBreached ? liveRate - maxProtectedRate : 0;
  const savingsPerGram = !isLimitBreached && liveRate > bookedRate ? liveRate - bookedRate : (isLimitBreached ? protectionLimit : 0);
  
  const totalSavings = savingsPerGram * totalGoldWeight;
  const potentialSurcharge = surchargePerGram * totalGoldWeight;

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
        
        {/* 1. RATE PROTECTION MONITOR */}
        {isProtected && totalGoldWeight > 0 && (
            <div className={`bg-white p-5 rounded-3xl shadow-lg border-2 overflow-hidden relative ${isLimitBreached ? 'border-amber-400' : 'border-emerald-100'}`}>
                <div className="flex justify-between items-start mb-4 relative z-10">
                    <div>
                        <h3 className={`font-black text-sm flex items-center gap-2 ${isLimitBreached ? 'text-amber-700' : 'text-slate-800'}`}>
                            {isLimitBreached ? <ShieldAlert className="text-amber-500" size={18} /> : <ShieldCheck className="text-emerald-500" size={18} />}
                            {isLimitBreached ? 'Protection Limit Reached' : 'Rate Protection Active'}
                        </h3>
                        <p className="text-[10px] text-slate-500 mt-1">
                            {isLimitBreached ? "Market rate exceeds contract protection limit." : "Your gold rate is locked against market hikes."}
                        </p>
                    </div>
                    <div className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg border border-emerald-100 text-[10px] font-bold uppercase">
                        Booked @ ₹{bookedRate}/g
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 relative z-10 mb-4">
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Current Market</p>
                        <div className="flex items-center gap-1">
                            <p className="text-lg font-bold text-slate-700">₹{liveRate > 0 ? liveRate.toLocaleString() : 'Loading...'}</p>
                            {liveRate > bookedRate && <TrendingUp size={14} className={isLimitBreached ? "text-amber-500" : "text-emerald-500"} />}
                        </div>
                    </div>
                    <div className={`p-3 rounded-2xl border ${isLimitBreached ? 'bg-amber-50 border-amber-200' : (savingsPerGram > 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100')}`}>
                        <p className="text-[9px] font-black uppercase tracking-widest mb-1 opacity-60">
                            {isLimitBreached ? 'Uncovered Gap' : 'Value Shielded'}
                        </p>
                        <p className={`text-lg font-black ${isLimitBreached ? 'text-amber-700' : (savingsPerGram > 0 ? 'text-emerald-600' : 'text-slate-400')}`}>
                            {isLimitBreached 
                                ? `₹${Math.round(potentialSurcharge).toLocaleString()} Risk`
                                : (savingsPerGram > 0 ? `+₹${Math.round(totalSavings).toLocaleString()}` : 'Protected')
                            }
                        </p>
                    </div>
                </div>

                {/* VISUAL CONTRACT BAR */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                        <span>Booked: ₹{bookedRate}</span>
                        <span>Contract Ceiling: ₹{maxProtectedRate}</span>
                    </div>
                    
                    {/* Bar Container */}
                    <div className="h-3 bg-slate-200 rounded-full relative overflow-hidden">
                        {/* Safe Zone (Green) */}
                        <div className="absolute top-0 bottom-0 left-0 bg-emerald-400/30 w-full flex items-center justify-center text-[7px] font-black text-emerald-800 uppercase tracking-widest">
                            Safety Range (+₹{protectionLimit})
                        </div>
                        
                        {/* Current Rate Indicator */}
                        {liveRate > 0 && (
                            <div 
                                className={`absolute top-0 bottom-0 w-1 transition-all duration-1000 ${isLimitBreached ? 'bg-amber-600 shadow-[0_0_10px_rgba(245,158,11,0.8)]' : 'bg-emerald-600'}`}
                                style={{ 
                                    left: `${Math.min(100, Math.max(0, ((liveRate - bookedRate) / (protectionLimit * 1.5)) * 100))}%`
                                }}
                            >
                                <div className={`absolute -top-1 -translate-x-1/2 text-[8px] font-black px-1 rounded ${isLimitBreached ? 'bg-amber-600 text-white' : 'bg-emerald-600 text-white'}`}>
                                    ₹{liveRate}
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <p className="text-[9px] text-slate-400 mt-2 text-center">
                        Contract covers market hikes up to <span className="font-bold text-slate-600">₹{maxProtectedRate}/g</span>. 
                        {isLimitBreached && <span className="text-amber-600 font-bold block mt-1">Current rate exceeds protection limit. Difference may be applicable.</span>}
                    </p>
                </div>
            </div>
        )}

        {/* 2. PAYMENT QR */}
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

        {/* 3. SCHEDULE */}
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
                         <p className="text-[10px] text-slate-400 font-medium">{new Date(m.dueDate).toLocaleDateString('en-IN')}</p>
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

        {/* 4. TRANSACTIONS */}
        {order.payments.length > 0 && (
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <ReceiptIndianRupee size={16} className="text-emerald-500" /> Payment History
                </h3>
                <div className="space-y-3">
                    {[...order.payments].reverse().map(p => (
                        <div key={p.id} className="flex justify-between items-center border-b border-slate-50 last:border-0 pb-3 last:pb-0">
                            <div>
                                <p className="text-xs font-bold text-slate-700">Payment Received</p>
                                <p className="text-[10px] text-slate-400">{new Date(p.date).toLocaleDateString('en-IN')} via {p.method}</p>
                            </div>
                            <span className="font-black text-emerald-600 text-sm">+₹{p.amount.toLocaleString()}</span>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* 5. ITEM BREAKDOWN (DETAILED) */}
        <div className="space-y-4">
          <h3 className="text-sm font-black uppercase text-slate-400 tracking-widest ml-1">Order Specification</h3>
          {order.items.map((item) => {
             const isExpanded = expandedItem === item.id;
             // Calculate effective rate used for this item if weight exists
             const effectiveRate = item.netWeight > 0 ? (item.baseMetalValue / item.netWeight) : bookedRate;

             return (
             <div key={item.id} className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 transition-all">
               <div className="flex gap-4 items-start" onClick={() => setExpandedItem(isExpanded ? null : item.id)}>
                   <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-300 overflow-hidden shrink-0">
                      {item.photoUrls?.[0] ? <img src={item.photoUrls[0]} className="w-full h-full object-cover" /> : <Box size={24} />}
                   </div>
                   <div className="flex-1 min-w-0">
                     <div className="flex justify-between items-start">
                         <div>
                             <h2 className="text-sm font-black text-slate-800">{item.category}</h2>
                             <p className="text-[10px] text-slate-500 uppercase font-bold mt-0.5">
                                 {item.metalColor} • {item.purity} • {item.netWeight}g
                             </p>
                         </div>
                         <div className="text-right">
                             <p className="text-sm font-black text-slate-900">₹{item.finalAmount.toLocaleString()}</p>
                             <button className="text-[9px] font-bold text-blue-500 flex items-center gap-1 justify-end mt-1">
                                 {isExpanded ? 'Hide' : 'Breakup'} {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                             </button>
                         </div>
                     </div>
                     <div className="mt-2 inline-block px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[9px] font-black uppercase tracking-wide">
                        {item.productionStatus.replace('_', ' ')}
                     </div>
                   </div>
               </div>

               {/* Detailed Cost Table */}
               {isExpanded && (
                   <div className="mt-4 pt-4 border-t border-slate-100 animate-slideDown">
                       <div className="bg-slate-50 rounded-xl p-3 grid grid-cols-2 gap-y-3 gap-x-4">
                           <div>
                               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Rate Applied</p>
                               <p className="text-xs font-bold text-slate-700">₹{Math.round(effectiveRate).toLocaleString()}/g</p>
                           </div>
                           <div>
                               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Metal Value</p>
                               <p className="text-xs font-bold text-slate-700">₹{Math.round(item.baseMetalValue).toLocaleString()}</p>
                           </div>
                           <div>
                               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Making / VA</p>
                               <p className="text-xs font-bold text-slate-700">₹{Math.round(item.wastageValue + item.totalLaborValue).toLocaleString()}</p>
                           </div>
                           <div>
                               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Stone Charges</p>
                               <p className="text-xs font-bold text-slate-700">₹{item.stoneCharges.toLocaleString()}</p>
                           </div>
                           <div className="col-span-2 border-t border-slate-200 pt-2 flex justify-between items-center">
                               <div>
                                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">GST ({(order.totalAmount > 0 ? (item.taxAmount / (item.finalAmount - item.taxAmount)) * 100 : 3).toFixed(0)}%)</p>
                                   <p className="text-xs font-bold text-slate-700">₹{Math.round(item.taxAmount).toLocaleString()}</p>
                               </div>
                               <div className="text-right">
                                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Item Total</p>
                                   <p className="text-sm font-black text-slate-900">₹{Math.round(item.finalAmount).toLocaleString()}</p>
                               </div>
                           </div>
                       </div>
                   </div>
               )}
             </div>
          )})}
        </div>

        <div className="text-center pb-8 opacity-40">
           <p className="text-[10px] font-bold text-slate-500">AuraGold Secure Order Portal</p>
        </div>
      </div>
    </div>
  );
};

export default CustomerOrderView;
