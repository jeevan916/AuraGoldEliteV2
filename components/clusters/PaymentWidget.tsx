
import React, { useState, useEffect } from 'react';
import { CreditCard, QrCode, X, Share2, Smartphone, Link, Zap } from 'lucide-react';
import { Card, Button } from '../shared/BaseUI';
import { Order, OrderStatus } from '../../types';
import { whatsappService } from '../../services/whatsappService';
import { storageService } from '../../services/storageService';

interface PaymentWidgetProps {
  order: Order;
  onPaymentRecorded: (order: Order) => void; 
  variant?: 'FULL' | 'COMPACT';
}

export const PaymentWidget: React.FC<PaymentWidgetProps> = ({ order, onPaymentRecorded, variant = 'FULL' }) => {
  const [activeTab, setActiveTab] = useState<'RECORD' | 'REQUEST' | 'GATEWAY'>('RECORD');
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

  const updateOrderWithPayment = (val: number, method: string, notes: string) => {
      const newPayment = {
        id: `PAY-${Date.now()}`,
        date: new Date().toISOString(),
        amount: val,
        method: method,
        note: notes
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
      
      onPaymentRecorded(updatedOrder);
  };

  const handleRecordPayment = async () => {
    const val = parseFloat(amount);
    if (!val || val <= 0) return;
    setLoading(true);

    try {
      updateOrderWithPayment(val, mode, 'Manual Entry');

      await whatsappService.sendMessage(
          order.customerContact, 
          `Payment Received: ₹${val.toLocaleString()}. Remaining: ₹${(remaining - val).toLocaleString()}. Thank you!`, 
          order.customerName
      );

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
      setQrCodeUrl(`https://quickchart.io/qr?text=${encodeURIComponent(upiString)}&margin=2&size=300`);
      setActiveTab('REQUEST');
  };

  const handleCreateRazorpayOrder = async () => {
      const val = parseFloat(amount);
      if (!val || val <= 0) return;
      setLoading(true);

      try {
          // Call backend to create order
          const response = await fetch('/api/razorpay/create-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ amount: val, currency: "INR", receipt: order.id })
          });
          
          const orderData = await response.json();
          if (orderData.error) throw new Error(orderData.error);
          
          const settings = storageService.getSettings();

          // Initialize Razorpay Options
          const options = {
              key: settings.razorpayKeyId, // Enter the Key ID generated from the Dashboard
              amount: orderData.amount,
              currency: orderData.currency,
              name: "AuraGold Jewellers",
              description: `Payment for Order #${order.id}`,
              order_id: orderData.id,
              handler: function (response: any) {
                  updateOrderWithPayment(val, 'RAZORPAY', `Online ID: ${response.razorpay_payment_id}`);
                  alert("Payment Successful!");
              },
              prefill: {
                  name: order.customerName,
                  contact: order.customerContact,
              },
              theme: {
                  color: "#B8860B"
              }
          };

          const rzp1 = new (window as any).Razorpay(options);
          rzp1.open();
      } catch (e: any) {
          alert(`Gateway Error: ${e.message}`);
      } finally {
          setLoading(false);
      }
  };

  const handleGenerateSetuLink = () => {
      const val = parseFloat(amount);
      if (!val) return;
      // Mock Setu Deeplink logic (needs scheme ID)
      const settings = storageService.getSettings();
      const schemeId = settings.setuSchemeId || 'mock-scheme';
      
      const link = `https://deeplink.setu.co/pay?schemeId=${schemeId}&amount=${val}&customerID=${order.customerContact}`;
      
      whatsappService.sendMessage(
          order.customerContact, 
          `Pay via Setu UPI DeepLink: ${link}`, 
          order.customerName
      );
      alert("Setu Link sent via WhatsApp!");
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
        <div className="flex items-center gap-4 mb-6 border-b pb-1 overflow-x-auto">
             <button 
                onClick={() => setActiveTab('RECORD')}
                className={`pb-3 text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all ${activeTab === 'RECORD' ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
             >
                Manual Entry
             </button>
             <button 
                onClick={() => setActiveTab('GATEWAY')}
                className={`pb-3 text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all ${activeTab === 'GATEWAY' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
             >
                Payment Gateway
             </button>
             <button 
                onClick={() => setActiveTab('REQUEST')}
                className={`pb-3 text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all ${activeTab === 'REQUEST' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
             >
                Remote Links
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
            </div>
        )}

        {activeTab === 'GATEWAY' && (
             <div className="animate-fadeIn space-y-4">
                 <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex items-center gap-3">
                     <CreditCard className="text-indigo-600" size={24} />
                     <div>
                         <p className="font-bold text-indigo-900 text-sm">Razorpay Secure</p>
                         <p className="text-xs text-indigo-700">Accept Cards, Netbanking, and UPI via Gateway.</p>
                     </div>
                 </div>
                 <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                    <input 
                        type="number" 
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-4 pl-9 font-black text-xl text-slate-800 outline-none focus:bg-white transition-all"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                    />
                 </div>
                 <button 
                    onClick={handleCreateRazorpayOrder}
                    disabled={loading || !amount}
                    className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black uppercase tracking-widest shadow-lg hover:bg-indigo-700 flex items-center justify-center gap-2"
                 >
                     {loading ? 'Processing...' : 'Generate Payment Link'}
                 </button>
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
                    </div>
                ) : (
                    <>
                        <div className="flex gap-2">
                             <button onClick={handleGenerateQR} className="flex-1 bg-white border border-slate-200 py-3 rounded-xl text-xs font-bold hover:bg-slate-50 flex flex-col items-center gap-1">
                                <QrCode size={16} /> Show QR
                             </button>
                             <button onClick={handleGenerateSetuLink} className="flex-1 bg-white border border-slate-200 py-3 rounded-xl text-xs font-bold hover:bg-slate-50 flex flex-col items-center gap-1">
                                <Zap size={16} className="text-amber-500" /> Setu Link
                             </button>
                        </div>
                        <div className="relative">
                                <input 
                                    type="number" 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-4 font-bold text-lg text-slate-800 outline-none focus:bg-white"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    placeholder="Amount"
                                />
                        </div>
                    </>
                )}
            </div>
        )}
      </Card>
    </div>
  );
};
