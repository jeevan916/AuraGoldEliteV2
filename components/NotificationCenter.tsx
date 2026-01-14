import React, { useState } from 'react';
import { Bell, Send, CheckCircle, Clock, AlertCircle, MessageSquare, Zap, Loader2, BrainCircuit, ShieldAlert, TrendingUp, Smartphone, Mail } from 'lucide-react';
import { NotificationTrigger, CollectionTone } from '../types';

interface NotificationCenterProps {
  notifications: NotificationTrigger[];
  onSend: (id: string) => void;
  onRefresh: () => void;
  loading: boolean;
  isSending?: string | null;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ notifications, onSend, onRefresh, loading, isSending }) => {
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'SENT'>('PENDING');
  const [channel, setChannel] = useState<'WHATSAPP' | 'SMS'>('WHATSAPP');

  const filtered = notifications.filter(n => 
    filter === 'ALL' ? true : (filter === 'SENT' ? n.sent : !n.sent)
  );

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
             AI-driven milestone enforcement & contract compliance.
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
             <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Channel:</span>
             <button 
                onClick={() => setChannel('WHATSAPP')} 
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 transition-all ${channel === 'WHATSAPP' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-white border text-slate-400'}`}
             >
                <MessageSquare size={12} /> WhatsApp
             </button>
             <button 
                onClick={() => setChannel('SMS')} 
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 transition-all ${channel === 'SMS' ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-white border text-slate-400'}`}
             >
                <Smartphone size={12} /> Msg91 SMS
             </button>
          </div>
      </div>

      {/* Notification List */}
      <div className="space-y-4">
        {filtered.map(notif => (
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
                  onClick={() => onSend(notif.id)}
                  disabled={!!isSending}
                  className={`bg-slate-900 text-white px-5 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg ${isSending === notif.id ? 'opacity-70 cursor-wait' : ''}`}
                >
                  {isSending === notif.id ? (
                    <><Loader2 size={14} className="animate-spin" /> Sending...</>
                  ) : (
                    <><Send size={14} /> Send {channel}</>
                  )}
                </button>
              )}
            </div>

            {notif.strategyReasoning && (
                <div className="bg-gradient-to-r from-amber-50 to-white p-4 rounded-2xl border border-amber-100 flex gap-3">
                   <BrainCircuit className="text-amber-600 shrink-0" size={18} />
                   <div className="text-xs text-amber-900/80 font-medium leading-relaxed">
                      <span className="font-bold text-amber-900 uppercase text-[10px] tracking-wider block mb-1">AI Reasoning</span>
                      {notif.strategyReasoning}
                   </div>
                </div>
            )}

            <div className="relative">
                <div className="bg-slate-50 p-5 rounded-2xl text-sm text-slate-700 italic border border-slate-100 leading-relaxed pr-12 font-medium">
                    "{notif.message}"
                </div>
                <div className="absolute top-3 right-3 opacity-10">
                    <TrendingUp size={24} />
                </div>
            </div>

            <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">
               <span>Generated {new Date(notif.date).toLocaleDateString()}</span>
               {notif.sent && <span className="text-emerald-600 flex items-center gap-1"><CheckCircle size={12} /> Successfully Dispatched</span>}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="py-24 text-center text-slate-400 bg-white border-2 border-dashed border-slate-200 rounded-[2.5rem]">
            <BrainCircuit className="w-16 h-16 mx-auto mb-4 opacity-10" />
            <p className="font-black text-sm uppercase tracking-widest">No active triggers</p>
            <p className="text-xs mt-2 font-medium opacity-60">Run the strategy scan to identify collection opportunities.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationCenter;