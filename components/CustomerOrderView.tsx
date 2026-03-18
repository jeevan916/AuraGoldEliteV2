
import React, { useState, useEffect, useRef } from 'react';
import { 
  CheckCircle2, Clock, MapPin, ShieldCheck, Box, CreditCard, 
  Smartphone, Lock, AlertCircle, ArrowRight, QrCode, CalendarDays, 
  LocateFixed, ReceiptIndianRupee, TrendingUp, ChevronDown, ChevronUp, Scale, Info, ShieldAlert, Sparkles,
  Zap, Loader2
} from 'lucide-react';
import { Order, ProductionStatus, ProtectionStatus } from '../types';
import { errorService } from '../services/errorService';
import { goldRateService } from '../services/goldRateService';

interface CustomerOrderViewProps {
  order: Order;
}

const CustomerOrderView: React.FC<CustomerOrderViewProps> = ({ order }) => {
  const [showOriginal, setShowOriginal] = useState(false);
  const [locationStatus, setLocationStatus] = useState<'PENDING' | 'GRANTED' | 'DENIED'>('PENDING');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [liveRate, setLiveRate] = useState<number>(0);
  const [setuLoading, setSetuLoading] = useState(false);
  const [setuError, setSetuError] = useState<string | null>(null);
  const [acceptingLiability, setAcceptingLiability] = useState(false);
  const loggedRef = useRef(false);

  const totalPaid = order.payments.reduce((acc, p) => acc + p.amount, 0);
  const remaining = order.totalAmount - totalPaid;
  const nextPayment = order.paymentPlan.milestones.find(m => m.status !== 'PAID');

  const [customAmount, setCustomAmount] = useState<number | ''>(nextPayment ? nextPayment.targetAmount : remaining);

  const handleAcceptLiability = async () => {
      setAcceptingLiability(true);
      try {
          const response = await fetch(`/api/orders/${order.id}/accept-liability`, { method: 'POST' });
          const result = await response.json();
          if (!result.success) throw new Error(result.error);
      } catch (err: any) {
          errorService.logError('AcceptLiability', err.message);
          alert("Failed to accept liability gap. Please try again.");
      } finally {
          setAcceptingLiability(false);
      }
  };

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

    // 2. Fetch Live Rate for Protection Monitor
    const fetchRate = async () => {
        const res = await goldRateService.fetchLiveRate();
        if (res.success) {
            setLiveRate(res.rate22K);
        }
    };
    fetchRate();
  }, [remaining, nextPayment, order.id, customAmount]);

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

  const handleSetuPayment = async () => {
    setSetuLoading(true);
    setSetuError(null);
    try {
      const amountToPay = Number(customAmount);
      if (!amountToPay || amountToPay <= 0) {
          throw new Error("Please enter a valid amount greater than 0.");
      }
      if (amountToPay > remaining) {
          throw new Error(`Amount cannot exceed the balance due of ₹${remaining.toLocaleString()}`);
      }
      
      // Generate a unique bill ID for this attempt
      const transactionId = `CUST-${order.id.split('-').pop()}-${Date.now()}`;
      
      const response = await fetch('/api/setu/create-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountToPay,
          billerBillID: transactionId,
          customerID: order.customerContact,
          name: order.customerName,
          orderId: order.id
        })
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to generate payment link");
      }

      // Setu Bridge v2 response structure
      const payload = result.data?.data || result.data;
      const shortLink = payload?.paymentLink?.shortURL || payload?.shortURL || payload?.shortLink;
      const upiID = payload?.paymentLink?.upiID || payload?.upiID;
      let upiIntentLink = payload?.paymentLink?.upiIntentLink || payload?.upiIntentLink || payload?.upiLink;
      const platformBillID = payload?.platformBillID;

      if (!shortLink) {
        throw new Error("Payment link not received from gateway");
      }

      window.location.href = shortLink;
    } catch (err: any) {
      console.error("Setu Payment Error:", err);
      setSetuError(err.message);
      errorService.logError('CustomerSetuPayment', err.message);
    } finally {
      setSetuLoading(false);
    }
  };

  const displayMilestones = showOriginal && order.paymentPlan.originalMilestones 
      ? order.paymentPlan.originalMilestones 
      : order.paymentPlan.milestones;

  // PROTECTION CALCS
  const bookedRate = order.paymentPlan.protectionRateBooked || order.goldRateAtBooking;
  const protectionLimit = order.paymentPlan.protectionLimit || 0; // Max Allowed Increase
  const maxProtectedRate = bookedRate + protectionLimit;
  
  const isProtected = order.paymentPlan.protectionStatus === ProtectionStatus.ACTIVE;
  
  const totalGoldWeight = order.items.reduce((sum, item) => item.metalColor !== 'Silver' ? sum + item.netWeight : sum, 0);
  
  const isLimitBreached = liveRate > maxProtectedRate;
  const surchargePerGram = isLimitBreached ? liveRate - maxProtectedRate : 0;
  
  // Savings Calculation:
  // If breached: Savings is capped at the protectionLimit.
  // If not breached but market > booked: Savings is the diff.
  // If market < booked: No savings (technically 0).
  const savingsPerGram = Math.max(0, Math.min(liveRate - bookedRate, protectionLimit));
  
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
        
        {/* 1. RATE PROTECTION MONITOR (REDESIGNED) */}
        {isProtected && totalGoldWeight > 0 && (
            <div className={`bg-white rounded-3xl shadow-xl border overflow-hidden relative mb-2 ${isLimitBreached ? 'border-amber-200 shadow-amber-500/10' : 'border-emerald-100 shadow-emerald-500/10'}`}>
                
                {/* HEADER */}
                <div className={`px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 ${isLimitBreached ? 'bg-amber-50' : 'bg-emerald-50'}`}>
                    <div>
                        <h3 className={`font-black text-sm flex items-center gap-2 uppercase tracking-wide ${isLimitBreached ? 'text-amber-800' : 'text-emerald-800'}`}>
                            {isLimitBreached ? <ShieldAlert size={18} /> : <ShieldCheck size={18} />}
                            {isLimitBreached ? 'Protection Limit Reached' : 'Rate Protection Active'}
                        </h3>
                        <p className={`text-[10px] font-bold mt-1 leading-tight max-w-xs ${isLimitBreached ? 'text-amber-700/80' : 'text-emerald-700/80'}`}>
                            {isLimitBreached 
                                ? `Market rate exceeds contract protection limit.` 
                                : "Your rate is locked. You are fully shielded from market hikes."}
                        </p>
                    </div>
                    <div className="bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-black/5 shadow-sm self-start md:self-center">
                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Booked Rate</p>
                        <p className="text-lg font-black text-slate-800">₹{bookedRate.toLocaleString()}<span className="text-[10px] text-slate-400">/g</span></p>
                    </div>
                </div>

                {/* MAIN METRICS */}
                <div className="p-6">
                    <div className="flex gap-4 mb-6">
                        <div className="flex-1 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Current Market</p>
                            <div className="flex items-end gap-1">
                                <span className="text-2xl font-black text-slate-900">₹{liveRate > 0 ? liveRate.toLocaleString() : '...'}</span>
                                <span className="text-[9px] font-bold text-slate-400 mb-1">/g</span>
                            </div>
                        </div>
                        
                        {/* PROFIT/LOSS BADGE */}
                        <div className={`flex-1 p-4 rounded-2xl border flex flex-col justify-center ${isLimitBreached ? 'bg-emerald-50 border-emerald-100' : 'bg-emerald-50 border-emerald-100'}`}>
                            <p className="text-[9px] font-black uppercase tracking-widest mb-1 text-emerald-700">
                                Your Net Benefit
                            </p>
                            <p className="text-xl font-black text-emerald-600">
                                +₹{Math.round(totalSavings).toLocaleString()}
                            </p>
                        </div>
                    </div>

                    {/* VISUAL BAR (Redesigned) */}
                    <div className="mb-6 relative pt-4 pb-2">
                        {/* Labels above bar */}
                        <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">
                            <span>Booked: ₹{bookedRate}</span>
                            <span className={isLimitBreached ? "text-amber-600 font-black" : ""}>Limit: +₹{protectionLimit}</span>
                        </div>

                        {/* The Bar Track */}
                        <div className="h-3 bg-slate-100 rounded-full relative w-full flex overflow-hidden">
                            <div className="w-full h-full relative bg-slate-200">
                                 {/* Green Zone (Protected) */}
                                 {/* Calculate percentage fill based on LIVE rate relative to the Range (Booked -> MaxProtected) */}
                                 {/* If live rate is 50% through the protected zone, bar is 50% green. Max is 100% green. */}
                                 <div 
                                    className="absolute left-0 top-0 bottom-0 bg-emerald-400 transition-all duration-1000" 
                                    style={{ 
                                        width: liveRate > bookedRate 
                                            ? (isLimitBreached ? '100%' : `${((liveRate - bookedRate) / protectionLimit) * 100}%`) 
                                            : '0%' 
                                    }}
                                 ></div>
                                 
                                 {/* Red Zone (Breach) - Only shown if limit exceeded, but handled via overlay for visual simplicity or separate indicator */}
                            </div>
                        </div>
                        
                        {/* Legend */}
                        <div className="flex justify-between items-center mt-2">
                             <p className="text-[9px] font-bold text-emerald-600 flex items-center gap-1">
                                <ShieldCheck size={10} /> Covered: ₹{Math.min(Math.max(0, liveRate - bookedRate), protectionLimit).toLocaleString()}/g
                             </p>
                             {isLimitBreached && (
                                 <p className="text-[9px] font-bold text-amber-600 flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                                    <AlertCircle size={10} /> Surcharge: ₹{Math.round(surchargePerGram).toLocaleString()}/g
                                 </p>
                             )}
                        </div>
                    </div>

                    {/* ACTIONABLE INSIGHT / URGENCY */}
                    {(!isLimitBreached || order.requiresLiabilityAcceptance) && (
                        <div className="bg-slate-900 rounded-xl p-4 flex items-start gap-4 shadow-lg ring-1 ring-slate-900/5">
                            <div className={`p-2 rounded-lg text-slate-900 shrink-0 ${isLimitBreached ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`}>
                                {isLimitBreached ? <Scale size={20} /> : <Sparkles size={20} />}
                            </div>
                            <div>
                                <h4 className="text-white font-bold text-xs uppercase tracking-wide mb-1 flex items-center gap-2">
                                    {isLimitBreached ? "Market Volatility Alert" : "Lock in your profit now"}
                                </h4>
                                <p className="text-[10px] text-slate-300 leading-relaxed font-medium">
                                    {isLimitBreached 
                                        ? `Although the limit is exceeded, you are STILL SAVING ₹${Math.round(savingsPerGram)}/g compared to today's rate! Pay dues on time to keep this contract active.`
                                        : `You are currently saving ₹${Math.round(savingsPerGram)}/g! Missing a payment date could void this protection and expose you to higher rates.`
                                    }
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* 2. PAYMENT */}
        {remaining > 0 && (
          <div className="bg-white p-6 rounded-3xl shadow-lg border border-amber-100 flex flex-col items-center">
             <div className="text-center mb-6">
                <h3 className="font-bold text-slate-800 text-lg">Balance Due: ₹{remaining.toLocaleString()}</h3>
             </div>

             <div className="w-full mb-6">
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 text-center">Amount to Pay (₹)</label>
                <input 
                    type="number" 
                    value={customAmount} 
                    onChange={(e) => setCustomAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full text-center text-2xl font-black text-slate-800 bg-slate-50 border border-slate-200 rounded-xl py-3 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    min="1"
                    max={remaining}
                />
             </div>

             {setuError && (
                <div className="w-full mb-4 p-3 bg-rose-50 border border-rose-100 rounded-xl text-[10px] text-rose-600 font-bold flex flex-col gap-2 overflow-hidden">
                    <div className="flex items-center gap-2">
                       <AlertCircle size={14} className="shrink-0" /> 
                       <span>Gateway Error</span>
                    </div>
                    <pre className="whitespace-pre-wrap break-all bg-white/50 p-2 rounded border border-rose-200 font-mono text-[9px] max-h-40 overflow-y-auto">
                       {setuError}
                    </pre>
                </div>
             )}

             {order.requiresLiabilityAcceptance && (
                 <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl mb-6 w-full">
                     <h4 className="text-amber-800 font-bold text-sm mb-2 flex items-center gap-2">
                         <AlertCircle size={16} /> Rate Breach Detected
                     </h4>
                     <p className="text-amber-700 text-[10px] mb-4">
                         Market rates have exceeded your protection limit. To proceed with payments, 
                         you must accept the liability gap recalculation.
                     </p>
                     <button 
                         onClick={handleAcceptLiability}
                         disabled={acceptingLiability}
                         className="w-full bg-amber-600 text-white py-3 rounded-xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2"
                     >
                         {acceptingLiability ? <Loader2 size={16} className="animate-spin" /> : <Scale size={16} />}
                         Accept Liability Gap
                     </button>
                 </div>
             )}

             <div className="w-full space-y-3">
                <button 
                  onClick={handleSetuPayment}
                  disabled={setuLoading || order.requiresLiabilityAcceptance}
                  className="w-full bg-amber-500 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all disabled:opacity-50"
                >
                  {setuLoading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />} 
                  {order.requiresLiabilityAcceptance ? 'Liability Acceptance Required' : 'Pay Now'}
                </button>
             </div>
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
          
          <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-200 mt-6 shadow-sm">
              <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center text-slate-500 font-bold">
                      <span>Subtotal</span>
                      <span>₹{(order.totalAmount + (order.discountAmount || 0)).toLocaleString()}</span>
                  </div>
                  {order.discountAmount ? (
                      <div className="flex justify-between items-center text-emerald-600 font-bold">
                          <span>Discount Applied</span>
                          <span>-₹{order.discountAmount.toLocaleString()}</span>
                      </div>
                  ) : null}
                  <div className="pt-3 border-t border-slate-200 flex justify-between items-center text-xl font-black text-slate-900">
                      <span>Total Amount</span>
                      <span>₹{order.totalAmount.toLocaleString()}</span>
                  </div>
              </div>
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
