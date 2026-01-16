
import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { 
  Plus, Home, ReceiptIndianRupee, Users, MessageSquare, 
  Menu, ArrowLeft, Cloud, Loader2, HardDrive, Settings as SettingsIcon,
  BrainCircuit, Calculator, FileText, ScrollText, Globe, Activity, ShoppingBag, BookOpen, X
} from 'lucide-react';

import './index.css'; 

// --- Services & Hooks (Keep eager loaded for immediate logic) ---
import { useOrders } from './hooks/useOrders';
import { useWhatsApp } from './hooks/useWhatsApp';
import { errorService } from './services/errorService';
import { goldRateService } from './services/goldRateService';
import { storageService } from './services/storageService';
import { geminiService } from './services/geminiService';
import { whatsappService } from './services/whatsappService';
import { smsService } from './services/smsService';
import { Order, GlobalSettings, Customer, NotificationTrigger, PaymentPlanTemplate, ProductionStatus } from './types';
import { AUTOMATION_TEMPLATES } from './constants';
import { ErrorBoundary } from './components/ErrorBoundary';

// --- Lazy Loaded Components (Code Splitting) ---
const Dashboard = lazy(() => import('./components/Dashboard'));
const OrderForm = lazy(() => import('./components/OrderForm'));
const OrderDetails = lazy(() => import('./components/OrderDetails'));
const OrderBook = lazy(() => import('./components/OrderBook'));
const CustomerList = lazy(() => import('./components/CustomerList'));
const PaymentCollections = lazy(() => import('./components/PaymentCollections'));
const WhatsAppPanel = lazy(() => import('./components/WhatsAppPanel'));
const WhatsAppTemplates = lazy(() => import('./components/WhatsAppTemplates'));
const WhatsAppLogs = lazy(() => import('./components/WhatsAppLogs'));
const NotificationCenter = lazy(() => import('./components/NotificationCenter'));
const PlanManager = lazy(() => import('./components/PlanManager'));
const MarketIntelligence = lazy(() => import('./components/MarketIntelligence'));
const Settings = lazy(() => import('./components/Settings'));
const ErrorLogPanel = lazy(() => import('./components/ErrorLogPanel'));
const CustomerOrderView = lazy(() => import('./components/CustomerOrderView'));

// --- Types & UI Helpers ---
type MainView = 'DASH' | 'ORDER_NEW' | 'ORDER_DETAILS' | 'ORDER_BOOK' | 'CUSTOMERS' | 'COLLECTIONS' | 'WHATSAPP' | 'TEMPLATES' | 'PLANS' | 'LOGS' | 'STRATEGY' | 'MARKET' | 'SYS_LOGS' | 'SETTINGS' | 'MENU' | 'CUSTOMER_VIEW';

const LoadingScreen = () => (
  <div className="h-full w-full flex flex-col items-center justify-center text-slate-400 space-y-4 min-h-[50vh]">
    <Loader2 className="animate-spin text-amber-500" size={32} />
    <p className="text-xs font-black uppercase tracking-widest">Loading Module...</p>
  </div>
);

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
  // --- Global State ---
  const [view, setView] = useState<MainView>('DASH');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [customerViewOrder, setCustomerViewOrder] = useState<Order | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [syncStatus, setSyncStatus] = useState(storageService.getSyncStatus());
  
  // --- Data Hooks ---
  const { orders, addOrder, recordPayment, updateItemStatus, updateOrder } = useOrders();
  const { logs, templates, addLog, setTemplates } = useWhatsApp();
  
  // --- Local App State ---
  const [settings, setSettingsState] = useState<GlobalSettings>(storageService.getSettings());
  const [planTemplates, setPlanTemplates] = useState<PaymentPlanTemplate[]>(storageService.getPlanTemplates());
  const [notifications, setNotifications] = useState<NotificationTrigger[]>([]);
  const [isStrategyLoading, setStrategyLoading] = useState(false);
  const [sendingNotifId, setSendingNotifId] = useState<string | null>(null);
  const [autoPilotRan, setAutoPilotRan] = useState(false);
  const [autoPilotReport, setAutoPilotReport] = useState<string[]>([]);
  const [errors, setErrors] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);

  // --- Handlers ---
  const setSettings = (newSettings: GlobalSettings) => {
    setSettingsState(newSettings);
    storageService.setSettings(newSettings);
  };
  
  const handleUpdatePlans = (newPlans: PaymentPlanTemplate[]) => {
      setPlanTemplates(newPlans);
      storageService.setPlanTemplates(newPlans);
  };

  const startApp = async () => {
    setIsInitializing(true);
    try {
      await storageService.syncFromServer();
      const rateRes = await goldRateService.fetchLiveRate();
      if (rateRes.success) {
          const currentSettings = storageService.getSettings();
          setSettings({
              ...currentSettings,
              currentGoldRate24K: rateRes.rate24K,
              currentGoldRate22K: rateRes.rate22K
          });
      }

      // Check for Customer View Token
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      if (token) {
          const allOrders = storageService.getOrders();
          const targetOrder = allOrders.find(o => o.shareToken === token || o.id === token);
          if (targetOrder) {
              setCustomerViewOrder(targetOrder);
              setView('CUSTOMER_VIEW');
          }
      }

    } catch (e: any) {
      console.warn("Sync failed, using local.");
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
    return () => { unsubStorage(); unsubErrors(); };
  }, []);

  // --- Auto-Pilot & Logic ---
  const handleOrderCreate = async (newOrder: Order) => {
      addOrder(newOrder);
      
      // Use Template Message for Reliable Delivery (initiate conversation window)
      // Template: auragold_order_confirmation
      // Variables: {{1}}=Name, {{2}}=OrderID, {{3}}=Total, {{4}}=Token
      
      const variables = [
          newOrder.customerName,
          newOrder.id,
          `₹${newOrder.totalAmount.toLocaleString()}`,
          newOrder.shareToken
      ];

      whatsappService.sendTemplateMessage(
          newOrder.customerContact, 
          'auragold_order_confirmation', 
          'en_US', 
          variables, 
          newOrder.customerName
      ).then(res => { 
          if (res.success && res.logEntry) addLog(res.logEntry); 
          else console.error("Order Confirmation Failed:", res.error);
      });

      setSelectedOrderId(newOrder.id);
      setView('ORDER_DETAILS');
  };

  const handleStatusUpdate = async (orderId: string, itemId: string, newStatus: ProductionStatus) => {
      const order = orders.find(o => o.id === orderId);
      if (!order) return;

      updateItemStatus(orderId, itemId, newStatus);

      const item = order.items.find(i => i.id === itemId);
      if (item) {
          const message = AUTOMATION_TEMPLATES.STATUS_UPDATE(
              order.customerName,
              item.category,
              newStatus,
              order.shareToken
          );
          
          await whatsappService.sendMessage(order.customerContact, message, order.customerName)
             .then(res => { if (res.success && res.logEntry) addLog(res.logEntry); });
      }
  };

  const handleRunStrategy = async () => {
    setStrategyLoading(true);
    try {
        const triggers: NotificationTrigger[] = [];
        const overdueOrders = orders.filter(o => {
            const paid = o.payments.reduce((a,c) => a + c.amount, 0);
            return paid < o.totalAmount;
        });
        for (const o of overdueOrders.slice(0, 5)) {
            const strat = await geminiService.generateStrategicNotification(o, 'OVERDUE', settings.currentGoldRate24K);
            triggers.push({
                id: `strat-${o.id}-${Date.now()}`,
                customerName: o.customerName,
                type: 'OVERDUE',
                message: strat.message || `Reminder for Order #${o.id}`,
                date: new Date().toISOString(),
                sent: false,
                tone: strat.tone || 'POLITE',
                strategyReasoning: strat.reasoning
            });
        }
        setNotifications(triggers);
    } catch(e) {
        errorService.logError('AI', 'Strategy failed', 'MEDIUM');
    } finally {
        setStrategyLoading(false);
    }
  };

  const handleSendNotification = async (id: string, channel: 'WHATSAPP' | 'SMS' = 'WHATSAPP') => {
    setSendingNotifId(id);
    const notif = notifications.find(n => n.id === id);
    if (notif) {
        const order = orders.find(o => o.customerName === notif.customerName);
        if (order) {
            let res;
            if (channel === 'SMS') {
                res = await smsService.sendSMS(order.customerContact, notif.message, notif.customerName);
            } else {
                res = await whatsappService.sendMessage(order.customerContact, notif.message, notif.customerName);
            }
            if (res.success && res.logEntry) {
                addLog(res.logEntry);
                setNotifications(prev => prev.map(n => n.id === id ? { ...n, sent: true } : n));
            }
        }
    }
    setSendingNotifId(null);
  };

  // --- Derived State ---
  const customers = useMemo(() => {
    const map = new Map<string, Customer>();
    orders.forEach(o => {
      if (!map.has(o.customerContact)) {
        map.set(o.customerContact, {
          id: `CUST-${o.customerContact}`,
          name: o.customerName,
          contact: o.customerContact,
          orderIds: [o.id],
          totalSpent: o.payments.reduce((acc, p) => acc + p.amount, 0),
          joinDate: o.createdAt
        });
      } else {
        const c = map.get(o.customerContact)!;
        c.orderIds.push(o.id);
        c.totalSpent += o.payments.reduce((acc, p) => acc + p.amount, 0);
      }
    });
    return Array.from(map.values());
  }, [orders]);

  const activeOrder = orders.find(o => o.id === selectedOrderId);

  // --- Render Helpers ---
  const getViewTitle = () => {
    switch(view) {
      case 'DASH': return 'Queue';
      case 'ORDER_NEW': return 'New Booking';
      case 'ORDER_DETAILS': return 'Ledger';
      case 'ORDER_BOOK': return 'Order Book';
      case 'CUSTOMERS': return 'Clients';
      case 'COLLECTIONS': return 'Revenue';
      case 'WHATSAPP': return 'Chats';
      case 'SETTINGS': return 'Settings';
      case 'MENU': return 'Console';
      default: return 'AuraGold';
    }
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <Loader2 className="animate-spin text-amber-500 mb-6" size={48} />
        <h2 className="text-xl font-black uppercase tracking-widest">AuraGold Elite</h2>
        <p className="text-xs text-slate-400 font-bold mt-2">Loading System...</p>
      </div>
    );
  }

  // --- CUSTOMER VIEW (Standalone) ---
  if (view === 'CUSTOMER_VIEW' && customerViewOrder) {
      return (
          <Suspense fallback={<LoadingScreen />}>
              <CustomerOrderView order={customerViewOrder} />
          </Suspense>
      );
  }

  return (
    <ErrorBoundary>
      <div className="flex h-[100dvh] overflow-hidden bg-[#F3F4F6] text-slate-900">
        <main className="flex-1 flex flex-col h-full relative w-full overflow-hidden">
          
          {/* Top Bar */}
          <header className="bg-white border-b px-4 py-4 flex items-center justify-between z-40 sticky top-0 shadow-sm">
             <div className="flex items-center gap-3">
               {view !== 'DASH' ? (
                 <button onClick={() => setView('DASH')} className="p-1 text-slate-900 active:scale-90 transition-transform">
                    <ArrowLeft size={24} />
                 </button>
               ) : (
                  <button onClick={() => setView('MENU')} className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center shadow-lg active:scale-90 transition-transform">
                    <Menu size={20} className="text-white" />
                  </button>
               )}
               <div>
                    <h1 className="text-xl font-black tracking-tight text-slate-900 truncate">{getViewTitle()}</h1>
                    <div className="flex items-center gap-1">
                        {syncStatus === 'CONNECTED' ? (
                            <span className="text-[8px] font-black uppercase text-emerald-600 flex items-center gap-1">
                                <Cloud size={10} /> Live
                            </span>
                        ) : (
                            <span className="text-[8px] font-black uppercase text-amber-600 flex items-center gap-1">
                                <HardDrive size={10} /> Local
                            </span>
                        )}
                    </div>
               </div>
             </div>
             <div className="flex items-center gap-3">
                 <button onClick={()=>setView('SETTINGS')} className="p-2 text-slate-400"><SettingsIcon size={20}/></button>
                 {view === 'DASH' && (
                    <button onClick={() => setView('ORDER_NEW')} className="w-11 h-11 bg-amber-600 text-white rounded-2xl flex items-center justify-center shadow-xl active:scale-90 transition-transform">
                      <Plus size={28} />
                    </button>
                 )}
             </div>
          </header>

          {/* Main Content Area - Suspense Wrapper */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 w-full pb-[120px]">
            <div className="max-w-4xl mx-auto">
              <Suspense fallback={<LoadingScreen />}>
              
                {/* Auto-Pilot Report Toast */}
                {view === 'DASH' && autoPilotReport.length > 0 && (
                    <div className="mb-6 bg-slate-900 text-emerald-400 p-4 rounded-2xl shadow-xl animate-slideDown border border-emerald-900/50">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                                <BrainCircuit size={14} className="text-amber-400" /> 
                                System Auto-Pilot Report
                            </h4>
                            <button onClick={() => setAutoPilotReport([])} className="text-slate-500 hover:text-white"><X size={14} /></button>
                        </div>
                        <ul className="space-y-1">
                            {autoPilotReport.map((msg, i) => (
                                <li key={i} className="text-[10px] font-mono">{msg}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* View Switcher */}
                {view === 'DASH' && <Dashboard orders={orders} currentRates={{ k24: settings.currentGoldRate24K, k22: settings.currentGoldRate22K }} />}
                {view === 'MENU' && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <MenuItem icon={<BookOpen />} label="Order Book" desc="Active & Archives" colorClass="bg-emerald-100 text-emerald-600" onClick={() => setView('ORDER_BOOK')} />
                    <MenuItem icon={<BrainCircuit />} label="AI Strategy" desc="Recovery Engine" colorClass="bg-amber-100 text-amber-600" onClick={() => setView('STRATEGY')} />
                    <MenuItem icon={<Calculator />} label="Plans" desc="Payment Schemes" colorClass="bg-violet-100 text-violet-600" onClick={() => setView('PLANS')} />
                    <MenuItem icon={<FileText />} label="Templates" desc="WA Meta Manager" colorClass="bg-blue-100 text-blue-600" onClick={() => setView('TEMPLATES')} />
                    <MenuItem icon={<ScrollText />} label="Logs" desc="History" colorClass="bg-emerald-100 text-emerald-600" onClick={() => setView('LOGS')} />
                    <MenuItem icon={<Globe />} label="Market" desc="Live Intelligence" colorClass="bg-indigo-100 text-indigo-600" onClick={() => setView('MARKET')} />
                    <MenuItem icon={<Activity />} label="Diagnostics" desc="Repair" colorClass="bg-slate-100 text-slate-600" onClick={() => setView('SYS_LOGS')} />
                  </div>
                )}
                {view === 'ORDER_NEW' && <OrderForm settings={settings} planTemplates={planTemplates} onSubmit={handleOrderCreate} onCancel={() => setView('DASH')} />}
                {view === 'ORDER_DETAILS' && (activeOrder ? <OrderDetails order={activeOrder} settings={settings} onBack={() => setView('DASH')} onUpdateStatus={(itemId, status) => handleStatusUpdate(activeOrder.id, itemId, status)} onRecordPayment={recordPayment} onOrderUpdate={updateOrder} logs={logs} onAddLog={addLog} /> : <div className="text-center py-20">Select an order</div>)}
                {view === 'ORDER_BOOK' && <OrderBook orders={orders} onViewOrder={(id) => { setSelectedOrderId(id); setView('ORDER_DETAILS'); }} onUpdateOrder={updateOrder} />}
                {view === 'CUSTOMERS' && <CustomerList customers={customers} orders={orders} onViewOrder={(id)=>{setSelectedOrderId(id); setView('ORDER_DETAILS');}} onMessageSent={addLog} />}
                {view === 'COLLECTIONS' && <PaymentCollections orders={orders} onViewOrder={(id)=>{setSelectedOrderId(id); setView('ORDER_DETAILS');}} onSendWhatsApp={()=>{}} settings={settings} />}
                {view === 'STRATEGY' && <NotificationCenter notifications={notifications} onRefresh={handleRunStrategy} loading={isStrategyLoading} onSend={handleSendNotification} isSending={sendingNotifId} />}
                {view === 'TEMPLATES' && <WhatsAppTemplates templates={templates} onUpdate={setTemplates} />}
                {view === 'PLANS' && <PlanManager templates={planTemplates} onUpdate={handleUpdatePlans} />}
                {view === 'LOGS' && <WhatsAppLogs logs={logs} onViewChat={(phone) => { setView('WHATSAPP'); (window as any).initialChatContact = phone; }} />}
                {view === 'WHATSAPP' && <WhatsAppPanel logs={logs} customers={customers} onRefreshStatus={() => {}} templates={templates} onAddLog={addLog} initialContact={(window as any).initialChatContact} />}
                {view === 'MARKET' && <MarketIntelligence />}
                {view === 'SYS_LOGS' && <ErrorLogPanel errors={errors} onClear={() => errorService.clearErrors()} activities={activities} onResolveAction={(path) => path !== 'none' && setView('SETTINGS')} />}
                {view === 'SETTINGS' && <Settings settings={settings} onUpdate={setSettings} />}
              
              </Suspense>
            </div>
          </div>

          {/* Bottom Navigation */}
          <div className="glass-nav">
             <TabBarItem icon={<Home />} label="Queue" active={view === 'DASH'} onClick={() => setView('DASH')} />
             <TabBarItem icon={<ShoppingBag />} label="Orders" active={view === 'ORDER_BOOK'} onClick={() => setView('ORDER_BOOK')} />
             <TabBarItem icon={<ReceiptIndianRupee />} label="Ledger" active={view === 'COLLECTIONS'} onClick={() => setView('COLLECTIONS')} />
             <TabBarItem icon={<Users />} label="Clients" active={view === 'CUSTOMERS'} onClick={() => setView('CUSTOMERS')} />
             <TabBarItem icon={<MessageSquare />} label="Chats" active={view === 'WHATSAPP'} onClick={() => setView('WHATSAPP')} />
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
};

export default App;
