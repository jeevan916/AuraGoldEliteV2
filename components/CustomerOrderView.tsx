
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
  const [showLiabilityModal, setShowLiabilityModal] = useState(false);
  const [liveRate, setLiveRate] = useState<number>(0);
  const [setuLoading, setSetuLoading] = useState(false);
  const [setuError, setSetuError] = useState<string | null>(null);
  const [activePaymentPlatformId, setActivePaymentPlatformId] = useState<string | null>(null);
  const [acceptingLiability, setAcceptingLiability] = useState(false);
  const [activePolicyTab, setActivePolicyTab] = useState<'PAYMENT' | 'CANCELLATION' | 'OVERDUE'>('PAYMENT');
  const loggedRef = useRef(false);

  const totalPaid = Math.round(order.payments.reduce((acc, p) => acc + p.amount, 0));
  const remaining = Math.max(0, Math.round(order.totalAmount - totalPaid));
  const nextPayment = order.paymentPlan.milestones.find(m => m.status !== 'PAID');

  const overdueMilestones = order.paymentPlan.milestones.filter(m => m.status !== 'PAID' && new Date(m.dueDate) < new Date());
  const hasOverdue = overdueMilestones.length > 0;
  const overdueAmount = Math.round(overdueMilestones.reduce((acc, m) => acc + m.targetAmount, 0));

  let maxDaysOverdue = 0;
  if (hasOverdue) {
      const oldestDueDate = new Date(Math.min(...overdueMilestones.map(m => new Date(m.dueDate).getTime())));
      const diffTime = Math.abs(new Date().getTime() - oldestDueDate.getTime());
      maxDaysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  const defaultAmount = nextPayment ? Math.min(Math.round(nextPayment.targetAmount), remaining) : remaining;
  const [customAmount, setCustomAmount] = useState<number | ''>(defaultAmount);

  const handleAcceptLiability = async () => {
      setAcceptingLiability(true);
      try {
          const response = await fetch(`/api/orders/${order.id}/accept-liability`, { method: 'POST' });
          const result = await response.json();
          if (!result.success) throw new Error(result.error);
          setShowLiabilityModal(false);
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

  useEffect(() => {
      let interval: any;
      if (activePaymentPlatformId) {
          interval = setInterval(async () => {
              try {
                  const res = await fetch(`/api/setu/status/${activePaymentPlatformId}`);
                  const data = await res.json();
                  if (data.success && data.data && data.data.status === 'PAYMENT_SUCCESSFUL') {
                      setActivePaymentPlatformId(null);
                      // the socket handler in App.tsx will update publicOrder
                      window.location.reload(); // Quick refresh to get new state immediately
                  } else if (data.success && data.data && ['PAYMENT_FAILED', 'EXPIRED'].includes(data.data.status)) {
                      setActivePaymentPlatformId(null);
                      setSetuError(`Payment status: ${data.data.status}`);
                  }
              } catch (e) {
                  console.error("Poll error", e);
              }
          }, 3000);
      }
      return () => clearInterval(interval);
  }, [activePaymentPlatformId]);

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
    if (order.requiresLiabilityAcceptance) {
        setShowLiabilityModal(true);
        return;
    }
    setSetuLoading(true);
    setSetuError(null);
    try {
      const amountToPay = Number(customAmount);
      if (!amountToPay || amountToPay <= 0) {
          throw new Error("Please enter a valid amount greater than 0.");
      }
      if (amountToPay > remaining) {
          throw new Error(`Amount cannot exceed the balance due of ₹${Math.round(remaining).toLocaleString('en-IN')}`);
      }
      
      // Let backend generate the unique bill ID using orderId
      
      const response = await fetch('/api/setu/create-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountToPay,
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

      if (!shortLink && !upiIntentLink) {
        throw new Error("Payment link not received from gateway");
      }

      if (platformBillID) setActivePaymentPlatformId(platformBillID);

      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (isMobile && upiIntentLink) {
          window.location.href = upiIntentLink;
      } else if (shortLink) {
          // Open Setu Bridge in a new tab if possible so we can poll in background
          // Fallback to location.href if popup blocked
          const newWindow = window.open(shortLink, '_blank');
          if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
              window.location.href = shortLink;
          }
      }
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
  
  const isProtected = order.paymentPlan.protectionStatus === ProtectionStatus.ACTIVE && order.paymentPlan.goldRateProtection !== false;
  
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
            <p className="text-5xl font-black text-white">₹{Math.round(order.totalAmount).toLocaleString('en-IN')}</p>
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
                        <p className="text-lg font-black text-slate-800">₹{Math.round(bookedRate).toLocaleString('en-IN')}<span className="text-[10px] text-slate-400">/g</span></p>
                    </div>
                </div>

                {/* MAIN METRICS */}
                <div className="p-6">
                    <div className="flex gap-4 mb-6">
                        <div className="flex-1 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Current Market</p>
                            <div className="flex items-end gap-1">
                                <span className="text-2xl font-black text-slate-900">₹{liveRate > 0 ? Math.round(liveRate).toLocaleString('en-IN') : '...'}</span>
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
                <h3 className="font-bold text-slate-800 text-lg">Balance Due: ₹{Math.round(remaining).toLocaleString('en-IN')}</h3>
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


             {/* Liability Acceptance Modal */}
             {showLiabilityModal && (
                 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
                     <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full">
                         <h3 className="text-amber-800 font-black text-lg mb-4 flex items-center gap-2">
                             <ShieldAlert /> Order Action Required
                         </h3>
                         <p className="text-slate-600 text-xs mb-4 leading-relaxed">
                             {order.requiresLiabilityAcceptance && (remaining > 0 && order.paymentPlan.milestones.some(m => m.status !== 'PAID' && new Date(m.dueDate) < new Date()))
                                ? "Your order requires immediate attention: market rates have exceeded your protection limit, and you have overdue payments. Please accept the liability gap adjustment to proceed with your payments."
                                : order.requiresLiabilityAcceptance 
                                    ? "As market rates have exceeded your protection limit, a liability gap adjustment is required to maintain your order's status. This is in accordance with the Terms & Conditions you accepted for rate protection."
                                    : "You have overdue payments that require your immediate attention."}
                         </p>
                         {order.requiresLiabilityAcceptance && (
                             <div className="bg-slate-100 p-4 rounded-xl mb-6">
                                 <p className="text-[10px] uppercase font-black text-slate-400">Additional Adjusted Cost</p>
                                 <p className="text-xl font-black text-slate-900">₹{Math.round(potentialSurcharge).toLocaleString()}</p>
                             </div>
                         )}
                         {order.requiresLiabilityAcceptance && (
                             <button 
                                 onClick={handleAcceptLiability}
                                 disabled={acceptingLiability}
                                 className="w-full bg-amber-600 text-white py-3 rounded-xl font-black uppercase text-xs tracking-widest"
                             >
                                 {acceptingLiability ? 'Processing...' : 'I Accept & Proceed'}
                             </button>
                         )}
                         <button 
                             onClick={() => setShowLiabilityModal(false)}
                             className="w-full text-slate-400 py-3 mt-2 font-bold uppercase text-[10px] tracking-widest"
                         >
                             {order.requiresLiabilityAcceptance ? 'Cancel' : 'Close'}
                         </button>
                     </div>
                 </div>
             )}

             <div className="w-full space-y-3">
                {activePaymentPlatformId && (
                    <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-xl flex items-center justify-between shadow-sm animate-pulse">
                        <div className="flex items-center gap-3">
                            <Loader2 className="animate-spin text-blue-500" size={20} />
                            <div>
                                <p className="font-bold text-sm">Processing Payment...</p>
                                <p className="text-xs text-blue-600">Please complete the payment on Setu</p>
                            </div>
                        </div>
                        <button onClick={() => setActivePaymentPlatformId(null)} className="text-xs font-bold text-blue-600 bg-blue-100 px-3 py-1.5 rounded-lg active:scale-95">Cancel Check</button>
                    </div>
                )}
                <div className="flex gap-2">
                    <button 
                      onClick={handleSetuPayment}
                      disabled={setuLoading || ((remaining > 0 && order.paymentPlan.milestones.some(m => m.status !== 'PAID' && new Date(m.dueDate) < new Date())) && order.requiresLiabilityAcceptance)}
                      className="flex-1 bg-amber-500 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all disabled:opacity-50"
                    >
                      {setuLoading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />} 
                      {(remaining > 0 && order.paymentPlan.milestones.some(m => m.status !== 'PAID' && new Date(m.dueDate) < new Date()) && order.requiresLiabilityAcceptance) 
                        ? 'Payment Overdue & Liability Required' 
                        : (order.requiresLiabilityAcceptance ? 'Accept Liability to Pay' : 'Pay Now')}
                    </button>
                    {(order.requiresLiabilityAcceptance || (remaining > 0 && order.paymentPlan.milestones.some(m => m.status !== 'PAID' && new Date(m.dueDate) < new Date()))) && (
                        <button 
                            onClick={() => setShowLiabilityModal(true)}
                            className="bg-slate-200 text-slate-600 p-4 rounded-xl"
                        >
                            <Info size={20} />
                        </button>
                    )}
                </div>
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
                         <p className={`text-sm font-black ${isPaid && !isOriginalView ? 'text-emerald-600' : 'text-slate-800'}`}>₹{Math.round(m.targetAmount).toLocaleString('en-IN')}</p>
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

        {/* 3.5 TERMS, CANCELLATION & OVERDUE POLICIES */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-5" id="agreed-terms-policies-panel">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2" id="terms-header-title">
              <ShieldCheck size={16} className="text-amber-600" /> Agreed Terms & Policies
            </h3>
            <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full uppercase tracking-widest" id="booking-agreement-badge">
              Booking Agreement
            </span>
          </div>

          {/* Active Overdue Alert (if customer is overdue on any milestone) */}
          {hasOverdue && (
            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex gap-3 animate-fadeIn" id="overdue-warning-alert">
              <AlertCircle size={20} className="text-rose-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-rose-800 font-black text-xs uppercase tracking-wider">
                  Payment Milestone Overdue
                </h4>
                <p className="text-[10px] text-rose-600 font-bold leading-relaxed mt-1">
                  You have <span className="font-black text-rose-700">{overdueMilestones.length} installment(s)</span> overdue in your promised schedule, totaling <span className="font-black text-rose-700">₹{overdueAmount.toLocaleString('en-IN')}</span>. The oldest installment is overdue by <span className="font-black text-rose-700">{maxDaysOverdue} days</span>.
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <span className="bg-rose-100 text-rose-800 text-[9px] font-black uppercase px-2 py-0.5 rounded-full">
                    Rate Protection Suspended
                  </span>
                  <span className="bg-rose-100 text-rose-800 text-[9px] font-black uppercase px-2 py-0.5 rounded-full">
                    Late Fees Applied
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Policy Segment Tabs */}
          <div className="flex border-b border-slate-100 pb-1" id="policy-tabs-list">
            <button
              id="tab-payment-terms"
              onClick={() => setActivePolicyTab('PAYMENT')}
              className={`flex-1 pb-3 text-center text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
                activePolicyTab === 'PAYMENT'
                  ? 'border-amber-500 text-slate-800 font-black'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              Payment Terms
            </button>
            <button
              id="tab-overdue-fees"
              onClick={() => setActivePolicyTab('OVERDUE')}
              className={`flex-1 pb-3 text-center text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
                activePolicyTab === 'OVERDUE'
                  ? 'border-amber-500 text-slate-800 font-black'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              Overdue & Fees
            </button>
            <button
              id="tab-cancellation-policy"
              onClick={() => setActivePolicyTab('CANCELLATION')}
              className={`flex-1 pb-3 text-center text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
                activePolicyTab === 'CANCELLATION'
                  ? 'border-amber-500 text-slate-800 font-black'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              Cancellation
            </button>
          </div>

          {/* Selected Policy Tab Body */}
          <div className="pt-1" id="policy-tab-content-container">
            {activePolicyTab === 'PAYMENT' && (
              <div className="space-y-3.5" id="payment-terms-tab-content">
                <div className="flex gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    <span className="font-bold text-slate-800">Promised Milestone Schedule:</span> Your customized order plan consists of <span className="font-black text-slate-700">{order.paymentPlan.milestones.length} installments</span> agreed upon booking on <span className="font-bold text-slate-700">{new Date(order.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</span>.
                  </p>
                </div>
                <div className="flex gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    <span className="font-bold text-slate-800">Rate Lock Commitment:</span> To fully secure your booked gold rate of <span className="font-bold text-amber-600">₹{Math.round(bookedRate).toLocaleString('en-IN')}/g</span>, you commit to paying each milestone on or before its respective due date.
                  </p>
                </div>
                <div className="flex gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    <span className="font-bold text-slate-800">Auto-Reminders:</span> Personalized WhatsApp reminders are scheduled to be sent prior to each due date to assist you in preserving your rate-protection.
                  </p>
                </div>
              </div>
            )}

            {activePolicyTab === 'OVERDUE' && (
              <div className="space-y-3.5" id="overdue-fees-tab-content">
                <div className="flex gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    <span className="font-bold text-slate-800">Rate Protection Suspension:</span> Failure to pay an installment past its due date (subject to a standard 24-hour grace period) compromises your Rate Protection lock. The remaining unpaid gold weight may immediately revert to standard market gold rates.
                  </p>
                </div>
                <div className="flex gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    <span className="font-bold text-slate-800">Late Fee & Overdue Charges:</span> Overdue periods trigger an active late fee of <span className="font-black text-rose-600">₹250 per milestone</span> or standard overdue charges to cover gold market volatility risk.
                  </p>
                </div>
                {order.lateFeeAmount ? (
                  <div className="bg-rose-50/60 rounded-xl p-3 flex justify-between items-center border border-rose-100 mt-1" id="late-fee-detail-box">
                    <div>
                      <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Late Fee Applied</p>
                      <p className="text-xs font-bold text-slate-700">Accumulated for this Order</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-rose-600">₹{Math.round(order.lateFeeAmount).toLocaleString('en-IN')}</p>
                      {order.lateFeeWaived ? (
                        <p className="text-[9px] font-bold text-emerald-600">Waived: ₹{Math.round(order.lateFeeWaived).toLocaleString('en-IN')}</p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    <span className="font-bold text-slate-800">Production Hold:</span> Crafting on custom jewelry items is paused in the workshop immediately if any payment remains overdue past 5 days.
                  </p>
                </div>
              </div>
            )}

            {activePolicyTab === 'CANCELLATION' && (
              <div className="space-y-3.5" id="cancellation-tab-content">
                <div className="flex gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-500 mt-1.5 shrink-0" />
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    <span className="font-bold text-slate-800">Rate Lock Termination:</span> Customer-initiated cancellation of this order at any point will immediately invalidate your booked rate and void the rate lock.
                  </p>
                </div>
                <div className="flex gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-500 mt-1.5 shrink-0" />
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    <span className="font-bold text-slate-800">Deduction of Work-in-Progress Costs:</span> Since custom jewelry is crafted specifically for you, any cancellation is subject to a deduction fee comprising actual design labor, raw gold melting loss/wastage, and metal processing costs (up to 10% of total order value).
                  </p>
                </div>
                <div className="flex gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-500 mt-1.5 shrink-0" />
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    <span className="font-bold text-slate-800">Refund Settlement:</span> Eligible refunds after standard deductions will be processed via <span className="font-bold text-slate-700">{order.refundMethod || 'Original payment channel / Bank Transfer'}</span> within 7-10 working days of official cancellation approval.
                  </p>
                </div>
              </div>
            )}
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
                                <p className="text-[10px] text-slate-400 mt-0.5">{new Date(p.date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} via {p.method}</p>
                                {(p.reference || p.transactionId || p.payer) && (
                                    <div className="flex gap-2 mt-1">
                                        {(p.reference || p.transactionId) && (
                                            <p className="text-[9px] font-mono text-slate-500 bg-slate-50 px-1.5 py-0.5 inline-block rounded border border-slate-100">
                                                ID: {p.reference || p.transactionId}
                                            </p>
                                        )}
                                        {p.payer && (
                                            <p className="text-[9px] font-mono text-slate-500 bg-slate-50 px-1.5 py-0.5 inline-block rounded border border-slate-100">
                                                VPA: {p.payer}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                            <span className="font-black text-emerald-600 text-sm">+₹{Math.round(p.amount).toLocaleString('en-IN')}</span>
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
                             <p className="text-sm font-black text-slate-900">₹{Math.round(item.finalAmount).toLocaleString('en-IN')}</p>
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
                               <p className="text-xs font-bold text-slate-700">₹{Math.round(item.stoneCharges).toLocaleString('en-IN')}</p>
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
                  <div className="flex justify-between items-center text-slate-500 font-bold mb-3">
                      <span>Subtotal</span>
                      <span>₹{Math.round(order.totalAmount + (order.discountAmount || 0) - ((order.lateFeeAmount || 0) - (order.lateFeeWaived || 0))).toLocaleString('en-IN')}</span>
                  </div>
                  {order.discountAmount ? (
                      <div className="flex justify-between items-center text-emerald-600 font-bold mb-3">
                          <span>Discount Applied</span>
                          <span>-₹{Math.round(order.discountAmount).toLocaleString('en-IN')}</span>
                      </div>
                  ) : null}
                  
                  {order.lateFeeAmount ? (
                      <div className="flex justify-between items-center text-rose-600 font-bold mb-3">
                          <div className="flex flex-col">
                              <span>Late Fee & Overdue Charges</span>
                              {order.lateFeeWaived ? <span className="text-[10px] text-rose-400">Waived: ₹{Math.round(order.lateFeeWaived).toLocaleString('en-IN')}</span> : null}
                          </div>
                          <span>+₹{Math.round(order.lateFeeAmount - (order.lateFeeWaived || 0)).toLocaleString('en-IN')}</span>
                      </div>
                  ) : null}

                  <div className="pt-3 border-t border-slate-200 flex justify-between items-center text-xl font-black text-slate-900">
                      <span>Total Amount</span>
                      <span>₹{Math.round(order.totalAmount).toLocaleString('en-IN')}</span>
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
