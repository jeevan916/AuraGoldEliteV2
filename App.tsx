
import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, ShoppingBag, Users, ReceiptIndianRupee, 
  MessageSquare, Globe, Settings as SettingsIcon, AlertTriangle, 
  Plus, ShieldCheck, LogOut, Briefcase, Menu, X, ArrowLeft, Home,
  MoreHorizontal, PlusCircle
} from 'lucide-react';

// Modules
import Dashboard from './components/Dashboard';
import OrderForm from './components/OrderForm';
import OrderDetails from './components/OrderDetails';
import CustomerList from './components/CustomerList';
import PaymentCollections from './components/PaymentCollections';
import WhatsAppPanel from './components/WhatsAppPanel';
import WhatsAppTemplates from './components/WhatsAppTemplates';
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
import { Order, GlobalSettings, AppResolutionPath, Customer } from './types';
import { INITIAL_SETTINGS } from './constants';

type MainView = 'DASH' | 'ORDER_NEW' | 'ORDER_DETAILS' | 'CUSTOMERS' | 'COLLECTIONS' | 'WHATSAPP' | 'TEMPLATES' | 'MARKET' | 'LOGS' | 'SETTINGS' | 'MENU';

const App: React.FC = () => {
  const [view, setView] = useState<MainView>('DASH');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [waInitialContact, setWaInitialContact] = useState<string | null>(null);
  
  const { orders, addOrder, recordPayment, updateItemStatus, updateOrder } = useOrders();
  const { logs, templates, addLog, setTemplates } = useWhatsApp();
  
  // Use Storage Service for Settings
  const [settings, setSettingsState] = useState<GlobalSettings>(storageService.getSettings());

  const setSettings = (newSettings: GlobalSettings) => {
    setSettingsState(newSettings);
    storageService.setSettings(newSettings);
  };

  const [errors, setErrors] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);

  // Subscribe to storage changes to keep settings in sync (e.g. from server pull)
  useEffect(() => {
    const unsubscribe = storageService.subscribe(() => {
       setSettingsState(storageService.getSettings());
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    errorService.initGlobalListeners();
    const unsubscribe = errorService.subscribe((errs, acts) => {
      setErrors(errs);
      setActivities(acts);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const sync = async () => {
      const res = await goldRateService.fetchLiveRate();
      if (res.success) {
        setSettings({
          ...settings,
          currentGoldRate24K: res.rate24K,
          currentGoldRate22K: res.rate22K
        });
      }
    };
    sync();
    const interval = setInterval(sync, 300000);
    return () => clearInterval(interval);
  }, []);

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

  // Helper to handle back navigation on mobile
  const handleBack = () => {
    if (view === 'ORDER_DETAILS') setView('CUSTOMERS');
    else if (view === 'ORDER_NEW') setView('DASH');
    else setView('DASH');
  };

  const getViewTitle = () => {
    switch(view) {
      case 'DASH': return 'Dashboard';
      case 'ORDER_NEW': return 'New Booking';
      case 'ORDER_DETAILS': return 'Order Details';
      case 'CUSTOMERS': return 'Clients';
      case 'COLLECTIONS': return 'Collections';
      case 'WHATSAPP': return 'Chats';
      case 'SETTINGS': return 'Settings';
      case 'MENU': return 'More';
      default: return 'AuraGold';
    }
  };

  return (
    <ErrorBoundary>
      <div className="flex h-screen overflow-hidden bg-[#f2f2f7]">
        
        {/* DESKTOP SIDEBAR (Hidden on Mobile) */}
        <aside className="hidden lg:flex w-72 bg-[#0f172a] flex-col px-6 py-8 text-white shrink-0 z-50">
          <div className="mb-12 flex items-center gap-3 px-2">
            <div className="w-10 h-10 bg-gradient-to-tr from-amber-600 to-amber-400 rounded-xl flex items-center justify-center shadow-lg shadow-amber-900/40">
              <Briefcase size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-serif-elite italic font-black text-amber-500 leading-none">AuraGold</h1>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-1">Enterprise Elite</p>
            </div>
          </div>
          <nav className="flex-1 space-y-6 overflow-y-auto custom-scrollbar pr-1">
             <NavGroup label="Insights">
              <NavItem icon={<LayoutDashboard size={18}/>} label="Dashboard" active={view==='DASH'} onClick={()=>setView('DASH')} />
              <NavItem icon={<Globe size={18}/>} label="Market Intel" active={view==='MARKET'} onClick={()=>setView('MARKET')} />
            </NavGroup>
            <NavGroup label="Commerce">
              <NavItem icon={<Plus size={18}/>} label="New Booking" active={view==='ORDER_NEW'} onClick={()=>setView('ORDER_NEW')} />
              <NavItem icon={<ShoppingBag size={18}/>} label="Order Ledger" active={view==='ORDER_DETAILS'} onClick={() => setView('ORDER_DETAILS')} />
              <NavItem icon={<Users size={18}/>} label="Client Directory" active={view==='CUSTOMERS'} onClick={()=>setView('CUSTOMERS')} />
            </NavGroup>
            <NavGroup label="Operations">
              <NavItem icon={<ReceiptIndianRupee size={18}/>} label="Collections" active={view==='COLLECTIONS'} onClick={()=>setView('COLLECTIONS')} />
              <NavItem icon={<MessageSquare size={18}/>} label="WhatsApp Hub" active={view==='WHATSAPP'} onClick={()=>setView('WHATSAPP')} />
              <NavItem icon={<ShieldCheck size={18}/>} label="Meta Templates" active={view==='TEMPLATES'} onClick={()=>setView('TEMPLATES')} />
            </NavGroup>
          </nav>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 flex flex-col h-full relative w-full">
          
          {/* MOBILE HEADER (Glassmorphic) */}
          <header className="lg:hidden glass-header px-4 py-3 flex items-center justify-between transition-all duration-200">
             <div className="flex items-center gap-3">
               {(view !== 'DASH' && view !== 'MENU') ? (
                 <button onClick={handleBack} className="p-2 -ml-2 text-amber-600 active:opacity-50">
                    <ArrowLeft size={24} strokeWidth={2.5} />
                 </button>
               ) : (
                  <div className="w-8 h-8 bg-gradient-to-tr from-amber-600 to-amber-400 rounded-lg flex items-center justify-center shadow-sm">
                    <Briefcase size={16} className="text-white" />
                  </div>
               )}
               <h1 className="text-xl font-bold tracking-tight text-slate-900">{getViewTitle()}</h1>
             </div>
             <div className="flex items-center gap-2">
                {view === 'DASH' && (
                  <button onClick={() => setView('ORDER_NEW')} className="text-amber-600 active:opacity-50">
                    <PlusCircle size={28} />
                  </button>
                )}
             </div>
          </header>

          {/* SCROLLABLE CONTENT */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar pb-24 lg:pb-0 p-4 lg:p-10 w-full">
            <div className="max-w-[1500px] mx-auto space-y-4">
              {view === 'DASH' && <Dashboard orders={orders} currentRates={{ k24: settings.currentGoldRate24K, k22: settings.currentGoldRate22K }} />}
              {view === 'ORDER_NEW' && <OrderForm settings={settings} onSubmit={(o) => { addOrder(o); setView('ORDER_DETAILS'); setSelectedOrderId(o.id); }} onCancel={() => setView('DASH')} />}
              {view === 'ORDER_DETAILS' && (activeOrder ? <OrderDetails order={activeOrder} settings={settings} onBack={() => setView('CUSTOMERS')} onUpdateStatus={(itemId, status) => updateItemStatus(activeOrder.id, itemId, status)} onRecordPayment={recordPayment} onOrderUpdate={updateOrder} onSendPaymentRequest={()=>{}} onTriggerLapse={()=>{}} logs={logs} onAddLog={addLog} /> : <div className="text-center py-20 text-slate-400 font-medium">Select an order from the ledger to manage.</div>)}
              {view === 'CUSTOMERS' && <CustomerList customers={customers} orders={orders} onViewOrder={(id)=>{setSelectedOrderId(id); setView('ORDER_DETAILS');}} onMessageSent={addLog} />}
              {view === 'COLLECTIONS' && <PaymentCollections orders={orders} onViewOrder={(id)=>{setSelectedOrderId(id); setView('ORDER_DETAILS');}} onSendWhatsApp={()=>{}} settings={settings} />}
              {view === 'WHATSAPP' && <WhatsAppPanel logs={logs} customers={customers} onRefreshStatus={() => {}} templates={templates} onAddLog={addLog} initialContact={waInitialContact} />}
              {view === 'TEMPLATES' && <WhatsAppTemplates templates={templates} onUpdate={setTemplates} />}
              {view === 'MARKET' && <MarketIntelligence />}
              {view === 'LOGS' && <ErrorLogPanel errors={errors} activities={activities} onClear={() => errorService.clearErrors()} onResolveAction={(path)=>{setView(path.toUpperCase() as any)}} />}
              {view === 'SETTINGS' && <Settings settings={settings} onUpdate={setSettings} />}
              
              {/* MOBILE MENU VIEW (Replaces Sidebar on Mobile) */}
              {view === 'MENU' && (
                <div className="space-y-6 animate-fadeIn pb-10">
                   <div className="ios-card p-4">
                      <div className="space-y-1">
                          <MobileMenuItem icon={<ReceiptIndianRupee size={20}/>} label="Collections" onClick={()=>{setView('COLLECTIONS')}} color="bg-emerald-500" />
                          <div className="h-[1px] bg-slate-100 ml-12" />
                          <MobileMenuItem icon={<MessageSquare size={20}/>} label="WhatsApp Hub" onClick={()=>{setView('WHATSAPP')}} color="bg-green-500" />
                          <div className="h-[1px] bg-slate-100 ml-12" />
                          <MobileMenuItem icon={<ShieldCheck size={20}/>} label="Templates" onClick={()=>{setView('TEMPLATES')}} color="bg-blue-500" />
                      </div>
                   </div>

                   <div className="ios-card p-4">
                      <div className="space-y-1">
                          <MobileMenuItem icon={<Globe size={20}/>} label="Market Intel" onClick={()=>{setView('MARKET')}} color="bg-indigo-500" />
                          <div className="h-[1px] bg-slate-100 ml-12" />
                          <MobileMenuItem icon={<AlertTriangle size={20}/>} label="System Logs" onClick={()=>{setView('LOGS')}} count={errors.length} color="bg-orange-500" />
                          <div className="h-[1px] bg-slate-100 ml-12" />
                          <MobileMenuItem icon={<SettingsIcon size={20}/>} label="Settings" onClick={()=>{setView('SETTINGS')}} color="bg-slate-500" />
                      </div>
                   </div>

                   <button className="w-full bg-white text-rose-600 font-bold py-4 rounded-2xl shadow-sm active:scale-95 transition-transform">
                      Log Out
                   </button>
                   
                   <p className="text-center text-xs text-slate-400 font-medium">AuraGold v3.1.0 (iOS Build)</p>
                </div>
              )}
            </div>
          </div>

          {/* MOBILE BOTTOM TAB BAR (Glassmorphic) */}
          <div className="lg:hidden glass-nav fixed bottom-0 w-full pb-[max(env(safe-area-inset-bottom),20px)] pt-3 px-6 flex justify-between items-end z-50">
             <TabBarItem icon={<Home size={24} />} label="Home" active={view === 'DASH'} onClick={() => setView('DASH')} />
             <TabBarItem icon={<Users size={24} />} label="Clients" active={view === 'CUSTOMERS' || view === 'ORDER_DETAILS'} onClick={() => setView('CUSTOMERS')} />
             
             {/* Center Action Button */}
             <div className="relative -top-5">
               <button 
                onClick={() => setView('ORDER_NEW')}
                className="w-14 h-14 bg-slate-900 rounded-full shadow-xl shadow-slate-900/30 flex items-center justify-center text-amber-400 active:scale-90 transition-transform"
               >
                 <Plus size={28} strokeWidth={3} />
               </button>
             </div>

             <TabBarItem icon={<ShoppingBag size={24} />} label="Orders" active={view === 'ORDER_DETAILS' && !selectedOrderId} onClick={() => { setSelectedOrderId(null); setView('ORDER_DETAILS'); }} />
             <TabBarItem icon={<Menu size={24} />} label="Menu" active={view === 'MENU'} onClick={() => setView('MENU')} />
          </div>

        </main>
      </div>
    </ErrorBoundary>
  );
};

const TabBarItem = ({ icon, label, active, onClick }: any) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center gap-1 w-14 transition-colors ${active ? 'text-amber-600' : 'text-slate-400'}`}
  >
    {React.cloneElement(icon, { strokeWidth: active ? 2.5 : 2 })}
    <span className="text-[10px] font-medium tracking-tight">{label}</span>
  </button>
);

const MobileMenuItem = ({ icon, label, onClick, color, count }: any) => (
  <button onClick={onClick} className="w-full flex items-center gap-4 py-3 active:bg-slate-50 rounded-xl transition-colors">
    <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center text-white shadow-sm`}>
      {React.cloneElement(icon, { size: 16 })}
    </div>
    <span className="flex-1 text-left font-semibold text-slate-900 text-[17px]">{label}</span>
    {count > 0 && <span className="bg-rose-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{count}</span>}
    <div className="text-slate-300"><ArrowLeft className="rotate-180" size={16} /></div>
  </button>
);

// Desktop Sidebar components kept for backward compatibility on large screens
const NavGroup = ({ label, children }: { label: string, children: React.ReactNode }) => (
  <div className="space-y-3">
    <p className="px-4 text-[9px] font-black uppercase text-slate-500 tracking-[0.4em] hidden lg:block">{label}</p>
    <div className="space-y-1">{children}</div>
  </div>
);

const NavItem = ({ icon, label, active, onClick, count }: any) => (
  <button 
    onClick={onClick} 
    className={`flex items-center gap-4 w-full p-3 rounded-xl transition-all relative group ${
      active 
      ? 'bg-amber-600 text-white font-semibold shadow-lg shadow-amber-900/20' 
      : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
    }`}
  >
    <span className={`shrink-0 transition-transform group-hover:scale-110 ${active ? 'text-white' : 'text-slate-500'}`}>{icon}</span>
    <span className="text-sm hidden lg:block flex-1 text-left">{label}</span>
    {count !== undefined && count > 0 && (
      <span className="absolute right-2 top-2 lg:static bg-rose-600 text-white text-[9px] w-5 h-5 rounded-full flex items-center justify-center font-black">
        {count}
      </span>
    )}
  </button>
);

export default App;
