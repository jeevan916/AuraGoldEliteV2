
import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { 
  Plus, Home, ReceiptIndianRupee, Users, MessageSquare, 
  Menu, ArrowLeft, Cloud, Loader2, HardDrive, Settings as SettingsIcon,
  BrainCircuit, Calculator, FileText, ScrollText, Globe, Activity, ShoppingBag, BookOpen, X, RefreshCw, DownloadCloud
} from 'lucide-react';

import './index.css'; 

// --- Services & Hooks ---
import { useOrders } from './hooks/useOrders';
import { useWhatsApp } from './hooks/useWhatsApp';
import { errorService } from './services/errorService';
import { storageService } from './services/storageService';
import { Order, GlobalSettings, NotificationTrigger, PaymentPlanTemplate, AppError, ActivityLogEntry, Customer, MainView } from './types';
import { ErrorBoundary } from './components/ErrorBoundary';

// --- Components (Standard Lazy Loading) ---
const Dashboard = lazy(() => import('./components/Dashboard'));
const OrderForm = lazy(() => import('./components/OrderForm'));
const OrderDetails = lazy(() => import('./components/OrderDetails'));
const OrderBook = lazy(() => import('./components/OrderBook'));
const CustomerList = lazy(() => import('./components/CustomerList'));
const CustomerProfile = lazy(() => import('./components/CustomerProfile'));
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

const LoadingScreen = () => (
  <div className="h-full w-full flex flex-col items-center justify-center text-slate-400 space-y-6 min-h-[60vh]">
    <div className="relative">
      <div className="w-16 h-16 border-4 border-slate-100 border-t-amber-500 rounded-full animate-spin"></div>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-amber-500 font-black text-xl">A</span>
      </div>
    </div>
    <p className="text-[10px] font-black uppercase tracking-[0.4em] ml-[0.4em]">Initializing Core</p>
  </div>
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
  const [customers, setCustomers] = useState<Customer[]>(storageService.getCustomers());

  const { orders, addOrder, updateOrder, recordPayment, updateItemStatus } = useOrders();
  const { logs, addLog, templates, setTemplates } = useWhatsApp();

  useEffect(() => {
    errorService.initGlobalListeners();
    const unsubscribeErrors = errorService.subscribe((errs, acts) => {
        setSystemErrors(errs);
        setSystemActivities(acts);
    });

    // CRITICAL: Bind global dispatcher for components that rely on window.dispatchView
    (window as any).dispatchView = (v: MainView) => setView(v);

    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
        const order = orders.find(o => o.shareToken === token);
        if (order) {
            setSelectedOrderId(order.id);
            setView('CUSTOMER_VIEW');
        }
    }

    storageService.syncFromServer().then(res => {
        if (res.success) {
            setSettings(storageService.getSettings());
            setPlanTemplates(storageService.getPlanTemplates());
            setCustomers(storageService.getCustomers());
            console.log("[App] Sync Successful");
        }
    });

    return () => { unsubscribeErrors(); };
  }, [orders]);

  const handleUpdateSettings = async (newSettings: GlobalSettings) => {
      setSettings(newSettings);
      await storageService.setSettings(newSettings);
  };

  const selectedOrder = useMemo(() => orders.find(o => o.id === selectedOrderId), [orders, selectedOrderId]);
  const selectedCustomer = useMemo(() => customers.find(c => c.id === selectedCustomerId), [customers, selectedCustomerId]);

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
                    triggers.push({ id: `due-${m.id}`, customerName: order.customerName, customerContact: order.customerContact, type: 'UPCOMING', message: `Payment of ₹${m.targetAmount} due in ${diffDays} days.`, date: m.dueDate, sent: false });
                } else if (diffDays < 0) {
                    triggers.push({ id: `over-${m.id}`, customerName: order.customerName, customerContact: order.customerContact, type: 'OVERDUE', message: `Payment of ₹${m.targetAmount} is OVERDUE by ${Math.abs(diffDays)} days.`, date: m.dueDate, sent: false });
                }
            }
        });
    });
    return triggers;
  }, [orders]);

  const renderContent = () => {
      switch(view) {
          case 'DASH': return <Dashboard orders={orders} currentRates={{k24: settings.currentGoldRate24K, k22: settings.currentGoldRate22K}} onNavigate={setView} />;
          case 'ORDER_NEW': return <OrderForm settings={settings} planTemplates={planTemplates} onSubmit={(o) => { addOrder(o); setSelectedOrderId(o.id); setView('ORDER_DETAILS'); }} onCancel={() => setView('DASH')} />;
          case 'ORDER_BOOK': return <OrderBook orders={orders} onViewOrder={(id) => { setSelectedOrderId(id); setView('ORDER_DETAILS'); }} onUpdateOrder={updateOrder} />;
          case 'ORDER_DETAILS': return selectedOrder ? <OrderDetails order={selectedOrder} settings={settings} onBack={() => setView('ORDER_BOOK')} onUpdateStatus={(itemId, status) => updateItemStatus(selectedOrder.id, itemId, status)} onRecordPayment={recordPayment} onOrderUpdate={updateOrder} logs={logs} onAddLog={addLog} /> : null;
          case 'CUSTOMERS': return <CustomerList customers={customers} orders={orders} onSelectCustomer={(id) => { setSelectedCustomerId(id); setView('CUSTOMER_PROFILE'); }} onAddCustomer={(c) => { const upd = [...customers, c]; setCustomers(upd); storageService.setCustomers(upd); }} />;
          case 'CUSTOMER_PROFILE': return selectedCustomer ? <CustomerProfile customer={selectedCustomer} orders={orders} onBack={() => setView('CUSTOMERS')} onViewOrder={(id) => { setSelectedOrderId(id); setView('ORDER_DETAILS'); }} onNewOrder={() => setView('ORDER_NEW')} /> : null;
          case 'COLLECTIONS': return <PaymentCollections orders={orders} onViewOrder={(id) => { setSelectedOrderId(id); setView('ORDER_DETAILS'); }} onAddLog={addLog} settings={settings} onSendWhatsApp={(id) => { setSelectedOrderId(id); setView('ORDER_DETAILS'); }} />;
          case 'WHATSAPP': return <WhatsAppPanel logs={logs} customers={customers} onRefreshStatus={() => {}} templates={templates} onAddLog={addLog} initialContact={selectedChatPhone} />;
          case 'TEMPLATES': return <WhatsAppTemplates templates={templates} onUpdate={setTemplates} />;
          case 'LOGS': return <WhatsAppLogs logs={logs} onViewChat={(phone) => { setSelectedChatPhone(phone); setView('WHATSAPP'); }} />;
          case 'PLANS': return <PlanManager templates={planTemplates} onUpdate={(tpls) => { setPlanTemplates(tpls); storageService.setPlanTemplates(tpls); }} />;
          case 'STRATEGY': return <NotificationCenter notifications={notificationTriggers} customers={customers} onSend={() => {}} onRefresh={() => {}} loading={false} />;
          case 'MARKET': return <MarketIntelligence />;
          case 'SYS_LOGS': return <ErrorLogPanel errors={systemErrors} activities={systemActivities} onClear={() => { errorService.clearErrors(); errorService.clearActivity(); }} />;
          case 'SETTINGS': return <Settings settings={settings} onUpdate={handleUpdateSettings} />;
          case 'MENU': return <div className="grid grid-cols-2 gap-4 pb-24 animate-fadeIn">
            <MenuItem onClick={() => setView('ORDER_BOOK')} icon={<BookOpen />} label="Registry" desc="Master ledger" colorClass="bg-blue-50 text-blue-600" />
            <MenuItem onClick={() => setView('CUSTOMERS')} icon={<Users />} label="Clients" desc="CRM profiles" colorClass="bg-emerald-50 text-emerald-600" />
            <MenuItem onClick={() => setView('WHATSAPP')} icon={<MessageSquare />} label="WhatsApp" desc="Direct chat hub" colorClass="bg-teal-50 text-teal-600" />
            <MenuItem onClick={() => setView('SYS_LOGS')} icon={<HardDrive />} label="System" desc="Health & Audit" colorClass="bg-slate-100 text-slate-600" />
            <MenuItem onClick={() => setView('SETTINGS')} icon={<SettingsIcon />} label="Settings" desc="Pricing Matrix" colorClass="bg-slate-900 text-white" />
          </div>;
          case 'CUSTOMER_VIEW': return selectedOrder ? <CustomerOrderView order={selectedOrder} /> : null;
          default: return <Dashboard orders={orders} currentRates={{k24: settings.currentGoldRate24K, k22: settings.currentGoldRate22K}} onNavigate={setView} />;
      }
  };

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-[#F8F9FA] font-sans text-slate-900 overflow-hidden">
        {/* Desktop Sidebar */}
        <div className="hidden lg:flex flex-col w-72 bg-white border-r border-slate-100 p-8 shadow-sm z-20">
             <div className="mb-12 flex items-center gap-4">
                 <div className="w-12 h-12 bg-slate-900 rounded-[1rem] flex items-center justify-center shadow-xl shadow-slate-900/10">
                    <span className="text-amber-500 font-black text-2xl">A</span>
                 </div>
                 <div>
                    <h1 className="font-serif font-black text-xl tracking-tight leading-none mb-1">AuraGold</h1>
                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em]">Enterprise OS</p>
                 </div>
             </div>
             <div className="flex-1 space-y-1.5 overflow-y-auto custom-scrollbar pr-2">
                 <SidebarItem active={view === 'DASH'} onClick={() => setView('DASH')} icon={Home} label="Intelligence" />
                 <SidebarItem active={view === 'ORDER_BOOK'} onClick={() => setView('ORDER_BOOK')} icon={BookOpen} label="Order Registry" />
                 <SidebarItem active={view === 'CUSTOMERS'} onClick={() => setView('CUSTOMERS')} icon={Users} label="Client CRM" />
                 <SidebarItem active={view === 'COLLECTIONS'} onClick={() => setView('COLLECTIONS')} icon={ReceiptIndianRupee} label="Financials" />
                 <SidebarItem active={view === 'WHATSAPP'} onClick={() => setView('WHATSAPP')} icon={MessageSquare} label="Comm. Hub" />
                 <div className="pt-6 pb-2">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-4">System</p>
                 </div>
                 <SidebarItem active={view === 'SETTINGS'} onClick={() => setView('SETTINGS')} icon={SettingsIcon} label="Matrix Config" />
                 <SidebarItem active={view === 'SYS_LOGS'} onClick={() => setView('SYS_LOGS')} icon={HardDrive} label="Core Logs" />
             </div>
        </div>

        {/* Main Workspace */}
        <div className="flex-1 overflow-hidden relative flex flex-col">
            <main className="flex-1 overflow-y-auto p-4 lg:p-10 pt-20 lg:pt-10 pb-32 lg:pb-10 custom-scrollbar">
               <Suspense fallback={<LoadingScreen />}>{renderContent()}</Suspense>
            </main>
        </div>

        {/* Mobile Tab Bar */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-100 h-[84px] pb-6 px-8 flex justify-between items-center z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
             <TabBarItem active={view === 'DASH'} onClick={() => setView('DASH')} icon={<Home />} label="Home" />
             <TabBarItem active={view === 'ORDER_BOOK'} onClick={() => setView('ORDER_BOOK')} icon={<BookOpen />} label="Orders" />
             <div className="-mt-12">
                <button 
                  onClick={() => setView('MENU')} 
                  className={`w-16 h-16 rounded-3xl flex items-center justify-center shadow-2xl transition-all duration-300 ${view === 'MENU' ? 'bg-rose-500 text-white rotate-45' : 'bg-slate-900 text-white'}`}
                >
                  <Plus size={32} />
                </button>
             </div>
             <TabBarItem active={view === 'COLLECTIONS'} onClick={() => setView('COLLECTIONS')} icon={<ReceiptIndianRupee />} label="Pay" />
             <TabBarItem active={view === 'WHATSAPP'} onClick={() => setView('WHATSAPP')} icon={<MessageSquare />} label="Chat" />
        </div>
      </div>
    </ErrorBoundary>
  );
};

const SidebarItem = ({ active, onClick, icon: Icon, label }: any) => (
  <button 
    onClick={onClick} 
    className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all duration-200 
                ${active ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/10' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
  >
    <Icon size={18} className={active ? 'text-amber-500' : 'text-slate-300'} />
    <span>{label}</span>
  </button>
);

const TabBarItem = ({ icon, label, active, onClick }: any) => (
  <button 
    onClick={onClick} 
    className={`flex flex-col items-center gap-1.5 w-14 transition-all duration-300 ${active ? 'text-amber-600' : 'text-slate-300 opacity-60'}`}
  >
    <div className={`transition-transform duration-300 ${active ? 'scale-110' : ''}`}>
      {React.cloneElement(icon, { size: 24, strokeWidth: active ? 2.5 : 2 })}
    </div>
    <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
  </button>
);

const MenuItem = ({ icon, label, desc, onClick, colorClass }: any) => (
  <button 
    onClick={onClick} 
    className={`bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm transition-all flex flex-col items-start text-left group active:scale-95 hover:border-amber-100 hover:shadow-xl`}
  >
    <div className={`p-4 rounded-2xl mb-4 shadow-sm transition-transform group-hover:scale-110 ${colorClass}`}>
      {React.cloneElement(icon, { size: 24 })}
    </div>
    <h3 className="font-bold text-slate-800 text-sm tracking-tight">{label}</h3>
    <p className="text-[10px] text-slate-400 font-medium leading-relaxed mt-2 uppercase tracking-wider">{desc}</p>
  </button>
);

export default App;
