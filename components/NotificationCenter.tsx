
import React, { useState } from 'react';
import { Send, CheckCircle, Clock, AlertCircle, MessageSquare, Zap, Loader2, BrainCircuit, TrendingUp, Smartphone, FileText } from 'lucide-react';
import { NotificationTrigger, CollectionTone, Customer, RiskProfile } from '../types';
import { whatsappService } from '../services/whatsappService';

interface NotificationCenterProps {
  notifications: NotificationTrigger[];
  customers?: Customer[]; // Added to calculate risk
  onSend: (id: string, channel: 'WHATSAPP' | 'SMS') => void; // Kept for legacy/parent compatibility
  onRefresh: () => void;
  loading: boolean;
  isSending?: string | null;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ notifications, customers = [], onSend, onRefresh, loading, isSending }) => {
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'SENT'>('PENDING');
  const [channelOverride, setChannelOverride] = useState<'AUTO' | 'WHATSAPP' | 'SMS'>('AUTO');
  const [sendingState, setSendingState] = useState<string | null>(null);

  const filtered = notifications.filter(n => 
    filter === 'ALL' ? true : (filter === 'SENT' ? n.sent : !n.sent)
  );

  // Auto Configuration according to Customer Grade / Risk
  const getCustomerGrade = (customerName: string): RiskProfile => {
      const customer = customers.find(c => c.name === customerName);
      if (!customer) return 'REGULAR';
      
      // Simple heuristic: VIP if spent > 5L, High Risk if not found or overdue (assumed by trigger type)
      if (customer.totalSpent > 500000) return 'VIP';
      return 'REGULAR';
  };

  const getRecommendedChannel = (notif: NotificationTrigger) => {
      const grade = getCustomerGrade(notif.customerName);
      
      // Debt Recovery Logic:
      // High urgency or High Risk customers get SMS (Offline/Guaranteed Delivery)
      if (notif.type === 'OVERDUE' || notif.tone === 'URGENT') return 'SMS';
      if (grade === 'HIGH_RISK') return 'SMS';
      
      // VIP/Regulars get WhatsApp (Rich Media/Personal)
      return 'WHATSAPP'; 
  };

  const handleSmartSend = async (notif: NotificationTrigger) => {
      const targetChannel = channelOverride === 'AUTO' ? getRecommendedChannel(notif) : channelOverride;
      
      setSendingState(notif.id);
      try {
          if (targetChannel === 'WHATSAPP') {
              if (notif.aiRecommendedTemplateId && notif.aiRecommendedVariables) {
                  // Strict Template Sending
                  const res = await whatsappService.sendTemplateMessage(
                      notif.customerContact, 
                      notif.aiRecommendedTemplateId, 
                      'en_US', 
                      notif.aiRecommendedVariables, 
                      notif.customerName
                  );
                  if (res.success) {
                      // Trigger parent update (optimistic UI usually handles this)
                      onSend(notif.id, 'WHATSAPP'); 
                  } else {
                      alert(`WhatsApp Failed: ${res.error}`);
                  }
              } else {
                  // Fallback for unstructured triggers
                  await whatsappService.sendMessage(notif.customerContact, notif.message, notif.customerName);
                  onSend(notif.id, 'WHATSAPP');
              }
          } else {
              // SMS Logic (Parent handles mock/integration)
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
      {/* Header Widget */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-[2rem] border shadow-sm border-l-8 border-l-emerald-600 gap-4">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2 text-slate-800">
            <BrainCircuit className="text-emerald-600" /> Payment Assurance Engine
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
             AI-driven debt recovery & contract compliance.
          </p>
        </div>
        <button 
          onClick={onRefresh}
          className={`bg-emerald-600 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-lg ${loading ? 'animate-pulse opacity-80' : ''}`}
        >
          {loading ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />} 
          Run Strategy Scan
        </button>
      </div>

      {/* Controls & Channel Selector */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-100 p-2 rounded-2xl">
          <div className="flex gap-1 bg-white p-1 rounded-xl shadow-sm w-full sm:w-auto">
            {(['PENDING', 'SENT', 'ALL'] as const).map(f => (
              <button 
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${filter === f ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
             <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Channel Mode:</span>
             <button 
                onClick={() => setChannelOverride('AUTO')} 
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 transition-all ${channelOverride === 'AUTO' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-white border text-slate-400'}`}
             >
                <BrainCircuit size={12} /> Auto (Risk Graded)
             </button>
             <button 
                onClick={() => setChannelOverride('WHATSAPP')} 
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 transition-all ${channelOverride === 'WHATSAPP' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-white border text-slate-400'}`}
             >
                <MessageSquare size={12} /> WA
             </button>
             <button 
                onClick={() => setChannelOverride('SMS')} 
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 transition-all ${channelOverride === 'SMS' ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-white border text-slate-400'}`}
             >
                <Smartphone size={12} /> SMS
             </button>
          </div>
      </div>

      {/* Notification List */}
      <div className="space-y-4">
        {filtered.map(notif => {
          const activeChannel = channelOverride === 'AUTO' ? getRecommendedChannel(notif) : channelOverride;
          const busy = isSending === notif.id || sendingState === notif.id;
          
          return (
          <div key={notif.id} className={`bg-white p-6 rounded-[2rem] border-2 transition-all flex flex-col gap-4 ${notif.sent ? 'opacity-60 border-slate-100' : 'hover:border-emerald-400 border-slate-50 shadow-sm'}`}>
            <div className="flex justify-between items-start">
              <div className="flex gap-4">
                <div className={`p-3.5 rounded-2xl shrink-0 h-fit ${
                  notif.type === 'OVERDUE' ? 'bg-rose-50 text-rose-600' :
                  notif.type === 'UPCOMING' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
                }`}>
                  {notif.type === 'OVERDUE' ? <AlertCircle /> : notif.type === 'UPCOMING' ? <Clock /> : <CheckCircle />}
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h4 className="font-black text-slate-800 text-lg">{notif.customerName}</h4>
                    {notif.tone && (
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase border ${getToneStyle(notif.tone)}`}>
                            {notif.tone.replace('_', ' ')}
                        </span>
                    )}
                  </div>
                  <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest">{notif.type} Reminder • AI Generated</p>
                </div>
              </div>

              {!notif.sent && (
                <button 
                  onClick={() => handleSmartSend(notif)}
                  disabled={busy}
                  className={`bg-slate-900 text-white px-5 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg ${busy ? 'opacity-70 cursor-wait' : ''}`}
                >
                  {busy ? (
                    <><Loader2 size={14} className="animate-spin" /> Sending...</>
                  ) : (
                    <>
                        <Send size={14} /> 
                        {activeChannel === 'WHATSAPP' ? 'WhatsApp' : 'Msg91 SMS'}
                    </>
                  )}
                </button>
              )}
            </div>

            {/* AI Reasoning / Template Compliance Badge */}
            <div className="bg-gradient-to-r from-amber-50 to-white p-4 rounded-2xl border border-amber-100 flex flex-col sm:flex-row gap-4">
               <div className="flex items-start gap-2">
                   <BrainCircuit className="text-amber-600 shrink-0 mt-0.5" size={16} />
                   <div className="text-xs text-amber-900/80 font-medium leading-relaxed">
                      <span className="font-bold text-amber-900 uppercase text-[10px] tracking-wider block mb-1">AI Reasoning</span>
                      {notif.strategyReasoning}
                   </div>
               </div>
               
               {notif.aiRecommendedTemplateId && (
                   <div className="flex items-start gap-2 pl-0 sm:pl-4 border-l-0 sm:border-l border-amber-200">
                        <FileText className="text-blue-500 shrink-0 mt-0.5" size={16} />
                        <div>
                            <span className="font-bold text-blue-900 uppercase text-[10px] tracking-wider block mb-1">API Template Selected</span>
                            <code className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-[10px] font-mono">{notif.aiRecommendedTemplateId}</code>
                        </div>
                   </div>
               )}
            </div>

            <div className="relative">
                <div className="bg-slate-50 p-5 rounded-2xl text-sm text-slate-700 italic border border-slate-100 leading-relaxed pr-12 font-medium">
                    "{notif.message}"
                </div>
                <div className="absolute top-3 right-3 opacity-10">
                    <TrendingUp size={24} />
                </div>
            </div>
          </div>
        )})}
      </div>
    </div>
  );
};

export default NotificationCenter;
