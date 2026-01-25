
import React, { useState, useMemo } from 'react';
import { 
  Search, Filter, ReceiptIndianRupee, Calendar, CheckCircle2, 
  Clock, AlertCircle, ChevronRight, Download,
  ArrowDownLeft, BrainCircuit, Loader2, Share2, X
} from 'lucide-react';
import { Order, WhatsAppLogEntry, GlobalSettings } from '../types';
import { geminiService } from '../services/geminiService';
import { whatsappService } from '../services/whatsappService';

interface PaymentCollectionsProps {
  orders: Order[];
  onViewOrder: (id: string) => void;
  onSendWhatsApp: (notifId: string) => void;
  onAddLog?: (log: WhatsAppLogEntry) => void;
  settings: GlobalSettings;
}

type CollectionTab = 'OVERDUE' | 'UPCOMING' | 'RECEIVED' | 'PLANNED';

const PaymentCollections: React.FC<PaymentCollectionsProps> = ({ orders, onViewOrder, onSendWhatsApp, onAddLog, settings }) => {
  const [activeTab, setActiveTab] = useState<CollectionTab>('OVERDUE');
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<{start: string, end: string}>({ start: '', end: '' });
  const [generatingStrategy, setGeneratingStrategy] = useState<string | null>(null);

  // 1. Flatten all milestones (For Planned, Overdue, Upcoming)
  const allMilestones = useMemo(() => {
    return orders.flatMap(o => o.paymentPlan.milestones.map(m => ({
      ...m,
      type: 'MILESTONE',
      orderId: o.id,
      customerName: o.customerName,
      customerContact: o.customerContact,
      order: o
    })));
  }, [orders]);

  // 2. Flatten all payment records (For Received only)
  const allPayments = useMemo(() => {
    return orders.flatMap(o => o.payments.map(p => ({
      ...p,
      type: 'TRANSACTION',
      dueDate: p.date, // Alias for sorting
      targetAmount: p.amount, // Alias for sorting
      status: 'SUCCESS',
      orderId: o.id,
      customerName: o.customerName,
      customerContact: o.customerContact,
      order: o
    })));
  }, [orders]);

  const todayStr = new Date().toISOString().split('T')[0];

  const filteredData = useMemo(() => {
    let base: any[] = [];
    
    // 1. STRICT TAB FILTERING
    switch(activeTab) {
      case 'RECEIVED':
        // ONLY actual money received
        base = allPayments; 
        break;
      case 'OVERDUE':
        // ONLY unpaid milestones in the past
        base = allMilestones.filter(m => m.status !== 'PAID' && m.dueDate < todayStr);
        break;
      case 'UPCOMING':
        // ONLY unpaid milestones today or future
        base = allMilestones.filter(m => m.status !== 'PAID' && m.dueDate >= todayStr);
        break;
      case 'PLANNED':
        // MASTER SCHEDULE: Everything
        base = allMilestones;
        break;
    }

    // 2. DATE RANGE FILTERING
    if (dateRange.start) {
        base = base.filter(item => (item.dueDate || item.date).split('T')[0] >= dateRange.start);
    }
    if (dateRange.end) {
        base = base.filter(item => (item.dueDate || item.date).split('T')[0] <= dateRange.end);
    }

    // 3. TEXT SEARCH FILTERING
    if (search) {
        const lowerSearch = search.toLowerCase();
        base = base.filter(item => 
          item.customerName.toLowerCase().includes(lowerSearch) || 
          (item.orderId && item.orderId.toLowerCase().includes(lowerSearch))
        );
    }

    // 4. SORTING
    // Received: Newest first. Others: Oldest due date first (Urgency)
    return base.sort((a,b) => {
        const dateA = new Date(a.dueDate || a.date).getTime();
        const dateB = new Date(b.dueDate || b.date).getTime();
        return activeTab === 'RECEIVED' ? dateB - dateA : dateA - dateB;
    });

  }, [activeTab, allMilestones, allPayments, search, dateRange, todayStr]);

  const handleTriggerStrategy = async (item: any) => {
      setGeneratingStrategy(item.id);
      try {
          const result = await geminiService.generateStrategicNotification(
              item.order, 
              activeTab === 'OVERDUE' ? 'OVERDUE' : 'UPCOMING', 
              settings.currentGoldRate24K
          );
          
          const confirmed = confirm(
              `AI Strategy: ${result.tone} TONE\n` +
              `Reasoning: ${result.reasoning}\n\n` +
              `Selected Template: ${result.templateId}\n` +
              `Preview: "${result.message}"\n\n` +
              `Send this via WhatsApp?`
          );
          
          if (confirmed) {
             let res;
             if (result.templateId && result.variables) {
                 res = await whatsappService.sendTemplateMessage(item.customerContact, result.templateId, 'en_US', result.variables, item.customerName);
             } else {
                 res = await whatsappService.sendMessage(item.customerContact, result.message, item.customerName);
             }
             
             if (res.success && res.logEntry && onAddLog) {
                 onAddLog(res.logEntry);
                 alert(`Message sent successfully!`);
             } else {
                 alert(`Message Sent via Gateway (Check Logs).`);
             }
          }
      } catch (e) {
          console.error(e);
      } finally {
          setGeneratingStrategy(null);
      }
  };
  
  const generatePaymentLink = async (item: any) => {
      if(!confirm(`Send payment link for ₹${item.targetAmount} to ${item.customerName} via WhatsApp?`)) return;

      const amount = item.targetAmount || item.amount;
      const razorpayLink = `https://rzp.io/i/aura${item.orderId}`;
      const msg = `Dear ${item.customerName}, payment of ₹${amount.toLocaleString()} is due. Pay here: ${razorpayLink}`;
      
      const res = await whatsappService.sendMessage(item.customerContact, msg, item.customerName);
      if (res.success && res.logEntry && onAddLog) onAddLog(res.logEntry);
      
      alert("Link Sent Successfully");
  };

  const getDaysDiff = (dateStr: string) => {
      const today = new Date();
      today.setHours(0,0,0,0);
      const target = new Date(dateStr);
      target.setHours(0,0,0,0);
      const diffTime = target.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-24">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <ReceiptIndianRupee className="text-amber-600" /> Payment & Collection Center
          </h2>
          <p className="text-sm text-slate-500 font-medium">Global ledger for tracking dues, receipts, and forecasting.</p>
        </div>
        
        <div className="flex bg-white p-1 rounded-2xl shadow-sm border w-full lg:w-auto overflow-x-auto">
          {(['OVERDUE', 'UPCOMING', 'RECEIVED', 'PLANNED'] as CollectionTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Main Filter & List */}
      <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
        <div className="p-6 border-b bg-slate-50/50 flex flex-col xl:flex-row gap-4">
          <div className="relative flex-1">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
             <input 
              type="text" 
              placeholder="Search by customer or order ID..."
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-amber-500 outline-none font-medium text-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
             />
          </div>
          
          <div className="flex items-center gap-2 bg-white border border-slate-200 p-1 rounded-2xl shadow-sm">
              <div className="flex items-center gap-2 px-3 border-r border-slate-100">
                  <Filter size={16} className="text-slate-400" />
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Date Range</span>
              </div>
              <input 
                  type="date" 
                  className="bg-transparent text-xs font-bold text-slate-600 outline-none p-2"
                  value={dateRange.start}
                  onChange={e => setDateRange({...dateRange, start: e.target.value})}
              />
              <span className="text-slate-300">-</span>
              <input 
                  type="date" 
                  className="bg-transparent text-xs font-bold text-slate-600 outline-none p-2"
                  value={dateRange.end}
                  onChange={e => setDateRange({...dateRange, end: e.target.value})}
              />
              {(dateRange.start || dateRange.end) && (
                  <button onClick={() => setDateRange({start: '', end: ''})} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg">
                      <X size={14} />
                  </button>
              )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/80 text-[10px] font-black uppercase text-slate-400 tracking-[0.1em] border-b">
              <tr>
                <th className="px-8 py-5">Customer / Order</th>
                <th className="px-8 py-5">{activeTab === 'RECEIVED' ? 'Received Date' : 'Due Date'}</th>
                <th className="px-8 py-5">Amount</th>
                <th className="px-8 py-5">{activeTab === 'RECEIVED' ? 'Method' : 'Status'}</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredData.map((item: any) => {
                const daysDiff = getDaysDiff(item.dueDate || item.date);
                const isLate = daysDiff < 0;
                
                return (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-400">
                          {item.customerName.charAt(0)}
                       </div>
                       <div>
                          <p className="font-bold text-slate-800 leading-none mb-1.5">{item.customerName}</p>
                          <p className="text-xs text-slate-400 font-mono">{item.orderId || 'Payment Entry'}</p>
                       </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                     <div className="flex flex-col">
                         <div className="flex items-center gap-2">
                             <Calendar size={14} className="text-slate-400" />
                             <span className="text-sm font-bold text-slate-700">
                                {new Date(item.dueDate || item.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                             </span>
                         </div>
                         
                         {/* Dynamic Day Counter based on Tab */}
                         {activeTab === 'OVERDUE' && (
                             <span className="text-[10px] font-black text-rose-500 uppercase tracking-wide mt-1">
                                {Math.abs(daysDiff)} Days Late
                             </span>
                         )}
                         {activeTab === 'UPCOMING' && (
                             <span className="text-[10px] font-black text-blue-500 uppercase tracking-wide mt-1">
                                {daysDiff === 0 ? 'Due Today' : `In ${daysDiff} Days`}
                             </span>
                         )}
                     </div>
                  </td>
                  <td className="px-8 py-6">
                     <p className={`text-lg font-black ${item.type === 'TRANSACTION' ? 'text-emerald-600' : 'text-slate-900'}`}>
                       ₹{(item.targetAmount || item.amount).toLocaleString()}
                     </p>
                  </td>
                  <td className="px-8 py-6">
                     {item.type === 'TRANSACTION' ? (
                        <div className="flex items-center gap-2">
                           <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-[10px] font-bold uppercase border border-slate-200">{item.method}</span>
                           <ArrowDownLeft size={14} className="text-emerald-500" />
                        </div>
                     ) : (
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                          item.status === 'PAID' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                          isLate ? 'bg-rose-50 text-rose-700 border-rose-100 shadow-sm animate-pulse' : 
                          'bg-amber-50 text-amber-700 border-amber-100'
                        }`}>
                          {isLate && item.status !== 'PAID' ? 'OVERDUE' : item.status}
                        </span>
                     )}
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex justify-end gap-2">
                       {/* Strategy Buttons ONLY for Unpaid Milestones */}
                       {item.type === 'MILESTONE' && item.status !== 'PAID' && (
                          <>
                              <button 
                                onClick={() => handleTriggerStrategy(item)}
                                disabled={generatingStrategy === item.id}
                                className={`p-2 rounded-xl transition-all shadow-sm flex items-center gap-2 px-4 ${
                                  isLate
                                  ? 'bg-rose-600 text-white hover:bg-rose-700' 
                                  : 'bg-emerald-500 text-white hover:bg-emerald-600'
                                }`}
                              >
                                 {generatingStrategy === item.id ? <Loader2 size={16} className="animate-spin" /> : <BrainCircuit size={16} />}
                                 <span className="text-[10px] font-black uppercase tracking-widest">
                                    {isLate ? 'Recover' : 'Nudge'}
                                 </span>
                              </button>
                              <button 
                                onClick={() => generatePaymentLink(item)}
                                className="p-2 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl hover:bg-indigo-100 transition-colors flex items-center gap-2 px-3"
                                title="Send Payment Link via WhatsApp"
                              >
                                  <Share2 size={16} /> <span className="text-[10px] font-bold">Link</span>
                              </button>
                          </>
                       )}
                       {item.type === 'TRANSACTION' && (
                          <button className="p-2 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition-colors" title="Download Receipt">
                             <Download size={16} />
                          </button>
                       )}
                       <button 
                        onClick={() => onViewOrder(item.orderId)}
                        className="p-2 bg-white border border-slate-200 text-slate-400 rounded-xl hover:text-amber-600 hover:border-amber-200 transition-all shadow-sm"
                        title="View Order Details"
                       >
                         <ChevronRight size={18} />
                       </button>
                    </div>
                  </td>
                </tr>
              )})}
              {filteredData.length === 0 && (
                 <tr>
                    <td colSpan={5} className="py-24 text-center">
                       <div className="max-w-xs mx-auto space-y-3 opacity-50">
                          {activeTab === 'OVERDUE' ? <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" /> : <ReceiptIndianRupee className="w-12 h-12 text-slate-400 mx-auto" />}
                          <p className="font-bold text-slate-500 uppercase tracking-widest text-xs">
                              {activeTab === 'OVERDUE' ? 'No overdue payments!' : `No ${activeTab.toLowerCase()} records found`}
                          </p>
                          {(dateRange.start || dateRange.end) && <p className="text-[10px] text-slate-400">Try adjusting the date filter.</p>}
                       </div>
                    </td>
                 </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PaymentCollections;
