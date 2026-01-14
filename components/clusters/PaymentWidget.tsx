
import React, { useState, useEffect } from 'react';
import { CreditCard, QrCode, X, Share2, Smartphone } from 'lucide-react';
import { Card, Button } from '../shared/BaseUI';
import { Order, OrderStatus } from '../../types';
import { whatsappService } from '../../services/whatsappService';

interface PaymentWidgetProps {
  order: Order;
  onPaymentRecorded: (order: Order) => void; 
  variant?: 'FULL' | 'COMPACT';
}

export const PaymentWidget: React.FC<PaymentWidgetProps> = ({ order, onPaymentRecorded, variant = 'FULL' }) => {
  const [activeTab, setActiveTab] = useState<'RECORD' | 'REQUEST'>('RECORD');
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('UPI');
  const [loading, setLoading] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);

  const totalPaid = order.payments.reduce((acc, p) => acc + p.amount, 0);
  const remaining = order.totalAmount - totalPaid;
  const nextMilestone = order.paymentPlan.milestones.find(m => m.status !== 'PAID');

  useEffect(() => {
      if (!amount && nextMilestone) {
          setAmount(nextMilestone.targetAmount.toString());
      } else if (!amount) {
          setAmount(remaining.toString());
      }
  }, [nextMilestone, remaining, amount]);

  const handleRecordPayment = async () => {
    const val = parseFloat(amount);
    if (!val || val <= 0) return;
    setLoading(true);

    try {
      const newPayment = {
        id: `PAY-${Date.now()}`,
        date: new Date().toISOString(),
        amount: val,
        method: mode,
        note: 'Manual Entry'
      };

      const updatedPayments = [...order.payments, newPayment];
      const newTotalPaid = totalPaid + val;
      
      let runningSum = 0;
      const updatedMilestones = order.paymentPlan.milestones.map(m => {
        runningSum += m.targetAmount;
        const status = newTotalPaid >= runningSum ? 'PAID' : (newTotalPaid > (runningSum - m.targetAmount) ? 'PARTIAL' : 'PENDING');
        return { ...m, status: status as any };
      });

      const isComplete = newTotalPaid >= order.totalAmount - 1;
      
      const updatedOrder = {
        ...order,
        payments: updatedPayments,
        paymentPlan: { ...order.paymentPlan, milestones: updatedMilestones },
        status: isComplete ? OrderStatus.COMPLETED : order.status
      };

      await whatsappService.sendMessage(
          order.customerContact, 
          `Payment Received: ₹${val.toLocaleString()}. Remaining: ₹${(remaining - val).toLocaleString()}. Thank you!`, 
          order.customerName
      );

      onPaymentRecorded(updatedOrder);
      setAmount('');
      setQrCodeUrl(null);
    } catch (e: any) {
      alert("Error recording payment");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateQR = async () => {
      const val = parseFloat(amount);
      if (!val || val <= 0) return;
      
      const upiString = `upi://pay?pa=auragold@upi&pn=AuraGold%20Jewellers&tr=${order.id}&am=${val}&cu=INR&tn=Jewellery%20Payment`;
      
      // Use QuickChart API to avoid local qrcode dependency issues during build
      setQrCodeUrl(`https://quickchart.io/qr?text=${encodeURIComponent(upiString)}&margin=2&size=300`);
      setActiveTab('REQUEST');
  };

  const handleSendRequest = async () => {
      const val = parseFloat(amount);
      if (!val || val <= 0) return;
      setLoading(true);

      try {
        const upiLink = `upi://pay?pa=auragold@upi&pn=AuraGold&tr=${order.id}&am=${val}&cu=INR`;
        const message = `Dear ${order.customerName}, a payment of ₹${val.toLocaleString()} is due for your jewellery plan.\n\n` +
                        `Pay via UPI: ${upiLink}\n\n` +
                        `Order ID: ${order.id}`;

        await whatsappService.sendMessage(order.customerContact, message, order.customerName);
        alert("Payment link sent to customer!");
      } catch (e) {
          alert("Failed to send WhatsApp request.");
      } finally {
          setLoading(false);
      }
  };

  if (variant === 'COMPACT') {
    return (
      <Card className="p-4 flex justify-between items-center bg-slate-50 border-slate-200">
        <div>
          <p className="text-[10px] font-black uppercase text-slate-400">Next Milestone</p>
          <p className="font-black text-slate-800">
            {nextMilestone ? `₹${nextMilestone.targetAmount.toLocaleString()}` : 'Fully Settled'}
          </p>
        </div>
        <Button size="sm" onClick={() => setActiveTab('REQUEST')} disabled={remaining <= 0}>
          Collect
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-5 bg-white border-l-4 border-l-emerald-500">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Paid</p>
          <p className="text-2xl font-black text-emerald-600">₹{totalPaid.toLocaleString()}</p>
        </Card>
        <Card className="p-5 bg-white border-l-4 border-l-rose-500">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Balance Due</p>
          <p className="text-2xl font-black text-rose-500">₹{remaining.toLocaleString()}</p>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-4 mb-6 border-b pb-1">
             <button 
                onClick={() => setActiveTab('RECORD')}
                className={`pb-3 text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'RECORD' ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
             >
                In-Shop Collection
             </button>
             <button 
                onClick={() => setActiveTab('REQUEST')}
                className={`pb-3 text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'REQUEST' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
             >
                Remote Request
             </button>
        </div>

        {activeTab === 'RECORD' && (
            <div className="animate-fadeIn">
                <div className="flex gap-3 mb-6">
                {['UPI', 'CASH', 'CARD'].map(m => (
                    <button 
                    key={m} 
                    onClick={() => setMode(m)}
                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${mode === m ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >
                    {m}
                    </button>
                ))}
                </div>

                <div className="flex gap-3 items-end">
                    <div className="flex-1">
                        <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block ml-1">Payment Amount</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                            <input 
                                type="number" 
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-4 pl-9 font-black text-xl text-slate-800 outline-none focus:bg-white transition-all"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                            />
                        </div>
                    </div>
                    <Button onClick={handleRecordPayment} loading={loading} disabled={!amount} size="lg" className="h-[60px]">
                        Save
                    </Button>
                </div>
                
                <div className="mt-4 pt-4 border-t flex gap-3">
                    <button 
                        onClick={handleGenerateQR}
                        className="flex-1 bg-amber-50 text-amber-700 py-3 rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-2 border border-amber-100"
                    >
                        <QrCode size={16} /> Display UPI QR
                    </button>
                </div>
            </div>
        )}

        {activeTab === 'REQUEST' && (
            <div className="animate-fadeIn space-y-4">
                {qrCodeUrl ? (
                    <div className="bg-slate-50 p-6 rounded-2xl flex flex-col items-center border border-slate-200 animate-slideDown">
                        <div className="flex justify-between w-full mb-4 items-center">
                            <h4 className="text-xs font-black uppercase text-slate-500">Scan to Pay (₹{amount})</h4>
                            <button onClick={() => setQrCodeUrl(null)} className="text-slate-400"><X size={18} /></button>
                        </div>
                        <img src={qrCodeUrl} className="w-48 h-48 bg-white p-2 rounded-xl shadow-inner mb-4" alt="UPI QR Code" />
                        <p className="text-[10px] font-medium text-slate-400 text-center">Open any UPI App (GPay, PhonePe, Paytm) and scan this code to complete payment.</p>
                    </div>
                ) : (
                    <>
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex gap-3">
                            <Smartphone className="text-blue-500 shrink-0" size={20} />
                            <div className="text-xs text-blue-800 leading-relaxed">
                                <p className="font-bold mb-1 italic">WhatsApp Payment Link</p>
                                <p className="opacity-80">This will send a secure deep-link to the customer's phone.</p>
                            </div>
                        </div>
                        <div className="flex gap-3 items-end">
                            <div className="flex-1">
                                <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block ml-1">Request Amount</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                                    <input 
                                        type="number" 
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-4 pl-9 font-black text-xl text-slate-800 outline-none focus:bg-white"
                                        value={amount}
                                        onChange={e => setAmount(e.target.value)}
                                    />
                                </div>
                            </div>
                            <button 
                                onClick={handleSendRequest}
                                disabled={loading || !amount}
                                className="bg-blue-600 h-[60px] text-white px-6 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                            >
                                {loading ? 'Sending...' : <><Share2 size={16} /> Send</>}
                            </button>
                        </div>
                    </>
                )}
            </div>
        )}
      </Card>
    </div>
  );
};
