
import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, CreditCard, Box, Calendar, CheckCircle2, 
  Clock, ShieldCheck, Share2, Copy, Smartphone,
  FileText, Send, UserCog, Loader2, Images, ShieldAlert,
  MessageSquare, ReceiptIndianRupee, AlertCircle
} from 'lucide-react';
import { Order, ProductionStatus, OrderStatus, JewelryDetail, GlobalSettings, ProtectionStatus, WhatsAppLogEntry } from '../types';
import { generateOrderPDF } from '../services/pdfGenerator';
import { errorService } from '../services/errorService';
import { whatsappService } from '../services/whatsappService';

interface OrderDetailsProps {
  order: Order;
  settings: GlobalSettings;
  onBack: () => void;
  onUpdateStatus: (itemId: string, status: ProductionStatus) => void;
  onRecordPayment: (orderId: string, amount: number, method: string, date: string, note: string) => void;
  onSendPaymentRequest: (order: Order, amount: number) => void;
  onOrderUpdate: (updatedOrder: Order) => void; 
  onTriggerLapse: (order: Order) => void; 
  logs?: WhatsAppLogEntry[];
  onAddLog?: (log: WhatsAppLogEntry) => void;
}

const OrderDetails: React.FC<OrderDetailsProps> = ({ 
    order, settings, onBack, onUpdateStatus, 
    onRecordPayment, onOrderUpdate, logs = [], onAddLog 
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'ITEMS' | 'FINANCIAL' | 'LOGS'>('ITEMS');
  
  // Payment Form State
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]); 
  const [paymentMethod, setPaymentMethod] = useState('UPI'); 
  const [isPostingPayment, setIsPostingPayment] = useState(false);

  const [copied, setCopied] = useState(false);
  const [editingContact, setEditingContact] = useState(false);
  const [tempContact, setTempContact] = useState({ name: order.customerName, primary: order.customerContact, secondary: order.secondaryContact || '' });

  const totalPaid = order.payments.reduce((acc, p) => acc + p.amount, 0);
  const remaining = order.totalAmount - totalPaid;
  
  const isProtectionWarning = order.paymentPlan.goldRateProtection && 
                              order.paymentPlan.protectionStatus === ProtectionStatus.WARNING;

  const isProtectionLapsed = order.paymentPlan.goldRateProtection && 
                              order.paymentPlan.protectionStatus === ProtectionStatus.LAPSED;

  const statusFlow = [ProductionStatus.DESIGNING, ProductionStatus.PRODUCTION, ProductionStatus.QUALITY_CHECK, ProductionStatus.READY, ProductionStatus.DELIVERED];

  // Filter logs for this specific order context (by customer phone)
  const orderLogs = useMemo(() => {
      const cleanPhone = order.customerContact.replace(/\D/g, '').slice(-10);
      return logs.filter(l => l.phoneNumber.includes(cleanPhone)).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [logs, order.customerContact]);

  const handlePay = async () => {
    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) return;
    setIsPostingPayment(true);
    try {
        onRecordPayment(order.id, amt, paymentMethod, paymentDate, paymentNote);
        const receiptMsg = `Payment Received: ₹${amt.toLocaleString()} for Order #${order.id.slice(-6)}.\nDate: ${new Date(paymentDate).toLocaleDateString()}\nMode: ${paymentMethod}\nBalance: ₹${(remaining - amt).toLocaleString()}.\nThank you! - AuraGold`;
        
        const res = await whatsappService.sendMessage(order.customerContact, receiptMsg, order.customerName, 'Payment Receipt');
        if (res.success && res.logEntry && onAddLog) {
            onAddLog(res.logEntry);
        }

        setPaymentAmount(''); setPaymentNote(''); setPaymentDate(new Date().toISOString().split('T')[0]); setPaymentMethod('UPI');
    } catch (e: any) {
        errorService.logError('OrderDetails', `Payment processing failed: ${e.message}`, 'MEDIUM');
    } finally { setIsPostingPayment(false); }
  };

  const copyToClipboard = () => {
    const shareLink = `${window.location.origin}${window.location.pathname}?view=${order.shareToken || ''}`;
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareViaWhatsApp = (phone?: string) => {
    const target = phone || order.customerContact;
    const shareLink = `${window.location.origin}${window.location.pathname}?view=${order.shareToken || ''}`;
    const text = `Dear ${order.customerName}, track your AuraGold order status and payments here: ${shareLink}`;
    window.open(`https://wa.me/${target.replace(/\D/g,'')}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const saveContactInfo = () => {
      onOrderUpdate({ ...order, customerName: tempContact.name, customerContact: tempContact.primary, secondaryContact: tempContact.secondary });
      setEditingContact(false);
  };

  // Helper for Grace Period Calculation
  const getGracePeriodDays = () => {
      if (!order.paymentPlan.gracePeriodEndAt) return 0;
      const end = new Date(order.paymentPlan.gracePeriodEndAt).getTime();
      const now = Date.now();
      const diff = end - now;
      return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-20 animate-fadeIn">
      
      {/* --- HEADER --- */}
      <div className="flex justify-between items-center mb-2">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-bold text-sm"><ArrowLeft size={20} /> Back to History</button>
        <button onClick={() => generateOrderPDF(order)} className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-slate-800 transition-all"><FileText size={16} /> PDF Agreement</button>
      </div>

      <div className="bg-white rounded-3xl border shadow-sm overflow-hidden relative">
        <div className="bg-slate-900 p-6 text-white flex flex-col md:flex-row justify-between gap-6 relative group">
          <button onClick={() => setEditingContact(true)} className="absolute top-4 right-4 bg-white/10 p-2 rounded-full hover:bg-white/20 transition opacity-0 group-hover:opacity-100"><UserCog size={18} /></button>
          
          {editingContact ? (
              <div className="bg-slate-800 p-4 rounded-xl w-full max-w-md space-y-3 border border-slate-700">
                  <input className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm" value={tempContact.name} onChange={e => setTempContact({...tempContact, name: e.target.value})} placeholder="Name" />
                  <input className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm" value={tempContact.primary} onChange={e => setTempContact({...tempContact, primary: e.target.value})} placeholder="Primary Phone" />
                  <input className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm" value={tempContact.secondary} onChange={e => setTempContact({...tempContact, secondary: e.target.value})} placeholder="Secondary Phone" />
                  <div className="flex gap-2">
                      <button onClick={saveContactInfo} className="bg-emerald-600 px-3 py-1 rounded text-xs font-bold">Save</button>
                      <button onClick={() => setEditingContact(false)} className="bg-slate-600 px-3 py-1 rounded text-xs font-bold">Cancel</button>
                  </div>
              </div>
          ) : (
            <div>
                <div className="flex items-center gap-4 mb-2">
                <h2 className="text-2xl md:text-3xl font-black tracking-tighter">{order.customerName}</h2>
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${order.status === OrderStatus.OVERDUE ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>{order.status}</span>
                </div>
                <div className="flex flex-wrap gap-4 opacity-60 text-sm font-medium"><span className="flex items-center gap-1"><Smartphone size={14}/> {order.customerContact}</span>{order.secondaryContact && <span className="flex items-center gap-1"><Smartphone size={14}/> {order.secondaryContact}</span>}</div>
            </div>
          )}

          <div className="text-left md:text-right">
            <p className="text-[10px] uppercase font-black opacity-40 tracking-widest mb-1">Current Ledger Value</p>
            <p className="text-4xl font-black text-amber-400">₹{order.totalAmount.toLocaleString()}</p>
          </div>
        </div>

        {/* --- TABS --- */}
        <div className="flex border-b bg-slate-50 overflow-x-auto">
          <button onClick={() => setActiveSubTab('ITEMS')} className={`flex-1 min-w-[120px] py-4 text-xs font-black uppercase tracking-widest transition-all ${activeSubTab === 'ITEMS' ? 'text-amber-600 border-b-4 border-amber-600 bg-white' : 'text-slate-400'}`}><Box className="inline mr-2" size={16} /> Items</button>
          <button onClick={() => setActiveSubTab('FINANCIAL')} className={`flex-1 min-w-[120px] py-4 text-xs font-black uppercase tracking-widest transition-all ${activeSubTab === 'FINANCIAL' ? 'text-amber-600 border-b-4 border-amber-600 bg-white' : 'text-slate-400'}`}><CreditCard className="inline mr-2" size={16} /> Ledger & Plan</button>
          <button onClick={() => setActiveSubTab('LOGS')} className={`flex-1 min-w-[120px] py-4 text-xs font-black uppercase tracking-widest transition-all ${activeSubTab === 'LOGS' ? 'text-amber-600 border-b-4 border-amber-600 bg-white' : 'text-slate-400'}`}><MessageSquare className="inline mr-2" size={16} /> Logs</button>
        </div>

        {/* --- TAB CONTENT --- */}
        <div className="p-4 md:p-8 bg-slate-50/30 min-h-[400px]">
          
          {/* 1. ITEMS TAB */}
          {activeSubTab === 'ITEMS' && (
            <div className="space-y-6">
              {order.items.map((item, index) => (
                <div key={item.id} className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                   <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <span className="bg-slate-900 text-white text-[10px] px-2 py-1 rounded font-bold">#{index + 1}</span>
                            <h3 className="font-black text-slate-800 text-lg">{item.category}</h3>
                        </div>
                        <p className="text-amber-600 font-black uppercase text-[10px] tracking-widest">{item.metalColor} • {item.purity}</p>
                   </div>
                   
                   <div className="p-6 flex flex-col md:flex-row gap-6">
                        {/* Image */}
                        <div className="w-full md:w-48 h-48 bg-slate-100 rounded-xl overflow-hidden border relative shrink-0">
                            <img src={item.photoUrls[0]} className="w-full h-full object-cover" />
                            {item.photoUrls.length > 1 && <div className="absolute bottom-2 right-2 bg-black/60 px-2 py-1 rounded text-[10px] text-white font-bold"><Images size={12} className="inline mr-1"/>+{item.photoUrls.length-1}</div>}
                        </div>

                        {/* Specs Grid */}
                        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="p-3 border rounded-xl bg-slate-50/50">
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Gross / Net Wt</p>
                                <p className="font-bold text-slate-800">{item.grossWeight || item.netWeight}g / <span className="text-emerald-600">{item.netWeight}g</span></p>
                            </div>
                            <div className="p-3 border rounded-xl bg-slate-50/50">
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Wastage (VA)</p>
                                <p className="font-bold text-slate-800">{item.wastagePercentage}% <span className="text-xs text-slate-400">(₹{item.wastageValue.toLocaleString()})</span></p>
                            </div>
                            <div className="p-3 border rounded-xl bg-slate-50/50">
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Making & Stone</p>
                                <p className="font-bold text-slate-800">₹{item.totalLaborValue.toLocaleString()}</p>
                            </div>
                            <div className="p-3 border rounded-xl bg-amber-50/50 border-amber-100">
                                <p className="text-[10px] font-bold text-amber-700 uppercase mb-1">Total Item Value</p>
                                <p className="font-black text-amber-900 text-lg">₹{item.finalAmount.toLocaleString()}</p>
                            </div>
                            <div className="col-span-2 md:col-span-4 p-3 border border-dashed rounded-xl bg-slate-50 flex justify-between items-center">
                                <span className="text-xs font-medium text-slate-500">Gold Rate Applied: <strong>₹{(item.baseMetalValue / item.netWeight).toFixed(0)}/g</strong></span>
                                <span className="text-xs font-medium text-slate-500">Tax (GST): <strong>₹{item.taxAmount.toLocaleString()}</strong></span>
                            </div>
                        </div>
                   </div>

                   {/* Progress Tracker */}
                   <div className="bg-slate-50 p-4 border-t overflow-x-auto">
                        <div className="flex justify-between items-center min-w-[300px]">
                            {statusFlow.map((s, idx) => (
                                <div key={s} className="flex flex-col items-center gap-2 group cursor-pointer" onClick={() => onUpdateStatus(item.id, s)}>
                                    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all relative z-10 ${s === item.productionStatus ? 'bg-amber-500 border-amber-500 text-white scale-110 shadow-lg' : statusFlow.indexOf(item.productionStatus) > idx ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-300 text-slate-300'}`}>
                                        <CheckCircle2 size={14} />
                                    </div>
                                    <span className={`text-[10px] font-bold uppercase ${s === item.productionStatus ? 'text-amber-600' : 'text-slate-400'}`}>{s.replace('_', ' ')}</span>
                                </div>
                            ))}
                        </div>
                   </div>
                </div>
              ))}
            </div>
          )}

          {/* 2. LEDGER & PLAN TAB */}
          {activeSubTab === 'FINANCIAL' && (
            <div className="space-y-8">
                
                {/* Top Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-5 rounded-2xl border shadow-sm">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Due</p>
                        <p className="text-2xl font-black text-slate-800">₹{order.totalAmount.toLocaleString()}</p>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border shadow-sm">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Paid So Far</p>
                        <p className="text-2xl font-black text-emerald-600">₹{totalPaid.toLocaleString()}</p>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border shadow-sm">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pending Balance</p>
                        <p className="text-2xl font-black text-rose-500">₹{remaining.toLocaleString()}</p>
                    </div>
                </div>

                {/* Rate Protection Logic */}
                {order.paymentPlan.goldRateProtection && (
                    <div className={`p-6 rounded-3xl border-2 flex flex-col md:flex-row gap-6 items-center ${
                        isProtectionLapsed ? 'bg-rose-50 border-rose-200' : 
                        isProtectionWarning ? 'bg-orange-50 border-orange-200' :
                        'bg-emerald-50 border-emerald-200'
                    }`}>
                        <div className={`p-4 rounded-full ${
                            isProtectionLapsed ? 'bg-rose-100 text-rose-600' : 
                            isProtectionWarning ? 'bg-orange-100 text-orange-600 animate-pulse' :
                            'bg-emerald-100 text-emerald-600'
                        }`}>
                            {isProtectionLapsed ? <ShieldAlert size={24}/> : isProtectionWarning ? <AlertCircle size={24}/> : <ShieldCheck size={24}/>}
                        </div>
                        <div className="flex-1">
                            <h4 className={`font-black uppercase tracking-widest text-sm mb-1 ${
                                isProtectionLapsed ? 'text-rose-700' : 
                                isProtectionWarning ? 'text-orange-700' :
                                'text-emerald-700'
                            }`}>
                                {isProtectionLapsed ? 'Rate Protection Lapsed' : isProtectionWarning ? 'Protection At Risk (Warning)' : 'Rate Protection Active'}
                            </h4>
                            <p className="text-xs text-slate-600 leading-relaxed">
                                {isProtectionLapsed ? 
                                    'Market rate applies due to non-payment.' : 
                                isProtectionWarning ?
                                    `Payment Overdue! Grace period active. Pay within ${getGracePeriodDays()} days to save your booked rate of ₹${order.paymentPlan.protectionRateBooked}/g.` :
                                    `Booked at ₹${order.paymentPlan.protectionRateBooked}/g. Protected up to ₹${order.paymentPlan.protectionLimit}/g hike.`
                                }
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-black uppercase text-slate-400">Valid Until</p>
                            <p className="font-bold text-slate-800">
                                {isProtectionWarning && order.paymentPlan.gracePeriodEndAt 
                                    ? `Grace Ends: ${new Date(order.paymentPlan.gracePeriodEndAt).toLocaleDateString()}` 
                                    : new Date(order.paymentPlan.protectionDeadline).toLocaleDateString()
                                }
                            </p>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Payment Entry Form */}
                    <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-4">
                        <h4 className="font-black text-xs uppercase tracking-widest text-amber-600 flex items-center gap-2"><CreditCard size={14}/> Record Payment</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <div><label className="text-[10px] font-bold text-slate-400 uppercase">Date</label><input type="date" className="w-full border rounded-lg p-2 text-sm font-bold" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} /></div>
                            <div><label className="text-[10px] font-bold text-slate-400 uppercase">Mode</label><select className="w-full border rounded-lg p-2 text-sm font-bold" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}><option value="UPI">UPI</option><option value="CASH">CASH</option><option value="CARD">CARD</option><option value="BANK">BANK</option></select></div>
                        </div>
                        <div><label className="text-[10px] font-bold text-slate-400 uppercase">Amount</label><input type="number" className="w-full border rounded-lg p-2 text-lg font-black" placeholder="0" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} /></div>
                        <div><label className="text-[10px] font-bold text-slate-400 uppercase">Notes</label><input type="text" className="w-full border rounded-lg p-2 text-sm" placeholder="Optional" value={paymentNote} onChange={e => setPaymentNote(e.target.value)} /></div>
                        <button onClick={handlePay} disabled={isPostingPayment || !paymentAmount} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold text-xs uppercase hover:bg-slate-800 flex items-center justify-center gap-2">{isPostingPayment ? <Loader2 className="animate-spin" size={14}/> : 'Post to Ledger'}</button>
                    </div>

                    {/* Milestones */}
                    <div className="bg-white p-6 rounded-3xl border shadow-sm">
                        <h4 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2"><Calendar size={14}/> Planned Schedule</h4>
                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                            {order.paymentPlan.milestones.map((m, i) => (
                                <div key={m.id} className="flex justify-between items-center p-3 border rounded-xl bg-slate-50/50">
                                    <div>
                                        <p className="text-xs font-bold text-slate-700">{i===0?'Advance':`Milestone ${i}`}</p>
                                        <p className="text-[10px] text-slate-400 font-mono">{new Date(m.dueDate).toLocaleDateString()}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-black text-slate-800">₹{m.targetAmount.toLocaleString()}</p>
                                        <span className={`text-[9px] font-black uppercase ${m.status === 'PAID' ? 'text-emerald-600' : new Date(m.dueDate) < new Date() ? 'text-rose-600' : 'text-amber-600'}`}>{m.status}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Ledger Table */}
                <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
                    <div className="bg-slate-50 p-4 border-b"><h4 className="font-black text-xs uppercase tracking-widest text-slate-600 flex items-center gap-2"><ReceiptIndianRupee size={14}/> Transaction Ledger</h4></div>
                    {order.payments.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-sm">No payments recorded yet.</div>
                    ) : (
                        <table className="w-full text-left">
                            <thead className="bg-white text-[9px] font-black uppercase text-slate-400 border-b">
                                <tr>
                                    <th className="px-6 py-3">Date</th>
                                    <th className="px-6 py-3">Mode</th>
                                    <th className="px-6 py-3">Details</th>
                                    <th className="px-6 py-3 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 text-sm font-medium text-slate-700">
                                {order.payments.map(p => (
                                    <tr key={p.id} className="hover:bg-slate-50">
                                        <td className="px-6 py-4">{new Date(p.date).toLocaleDateString()}</td>
                                        <td className="px-6 py-4"><span className="bg-slate-100 px-2 py-1 rounded text-[10px] font-bold">{p.method}</span></td>
                                        <td className="px-6 py-4 text-slate-500 italic">{p.note || '-'}</td>
                                        <td className="px-6 py-4 text-right font-bold text-emerald-600">+₹{p.amount.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
          )}

          {/* 3. LOGS TAB */}
          {activeSubTab === 'LOGS' && (
              <div className="space-y-4">
                  {orderLogs.length === 0 ? (
                      <div className="p-10 text-center border-2 border-dashed rounded-3xl text-slate-400">
                          <MessageSquare className="mx-auto mb-2 opacity-20" size={32} />
                          <p className="font-bold text-sm">No messages sent regarding this order yet.</p>
                      </div>
                  ) : (
                      orderLogs.map(log => (
                          <div key={log.id} className="bg-white p-4 rounded-xl border flex gap-3 shadow-sm">
                              <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${log.direction === 'outbound' ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                              <div className="flex-1">
                                  <div className="flex justify-between items-start mb-1">
                                      <span className="text-[10px] font-black uppercase text-slate-400">{log.type} • {log.direction}</span>
                                      <span className="text-[10px] text-slate-400">{new Date(log.timestamp).toLocaleString()}</span>
                                  </div>
                                  <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{log.message}</p>
                                  <div className="mt-2 text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                                      Status: {log.status}
                                  </div>
                              </div>
                          </div>
                      ))
                  )}
              </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default OrderDetails;
