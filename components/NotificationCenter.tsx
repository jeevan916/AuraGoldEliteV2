import React, { useState, useEffect, useMemo } from 'react';
import { Send, CheckCircle, Clock, AlertCircle, MessageSquare, Zap, Loader2, BrainCircuit, TrendingUp, Smartphone, FileText, Sparkles, RefreshCw, Play, Pause, Activity, ShieldAlert, CheckCheck, History, Shield, Scale, Calendar, ChevronRight, Check } from 'lucide-react';
import { NotificationTrigger, CollectionTone, Customer, RiskProfile, Order } from '../types';
import { whatsappService } from '../services/whatsappService';
import { geminiService } from '../services/geminiService';
import { storageService } from '../services/storageService';
import { strategyEngine, StrategyWorkerLog, DEFAULT_INBUILT_RULES, DEFAULT_TERMS_AND_CONDITIONS } from '../services/strategyEngine';

interface NotificationCenterProps {
  notifications?: NotificationTrigger[];
  customers?: Customer[];
  onSend?: (id: string, channel: 'WHATSAPP' | 'SMS') => void;
  onRefresh?: () => void;
  loading?: boolean;
  isSending?: string | null;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ 
  notifications: propsNotifications = [], 
  customers = [], 
  onSend, 
  onRefresh, 
  loading = false, 
  isSending 
}) => {
  const [activeTab, setActiveTab] = useState<'CONSOLE' | 'TERMS_AND_RULES'>('CONSOLE');
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'SENT'>('PENDING');
  const [channelOverride, setChannelOverride] = useState<'AUTO' | 'WHATSAPP' | 'SMS'>('AUTO');
  const [sendingState, setSendingState] = useState<string | null>(null);
  const [strategies, setStrategies] = useState<Record<string, any>>({});
  const [sentTriggerIds, setSentTriggerIds] = useState<Set<string>>(new Set());

  // --- BACKGROUND WORKER & DAILY 12 PM SCAN STATE ---
  const [isWorkerActive, setIsWorkerActive] = useState<boolean>(true);
  const [lastWorkerRun, setLastWorkerRun] = useState<string | null>(null);
  const [workerLogs, setWorkerLogs] = useState<StrategyWorkerLog[]>([]);
  const [isExecutingSweep, setIsExecutingSweep] = useState<boolean>(false);
  const [dailyScanInfo, setDailyScanInfo] = useState(strategyEngine.getDailyScanInfo());

  // Load orders and settings dynamically from storage
  const [orders, setOrders] = useState<Order[]>(() => storageService.getOrders());
  const settings = useMemo(() => storageService.getSettings(), []);

  // Compute live triggers from active orders using Strategy Engine
  const liveTriggers = useMemo(() => {
    const computed = strategyEngine.evaluatePaymentTriggers(orders, settings);
    // Combine with prop triggers if any exist
    const combined = [...computed];
    propsNotifications.forEach(pn => {
      if (!combined.some(c => c.id === pn.id)) {
        combined.push(pn);
      }
    });
    return combined.map(t => ({
      ...t,
      sent: sentTriggerIds.has(t.id) || t.sent
    }));
  }, [orders, settings, propsNotifications, sentTriggerIds]);

  const refreshOrderContext = () => {
    const freshOrders = storageService.getOrders();
    setOrders(freshOrders);
    setDailyScanInfo(strategyEngine.getDailyScanInfo());
    if (onRefresh) onRefresh();
  };

  // --- AUTOMATED TICKER FOR 30s SWEEPS + DAILY 12:00 PM AUTO SCAN ---
  useEffect(() => {
    if (!isWorkerActive) return;

    const runTicker = async () => {
      try {
        const fresh = storageService.getOrders();

        // 1. Check & execute Daily 12:00 PM Scan if time has arrived
        const autoScanRes = await strategyEngine.checkAndRun12PmAutoScan(fresh, settings);
        if (autoScanRes.didRun && autoScanRes.results) {
          setDailyScanInfo(strategyEngine.getDailyScanInfo());
          setLastWorkerRun(`12:00 PM Daily Scan (${new Date().toLocaleTimeString()})`);
          if (autoScanRes.results.logs.length > 0) {
            setWorkerLogs(prev => [...autoScanRes.results.logs, ...prev].slice(0, 40));
          }
          refreshOrderContext();
          return;
        }

        // 2. Standard worker cycle sweep
        setIsExecutingSweep(true);
        const sweepResult = await strategyEngine.runWorkerSweep(fresh, settings, 'WORKER_TICK');
        setLastWorkerRun(new Date().toLocaleTimeString());
        if (sweepResult.logs.length > 0) {
          setWorkerLogs(prev => [...sweepResult.logs, ...prev].slice(0, 40));
        }
      } catch (err) {
        console.error("[StrategyWorker] Error in background worker cycle:", err);
      } finally {
        setIsExecutingSweep(false);
      }
    };

    // Run ticker immediately and every 20 seconds
    runTicker();
    const interval = setInterval(runTicker, 20000);
    return () => clearInterval(interval);
  }, [isWorkerActive, settings]);

  const handleManualSweep = async () => {
    setIsExecutingSweep(true);
    try {
      const fresh = storageService.getOrders();
      setOrders(fresh);
      const sweepResult = await strategyEngine.runWorkerSweep(fresh, settings, 'MANUAL_SWEEP');
      setLastWorkerRun(`Manual (${new Date().toLocaleTimeString()})`);
      setWorkerLogs(prev => [...sweepResult.logs, ...prev].slice(0, 40));
      setDailyScanInfo(strategyEngine.getDailyScanInfo());
      alert(`Manual Collection Scan Complete!\nEvaluated: ${sweepResult.evaluatedCount} active order milestones.\nDispatched: ${sweepResult.dispatchedCount} reminders.`);
    } catch (err: any) {
      alert(`Manual Scan Error: ${err.message}`);
    } finally {
      setIsExecutingSweep(false);
    }
  };

  const filtered = liveTriggers.filter(n => 
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
          const freshOrders = storageService.getOrders();
          const targetOrder = freshOrders.find(o => o.customerContact === notif.customerContact || o.id === notif.orderId);
          
          if (!targetOrder) throw new Error("Order context missing");

          const strategy = await geminiService.generateStrategicNotification(
              targetOrder,
              notif.type,
              settings.currentGoldRate22K,
              getCustomerGrade(notif.customerName)
          );

          setStrategies(prev => ({ ...prev, [notif.id]: strategy }));
          alert(`Inbuilt / AI Strategy Generated!\nTone: ${strategy.tone}\nReasoning: ${strategy.reasoning}`);
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
              const res = await strategyEngine.dispatchTrigger(notif);
              if (res.success) {
                  setSentTriggerIds(prev => new Set(prev).add(notif.id));
                  if (onSend) onSend(notif.id, 'WHATSAPP');
                  alert(`WhatsApp Message Dispatched: ${res.message}`);
              } else {
                  alert(`WhatsApp Failed: ${res.error}`);
              }
          } else {
              setSentTriggerIds(prev => new Set(prev).add(notif.id));
              if (onSend) onSend(notif.id, 'SMS');
              alert(`SMS Notification Queued for ${notif.customerContact}`);
          }
      } catch (e: any) {
          console.error(e);
          alert(`Dispatch Error: ${e.message}`);
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
    <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn pb-24 px-2 sm:px-0">
      {/* HEADER BANNER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-[2rem] border shadow-sm border-l-8 border-l-emerald-600 gap-4 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
              <Shield size={10} /> Standalone Inbuilt Rules Engine
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center gap-1">
              <Calendar size={10} /> Daily 12 PM Auto Scan
            </span>
          </div>
          <h2 className="text-xl font-black flex items-center gap-2 text-slate-800 uppercase tracking-tight">
            <BrainCircuit className="text-emerald-600" /> Collection Strategy Console
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
             Inbuilt Rules & Rate Protection Terms • Auto Scan Daily at 12:00 PM • Manual Scan Anytime.
          </p>
        </div>
        
        {/* VIEW TAB TOGGLE */}
        <div className="flex items-center gap-2 z-10 flex-wrap">
          <div className="bg-slate-100 p-1 rounded-xl flex gap-1 border">
            <button
              onClick={() => setActiveTab('CONSOLE')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${activeTab === 'CONSOLE' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <Zap size={12} /> Active Console
            </button>
            <button
              onClick={() => setActiveTab('TERMS_AND_RULES')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${activeTab === 'TERMS_AND_RULES' ? 'bg-emerald-700 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <Scale size={12} /> Inbuilt Rules & T&C
            </button>
          </div>

          <button 
            onClick={refreshOrderContext}
            className={`bg-slate-100 text-slate-700 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-200 transition-all border border-slate-200 ${loading ? 'animate-pulse' : ''}`}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} 
            Refresh
          </button>
        </div>
        
        <div className="absolute right-[-10%] top-[-20%] opacity-5 pointer-events-none">
            <BrainCircuit size={200} />
        </div>
      </div>

      {activeTab === 'TERMS_AND_RULES' ? (
        /* INBUILT RULES & TERMS AND CONDITIONS VIEW */
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-emerald-900 to-slate-900 text-white p-6 rounded-[2rem] shadow-xl space-y-4 relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-emerald-800/60 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
                  <Scale size={24} />
                </div>
                <div>
                  <h3 className="font-black text-base uppercase tracking-wide text-white">Inbuilt Rules & Collection Policy T&C</h3>
                  <p className="text-xs text-emerald-200/80">
                    Deterministic collection logic and rate protection terms running locally without relying on external Google AI services.
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-500/30">
                100% Offline Ready
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="bg-slate-900/80 p-4 rounded-xl border border-emerald-800/40 space-y-2">
                <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider block">Policy Version</span>
                <span className="text-sm font-bold text-white block">{DEFAULT_TERMS_AND_CONDITIONS.version}</span>
                <p className="text-[11px] text-slate-400">Effective Date: {DEFAULT_TERMS_AND_CONDITIONS.effectiveDate}</p>
              </div>
              <div className="bg-slate-900/80 p-4 rounded-xl border border-emerald-800/40 space-y-2">
                <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider block">Daily Scan Commitment</span>
                <span className="text-sm font-bold text-white block">Automated Daily Sweep at 12:00 PM IST</span>
                <p className="text-[11px] text-slate-400">Evaluates promise dates, grace periods & rate protection warnings natively.</p>
              </div>
            </div>
          </div>

          {/* INBUILT STRATEGY RULES TABLE */}
          <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-black text-slate-800 text-sm uppercase tracking-wide flex items-center gap-2">
                  <Zap className="text-amber-500" size={18} /> Inbuilt Collection Strategy Rules
                </h3>
                <p className="text-xs text-slate-500">
                  Automated deterministic rules mapping payment milestone conditions to Meta WhatsApp templates.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {DEFAULT_INBUILT_RULES.map((rule) => (
                <div key={rule.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 hover:border-emerald-300 transition-all">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-900 text-white">
                        {rule.id}
                      </span>
                      <h4 className="font-bold text-slate-800 text-sm">{rule.name}</h4>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${getToneStyle(rule.tone)}`}>
                        {rule.tone}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 font-medium">
                      <strong className="text-slate-800">Condition:</strong> {rule.condition}
                    </p>
                    <p className="text-xs text-slate-500">
                      {rule.actionSummary}
                    </p>
                  </div>

                  <div className="flex flex-col items-start md:items-end gap-1 shrink-0 text-right">
                    <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 flex items-center gap-1">
                      <FileText size={10} /> {rule.templateId}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      Linked: {rule.termsClause}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* TERMS & CONDITIONS CLAUSES */}
          <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
            <div>
              <h3 className="font-black text-slate-800 text-sm uppercase tracking-wide flex items-center gap-2">
                <Shield className="text-emerald-600" size={18} /> Gold Rate Protection Terms & Conditions Clauses
              </h3>
              <p className="text-xs text-slate-500">
                Official terms governing Gold Rate Locks, Grace Periods, Overdue Surcharges, and 12:00 PM Daily Scans.
              </p>
            </div>

            <div className="space-y-3">
              {DEFAULT_TERMS_AND_CONDITIONS.clauses.map((clause) => (
                <div key={clause.id} className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-emerald-800 bg-emerald-200 px-2 py-0.5 rounded">
                      {clause.id}
                    </span>
                    <h4 className="font-bold text-slate-900 text-sm">{clause.title}</h4>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed pl-1">
                    {clause.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* ACTIVE CONSOLE VIEW */
        <>
          {/* AUTOMATED DAILY 12 PM SCAN & WORKER PANEL */}
          <div className="bg-slate-900 text-white p-6 rounded-[2rem] shadow-xl space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl ${isWorkerActive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'}`}>
                  <Activity className={isWorkerActive ? 'animate-pulse' : ''} size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-black text-sm uppercase tracking-wider text-white">Automated Collection Worker</h3>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${isWorkerActive ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                      {isWorkerActive ? 'ACTIVE (20s Check)' : 'PAUSED'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-indigo-600 text-white flex items-center gap-1">
                      <Clock size={10} /> Daily 12:00 PM Scan
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Evaluates payment milestones against promise dates, rate protection locks, and dispatches Meta WhatsApp templates.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                <button
                  onClick={() => setIsWorkerActive(!isWorkerActive)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-md ${isWorkerActive ? 'bg-amber-500 hover:bg-amber-600 text-slate-950' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
                >
                  {isWorkerActive ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Resume</>}
                </button>
                <button
                  onClick={handleManualSweep}
                  disabled={isExecutingSweep}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all disabled:opacity-50 shadow-md"
                >
                  {isExecutingSweep ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                  Scan Now (Manual Sweep)
                </button>
              </div>
            </div>

            {/* WORKER & 12 PM SCHEDULE METRICS */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Next Daily 12 PM Scan</span>
                <span className="font-black text-emerald-400 text-xs mt-0.5 flex items-center gap-1">
                  <Calendar size={12} /> {dailyScanInfo.nextScanTime}
                </span>
                <span className="text-[9px] text-slate-400 block mt-0.5">
                  {dailyScanInfo.hasRunToday ? '✓ Ran Today @ 12 PM' : 'Scheduled for 12:00 PM'}
                </span>
              </div>
              <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Active Triggers</span>
                <span className="font-black text-amber-400 text-sm mt-0.5 block">{liveTriggers.length} Evaluated</span>
              </div>
              <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Overdue Breaches</span>
                <span className="font-black text-rose-400 text-sm mt-0.5 block">
                  {liveTriggers.filter(t => t.type === 'OVERDUE').length} Breached
                </span>
              </div>
              <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Last Scan Sweep</span>
                <span className="font-black text-slate-300 text-xs mt-0.5 block">{lastWorkerRun || 'Pending...'}</span>
              </div>
            </div>

            {/* WORKER STREAM AUDIT LOGS */}
            {workerLogs.length > 0 && (
              <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 max-h-36 overflow-y-auto font-mono text-[11px] space-y-1">
                <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider block mb-1">Strategy Audit Log Stream</span>
                {workerLogs.map(log => (
                  <div key={log.id} className="flex items-center justify-between gap-2 border-b border-slate-900 pb-1 text-slate-300">
                    <span className="text-slate-500">{log.timestamp}</span>
                    <span className="font-bold text-amber-400">Order #{log.orderId}</span>
                    <span className="truncate max-w-[130px]">{log.customerName}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold ${log.source === '12PM_DAILY_SCAN' ? 'bg-indigo-900 text-indigo-200' : log.status === 'SENT' ? 'bg-emerald-900 text-emerald-300' : 'bg-rose-900 text-rose-300'}`}>
                      {log.source === '12PM_DAILY_SCAN' ? 'DAILY 12PM' : log.status}
                    </span>
                    <span className="text-slate-400 truncate max-w-[180px]">{log.templateName}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* FILTER CONTROLS */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-100 p-2 rounded-2xl">
              <div className="flex gap-1 bg-white p-1 rounded-xl shadow-sm w-full sm:w-auto">
                {(['PENDING', 'SENT', 'ALL'] as const).map(f => (
                  <button 
                    key={f} onClick={() => setFilter(f)}
                    className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${filter === f ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
                  >
                    {f} ({f === 'ALL' ? liveTriggers.length : f === 'SENT' ? liveTriggers.filter(t => t.sent).length : liveTriggers.filter(t => !t.sent).length})
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

          {/* NOTIFICATION TRIGGER CARDS LIST */}
          <div className="space-y-4">
            {filtered.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-3">
                <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto" />
                <h3 className="font-black text-slate-800 text-base uppercase">All Clean! No Pending Triggers</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  All payment promise dates and milestones are up to date. The strategy engine will continue monitoring active orders automatically every day at 12:00 PM.
                </p>
              </div>
            ) : (
              filtered.map(notif => {
                const strategy = strategies[notif.id];
                const activeChannel = channelOverride === 'AUTO' ? getRecommendedChannel(notif) : channelOverride;
                const busy = isSending === notif.id || sendingState === notif.id;
                
                return (
                <div key={notif.id} className={`bg-white p-6 rounded-[2.5rem] border-2 transition-all flex flex-col gap-4 ${notif.sent ? 'opacity-60 border-slate-100' : 'hover:border-emerald-400 border-slate-100 shadow-sm'}`}>
                  <div className="flex justify-between items-start gap-4 flex-wrap sm:flex-nowrap">
                    <div className="flex gap-4">
                      <div className={`p-4 rounded-2xl shrink-0 h-fit ${
                        notif.type === 'OVERDUE' ? 'bg-rose-50 text-rose-600' :
                        notif.type === 'UPCOMING' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
                      }`}>
                        {notif.type === 'OVERDUE' ? <AlertCircle size={24} /> : notif.type === 'UPCOMING' ? <Clock size={24} /> : <CheckCircle size={24} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-1 flex-wrap">
                          <h4 className="font-black text-slate-800 text-lg leading-tight">{notif.customerName}</h4>
                          {notif.orderId && (
                            <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">
                              Order #{notif.orderId}
                            </span>
                          )}
                          <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase border ${getToneStyle(strategy?.tone || notif.tone)}`}>
                              {(strategy?.tone || notif.tone || 'PENDING').replace('_', ' ')}
                          </span>
                          {notif.breachDays && notif.breachDays > 0 ? (
                            <span className="text-[9px] font-black bg-rose-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                              Overdue {notif.breachDays} Day(s)
                            </span>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500">
                            <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest">{notif.type} Event</span>
                            <div className="w-1 h-1 bg-slate-200 rounded-full"></div>
                            <span className="text-[10px] font-bold text-amber-600 uppercase">{getCustomerGrade(notif.customerName)} Profile</span>
                            {notif.dueAmount ? (
                              <>
                                <div className="w-1 h-1 bg-slate-200 rounded-full"></div>
                                <span className="font-black text-slate-900">Amount Due: ₹{Math.round(notif.dueAmount).toLocaleString('en-IN')}</span>
                              </>
                            ) : null}
                        </div>
                      </div>
                    </div>

                    {!notif.sent ? (
                      <div className="flex gap-2 shrink-0">
                          <button 
                              onClick={() => handleDeepScan(notif)}
                              disabled={busy}
                              className="p-3 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100 transition-all border border-amber-100 shadow-sm group flex items-center gap-1 text-[10px] font-bold uppercase"
                              title="Evaluate Inbuilt Rule & AI Strategy"
                          >
                              <Sparkles size={16} className="group-hover:scale-110 transition-transform" />
                              Scan Rule
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
                    ) : (
                      <div className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100 shrink-0">
                        <CheckCheck size={16} /> Dispatched
                      </div>
                    )}
                  </div>

                  {/* REASONING ENGINE BOX */}
                  <div className="bg-gradient-to-r from-slate-50 to-white p-4 rounded-2xl border border-slate-100 flex flex-col gap-2">
                     <div className="flex items-start gap-2">
                         <BrainCircuit className="text-emerald-600 shrink-0 mt-0.5" size={16} />
                         <div className="text-xs text-slate-600 font-medium leading-relaxed">
                            <span className="font-black text-slate-800 uppercase text-[9px] tracking-widest block mb-0.5">Strategy Engine Evaluation</span>
                            {strategy?.reasoning || notif.strategyReasoning || "Inbuilt Rule evaluation applied. Template matched automatically based on payment promise date and T&C grace period."}
                         </div>
                     </div>
                  </div>

                  {/* MESSAGE & TEMPLATE PREVIEW */}
                  <div className="relative group">
                      <div className="bg-white p-4 rounded-2xl text-sm text-slate-800 font-medium border-2 border-dashed border-slate-200 leading-relaxed group-hover:border-emerald-200 transition-colors">
                          "{strategy?.message || notif.message}"
                      </div>
                      {(strategy?.templateId || notif.templateName || notif.aiRecommendedTemplateId) && (
                          <div className="mt-2 flex items-center gap-2">
                              <span className="text-[10px] font-bold text-slate-400 uppercase">Meta Template:</span>
                              <span className="text-[10px] font-black uppercase font-mono tracking-wider bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-lg border border-blue-100 flex items-center gap-1">
                                <FileText size={10} />
                                {strategy?.templateId || notif.templateName || notif.aiRecommendedTemplateId}
                              </span>
                          </div>
                      )}
                  </div>
                </div>
              );
            }))}
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationCenter;
