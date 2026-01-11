
import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Users, 
  ReceiptIndianRupee, 
  MessageSquare, 
  Globe, 
  Settings as SettingsIcon, 
  AlertTriangle, 
  Plus, 
  ShieldCheck, 
  LogOut 
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
import { GlobalSettings, AppResolutionPath, Customer } from './types';

type MainView = 
  | 'DASH' 
  | 'ORDER_NEW' 
  | 'ORDER_DETAILS' 
  | 'CUSTOMERS' 
  | 'COLLECTIONS' 
  | 'WHATSAPP' 
  | 'TEMPLATES' 
  | 'MARKET' 
  | 'LOGS' 
  | 'SETTINGS';

const App: React.FC = () => {
  const [view, setView] = useState<MainView>('DASH');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  
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

  // Monitoring
  useEffect(() => {
    errorService.initGlobalListeners();
    const unsubscribe = errorService.subscribe((currErrors, currActs) => {
      setErrors(currErrors);
      setActivities(currActs);
    });
    return unsubscribe;
  }, []);

  // Gold Rate Heartbeat
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
    const id = setInterval(sync, 300000);
    return () => clearInterval(id);
  }, []);

  // Persist
  useEffect(() => {
    localStorage.setItem('aura_settings', JSON.stringify(settings));
  }, [settings]);

  // Unified Customer Database
  const customers = useMemo(() => {
    const map = new Map<string, Customer>();
    orders.forEach(o => {
      const contact = o.customerContact;
      if (!map.has(contact)) {
        map.set(contact, {
          id: `CUST-${contact}`,
          name: o.customerName,
          contact: contact,
          email: o.customerEmail,
          orderIds: [o.id],
          totalSpent: o.payments.reduce((sum, p) => sum + p.amount, 0),
          joinDate: o.createdAt
        });
      } else {
        const c = map.get(contact)!;
        c.orderIds.push(o.id);
        c.totalSpent += o.payments.reduce((sum, p) => sum + p.amount, 0);
      }
    });
    return Array.from(map.values());
  }, [orders]);

  const activeOrder = orders.find(o => o.id === selectedOrderId);

  const handleNavigateToOrder = (id: string) => {
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
        
        {/* Navigation Sidebar */}
        <aside className="w-20 lg:w-72 bg-slate-900 flex flex-col p-4 lg:p-6 text-white shrink-0 shadow-2xl z-40 transition-all duration-300">
          <div className="mb-10 px-2 flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-slate-900 font-black shadow-lg shadow-amber-500/20">AG</div>
            <div className="hidden lg:block">
              <h1 className="text-xl font-black text-amber-500 font-serif italic tracking-tighter">AuraGold</h1>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Enterprise Suite</p>
            </div>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto custom-scrollbar pr-2">
            <NavGroup label="Strategy">
              <NavItem icon={<LayoutDashboard size={20}/>} label="Dashboard" active={view==='DASH'} onClick={()=>setView('DASH')} />
              <NavItem icon={<Globe size={20}/>} label="Market Live" active={view==='MARKET'} onClick={()=>setView('MARKET')} />
            </NavGroup>

            <NavGroup label="Commerce">
              <NavItem icon={<Plus size={20}/>} label="New Booking" active={view==='ORDER_NEW'} onClick={()=>setView('ORDER_NEW')} />
              <NavItem icon={<ShoppingBag size={20}/>} label="Order Ledger" active={view==='ORDER_DETAILS'} onClick={() => setView('ORDER_DETAILS')} />
              <NavItem icon={<Users size={20}/>} label="Client Directory" active={view==='CUSTOMERS'} onClick={()=>setView('CUSTOMERS')} />
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
            <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700 hidden lg:block mb-4 text-center">
              <p className="text-[10px] font-black uppercase text-amber-500 tracking-widest mb-1">Live 22K Market</p>
              <p className="text-lg font-black tracking-tight">₹{settings.currentGoldRate22K.toLocaleString()}/g</p>
            </div>
            <button className="flex items-center gap-3 w-full p-3.5 text-slate-400 hover:text-rose-400 transition-colors text-sm font-bold group">
              <LogOut size={18} className="group-hover:rotate-180 transition-transform duration-500" /> 
              <span className="hidden lg:block">Sign Out</span>
            </button>
          </div>
        </aside>

        {/* Dynamic Workspace */}
        <main className="flex-1 overflow-y-auto custom-scrollbar p-4 lg:p-8">
          <div className="max-w-[1600px] mx-auto animate-fadeIn">
            {view === 'DASH' && <Dashboard orders={orders} currentRates={{ k24: settings.currentGoldRate24K, k22: settings.currentGoldRate22K }} />}
            {view === 'ORDER_NEW' && <OrderForm settings={settings} onSubmit={(o) => { addOrder(o); handleNavigateToOrder(o.id); }} onCancel={() => setView('DASH')} />}
            
            {view === 'ORDER_DETAILS' && (activeOrder ? (
              <OrderDetails 
                order={activeOrder} 
                settings={settings} 
                onBack={() => setView('DASH')} 
                onUpdateStatus={(itemId, status) => updateItemStatus(activeOrder.id, itemId, status)} 
                onRecordPayment={recordPayment} 
                onSendPaymentRequest={() => {}} 
                onOrderUpdate={updateOrder} 
                onTriggerLapse={() => {}} 
                logs={logs} 
                onAddLog={addLog} 
              />
            ) : (
              <div className="p-16 text-center text-slate-400 font-bold uppercase tracking-widest border-4 border-dashed rounded-[3rem] bg-white/50">
                Select an entry from the ledger to view active order details
              </div>
            ))}

            {view === 'CUSTOMERS' && <CustomerList customers={customers} orders={orders} onViewOrder={handleNavigateToOrder} onMessageSent={addLog} />}
            {view === 'COLLECTIONS' && <PaymentCollections orders={orders} onViewOrder={handleNavigateToOrder} onSendWhatsApp={() => {}} settings={settings} />}
            {view === 'WHATSAPP' && <WhatsAppPanel logs={logs} customers={customers} onRefreshStatus={() => {}} templates={templates} onAddLog={addLog} />}
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

/**
 * Functional Sidebar Subcomponents
 */
const NavGroup: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="pt-6 first:pt-0">
    <p className="px-4 text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] mb-3 hidden lg:block">
      {label}
    </p>
    <div className="space-y-1">{children}</div>
  </div>
);

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, active, onClick, count }) => (
  <button 
    onClick={onClick} 
    className={`flex items-center gap-4 w-full p-3.5 rounded-xl transition-all relative group ${
      active 
      ? 'bg-amber-500 text-slate-900 font-black shadow-lg shadow-amber-500/20' 
      : 'text-slate-400 hover:text-white hover:bg-slate-800'
    }`}
  >
    <span className="shrink-0 flex items-center justify-center">{icon}</span>
    <span className="text-sm font-bold hidden lg:block flex-1 text-left">{label}</span>
    {typeof count === 'number' && count > 0 && (
      <span className="absolute right-3 top-3 lg:static bg-rose-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-900">
        {count}
      </span>
    )}
  </button>
);

export default App;
