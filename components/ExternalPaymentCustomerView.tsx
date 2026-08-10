import React, { useState, useEffect, useCallback } from 'react';
import { ExternalPaymentRecord } from '../types';
import { ReceiptIndianRupee, QrCode, CheckCircle2, ShieldCheck, Lock, ExternalLink, ArrowRight, Loader2, Sparkles, History } from 'lucide-react';

interface ExternalPaymentCustomerViewProps {
  token: string;
}

export const ExternalPaymentCustomerView: React.FC<ExternalPaymentCustomerViewProps> = ({ token }) => {
  const [record, setRecord] = useState<ExternalPaymentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);

  // Amount & Link Generation States
  const [payAmount, setPayAmount] = useState<string>('');
  const [amountInitialized, setAmountInitialized] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [customLink, setCustomLink] = useState<{ shortUrl: string; upiIntentLink: string } | null>(null);

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

  // Initialize payment amount with remaining balance when record loads
  useEffect(() => {
    if (record && !amountInitialized) {
      const rem = Math.max(0, (record.amount || 0) - (record.amountPaid || (record.status === 'PAID' ? record.amount || 0 : 0)));
      setPayAmount(rem > 0 ? String(rem) : '');
      setAmountInitialized(true);
    }
  }, [record, amountInitialized]);

  const parsedAmount = Number(payAmount);
  const isValidAmount = !isNaN(parsedAmount) && parsedAmount >= 1 && parsedAmount <= remainingBalance;

  // Generate Setu link for the entered amount
  const generateSetuLinkForAmount = useCallback(async (amountToPay: number) => {
    if (!record || !amountToPay || amountToPay <= 0) return;

    setGeneratingLink(true);
    try {
      const res = await fetch('/api/setu/create-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountToPay,
          externalPaymentId: record.id,
          customerID: record.customerContact,
          name: record.customerName
        })
      });
      const data = await res.json();
      if (data.success && data.data) {
        const setuPL = data.data.data?.paymentLink || data.data.paymentLink || data.data || {};
        const shortUrl = setuPL.shortUrl || setuPL.shortURL || setuPL.shortLink || setuPL.url || '';
        const upiIntentLink = setuPL.upiIntentLink || setuPL.upiLink || setuPL.upiURL || (setuPL.upiID && setuPL.upiID.startsWith('upi://') ? setuPL.upiID : '') || (data.data.platformBillID ? `/api/setu/pay/${data.data.platformBillID}` : '');
        
        console.log("[ExternalPayment] Generated Setu link:", { shortUrl, upiIntentLink });

        setCustomLink({
          shortUrl,
          upiIntentLink
        });
      }
    } catch (err) {
      console.error("Error generating Setu payment link:", err);
    } finally {
      setGeneratingLink(false);
    }
  }, [record]);

  // Debounced QR generation on change of amount
  useEffect(() => {
    if (!record || paid || !isValidAmount) return;

    const timer = setTimeout(() => {
      generateSetuLinkForAmount(parsedAmount);
    }, 500);

    return () => clearTimeout(timer);
  }, [parsedAmount, isValidAmount, record?.id, paid, generateSetuLinkForAmount]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <Loader2 size={36} className="animate-spin text-amber-500 mb-4" />
        <h2 className="text-lg font-bold">Loading Payment Request...</h2>
        <p className="text-slate-400 text-xs mt-1">Securing connection to Setu UPI Gateway</p>
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center mb-4">
          <ShieldCheck size={32} />
        </div>
        <h2 className="text-xl font-black mb-2">Invalid or Expired Payment Request</h2>
        <p className="text-slate-400 text-xs max-w-sm mb-6">{error || "This payment link could not be found or has expired."}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-amber-500 text-slate-950 font-black rounded-2xl text-xs uppercase tracking-wider"
        >
          Retry Loading
        </button>
      </div>
    );
  }

  const getQrCodeLink = () => {
    if (!isValidAmount) return '';
    // Priority 1: Direct upi:// intent link from custom generated link
    if (customLink?.upiIntentLink && (customLink.upiIntentLink.startsWith('upi://') || customLink.upiIntentLink.includes('pa='))) {
      return customLink.upiIntentLink;
    }
    if (customLink?.upiIntentLink) {
      return customLink.upiIntentLink;
    }
    if (customLink?.shortUrl) {
      return customLink.shortUrl;
    }

    // Priority 2: Default record link if amount matches remaining balance
    if (parsedAmount === remainingBalance) {
      if (record.upiIntentLink && (record.upiIntentLink.startsWith('upi://') || record.upiIntentLink.includes('pa='))) {
        return record.upiIntentLink;
      }
      if (record.upiIntentLink && record.upiIntentLink.includes('@')) {
        return `upi://pay?pa=${record.upiIntentLink}&pn=AuraGold%20Jewellers&am=${parsedAmount}&cu=INR&tn=${encodeURIComponent(record.id)}`;
      }
      if (record.upiIntentLink) {
        return record.upiIntentLink;
      }
      if (record.shortLink) {
        return record.shortLink;
      }
      if (record.platformBillID) {
        return `/api/setu/pay/${record.platformBillID}`;
      }
    }
    return '';
  };

  const getPayButtonLink = () => {
    if (!isValidAmount) return '';
    if (customLink?.upiIntentLink && customLink.upiIntentLink.startsWith('upi://')) {
      return customLink.upiIntentLink;
    }
    if (customLink?.shortUrl) {
      return customLink.shortUrl;
    }
    if (customLink?.upiIntentLink) {
      return customLink.upiIntentLink;
    }

    if (parsedAmount === remainingBalance) {
      if (record.upiIntentLink && record.upiIntentLink.startsWith('upi://')) {
        return record.upiIntentLink;
      }
      if (record.shortLink) {
        return record.shortLink;
      }
      if (record.upiIntentLink) {
        return record.upiIntentLink;
      }
      if (record.platformBillID) {
        return `/api/setu/pay/${record.platformBillID}`;
      }
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
          <h1 className="text-2xl font-black text-white tracking-tight">AuraGold Jewellers</h1>
          <p className="text-xs text-slate-400 mt-1">Official Setu UPI Remote Payment Gateway</p>
        </div>

        {/* Payment Amount & Status */}
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

            {/* Installments Breakdown if partial payments were made */}
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
            {/* Status Summary Card */}
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
                <div className="flex justify-between items-center pt-1 border-t border-slate-700/40">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Remaining Balance Due</span>
                  <span className="text-2xl font-black text-amber-400">₹{remainingBalance.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            {/* Previous Partial Payments List if any */}
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

            {/* Amount Input Text Box */}
            <div className="bg-slate-900 border border-slate-800 p-4.5 rounded-2xl space-y-2.5">
              <div className="flex justify-between items-center">
                <label htmlFor="payment-amount-input" className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Enter Amount to Pay
                </label>
                <span className="text-[11px] font-semibold text-slate-400">
                  Max: <strong className="text-amber-400">₹{remainingBalance.toLocaleString('en-IN')}</strong>
                </span>
              </div>

              <div className="relative">
                <span className="absolute left-3.5 top-3 text-sm font-black text-amber-400">₹</span>
                <input
                  id="payment-amount-input"
                  type="number"
                  min={1}
                  max={remainingBalance}
                  step="any"
                  placeholder={`1 to ${remainingBalance}`}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className={`w-full pl-8 pr-4 py-3 bg-slate-800 border rounded-xl text-base font-bold text-white focus:outline-none transition-all ${
                    !payAmount
                      ? 'border-slate-700 focus:border-amber-500'
                      : !isValidAmount
                      ? 'border-rose-500/70 focus:border-rose-500 text-rose-300'
                      : 'border-amber-500/50 focus:border-amber-400 text-amber-300'
                  }`}
                />
              </div>

              {/* Validation Feedback */}
              {payAmount !== '' && !isValidAmount && (
                <p className="text-[11px] font-bold text-rose-400 animate-fadeIn">
                  {parsedAmount < 1
                    ? 'Minimum payment amount is ₹1.'
                    : parsedAmount > remainingBalance
                    ? `Amount cannot exceed remaining balance of ₹${remainingBalance.toLocaleString('en-IN')}.`
                    : 'Please enter a valid payment amount.'}
                </p>
              )}
              {isValidAmount && (
                <p className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
                  <Sparkles size={12} className="text-amber-400" />
                  <span>QR code automatically generates for ₹{parsedAmount.toLocaleString('en-IN')}</span>
                </p>
              )}
            </div>

            {/* QR Code */}
            <div className="bg-white p-5 rounded-3xl text-slate-900 text-center shadow-xl relative min-h-[260px] flex flex-col items-center justify-center">
              {!isValidAmount ? (
                <div className="w-44 h-44 my-2 rounded-2xl bg-slate-100 border border-dashed border-slate-300 flex flex-col items-center justify-center p-4 text-center gap-2 text-slate-400">
                  <QrCode size={32} className="text-slate-400" />
                  <span className="text-[11px] font-bold text-slate-600">
                    Enter amount (₹1 – ₹{remainingBalance.toLocaleString('en-IN')}) to display QR code
                  </span>
                </div>
              ) : generatingLink ? (
                <div className="w-44 h-44 my-2 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center gap-2 text-slate-500">
                  <Loader2 size={28} className="animate-spin text-amber-500" />
                  <span className="text-[10px] font-bold text-center px-2">Generating QR for ₹{parsedAmount.toLocaleString('en-IN')}...</span>
                </div>
              ) : qrCodeLink ? (
                <>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Scan QR code for ₹{parsedAmount.toLocaleString('en-IN')}
                  </p>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrCodeLink)}`}
                    alt="Setu UPI Payment QR"
                    className="w-44 h-44 mx-auto rounded-2xl shadow-inner border border-slate-200"
                  />
                  <div className="flex justify-center gap-3 mt-3">
                    <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">Google Pay</span>
                    <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">PhonePe</span>
                    <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">Paytm</span>
                  </div>
                </>
              ) : (
                <div className="w-44 h-44 my-2 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center gap-2 text-slate-500">
                  <Loader2 size={28} className="animate-spin text-amber-500" />
                  <span className="text-[10px] font-bold">Preparing Setu Gateway...</span>
                </div>
              )}
            </div>

            {/* Pay via UPI Button */}
            <button
              type="button"
              disabled={!isValidAmount || generatingLink || !upiPayLink}
              onClick={() => {
                if (upiPayLink && upiPayLink !== '#') {
                  window.location.href = upiPayLink;
                }
              }}
              className={`w-full py-4 font-black text-sm uppercase tracking-wider rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 ${
                isValidAmount && !generatingLink && upiPayLink
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 active:scale-95 cursor-pointer'
                  : 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed opacity-60'
              }`}
            >
              {generatingLink ? (
                <>
                  <Loader2 size={16} className="animate-spin text-amber-500" />
                  <span>Securing UPI Gateway...</span>
                </>
              ) : isValidAmount && upiPayLink ? (
                <>
                  <span>Pay ₹{parsedAmount.toLocaleString('en-IN')} via UPI</span>
                  <ArrowRight size={16} />
                </>
              ) : (
                <span>Enter valid amount to pay</span>
              )}
            </button>
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

