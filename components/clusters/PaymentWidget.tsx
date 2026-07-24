import React, { useState, useEffect } from 'react';
import { CreditCard, QrCode, X, Share2, Smartphone, Link, Zap, Loader2, AlertCircle, RefreshCw, Calendar, Clock, CheckCircle2, History, Coins, Landmark } from 'lucide-react';
import { Card, Button } from '../shared/BaseUI';
import { Order, OrderStatus, WhatsAppLogEntry, Milestone } from '../../types';
import { whatsappService } from '../../services/whatsappService';
import { storageService } from '../../services/storageService';
import { errorService } from '../../services/errorService';
import { goldRateService } from '../../services/goldRateService';

interface PaymentWidgetProps {
  order: Order;
  onPaymentRecorded: (order: Order) => void; 
  onAddLog?: (log: WhatsAppLogEntry) => void;
  variant?: 'FULL' | 'COMPACT';
}

export const PaymentWidget: React.FC<PaymentWidgetProps> = ({ order, onPaymentRecorded, onAddLog, variant = 'FULL' }) => {
  const [activeTab, setActiveTab] = useState<'RECORD' | 'REQUEST' | 'GATEWAY'>('RECORD');
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('UPI');
  const [loading, setLoading] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [setuData, setSetuData] = useState<{ shortURL: string, upiID: string, upiLink: string, platformBillID: string, rawResponse?: any } | null>(null);
  const [showRawResponse, setShowRawResponse] = useState(false);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);

  // Old Gold inputs state
  const [goldWeight, setGoldWeight] = useState('');
  const [goldPurity, setGoldPurity] = useState('22K');
  const [customPurityPercent, setCustomPurityPercent] = useState('100');
  const [goldRate, setGoldRate] = useState('');
  const [liveRates, setLiveRates] = useState<{ k24: number, k22: number, k18: number, k14: number } | null>(null);

  // Cheque inputs state
  const [chequeNumber, setChequeNumber] = useState('');
  const [chequeBank, setChequeBank] = useState('');
  const [chequeDate, setChequeDate] = useState(new Date().toISOString().split('T')[0]);

  const totalPaid = order.payments.reduce((acc, p) => acc + p.amount, 0);
  const remaining = order.totalAmount - totalPaid;
  
  // Find the relevant milestone for current collection context
  const nextMilestone = order.paymentPlan.milestones.find(m => m.status !== 'PAID');

  useEffect(() => {
      if (!amount && nextMilestone) {
          setAmount(nextMilestone.targetAmount.toString());
      } else if (!amount) {
          setAmount(remaining.toString());
      }
  }, [nextMilestone, remaining, amount]);

  useEffect(() => {
      setErrorMsg(null);
  }, [activeTab]);

  useEffect(() => {
    const loadRates = async () => {
      try {
        const res = await goldRateService.fetchLiveRate();
        if (res.success) {
          const rates = {
            k24: res.rate24K || 7500,
            k22: res.rate22K || 6875,
            k18: res.rate18K || 5625,
            k14: Math.round((res.rate24K || 7500) * 0.585)
          };
          setLiveRates(rates);
          setGoldRate(rates.k22.toString());
        } else {
          const rates = { k24: 7500, k22: 6875, k18: 5625, k14: 4375 };
          setLiveRates(rates);
          setGoldRate(rates.k22.toString());
        }
      } catch (err) {
        const rates = { k24: 7500, k22: 6875, k18: 5625, k14: 4375 };
        setLiveRates(rates);
        setGoldRate(rates.k22.toString());
      }
    };
    loadRates();
  }, []);

  const calculatedGoldValue = React.useMemo(() => {
    const weight = parseFloat(goldWeight);
    const rate = parseFloat(goldRate);
    if (!weight || !rate || weight <= 0 || rate <= 0) return 0;
    return Math.round(weight * rate);
  }, [goldWeight, goldRate]);

  useEffect(() => {
    if (mode === 'OLD_GOLD') {
      setAmount(calculatedGoldValue > 0 ? calculatedGoldValue.toString() : '');
    }
  }, [mode, calculatedGoldValue]);

  const updateOrderWithPayment = (val: number, method: string, notes: string, dateStr?: string) => {
      const newPayment = {
        id: `PAY-${Date.now()}`,
        date: dateStr ? new Date(dateStr).toISOString() : new Date().toISOString(),
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
      errorService.logActivity('PAYMENT_RECORDED', `₹${val} via ${method} for ${order.customerName}`);
  };

  const handleRecordPayment = async () => {
    let val = parseFloat(amount);
    
    if (mode === 'OLD_GOLD') {
      val = calculatedGoldValue;
    }

    if (!val || val <= 0) {
      setErrorMsg("Validation Error: Payment amount must be greater than zero.");
      return;
    }

    if (mode === 'CHEQUE') {
      if (!chequeNumber.trim() || !chequeBank.trim()) {
        setErrorMsg("Validation Error: Please enter Cheque Number and Bank Name.");
        return;
      }
    } else if (mode === 'OLD_GOLD') {
      const weight = parseFloat(goldWeight);
      const rate = parseFloat(goldRate);
      if (!weight || weight <= 0) {
        setErrorMsg("Validation Error: Please enter a valid Gold Weight.");
        return;
      }
      if (!rate || rate <= 0) {
        setErrorMsg("Validation Error: Please enter a valid Gold Rate.");
        return;
      }
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      let note = 'Manual Entry';
      if (mode === 'OLD_GOLD') {
        note = `Old Gold: ${goldWeight}g (${goldPurity === 'CUSTOM' ? `${customPurityPercent}%` : goldPurity} @ ₹${parseFloat(goldRate).toLocaleString('en-IN')}/g)`;
      } else if (mode === 'CHEQUE') {
        note = `Cheque No: ${chequeNumber}, Bank: ${chequeBank}, Date: ${new Date(chequeDate).toLocaleDateString('en-IN')}`;
      }

      updateOrderWithPayment(val, mode, note, paymentDate);

      // SCENARIO 4: Store Payment Receipt
      const friendlyMode = mode === 'OLD_GOLD' ? 'Old Gold' : (mode === 'CHEQUE' ? 'Cheque' : mode);
      const res = await whatsappService.sendTemplateMessage(
          order.customerContact,
          'auragold_payment_receipt_store',
          'en_US',
          [
              order.customerName,
              val.toLocaleString(),
              friendlyMode,
              order.id,
              (remaining - val).toLocaleString()
          ],
          order.customerName
      );

      if (res.success && res.logEntry && onAddLog) {
          onAddLog(res.logEntry);
      }

      setAmount('');
      setGoldWeight('');
      setChequeNumber('');
      setChequeBank('');
      setQrCodeUrl(null);
    } catch (e: any) {
      setErrorMsg("Failed to record payment locally.");
      errorService.logError('PaymentWidget', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateQR = async () => {
      const val = parseFloat(amount);
      if (!val || val <= 0) return;
      
      const transactionNote = encodeURIComponent(`Order ${order.id}`);
      const upiString = `upi://pay?pa=st.sanghavijeweller@pineaxis&pn=Sanghavi%20Jewellers&tr=${order.id}&am=${val}&cu=INR&tn=${transactionNote}`;
      setQrCodeUrl(`https://quickchart.io/qr?text=${encodeURIComponent(upiString)}&margin=2&size=300`);
      setActiveTab('REQUEST');
      errorService.logActivity('USER_ACTION', `Generated Static QR for ₹${val}`);
  };

  const handleCreateRazorpayOrder = async () => {
      const val = parseFloat(amount);
      if (!val || val <= 0) return;
      setLoading(true);
      setErrorMsg(null);
      errorService.logActivity('API_CALL', `Creating Razorpay Order for ₹${val}`);

      try {
          const response = await fetch('/api/razorpay/create-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ amount: val, currency: "INR", receipt: order.id })
          });
          
          const orderData = await response.json();
          if (orderData.error) throw new Error(orderData.error);
          
          const settings = storageService.getSettings();

          const options = {
              key: settings.razorpayKeyId,
              amount: orderData.amount,
              currency: orderData.currency,
              name: "AuraGold Jewellers",
              description: `Payment for Order #${order.id}`,
              order_id: orderData.id,
              handler: function (response: any) {
                  updateOrderWithPayment(val, 'RAZORPAY', `Online ID: ${response.razorpay_payment_id}`);
                  // SCENARIO 6: Remote Success
                  whatsappService.sendTemplateMessage(
                      order.customerContact,
                      'auragold_payment_success_remote',
                      'en_US',
                      [order.customerName, val.toLocaleString(), 'Razorpay', order.id, (remaining - val).toLocaleString()],
                      order.customerName
                  );
                  alert("Payment Successful!");
              },
              prefill: {
                  name: order.customerName,
                  contact: order.customerContact,
              },
              theme: { color: "#B8860B" }
          };

          const rzp1 = new (window as any).Razorpay(options);
          rzp1.open();
      } catch (e: any) {
          setErrorMsg(`Gateway Error: ${e.message}`);
          errorService.logError('Razorpay', e.message);
      } finally {
          setLoading(false);
      }
  };

  const handleGenerateSetuLink = async () => {
      setLoading(true);
      setErrorMsg(null);

      try {
          const val = parseFloat(amount);
          if (!val || val <= 0) throw new Error("Invalid Amount: Must be greater than 0");
          if (!order.customerName) throw new Error("Validation Error: Customer Name is missing");
          if (!order.customerContact) throw new Error("Validation Error: Customer Mobile Number is missing");

          errorService.logActivity('API_CALL', `Requesting Setu Link for Order ${order.id} (₹${val})`);

          const response = await fetch('/api/setu/create-link', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  amount: val,
                  customerID: order.customerContact, 
                  name: order.customerName,
                  orderId: order.id
              })
          });

          const responseBody = await response.json();

          if (!response.ok || !responseBody.success) {
              const errMsg = responseBody.error || "Gateway Error";
              errorService.logError(
                  'Setu_Gateway', 
                  `HTTP ${response.status}: ${errMsg}`, 
                  'HIGH', 
                  JSON.stringify(responseBody)
              );
              throw new Error(errMsg);
          }

          const payload = responseBody.data?.data || responseBody.data;
          const shortLink = payload?.paymentLink?.shortURL || payload?.shortURL || payload?.shortLink;
          const upiID = payload?.paymentLink?.upiID || payload?.upiID;
          let upiIntentLink = payload?.paymentLink?.upiLink || payload?.paymentLink?.upiIntentLink || payload?.upiLink || payload?.upiIntentLink;
          const platformBillID = payload?.platformBillID;

          if (!shortLink) {
              errorService.logError(
                  'Setu_Structure_Mismatch', 
                  'Link generated but shortLink property missing in JSON payload', 
                  'CRITICAL', 
                  JSON.stringify(responseBody)
              );
              throw new Error("Payment link was not returned by the gateway. This has been logged for engineering review.");
          }

          if (!upiIntentLink && upiID) {
              // Construct the intent link manually ONLY if Setu didn't return it
              const payeeName = encodeURIComponent("Sanghavi Jewellers");
              const transactionNote = encodeURIComponent(`Order ${order.id}`);
              upiIntentLink = `upi://pay?pa=${upiID}&pn=${payeeName}&tr=${order.id}&am=${val}&cu=INR&tn=${transactionNote}`;
          } else if (!upiIntentLink) {
              // Fallback to shortLink if we can't construct the intent
              upiIntentLink = shortLink;
          }

          setSetuData({ 
              shortURL: shortLink, 
              upiID, 
              upiLink: upiIntentLink, 
              platformBillID,
              rawResponse: responseBody.data 
          });
          setQrCodeUrl(`https://quickchart.io/qr?text=${encodeURIComponent(shortLink)}&margin=2&size=300`);

          // Use base64 encoded shortLink for WhatsApp button
          let buttonVariable = '';
          if (shortLink) {
              try {
                  // Safe base64 encoding for potentially non-latin1 strings
                  buttonVariable = btoa(unescape(encodeURIComponent(shortLink))).replace(/\+/g, '-').replace(/\//g, '_');
              } catch (e) {
                  buttonVariable = btoa(shortLink).replace(/\+/g, '-').replace(/\//g, '_');
              }
          }

          if (!buttonVariable) {
              throw new Error("Could not extract Link ID or Intent from Gateway Response.");
          }

          // SCENARIO 8: Setu UPI Button (Manual)
          // We pass the base64 intent or link suffix as the button variable to construct the Setu URL
          const result = await whatsappService.sendTemplateMessage(
              order.customerContact, 
              'auragold_setu_payment', 
              'en_US', 
              [order.customerName, val.toLocaleString()], 
              order.customerName,
              buttonVariable,
              undefined,
              undefined,
              order.id
          );

          if (result.success) {
              alert("Modern Payment Button delivered to customer!");
              if (result.logEntry && onAddLog) onAddLog(result.logEntry);
              setAmount('');
          } else {
              console.warn("Template failed, falling back to text link.");
              const fallbackRes = await whatsappService.sendMessage(
                  order.customerContact,
                  `Dear ${order.customerName}, please pay ₹${val.toLocaleString()} using this link: ${shortLink}`,
                  order.customerName,
                  undefined,
                  order.id
              );
              if (fallbackRes.success) {
                  alert("Template failed, but sent Text Link as fallback.");
                  if (fallbackRes.logEntry && onAddLog) onAddLog(fallbackRes.logEntry);
              } else {
                  throw new Error(result.error || "WhatsApp delivery failed");
              }
          }

      } catch (e: any) {
          console.error("[Setu Execution Failed]", e);
          setErrorMsg(e.message);
      } finally {
          setLoading(false);
      }
  };

  if (variant === 'COMPACT') {
    const targetMilestone = nextMilestone;
    const dueDate = targetMilestone ? new Date(targetMilestone.dueDate) : null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let lateDays = 0;
    if (dueDate && dueDate < today) {
        const diffTime = Math.abs(today.getTime() - dueDate.getTime());
        lateDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    return (
      <Card className="p-4 flex justify-between items-center bg-slate-50 border-slate-200">
        <div className="flex gap-4">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
                <Calendar size={12} className="text-slate-400" />
                <p className="text-[10px] font-black uppercase text-slate-500 tracking-tight">
                    {dueDate ? dueDate.toLocaleDateString('en-IN') : 'Settled'}
                </p>
                {lateDays > 0 && (
                    <span className="flex items-center gap-0.5 bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded text-[9px] font-black uppercase animate-pulse">
                        <Clock size={8} /> {lateDays} Days Late
                    </span>
                )}
            </div>
            <p className="font-black text-slate-900 text-base">
              {targetMilestone ? `₹${targetMilestone.targetAmount.toLocaleString()}` : 'No Dues'}
            </p>
          </div>
        </div>
        <Button size="sm" variant={lateDays > 0 ? 'danger' : 'primary'} onClick={() => setActiveTab('REQUEST')} disabled={remaining <= 0}>
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

        {errorMsg && (
            <div className="mb-6 bg-rose-50 border border-rose-200 rounded-2xl p-5 flex items-start gap-4 animate-fadeIn">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                    <AlertCircle className="text-rose-600" size={24} />
                </div>
                <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-black text-rose-800 uppercase tracking-tight">Initiation Failed</p>
                    <pre className="whitespace-pre-wrap break-all bg-white/50 p-2 rounded border border-rose-200 font-mono text-[9px] mt-2 max-h-40 overflow-y-auto text-rose-600">
                        {errorMsg}
                    </pre>
                    <div className="mt-4 flex gap-3">
                        <button 
                            onClick={() => activeTab === 'REQUEST' ? handleGenerateSetuLink() : handleCreateRazorpayOrder()} 
                            className="bg-rose-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-rose-700 shadow-sm"
                        >
                            <RefreshCw size={12} /> Retry Action
                        </button>
                        <button onClick={() => setErrorMsg(null)} className="text-[10px] font-bold text-rose-400 hover:text-rose-600">Dismiss</button>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'RECORD' && (
            <div className="animate-fadeIn">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-6">
                {['UPI', 'CASH', 'CARD', 'OLD_GOLD', 'CHEQUE'].map(m => (
                    <button 
                    key={m} 
                    onClick={() => setMode(m)}
                    className={`py-3 rounded-xl text-[10px] font-black uppercase transition-all ${mode === m ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >
                    {m.replace('_', ' ')}
                    </button>
                ))}
                </div>

                {/* Conditional Fields based on Mode */}
                {mode === 'OLD_GOLD' && (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fadeIn">
                        <div>
                            <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block ml-1">Gold Weight (Grams)</label>
                            <input 
                                type="number" 
                                step="0.001"
                                className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 font-bold text-sm text-slate-800 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                                value={goldWeight}
                                onChange={e => setGoldWeight(e.target.value)}
                                placeholder="e.g. 10.5"
                            />
                        </div>
                        <div>
                            <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block ml-1">Gold Purity</label>
                            <select 
                                className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 font-bold text-sm text-slate-800 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 h-[46px]"
                                value={goldPurity}
                                onChange={e => {
                                    const val = e.target.value;
                                    setGoldPurity(val);
                                    if (liveRates) {
                                        if (val === '24K') setGoldRate(liveRates.k24.toString());
                                        else if (val === '22K') setGoldRate(liveRates.k22.toString());
                                        else if (val === '18K') setGoldRate(liveRates.k18.toString());
                                        else if (val === '14K') setGoldRate(liveRates.k14.toString());
                                        else if (val === 'CUSTOM') {
                                            const pct = parseFloat(customPurityPercent) || 100;
                                            setGoldRate(Math.round(liveRates.k24 * (pct / 100)).toString());
                                        }
                                    } else {
                                        if (val === '24K') setGoldRate('7500');
                                        else if (val === '22K') setGoldRate('6875');
                                        else if (val === '18K') setGoldRate('5625');
                                        else if (val === '14K') setGoldRate('4375');
                                    }
                                }}
                            >
                                <option value="24K">24K (99.9%)</option>
                                <option value="22K">22K (91.6%)</option>
                                <option value="18K">18K (75.0%)</option>
                                <option value="14K">14K (58.5%)</option>
                                <option value="CUSTOM">Custom Purity %</option>
                            </select>
                        </div>
                        {goldPurity === 'CUSTOM' ? (
                            <div>
                                <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block ml-1">Purity (%)</label>
                                <input 
                                    type="number" 
                                    min="1"
                                    max="100"
                                    className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 font-bold text-sm text-slate-800 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                                    value={customPurityPercent}
                                    onChange={e => {
                                        const val = e.target.value;
                                        setCustomPurityPercent(val);
                                        const pct = parseFloat(val) || 0;
                                        if (liveRates) {
                                            setGoldRate(Math.round(liveRates.k24 * (pct / 100)).toString());
                                        }
                                    }}
                                    placeholder="e.g. 90"
                                />
                            </div>
                        ) : (
                            <div>
                                <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block ml-1">Gold Rate (₹ / Gram)</label>
                                <input 
                                    type="number" 
                                    className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 font-bold text-sm text-slate-800 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                                    value={goldRate}
                                    onChange={e => setGoldRate(e.target.value)}
                                    placeholder="Gold Rate"
                                />
                            </div>
                        )}
                        {goldPurity === 'CUSTOM' && (
                            <div className="sm:col-span-3">
                                <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block ml-1">Gold Rate (₹ / Gram)</label>
                                <input 
                                    type="number" 
                                    className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 font-bold text-sm text-slate-800 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                                    value={goldRate}
                                    onChange={e => setGoldRate(e.target.value)}
                                    placeholder="Gold Rate"
                                />
                            </div>
                        )}
                    </div>
                )}

                {mode === 'CHEQUE' && (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fadeIn">
                        <div>
                            <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block ml-1">Cheque Number</label>
                            <input 
                                type="text" 
                                className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 font-bold text-sm text-slate-800 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                                value={chequeNumber}
                                onChange={e => setChequeNumber(e.target.value)}
                                placeholder="6 digit number"
                            />
                        </div>
                        <div>
                            <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block ml-1">Bank Name</label>
                            <input 
                                type="text" 
                                className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 font-bold text-sm text-slate-800 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                                value={chequeBank}
                                onChange={e => setChequeBank(e.target.value)}
                                placeholder="e.g. HDFC Bank"
                            />
                        </div>
                        <div>
                            <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block ml-1">Cheque Date</label>
                            <input 
                                type="date" 
                                className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 font-bold text-sm text-slate-800 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 h-[46px]"
                                value={chequeDate}
                                onChange={e => setChequeDate(e.target.value)}
                            />
                        </div>
                    </div>
                )}

                <div className="flex flex-col gap-4">
                    <div className="flex gap-3 items-end">
                        <div className="flex-1">
                            <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block ml-1">Payment Amount</label>
                            {mode === 'OLD_GOLD' ? (
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                                    <input 
                                        type="text" 
                                        className="w-full bg-slate-100 border border-slate-200 rounded-xl py-4 pl-9 font-black text-xl text-slate-800 outline-none cursor-not-allowed"
                                        value={calculatedGoldValue > 0 ? calculatedGoldValue.toLocaleString('en-IN') : '0'}
                                        readOnly
                                    />
                                </div>
                            ) : (
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                                    <input 
                                        type="number" 
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-4 pl-9 font-black text-xl text-slate-800 outline-none focus:bg-white transition-all"
                                        value={amount}
                                        onChange={e => setAmount(e.target.value)}
                                    />
                                </div>
                            )}
                        </div>
                        <div className="flex-1">
                            <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block ml-1">Payment Date</label>
                            <input 
                                type="date" 
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-4 px-4 font-black text-sm text-slate-800 outline-none focus:bg-white transition-all h-[60px]"
                                value={paymentDate}
                                onChange={e => setPaymentDate(e.target.value)}
                            />
                        </div>
                    </div>
                    <Button onClick={handleRecordPayment} loading={loading} disabled={mode === 'OLD_GOLD' ? calculatedGoldValue <= 0 : !amount} size="lg" className="w-full h-[60px]">
                        Save Payment
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
                     {loading ? <Loader2 className="animate-spin" size={16} /> : 'Generate Payment Link'}
                 </button>
             </div>
        )}

        {activeTab === 'REQUEST' && (
            <div className="animate-fadeIn space-y-4">
                {setuData ? (
                    <div className="bg-slate-50 p-6 rounded-2xl flex flex-col items-center border border-slate-200 animate-slideDown">
                        <div className="flex justify-between w-full mb-4 items-center">
                            <h4 className="text-xs font-black uppercase text-slate-500">Setu UPI Link Generated</h4>
                            <button onClick={() => { setQrCodeUrl(null); setSetuData(null); }} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={18} /></button>
                        </div>
                        
                        {qrCodeUrl && (
                            <div className="relative group">
                                <img src={qrCodeUrl} className="w-48 h-48 bg-white p-2 rounded-xl shadow-inner mb-4 border border-slate-100" alt="UPI QR Code" />
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 rounded-xl">
                                    <p className="text-[10px] font-black uppercase text-slate-900">Scan to Pay ₹{amount}</p>
                                </div>
                            </div>
                        )}
                        
                        <div className="w-full space-y-3">
                            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Short URL</p>
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-xs font-bold text-slate-800 truncate flex-1">{setuData.shortURL}</p>
                                    <button 
                                        onClick={() => { navigator.clipboard.writeText(setuData.shortURL); alert("Copied!"); }}
                                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
                                    >
                                        <Link size={14} />
                                    </button>
                                </div>
                            </div>

                            {setuData.upiID && (
                                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">UPI ID</p>
                                    <p className="text-xs font-bold text-slate-800">{setuData.upiID}</p>
                                </div>
                            )}

                            <div className="pt-2">
                                <button 
                                    onClick={() => setShowRawResponse(!showRawResponse)}
                                    className="text-[10px] font-black uppercase text-blue-500 flex items-center gap-1 hover:text-blue-600"
                                >
                                    {showRawResponse ? 'Hide' : 'Show'} Full API Response
                                </button>
                                
                                {showRawResponse && (
                                    <div className="mt-3 bg-slate-900 rounded-xl p-4 overflow-hidden animate-fadeIn">
                                        <p className="text-[9px] font-black text-slate-500 uppercase mb-2">JSON Response from Setu</p>
                                        <pre className="text-[9px] font-mono text-emerald-400 overflow-x-auto whitespace-pre-wrap max-h-60">
                                            {JSON.stringify(setuData.rawResponse, null, 2)}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex gap-2">
                             <button onClick={handleGenerateQR} className="flex-1 bg-white border border-slate-200 py-3 rounded-xl text-xs font-bold hover:bg-slate-50 flex flex-col items-center gap-1">
                                <QrCode size={16} /> Show QR
                             </button>
                             <button 
                                onClick={handleGenerateSetuLink} 
                                disabled={loading}
                                className="flex-1 bg-white border border-slate-200 py-3 rounded-xl text-xs font-bold hover:bg-slate-50 flex flex-col items-center gap-1 disabled:opacity-50"
                             >
                                {loading ? <Loader2 size={16} className="animate-spin text-amber-500" /> : <Zap size={16} className="text-amber-500" />} 
                                Setu UPI Link
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

      <div className="space-y-3">
        <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest ml-1 flex items-center gap-2">
            <History size={12} /> Transaction History
        </h4>
        {order.payments.length === 0 ? (
            <div className="p-6 rounded-2xl border border-dashed border-slate-300 text-center text-xs text-slate-400 bg-slate-50/50">
                No payments recorded yet.
            </div>
        ) : (
            <div className="space-y-2">
                {[...order.payments].reverse().map(p => (
                    <div key={p.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex justify-between items-start shadow-sm">
                        <div className="flex-1 pr-4">
                            <div className="flex items-center gap-2">
                                <p className="text-sm font-bold text-slate-800">₹{p.amount.toLocaleString()}</p>
                                <span className="text-[8px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-full">{p.status || 'PAID'}</span>
                            </div>
                            <p className="text-[10px] text-slate-500 font-medium flex items-center gap-2 mt-1 mb-1.5">
                                <span>{new Date(p.date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                <span className="uppercase font-bold tracking-wider">{p.method?.replace('_', ' ')}</span>
                            </p>
                            {(p.reference || p.transactionId || p.payer) && (
                                <div className="flex flex-wrap gap-2 mb-1">
                                    {(p.reference || p.transactionId) && (
                                        <p className="text-[10px] font-mono text-slate-500 bg-slate-50 px-2 py-1 rounded inline-block border border-slate-100">
                                            UPI/TXN: <span className="text-slate-700">{p.reference || p.transactionId}</span>
                                        </p>
                                    )}
                                    {p.payer && (
                                        <p className="text-[10px] font-mono text-slate-500 bg-slate-50 px-2 py-1 rounded inline-block border border-slate-100">
                                            VPA: <span className="text-slate-700">{p.payer}</span>
                                        </p>
                                    )}
                                </div>
                            )}
                            {p.note && <p className="text-[10px] text-slate-400 mt-1 italic leading-relaxed">{p.note}</p>}
                        </div>
                        <div className="bg-emerald-50 text-emerald-600 p-2 rounded-xl shrink-0">
                            <CheckCircle2 size={16} />
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
};
