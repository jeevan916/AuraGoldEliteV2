
import React, { useState, useMemo } from 'react';
import { 
  Search, Filter, ReceiptIndianRupee, Calendar, CheckCircle2, 
  Clock, ChevronRight, Download,
  ArrowDownLeft, BrainCircuit, Loader2, Share2, X, AlertOctagon
} from 'lucide-react';
import { Order, WhatsAppLogEntry, GlobalSettings, OrderStatus } from '../types';
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

  // --- 1. ROBUST DATE PARSING ---
  const parseDateLocal = (dateStr: string) => {
      if(!dateStr) return new Date();
      // Handle ISO strings (Transactions) vs YYYY-MM-DD (Milestones)
      if (dateStr.includes('T')) {
          return new Date(dateStr);
      }
      // Force local midnight for YYYY-MM-DD
      const [y, m, d] = dateStr.split('-').map(Number);
      return new Date(y, m - 1, d);
  };

  const getStartOfToday = () => {
      const d = new Date();
      d.setHours(0,0,0,0);
      return d;
  };

  // --- 2. DATA PREPARATION ---
  const { allMilestones, allTransactions } = useMemo(() => {
      const ms: any[] = [];
      const tx: any[] = [];
      
      orders.forEach(o => {
          // Ignore cancelled/delivered for Collections (except Received history)
          const isArchived = o.status === OrderStatus.CANCELLED || o.status === OrderStatus.DELIVERED;

          // Milestones (Only active orders)
          if (!isArchived) {
              o.paymentPlan.milestones.forEach(m => {
                  ms.push({
                      ...m,
                      _type: 'MILESTONE',
                      orderId: o.id,
                      customerName: o.customerName,
                      customerContact: o.customerContact,
                      order: o,
                      dateObj: parseDateLocal(m.dueDate),
                      displayDate: parseDateLocal(m.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                  });
              });
          }

          // Transactions (All history, even if archived)
          o.payments.forEach(p => {
              tx.push({
                  ...p,
                  _type: 'TRANSACTION',
                  orderId: o.id,
                  customerName: o.customerName,
                  customerContact: o.customerContact,
                  order: o,
                  dateObj: new Date(p.date),
                  displayDate: new Date(p.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
                  // Normalize fields
                  targetAmount: p.amount,
                  status: 'PAID'
              });
          });
      });
      
      return { allMilestones: ms, allTransactions: tx };
  }, [orders]);

  // --- 3. BUCKETING ---
  const today = getStartOfToday();
  const todayTime = today.getTime();

  const overdueList = useMemo(() => allMilestones.filter(m => m.status !== 'PAID' && m.dateObj.getTime() < todayTime), [allMilestones, todayTime]);
  const upcomingList = useMemo(() => allMilestones.filter(m => m.status !== 'PAID' && m.dateObj.getTime() >= todayTime), [allMilestones, todayTime]);
  const receivedList = useMemo(() => allTransactions, [allTransactions]);
  const plannedList = useMemo(() => allMilestones, [allMilestones]);

  // --- 4. SELECTION & FILTERING ---
  const displayData = useMemo(() => {
      let base: any[] = [];
      switch(activeTab) {
          case 'OVERDUE': base = overdueList; break;
          case 'UPCOMING': base = upcomingList; break;
          case 'RECEIVED': base = receivedList; break;
          case 'PLANNED': base = plannedList; break;
      }

      return base.filter(item => {
          // Search
          if (search) {
              const s = search.toLowerCase();
              if (!item.customerName.toLowerCase().includes(s) && !item.orderId.toLowerCase().includes(s)) return false;
          }
          
          // Date Range
          if (dateRange.start) {
              const start = parseDateLocal(dateRange.start);
              if (item.dateObj < start) return false;
          }
          if (dateRange.end) {
              const end = parseDateLocal(dateRange.end);
              end.setHours(23,59,59,999);
              if (item.dateObj > end) return false;
          }
          return true;
      }).sort((a,b) => {
          // Received: Newest First
          if (activeTab === 'RECEIVED') return b.dateObj.getTime() - a.dateObj.getTime();
          // Milestones: Oldest First (Urgency)
          return a.dateObj.getTime() - b.dateObj.getTime();
      });
  }, [activeTab, overdueList, upcomingList, receivedList, plannedList, search, dateRange]);

  // --- 5. ACTIONS ---
  const handleTriggerStrategy = async (item: any) => {
      setGeneratingStrategy(item.id);
      try {
          const result = await geminiService.generateStrategicNotification(
              item.order, 
              activeTab === 'OVERDUE' ? 'OVERDUE' : 'UPCOMING', 
              settings.currentGoldRate24K
          );
          
          if(confirm(`Send AI Message?\n\nTone: ${result.tone}\n\n"${result.message}"`)) {
             let res;
             if (result.templateId && result.variables) {
                 res = await whatsappService.sendTemplateMessage(item.customerContact, result.templateId, 'en_US', result.variables, item.customerName);
             } else {
                 res = await whatsappService.sendMessage(item.customerContact, result.message, item.customerName);
             }
             if (res.success && res.logEntry && onAddLog) onAddLog(res.logEntry);
             alert("Sent!");
          }
      } catch (e) {
          console.error(e);
      } finally {
          setGeneratingStrategy(null);
      }
  };

  const getDaysDiff = (itemDate: Date) => {
      const diffTime = itemDate.getTime() - todayTime;
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-24">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <ReceiptIndianRupee className="text-amber-600" /> Payment & Collection Center
          </h2>
          <p className="text-sm text-slate-500 font-medium">Global ledger for tracking dues, receipts, and forecasting.</p>
        </div>
        
        {/* Tabs with Counts */}
        <div className="flex bg-white p-1 rounded-2xl shadow-sm border w-full lg:w-auto overflow-x-auto custom-scrollbar">
          {[
            { id: 'OVERDUE', label: 'Overdue', count: overdueList.length, color: 'text-rose-600' },
            { id: 'UPCOMING', label: 'Upcoming', count: upcomingList.length, color: 'text-blue-600' },
            { id: 'RECEIVED', label: 'Received', count: receivedList.length, color: 'text-emerald-600' },
            { id: 'PLANNED', label: 'Master Plan', count: plannedList.length, color: 'text-slate-600' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as CollectionTab)}
              className={`whitespace-nowrap px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                  activeTab === tab.id 
                  ? 'bg-slate-900 text-white shadow-lg' 
                  : 'text-slate-400 hover:bg-slate-50'
              }`}
            >
              {tab.label}
              <span className={`px-1.5 py-0.5 rounded-md text-[9px] ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 ' + tab.color}`}>
                  {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Panel */}
      <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden flex flex-col min-h-[500px]">
        {/* Filters */}
        <div className="p-6 border-b bg-slate-50/50 flex flex-col xl:flex-row gap-4 shrink-0">
          <div className="relative flex-1">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
             <input 
              type="text" 
              placeholder="Search by customer name or order ID..."
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

        {/* Data Table */}
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left">
            <thead className="bg-slate-50/80 text-[10px] font-black uppercase text-slate-400 tracking-[0.1em] border-b sticky top-0 z-10 backdrop-blur-md">
              <tr>
                <th className="px-8 py-5">Customer / Order</th>
                <th className="px-8 py-5">{activeTab === 'RECEIVED' ? 'Received Date' : 'Due Date'}</th>
                <th className="px-8 py-5">Amount</th>
                <th className="px-8 py-5">{activeTab === 'RECEIVED' ? 'Method' : 'Status'}</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {displayData.map((item: any, idx: number) => {
                const isTransaction = item._type === 'TRANSACTION';
                const daysDiff = getDaysDiff(item.dateObj);
                
                // Extra check: If we are in Received tab, allow any date. If in Overdue/Upcoming, calculate lag.
                const isLate = !isTransaction && daysDiff < 0;

                return (
                <tr key={`${item.id}-${idx}`} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                       <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-slate-400 ${isTransaction ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100'}`}>
                          {isTransaction ? <ArrowDownLeft size={16} /> : item.customerName.charAt(0)}
                       </div>
                       <div>
                          <p className="font-bold text-slate-800 leading-none mb-1.5">{item.customerName}</p>
                          <p className="text-xs text-slate-400 font-mono">{item.orderId}</p>
                       </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                     <div className="flex flex-col">
                         <div className="flex items-center gap-2">
                             <Calendar size={14} className="text-slate-400" />
                             <span className="text-sm font-bold text-slate-700">{item.displayDate}</span>
                         </div>
                         {/* Dynamic Labels */}
                         {!isTransaction && activeTab === 'OVERDUE' && (
                             <span className="text-[10px] font-black text-rose-500 uppercase tracking-wide mt-1">
                                {Math.abs(daysDiff)} Days Late
                             </span>
                         )}
                         {!isTransaction && activeTab === 'UPCOMING' && (
                             <span className="text-[10px] font-black text-blue-500 uppercase tracking-wide mt-1">
                                {daysDiff === 0 ? 'Due Today' : `In ${daysDiff} Days`}
                             </span>
                         )}
                     </div>
                  </td>
                  <td className="px-8 py-6">
                     <p className={`text-lg font-black ${isTransaction ? 'text-emerald-600' : 'text-slate-900'}`}>
                       ₹{(item.targetAmount || 0).toLocaleString()}
                     </p>
                  </td>
                  <td className="px-8 py-6">
                     {isTransaction ? (
                        <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-[10px] font-bold uppercase border border-slate-200 inline-block">
                            {item.method || 'Unknown'}
                        </span>
                     ) : (
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                          item.status === 'PAID' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                          isLate ? 'bg-rose-50 text-rose-700 border-rose-100 shadow-sm animate-pulse' : 
                          'bg-amber-50 text-amber-700 border-amber-100'
                        }`}>
                          {item.status === 'PAID' ? 'PAID' : (isLate ? 'OVERDUE' : item.status)}
                        </span>
                     )}
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex justify-end gap-2">
                       {/* Action Buttons */}
                       {!isTransaction && item.status !== 'PAID' && (
                          <>
                              <button 
                                onClick={() => handleTriggerStrategy(item)}
                                disabled={generatingStrategy === item.id}
                                className={`p-2 rounded-xl transition-all shadow-sm flex items-center gap-2 px-4 ${isLate ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-emerald-500 text-white hover:bg-emerald-600'}`}
                              >
                                 {generatingStrategy === item.id ? <Loader2 size={16} className="animate-spin" /> : <BrainCircuit size={16} />}
                                 <span className="text-[10px] font-black uppercase tracking-widest">
                                    {isLate ? 'Recover' : 'Nudge'}
                                 </span>
                              </button>
                              <button className="p-2 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl hover:bg-indigo-100"><Share2 size={16} /></button>
                          </>
                       )}
                       {isTransaction && (
                          <button className="p-2 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200"><Download size={16} /></button>
                       )}
                       <button onClick={() => onViewOrder(item.orderId)} className="p-2 bg-white border border-slate-200 text-slate-400 rounded-xl hover:text-amber-600 hover:border-amber-200">
                         <ChevronRight size={18} />
                       </button>
                    </div>
                  </td>
                </tr>
              )})}
              
              {displayData.length === 0 && (
                 <tr>
                    <td colSpan={5} className="py-24 text-center">
                       <div className="max-w-xs mx-auto space-y-3 opacity-50">
                          {activeTab === 'RECEIVED' ? <ReceiptIndianRupee className="w-12 h-12 text-emerald-500 mx-auto" /> : <CheckCircle2 className="w-12 h-12 text-slate-400 mx-auto" />}
                          <p className="font-bold text-slate-500 uppercase tracking-widest text-xs">
                              {activeTab === 'OVERDUE' ? 'No overdue payments!' : `No records in ${activeTab}`}
                          </p>
                          {(dateRange.start || dateRange.end) && <p className="text-[10px] text-slate-400">Clear date filter to see all.</p>}
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
