
import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, ShoppingBag, Users, ReceiptIndianRupee, 
  MessageSquare, Globe, Settings as SettingsIcon, AlertTriangle, 
  Plus, ShieldCheck, LogOut
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
import { INITIAL_SETTINGS } from './constants';
import { Order, GlobalSettings, AppResolutionPath, Customer } from './types';

type MainView = 'DASH' | 'ORDER_NEW' | 'ORDER_DETAILS' | 'CUSTOMERS' | 'COLLECTIONS' | 'WHATSAPP' | 'TEMPLATES' | 'MARKET' | 'LOGS' | 'SETTINGS';

const App: React.FC = () => {
  const [view, setView] = useState<MainView>('DASH');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [waInitialContact, setWaInitialContact] = useState<string | null>(null);
  
  const { orders, addOrder, recordPayment, updateItemStatus, updateOrder } = useOrders();
  const { logs, templates, addLog, setTemplates } = useWhatsApp();
  
  const [settings, setSettings] = useState<GlobalSettings>(() => {
    try {
      const saved = localStorage.getItem('aura_settings');
      return saved ? JSON.parse(saved) : INITIAL_SETTINGS;
    } catch (e) {
      return INITIAL_SETTINGS;
    }
  });

  const [errors, setErrors] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);

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
        setSettings(prev => ({
          ...prev,
          currentGoldRate24K: res.rate24K,
          currentGoldRate22K: res.rate22K
        }));
      }
    };
    sync();
    const interval = setInterval(sync, 300000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    localStorage.setItem('aura_settings', JSON.stringify(settings));
  }, [settings]);

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

  const navigateToOrder = (id: string) => {
    setSelectedOrderId(id);
    setView('ORDER_DETAILS');
  };

  const handleResolveAction = (path: AppResolutionPath) => {
    switch(path) {
      case 'settings': setView('SETTINGS'); break;
      case 'templates': setView('TEMPLATES'); break;
      case 'whatsapp': setView('WHATSAPP'); break;
      default: break;
    }
  };

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-[#f8fafc] text-slate-900 overflow-hidden font-sans">
        <aside className="w-20 lg:w-72 bg-slate-900 flex flex-col p-4 lg:p-6 text-white shrink-0 shadow-2xl z-40">
          <div className="mb-10 px-2 flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-slate-900 font-black shadow-lg shadow-amber-500/20">AG</div>
            <div className="hidden lg:block">
              <h1 className="text-xl font-black text-amber-500 font-serif italic tracking-tighter">AuraGold</h1>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Elite Backend</p>
            </div>
          </div>

          <nav className="flex-1 space-y-1">
            <NavGroup label="Insights">
              <NavItem icon={<LayoutDashboard size={20}/>} label="Dashboard" active={view==='DASH'} onClick={()=>setView('DASH')} />
              <NavItem icon={<Globe size={20}/>} label="Market Intel" active={view==='MARKET'} onClick={()=>setView('MARKET')} />
            </NavGroup>

            <NavGroup label="Orders">
              <NavItem icon={<Plus size={20}/>} label="New Booking" active={view==='ORDER_NEW'} onClick={()=>setView('ORDER_NEW')} />
              <NavItem icon={<ShoppingBag size={20}/>} label="Order Ledger" active={view==='ORDER_DETAILS'} onClick={() => setView('ORDER_DETAILS')} />
              <NavItem icon={<Users size={20}/>} label="Customers" active={view==='CUSTOMERS'} onClick={()=>setView('CUSTOMERS')} />
            </NavGroup>

            <NavGroup label="Operations">
              <NavItem icon={<ReceiptIndianRupee size={20}/>} label="Collections" active={view==='COLLECTIONS'} onClick={()=>setView('COLLECTIONS')} />
              <NavItem icon={<MessageSquare size={20}/>} label="WhatsApp Hub" active={view==='WHATSAPP'} onClick={()=>setView('WHATSAPP')} />
              <NavItem icon={<ShieldCheck size={20}/>} label="Templates" active={view==='TEMPLATES'} onClick={()=>setView('TEMPLATES')} />
            </NavGroup>

            <NavGroup label="System">
              <NavItem icon={<AlertTriangle size={20}/>} label="Error Logs" active={view==='LOGS'} onClick={()=>setView('LOGS')} count={errors.filter(e => e.status !== 'RESOLVED').length} />
              <NavItem icon={<SettingsIcon size={20}/>} label="Global Settings" active={view==='SETTINGS'} onClick={()=>setView('SETTINGS')} />
            </NavGroup>
          </nav>

          <div className="mt-auto pt-6 border-t border-slate-800">
            <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700 hidden lg:block mb-4">
              <p className="text-[10px] font-black uppercase text-amber-500 tracking-widest mb-1">Live 22K Market</p>
              <p className="text-lg font-black tracking-tight">₹{settings.currentGoldRate22K.toLocaleString()}/g</p>
            </div>
            <button className="flex items-center gap-3 w-full p-3 text-slate-400 hover:text-rose-400 transition-colors text-sm font-bold">
              <LogOut size={18} /> <span className="hidden lg:block">Terminal Logout</span>
            </button>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto custom-scrollbar p-4 lg:p-8">
          <div className="max-w-[1600px] mx-auto">
            {view === 'DASH' && <Dashboard orders={orders} currentRates={{ k24: settings.currentGoldRate24K, k22: settings.currentGoldRate22K }} />}
            {view === 'ORDER_NEW' && <OrderForm settings={settings} onSubmit={(o) => { addOrder(o); navigateToOrder(o.id); }} onCancel={() => setView('DASH')} />}
            {view === 'ORDER_DETAILS' && (activeOrder ? <OrderDetails order={activeOrder} settings={settings} onBack={() => setView('DASH')} onUpdateStatus={(itemId, status) => updateItemStatus(activeOrder.id, itemId, status)} onRecordPayment={recordPayment} onSendPaymentRequest={() => {}} onOrderUpdate={updateOrder} onTriggerLapse={() => {}} logs={logs} onAddLog={addLog} /> : <div>Select Order</div>)}
            {view === 'CUSTOMERS' && <CustomerList customers={customers} orders={orders} onViewOrder={navigateToOrder} onMessageSent={addLog} />}
            {view === 'COLLECTIONS' && <PaymentCollections orders={orders} onViewOrder={navigateToOrder} onSendWhatsApp={() => {}} settings={settings} />}
            {view === 'WHATSAPP' && <WhatsAppPanel logs={logs} customers={customers} onRefreshStatus={() => {}} templates={templates} onAddLog={addLog} initialContact={waInitialContact} />}
            {view === 'TEMPLATES' && <WhatsAppTemplates templates={templates} onUpdate={setTemplates} />}
            {view === 'MARKET' && <MarketIntelligence />}
            {view === 'LOGS' && <ErrorLogPanel errors={errors} activities={activities} onClear={() => errorService.clearErrors()} onResolveAction={handleResolveAction} />}
            {view === 'SETTINGS' && <Settings settings={settings} onUpdate={setSettings} />}
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
};

const NavGroup = ({ label, children }: { label: string, children: React.ReactNode }) => (
  <div className="pt-6 first:pt-0">
    <p className="px-4 text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] mb-3 hidden lg:block">{label}</p>
    <div className="space-y-1">{children}</div>
  </div>
);

const NavItem = ({ icon, label, active, onClick, count }: any) => (
  <button 
    onClick={onClick} 
    className={`flex items-center gap-4 w-full p-3.5 rounded-xl transition-all relative group ${
      active 
      ? 'bg-amber-500 text-slate-900 font-black shadow-lg shadow-amber-500/20' 
      : 'text-slate-400 hover:text-white hover:bg-slate-800'
    }`}
  >
    <span className="shrink-0">{icon}</span>
    <span className="text-sm font-bold hidden lg:block flex-1 text-left">{label}</span>
    {count !== undefined && count > 0 && (
      <span className="absolute right-3 top-3 lg:static bg-rose-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center">
        {count}
      </span>
    )}
  </button>
);

export default App;
