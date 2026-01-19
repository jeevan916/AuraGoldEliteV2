
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
import { Order, GlobalSettings, NotificationTrigger, PaymentPlanTemplate, AppError, ActivityLogEntry, Customer } from './types';
import { ErrorBoundary } from './components/ErrorBoundary';

// --- Standard Lazy Loading for Bundler Stability ---
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

export type MainView = 'DASH' | 'ORDER_NEW' | 'ORDER_DETAILS' | 'ORDER_BOOK' | 'CUSTOMERS' | 'CUSTOMER_PROFILE' | 'COLLECTIONS' | 'WHATSAPP' | 'TEMPLATES' | 'PLANS' | 'LOGS' | 'STRATEGY' | 'MARKET' | 'SYS_LOGS' | 'SETTINGS' | 'MENU' | 'CUSTOMER_VIEW';

const LoadingScreen = () => (
  <div className="h-full w-full flex flex-col items-center justify-center text-slate-400 space-y-4 min-h-[50vh]">
    <Loader2 className="animate-spin text-amber-500" size={32} />
    <p className="text-xs font-black uppercase tracking-widest">Loading Module...</p>
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
          case 'ORDER_BOOK': return <OrderBook orders={orders} onViewOrder={(id) => { setSelectedOrderId(id); setView('ORDER_DETAILS'); }} onUpdateOrder={updateOrder} onNavigate={setView} />;
          // Fix: Wrap updateItemStatus call with selectedOrder.id to match OrderDetails onUpdateStatus signature
          case 'ORDER_DETAILS': return selectedOrder ? <OrderDetails order={selectedOrder} settings={settings} onBack={() => setView('ORDER_BOOK')} onUpdateStatus={(itemId, status) => updateItemStatus(selectedOrder.id, itemId, status)} onRecordPayment={recordPayment} onOrderUpdate={updateOrder} logs={logs} onAddLog={addLog} /> : null;
          case 'CUSTOMERS': return <CustomerList customers={customers} orders={orders} onSelectCustomer={(id) => { setSelectedCustomerId(id); setView('CUSTOMER_PROFILE'); }} onAddCustomer={(c) => { const upd = [...customers, c]; setCustomers(upd); storageService.setCustomers(upd); }} />;
          case 'CUSTOMER_PROFILE': return selectedCustomer ? <CustomerProfile customer={selectedCustomer} orders={orders} onBack={() => setView('CUSTOMERS')} onViewOrder={(id) => { setSelectedOrderId(id); setView('ORDER_DETAILS'); }} onNewOrder={() => setView('ORDER_NEW')} /> : null;
          // Fix: Added missing onSendWhatsApp required prop
          case 'COLLECTIONS': return <PaymentCollections orders={orders} onViewOrder={(id) => { setSelectedOrderId(id); setView('ORDER_DETAILS'); }} onAddLog={addLog} settings={settings} onSendWhatsApp={() => {}} />;
          case 'WHATSAPP': return <WhatsAppPanel logs={logs} customers={customers} onRefreshStatus={() => {}} templates={templates} onAddLog={addLog} initialContact={selectedChatPhone} />;
          case 'TEMPLATES': return <WhatsAppTemplates templates={templates} onUpdate={setTemplates} />;
          case 'LOGS': return <WhatsAppLogs logs={logs} onViewChat={(phone) => { setSelectedChatPhone(phone); setView('WHATSAPP'); }} />;
          case 'PLANS': return <PlanManager templates={planTemplates} onUpdate={(tpls) => { setPlanTemplates(tpls); storageService.setPlanTemplates(tpls); }} />;
          case 'STRATEGY': return <NotificationCenter notifications={notificationTriggers} customers={customers} onSend={() => {}} onRefresh={() => {}} loading={false} />;
          case 'MARKET': return <MarketIntelligence />;
          case 'SYS_LOGS': return <ErrorLogPanel errors={systemErrors} activities={systemActivities} onClear={() => { errorService.clearErrors(); errorService.clearActivity(); }} />;
          case 'SETTINGS': return <Settings settings={settings} onUpdate={handleUpdateSettings} />;
          case 'MENU': return <div className="grid grid-cols-2 gap-4 pb-24 animate-fadeIn">
            <MenuItem onClick={() => setView('ORDER_BOOK')} icon={<BookOpen />} label="Registry" desc="Manage bookings" colorClass="bg-blue-50" />
            <MenuItem onClick={() => setView('CUSTOMERS')} icon={<Users />} label="Clients" desc="View profiles" colorClass="bg-emerald-50" />
            <MenuItem onClick={() => setView('WHATSAPP')} icon={<MessageSquare />} label="WhatsApp" desc="Chat hub" colorClass="bg-teal-50" />
            <MenuItem onClick={() => setView('SYS_LOGS')} icon={<HardDrive />} label="System" desc="Logs & Audit" colorClass="bg-slate-100" />
            <MenuItem onClick={() => setView('SETTINGS')} icon={<SettingsIcon />} label="Config" desc="Rates & DB" colorClass="bg-slate-800 text-white" />
          </div>;
          case 'CUSTOMER_VIEW': return selectedOrder ? <CustomerOrderView order={selectedOrder} /> : null;
          default: return <Dashboard orders={orders} currentRates={{k24: settings.currentGoldRate24K, k22: settings.currentGoldRate22K}} onNavigate={setView} />;
      }
  };

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-[#f8f9fa] font-sans text-slate-900 overflow-hidden">
        <div className="hidden lg:flex flex-col w-72 bg-white border-r p-6 shadow-sm z-20">
             <div className="mb-10 flex items-center gap-3">
                 <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg"><span className="text-white font-black">A</span></div>
                 <div><h1 className="font-serif font-black text-xl">AuraGold</h1><p className="text-[10px] text-slate-400 font-bold uppercase">Enterprise OS</p></div>
             </div>
             <div className="flex-1 space-y-1 overflow-y-auto">
                 <SidebarItem active={view === 'DASH'} onClick={() => setView('DASH')} icon={Home} label="Dashboard" />
                 <SidebarItem active={view === 'ORDER_BOOK'} onClick={() => setView('ORDER_BOOK')} icon={BookOpen} label="Order Book" />
                 <SidebarItem active={view === 'CUSTOMERS'} onClick={() => setView('CUSTOMERS')} icon={Users} label="Clients" />
                 <SidebarItem active={view === 'COLLECTIONS'} onClick={() => setView('COLLECTIONS')} icon={ReceiptIndianRupee} label="Payments" />
                 <SidebarItem active={view === 'WHATSAPP'} onClick={() => setView('WHATSAPP')} icon={MessageSquare} label="WhatsApp" />
                 <SidebarItem active={view === 'SETTINGS'} onClick={() => setView('SETTINGS')} icon={SettingsIcon} label="Settings" />
                 <SidebarItem active={view === 'SYS_LOGS'} onClick={() => setView('SYS_LOGS')} icon={HardDrive} label="System Logs" />
             </div>
        </div>
        <div className="flex-1 overflow-hidden relative flex flex-col">
            <main className="flex-1 overflow-y-auto p-4 lg:p-8 pt-20 lg:pt-8 pb-32 lg:pb-8">
               <Suspense fallback={<LoadingScreen />}>{renderContent()}</Suspense>
            </main>
        </div>
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t h-[84px] pb-6 px-6 flex justify-between items-center z-50">
             <TabBarItem active={view === 'DASH'} onClick={() => setView('DASH')} icon={<Home />} label="Home" />
             <TabBarItem active={view === 'ORDER_BOOK'} onClick={() => setView('ORDER_BOOK')} icon={<BookOpen />} label="Orders" />
             <div className="-mt-8"><button onClick={() => setView('MENU')} className="w-14 h-14 rounded-full bg-slate-900 text-white shadow-xl flex items-center justify-center">{view === 'MENU' ? <X /> : <Menu />}</button></div>
             <TabBarItem active={view === 'COLLECTIONS'} onClick={() => setView('COLLECTIONS')} icon={<ReceiptIndianRupee />} label="Pay" />
             <TabBarItem active={view === 'WHATSAPP'} onClick={() => setView('WHATSAPP')} icon={<MessageSquare />} label="Chat" />
        </div>
      </div>
    </ErrorBoundary>
  );
};

const SidebarItem = ({ active, onClick, icon: Icon, label }: any) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${active ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>
    <Icon size={18} className={active ? 'text-amber-400' : 'text-slate-400'} /><span>{label}</span>
  </button>
);

const TabBarItem = ({ icon, label, active, onClick }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 w-14 transition-all ${active ? 'text-amber-600' : 'text-slate-400 opacity-60'}`}>
    <div className={`p-1.5 rounded-xl ${active ? 'bg-amber-50' : ''}`}>{React.cloneElement(icon, { size: 22 })}</div>
    <span className="text-[9px] font-black uppercase">{label}</span>
  </button>
);

const MenuItem = ({ icon, label, desc, onClick, colorClass }: any) => (
  <button onClick={onClick} className={`bg-white p-5 rounded-3xl border shadow-sm transition-all flex flex-col items-start text-left group`}>
    <div className={`p-3 rounded-2xl mb-3 ${colorClass}`}>{React.cloneElement(icon, { size: 24 })}</div>
    <h3 className="font-bold text-slate-800 text-sm">{label}</h3>
    <p className="text-[10px] text-slate-500 leading-relaxed mt-1">{desc}</p>
  </button>
);

export default App;
