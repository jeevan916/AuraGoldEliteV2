
import React, { useState } from 'react';
// Fix: Added RefreshCw to the list of icons imported from lucide-react
import { Send, CheckCircle, Clock, AlertCircle, MessageSquare, Zap, Loader2, BrainCircuit, TrendingUp, Smartphone, FileText, Sparkles, RefreshCw } from 'lucide-react';
import { NotificationTrigger, CollectionTone, Customer, RiskProfile, Order } from '../types';
import { whatsappService } from '../services/whatsappService';
import { geminiService } from '../services/geminiService';
import { storageService } from '../services/storageService';

interface NotificationCenterProps {
  notifications: NotificationTrigger[];
  customers?: Customer[];
  onSend: (id: string, channel: 'WHATSAPP' | 'SMS') => void;
  onRefresh: () => void;
  loading: boolean;
  isSending?: string | null;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ notifications, customers = [], onSend, onRefresh, loading, isSending }) => {
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'SENT'>('PENDING');
  const [channelOverride, setChannelOverride] = useState<'AUTO' | 'WHATSAPP' | 'SMS'>('AUTO');
  const [sendingState, setSendingState] = useState<string | null>(null);
  const [strategies, setStrategies] = useState<Record<string, any>>({});

  const filtered = notifications.filter(n => 
    filter === 'ALL' ? true : (filter === 'SENT' ? n.sent : !n.sent)
  );

  const getCustomerGrade = (customerName: string): RiskProfile => {
      const customer = customers.find(c => c.name === customerName);
      if (!customer) return 'REGULAR';
      if (customer.totalSpent > 500000) return 'VIP';
      return 'REGULAR';
  };

  const getRecommendedChannel = (notif: NotificationTrigger) => {
      const grade = getCustomerGrade(notif.customerName);
      if (notif.type === 'OVERDUE' || notif.tone === 'URGENT') return 'SMS';
      if (grade === 'HIGH_RISK') return 'SMS';
      return 'WHATSAPP'; 
  };

  const handleDeepScan = async (notif: NotificationTrigger) => {
      setSendingState(notif.id);
      try {
          const settings = storageService.getSettings();
          const orders = storageService.getOrders();
          const targetOrder = orders.find(o => o.customerContact === notif.customerContact);
          
          if (!targetOrder) throw new Error("Order context missing");

          // Fix: The service now accepts 'UPCOMING' | 'OVERDUE' | 'SYSTEM' to match notif.type
          const strategy = await geminiService.generateStrategicNotification(
              targetOrder,
              notif.type,
              settings.currentGoldRate22K,
              getCustomerGrade(notif.customerName)
          );

          setStrategies(prev => ({ ...prev, [notif.id]: strategy }));
          alert(`Deep AI Strategy: ${strategy.tone} tone selected based on ${strategy.reasoning}`);
      } catch (e: any) {
          alert(`Strategy Engine Error: ${e.message}`);
      } finally {
          setSendingState(null);
      }
  };

  const handleSmartSend = async (notif: NotificationTrigger) => {
      const activeStrategy = strategies[notif.id];
      const targetChannel = channelOverride === 'AUTO' ? getRecommendedChannel(notif) : channelOverride;
      
      setSendingState(notif.id);
      try {
          if (targetChannel === 'WHATSAPP') {
              const templateId = activeStrategy?.templateId || notif.aiRecommendedTemplateId;
              const vars = activeStrategy?.variables || notif.aiRecommendedVariables;

              if (templateId && vars) {
                  const res = await whatsappService.sendTemplateMessage(notif.customerContact, templateId, 'en_US', vars, notif.customerName);
                  if (res.success) onSend(notif.id, 'WHATSAPP');
                  else alert(`WhatsApp Failed: ${res.error}`);
              } else {
                  await whatsappService.sendMessage(notif.customerContact, activeStrategy?.message || notif.message, notif.customerName);
                  onSend(notif.id, 'WHATSAPP');
              }
          } else {
              onSend(notif.id, 'SMS');
          }
      } catch (e) {
          console.error(e);
      } finally {
          setSendingState(null);
      }
  };

  const getToneStyle = (tone?: CollectionTone) => {
      switch(tone) {
          case 'URGENT': return 'bg-rose-100 text-rose-700 border-rose-200';
          case 'FIRM': return 'bg-slate-800 text-white border-slate-900';
          case 'ENCOURAGING': return 'bg-amber-100 text-amber-700 border-amber-200';
          default: return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-[2rem] border shadow-sm border-l-8 border-l-emerald-600 gap-4 relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-xl font-black flex items-center gap-2 text-slate-800 uppercase tracking-tight">
            <BrainCircuit className="text-emerald-600" /> Collection Strategy Console
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
             Gemini 3 Pro generating hyper-personalized recovery scripts.
          </p>
        </div>
        <button 
          onClick={onRefresh}
          className={`bg-emerald-600 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-lg z-10 ${loading ? 'animate-pulse opacity-80' : ''}`}
        >
          {loading ? <Loader2 size={16} /> : <RefreshCw size={16} />} 
          Refresh Triggers
        </button>
        <div className="absolute right-[-10%] top-[-20%] opacity-5">
            <BrainCircuit size={200} />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-100 p-2 rounded-2xl">
          <div className="flex gap-1 bg-white p-1 rounded-xl shadow-sm w-full sm:w-auto">
            {(['PENDING', 'SENT', 'ALL'] as const).map(f => (
              <button 
                key={f} onClick={() => setFilter(f)}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${filter === f ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
             <button 
                onClick={() => setChannelOverride('AUTO')} 
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 transition-all ${channelOverride === 'AUTO' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-white border text-slate-400'}`}
             >
                <BrainCircuit size={12} /> Auto
             </button>
             <button 
                onClick={() => setChannelOverride('WHATSAPP')} 
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 transition-all ${channelOverride === 'WHATSAPP' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-white border text-slate-400'}`}
             >
                <MessageSquare size={12} /> WA
             </button>
             <button 
                onClick={() => setChannelOverride('SMS')} 
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 transition-all ${channelOverride === 'SMS' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-white border text-slate-400'}`}
             >
                <Smartphone size={12} /> SMS
             </button>
          </div>
      </div>

      <div className="space-y-4">
        {filtered.map(notif => {
          const strategy = strategies[notif.id];
          const activeChannel = channelOverride === 'AUTO' ? getRecommendedChannel(notif) : channelOverride;
          const busy = isSending === notif.id || sendingState === notif.id;
          
          return (
          <div key={notif.id} className={`bg-white p-6 rounded-[2.5rem] border-2 transition-all flex flex-col gap-4 ${notif.sent ? 'opacity-60 border-slate-100' : 'hover:border-emerald-400 border-slate-50 shadow-sm'}`}>
            <div className="flex justify-between items-start">
              <div className="flex gap-4">
                <div className={`p-4 rounded-2xl shrink-0 h-fit ${
                  notif.type === 'OVERDUE' ? 'bg-rose-50 text-rose-600' :
                  notif.type === 'UPCOMING' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
                }`}>
                  {notif.type === 'OVERDUE' ? <AlertCircle /> : notif.type === 'UPCOMING' ? <Clock /> : <CheckCircle />}
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h4 className="font-black text-slate-800 text-lg leading-tight">{notif.customerName}</h4>
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase border ${getToneStyle(strategy?.tone || notif.tone)}`}>
                        {(strategy?.tone || notif.tone || 'PENDING').replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest">{notif.type} Event</span>
                      <div className="w-1 h-1 bg-slate-200 rounded-full"></div>
                      <span className="text-[10px] font-bold text-amber-600 uppercase">{getCustomerGrade(notif.customerName)} Profile</span>
                  </div>
                </div>
              </div>

              {!notif.sent && (
                <div className="flex gap-2">
                    <button 
                        onClick={() => handleDeepScan(notif)}
                        disabled={busy}
                        className="p-3 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100 transition-all border border-amber-100 shadow-sm group"
                        title="Analyze with Gemini 3 Pro"
                    >
                        <Sparkles size={18} className="group-hover:scale-110 transition-transform" />
                    </button>
                    <button 
                        onClick={() => handleSmartSend(notif)}
                        disabled={busy}
                        className={`bg-slate-900 text-white px-6 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg ${busy ? 'opacity-70 cursor-wait' : ''}`}
                    >
                        {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        {activeChannel === 'WHATSAPP' ? 'Deliver WA' : 'Send SMS'}
                    </button>
                </div>
              )}
            </div>

            <div className="bg-gradient-to-r from-slate-50 to-white p-5 rounded-2xl border border-slate-100 flex flex-col gap-3">
               <div className="flex items-start gap-2">
                   <BrainCircuit className="text-emerald-600 shrink-0 mt-0.5" size={16} />
                   <div className="text-xs text-slate-600 font-medium leading-relaxed">
                      <span className="font-black text-slate-800 uppercase text-[9px] tracking-widest block mb-1">AI Reasoning Engine</span>
                      {strategy?.reasoning || "Standard operational logic applied. Use deep scan for behavior-based nudges."}
                   </div>
               </div>
            </div>

            <div className="relative group">
                <div className="bg-white p-5 rounded-2xl text-sm text-slate-800 italic border-2 border-dashed border-slate-200 leading-relaxed font-medium group-hover:border-emerald-200 transition-colors">
                    "{strategy?.message || notif.message}"
                </div>
                {strategy?.templateId && (
                    <div className="absolute bottom-2 right-2 flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-700 rounded-lg border border-blue-100">
                        <FileText size={10} />
                        <span className="text-[9px] font-black uppercase font-mono tracking-tighter">{strategy.templateId}</span>
                    </div>
                )}
            </div>
          </div>
        )})}
      </div>
    </div>
  );
};

export default NotificationCenter;
