
import React, { useState } from 'react';
import { CreditCard, Calendar, CheckCircle2, ArrowRight, Loader2, ReceiptIndianRupee, Share2, Smartphone, Link as LinkIcon, Copy } from 'lucide-react';
import { Card, Badge, Button, SectionHeader } from '../shared/BaseUI';
import { Order, OrderStatus } from '../../types';
import { errorService } from '../../services/errorService';
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

  const totalPaid = order.payments.reduce((acc, p) => acc + p.amount, 0);
  const remaining = order.totalAmount - totalPaid;
  const nextMilestone = order.paymentPlan.milestones.find(m => m.status !== 'PAID');

  // Set default amount to next milestone or remaining balance
  React.useEffect(() => {
      if (!amount && nextMilestone) {
          setAmount(nextMilestone.targetAmount.toString());
      } else if (!amount) {
          setAmount(remaining.toString());
      }
  }, [nextMilestone, remaining]);

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

      // Fix: Expected 3 arguments, but got 4. Removed the last string argument.
      await whatsappService.sendMessage(
          order.customerContact, 
          `Payment Received: ₹${val.toLocaleString()}. Balance: ₹${(remaining - val).toLocaleString()}. Thank you!`, 
          order.customerName
      );

      onPaymentRecorded(updatedOrder);
      setAmount('');
    } catch (e: any) {
      alert("Error recording payment");
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async () => {
      const val = parseFloat(amount);
      if (!val || val <= 0) return;
      setLoading(true);

      try {
        // 1. Generate Deep Links
        // UPI Deep Link (Universal)
        const upiLink = `upi://pay?pa=your-merchant-vpa@upi&pn=AuraGold&tr=${order.id}&am=${val}&cu=INR`;
        
        // Razorpay / Payment Gateway Link (Mock)
        const gatewayLink = `https://rzp.io/i/aura${order.id}`;

        const message = `Dear ${order.customerName}, payment of ₹${val.toLocaleString()} is due for your gold plan.\n\n` +
                        `Pay securely via UPI: ${upiLink}\n\n` +
                        `Or use Card/Netbanking: ${gatewayLink}\n\n` +
                        `Order ID: ${order.id}`;

        // Fix: Expected 3 arguments, but got 4. Removed 'Payment Request'.
        await whatsappService.sendMessage(order.customerContact, message, order.customerName);
        alert("Payment Link Sent via WhatsApp!");
      } catch (e) {
          alert("Failed to send request.");
      } finally {
          setLoading(false);
      }
  };

  if (variant === 'COMPACT') {
    return (
      <Card className="p-4 flex justify-between items-center bg-slate-50 border-slate-200">
        <div>
          <p className="text-[10px] font-black uppercase text-slate-400">Next Due</p>
          <p className="font-black text-slate-800">
            {nextMilestone ? `₹${nextMilestone.targetAmount.toLocaleString()}` : 'Settled'}
          </p>
          <p className="text-[9px] text-slate-500 font-bold">
            {nextMilestone ? `By ${new Date(nextMilestone.dueDate).toLocaleDateString()}` : 'All Paid'}
          </p>
        </div>
        <Button size="sm" onClick={() => setActiveTab('REQUEST')} disabled={remaining <= 0}>
          Pay
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-5 bg-white">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Paid</p>
          <p className="text-2xl font-black text-emerald-600">₹{totalPaid.toLocaleString()}</p>
        </Card>
        <Card className="p-5 bg-white">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Balance</p>
          <p className="text-2xl font-black text-rose-500">₹{remaining.toLocaleString()}</p>
        </Card>
      </div>

      {/* 2. Transaction Controls */}
      <Card className="p-6 border-l-4 border-l-slate-900">
        <div className="flex items-center gap-4 mb-6 border-b pb-1">
             <button 
                onClick={() => setActiveTab('RECORD')}
                className={`pb-3 text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'RECORD' ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
             >
                Manual Entry
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
                <div className="flex gap-3 mb-4">
                {['UPI', 'CASH', 'CARD'].map(m => (
                    <button 
                    key={m} 
                    onClick={() => setMode(m)}
                    className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${mode === m ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >
                    {m}
                    </button>
                ))}
                </div>

                <div className="flex gap-3">
                    <div className="relative flex-1">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                        <input 
                        type="number" 
                        className="w-full bg-slate-50 border-none rounded-xl py-3 pl-8 font-black text-slate-800 outline-none focus:ring-2 focus:ring-slate-200"
                        placeholder="Amount"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        />
                    </div>
                    <Button onClick={handleRecordPayment} loading={loading} disabled={!amount}>
                        Record
                    </Button>
                </div>
            </div>
        )}

        {activeTab === 'REQUEST' && (
            <div className="animate-fadeIn space-y-4">
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex gap-3">
                    <Smartphone className="text-blue-500 shrink-0" size={20} />
                    <div className="text-xs text-blue-800">
                        <p className="font-bold mb-1">Send Smart Payment Link</p>
                        <p className="opacity-80">This will send a WhatsApp message with a direct UPI link and a Payment Gateway link to the customer.</p>
                    </div>
                </div>
                 <div className="flex gap-3">
                    <div className="relative flex-1">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                        <input 
                        type="number" 
                        className="w-full bg-slate-50 border-none rounded-xl py-3 pl-8 font-black text-slate-800 outline-none focus:ring-2 focus:ring-slate-200"
                        placeholder="Amount to Request"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        />
                    </div>
                    <button 
                        onClick={handleSendRequest}
                        disabled={loading || !amount}
                        className="bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg flex items-center gap-2"
                    >
                        {loading ? <Loader2 className="animate-spin" size={16} /> : <Share2 size={16} />}
                        Send Link
                    </button>
                </div>
            </div>
        )}
      </Card>

      {/* 3. Milestone List */}
      <div>
        <SectionHeader title="Payment Schedule" />
        <div className="space-y-3">
          {order.paymentPlan.milestones.map((m, i) => (
            <Card key={i} className={`p-4 flex justify-between items-center ${m.status === 'PAID' ? 'opacity-60 bg-slate-50' : 'border-l-4 border-l-amber-500'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${m.status === 'PAID' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                  {m.status === 'PAID' ? <CheckCircle2 size={16}/> : <Calendar size={16}/>}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-700">{i === 0 ? 'Downpayment' : `Installment ${i}`}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">{new Date(m.dueDate).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-slate-800">₹{m.targetAmount.toLocaleString()}</p>
                <Badge 
                  label={m.status} 
                  variant={m.status === 'PAID' ? 'success' : new Date(m.dueDate) < new Date() ? 'danger' : 'warning'} 
                />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
