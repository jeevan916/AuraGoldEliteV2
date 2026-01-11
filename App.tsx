
import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, ShoppingBag, Users, ReceiptIndianRupee, 
  MessageSquare, Globe, Settings as SettingsIcon, AlertTriangle, 
  Plus, ShieldCheck, LogOut, Briefcase
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

  return (
    <ErrorBoundary>
      <div className="flex h-screen overflow-hidden bg-[#f8fafc]">
        {/* Elite Sidebar */}
        <aside className="w-20 lg:w-72 bg-[#0f172a] flex flex-col px-3 lg:px-6 py-8 text-white shrink-0 z-50">
          <div className="mb-12 flex items-center gap-3 px-2">
            <div className="w-10 h-10 bg-gradient-to-tr from-amber-600 to-amber-400 rounded-xl flex items-center justify-center shadow-lg shadow-amber-900/40">
              <Briefcase size={20} className="text-white" />
            </div>
            <div className="hidden lg:block">
              <h1 className="text-2xl font-serif-elite italic font-black text-amber-500 leading-none">AuraGold</h1>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-1">Enterprise Elite</p>
            </div>
          </div>

          <nav className="flex-1 space-y-8 overflow-y-auto custom-scrollbar pr-1">
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

          {/* Sidebar System Dock */}
          <div className="pt-6 mt-6 border-t border-slate-800/60 space-y-1">
             <NavItem 
              icon={<AlertTriangle size={18} className={errors.length > 0 ? "text-rose-400" : ""}/>} 
              label="Incident Logs" 
              active={view==='LOGS'} 
              onClick={()=>setView('LOGS')} 
              count={errors.filter(e => e.status !== 'RESOLVED').length} 
            />
            <NavItem 
              icon={<SettingsIcon size={18}/>} 
              label="Global Settings" 
              active={view==='SETTINGS'} 
              onClick={()=>setView('SETTINGS')} 
            />
            <button className="flex items-center gap-4 w-full p-3.5 text-slate-500 hover:text-rose-400 transition-all text-xs font-bold group rounded-xl hover:bg-rose-500/5 mt-4">
              <LogOut size={18} /> <span className="hidden lg:block group-hover:translate-x-1 transition-transform">Terminate Session</span>
            </button>
          </div>
        </aside>

        {/* Workspace */}
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-10">
          <div className="max-w-[1500px] mx-auto">
            {view === 'DASH' && <Dashboard orders={orders} currentRates={{ k24: settings.currentGoldRate24K, k22: settings.currentGoldRate22K }} />}
            {view === 'ORDER_NEW' && <OrderForm settings={settings} onSubmit={(o) => { addOrder(o); setView('ORDER_DETAILS'); setSelectedOrderId(o.id); }} onCancel={() => setView('DASH')} />}
            {view === 'ORDER_DETAILS' && (activeOrder ? <OrderDetails order={activeOrder} settings={settings} onBack={() => setView('DASH')} onUpdateStatus={(itemId, status) => updateItemStatus(activeOrder.id, itemId, status)} onRecordPayment={recordPayment} onOrderUpdate={updateOrder} onSendPaymentRequest={()=>{}} onTriggerLapse={()=>{}} logs={logs} onAddLog={addLog} /> : <div className="text-center py-20 text-slate-400 font-medium">Select an order from the ledger to manage.</div>)}
            {view === 'CUSTOMERS' && <CustomerList customers={customers} orders={orders} onViewOrder={(id)=>{setSelectedOrderId(id); setView('ORDER_DETAILS');}} onMessageSent={addLog} />}
            {view === 'COLLECTIONS' && <PaymentCollections orders={orders} onViewOrder={(id)=>{setSelectedOrderId(id); setView('ORDER_DETAILS');}} onSendWhatsApp={()=>{}} settings={settings} />}
            {view === 'WHATSAPP' && <WhatsAppPanel logs={logs} customers={customers} onRefreshStatus={() => {}} templates={templates} onAddLog={addLog} initialContact={waInitialContact} />}
            {view === 'TEMPLATES' && <WhatsAppTemplates templates={templates} onUpdate={setTemplates} />}
            {view === 'MARKET' && <MarketIntelligence />}
            {view === 'LOGS' && <ErrorLogPanel errors={errors} activities={activities} onClear={() => errorService.clearErrors()} onResolveAction={(path)=>{setView(path.toUpperCase() as any)}} />}
            {view === 'SETTINGS' && <Settings settings={settings} onUpdate={setSettings} />}
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
};

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
