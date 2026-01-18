
import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { 
  Plus, Home, ReceiptIndianRupee, Users, MessageSquare, 
  Menu, ArrowLeft, Cloud, Loader2, HardDrive, Settings as SettingsIcon,
  BrainCircuit, Calculator, FileText, ScrollText, Globe, Activity, ShoppingBag, BookOpen, X, RefreshCw
} from 'lucide-react';

import './index.css'; 

// --- Services & Hooks ---
import { useOrders } from './hooks/useOrders';
import { useWhatsApp } from './hooks/useWhatsApp';
import { errorService } from './services/errorService';
import { goldRateService } from './services/goldRateService';
import { storageService } from './services/storageService';
import { Order, GlobalSettings, NotificationTrigger, PaymentPlanTemplate } from './types';
import { ErrorBoundary } from './components/ErrorBoundary';

// --- ROBUST LAZY LOADING HELPER ---
// Catches "Failed to fetch dynamically imported module" errors gracefully.
// 1. Attempts 1 auto-reload.
// 2. If failure persists, renders a "Update Required" UI instead of crashing.
const lazyRetry = (importFn: () => Promise<any>, moduleName: string) => {
  return lazy(async () => {
    try {
      return await importFn();
    } catch (error: any) {
      console.error(`[App] Chunk load failed for ${moduleName}:`, error);
      
      // Unique key for this module's retry attempt
      const storageKey = `retry_chunk_${moduleName}`;
      const lastRetry = sessionStorage.getItem(storageKey);
      const now = Date.now();

      // If we haven't retried in the last 20 seconds, try a hard reload once
      if (!lastRetry || (now - parseInt(lastRetry) > 20000)) {
         console.log(`[App] Attempting auto-recovery for ${moduleName}`);
         sessionStorage.setItem(storageKey, now.toString());
         
         // Force cache busting reload
         const url = new URL(window.location.href);
         url.searchParams.set('v', now.toString());
         window.location.href = url.toString();
         
         return new Promise(() => {}); // Stall while reloading
      }

      // If reload failed or looped, return a Safe Fallback Component
      return { 
          default: () => (
            <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center animate-fadeIn">
                <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-amber-100">
                    <RefreshCw size={32} className="text-amber-600" />
                </div>
                <h2 className="text-xl font-black text-slate-800 mb-2">New Version Available</h2>
                <p className="text-slate-500 text-sm mb-6 max-w-xs mx-auto leading-relaxed">
                    The <strong>{moduleName}</strong> module has been updated. Please refresh to load the latest features.
                </p>
                <button 
                    onClick={() => {
                        sessionStorage.removeItem(storageKey);
                        window.location.reload();
                    }}
                    className="bg-slate-900 text-white px-8 py-3.5 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg active:scale-95 flex items-center gap-2"
                >
                    <RefreshCw size={14} /> Update Now
                </button>
            </div>
          )
      };
    }
  });
};

// --- Lazy Loaded Components ---
const Dashboard = lazyRetry(() => import('./components/Dashboard'), 'Dashboard');
const OrderForm = lazyRetry(() => import('./components/OrderForm'), 'OrderForm');
const OrderDetails = lazyRetry(() => import('./components/OrderDetails'), 'OrderDetails');
const OrderBook = lazyRetry(() => import('./components/OrderBook'), 'OrderBook');
const CustomerList = lazyRetry(() => import('./components/CustomerList'), 'CustomerList');
const PaymentCollections = lazyRetry(() => import('./components/PaymentCollections'), 'Collections');
const WhatsAppPanel = lazyRetry(() => import('./components/WhatsAppPanel'), 'WhatsApp');
const WhatsAppTemplates = lazyRetry(() => import('./components/WhatsAppTemplates'), 'Templates');
const NotificationCenter = lazyRetry(() => import('./components/NotificationCenter'), 'NotificationCenter');
const PlanManager = lazyRetry(() => import('./components/PlanManager'), 'PlanManager');
const MarketIntelligence = lazyRetry(() => import('./components/MarketIntelligence'), 'MarketIntelligence');
const Settings = lazyRetry(() => import('./components/Settings'), 'Settings');
const ErrorLogPanel = lazyRetry(() => import('./components/ErrorLogPanel'), 'SystemLogs');
const CustomerOrderView = lazyRetry(() => import('./components/CustomerOrderView'), 'CustomerView');

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
    className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col items-start text-left group"
  >
    <div className={`p-3 rounded-2xl mb-3 transition-colors ${colorClass}`}>
        {React.cloneElement(icon, { size: 24 })}
    </div>
    <h3 className="font-bold text-slate-800 text-sm group-hover:text-slate-900 transition-colors">{label}</h3>
    <p className="text-[10px] text-slate-500 leading-relaxed mt-1">{desc}</p>
  </button>
);

const App = () => {
  const [view, setView] = useState<MainView>('DASH');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [settings, setSettings] = useState<GlobalSettings>(storageService.getSettings());
  const [planTemplates, setPlanTemplates] = useState<PaymentPlanTemplate[]>(storageService.getPlanTemplates());
  
  // Custom Hooks
  const { orders, addOrder, updateOrder, recordPayment, updateItemStatus } = useOrders();
  const { logs, addLog, templates, setTemplates } = useWhatsApp();

  // Initialization
  useEffect(() => {
    errorService.initGlobalListeners();
    
    // Check for share token in URL
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
        const order = orders.find(o => o.shareToken === token);
        if (order) {
            setSelectedOrderId(order.id);
            setView('CUSTOMER_VIEW');
            return;
        }
    }

    // Attempt Server Sync
    storageService.syncFromServer().then(res => {
        if (res.success) {
            setSettings(storageService.getSettings());
            setPlanTemplates(storageService.getPlanTemplates());
            console.log("[App] Sync Successful");
        }
    });

    // Make view dispatcher global for components
    (window as any).dispatchView = (v: MainView) => setView(v);
  }, [orders]);

  const handleUpdateSettings = (newSettings: GlobalSettings) => {
      setSettings(newSettings);
      storageService.setSettings(newSettings);
      // Trigger sync in background
      fetch('/api/sync/settings', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ settings: newSettings })
      });
  };

  const selectedOrder = useMemo(() => orders.find(o => o.id === selectedOrderId), [orders, selectedOrderId]);

  // Derived Data for Notification Center
  const notificationTriggers = useMemo<NotificationTrigger[]>(() => {
    const triggers: NotificationTrigger[] = [];
    const now = new Date();
    
    orders.forEach(order => {
        if (order.status === 'COMPLETED' || order.status === 'CANCELLED') return;

        order.paymentPlan.milestones.forEach(m => {
            if (m.status !== 'PAID') {
                const dueDate = new Date(m.dueDate);
                const diffTime = dueDate.getTime() - now.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays <= 3 && diffDays >= 0) {
                    triggers.push({
                        id: `due-${m.id}-${Date.now()}`,
                        customerName: order.customerName,
                        type: 'UPCOMING',
                        message: `Payment of ₹${m.targetAmount} due in ${diffDays} days.`,
                        date: m.dueDate,
                        sent: false,
                        tone: 'POLITE'
                    });
                } else if (diffDays < 0) {
                    triggers.push({
                        id: `over-${m.id}-${Date.now()}`,
                        customerName: order.customerName,
                        type: 'OVERDUE',
                        message: `Payment of ₹${m.targetAmount} is OVERDUE by ${Math.abs(diffDays)} days.`,
                        date: m.dueDate,
                        sent: false,
                        tone: 'FIRM'
                    });
                }
            }
        });
    });
    return triggers;
  }, [orders]);

  const renderContent = () => {
      switch(view) {
          case 'DASH': return <Dashboard orders={orders} currentRates={{k24: settings.currentGoldRate24K, k22: settings.currentGoldRate22K}} onRefreshRates={async () => {
              const res = await goldRateService.fetchLiveRate();
              if (res.success) setSettings({...settings, currentGoldRate24K: res.rate24K, currentGoldRate22K: res.rate22K});
          }} />;
          
          case 'ORDER_NEW': return <OrderForm settings={settings} planTemplates={planTemplates} onSubmit={(o) => { addOrder(o); setSelectedOrderId(o.id); setView('ORDER_DETAILS'); }} onCancel={() => setView('DASH')} />;
          
          case 'ORDER_BOOK': return <OrderBook orders={orders} onViewOrder={(id) => { setSelectedOrderId(id); setView('ORDER_DETAILS'); }} onUpdateOrder={updateOrder} />;
          
          case 'ORDER_DETAILS': return selectedOrder ? 
            <OrderDetails order={selectedOrder} settings={settings} onBack={() => setView('ORDER_BOOK')} onUpdateStatus={updateItemStatus} onRecordPayment={recordPayment} onOrderUpdate={updateOrder} logs={logs} onAddLog={addLog} /> : 
            <div className="text-center p-10">Order Not Found</div>;
            
          case 'CUSTOMERS': return <CustomerList customers={[]} orders={orders} onViewOrder={(id) => { setSelectedOrderId(id); setView('ORDER_DETAILS'); }} onMessageSent={addLog} onAddCustomer={(c) => { 
             storageService.setCustomers([...((storageService as any).state.customers || []), c]);
          }} />;
          
          case 'COLLECTIONS': return <PaymentCollections orders={orders} onViewOrder={(id) => { setSelectedOrderId(id); setView('ORDER_DETAILS'); }} onSendWhatsApp={() => {}} settings={settings} />;
          
          case 'WHATSAPP': return <WhatsAppPanel logs={logs} onRefreshStatus={() => {}} templates={templates} onAddLog={addLog} />;
          
          case 'TEMPLATES': return <WhatsAppTemplates templates={templates} onUpdate={setTemplates} />;
          
          case 'PLANS': return <PlanManager templates={planTemplates} onUpdate={(tpls) => { setPlanTemplates(tpls); storageService.setPlanTemplates(tpls); }} />;
          
          case 'STRATEGY': return <NotificationCenter notifications={notificationTriggers} onSend={async (id, ch) => { alert(`Sent via ${ch}`); }} onRefresh={() => {}} loading={false} />;
          
          case 'MARKET': return <MarketIntelligence />;
          
          case 'SYS_LOGS': return <ErrorLogPanel errors={[]} activities={[]} onClear={() => {}} />;
          
          case 'SETTINGS': return <Settings settings={settings} onUpdate={handleUpdateSettings} />;
          
          case 'CUSTOMER_VIEW': return selectedOrder ? <CustomerOrderView order={selectedOrder} /> : <div className="text-center p-10">Invalid or Expired Token</div>;
          
          case 'MENU': return (
              <div className="grid grid-cols-2 gap-4 pb-24 animate-fadeIn">
                  <MenuItem onClick={() => setView('ORDER_BOOK')} icon={<BookOpen />} label="Order Registry" desc="Manage all bookings" colorClass="bg-blue-50 text-blue-600" />
                  <MenuItem onClick={() => setView('CUSTOMERS')} icon={<Users />} label="Client Directory" desc="View customer profiles" colorClass="bg-emerald-50 text-emerald-600" />
                  <MenuItem onClick={() => setView('COLLECTIONS')} icon={<ReceiptIndianRupee />} label="Payments" desc="Track cash flow" colorClass="bg-amber-50 text-amber-600" />
                  <MenuItem onClick={() => setView('WHATSAPP')} icon={<MessageSquare />} label="WhatsApp" desc="Connect with clients" colorClass="bg-teal-50 text-teal-600" />
                  <MenuItem onClick={() => setView('TEMPLATES')} icon={<FileText />} label="Templates" desc="Edit message formats" colorClass="bg-indigo-50 text-indigo-600" />
                  <MenuItem onClick={() => setView('PLANS')} icon={<Calculator />} label="Plan Manager" desc="Configure schemes" colorClass="bg-violet-50 text-violet-600" />
                  <MenuItem onClick={() => setView('MARKET')} icon={<Globe />} label="Market Intel" desc="Live rates & news" colorClass="bg-sky-50 text-sky-600" />
                  <MenuItem onClick={() => setView('SYS_LOGS')} icon={<HardDrive />} label="System Logs" desc="Debug & Audit" colorClass="bg-slate-100 text-slate-600" />
                  <MenuItem onClick={() => setView('SETTINGS')} icon={<SettingsIcon />} label="Configuration" desc="Database & Rates" colorClass="bg-slate-800 text-white" />
              </div>
          );
          
          default: return <Dashboard orders={orders} currentRates={{k24: settings.currentGoldRate24K, k22: settings.currentGoldRate22K}} />;
      }
  };

  // Special layout for Customer View (No App Shell)
  if (view === 'CUSTOMER_VIEW') {
      return (
          <ErrorBoundary>
              <Suspense fallback={<LoadingScreen />}>
                  <CustomerOrderView order={selectedOrder!} />
              </Suspense>
          </ErrorBoundary>
      );
  }

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-[#f8f9fa] font-sans text-slate-900 overflow-hidden">
        
        {/* Desktop Sidebar */}
        <div className="hidden lg:flex flex-col w-72 bg-white border-r border-slate-200 h-full p-6 shadow-sm z-20">
             <div className="mb-10 flex items-center gap-3 px-2">
                 <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                    <span className="font-serif font-black text-white text-xl">A</span>
                 </div>
                 <div>
                    <h1 className="font-serif font-black text-xl tracking-tight text-slate-900">AuraGold</h1>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Enterprise OS</p>
                 </div>
             </div>

             <div className="flex-1 space-y-1 overflow-y-auto custom-scrollbar pr-2">
                 <SidebarItem active={view === 'DASH'} onClick={() => setView('DASH')} icon={Home} label="Dashboard" />
                 <SidebarItem active={view === 'ORDER_BOOK' || view === 'ORDER_DETAILS'} onClick={() => setView('ORDER_BOOK')} icon={BookOpen} label="Order Book" />
                 <SidebarItem active={view === 'ORDER_NEW'} onClick={() => setView('ORDER_NEW')} icon={Plus} label="New Booking" highlight />
                 
                 <div className="my-6 border-t border-slate-100"></div>
                 <p className="px-4 text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Operations</p>
                 
                 <SidebarItem active={view === 'CUSTOMERS'} onClick={() => setView('CUSTOMERS')} icon={Users} label="Clients" />
                 <SidebarItem active={view === 'COLLECTIONS'} onClick={() => setView('COLLECTIONS')} icon={ReceiptIndianRupee} label="Payments" />
                 <SidebarItem active={view === 'STRATEGY'} onClick={() => setView('STRATEGY')} icon={BrainCircuit} label="Recovery AI" />
                 
                 <div className="my-6 border-t border-slate-100"></div>
                 <p className="px-4 text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Connect</p>

                 <SidebarItem active={view === 'WHATSAPP'} onClick={() => setView('WHATSAPP')} icon={MessageSquare} label="WhatsApp" />
                 <SidebarItem active={view === 'MARKET'} onClick={() => setView('MARKET')} icon={Globe} label="Market Intel" />
             </div>

             <div className="mt-4 pt-4 border-t border-slate-100">
                 <SidebarItem active={view === 'SETTINGS'} onClick={() => setView('SETTINGS')} icon={SettingsIcon} label="Settings" />
                 <div className="px-4 mt-4 flex items-center gap-2 text-[10px] text-slate-400">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span>System Online • v2.4.0</span>
                 </div>
             </div>
        </div>

        {/* Mobile Header */}
        <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-md border-b z-40 flex items-center justify-between px-4 shadow-sm">
             <div className="flex items-center gap-2">
                 <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg flex items-center justify-center">
                    <span className="font-serif font-black text-white text-lg">A</span>
                 </div>
                 <span className="font-serif font-bold text-lg text-slate-900">AuraGold</span>
             </div>
             {view !== 'DASH' && (
                 <button onClick={() => setView('DASH')} className="p-2 bg-slate-100 rounded-full text-slate-600">
                     <ArrowLeft size={20} />
                 </button>
             )}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden relative flex flex-col">
            <main className="flex-1 overflow-y-auto p-4 lg:p-8 pt-20 lg:pt-8 pb-32 lg:pb-8">
               <Suspense fallback={<LoadingScreen />}>
                  {renderContent()}
               </Suspense>
            </main>
        </div>

        {/* Mobile Bottom Tab Bar */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 h-[84px] pb-6 px-6 flex justify-between items-center z-50 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
             <TabBarItem active={view === 'DASH'} onClick={() => setView('DASH')} icon={<Home />} label="Home" />
             <TabBarItem active={view === 'ORDER_BOOK' || view === 'ORDER_NEW'} onClick={() => setView('ORDER_BOOK')} icon={<BookOpen />} label="Orders" />
             
             {/* Floating FAB for Menu */}
             <div className="-mt-8">
                 <button 
                    onClick={() => setView(view === 'MENU' ? 'DASH' : 'MENU')}
                    className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl shadow-slate-900/30 transition-transform active:scale-90 ${view === 'MENU' ? 'bg-slate-800 text-white' : 'bg-slate-900 text-white'}`}
                 >
                    {view === 'MENU' ? <X size={24} /> : <Menu size={24} />}
                 </button>
             </div>

             <TabBarItem active={view === 'COLLECTIONS'} onClick={() => setView('COLLECTIONS')} icon={<ReceiptIndianRupee />} label="Pay" />
             <TabBarItem active={view === 'WHATSAPP'} onClick={() => setView('WHATSAPP')} icon={<MessageSquare />} label="Chat" />
        </div>

      </div>
    </ErrorBoundary>
  );
};

const SidebarItem = ({ active, onClick, icon: Icon, label, highlight }: any) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-xs font-bold transition-all group ${
        active 
        ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20' 
        : highlight 
            ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' 
            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
    }`}
  >
    <Icon size={18} className={active ? 'text-amber-400' : (highlight ? 'text-amber-600' : 'text-slate-400 group-hover:text-slate-600')} />
    <span>{label}</span>
    {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-400"></div>}
  </button>
);

export default App;
