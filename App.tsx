
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, ShoppingBag, Users, ReceiptIndianRupee, 
  MessageSquare, Globe, Settings as SettingsIcon, AlertTriangle, 
  Plus, ShieldCheck, LogOut, Briefcase, Menu, X, ArrowLeft, Home,
  MoreHorizontal, PlusCircle, Sparkles, Zap, BrainCircuit, FileText, 
  ScrollText, Activity, Server, Calculator, Loader2, WifiOff, Cloud, CloudOff, RefreshCw, ServerCrash, Database, ShieldAlert, AlertCircle, HardDrive, BookOpen
} from 'lucide-react';

// Modules
import Dashboard from './components/Dashboard';
import OrderForm from './components/OrderForm';
import OrderDetails from './components/OrderDetails';
import OrderBook from './components/OrderBook';
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
import { smsService } from './services/smsService';
import { Order, GlobalSettings, AppResolutionPath, Customer, NotificationTrigger, PaymentPlanTemplate, ProductionStatus, ProtectionStatus, JewelryDetail } from './types';
import { AUTOMATION_TEMPLATES } from './constants';

type MainView = 'DASH' | 'ORDER_NEW' | 'ORDER_DETAILS' | 'ORDER_BOOK' | 'CUSTOMERS' | 'COLLECTIONS' | 'WHATSAPP' | 'TEMPLATES' | 'PLANS' | 'LOGS' | 'STRATEGY' | 'MARKET' | 'SYS_LOGS' | 'SETTINGS' | 'MENU';

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
  const [syncStatus, setSyncStatus] = useState(storageService.getSyncStatus());
  
  const { orders, addOrder, recordPayment, updateItemStatus, updateOrder } = useOrders();
  const { logs, templates, addLog, setTemplates } = useWhatsApp();
  const [settings, setSettingsState] = useState<GlobalSettings>(storageService.getSettings());
  const [planTemplates, setPlanTemplates] = useState<PaymentPlanTemplate[]>(storageService.getPlanTemplates());

  const [notifications, setNotifications] = useState<NotificationTrigger[]>([]);
  const [isStrategyLoading, setStrategyLoading] = useState(false);
  const [sendingNotifId, setSendingNotifId] = useState<string | null>(null);
  
  // Auto-Pilot State
  const [autoPilotRan, setAutoPilotRan] = useState(false);
  const [autoPilotReport, setAutoPilotReport] = useState<string[]>([]);

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

  // --- NAVIGATION LOGIC (History API Integration) ---

  const navigateTo = (newView: MainView, orderId: string | null = null) => {
    if (view === newView && selectedOrderId === orderId) return;

    const slug = newView.toLowerCase().replace('_', '-');
    const hash = orderId ? `#${slug}/${orderId}` : `#${slug}`;

    window.history.pushState({ view: newView, orderId }, '', hash);
    
    setView(newView);
    if (orderId !== undefined) setSelectedOrderId(orderId);
  };

  const goBack = () => {
     if (window.history.state && window.history.length > 1) {
        window.history.back();
     } else {
        navigateTo('DASH'); 
     }
  };

  useEffect(() => {
    if (!window.history.state) {
      window.history.replaceState({ view: 'DASH', orderId: null }, '', '#queue');
    }

    const handlePopState = (event: PopStateEvent) => {
       if (event.state && event.state.view) {
          setView(event.state.view);
          setSelectedOrderId(event.state.orderId || null);
       } else {
          setView('DASH');
          setSelectedOrderId(null);
       }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // --- HELPER: Calculate New Order Total based on Live Rate ---
  const calculateRecalculatedTotal = (items: JewelryDetail[], currentRate: number, taxRate: number): number => {
      return items.reduce((total, item) => {
          // Logic mirrors OrderForm calculation
          // Only 22K/24K items are affected by the standard rate usually, assuming 22K for this context
          // or use the item's purity logic. For simplicity in lapse calc, we use the passed 24k/22k mapping
          
          // Re-calculate basic metal value
          const metalValue = item.netWeight * currentRate; // Simplified: Assuming all items scale with the base rate provided
          const wastageValue = metalValue * (item.wastagePercentage / 100);
          const laborValue = item.makingChargesPerGram * item.netWeight;
          const subTotal = metalValue + wastageValue + laborValue + item.stoneCharges;
          const tax = subTotal * (taxRate / 100);
          return total + subTotal + tax;
      }, 0);
  };

  // --- INTELLIGENT AUTO-PILOT ENGINE ---
  useEffect(() => {
      const runAutoPilot = async () => {
          if (isInitializing || autoPilotRan || orders.length === 0) return;
          
          console.log("🚀 [AutoPilot] System Intelligence Starting...");
          const today = new Date().toISOString().split('T')[0];
          const nowTime = new Date().getTime();
          const report: string[] = [];
          let actionsTaken = 0;

          // Clone orders to avoid direct state mutation during loop
          for (const order of orders) {
              const pendingMilestone = order.paymentPlan.milestones.find(m => m.status !== 'PAID');
              if (!pendingMilestone) continue;

              const dueDate = new Date(pendingMilestone.dueDate);
              const dueTime = dueDate.getTime();
              
              // 1. GRACE PERIOD MONITOR
              const graceLimitMs = (settings.gracePeriodHours || 24) * 60 * 60 * 1000;
              const isOverdue = nowTime > dueTime;
              const isWithinGrace = nowTime < (dueTime + graceLimitMs);

              if (isOverdue && isWithinGrace && order.paymentPlan.protectionStatus === ProtectionStatus.ACTIVE) {
                  // Check last message time to avoid flooding (cap at 6 times/day approx every 4 hours)
                  const lastLog = logs
                      .filter(l => l.phoneNumber.includes(order.customerContact.slice(-10)) && l.direction === 'outbound')
                      .sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
                  
                  const lastMsgTime = lastLog ? new Date(lastLog.timestamp).getTime() : 0;
                  const hoursSinceLast = (nowTime - lastMsgTime) / (1000 * 60 * 60);

                  if (hoursSinceLast >= 4) {
                      const count = pendingMilestone.warningCount || 0;
                      let message = '';
                      const cycle = count % 4;
                      if (cycle === 0) message = AUTOMATION_TEMPLATES.GRACE_WARNING_1(order.customerName, pendingMilestone.targetAmount);
                      else if (cycle === 1) message = AUTOMATION_TEMPLATES.GRACE_WARNING_2(order.customerName, pendingMilestone.targetAmount);
                      else if (cycle === 2) message = AUTOMATION_TEMPLATES.GRACE_WARNING_3(order.customerName, pendingMilestone.targetAmount);
                      else message = AUTOMATION_TEMPLATES.GRACE_WARNING_4(order.customerName, pendingMilestone.targetAmount);

                      await whatsappService.sendMessage(order.customerContact, message, order.customerName)
                          .then(res => { if(res.success && res.logEntry) addLog(res.logEntry); });
                      
                      report.push(`🔥 Grace Period Warning (${cycle + 1}/4) sent to ${order.customerName}`);
                      actionsTaken++;
                  }
              }

              // 2. LAPSE EVENT TRIGGER
              else if (isOverdue && !isWithinGrace && order.paymentPlan.protectionStatus === ProtectionStatus.ACTIVE) {
                  const snapshot = {
                      timestamp: new Date().toISOString(),
                      originalTotal: order.totalAmount,
                      originalRate: order.goldRateAtBooking,
                      itemsSnapshot: [...order.items],
                      reason: 'Grace Period Expired'
                  };

                  const updatedOrder: Order = {
                      ...order,
                      originalSnapshot: snapshot,
                      paymentPlan: {
                          ...order.paymentPlan,
                          protectionStatus: ProtectionStatus.LAPSED
                      }
                  };

                  updateOrder(updatedOrder);
                  
                  // Send Notification
                  const message = AUTOMATION_TEMPLATES.PROTECTION_LAPSED(order.customerName, order.shareToken);
                  await whatsappService.sendMessage(order.customerContact, message, order.customerName)
                      .then(res => { if(res.success && res.logEntry) addLog(res.logEntry); });

                  report.push(`⛔ PROTECTION LAPSED for ${order.customerName}. Snapshot saved.`);
                  actionsTaken++;
                  errorService.logActivity('PROTECTION_LAPSED', `Order ${order.id} protection lapsed due to non-payment.`);
              }

              // 3. DYNAMIC QUOTE GENERATOR (Post-Lapse)
              // Sends a new quote every time, keeping pressure on the customer
              else if (order.paymentPlan.protectionStatus === ProtectionStatus.LAPSED) {
                  const lastLog = logs
                      .filter(l => l.phoneNumber.includes(order.customerContact.slice(-10)) && l.direction === 'outbound')
                      .sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
                  
                  const lastMsgTime = lastLog ? new Date(lastLog.timestamp).getTime() : 0;
                  const daysSinceLast = (nowTime - lastMsgTime) / (1000 * 60 * 60 * 24);
                  
                  // Check frequency (followUpIntervalDays)
                  if (daysSinceLast >= (settings.followUpIntervalDays || 3)) {
                      
                      // CALCULATE DYNAMIC PRICE
                      // Use 22K rate for calculation base as most jewelry is 22K
                      const currentRate = settings.currentGoldRate22K; 
                      const newHypotheticalTotal = calculateRecalculatedTotal(order.items, currentRate, settings.defaultTaxRate);
                      
                      const message = AUTOMATION_TEMPLATES.LAPSE_DYNAMIC_QUOTE(
                          order.customerName, 
                          order.totalAmount, 
                          Math.round(newHypotheticalTotal),
                          currentRate,
                          order.shareToken
                      );

                      await whatsappService.sendMessage(order.customerContact, message, order.customerName)
                          .then(res => { if(res.success && res.logEntry) addLog(res.logEntry); });
                      
                      report.push(`📉 Dynamic Quote Sent to ${order.customerName}: New Total ₹${Math.round(newHypotheticalTotal).toLocaleString()}`);
                      actionsTaken++;
                  }
              }
          }

          if (actionsTaken > 0) {
              errorService.logActivity('MANUAL_MESSAGE_SENT', `Auto-Pilot executed ${actionsTaken} autonomous actions.`);
          }
          setAutoPilotReport(report);
          setAutoPilotRan(true);
      };

      runAutoPilot();
  }, [isInitializing, orders, logs, autoPilotRan, settings]);

  const handleRefreshRates = async () => {
      const rateRes = await goldRateService.fetchLiveRate();
      if (rateRes.success) {
          const currentSettings = storageService.getSettings();
          setSettings({
              ...currentSettings,
              currentGoldRate24K: rateRes.rate24K,
              currentGoldRate22K: rateRes.rate22K
          });
      }
  };

  const startApp = async () => {
    setIsInitializing(true);
    try {
      await storageService.syncFromServer();
      await handleRefreshRates();
    } catch (e: any) {
      console.warn("Initial sync handshake failed, using local state.");
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    (window as any).dispatchView = (v: MainView) => navigateTo(v);
    
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

  // --- AUTOMATED EVENT TRIGGERS ---

  const handleOrderCreate = async (newOrder: Order) => {
      addOrder(newOrder);
      
      const categories = Array.from(new Set(newOrder.items.map(i => i.category))).join(', ');
      const milestoneText = newOrder.paymentPlan.milestones.map((m, i) => {
          const dateStr = new Date(m.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
          return `${i + 1}. ${dateStr}: ₹${m.targetAmount.toLocaleString()}`;
      }).join('\n');

      // Use Smart Template from Constants (Deterministic)
      const message = AUTOMATION_TEMPLATES.ORDER_CONFIRMATION(
          newOrder.customerName, 
          categories, 
          newOrder.totalAmount, 
          newOrder.paymentPlan.months,
          milestoneText,
          newOrder.shareToken
      );

      whatsappService.sendMessage(newOrder.customerContact, message, newOrder.customerName)
        .then(res => { if (res.success && res.logEntry) addLog(res.logEntry); });

      navigateTo('ORDER_DETAILS', newOrder.id);
  };

  // Wrapper for Item Status Update to Trigger Notification
  const handleStatusUpdate = async (orderId: string, itemId: string, newStatus: ProductionStatus) => {
      const order = orders.find(o => o.id === orderId);
      if (!order) return;

      // 1. Update State
      updateItemStatus(orderId, itemId, newStatus);

      // 2. Trigger Notification (Intelligence)
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

  const handleSendNotification = async (id: string, channel: 'WHATSAPP' | 'SMS' = 'WHATSAPP') => {
    setSendingNotifId(id);
    const notif = notifications.find(n => n.id === id);
    if (!notif) return setSendingNotifId(null);

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
        <p className="text-slate-400 text-xs mt-2 font-medium">Booting System Logic...</p>
      </div>
    );
  }

  const getViewTitle = () => {
    switch(view) {
      case 'DASH': return 'Collection Queue';
      case 'ORDER_NEW': return 'New Booking';
      case 'ORDER_DETAILS': return 'Order Ledger';
      case 'ORDER_BOOK': return 'Order Repository';
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
                 <button onClick={goBack} className="p-1 text-slate-900 active:scale-90 transition-transform">
                    <ArrowLeft size={24} />
                 </button>
               ) : (
                  <button onClick={() => navigateTo('MENU')} className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center shadow-lg active:scale-90 transition-transform relative">
                    <Menu size={20} className="text-white" />
                  </button>
               )}
               <div>
                    <h1 className="text-xl font-black tracking-tight text-slate-900 truncate max-w-[200px] leading-tight">{getViewTitle()}</h1>
                    <div className="flex items-center gap-1">
                        {syncStatus === 'CONNECTED' ? (
                            <span className="text-[8px] font-black uppercase text-emerald-600 flex items-center gap-1">
                                <Cloud size={10} /> Live Database Linked
                            </span>
                        ) : syncStatus === 'SYNCING' ? (
                            <span className="text-[8px] font-black uppercase text-blue-600 flex items-center gap-1">
                                <Loader2 size={10} className="animate-spin" /> Synchronizing...
                            </span>
                        ) : (
                            <span className="text-[8px] font-black uppercase text-amber-600 flex items-center gap-1">
                                <HardDrive size={10} /> Local Fallback Mode
                            </span>
                        )}
                        {autoPilotRan && (
                            <span className="text-[8px] font-black uppercase text-violet-600 flex items-center gap-1 ml-2 animate-fadeIn">
                                <BrainCircuit size={10} /> Auto-Pilot Active
                            </span>
                        )}
                    </div>
               </div>
             </div>
             <div className="flex items-center gap-3">
                 <button onClick={()=> navigateTo('SETTINGS')} className="p-2 text-slate-400 active:rotate-90 transition-all"><SettingsIcon size={20}/></button>
                 {view === 'DASH' && (
                    <button onClick={() => navigateTo('ORDER_NEW')} className="w-11 h-11 bg-amber-600 text-white rounded-2xl flex items-center justify-center shadow-xl active:scale-90 transition-transform">
                      <Plus size={28} />
                    </button>
                 )}
             </div>
          </header>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 lg:p-10 w-full pb-[120px]">
            <div className="max-w-4xl mx-auto">
              
              {/* Auto-Pilot Report Toast (Visible on DASH) */}
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

              {view === 'DASH' && <Dashboard orders={orders} currentRates={{ k24: settings.currentGoldRate24K, k22: settings.currentGoldRate22K }} onRefreshRates={handleRefreshRates} />}
              {view === 'MENU' && (
                <div className="animate-fadeIn">
                   <div className="mb-6">
                      <h2 className="text-2xl font-black text-slate-800">Apps & Tools</h2>
                      <p className="text-sm text-slate-500 font-medium">Manage automation, templates, and system health.</p>
                   </div>
                   <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <MenuItem icon={<BookOpen />} label="Order Book" desc="Active & Archives" colorClass="bg-emerald-100 text-emerald-600" onClick={() => navigateTo('ORDER_BOOK')} />
                      <MenuItem icon={<BrainCircuit />} label="AI Strategy" desc="Automated Collection Engine" colorClass="bg-amber-100 text-amber-600" onClick={() => navigateTo('STRATEGY')} />
                      <MenuItem icon={<Calculator />} label="Plan Manager" desc="AI Payment Schemes" colorClass="bg-violet-100 text-violet-600" onClick={() => navigateTo('PLANS')} />
                      <MenuItem icon={<FileText />} label="Templates" desc="Meta WhatsApp Manager" colorClass="bg-blue-100 text-blue-600" onClick={() => navigateTo('TEMPLATES')} />
                      <MenuItem icon={<ScrollText />} label="Message Logs" desc="Audit Communication History" colorClass="bg-emerald-100 text-emerald-600" onClick={() => navigateTo('LOGS')} />
                      <MenuItem icon={<Globe />} label="Market Intel" desc="Live Rates & Charts" colorClass="bg-indigo-100 text-indigo-600" onClick={() => navigateTo('MARKET')} />
                      <MenuItem icon={<Activity />} label="System Logs" desc="Diagnostics & Repair" colorClass="bg-slate-100 text-slate-600" onClick={() => navigateTo('SYS_LOGS')} />
                      <MenuItem icon={<SettingsIcon />} label="Settings" desc="Global Configuration" colorClass="bg-gray-100 text-gray-600" onClick={() => navigateTo('SETTINGS')} />
                   </div>
                </div>
              )}
              {view === 'ORDER_NEW' && <OrderForm settings={settings} planTemplates={planTemplates} onSubmit={handleOrderCreate} onCancel={goBack} />}
              {view === 'ORDER_DETAILS' && (activeOrder ? 
                <OrderDetails 
                    order={activeOrder} 
                    settings={settings} 
                    onBack={goBack} 
                    onUpdateStatus={(itemId, status) => handleStatusUpdate(activeOrder.id, itemId, status)} 
                    onRecordPayment={recordPayment} 
                    onOrderUpdate={updateOrder} 
                    logs={logs} 
                    onAddLog={addLog} 
                /> : <div className="text-center py-20 text-slate-400 font-medium">Please select an order.</div>)}
              {view === 'ORDER_BOOK' && <OrderBook orders={orders} onViewOrder={(id) => navigateTo('ORDER_DETAILS', id)} onUpdateOrder={updateOrder} />}
              {view === 'CUSTOMERS' && <CustomerList customers={customers} orders={orders} onViewOrder={(id)=> navigateTo('ORDER_DETAILS', id)} onMessageSent={addLog} />}
              {view === 'COLLECTIONS' && <PaymentCollections orders={orders} onViewOrder={(id)=> navigateTo('ORDER_DETAILS', id)} onSendWhatsApp={()=>{}} settings={settings} />}
              {view === 'STRATEGY' && <NotificationCenter notifications={notifications} customers={customers} onRefresh={handleRunStrategy} loading={isStrategyLoading} onSend={handleSendNotification} isSending={sendingNotifId} />}
              {view === 'TEMPLATES' && <WhatsAppTemplates templates={templates} onUpdate={setTemplates} />}
              {view === 'PLANS' && <PlanManager templates={planTemplates} onUpdate={handleUpdatePlans} />}
              {view === 'LOGS' && <WhatsAppLogs logs={logs} onViewChat={(phone) => { (window as any).initialChatContact = phone; navigateTo('WHATSAPP'); }} />}
              {view === 'WHATSAPP' && <WhatsAppPanel logs={logs} customers={customers} onRefreshStatus={() => {}} templates={templates} onAddLog={addLog} initialContact={(window as any).initialChatContact} />}
              {view === 'MARKET' && <MarketIntelligence />}
              {view === 'SYS_LOGS' && <ErrorLogPanel errors={errors} onClear={() => errorService.clearErrors()} activities={activities} onResolveAction={(path) => path !== 'none' && (path === 'whatsapp' ? navigateTo('WHATSAPP') : path === 'templates' ? navigateTo('TEMPLATES') : navigateTo('SETTINGS'))} />}
              {view === 'SETTINGS' && <Settings settings={settings} onUpdate={setSettings} />}
            </div>
          </div>

          <div className="glass-nav fixed bottom-0 left-0 right-0 h-[84px] flex justify-around items-center px-2 z-[50] shadow-[0_-8px_20px_rgba(0,0,0,0.05)]">
             <TabBarItem icon={<Home />} label="Queue" active={view === 'DASH'} onClick={() => navigateTo('DASH')} />
             <TabBarItem icon={<ShoppingBag />} label="Orders" active={view === 'ORDER_BOOK'} onClick={() => navigateTo('ORDER_BOOK')} />
             <TabBarItem icon={<ReceiptIndianRupee />} label="Ledger" active={view === 'COLLECTIONS' || view === 'ORDER_DETAILS'} onClick={() => navigateTo('COLLECTIONS')} />
             <TabBarItem icon={<Users />} label="Clients" active={view === 'CUSTOMERS'} onClick={() => navigateTo('CUSTOMERS')} />
             <TabBarItem icon={<MessageSquare />} label="Chats" active={view === 'WHATSAPP'} onClick={() => navigateTo('WHATSAPP')} />
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
};

export default App;
