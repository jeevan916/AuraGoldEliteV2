
import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, ShoppingBag, Users, ReceiptIndianRupee, 
  MessageSquare, Globe, Settings as SettingsIcon, AlertTriangle, 
  Plus, ShieldCheck, LogOut, Briefcase, Menu, X, ArrowLeft, Home,
  MoreHorizontal, PlusCircle, Sparkles, Zap, BrainCircuit, FileText, 
  ScrollText, Activity, Server, Calculator, Loader2, WifiOff, Cloud, CloudOff, RefreshCw, ServerCrash, Database, ShieldAlert, AlertCircle
} from 'lucide-react';

// Modules
import Dashboard from './components/Dashboard';
import OrderForm from './components/OrderForm';
import OrderDetails from './components/OrderDetails';
import CustomerList from './components/CustomerList';
import PaymentCollections from './components/PaymentCollections';
import WhatsAppPanel from './components/WhatsAppPanel';
import WhatsAppTemplates from './components/WhatsAppTemplates';
import WhatsAppLogs from './components/WhatsAppLogs';
import NotificationCenter from './components/NotificationCenter';
import PlanManager from './components/PlanManager';
import MarketIntelligence from './components/MarketIntelligence';
import Settings from './components/Settings';
import ErrorLogPanel from './components/ErrorLogPanel';
import { ErrorBoundary } from './components/ErrorBoundary';

// Hooks & Services
import { useOrders } from './hooks/useOrders';
import { useWhatsApp } from './hooks/useWhatsApp';
import { errorService } from './services/errorService';
import { goldRateService } from './services/goldRateService';
import { storageService } from './services/storageService';
import { geminiService } from './services/geminiService';
import { whatsappService } from './services/whatsappService';
import { Order, GlobalSettings, AppResolutionPath, Customer, NotificationTrigger, PaymentPlanTemplate } from './types';

type MainView = 'DASH' | 'ORDER_NEW' | 'ORDER_DETAILS' | 'CUSTOMERS' | 'COLLECTIONS' | 'WHATSAPP' | 'TEMPLATES' | 'PLANS' | 'LOGS' | 'STRATEGY' | 'MARKET' | 'SYS_LOGS' | 'SETTINGS' | 'MENU';

const TabBarItem = ({ icon, label, active, onClick }: any) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center gap-1 w-14 transition-all ${active ? 'text-amber-600' : 'text-slate-400 opacity-60'}`}
  >
    <div className={`p-1.5 rounded-xl ${active ? 'bg-amber-50' : ''}`}>
        {React.cloneElement(icon, { size: 22 })}
    </div>
    <span className={`text-[9px] font-black uppercase tracking-tighter ${active ? 'opacity-100' : 'opacity-80'}`}>{label}</span>
  </button>
);

const MenuItem = ({ icon, label, desc, onClick, colorClass }: any) => (
  <button 
    onClick={onClick}
    className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col gap-3 text-left active:scale-[0.98]"
  >
    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${colorClass}`}>
       {React.cloneElement(icon, { size: 24 })}
    </div>
    <div>
       <h3 className="font-bold text-slate-800 text-sm">{label}</h3>
       <p className="text-[10px] text-slate-500 font-medium leading-tight mt-1">{desc}</p>
    </div>
  </button>
);

const App: React.FC = () => {
  const [view, setView] = useState<MainView>('DASH');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<{ message: string; code?: number } | null>(null);
  const [syncStatus, setSyncStatus] = useState(storageService.getSyncStatus());
  
  const { orders, addOrder, recordPayment, updateItemStatus, updateOrder } = useOrders();
  const { logs, templates, addLog, setTemplates } = useWhatsApp();
  const [settings, setSettingsState] = useState<GlobalSettings>(storageService.getSettings());
  const [planTemplates, setPlanTemplates] = useState<PaymentPlanTemplate[]>(storageService.getPlanTemplates());

  const [notifications, setNotifications] = useState<NotificationTrigger[]>([]);
  const [isStrategyLoading, setStrategyLoading] = useState(false);
  const [sendingNotifId, setSendingNotifId] = useState<string | null>(null);

  const setSettings = (newSettings: GlobalSettings) => {
    setSettingsState(newSettings);
    storageService.setSettings(newSettings);
  };
  
  const handleUpdatePlans = (newPlans: PaymentPlanTemplate[]) => {
      setPlanTemplates(newPlans);
      storageService.setPlanTemplates(newPlans);
  };

  const [errors, setErrors] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);

  const startApp = async () => {
    setIsInitializing(true);
    setInitError(null);
    try {
      const result = await storageService.syncFromServer();
      if (!result.success) {
        setInitError({ message: result.error || "Handshake Failure", code: result.code });
        return;
      }
      
      // Secondary initialization
      const rateRes = await goldRateService.fetchLiveRate();
      if (rateRes.success) {
          const currentSettings = storageService.getSettings();
          setSettings({
              ...currentSettings,
              currentGoldRate24K: rateRes.rate24K,
              currentGoldRate22K: rateRes.rate22K
          });
      }
    } catch (e: any) {
      setInitError({ message: e.message || "Network Connectivity Failure" });
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    (window as any).dispatchView = (v: MainView) => setView(v);
    errorService.initGlobalListeners();
    
    const unsubStorage = storageService.subscribe(() => {
       setSettingsState(storageService.getSettings());
       setSyncStatus(storageService.getSyncStatus());
       setPlanTemplates(storageService.getPlanTemplates());
    });

    const unsubErrors = errorService.subscribe((errs, acts) => {
      setErrors(errs);
      setActivities(acts);
    });

    startApp();
    
    return () => {
      unsubStorage();
      unsubErrors();
    };
  }, []);

  const handleRunStrategy = async () => {
    setStrategyLoading(true);
    try {
        const triggers: NotificationTrigger[] = [];
        const overdueOrders = orders.filter(o => {
            const paid = o.payments.reduce((a,c) => a + c.amount, 0);
            return paid < o.totalAmount && o.paymentPlan.milestones.some(m => m.status !== 'PAID' && m.dueDate < new Date().toISOString());
        });

        for (const o of overdueOrders.slice(0, 5)) {
            const strat = await geminiService.generateStrategicNotification(o, 'OVERDUE', settings.currentGoldRate24K);
            triggers.push({
                id: `strat-${o.id}-${Date.now()}`,
                customerName: o.customerName,
                type: 'OVERDUE',
                message: strat.message || `Reminder: Payment pending for Order #${o.id}`,
                date: new Date().toISOString(),
                sent: false,
                tone: strat.tone || 'POLITE',
                strategyReasoning: strat.reasoning || 'Automated scheduled check.'
            });
        }
        setNotifications(triggers);
    } catch(e) {
        errorService.logError('AI Strategy', 'Failed to generate strategies', 'MEDIUM');
    } finally {
        setStrategyLoading(false);
    }
  };

  const handleSendNotification = async (id: string) => {
    setSendingNotifId(id);
    const notif = notifications.find(n => n.id === id);
    if (!notif) return setSendingNotifId(null);

    const order = orders.find(o => o.customerName === notif.customerName);
    if (order) {
        const res = await whatsappService.sendMessage(order.customerContact, notif.message, notif.customerName);
        if (res.success && res.logEntry) {
            addLog(res.logEntry);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, sent: true } : n));
        } else {
            alert("Failed to send: " + res.error);
        }
    }
    setSendingNotifId(null);
  };

  const customers = useMemo(() => {
    const map = new Map<string, Customer>();
    orders.forEach(o => {
      const key = o.customerContact;
      if (!map.has(key)) {
        map.set(key, {
          id: `CUST-${key}`,
          name: o.customerName,
          contact: key,
          email: o.customerEmail,
          orderIds: [o.id],
          totalSpent: o.payments.reduce((acc, p) => acc + p.amount, 0),
          joinDate: o.createdAt
        });
      } else {
        const c = map.get(key)!;
        c.orderIds.push(o.id);
        c.totalSpent += o.payments.reduce((acc, p) => acc + p.amount, 0);
      }
    });
    return Array.from(map.values());
  }, [orders]);

  const activeOrder = orders.find(o => o.id === selectedOrderId);

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <Loader2 className="animate-spin text-amber-500 mb-6" size={48} />
        <h2 className="text-xl font-black uppercase tracking-widest">AuraGold Elite</h2>
        <p className="text-slate-400 text-xs mt-2 font-medium">Authorizing Database Handshake...</p>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-900">
        <div className="max-w-xl w-full bg-white rounded-[2.5rem] shadow-2xl border-t-8 border-t-rose-600 p-8 md:p-12 animate-fadeIn">
          <div className="flex justify-between items-start mb-8">
            <div className="p-4 bg-rose-50 text-rose-600 rounded-3xl">
              <ShieldAlert size={40} />
            </div>
            <div className="bg-slate-100 px-4 py-2 rounded-2xl text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
              <Database size={14} /> Critical Error
            </div>
          </div>
          
          <h1 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">System Sync Failure</h1>
          <p className="text-slate-500 font-medium leading-relaxed mb-8">
            The application is in <strong>Strict Live Mode</strong>. It cannot function without a verified link to the MySQL backend.
          </p>

          <div className="bg-slate-900 text-rose-400 p-5 rounded-2xl font-mono text-xs leading-relaxed border border-slate-800 shadow-inner mb-8 overflow-auto max-h-40">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={14} className="text-rose-500" />
              <span className="font-bold uppercase text-[10px] text-white">Diagnosis Info:</span>
            </div>
            {initError.message}
            {initError.code && <div className="mt-1 opacity-50">HTTP Status: {initError.code}</div>}
          </div>

          <div className="space-y-4 mb-8">
            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Resolution Checklist</h3>
            <ul className="grid grid-cols-1 gap-2">
              <li className="flex items-start gap-3 text-xs font-bold text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="bg-slate-200 text-slate-600 w-5 h-5 rounded-md flex items-center justify-center shrink-0">1</span>
                Verify Node.js process is "Running" in Hostinger hPanel.
              </li>
              <li className="flex items-start gap-3 text-xs font-bold text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="bg-slate-200 text-slate-600 w-5 h-5 rounded-md flex items-center justify-center shrink-0">2</span>
                Check .env file for correct DB_HOST (usually 'localhost').
              </li>
              <li className="flex items-start gap-3 text-xs font-bold text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="bg-slate-200 text-slate-600 w-5 h-5 rounded-md flex items-center justify-center shrink-0">3</span>
                Check .htaccess in public_html for proper API routing.
              </li>
            </ul>
          </div>

          <button 
            onClick={startApp}
            className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"
          >
            <RefreshCw size={18} /> Retry Live Sync
          </button>
        </div>
        <p className="mt-8 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Node.js 20 • Express • MySQL Auth</p>
      </div>
    );
  }

  const getViewTitle = () => {
    switch(view) {
      case 'DASH': return 'Collection Queue';
      case 'ORDER_NEW': return 'New Booking';
      case 'ORDER_DETAILS': return 'Order Ledger';
      case 'CUSTOMERS': return 'Client Directory';
      case 'COLLECTIONS': return 'Revenue Recovery';
      case 'WHATSAPP': return 'Secure Chats';
      case 'STRATEGY': return 'AI Collection Strategy';
      case 'TEMPLATES': return 'Template Architect';
      case 'PLANS': return 'Payment Schemes';
      case 'LOGS': return 'Communication Logs';
      case 'MARKET': return 'Market Intelligence';
      case 'SYS_LOGS': return 'System Diagnostics';
      case 'SETTINGS': return 'System Settings';
      case 'MENU': return 'Command Center';
      default: return 'AuraGold';
    }
  };

  return (
    <ErrorBoundary>
      <div className="flex h-[100dvh] overflow-hidden bg-[#F3F4F6] text-slate-900">
        <main className="flex-1 flex flex-col h-full relative w-full overflow-hidden">
          <header className="bg-white border-b px-4 py-4 flex items-center justify-between z-40 sticky top-0 shadow-sm">
             <div className="flex items-center gap-3">
               {view !== 'DASH' ? (
                 <button onClick={() => setView('DASH')} className="p-1 text-slate-900 active:scale-90 transition-transform">
                    <ArrowLeft size={24} />
                 </button>
               ) : (
                  <button onClick={() => setView('MENU')} className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center shadow-lg active:scale-90 transition-transform relative">
                    <Menu size={20} className="text-white" />
                  </button>
               )}
               <div>
                    <h1 className="text-xl font-black tracking-tight text-slate-900 truncate max-w-[200px] leading-tight">{getViewTitle()}</h1>
                    <div className="flex items-center gap-1">
                        {syncStatus === 'CONNECTED' ? (
                            <span className="text-[8px] font-black uppercase text-emerald-600 flex items-center gap-1">
                                <Cloud size={10} /> Database Link Active
                            </span>
                        ) : (
                            <span className="text-[8px] font-black uppercase text-blue-600 flex items-center gap-1">
                                <Loader2 size={10} className="animate-spin" /> Syncing...
                            </span>
                        )}
                    </div>
               </div>
             </div>
             <div className="flex items-center gap-3">
                 <button onClick={()=>setView('SETTINGS')} className="p-2 text-slate-400 active:rotate-90 transition-all"><SettingsIcon size={20}/></button>
                 {view === 'DASH' && (
                    <button onClick={() => setView('ORDER_NEW')} className="w-11 h-11 bg-amber-600 text-white rounded-2xl flex items-center justify-center shadow-xl active:scale-90 transition-transform">
                      <Plus size={28} />
                    </button>
                 )}
             </div>
          </header>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 lg:p-10 w-full pb-[120px]">
            <div className="max-w-4xl mx-auto">
              {view === 'DASH' && <Dashboard orders={orders} currentRates={{ k24: settings.currentGoldRate24K, k22: settings.currentGoldRate22K }} />}
              {view === 'MENU' && (
                <div className="animate-fadeIn">
                   <div className="mb-6">
                      <h2 className="text-2xl font-black text-slate-800">Apps & Tools</h2>
                      <p className="text-sm text-slate-500 font-medium">Manage automation, templates, and system health.</p>
                   </div>
                   <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <MenuItem icon={<BrainCircuit />} label="AI Strategy" desc="Automated Collection Engine" colorClass="bg-amber-100 text-amber-600" onClick={() => setView('STRATEGY')} />
                      <MenuItem icon={<Calculator />} label="Plan Manager" desc="AI Payment Schemes" colorClass="bg-violet-100 text-violet-600" onClick={() => setView('PLANS')} />
                      <MenuItem icon={<FileText />} label="Templates" desc="Meta WhatsApp Manager" colorClass="bg-blue-100 text-blue-600" onClick={() => setView('TEMPLATES')} />
                      <MenuItem icon={<ScrollText />} label="Message Logs" desc="Audit Communication History" colorClass="bg-emerald-100 text-emerald-600" onClick={() => setView('LOGS')} />
                      <MenuItem icon={<Globe />} label="Market Intel" desc="Live Rates & Charts" colorClass="bg-indigo-100 text-indigo-600" onClick={() => setView('MARKET')} />
                      <MenuItem icon={<Activity />} label="System Logs" desc="Diagnostics & Repair" colorClass="bg-slate-100 text-slate-600" onClick={() => setView('SYS_LOGS')} />
                      <MenuItem icon={<SettingsIcon />} label="Settings" desc="Global Configuration" colorClass="bg-gray-100 text-gray-600" onClick={() => setView('SETTINGS')} />
                   </div>
                </div>
              )}
              {view === 'ORDER_NEW' && <OrderForm settings={settings} planTemplates={planTemplates} onSubmit={(o) => { addOrder(o); setView('ORDER_DETAILS'); setSelectedOrderId(o.id); }} onCancel={() => setView('DASH')} />}
              {view === 'ORDER_DETAILS' && (activeOrder ? <OrderDetails order={activeOrder} settings={settings} onBack={() => setView('DASH')} onUpdateStatus={(itemId, status) => updateItemStatus(activeOrder.id, itemId, status)} onRecordPayment={recordPayment} onOrderUpdate={updateOrder} logs={logs} onAddLog={addLog} /> : <div className="text-center py-20 text-slate-400 font-medium">Please select an order.</div>)}
              {view === 'CUSTOMERS' && <CustomerList customers={customers} orders={orders} onViewOrder={(id)=>{setSelectedOrderId(id); setView('ORDER_DETAILS');}} onMessageSent={addLog} />}
              {view === 'COLLECTIONS' && <PaymentCollections orders={orders} onViewOrder={(id)=>{setSelectedOrderId(id); setView('ORDER_DETAILS');}} onSendWhatsApp={()=>{}} settings={settings} />}
              {view === 'STRATEGY' && <NotificationCenter notifications={notifications} onRefresh={handleRunStrategy} loading={isStrategyLoading} onSend={handleSendNotification} isSending={sendingNotifId} />}
              {view === 'TEMPLATES' && <WhatsAppTemplates templates={templates} onUpdate={setTemplates} />}
              {view === 'PLANS' && <PlanManager templates={planTemplates} onUpdate={handleUpdatePlans} />}
              {view === 'LOGS' && <WhatsAppLogs logs={logs} onViewChat={(phone) => { setView('WHATSAPP'); (window as any).initialChatContact = phone; }} />}
              {view === 'WHATSAPP' && <WhatsAppPanel logs={logs} customers={customers} onRefreshStatus={() => {}} templates={templates} onAddLog={addLog} initialContact={(window as any).initialChatContact} />}
              {view === 'MARKET' && <MarketIntelligence />}
              {view === 'SYS_LOGS' && <ErrorLogPanel errors={errors} onClear={() => errorService.clearErrors()} activities={activities} onResolveAction={(path) => path !== 'none' && (path === 'whatsapp' ? setView('WHATSAPP') : path === 'templates' ? setView('TEMPLATES') : setView('SETTINGS'))} />}
              {view === 'SETTINGS' && <Settings settings={settings} onUpdate={setSettings} />}
            </div>
          </div>

          <div className="glass-nav fixed bottom-0 left-0 right-0 h-[84px] flex justify-around items-center px-2 z-[50] shadow-[0_-8px_20px_rgba(0,0,0,0.05)]">
             <TabBarItem icon={<Home />} label="Queue" active={view === 'DASH'} onClick={() => setView('DASH')} />
             <TabBarItem icon={<PlusCircle />} label="Book" active={view === 'ORDER_NEW'} onClick={() => setView('ORDER_NEW')} />
             <TabBarItem icon={<ReceiptIndianRupee />} label="Ledger" active={view === 'COLLECTIONS' || view === 'ORDER_DETAILS'} onClick={() => setView('COLLECTIONS')} />
             <TabBarItem icon={<Users />} label="Clients" active={view === 'CUSTOMERS'} onClick={() => setView('CUSTOMERS')} />
             <TabBarItem icon={<MessageSquare />} label="Chats" active={view === 'WHATSAPP'} onClick={() => setView('WHATSAPP')} />
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
};

export default App;
