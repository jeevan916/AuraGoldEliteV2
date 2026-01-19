
import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle, CheckCircle2, XCircle, Activity, Zap, 
  Terminal, ShieldCheck, HeartPulse, Search, Copy, 
  Wrench, Code, RefreshCw, Loader2, BrainCircuit
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

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      alert("Implementation Prompt Copied! Paste this into AI Studio to fix the bug.");
  };

  const handleReanalyze = (errorId: string) => {
      errorService.runIntelligentAnalysis(errorId);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 h-[calc(100vh-140px)] flex flex-col">
      {/* Intelligence Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
          <div className={`bg-white p-5 rounded-3xl border shadow-sm flex items-center gap-4 ${stats.codeFixCount > 0 ? 'border-rose-200 bg-rose-50' : ''}`}>
              <div className={`p-3 rounded-2xl ${stats.codeFixCount > 0 ? 'bg-white text-rose-600' : 'bg-slate-100 text-slate-500'}`}>
                  <Code />
              </div>
              <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">Codebase Health</p>
                  <p className="text-xl font-black text-slate-800">{stats.codeFixCount > 0 ? `${stats.codeFixCount} Fixes Needed` : 'Stable'}</p>
              </div>
          </div>
          <div className="bg-white p-5 rounded-3xl border shadow-sm flex items-center gap-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                  <Zap />
              </div>
              <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">Self-Healing</p>
                  <p className="text-xl font-black text-slate-800">{stats.autoFixedCount} Auto-Fixed</p>
              </div>
          </div>
          <div className="bg-white p-5 rounded-3xl border shadow-sm flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                  <Activity />
              </div>
              <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">Total Events</p>
                  <p className="text-xl font-black text-slate-800">{activities.length}</p>
              </div>
          </div>
      </div>

      {/* Tabs & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-2xl border shadow-sm gap-4 shrink-0">
        <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto">
            <button 
                onClick={() => setActiveTab('ERRORS')}
                className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'ERRORS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
                Diagnostic Center
            </button>
            <button 
                onClick={() => setActiveTab('ACTIVITY')}
                className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'ACTIVITY' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
                Activity Stream
            </button>
        </div>

        {activeTab === 'ERRORS' && (
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase mr-2">Filter:</span>
                <button 
                    onClick={() => setFilterMode('ACTION_REQUIRED')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${filterMode === 'ACTION_REQUIRED' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'}`}
                >
                    Action Needed
                </button>
                <button 
                    onClick={() => setFilterMode('ALL')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${filterMode === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}
                >
                    All Logs
                </button>
            </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
        
        {/* --- TAB: ERRORS --- */}
        {activeTab === 'ERRORS' && (
            <>
                {filteredErrors.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed rounded-3xl bg-slate-50/50 py-20">
                    <CheckCircle2 size={48} className="mb-4 text-emerald-200" />
                    <p className="font-black uppercase tracking-widest text-sm">System Healthy</p>
                    <p className="text-xs text-slate-400 mt-2">No active issues requiring attention.</p>
                </div>
                )}

                {filteredErrors.map(err => (
                <div key={err.id} className={`bg-white rounded-2xl border-l-4 shadow-sm overflow-hidden animate-fadeIn transition-all hover:shadow-md ${
                    err.status === 'AUTO_FIXED' ? 'border-l-emerald-500' : 
                    err.status === 'REQUIRES_CODE_CHANGE' ? 'border-l-rose-500' : 
                    err.status === 'ANALYZING' ? 'border-l-indigo-500' : 'border-l-amber-500'
                }`}>
                    <div className="p-5">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full ${
                                    err.status === 'AUTO_FIXED' ? 'bg-emerald-100 text-emerald-700' :
                                    err.status === 'REQUIRES_CODE_CHANGE' ? 'bg-rose-100 text-rose-700' :
                                    err.status === 'ANALYZING' ? 'bg-indigo-100 text-indigo-700 animate-pulse' :
                                    'bg-amber-100 text-amber-700'
                                }`}>
                                    {err.status.replace(/_/g, ' ')}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400">{err.source} • {new Date(err.timestamp).toLocaleTimeString()}</span>
                            </div>
                            
                            {err.status !== 'ANALYZING' && (
                                <button 
                                    onClick={() => handleReanalyze(err.id)}
                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                    title="Deep Analysis with Gemini 2.5"
                                >
                                    <BrainCircuit size={18} />
                                </button>
                            )}
                        </div>

                        <div className="flex flex-col gap-4">
                            {/* The Error */}
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs font-mono text-slate-600 break-all">
                                {err.message}
                            </div>

                            {/* The Solution (AI Driven) */}
                            {err.aiDiagnosis && (
                                <div className={`p-4 rounded-xl border flex flex-col gap-3 ${
                                    err.status === 'AUTO_FIXED' ? 'bg-emerald-50/50 border-emerald-100' : 'bg-indigo-50/50 border-indigo-100'
                                }`}>
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 bg-white rounded-lg shadow-sm text-indigo-600">
                                            {err.status === 'ANALYZING' ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-[10px] font-black uppercase text-indigo-400 tracking-widest mb-1">AI Diagnosis</p>
                                            <p className="text-sm font-bold text-slate-800">{err.aiDiagnosis}</p>
                                            {err.aiFixApplied && (
                                                <p className="text-xs text-emerald-600 font-bold mt-1 flex items-center gap-1">
                                                    <CheckCircle2 size={12} /> {err.aiFixApplied}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* THE GOLDEN FEATURE: Implementation Prompt */}
                                    {err.status === 'REQUIRES_CODE_CHANGE' && err.implementationPrompt && (
                                        <div className="mt-2 bg-white border border-indigo-200 rounded-xl overflow-hidden">
                                            <div className="bg-indigo-100 px-3 py-2 flex justify-between items-center">
                                                <span className="text-[9px] font-black uppercase text-indigo-700 flex items-center gap-1">
                                                    <Terminal size={10} /> AI Implementation Prompt
                                                </span>
                                                <button 
                                                    onClick={() => copyToClipboard(err.implementationPrompt!)}
                                                    className="text-[9px] font-bold bg-white px-2 py-1 rounded text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                                                >
                                                    <Copy size={10} /> Copy Fix
                                                </button>
                                            </div>
                                            <div className="p-3 text-[10px] font-mono text-slate-600 leading-relaxed whitespace-pre-wrap max-h-32 overflow-y-auto">
                                                {err.implementationPrompt}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                ))}
            </>
        )}

        {/* --- TAB: ACTIVITY --- */}
        {activeTab === 'ACTIVITY' && (
            <div className="space-y-2">
                {activities.map(act => (
                    <div key={act.id} className="flex gap-4 items-center p-3 bg-white border border-slate-100 rounded-xl hover:border-slate-200 transition-all">
                        <div className="text-[10px] font-mono text-slate-400 min-w-[60px]">{new Date(act.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                        <div className="w-px h-8 bg-slate-100"></div>
                        <div>
                            <p className="text-xs font-bold text-slate-700">{act.details}</p>
                            <span className="text-[9px] font-black uppercase text-slate-300 tracking-widest">{act.actionType}</span>
                        </div>
                    </div>
                ))}
            </div>
        )}

      </div>
    </div>
  );
};

export default ErrorLogPanel;
