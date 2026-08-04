import React, { useState, useEffect } from 'react';
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

  // Partial Payment States
  const [payMode, setPayMode] = useState<'FULL' | 'CUSTOM'>('FULL');
  const [customAmount, setCustomAmount] = useState<string>('');
  const [generatingLink, setGeneratingLink] = useState(false);
  const [customLink, setCustomLink] = useState<{ shortUrl: string; upiIntentLink: string } | null>(null);

  useEffect(() => {
    let interval: any;

    const fetchRecord = async () => {
      try {
        const res = await fetch(`/api/public/external-payment/${token}`);
        const data = await res.json();
        if (data.success && data.record) {
          setRecord(data.record);
          const totalAmt = data.record.amount || 0;
          const paidSoFar = data.record.amountPaid || (data.record.status === 'PAID' ? totalAmt : 0);
          if (data.record.status === 'PAID' || paidSoFar >= totalAmt - 0.5) {
            setPaid(true);
          }
        } else {
          setError(data.error || "Invalid or Expired Payment Link");
        }
      } catch (err: any) {
        setError("Network error loading payment details.");
      } finally {
        setLoading(false);
      }
    };

    fetchRecord();
    interval = setInterval(fetchRecord, 10000); // Poll status every 10s

    return () => clearInterval(interval);
  }, [token]);

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

  const totalAmount = record.amount || 0;
  const totalPaidSoFar = record.amountPaid || (record.status === 'PAID' ? totalAmount : 0);
  const remainingBalance = Math.max(0, totalAmount - totalPaidSoFar);

  const activeAmountToPay = payMode === 'CUSTOM' && Number(customAmount) > 0 && Number(customAmount) <= remainingBalance
    ? Number(customAmount)
    : remainingBalance;

  const handleGenerateCustomPartialLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAmountToPay || activeAmountToPay <= 0) return;

    setGeneratingLink(true);
    try {
      const res = await fetch('/api/setu/create-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: activeAmountToPay,
          externalPaymentId: record.id,
          customerID: record.customerContact,
          name: record.customerName
        })
      });
      const data = await res.json();
      if (data.success && data.data) {
        const setuPL = data.data.data?.paymentLink || data.data.paymentLink || {};
        setCustomLink({
          shortUrl: setuPL.shortUrl || setuPL.url || setuPL.shortURL || '',
          upiIntentLink: setuPL.upiIntentLink || setuPL.upiURL || setuPL.upiID || ''
        });
      }
    } catch (err) {
      console.error("Error generating partial payment link:", err);
    } finally {
      setGeneratingLink(false);
    }
  };

  const getPayLink = () => {
    if (customLink?.shortUrl) return customLink.shortUrl;
    if (customLink?.upiIntentLink) return customLink.upiIntentLink;

    if (record.shortLink && (record.shortLink.startsWith('http://') || record.shortLink.startsWith('https://'))) {
      return record.shortLink;
    }
    if (record.upiIntentLink && record.upiIntentLink.startsWith('upi://')) {
      return record.upiIntentLink;
    }
    if (record.upiIntentLink && record.upiIntentLink.includes('@')) {
      return `upi://pay?pa=${record.upiIntentLink}&pn=AuraGold%20Jewellers&am=${activeAmountToPay}&cu=INR&tn=${encodeURIComponent(record.id)}`;
    }
    if (record.platformBillID) {
      return `/api/setu/pay/${record.platformBillID}`;
    }
    return record.shortLink || '';
  };

  const upiPayLink = getPayLink();

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

            {/* Payment Amount Selection Options */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Choose Payment Amount</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setPayMode('FULL'); setCustomLink(null); }}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                    payMode === 'FULL'
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                      : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Pay Full Balance (₹{remainingBalance.toLocaleString('en-IN')})
                </button>
                <button
                  type="button"
                  onClick={() => { setPayMode('CUSTOM'); setCustomLink(null); }}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                    payMode === 'CUSTOM'
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                      : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Pay Partial Amount
                </button>
              </div>

              {payMode === 'CUSTOM' && (
                <form onSubmit={handleGenerateCustomPartialLink} className="pt-2 space-y-2 animate-fadeIn">
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-xs font-bold text-amber-400">₹</span>
                    <input
                      type="number"
                      min={1}
                      max={remainingBalance}
                      placeholder={`Enter partial amount (Max ₹${remainingBalance})`}
                      value={customAmount}
                      onChange={e => setCustomAmount(e.target.value)}
                      className="w-full pl-8 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={generatingLink || !Number(customAmount) || Number(customAmount) <= 0 || Number(customAmount) > remainingBalance}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-amber-400 font-bold text-xs rounded-xl border border-amber-500/30 flex items-center justify-center gap-1.5 transition-all"
                  >
                    {generatingLink ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    <span>Update QR for ₹{Number(customAmount) || 0}</span>
                  </button>
                </form>
              )}
            </div>

            {/* QR Code */}
            <div className="bg-white p-5 rounded-3xl text-slate-900 text-center shadow-xl relative">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                Scan QR code for ₹{activeAmountToPay.toLocaleString('en-IN')}
              </p>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(upiPayLink)}`}
                alt="Setu UPI Payment QR"
                className="w-44 h-44 mx-auto rounded-2xl shadow-inner border border-slate-200"
              />
              <div className="flex justify-center gap-3 mt-3">
                <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">Google Pay</span>
                <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">PhonePe</span>
                <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">Paytm</span>
              </div>
            </div>

            {/* Pay via UPI Button */}
            <a
              href={upiPayLink}
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-sm uppercase tracking-wider rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              Pay ₹{activeAmountToPay.toLocaleString('en-IN')} via UPI <ArrowRight size={16} />
            </a>
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
