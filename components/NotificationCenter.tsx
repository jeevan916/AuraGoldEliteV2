
import React, { useState } from 'react';
import { Bell, Send, CheckCircle, Clock, AlertCircle, MessageSquare, Zap, Loader2, BrainCircuit, ShieldAlert, TrendingUp } from 'lucide-react';
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

  const filtered = notifications.filter(n => 
    filter === 'ALL' ? true : (filter === 'SENT' ? n.sent : !n.sent)
  );

  const getToneStyle = (tone?: CollectionTone) => {
      switch(tone) {
          // Fix: Use correct CollectionTone value 'URGENT'
          case 'URGENT': return 'bg-rose-100 text-rose-700 border-rose-200';
          case 'FIRM': return 'bg-slate-800 text-white border-slate-900';
          // Fix: Use correct CollectionTone value 'ENCOURAGING'
          case 'ENCOURAGING': return 'bg-amber-100 text-amber-700 border-amber-200';
          default: return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border shadow-sm border-l-4 border-l-amber-500">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BrainCircuit className="text-amber-500" /> Collection Strategy Center
          </h2>
          <p className="text-sm text-slate-500">AI-driven prioritization based on market behavior.</p>
        </div>
        <button 
          onClick={onRefresh}
          className={`bg-slate-900 text-white px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg ${loading ? 'animate-pulse opacity-50' : ''}`}
        >
          {loading ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />} 
          Run AI Strategy Scan
        </button>
      </div>

      <div className="flex gap-2">
        {(['PENDING', 'SENT', 'ALL'] as const).map(f => (
          <button 
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${filter === f ? 'bg-amber-600 text-white shadow-md' : 'bg-white border text-slate-500 hover:border-amber-200'}`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.map(notif => (
          <div key={notif.id} className={`bg-white p-6 rounded-3xl border-2 transition-all flex flex-col gap-4 ${notif.sent ? 'opacity-60 border-slate-100' : 'hover:border-amber-400 border-slate-50 shadow-sm'}`}>
            <div className="flex justify-between items-start">
              <div className="flex gap-4">
                <div className={`p-3 rounded-2xl shrink-0 h-fit ${
                  notif.type === 'OVERDUE' ? 'bg-rose-50 text-rose-600' :
                  notif.type === 'UPCOMING' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
                }`}>
                  {notif.type === 'OVERDUE' ? <AlertCircle /> : notif.type === 'UPCOMING' ? <Clock /> : <CheckCircle />}
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h4 className="font-bold text-slate-800 text-lg">{notif.customerName}</h4>
                    {notif.tone && (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase border ${getToneStyle(notif.tone)}`}>
                            {notif.tone.replace('_', ' ')} Tone
                        </span>
                    )}
                  </div>
                  <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest">{notif.type} Reminder</p>
                </div>
              </div>

              {!notif.sent && (
                <button 
                  onClick={() => onSend(notif.id)}
                  disabled={!!isSending}
                  className={`bg-slate-900 text-white px-6 py-3 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg ${isSending === notif.id ? 'opacity-70 cursor-wait' : ''}`}
                >
                  {isSending === notif.id ? (
                    <><Loader2 size={14} className="animate-spin" /> Executing...</>
                  ) : (
                    <><Send size={14} /> Send WhatsApp</>
                  )}
                </button>
              )}
            </div>

            {notif.strategyReasoning && (
                <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100/50 flex gap-3">
                   <BrainCircuit className="text-amber-600 shrink-0" size={16} />
                   <div className="text-xs text-amber-900/70 font-medium">
                      <span className="font-bold text-amber-900 block mb-1">AI Reasoning:</span>
                      {notif.strategyReasoning}
                   </div>
                </div>
            )}

            <div className="relative">
                <div className="bg-slate-50 p-4 rounded-2xl text-sm text-slate-700 italic border border-slate-100 leading-relaxed pr-10">
                    "{notif.message}"
                </div>
                <div className="absolute top-2 right-2 opacity-10">
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
          <div className="py-20 text-center text-slate-400 bg-white border border-dashed rounded-3xl">
            <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-10" />
            <p className="font-bold">No active collection triggers.</p>
            <p className="text-xs mt-1">AI Strategy Engine is currently monitoring the market.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationCenter;
