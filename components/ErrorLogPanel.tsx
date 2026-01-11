
import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle, RefreshCw, CheckCircle2, XCircle, 
  Activity, Zap, ShieldAlert, Terminal, FileText, ClipboardList, 
  Sparkles, Loader2, PlayCircle, ShieldCheck, HeartPulse, Search, Filter, Info, AlertCircle, ArrowRight, Wrench
} from 'lucide-react';
import { AppError, ActivityLogEntry, AppResolutionPath } from '../types';
import { geminiService } from '../services/geminiService';
import { whatsappService } from '../services/whatsappService';

interface ErrorLogPanelProps {
  errors: AppError[];
  onClear: () => void;
  onResolveAction?: (path: AppResolutionPath) => void;
  activities?: ActivityLogEntry[];
}

const ErrorLogPanel: React.FC<ErrorLogPanelProps> = ({ errors, onClear, onResolveAction, activities = [] }) => {
  const [activeTab, setActiveTab] = useState<'ERRORS' | 'ACTIVITY'>('ERRORS');
  const [analyzingActivity, setAnalyzingActivity] = useState(false);
  const [isPatching, setIsPatching] = useState<string | null>(null);
  const [improvementSuggestion, setImprovementSuggestion] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState({ CRITICAL: true, MEDIUM: true, LOW: true });

  const filteredErrors = useMemo(() => {
      return errors.filter(err => {
          const matchesQuery = err.source.toLowerCase().includes(searchQuery.toLowerCase()) || 
                               err.message.toLowerCase().includes(searchQuery.toLowerCase());
          const matchesSeverity = severityFilter[err.severity as keyof typeof severityFilter];
          return matchesQuery && matchesSeverity;
      });
  }, [errors, searchQuery, severityFilter]);

  const filteredActivities = useMemo(() => {
      return activities.filter(act => 
          act.details.toLowerCase().includes(searchQuery.toLowerCase()) || 
          act.actionType.toLowerCase().includes(searchQuery.toLowerCase())
      );
  }, [activities, searchQuery]);

  const stats = useMemo(() => {
      const criticalCount = errors.filter(e => e.severity === 'CRITICAL' && e.status !== 'RESOLVED').length;
      const successRate = activities.length > 0 
          ? Math.round(((activities.length - errors.length) / activities.length) * 100) 
          : 100;
      return { criticalCount, successRate };
  }, [errors, activities]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'NEW': return 'bg-slate-100 text-slate-500';
      case 'ANALYZING': return 'bg-amber-100 text-amber-700 animate-pulse';
      case 'FIXING': return 'bg-blue-100 text-blue-700 animate-pulse';
      case 'RESOLVED': return 'bg-emerald-100 text-emerald-700';
      case 'UNRESOLVABLE': return 'bg-rose-100 text-rose-700';
      default: return 'bg-slate-100';
    }
  };

  const applyAiPatch = async (errorId: string, fixData: any) => {
      setIsPatching(errorId);
      try {
          if (fixData.name && fixData.content) {
              // Assume it's a WhatsApp Template Patch
              const payload: any = {
                  id: `patch-${Date.now()}`,
                  name: fixData.name,
                  content: fixData.content,
                  tactic: 'AUTHORITY',
                  targetProfile: 'REGULAR',
                  isAiGenerated: true,
                  source: 'LOCAL',
                  category: fixData.category || 'UTILITY',
                  variableExamples: fixData.examples
              };
              const res = await whatsappService.createMetaTemplate(payload);
              if (res.success) {
                  alert(`AI Patch Applied: ${res.finalName} deployed successfully.`);
              } else {
                  alert(`Patch Failed: ${res.error?.message}`);
              }
          } else {
              alert("Unsupported patch data format. Please use manual resolution.");
          }
      } catch (e: any) {
          alert(`Patch Exception: ${e.message}`);
      } finally {
          setIsPatching(null);
      }
  };

  const handleImproveApp = async () => {
      setAnalyzingActivity(true);
      setImprovementSuggestion(null);
      try {
          const result = await geminiService.analyzeSystemLogsForImprovements(activities);
          setImprovementSuggestion(result);
      } catch (e) {
          console.error(e);
      } finally {
          setAnalyzingActivity(false);
      }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 h-[calc(100vh-140px)] flex flex-col">
      {/* Health Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
          <div className="bg-white p-5 rounded-3xl border shadow-sm flex items-center gap-4">
              <div className={`p-3 rounded-2xl ${stats.criticalCount > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  {stats.criticalCount > 0 ? <AlertTriangle /> : <ShieldCheck />}
              </div>
              <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">System Health</p>
                  <p className="text-xl font-black text-slate-800">{stats.criticalCount > 0 ? `${stats.criticalCount} Active Alerts` : 'Fully Secure'}</p>
              </div>
          </div>
          <div className="bg-white p-5 rounded-3xl border shadow-sm flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                  <HeartPulse />
              </div>
              <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">Success Reliability</p>
                  <p className="text-xl font-black text-slate-800">{stats.successRate}% Success Rate</p>
              </div>
          </div>
          <div className="bg-white p-5 rounded-3xl border shadow-sm flex items-center gap-4">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                  <Activity />
              </div>
              <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">AI Intelligence</p>
                  <p className="text-xl font-black text-slate-800">2.5 Flash Lite Active</p>
              </div>
          </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-2xl border shadow-sm gap-4 shrink-0">
        <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto">
            <button 
                onClick={() => setActiveTab('ERRORS')}
                className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'ERRORS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
                Error Ledger
            </button>
            <button 
                onClick={() => setActiveTab('ACTIVITY')}
                className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'ACTIVITY' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
                Activity Feed
            </button>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input 
                    type="text" 
                    placeholder="Search ledger..." 
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />
            </div>
            <button onClick={onClear} className="text-xs font-black text-slate-400 hover:text-rose-500 uppercase tracking-widest border px-3 py-2 rounded-xl transition-colors">
                Wipe History
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
        
        {/* --- TAB: ERRORS --- */}
        {activeTab === 'ERRORS' && (
            <>
                {filteredErrors.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed rounded-3xl bg-slate-50/50 py-20">
                    <CheckCircle2 size={48} className="mb-4 text-emerald-200" />
                    <p className="font-black uppercase tracking-widest text-sm">System Healthy</p>
                </div>
                )}

                {filteredErrors.map(err => (
                <div key={err.id} className={`bg-white rounded-2xl border-l-4 shadow-sm overflow-hidden animate-fadeIn transition-all hover:shadow-md ${
                    err.severity === 'CRITICAL' ? 'border-l-rose-500' : err.severity === 'MEDIUM' ? 'border-l-amber-500' : 'border-l-blue-400'
                }`}>
                    <div className="p-5 flex flex-col md:flex-row gap-6">
                        <div className="flex flex-col items-center gap-2 min-w-[100px] border-r pr-6 border-slate-100">
                            <div className={`p-3 rounded-2xl ${
                                err.status === 'RESOLVED' ? 'bg-emerald-50 text-emerald-600' : 
                                err.status === 'UNRESOLVABLE' ? 'bg-rose-50 text-rose-600' :
                                'bg-amber-50 text-amber-600'
                            }`}>
                                {err.status === 'RESOLVED' ? <CheckCircle2 size={24} /> : 
                                err.status === 'UNRESOLVABLE' ? <XCircle size={24} /> :
                                <Activity size={24} className={err.status === 'ANALYZING' || err.status === 'FIXING' ? 'animate-spin' : ''} />
                                }
                            </div>
                            <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full text-center w-full ${getStatusColor(err.status)}`}>
                                {err.status}
                            </span>
                        </div>

                        <div className="flex-1 space-y-3">
                            <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-black text-slate-800 uppercase tracking-tight text-sm">{err.source}</h3>
                                <span className="text-[9px] font-black text-slate-400">{new Date(err.timestamp).toLocaleString()}</span>
                            </div>

                            <div className="bg-slate-900 text-emerald-400 p-4 rounded-xl font-mono text-xs leading-relaxed break-all shadow-inner border border-slate-800">
                                {err.message}
                            </div>

                            {/* AI Component */}
                            {(err.aiDiagnosis) && (
                                <div className="bg-gradient-to-r from-amber-50/50 to-white border border-amber-100 rounded-2xl p-4 mt-2">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Zap size={14} className="text-amber-500 fill-amber-500" />
                                        <span className="text-[10px] font-black uppercase text-amber-700 tracking-widest">AI Intelligence Recovery</span>
                                    </div>
                                    <p className="text-xs text-slate-700 font-medium leading-relaxed">
                                        <span className="font-black text-slate-900 uppercase text-[9px] mr-1">[DIAGNOSIS]</span> {err.aiDiagnosis}
                                    </p>
                                    
                                    {/* Instant AI Patch Button */}
                                    {err.suggestedFixData && (
                                        <div className="mt-4 p-3 bg-white border border-amber-200 rounded-xl flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 bg-amber-100 text-amber-600 rounded-lg">
                                                    <Wrench size={14} />
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-600">AI has prepared an instant patch.</span>
                                            </div>
                                            <button 
                                                onClick={() => applyAiPatch(err.id, err.suggestedFixData)}
                                                disabled={isPatching === err.id}
                                                className="bg-slate-900 text-white px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2"
                                            >
                                                {isPatching === err.id ? <Loader2 className="animate-spin" size={12}/> : <Zap size={12} fill="currentColor"/>}
                                                {isPatching === err.id ? 'Deploying...' : 'Deploy Instant Fix'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        
                        <div className="flex flex-col gap-2 min-w-[140px]">
                            {err.resolutionPath && err.resolutionPath !== 'none' && (
                                <button 
                                    onClick={() => onResolveAction && onResolveAction(err.resolutionPath!)}
                                    className="bg-emerald-600 text-white p-3 rounded-xl hover:bg-emerald-700 transition-all flex flex-col items-center justify-center gap-1 group shadow-lg"
                                >
                                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                    <span className="text-[9px] font-black uppercase tracking-widest">{err.resolutionCTA || 'Open Module'}</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
                ))}
            </>
        )}

        {/* --- TAB: ACTIVITY --- */}
        {activeTab === 'ACTIVITY' && (
            <div className="space-y-4">
                {filteredActivities.map(act => (
                    <div key={act.id} className="flex gap-4 items-center p-4 bg-white border border-slate-100 rounded-2xl hover:border-amber-200 transition-all">
                        <div className="p-2.5 bg-slate-50 text-slate-400 rounded-xl"><Terminal size={14} /></div>
                        <div className="flex-1 flex flex-col md:flex-row md:items-center justify-between gap-2">
                            <div>
                                <p className="text-sm text-slate-700 font-bold">{act.details}</p>
                                <span className="text-[9px] font-black uppercase text-slate-400">{new Date(act.timestamp).toLocaleTimeString()}</span>
                            </div>
                            {act.metadata && (
                                <div className="text-[10px] text-slate-400 font-mono bg-slate-50 px-2 py-1 rounded border">
                                    {JSON.stringify(act.metadata)}
                                </div>
                            )}
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
