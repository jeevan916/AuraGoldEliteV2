
import React from 'react';
import { ShieldCheck, RefreshCw, Loader2, Terminal, AlertTriangle } from 'lucide-react';
import { REQUIRED_SYSTEM_TEMPLATES } from '../../constants';
import { WhatsAppTemplate } from '../../types';

interface CoreActionTabProps {
  templates: WhatsAppTemplate[];
  repairing: boolean;
  handleAutoHeal: () => void;
  repairLogs: string[];
  logsEndRef: React.RefObject<HTMLDivElement | null>;
}

export const CoreActionTab: React.FC<CoreActionTabProps> = ({ 
  templates, repairing, handleAutoHeal, repairLogs, logsEndRef 
}) => {
  return (
    <div className="flex flex-col gap-6 h-[calc(100vh-200px)] overflow-hidden">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="bg-amber-100 text-amber-700 p-2 rounded-xl"><ShieldCheck size={20} /></div>
                <div>
                    <h3 className="font-bold text-slate-800 text-sm">Core Action Templates</h3>
                    <p className="text-[10px] text-slate-500">Fixed messages triggered by buttons. Hard requirements.</p>
                </div>
            </div>
            <button 
                onClick={handleAutoHeal}
                disabled={repairing}
                className="text-[10px] font-black uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-700 px-6 py-2.5 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95"
            >
                {repairing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                AI Self-Heal Core
            </button>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0 overflow-hidden p-2">
            <div className="space-y-3 overflow-y-auto custom-scrollbar pr-2 h-full">
                {REQUIRED_SYSTEM_TEMPLATES.map(req => {
                    const match = templates.find(t => t.name === req.name || t.name.startsWith(req.name));
                    const isMismatch = match && (
                        (match.content?.match(/{{[0-9]+}}/g)?.length || 0) !== (req.content.match(/{{[0-9]+}}/g)?.length || 0)
                    );

                    return (
                        <div key={req.name} className={`flex flex-col gap-2 p-4 rounded-2xl border bg-white transition-colors shadow-sm ${isMismatch ? 'border-amber-400 bg-amber-50' : 'border-slate-100 hover:border-amber-200'}`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-3 h-3 rounded-full shrink-0 ${match ? (isMismatch ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500') : 'bg-rose-500 animate-pulse'}`}></div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-800">{req.name}</p>
                                        <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">{req.appGroup}</p>
                                    </div>
                                </div>
                                <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase ${match ? (isMismatch ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-600') : 'bg-rose-50 text-rose-600'}`}>
                                    {match ? (isMismatch ? 'Structure Mismatch' : 'Active') : 'Missing'}
                                </span>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-xl text-[10px] text-slate-600 font-mono leading-relaxed border border-slate-100">
                                <p className="font-bold text-[8px] text-slate-400 mb-1 uppercase">Required Structure:</p>
                                "{req.content}"
                            </div>
                            {isMismatch && (
                                <div className="text-[9px] text-amber-700 italic flex items-center gap-1">
                                    <AlertTriangle size={10} /> Auto-Heal will overwrite Meta version to match App requirements.
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
            
            <div className="bg-slate-900 rounded-3xl p-6 text-emerald-400 font-mono text-[10px] overflow-hidden flex flex-col h-full shadow-inner border border-slate-800">
                <div className="flex items-center gap-2 mb-4 text-slate-500 uppercase font-bold tracking-widest text-[9px] border-b border-slate-800 pb-2 shrink-0">
                    <Terminal size={14} /> System Health Console
                </div>
                <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
                    {repairLogs.length === 0 ? <span className="opacity-30">System idle. Ready for diagnostics.</span> : repairLogs.map((l, i) => <div key={i}>{l}</div>)}
                    <div ref={logsEndRef} />
                </div>
            </div>
        </div>
    </div>
  );
};
