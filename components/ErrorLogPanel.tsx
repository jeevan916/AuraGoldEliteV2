
import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle, CheckCircle2, XCircle, Activity, Zap, 
  Terminal, ShieldCheck, HeartPulse, Search, Copy, 
  Wrench, Code, RefreshCw, Loader2, BrainCircuit, Sparkles, ChevronRight, Layout
} from 'lucide-react';
import { AppError, ActivityLogEntry, AppResolutionPath } from '../types';
import { errorService } from '../services/errorService';

interface ErrorLogPanelProps {
  errors: AppError[];
  onClear: () => void;
  onResolveAction?: (path: AppResolutionPath) => void;
  activities?: ActivityLogEntry[];
}

const ErrorLogPanel: React.FC<ErrorLogPanelProps> = ({ errors, onClear, onResolveAction, activities = [] }) => {
  const [activeTab, setActiveTab] = useState<'ERRORS' | 'ACTIVITY'>('ERRORS');
  const [filterMode, setFilterMode] = useState<'ALL' | 'ACTION_REQUIRED'>('ACTION_REQUIRED');
  const [searchQuery, setSearchQuery] = useState('');
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  const filteredErrors = useMemo(() => {
      let subset = errors;
      if (filterMode === 'ACTION_REQUIRED') {
          subset = errors.filter(e => e.status !== 'AUTO_FIXED' && e.status !== 'RESOLVED');
      }
      return subset.filter(err => 
          err.source.toLowerCase().includes(searchQuery.toLowerCase()) || 
          err.message.toLowerCase().includes(searchQuery.toLowerCase())
      );
  }, [errors, searchQuery, filterMode]);

  const stats = useMemo(() => {
      const codeFixCount = errors.filter(e => e.status === 'REQUIRES_CODE_CHANGE').length;
      const autoFixedCount = errors.filter(e => e.status === 'AUTO_FIXED').length;
      return { codeFixCount, autoFixedCount };
  }, [errors]);

  const handleReanalyze = async (errorId: string) => {
      setAnalyzingId(errorId);
      await errorService.runIntelligentAnalysis(errorId);
      setAnalyzingId(null);
  };

  const handleLaunchArchitect = (err: AppError) => {
      if (err.implementationPrompt) {
          // Store the prompt in session so Architect can pick it up
          sessionStorage.setItem('architect_fix_prompt', err.implementationPrompt);
          sessionStorage.setItem('architect_target_file', err.source);
          if ((window as any).dispatchView) {
              (window as any).dispatchView('ARCHITECT');
          }
      }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 h-[calc(100vh-140px)] flex flex-col animate-fadeIn">
      {/* 1. System Health Banner */}
      <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden shrink-0">
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-4">
                  <div className={`p-4 rounded-2xl ${stats.codeFixCount > 0 ? 'bg-rose-500 shadow-lg shadow-rose-500/20' : 'bg-emerald-500 shadow-lg shadow-emerald-500/20'}`}>
                      {stats.codeFixCount > 0 ? <AlertTriangle size={24} /> : <ShieldCheck size={24} />}
                  </div>
                  <div>
                      <h2 className="text-xl font-black uppercase tracking-widest">Diagnostic Center</h2>
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mt-1">Gemini 3 Pro Health Monitor</p>
                  </div>
              </div>
              <div className="flex gap-4">
                  <div className="bg-white/5 border border-white/10 px-6 py-3 rounded-2xl backdrop-blur-md">
                      <p className="text-[9px] font-black uppercase text-slate-500">Auto-Healed</p>
                      <p className="text-xl font-black text-emerald-400">{stats.autoFixedCount}</p>
                  </div>
                  <div className="bg-white/5 border border-white/10 px-6 py-3 rounded-2xl backdrop-blur-md">
                      <p className="text-[9px] font-black uppercase text-slate-500">Critical Paths</p>
                      <p className="text-xl font-black text-rose-400">{stats.codeFixCount}</p>
                  </div>
              </div>
          </div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-[120px]"></div>
      </div>

      {/* 2. Controls */}
      <div className="flex justify-between items-center bg-white p-4 rounded-[2rem] border shadow-sm shrink-0">
          <div className="flex bg-slate-100 p-1 rounded-xl">
              <button onClick={() => setActiveTab('ERRORS')} className={`px-6 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'ERRORS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>Diagnostics</button>
              <button onClick={() => setActiveTab('ACTIVITY')} className={`px-6 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'ACTIVITY' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>Real-time Feed</button>
          </div>
          <div className="flex gap-2">
              <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input className="bg-slate-50 border-none rounded-xl pl-9 pr-4 py-2.5 text-xs font-bold w-64 outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="Search event trace..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
              <button onClick={onClear} className="p-2.5 text-slate-400 hover:text-rose-500 transition-colors"><RefreshCw size={18} /></button>
          </div>
      </div>

      {/* 3. Main Stream */}
      <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
          {activeTab === 'ERRORS' ? (
              filteredErrors.map(err => (
                  <div key={err.id} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden group hover:border-blue-200 transition-all">
                      <div className="p-6">
                          <div className="flex justify-between items-start mb-4">
                              <div className="flex items-center gap-4">
                                  <div className={`p-3 rounded-xl ${err.severity === 'CRITICAL' ? 'bg-rose-50 text-rose-500' : 'bg-amber-50 text-amber-500'}`}>
                                      <Zap size={20} />
                                  </div>
                                  <div>
                                      <div className="flex items-center gap-2">
                                          <span className="text-[10px] font-black bg-slate-900 text-white px-2 py-0.5 rounded uppercase">{err.status}</span>
                                          <span className="text-[10px] font-bold text-slate-400">{new Date(err.timestamp).toLocaleString()}</span>
                                      </div>
                                      <h3 className="font-bold text-slate-800 text-sm mt-1">{err.source} Gateway Exception</h3>
                                  </div>
                              </div>
                              <button onClick={() => handleReanalyze(err.id)} disabled={analyzingId === err.id} className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-indigo-600 transition-all">
                                  {analyzingId === err.id ? <Loader2 size={18} className="animate-spin" /> : <BrainCircuit size={18} />}
                              </button>
                          </div>

                          <div className="bg-slate-950 p-4 rounded-2xl font-mono text-[10px] text-emerald-400 mb-6 border border-slate-800 break-all leading-relaxed">
                              {err.message}
                          </div>

                          {err.aiDiagnosis && (
                              <div className="bg-indigo-50/50 border border-indigo-100 rounded-[1.5rem] p-6 space-y-4 animate-slideDown">
                                  <div className="flex items-center gap-3 text-indigo-700">
                                      <Sparkles size={18} />
                                      <span className="text-xs font-black uppercase tracking-widest">Gemini 3 Pro Intelligence Insight</span>
                                  </div>
                                  <p className="text-sm text-slate-700 font-medium leading-relaxed italic">"{err.aiDiagnosis}"</p>
                                  
                                  {err.status === 'REQUIRES_CODE_CHANGE' && (
                                      <div className="flex gap-3 pt-2">
                                          <button 
                                              onClick={() => handleLaunchArchitect(err)}
                                              className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-black transition-all shadow-xl"
                                          >
                                              <Zap size={14} className="text-amber-400" />
                                              Deploy Architect Fix
                                          </button>
                                          <button 
                                              onClick={() => { navigator.clipboard.writeText(err.implementationPrompt || ''); alert("Directives copied."); }}
                                              className="px-6 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-[10px] uppercase hover:bg-slate-50"
                                          >
                                              <Copy size={14} />
                                          </button>
                                      </div>
                                  )}
                              </div>
                          )}
                      </div>
                  </div>
              ))
          ) : (
              <div className="bg-white rounded-[2rem] border shadow-sm overflow-hidden">
                  <div className="divide-y divide-slate-50">
                      {activities.map(act => (
                          <div key={act.id} className="p-4 flex items-center gap-6 hover:bg-slate-50 transition-colors">
                              <span className="text-[10px] font-black text-slate-400 min-w-[80px]">{new Date(act.timestamp).toLocaleTimeString()}</span>
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                              <div className="flex-1">
                                  <p className="text-xs font-bold text-slate-700">{act.details}</p>
                                  <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mt-0.5">{act.actionType}</p>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          )}
      </div>
    </div>
  );
};

export default ErrorLogPanel;
