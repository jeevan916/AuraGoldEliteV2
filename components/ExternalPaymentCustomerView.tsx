import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ExternalPaymentRecord } from '../types';
import { ReceiptIndianRupee, QrCode, CheckCircle2, ShieldCheck, Lock, ArrowRight, Loader2, Sparkles, History, ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';

interface ExternalPaymentCustomerViewProps {
  token: string;
}

export const ExternalPaymentCustomerView: React.FC<ExternalPaymentCustomerViewProps> = ({ token }) => {
  const [record, setRecord] = useState<ExternalPaymentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);

  // Workflow steps: 'INITIAL' -> 'ENTER_AMOUNT' -> 'GENERATED'
  const [step, setStep] = useState<'INITIAL' | 'ENTER_AMOUNT' | 'GENERATED'>('INITIAL');

  // Amount & Link Generation States
  const [payAmount, setPayAmount] = useState<string>('');
  const [generatingLink, setGeneratingLink] = useState(false);
  const [customLink, setCustomLink] = useState<{ shortUrl: string; upiIntentLink: string } | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  const recordRef = useRef<ExternalPaymentRecord | null>(null);
  recordRef.current = record;

  useEffect(() => {
    let interval: any;

    const fetchRecord = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(`/api/public/external-payment/${token}`, { signal: controller.signal });
        clearTimeout(timeoutId);

        const data = await res.json();
        if (data.success && data.record) {
          setRecord(data.record);
          const totalAmt = data.record.amount || 0;
          const paidSoFar = data.record.amountPaid || (data.record.status === 'PAID' ? totalAmt : 0);
          if (data.record.status === 'PAID' || paidSoFar >= totalAmt - 0.5) {
            setPaid(true);
          } else {
            setPaid(false);
          }
        } else {
          setError(data.error || "Invalid or Expired Payment Link");
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.warn("[ExternalPayment] Fetch timed out after 8s");
        }
        setError((prev) => prev || "Network error loading payment details.");
      } finally {
        setLoading(false);
      }
    };

    fetchRecord();
    interval = setInterval(fetchRecord, 10000); // Poll status every 10s

    return () => clearInterval(interval);
  }, [token]);

  const totalAmount = record?.amount || 0;
  const totalPaidSoFar = record?.amountPaid || (record?.status === 'PAID' ? totalAmount : 0);
  const remainingBalance = Math.max(0, totalAmount - totalPaidSoFar);

  const parsedAmount = Number(payAmount);
  const isValidAmount = !isNaN(parsedAmount) && parsedAmount >= 1 && parsedAmount <= remainingBalance;

  // Explicit link generation triggered strictly when customer clicks "OK" / "Generate Link"
  const handleGenerateLink = async (amountToPay: number, isRetry = false) => {
    const rec = recordRef.current;
    if (!rec || !amountToPay || amountToPay <= 0) return;

    setGeneratingLink(true);
    setGenError(null);
    setCustomLink(null);
    setStep('GENERATED');

    try {
      let res = await fetch('/api/setu/create-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountToPay,
          externalPaymentId: rec.id,
          customerID: rec.customerContact,
          name: rec.customerName,
          forceRefresh: isRetry
        })
      });
      let data = await res.json();

      // Seamless auto-retry once if first attempt encountered any transient issue
      if ((!res.ok || !data.success) && !isRetry) {
        console.warn("[ExternalPayment] First attempt failed. Auto-retrying with fresh credentials...");
        res = await fetch('/api/setu/create-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: amountToPay,
            externalPaymentId: rec.id,
            customerID: rec.customerContact,
            name: rec.customerName,
            forceRefresh: true
          })
        });
        data = await res.json();
      }

      if (res.ok && data.success && data.data) {
        const setuPL = data.data.data?.paymentLink || data.data.paymentLink || data.data || {};
        const shortUrl = setuPL.shortUrl || setuPL.shortURL || setuPL.shortLink || setuPL.url || '';
        const upiIntentLink = setuPL.upiIntentLink || setuPL.upiLink || setuPL.upiURL || (setuPL.upiID && setuPL.upiID.startsWith('upi://') ? setuPL.upiID : '') || (data.data.platformBillID ? `/api/setu/pay/${data.data.platformBillID}` : '');

        setCustomLink({
          shortUrl,
          upiIntentLink
        });
      } else {
        const errMsg = data.error || data.message || "System busy, please try again in a few minutes";
        setGenError(errMsg);
      }
    } catch (err: any) {
      console.error("Error generating Setu payment link:", err);
      // Auto-retry once on network catch if not already a retry
      if (!isRetry) {
        try {
          const retryRes = await fetch('/api/setu/create-link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              amount: amountToPay,
              externalPaymentId: rec.id,
              customerID: rec.customerContact,
              name: rec.customerName,
              forceRefresh: true
            })
          });
          const retryData = await retryRes.json();
          if (retryRes.ok && retryData.success && retryData.data) {
            const setuPL = retryData.data.data?.paymentLink || retryData.data.paymentLink || retryData.data || {};
            const shortUrl = setuPL.shortUrl || setuPL.shortURL || setuPL.shortLink || setuPL.url || '';
            const upiIntentLink = setuPL.upiIntentLink || setuPL.upiLink || setuPL.upiURL || (setuPL.upiID && setuPL.upiID.startsWith('upi://') ? setuPL.upiID : '') || (retryData.data.platformBillID ? `/api/setu/pay/${retryData.data.platformBillID}` : '');

            setCustomLink({
              shortUrl,
              upiIntentLink
            });
            return;
          }
        } catch (retryCatch) {}
      }
      setGenError("System busy, please try again in a few minutes");
    } finally {
      setGeneratingLink(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <Loader2 size={36} className="animate-spin text-amber-500 mb-4" />
        <h2 className="text-lg font-bold">Loading Payment Details...</h2>
        <p className="text-slate-400 text-xs mt-1">Securing connection to Setu UPI Gateway</p>
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center mb-4">
          <ShieldCheck size={32} />
        </div>
        <h2 className="text-xl font-black mb-2">Invalid or Expired Payment Request</h2>
        <p className="text-slate-400 text-xs max-w-sm mb-6">{error || "This payment link could not be found or has expired."}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-amber-500 text-slate-950 font-black rounded-2xl text-xs uppercase tracking-wider hover:bg-amber-400 transition-all cursor-pointer"
        >
          Retry Loading
        </button>
      </div>
    );
  }

  const getQrCodeLink = () => {
    if (!isValidAmount) return '';
    if (customLink?.upiIntentLink) return customLink.upiIntentLink;
    if (customLink?.shortUrl) return customLink.shortUrl;

    if (parsedAmount === remainingBalance) {
      if (record.upiIntentLink) return record.upiIntentLink;
      if (record.shortLink) return record.shortLink;
      if (record.platformBillID) return `/api/setu/pay/${record.platformBillID}`;
    }
    return '';
  };

  const getPayButtonLink = () => {
    if (!isValidAmount) return '';
    if (customLink?.upiIntentLink) return customLink.upiIntentLink;
    if (customLink?.shortUrl) return customLink.shortUrl;

    if (parsedAmount === remainingBalance) {
      if (record.upiIntentLink) return record.upiIntentLink;
      if (record.shortLink) return record.shortLink;
      if (record.platformBillID) return `/api/setu/pay/${record.platformBillID}`;
    }
    return '';
  };

  const qrCodeLink = getQrCodeLink();
  const upiPayLink = getPayButtonLink();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 md:p-6 relative overflow-hidden font-sans">
      <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-700/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative z-10 space-y-6">
        {/* Header */}
        <div className="text-center pb-4 border-b border-slate-800">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full font-bold text-[10px] uppercase tracking-wider mb-3">
            <ReceiptIndianRupee size={12} />
            {record.referenceNote || 'External Payment Request'}
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight leading-none">AuraGold</h1>
          <p className="text-[11px] font-bold text-amber-500/80 mt-1 uppercase tracking-widest text-center w-full">By Sanghavi Jewellers</p>
          <p className="text-xs text-slate-400 mt-3">Official Setu UPI Payment Gateway</p>
        </div>

        {/* Payment Settled Screen */}
        {paid ? (
          <div className="bg-emerald-950/40 border border-emerald-500/30 p-6 rounded-3xl text-center space-y-3 animate-fadeIn">
            <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 size={32} />
            </div>
            <h2 className="text-xl font-black text-emerald-400">Payment Fully Received!</h2>
            <p className="text-xs text-emerald-200">
              Thank you, <strong className="text-white">{record.customerName}</strong>. Your payment request of <strong className="text-white">₹{totalAmount.toLocaleString('en-IN')}</strong> has been fully settled.
            </p>
            {record.paidAt && (
              <p className="text-[11px] text-emerald-300 font-medium">
                Settled on {new Date(record.paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            )}
            {record.txnId && (
              <div className="text-[11px] font-mono text-emerald-300/80 pt-2 border-t border-emerald-800/40">
                Transaction ID: {record.txnId}
              </div>
            )}

            {/* Installments Breakdown */}
            {record.partialPayments && record.partialPayments.length > 0 && (
              <div className="mt-4 pt-3 border-t border-emerald-800/40 text-left">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block mb-2">Payment History</span>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {record.partialPayments.map((p, idx) => (
                    <div key={idx} className="flex justify-between items-center text-[11px] bg-emerald-900/30 p-2 rounded-xl border border-emerald-700/30">
                      <span className="text-slate-300">{new Date(p.paidAt).toLocaleDateString('en-IN')}</span>
                      <span className="font-bold text-white">₹{Number(p.amount).toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {/* STEP 1: INITIAL SUMMARY & PAY NOW BUTTON */}
            {step === 'INITIAL' && (
              <div className="space-y-5 animate-fadeIn">
                {/* Summary Card */}
                <div className="bg-slate-800/60 p-5 rounded-3xl border border-slate-700/60 space-y-3">
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>Customer Name:</span>
                    <span className="font-bold text-white">{record.customerName}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>Reference Tag:</span>
                    <span className="font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      {record.referenceNote}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>Purpose / Order:</span>
                    <span className="font-medium text-slate-200">{record.description}</span>
                  </div>

                  {/* Amount Breakdown */}
                  <div className="pt-3 border-t border-slate-700/60 space-y-2">
                    <div className="flex justify-between items-center text-xs text-slate-400">
                      <span>Total Amount Requested:</span>
                      <span className="font-bold text-white">₹{totalAmount.toLocaleString('en-IN')}</span>
                    </div>
                    {totalPaidSoFar > 0 && (
                      <div className="flex justify-between items-center text-xs text-emerald-400">
                        <span>Paid So Far:</span>
                        <span className="font-bold">₹{totalPaidSoFar.toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-2 border-t border-slate-700/40">
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Remaining Balance Due</span>
                      <span className="text-2xl font-black text-amber-400">₹{remainingBalance.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                {/* Previous Partial Payments List */}
                {record.partialPayments && record.partialPayments.length > 0 && (
                  <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/40">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300 mb-2">
                      <History size={14} className="text-amber-400" />
                      <span>Received Payments ({record.partialPayments.length})</span>
                    </div>
                    <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                      {record.partialPayments.map((p, idx) => (
                        <div key={idx} className="flex justify-between items-center text-[11px] bg-slate-900/60 p-2 rounded-xl border border-slate-800 text-slate-300">
                          <span>{new Date(p.paidAt).toLocaleDateString('en-IN')} ({p.mode || 'UPI'})</span>
                          <span className="font-bold text-emerald-400">+₹{Number(p.amount).toLocaleString('en-IN')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Primary Action Button: Pay Now */}
                <button
                  type="button"
                  onClick={() => {
                    setPayAmount(String(remainingBalance));
                    setStep('ENTER_AMOUNT');
                  }}
                  className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-sm uppercase tracking-wider rounded-2xl shadow-xl transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Pay Now (₹{remainingBalance.toLocaleString('en-IN')})</span>
                  <ArrowRight size={18} />
                </button>
              </div>
            )}

            {/* STEP 2: ENTER AMOUNT & CONFIRM */}
            {step === 'ENTER_AMOUNT' && (
              <div className="space-y-5 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep('INITIAL')}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft size={14} />
                    <span>Back</span>
                  </button>
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Step 1 of 2: Set Amount</span>
                </div>

                <div className="bg-slate-800/80 border border-slate-700 p-5 rounded-3xl space-y-4">
                  <div>
                    <label htmlFor="payment-amount-input" className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-1">
                      Enter Payment Amount
                    </label>
                    <p className="text-[11px] text-slate-400">
                      Remaining balance due: <strong className="text-amber-400">₹{remainingBalance.toLocaleString('en-IN')}</strong>
                    </p>
                  </div>

                  <div className="relative">
                    <span className="absolute left-3.5 top-3.5 text-base font-black text-amber-400">₹</span>
                    <input
                      id="payment-amount-input"
                      type="number"
                      min={1}
                      max={remainingBalance}
                      step="any"
                      placeholder={`1 to ${remainingBalance}`}
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      className={`w-full pl-8 pr-4 py-3 bg-slate-900 border rounded-2xl text-lg font-black text-white focus:outline-none transition-all ${
                        !payAmount
                          ? 'border-slate-700 focus:border-amber-500'
                          : !isValidAmount
                          ? 'border-rose-500/70 focus:border-rose-500 text-rose-300'
                          : 'border-amber-500/50 focus:border-amber-400 text-amber-300'
                      }`}
                    />
                  </div>

                  {/* Preset Amount Button */}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setPayAmount(String(remainingBalance))}
                      className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-xl border border-slate-600 transition-all cursor-pointer"
                    >
                      Full Amount (₹{remainingBalance.toLocaleString('en-IN')})
                    </button>
                  </div>

                  {/* Validation Feedback */}
                  {payAmount !== '' && !isValidAmount && (
                    <p className="text-[11px] font-bold text-rose-400">
                      {parsedAmount < 1
                        ? 'Minimum payment amount is ₹1.'
                        : parsedAmount > remainingBalance
                        ? `Amount cannot exceed remaining balance of ₹${remainingBalance.toLocaleString('en-IN')}.`
                        : 'Please enter a valid payment amount.'}
                    </p>
                  )}
                </div>

                {/* Proceed Button */}
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={!isValidAmount}
                    onClick={() => handleGenerateLink(parsedAmount)}
                    className={`w-full py-4 font-black text-sm uppercase tracking-wider rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 ${
                      isValidAmount
                        ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 active:scale-95 cursor-pointer'
                        : 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed opacity-60'
                    }`}
                  >
                    <span>OK — Generate Link & QR for ₹{isValidAmount ? parsedAmount.toLocaleString('en-IN') : '0'}</span>
                    <ArrowRight size={18} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep('INITIAL')}
                    className="w-full py-2.5 text-xs text-slate-400 hover:text-slate-200 font-bold transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: GENERATED LINK, QR CODE & PAY BUTTON */}
            {step === 'GENERATED' && (
              <div className="space-y-5 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep('ENTER_AMOUNT')}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft size={14} />
                    <span>Change Amount</span>
                  </button>
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                    Amount: ₹{parsedAmount.toLocaleString('en-IN')}
                  </span>
                </div>

                {generatingLink ? (
                  <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl text-center space-y-3">
                    <Loader2 size={36} className="animate-spin text-amber-500 mx-auto" />
                    <h3 className="text-sm font-bold text-white">Generating Setu UPI Link...</h3>
                    <p className="text-xs text-slate-400">Securing payment link for ₹{parsedAmount.toLocaleString('en-IN')}</p>
                  </div>
                ) : genError ? (
                  <div className="bg-rose-950/40 border border-rose-500/30 p-5 rounded-3xl text-center space-y-3">
                    <AlertCircle size={28} className="text-rose-500 mx-auto" />
                    <p className="text-xs font-bold text-rose-300">{genError}</p>
                    <button
                      type="button"
                      onClick={() => handleGenerateLink(parsedAmount, true)}
                      className="px-4 py-2 bg-rose-500 text-white font-bold text-xs rounded-xl hover:bg-rose-600 cursor-pointer flex items-center justify-center gap-1.5 mx-auto"
                    >
                      <RefreshCw size={14} />
                      <span>Retry Link Generation</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* QR Code Container */}
                    <div className="bg-white p-6 rounded-3xl text-slate-900 text-center shadow-xl flex flex-col items-center justify-center space-y-3">
                      <p className="text-xs font-black uppercase tracking-wider text-slate-600">
                        Scan QR Code for ₹{parsedAmount.toLocaleString('en-IN')}
                      </p>

                      {qrCodeLink ? (
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrCodeLink)}`}
                          alt="Setu UPI Payment QR"
                          className="w-48 h-48 mx-auto rounded-2xl shadow-inner border border-slate-200"
                        />
                      ) : (
                        <div className="w-48 h-48 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 text-xs">
                          QR Unavailable
                        </div>
                      )}

                      <div className="flex justify-center gap-2 pt-1">
                        <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">Google Pay</span>
                        <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">PhonePe</span>
                        <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">Paytm</span>
                      </div>
                    </div>

                    {/* Pay Button Directly Below QR Code */}
                    <button
                      type="button"
                      disabled={!upiPayLink}
                      onClick={() => {
                        if (upiPayLink && upiPayLink !== '#') {
                          window.location.href = upiPayLink;
                        }
                      }}
                      className={`w-full py-4 font-black text-sm uppercase tracking-wider rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 ${
                        upiPayLink
                          ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 active:scale-95 cursor-pointer'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                      }`}
                    >
                      <span>Pay ₹{parsedAmount.toLocaleString('en-IN')} via UPI App</span>
                      <ArrowRight size={18} />
                    </button>

                    <button
                      type="button"
                      onClick={() => setStep('ENTER_AMOUNT')}
                      className="w-full py-2.5 text-xs text-slate-400 hover:text-slate-200 font-bold transition-all cursor-pointer text-center block"
                    >
                      Change Payment Amount
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Security Footer */}
        <div className="pt-4 border-t border-slate-800 text-center text-[10px] text-slate-500 flex items-center justify-center gap-2">
          <Lock size={12} className="text-emerald-500" />
          <span>256-Bit Encrypted • Verified Setu UPI Gateway Partner</span>
        </div>
      </div>
    </div>
  );
};

export default ExternalPaymentCustomerView;

