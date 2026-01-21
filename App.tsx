
import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { 
  Plus, Home, ReceiptIndianRupee, Users, MessageSquare, 
  Menu, ArrowLeft, Cloud, Loader2, HardDrive, Settings as SettingsIcon,
  BrainCircuit, Calculator, FileText, ScrollText, Globe, Activity, ShoppingBag, BookOpen, X, RefreshCw, DownloadCloud, Zap,
  History, Layout, PieChart, ShieldAlert
} from 'lucide-react';
import { io } from 'socket.io-client';

import './index.css'; 

// --- Services & Hooks ---
import { useOrders } from './hooks/useOrders';
import { useWhatsApp } from './hooks/useWhatsApp';
import { errorService } from './services/errorService';
import { goldRateService } from './services/goldRateService';
import { storageService } from './services/storageService';
import { Order, GlobalSettings, NotificationTrigger, PaymentPlanTemplate, AppError, ActivityLogEntry, Customer } from './types';
import { ErrorBoundary } from './components/ErrorBoundary';

const API_BASE = (import.meta as any).env.VITE_API_BASE_URL || '';

// --- STABLE LAZY LOADER ---
const lazyRetry = (importFn: () => Promise<any>, moduleName: string) => {
  return lazy(async () => {
    try {
      return await importFn();
    } catch (error: any) {
      console.warn(`[App] Module ${moduleName} missing. Showing update prompt.`);
      return { 
          default: () => (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-8 text-center animate-fadeIn">
                <div className="w-20 h-20 bg-slate-100 text-slate-400 rounded-3xl flex items-center justify-center mb-6 shadow-inner">
                    <DownloadCloud size={32} />
                </div>
                <h2 className="text-xl font-black text-slate-800 mb-2">Update Required</h2>
                <p className="text-slate-500 text-sm mb-8 max-w-xs mx-auto leading-relaxed">
                    A new version of <strong>{moduleName}</strong> has been deployed. Please refresh to continue.
                </p>
                <button 
                    onClick={() => window.location.reload()}
                    className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl active:scale-95 flex items-center gap-3"
                >
                    <RefreshCw size={16} /> Load New Version
                </button>
            </div>
          )
      };
    }
  });
};

const Dashboard = lazyRetry(() => import('./components/Dashboard'), 'Dashboard');
const OrderForm = lazyRetry(() => import('./components/OrderForm'), 'OrderForm');
const OrderDetails = lazyRetry(() => import('./components/OrderDetails'), 'OrderDetails');
const OrderBook = lazyRetry(() => import('./components/OrderBook'), 'OrderBook');
const CustomerList = lazyRetry(() => import('./components/CustomerList'), 'CustomerList');
const CustomerProfile = lazyRetry(() => import('./components/CustomerProfile'), 'CustomerProfile');
const PaymentCollections = lazyRetry(() => import('./components/PaymentCollections'), 'Collections');
const WhatsAppPanel = lazyRetry(() => import('./components/WhatsAppPanel'), 'WhatsApp');
const WhatsAppTemplates = lazyRetry(() => import('./components/WhatsAppTemplates'), 'Templates');
const WhatsAppLogs = lazyRetry(() => import('./components/WhatsAppLogs'), 'WhatsAppLogs');
const NotificationCenter = lazyRetry(() => import('./components/NotificationCenter'), 'NotificationCenter');
const PlanManager = lazyRetry(() => import('./components/PlanManager'), 'PlanManager');
const MarketIntelligence = lazyRetry(() => import('./components/MarketIntelligence'), 'MarketIntelligence');
const Settings = lazyRetry(() => import('./components/Settings'), 'Settings');
const ErrorLogPanel = lazyRetry(() => import('./components/ErrorLogPanel'), 'SystemLogs');
const CustomerOrderView = lazyRetry(() => import('./components/CustomerOrderView'), 'CustomerView');
const SystemArchitect = lazyRetry(() => import('./components/SystemArchitect'), 'Architect');

type MainView = 'DASH' | 'ORDER_NEW' | 'ORDER_DETAILS' | 'ORDER_BOOK' | 'CUSTOMERS' | 'CUSTOMER_PROFILE' | 'COLLECTIONS' | 'WHATSAPP' | 'TEMPLATES' | 'PLANS' | 'LOGS' | 'STRATEGY' | 'MARKET' | 'SYS_LOGS' | 'SETTINGS' | 'MENU' | 'CUSTOMER_VIEW' | 'ARCHITECT';

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
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedChatPhone, setSelectedChatPhone] = useState<string | null>(null);
  const [settings, setSettings] = useState<GlobalSettings>(storageService.getSettings());
  const [planTemplates, setPlanTemplates] = useState<PaymentPlanTemplate[]>(storageService.getPlanTemplates());
  
  const [systemErrors, setSystemErrors] = useState<AppError[]>([]);
  const [systemActivities, setSystemActivities] = useState<ActivityLogEntry[]>([]);
  const [manualCustomers, setManualCustomers] = useState<Customer[]>(storageService.getCustomers());

  const { orders, addOrder, updateOrder, recordPayment, updateItemStatus } = useOrders();
  const { logs, addLog, templates, setTemplates } = useWhatsApp();

  useEffect(() => {
    errorService.initGlobalListeners();
    const unsubscribeErrors = errorService.subscribe((errs, acts) => {
        setSystemErrors(errs);
        setSystemActivities(acts);
    });

    storageService.syncFromServer().then(res => {
        if (res.success) {
            setSettings(storageService.getSettings());
            setPlanTemplates(storageService.getPlanTemplates());
            setManualCustomers(storageService.getCustomers());
        }
    });

    // Global Rate Listener
    const socket = io(API_BASE, {
        path: '/socket.io',
        transports: ['websocket', 'polling']
    });

    socket.on('rate_update', (data: any) => {
        setSettings(prev => ({
            ...prev,
            currentGoldRate24K: data.rate24k,
            currentGoldRate22K: data.rate22k,
            currentGoldRate18K: data.rate18k,
            currentSilverRate: data.rateSilver
        }));
    });

    (window as any).dispatchView = (v: MainView) => setView(v);

    return () => {
        unsubscribeErrors();
        socket.disconnect();
    };
  }, []);

  const derivedCustomers = useMemo(() => {
      const customerMap = new Map<string, Customer>();
      const normalize = (p: string) => p ? p.replace(/\D/g, '').slice(-10) : '';
      manualCustomers.forEach(c => {
          const key = normalize(c.contact);
          if (key) customerMap.set(key, { ...c, totalSpent: 0, orderIds: [] });
      });
      orders.forEach(order => {
          const key = normalize(order.customerContact);
          if (!key) return;
          const existing = customerMap.get(key);
          if (existing) {
              if (!existing.orderIds.includes(order.id)) {
                  existing.orderIds.push(order.id);
                  existing.totalSpent += order.totalAmount;
              }
              if (!existing.name) existing.name = order.customerName;
          } else {
              customerMap.set(key, {
                  id: `CUST-${key}`,
                  name: order.customerName,
                  contact: order.customerContact,
                  email: order.customerEmail,
                  secondaryContact: order.secondaryContact,
                  orderIds: [order.id],
                  totalSpent: order.totalAmount,
                  joinDate: order.createdAt
              });
          }
      });
      return Array.from(customerMap.values()).sort((a, b) => b.totalSpent - a.totalSpent);
  }, [orders, manualCustomers]);

  const handleUpdateSettings = async (newSettings: GlobalSettings) => {
      setSettings(newSettings);
      await storageService.setSettings(newSettings);
  };

  const selectedOrder = useMemo(() => orders.find(o => o.id === selectedOrderId), [orders, selectedOrderId]);
  const selectedCustomer = useMemo(() => derivedCustomers.find(c => c.id === selectedCustomerId), [derivedCustomers, selectedCustomerId]);

  const renderContent = () => {
      switch(view) {
          case 'DASH': return <Dashboard orders={orders} currentRates={{k24: settings.currentGoldRate24K, k22: settings.currentGoldRate22K, silver: settings.currentSilverRate}} onRefreshRates={async () => {
              const res = await goldRateService.fetchLiveRate();
              if (res.success) setSettings({...settings, currentGoldRate24K: res.rate24K, currentGoldRate22K: res.rate22K, currentSilverRate: res.silver});
          }} />;
          case 'ORDER_NEW': return <OrderForm settings={settings} planTemplates={planTemplates} onSubmit={(o) => { addOrder(o); setSelectedOrderId(o.id); setView('ORDER_DETAILS'); }} onCancel={() => setView('DASH')} />;
          case 'ORDER_BOOK': return <OrderBook orders={orders} onViewOrder={(id) => { setSelectedOrderId(id); setView('ORDER_DETAILS'); }} onUpdateOrder={updateOrder} />;
          case 'ORDER_DETAILS': return selectedOrder ? <OrderDetails order={selectedOrder} settings={settings} onBack={() => setView('ORDER_BOOK')} onUpdateStatus={updateItemStatus} onRecordPayment={recordPayment} onOrderUpdate={updateOrder} logs={logs} onAddLog={addLog} /> : <div className="text-center p-10">Order Not Found</div>;
          case 'CUSTOMERS': return <CustomerList customers={derivedCustomers} orders={orders} onSelectCustomer={(id) => { setSelectedCustomerId(id); setView('CUSTOMER_PROFILE'); }} onAddCustomer={(c) => { setManualCustomers([...manualCustomers, c]); storageService.setCustomers([...manualCustomers, c]); }} />;
          case 'CUSTOMER_PROFILE': return selectedCustomer ? <CustomerProfile customer={selectedCustomer} orders={orders} onBack={() => setView('CUSTOMERS')} onViewOrder={(id) => { setSelectedOrderId(id); setView('ORDER_DETAILS'); }} onNewOrder={() => setView('ORDER_NEW')} /> : <div className="text-center p-10">Customer Not Found</div>;
          case 'COLLECTIONS': return <PaymentCollections orders={orders} onViewOrder={(id) => { setSelectedOrderId(id); setView('ORDER_DETAILS'); }} onSendWhatsApp={() => {}} onAddLog={addLog} settings={settings} />;
          case 'WHATSAPP': return <WhatsAppPanel logs={logs} customers={derivedCustomers} onRefreshStatus={() => {}} templates={templates} onAddLog={addLog} initialContact={selectedChatPhone} />;
          case 'TEMPLATES': return <WhatsAppTemplates templates={templates} onUpdate={setTemplates} />;
          case 'LOGS': return <WhatsAppLogs logs={logs} onViewChat={(phone) => { setSelectedChatPhone(phone); setView('WHATSAPP'); }} />;
          case 'PLANS': return <PlanManager templates={planTemplates} onUpdate={(tpls) => { setPlanTemplates(tpls); storageService.setPlanTemplates(tpls); }} />;
          case 'STRATEGY': return <NotificationCenter notifications={[]} customers={derivedCustomers} onSend={() => {}} onRefresh={() => {}} loading={false} />;
          case 'MARKET': return <MarketIntelligence orders={orders} settings={settings} />;
          case 'SYS_LOGS': return <ErrorLogPanel errors={systemErrors} activities={systemActivities} onClear={() => { errorService.clearErrors(); errorService.clearActivity(); }} />;
          case 'SETTINGS': return <Settings settings={settings} onUpdate={handleUpdateSettings} />;
          case 'ARCHITECT': return <SystemArchitect />;
          case 'MENU': return (
              <div className="grid grid-cols-2 gap-4 pb-24 animate-fadeIn">
                  <MenuItem onClick={() => setView('ORDER_BOOK')} icon={<BookOpen />} label="Order Registry" desc="Manage all bookings" colorClass="bg-blue-50 text-blue-600" />
                  <MenuItem onClick={() => setView('CUSTOMERS')} icon={<Users />} label="Client Directory" desc="View customer profiles" colorClass="bg-emerald-50 text-emerald-600" />
                  <MenuItem onClick={() => setView('COLLECTIONS')} icon={<ReceiptIndianRupee />} label="Payments" desc="Track cash flow" colorClass="bg-amber-50 text-amber-600" />
                  <MenuItem onClick={() => setView('WHATSAPP')} icon={<MessageSquare />} label="WhatsApp" desc="Connect with clients" colorClass="bg-teal-50 text-teal-600" />
                  <MenuItem onClick={() => setView('TEMPLATES')} icon={<Layout />} label="AI Templates" desc="Meta Architect Console" colorClass="bg-indigo-50 text-indigo-600" />
                  <MenuItem onClick={() => setView('LOGS')} icon={<History />} label="Chat Logs" desc="Communication history" colorClass="bg-slate-50 text-slate-600" />
                  <MenuItem onClick={() => setView('PLANS')} icon={<FileText />} label="Financial Plans" desc="Configure installments" colorClass="bg-violet-50 text-violet-600" />
                  <MenuItem onClick={() => setView('STRATEGY')} icon={<BrainCircuit />} label="Strategy Engine" desc="AI Debt Recovery" colorClass="bg-rose-50 text-rose-600" />
                  <MenuItem onClick={() => setView('ARCHITECT')} icon={<Zap />} label="Architect" desc="God Mode System Control" colorClass="bg-amber-100 text-amber-600" />
                  <MenuItem onClick={() => setView('MARKET')} icon={<Globe />} label="Market Intel" desc="Live rates & news" colorClass="bg-sky-50 text-sky-600" />
                  <MenuItem onClick={() => setView('SYS_LOGS')} icon={<HardDrive />} label="System Logs" desc="Debug & Audit" colorClass="bg-slate-100 text-slate-600" />
                  <MenuItem onClick={() => setView('SETTINGS')} icon={<SettingsIcon />} label="Configuration" desc="Database & Rates" colorClass="bg-slate-800 text-white" />
              </div>
          );
          default: return <Dashboard orders={orders} currentRates={{k24: settings.currentGoldRate24K, k22: settings.currentGoldRate22K, silver: settings.currentSilverRate}} />;
      }
  };

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-[#f8f9fa] font-sans text-slate-900 overflow-hidden">
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
                 <SidebarItem active={view === 'ORDER_BOOK'} onClick={() => setView('ORDER_BOOK')} icon={BookOpen} label="Order Book" />
                 <SidebarItem active={view === 'ORDER_NEW'} onClick={() => setView('ORDER_NEW')} icon={Plus} label="New Booking" highlight />
                 
                 <div className="my-6 border-t border-slate-100"></div>
                 <p className="px-4 text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Operations</p>
                 <SidebarItem active={view === 'CUSTOMERS'} onClick={() => setView('CUSTOMERS')} icon={Users} label="Clients" />
                 <SidebarItem active={view === 'COLLECTIONS'} onClick={() => setView('COLLECTIONS')} icon={ReceiptIndianRupee} label="Payments" />
                 <SidebarItem active={view === 'STRATEGY'} onClick={() => setView('STRATEGY')} icon={BrainCircuit} label="Strategy Hub" />
                 <SidebarItem active={view === 'PLANS'} onClick={() => setView('PLANS')} icon={FileText} label="Plan Manager" />
                 
                 <div className="my-6 border-t border-slate-100"></div>
                 <p className="px-4 text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Communication</p>
                 <SidebarItem active={view === 'WHATSAPP'} onClick={() => setView('WHATSAPP')} icon={MessageSquare} label="WhatsApp" />
                 <SidebarItem active={view === 'TEMPLATES'} onClick={() => setView('TEMPLATES')} icon={Layout} label="AI Templates" />
                 <SidebarItem active={view === 'LOGS'} onClick={() => setView('LOGS')} icon={History} label="Audit Logs" />
                 
                 <div className="my-6 border-t border-slate-100"></div>
                 <SidebarItem active={view === 'ARCHITECT'} onClick={() => setView('ARCHITECT')} icon={Zap} label="God Mode" highlight />
                 <SidebarItem active={view === 'MARKET'} onClick={() => setView('MARKET')} icon={Globe} label="Market Intel" />
             </div>
             <div className="mt-4 pt-4 border-t border-slate-100">
                 <SidebarItem active={view === 'SYS_LOGS'} onClick={() => setView('SYS_LOGS')} icon={HardDrive} label="System Logs" />
                 <SidebarItem active={view === 'SETTINGS'} onClick={() => setView('SETTINGS')} icon={SettingsIcon} label="Settings" />
             </div>
        </div>

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

        <div className="flex-1 overflow-hidden relative flex flex-col">
            <main className="flex-1 overflow-y-auto p-4 lg:p-8 pt-20 lg:pt-8 pb-32 lg:pb-8">
               <Suspense fallback={<LoadingScreen />}>
                  {renderContent()}
               </Suspense>
            </main>
        </div>

        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 h-[84px] pb-6 px-6 flex justify-between items-center z-50 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
             <TabBarItem active={view === 'DASH'} onClick={() => setView('DASH')} icon={<Home />} label="Home" />
             <TabBarItem active={view === 'ORDER_BOOK'} onClick={() => setView('ORDER_BOOK')} icon={<BookOpen />} label="Orders" />
             <div className="-mt-8">
                 <button onClick={() => setView(view === 'MENU' ? 'DASH' : 'MENU')} className="w-14 h-14 rounded-full flex items-center justify-center shadow-2xl bg-slate-900 text-white">
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
        ? 'bg-slate-900 text-white shadow-lg' 
        : highlight 
            ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' 
            : 'text-slate-500 hover:bg-slate-50'
    }`}
  >
    <Icon size={18} className={active ? 'text-amber-400' : (highlight ? 'text-amber-600' : 'text-slate-400')} />
    <span>{label}</span>
  </button>
);

export default App;
