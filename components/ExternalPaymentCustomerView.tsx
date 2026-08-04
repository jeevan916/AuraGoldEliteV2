import React, { useState, useEffect } from 'react';
import { ExternalPaymentRecord } from '../types';
import { ReceiptIndianRupee, QrCode, CheckCircle2, ShieldCheck, Lock, ExternalLink, ArrowRight, Loader2, Sparkles } from 'lucide-react';

interface ExternalPaymentCustomerViewProps {
  token: string;
}

export const ExternalPaymentCustomerView: React.FC<ExternalPaymentCustomerViewProps> = ({ token }) => {
  const [record, setRecord] = useState<ExternalPaymentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    let interval: any;

    const fetchRecord = async () => {
      try {
        const res = await fetch(`/api/public/external-payment/${token}`);
        const data = await res.json();
        if (data.success && data.record) {
          setRecord(data.record);
          if (data.record.status === 'PAID') {
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

  const getPayLink = () => {
    if (record.shortLink && (record.shortLink.startsWith('http://') || record.shortLink.startsWith('https://'))) {
      return record.shortLink;
    }
    if (record.upiIntentLink && record.upiIntentLink.startsWith('upi://')) {
      return record.upiIntentLink;
    }
    if (record.upiIntentLink && record.upiIntentLink.includes('@')) {
      return `upi://pay?pa=${record.upiIntentLink}&pn=AuraGold%20Jewellers&am=${record.amount}&cu=INR&tn=${encodeURIComponent(record.id)}`;
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
          <div className="bg-emerald-950/40 border border-emerald-500/30 p-6 rounded-3xl text-center space-y-3">
            <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 size={32} />
            </div>
            <h2 className="text-xl font-black text-emerald-400">Payment Received!</h2>
            <p className="text-xs text-emerald-200">
              Thank you, <strong className="text-white">{record.customerName}</strong>. Your payment of <strong className="text-white">₹{record.amount.toLocaleString('en-IN')}</strong> was completed successfully.
            </p>
            {record.txnId && (
              <div className="text-[11px] font-mono text-emerald-300/80 pt-2 border-t border-emerald-800/40">
                Transaction ID: {record.txnId}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
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
              <div className="pt-2 border-t border-slate-700/60 flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Amount Due</span>
                <span className="text-2xl font-black text-amber-400">₹{record.amount.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* QR Code */}
            <div className="bg-white p-5 rounded-3xl text-slate-900 text-center shadow-xl">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3">Scan QR code with any UPI App</p>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(upiPayLink)}`}
                alt="Setu UPI Payment QR"
                className="w-44 h-44 mx-auto rounded-2xl shadow-inner border border-slate-200"
              />
              <div className="flex justify-center gap-3 mt-4">
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
              Pay ₹{record.amount.toLocaleString('en-IN')} via UPI <ArrowRight size={16} />
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
