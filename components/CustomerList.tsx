
import React, { useState, useEffect, useMemo } from 'react';
import { 
  User, Phone, Mail, Search, ChevronRight, 
  BrainCircuit, ShieldAlert, Sparkles, MessageCircle, Clock, Zap, 
  CreditCard, TrendingUp, AlertTriangle, CheckCircle2, History, MessageSquare,
  ArrowRight, Activity, Plus, X, ArrowLeft, Calendar, MapPin, LayoutGrid, List, ReceiptIndianRupee
} from 'lucide-react';
import { Customer, Order, WhatsAppLogEntry, CreditworthinessReport, PaymentRecord } from '../types';
import { geminiService } from '../services/geminiService';

interface CustomerListProps {
  customers: Customer[];
  orders: Order[];
  onViewOrder: (id: string) => void;
  onMessageSent: (log: WhatsAppLogEntry) => void;
  onAddCustomer?: (customer: Customer) => void;
}

const CustomerList: React.FC<CustomerListProps> = ({ customers, orders, onViewOrder, onMessageSent, onAddCustomer }) => {
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'ORDERS' | 'COMMUNICATION' | 'FINANCIALS'>('OVERVIEW');
  const [viewMode, setViewMode] = useState<'GRID' | 'TABLE'>('TABLE');
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', contact: '', email: '', secondary: '' });

  const [creditReport, setCreditReport] = useState<CreditworthinessReport | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [customerLogs, setCustomerLogs] = useState<WhatsAppLogEntry[]>([]);
  
  // Aggregate all payments for this customer
  const customerPayments = useMemo(() => {
      return customerOrders.flatMap(o => o.payments.map(p => ({ ...p, orderId: o.id }))).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [customerOrders]);

  useEffect(() => {
      if (selectedCustomer) {
          const allOrders = orders.filter(o => selectedCustomer.orderIds.includes(o.id));
          setCustomerOrders(allOrders);
          
          try {
              const allLogs: WhatsAppLogEntry[] = JSON.parse(localStorage.getItem('aura_whatsapp_logs') || '[]');
              const relevantLogs = allLogs.filter(l => 
                  l.phoneNumber.includes(selectedCustomer.contact.slice(-10)) || 
                  l.customerName === selectedCustomer.name
              ).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
              setCustomerLogs(relevantLogs);
          } catch(e) { setCustomerLogs([]); }
          
          setCreditReport(null); 
          setActiveTab('OVERVIEW');
      }
  }, [selectedCustomer, orders]);

  const filtered = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.contact.includes(search) || 
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleDeepAnalyze = async () => {
    if (!selectedCustomer) return;
    setAnalyzing(true);
    try {
        const report = await geminiService.generateDeepCustomerAnalysis(selectedCustomer, customerOrders, customerLogs);
        setCreditReport(report);
    } catch (e) {
        alert("Analysis failed. Try again.");
    } finally {
        setAnalyzing(false);
    }
  };

  const handleCreateCustomer = () => {
      if (!newCustomer.name || !newCustomer.contact) return alert("Name and Contact are required.");
      if (onAddCustomer) {
          const cust: Customer = {
              id: `CUST-${newCustomer.contact}`,
              name: newCustomer.name,
              contact: newCustomer.contact,
              email: newCustomer.email,
              secondaryContact: newCustomer.secondary,
              orderIds: [],
              totalSpent: 0,
              joinDate: new Date().toISOString()
          };
          onAddCustomer(cust);
          setShowAddModal(false);
          setNewCustomer({ name: '', contact: '', email: '', secondary: '' });
      }
  };

  const getRiskColor = (level: string) => {
      switch(level) {
          case 'LOW': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
          case 'MODERATE': return 'bg-amber-100 text-amber-800 border-amber-200';
          case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-200';
          case 'CRITICAL': return 'bg-rose-100 text-rose-800 border-rose-200';
          default: return 'bg-slate-100 text-slate-800';
      }
  };

  // --- FULL SCREEN ADD CUSTOMER MODAL ---
  if (showAddModal) {
      return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-fadeIn">
                <div className="bg-slate-50 p-6 border-b flex justify-between items-center">
                    <h3 className="text-xl font-black text-slate-800">Create New Profile</h3>
                    <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={20} className="text-slate-500" /></button>
                </div>
                <div className="p-8 space-y-5">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Full Name</label>
                        <input 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-900 font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                            value={newCustomer.name}
                            onChange={e => setNewCustomer({...newCustomer, name: e.target.value})}
                            placeholder="e.g. Rajesh Kumar"
                            autoFocus
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Primary Contact</label>
                            <input 
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-900 font-mono font-medium focus:ring-2 focus:ring-amber-500 outline-none"
                                value={newCustomer.contact}
                                onChange={e => setNewCustomer({...newCustomer, contact: e.target.value})}
                                placeholder="9876543210"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Secondary (Optional)</label>
                            <input 
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-900 font-mono font-medium focus:ring-2 focus:ring-amber-500 outline-none"
                                value={newCustomer.secondary}
                                onChange={e => setNewCustomer({...newCustomer, secondary: e.target.value})}
                                placeholder="Alt Number"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Email Address (Optional)</label>
                        <input 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-900 font-medium focus:ring-2 focus:ring-amber-500 outline-none"
                            value={newCustomer.email}
                            onChange={e => setNewCustomer({...newCustomer, email: e.target.value})}
                            placeholder="customer@example.com"
                        />
                    </div>
                    <div className="pt-4">
                        <button 
                            onClick={handleCreateCustomer}
                            className="w-full bg-amber-600 text-white py-4 rounded-xl font-black uppercase tracking-widest hover:bg-amber-700 transition-all shadow-lg shadow-amber-200"
                        >
                            Save Customer Profile
                        </button>
                    </div>
                </div>
            </div>
        </div>
      );
  }

  // --- FULL SCREEN CUSTOMER PROFILE ---
  if (selectedCustomer) {
      return (
        <div className="flex flex-col h-[calc(100vh-100px)] animate-fadeIn">
            {/* Header / Nav */}
            <div className="mb-6 flex justify-between items-center shrink-0">
                <button 
                    onClick={() => setSelectedCustomer(null)}
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold transition-colors bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm"
                >
                    <ArrowLeft size={18} /> Back to Directory
                </button>
                <div className="flex gap-2">
                    <button 
                        onClick={handleDeepAnalyze}
                        disabled={analyzing}
                        className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg disabled:opacity-70"
                    >
                        {analyzing ? <Zap className="animate-spin" size={16} /> : <BrainCircuit size={16} />}
                        {analyzing ? 'Running AI Scan...' : 'Run Credit Analysis'}
                    </button>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
                {/* Sidebar Info */}
                <div className="lg:col-span-3 flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-2">
                    <div className="bg-white p-6 rounded-3xl border shadow-sm text-center">
                        <div className="w-24 h-24 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center text-4xl font-black text-white shadow-xl shadow-amber-100 mx-auto mb-4">
                            {selectedCustomer.name.charAt(0)}
                        </div>
                        <h2 className="text-xl font-black text-slate-800">{selectedCustomer.name}</h2>
                        <div className="flex justify-center gap-2 mt-2">
                            <span className="bg-slate-100 px-3 py-1 rounded-full text-[10px] font-bold text-slate-500 flex items-center gap-1">
                                <Clock size={10} /> Joined {new Date(selectedCustomer.joinDate).getFullYear()}
                            </span>
                        </div>
                        
                        <div className="mt-6 space-y-4 text-left">
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Mobile</p>
                                <p className="font-mono font-bold text-slate-700 flex items-center gap-2"><Phone size={14} className="text-emerald-500"/> {selectedCustomer.contact}</p>
                            </div>
                            {selectedCustomer.email && (
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Email</p>
                                    <p className="font-medium text-sm text-slate-700 truncate">{selectedCustomer.email}</p>
                                </div>
                            )}
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Lifetime Value</p>
                                <p className="font-black text-xl text-amber-600">₹{selectedCustomer.totalSpent.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>

                    {/* Quick AI Stats */}
                    {creditReport && (
                        <div className="bg-white p-6 rounded-3xl border shadow-sm">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2"><BrainCircuit size={16} className="text-purple-500"/> AI Profile</h3>
                                <span className={`text-[10px] font-black px-2 py-1 rounded border ${getRiskColor(creditReport.riskLevel)}`}>{creditReport.riskLevel}</span>
                            </div>
                            <div className="space-y-3">
                                <div className="bg-purple-50 p-3 rounded-xl border border-purple-100">
                                    <p className="text-[10px] font-bold text-purple-700 uppercase mb-1">Persona</p>
                                    <p className="text-xs font-medium text-slate-700">"{creditReport.persona}"</p>
                                </div>
                                <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                                    <p className="text-[10px] font-bold text-emerald-700 uppercase mb-1">Next Best Action</p>
                                    <p className="text-xs font-medium text-slate-700">{creditReport.nextBestAction}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Main Content Area */}
                <div className="lg:col-span-9 flex flex-col bg-white rounded-3xl border shadow-sm overflow-hidden">
                    {/* Tabs */}
                    <div className="flex border-b bg-slate-50 px-2 pt-2 overflow-x-auto">
                        {(['OVERVIEW', 'ORDERS', 'COMMUNICATION', 'FINANCIALS'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-6 py-3 text-xs font-black uppercase tracking-widest rounded-t-xl transition-all whitespace-nowrap ${activeTab === tab ? 'bg-white text-amber-600 shadow-sm border-t border-x border-b-white translate-y-[1px]' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 bg-white">
                        
                        {activeTab === 'OVERVIEW' && (
                            <div className="space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="bg-gradient-to-br from-amber-50 to-white p-6 rounded-2xl border border-amber-100">
                                        <div className="p-3 bg-amber-100 w-fit rounded-xl text-amber-600 mb-3"><History /></div>
                                        <p className="text-slate-500 text-xs font-bold uppercase mb-1">Total Orders</p>
                                        <p className="text-3xl font-black text-slate-800">{customerOrders.length}</p>
                                    </div>
                                    <div className="bg-gradient-to-br from-blue-50 to-white p-6 rounded-2xl border border-blue-100">
                                        <div className="p-3 bg-blue-100 w-fit rounded-xl text-blue-600 mb-3"><MessageSquare /></div>
                                        <p className="text-slate-500 text-xs font-bold uppercase mb-1">Interactions</p>
                                        <p className="text-3xl font-black text-slate-800">{customerLogs.length}</p>
                                    </div>
                                    <div className="bg-gradient-to-br from-rose-50 to-white p-6 rounded-2xl border border-rose-100">
                                        <div className="p-3 bg-rose-100 w-fit rounded-xl text-rose-600 mb-3"><AlertTriangle /></div>
                                        <p className="text-slate-500 text-xs font-bold uppercase mb-1">Active Debt</p>
                                        <p className="text-3xl font-black text-slate-800">₹{customerOrders.reduce((acc, o) => acc + (o.totalAmount - o.payments.reduce((p, c) => p + c.amount, 0)), 0).toLocaleString()}</p>
                                    </div>
                                </div>

                                {creditReport ? (
                                    <div className="bg-slate-50 p-8 rounded-3xl border border-slate-200">
                                        <h3 className="font-black text-slate-800 text-lg mb-4 flex items-center gap-2"><Sparkles className="text-amber-500"/> Deep Behavioral Analysis</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div>
                                                <p className="text-xs font-bold text-slate-400 uppercase mb-2">Communication Strategy</p>
                                                <p className="text-sm text-slate-700 leading-relaxed bg-white p-4 rounded-xl border shadow-sm">
                                                    {creditReport.communicationStrategy}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-slate-400 uppercase mb-2">Negotiation Leverage</p>
                                                <p className="text-sm text-slate-700 leading-relaxed bg-white p-4 rounded-xl border shadow-sm">
                                                    {creditReport.negotiationLeverage}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center p-12 bg-slate-50 rounded-3xl border border-dashed text-slate-400">
                                        <BrainCircuit size={48} className="mb-4 opacity-20"/>
                                        <p className="font-bold text-sm">AI Analysis Not Run Yet</p>
                                        <p className="text-xs mt-1">Click the button in the header to generate a profile.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'ORDERS' && (
                            <div className="space-y-4">
                                {customerOrders.map(o => (
                                    <div key={o.id} className="flex items-center gap-6 p-6 bg-white border rounded-2xl hover:shadow-md transition-all group">
                                        <div className="w-16 h-16 bg-slate-100 rounded-xl overflow-hidden shrink-0 border">
                                            <img src={o.items[0]?.photoUrls[0]} className="w-full h-full object-cover" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <h4 className="font-black text-slate-800 text-lg">{o.items[0].category} <span className="font-medium text-slate-400 text-sm">({o.items.length} items)</span></h4>
                                                    <p className="text-xs text-slate-500 font-mono">Order #{o.id.slice(-6)} • {new Date(o.createdAt).toLocaleDateString()}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-black text-slate-800 text-lg">₹{o.totalAmount.toLocaleString()}</p>
                                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${o.status === 'OVERDUE' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>{o.status}</span>
                                                </div>
                                            </div>
                                            <button onClick={() => onViewOrder(o.id)} className="text-xs font-bold text-amber-600 hover:underline flex items-center gap-1">
                                                Manage Order <ChevronRight size={12} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {customerOrders.length === 0 && <p className="text-center text-slate-400 py-10 italic">No orders found.</p>}
                            </div>
                        )}

                        {activeTab === 'COMMUNICATION' && (
                            <div className="space-y-4">
                                {customerLogs.length === 0 ? (
                                    <div className="text-center text-slate-400 py-20">
                                        <MessageSquare size={48} className="mx-auto mb-4 opacity-20"/>
                                        <p className="font-bold">No message history.</p>
                                    </div>
                                ) : (
                                    customerLogs.map(log => (
                                        <div key={log.id} className={`flex gap-4 ${log.direction === 'outbound' ? 'flex-row' : 'flex-row-reverse'}`}>
                                            <div className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white ${log.direction === 'outbound' ? 'bg-slate-900' : 'bg-amber-500'}`}>
                                                {log.direction === 'outbound' ? <ArrowRight size={14} className="-rotate-45"/> : <ArrowRight size={14} className="rotate-135"/>}
                                            </div>
                                            <div className={`flex-1 p-4 rounded-2xl border ${log.direction === 'outbound' ? 'bg-slate-50 rounded-tl-none' : 'bg-amber-50 rounded-tr-none border-amber-100'}`}>
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{log.type}</span>
                                                    <span className="text-[10px] text-slate-400">{new Date(log.timestamp).toLocaleString()}</span>
                                                </div>
                                                <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{log.message}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {activeTab === 'FINANCIALS' && (
                            <div className="space-y-8">
                                <div className="flex flex-col items-center justify-center text-center space-y-6">
                                    <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 mb-2">
                                        <CreditCard size={32} />
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-800">Financial Overview</h3>
                                    <div className="grid grid-cols-2 gap-8 w-full max-w-2xl text-left">
                                        <div className="p-6 bg-white border rounded-2xl shadow-sm">
                                            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Total Lifetime Payment</p>
                                            <p className="text-3xl font-black text-emerald-600">₹{selectedCustomer.totalSpent.toLocaleString()}</p>
                                        </div>
                                        <div className="p-6 bg-white border rounded-2xl shadow-sm">
                                            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Outstanding Balance</p>
                                            <p className="text-3xl font-black text-rose-500">
                                                ₹{customerOrders.reduce((acc, o) => acc + (o.totalAmount - o.payments.reduce((p, c) => p + c.amount, 0)), 0).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Aggregated Transaction Ledger */}
                                <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
                                    <div className="bg-slate-50 p-4 border-b">
                                        <h4 className="font-black text-xs uppercase tracking-widest text-slate-600 flex items-center gap-2"><ReceiptIndianRupee size={14}/> Complete Transaction History</h4>
                                    </div>
                                    {customerPayments.length === 0 ? (
                                        <div className="p-8 text-center text-slate-400 text-sm">No transactions recorded across any orders.</div>
                                    ) : (
                                        <table className="w-full text-left">
                                            <thead className="bg-white text-[9px] font-black uppercase text-slate-400 border-b">
                                                <tr>
                                                    <th className="px-6 py-3">Date</th>
                                                    <th className="px-6 py-3">Order Ref</th>
                                                    <th className="px-6 py-3">Mode</th>
                                                    <th className="px-6 py-3 text-right">Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50 text-sm font-medium text-slate-700">
                                                {customerPayments.map((p, idx) => (
                                                    <tr key={p.id + idx} className="hover:bg-slate-50">
                                                        <td className="px-6 py-4">{new Date(p.date).toLocaleDateString()}</td>
                                                        <td className="px-6 py-4">
                                                            <button onClick={() => onViewOrder(p.orderId!)} className="text-amber-600 hover:underline">
                                                                #{p.orderId!.slice(-6)}
                                                            </button>
                                                        </td>
                                                        <td className="px-6 py-4"><span className="bg-slate-100 px-2 py-1 rounded text-[10px] font-bold">{p.method}</span></td>
                                                        <td className="px-6 py-4 text-right font-bold text-emerald-600">+₹{p.amount.toLocaleString()}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
      );
  }

  // --- DEFAULT LIST VIEW ---
  return (
    <div className="flex flex-col h-[calc(100vh-100px)] space-y-6">
      
      {/* List Header */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 shrink-0">
          <div>
              <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                  <User className="text-amber-500" /> Customer Directory
              </h2>
              <p className="text-slate-500 text-sm">Manage profiles, credit history and communications.</p>
          </div>
          <div className="flex gap-4 w-full md:w-auto">
              <div className="relative flex-1 md:w-80">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                      type="text" 
                      placeholder="Search customers..." 
                      className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-amber-500 outline-none text-sm font-medium"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                  />
              </div>
              <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button onClick={() => setViewMode('TABLE')} className={`p-2 rounded-lg transition-all ${viewMode === 'TABLE' ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}><List size={20}/></button>
                  <button onClick={() => setViewMode('GRID')} className={`p-2 rounded-lg transition-all ${viewMode === 'GRID' ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}><LayoutGrid size={20}/></button>
              </div>
              {onAddCustomer && (
                  <button 
                      onClick={() => setShowAddModal(true)}
                      className="bg-amber-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-amber-700 shadow-lg shadow-amber-200 transition-all shrink-0"
                  >
                      <Plus size={18} /> Add Customer
                  </button>
              )}
          </div>
      </div>

      {/* Main List Content */}
      <div className="flex-1 bg-white rounded-3xl border shadow-sm overflow-hidden flex flex-col">
          {filtered.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                  <User size={64} className="mb-4 opacity-20"/>
                  <p className="font-bold">No customers found.</p>
                  <button onClick={() => setShowAddModal(true)} className="text-amber-600 font-bold text-sm mt-2 hover:underline">Create a new profile</button>
              </div>
          ) : viewMode === 'TABLE' ? (
              <div className="flex-1 overflow-auto">
                  <table className="w-full text-left">
                      <thead className="bg-slate-50 border-b text-[10px] font-black uppercase text-slate-400 tracking-widest sticky top-0 z-10">
                          <tr>
                              <th className="px-8 py-5">Customer Name</th>
                              <th className="px-8 py-5">Contact Info</th>
                              <th className="px-8 py-5">Total Orders</th>
                              <th className="px-8 py-5">Lifetime Value</th>
                              <th className="px-8 py-5 text-right">Action</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                          {filtered.map(c => (
                              <tr key={c.id} onClick={() => setSelectedCustomer(c)} className="hover:bg-slate-50 transition-colors cursor-pointer group">
                                  <td className="px-8 py-5">
                                      <div className="flex items-center gap-4">
                                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center font-black text-slate-500">
                                              {c.name.charAt(0)}
                                          </div>
                                          <div>
                                              <p className="font-bold text-slate-800 text-sm group-hover:text-amber-600 transition-colors">{c.name}</p>
                                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Joined {new Date(c.joinDate).getFullYear()}</p>
                                          </div>
                                      </div>
                                  </td>
                                  <td className="px-8 py-5">
                                      <div className="flex flex-col gap-1">
                                          <span className="text-xs font-mono font-medium text-slate-600 flex items-center gap-2"><Phone size={12} className="text-slate-300"/> {c.contact}</span>
                                          {c.email && <span className="text-xs font-medium text-slate-500 flex items-center gap-2"><Mail size={12} className="text-slate-300"/> {c.email}</span>}
                                      </div>
                                  </td>
                                  <td className="px-8 py-5">
                                      <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">{c.orderIds.length}</span>
                                  </td>
                                  <td className="px-8 py-5">
                                      <p className="font-black text-slate-800 text-sm">₹{c.totalSpent.toLocaleString()}</p>
                                  </td>
                                  <td className="px-8 py-5 text-right">
                                      <button className="p-2 text-slate-300 group-hover:text-amber-500 transition-colors">
                                          <ChevronRight size={20} />
                                      </button>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          ) : (
              <div className="flex-1 overflow-auto p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filtered.map(c => (
                      <div key={c.id} onClick={() => setSelectedCustomer(c)} className="bg-white border rounded-3xl p-6 hover:border-amber-400 hover:shadow-lg transition-all cursor-pointer group flex flex-col items-center text-center">
                          <div className="w-16 h-16 rounded-full bg-slate-100 mb-4 flex items-center justify-center text-xl font-black text-slate-400 group-hover:bg-amber-100 group-hover:text-amber-600 transition-colors">
                              {c.name.charAt(0)}
                          </div>
                          <h3 className="font-black text-slate-800 text-lg mb-1">{c.name}</h3>
                          <p className="text-xs text-slate-500 font-mono mb-4">{c.contact}</p>
                          <div className="w-full pt-4 border-t border-slate-50 flex justify-between items-center mt-auto">
                              <div className="text-left">
                                  <p className="text-[9px] font-bold text-slate-300 uppercase">LTV</p>
                                  <p className="font-bold text-slate-700">₹{c.totalSpent.toLocaleString()}</p>
                              </div>
                              <div className="bg-slate-50 p-2 rounded-full text-slate-300 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                                  <ArrowRight size={16} />
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
          )}
      </div>
    </div>
  );
};

export default CustomerList;
