
import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  ShoppingBag, Plus, Trash2, ShieldCheck, Scale, 
  IndianRupee, Lock, ChevronRight, Calculator, 
  Database, HardDrive, Wifi, WifiOff, Loader2, Sparkles, Gem, ArrowLeft
} from 'lucide-react';

// --- Types ---
type Purity = '18K' | '22K' | '24K';
type MetalColor = 'Yellow Gold' | 'Rose Gold' | 'White Gold';

interface JewelryItem {
  id: string;
  category: string;
  purity: Purity;
  metalColor: MetalColor;
  grossWeight: number;
  netWeight: number;
  stoneWeight: number;
  wastagePercentage: number;
  makingChargesPerGram: number;
  stoneCharges: number;
  huid: string;
  totalValue: number;
}

interface Order {
  id: string;
  customerName: string;
  customerContact: string;
  items: JewelryItem[];
  goldRateAtBooking: number;
  taxRate: number;
  totalAmount: number;
  createdAt: string;
}

interface AppState {
  orders: Order[];
  settings: {
    rate24K: number;
    rate22K: number;
    rate18K: number;
    defaultTax: number;
  };
}

// --- Storage Service with Fallback ---
const STORAGE_KEY = 'auragold_storage_v1';
const API_URL = '/api/state';

const initialAppState: AppState = {
  orders: [],
  settings: {
    rate24K: 7800,
    rate22K: 7150,
    rate18K: 5850,
    defaultTax: 3
  }
};

const StorageManager = {
  isLocalOnly: false,

  async load(): Promise<AppState> {
    try {
      const res = await fetch(API_URL);
      if (res.ok) {
        this.isLocalOnly = false;
        return await res.json();
      }
    } catch (e) {
      console.warn("Backend unavailable, using Local Fallback.");
    }
    
    this.isLocalOnly = true;
    const local = localStorage.getItem(STORAGE_KEY);
    return local ? JSON.parse(local) : initialAppState;
  },

  async save(state: AppState) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    try {
      await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state)
      });
      this.isLocalOnly = false;
    } catch (e) {
      this.isLocalOnly = true;
    }
  }
};

// --- Main App Component ---
const App: React.FC = () => {
  const [view, setView] = useState<'DASHBOARD' | 'FORM'>('DASHBOARD');
  const [state, setState] = useState<AppState>(initialAppState);
  const [loading, setLoading] = useState(true);
  const [syncMode, setSyncMode] = useState<'LIVE' | 'LOCAL'>('LIVE');

  // Form State
  const [orderHeader, setOrderHeader] = useState({ customerName: '', customerContact: '' });
  const [cart, setCart] = useState<JewelryItem[]>([]);
  const [editingItem, setEditingItem] = useState<Partial<JewelryItem>>({
    category: 'Ring', purity: '22K', metalColor: 'Yellow Gold',
    grossWeight: 0, netWeight: 0, stoneWeight: 0,
    wastagePercentage: 12, makingChargesPerGram: 450, stoneCharges: 0, huid: ''
  });

  useEffect(() => {
    const init = async () => {
      const loaded = await StorageManager.load();
      setState(loaded);
      setSyncMode(StorageManager.isLocalOnly ? 'LOCAL' : 'LIVE');
      setLoading(false);
    };
    init();
  }, []);

  const saveState = async (newState: AppState) => {
    setState(newState);
    await StorageManager.save(newState);
    setSyncMode(StorageManager.isLocalOnly ? 'LOCAL' : 'LIVE');
  };

  const currentRate = useMemo(() => {
    if (editingItem.purity === '24K') return state.settings.rate24K;
    if (editingItem.purity === '18K') return state.settings.rate18K;
    return state.settings.rate22K;
  }, [editingItem.purity, state.settings]);

  const itemCalculation = useMemo(() => {
    const metalValue = (editingItem.netWeight || 0) * currentRate;
    const wastageValue = metalValue * ((editingItem.wastagePercentage || 0) / 100);
    const labor = (editingItem.makingChargesPerGram || 0) * (editingItem.netWeight || 0);
    const subTotal = metalValue + wastageValue + labor + (editingItem.stoneCharges || 0);
    return { subTotal };
  }, [editingItem, currentRate]);

  const cartTotal = useMemo(() => cart.reduce((s, i) => s + i.totalValue, 0), [cart]);
  const finalTax = cartTotal * (state.settings.defaultTax / 100);

  const handleAddItem = () => {
    if (!editingItem.netWeight || editingItem.netWeight <= 0) return alert("Net weight is required.");
    const newItem: JewelryItem = {
      ...editingItem as any,
      id: `ITEM-${Date.now()}`,
      totalValue: itemCalculation.subTotal
    };
    setCart([...cart, newItem]);
    setEditingItem({ ...editingItem, grossWeight: 0, netWeight: 0, stoneWeight: 0, huid: '' });
  };

  const handleFinalSubmit = () => {
    if (cart.length === 0) return alert("Add at least one item.");
    if (!orderHeader.customerName) return alert("Customer name required.");

    const newOrder: Order = {
      id: `ORD-${Date.now()}`,
      ...orderHeader,
      items: cart,
      goldRateAtBooking: state.settings.rate22K,
      taxRate: state.settings.defaultTax,
      totalAmount: cartTotal + finalTax,
      createdAt: new Date().toISOString()
    };

    saveState({ ...state, orders: [newOrder, ...state.orders] });
    setView('DASHBOARD');
    setCart([]);
    setOrderHeader({ customerName: '', customerContact: '' });
  };

  if (loading) return (
    <div className="min-h-screen bg-luxury flex flex-col items-center justify-center text-white">
      <Loader2 className="animate-spin text-gold mb-4" size={48} />
      <p className="font-black uppercase tracking-widest text-xs">Authenticating AuraGold Console...</p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-24">
      {/* Header Stat Area */}
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black text-luxury tracking-tighter flex items-center gap-2">
            <Gem className="text-gold" /> AuraGold Elite
          </h1>
          <div className="flex items-center gap-2 mt-1">
            {syncMode === 'LIVE' ? (
              <span className="text-[10px] font-black uppercase text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                <Database size={10} /> Live Database Active
              </span>
            ) : (
              <span className="text-[10px] font-black uppercase text-amber-600 flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                <HardDrive size={10} /> Local Fallback Mode
              </span>
            )}
          </div>
        </div>
        {view === 'DASHBOARD' && (
          <button onClick={() => setView('FORM')} className="btn-gold flex items-center gap-2">
            <Plus size={18} /> New Booking
          </button>
        )}
      </header>

      {view === 'DASHBOARD' ? (
        <div className="animate-fadeIn space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard label="Live 22K Rate" value={`₹${state.settings.rate22K}`} color="text-gold" />
            <StatCard label="Total Bookings" value={state.orders.length.toString()} color="text-luxury" />
            <StatCard label="Revenue Locked" value={`₹${state.orders.reduce((s, o) => s + o.totalAmount, 0).toLocaleString()}`} color="text-emerald-600" />
          </div>

          <div className="pos-card p-6">
            <h2 className="font-black uppercase text-xs tracking-widest text-slate-400 mb-6">Recent Order Ledger</h2>
            <div className="space-y-4">
              {state.orders.map(order => (
                <div key={order.id} className="p-4 border rounded-2xl flex justify-between items-center hover:bg-slate-50 transition-colors">
                  <div>
                    <p className="font-bold text-luxury">{order.customerName}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase">{order.items.length} Items • {new Date(order.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-luxury">₹{order.totalAmount.toLocaleString()}</p>
                    <span className="text-[9px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded uppercase tracking-tighter">Active Contract</span>
                  </div>
                </div>
              ))}
              {state.orders.length === 0 && <p className="text-center py-10 text-slate-400 font-bold italic">No active contracts found.</p>}
            </div>
          </div>
        </div>
      ) : (
        <div className="animate-slideUp space-y-6">
          <button onClick={() => setView('DASHBOARD')} className="flex items-center gap-2 text-slate-400 font-bold text-sm hover:text-luxury transition-colors">
            <ArrowLeft size={18} /> Exit Booking
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-6">
              {/* Item Entry Form */}
              <div className="pos-card p-8 space-y-8">
                <div className="flex justify-between items-center">
                  <h3 className="font-black text-luxury uppercase tracking-widest text-sm flex items-center gap-2">
                    <Calculator size={16} /> Jewellery Spec Entry
                  </h3>
                  <span className="text-[10px] font-black bg-gold-pale text-gold-dark px-3 py-1 rounded-full border border-gold-light">
                    Rate: ₹{currentRate}/g
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <InputGroup label="Category">
                    <select className="input-gold" value={editingItem.category} onChange={e => setEditingItem({...editingItem, category: e.target.value})}>
                      {['Ring', 'Necklace', 'Earrings', 'Bangle', 'Bracelet', 'Chain', 'Pendant', 'Mangalsutra'].map(c => <option key={c}>{c}</option>)}
                    </select>
                  </InputGroup>
                  <InputGroup label="Purity">
                    <select className="input-gold" value={editingItem.purity} onChange={e => setEditingItem({...editingItem, purity: e.target.value as Purity})}>
                      <option value="22K">22K Hallmark</option>
                      <option value="24K">24K Bullion</option>
                      <option value="18K">18K Studded</option>
                    </select>
                  </InputGroup>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <InputGroup label="Net Wt (g)">
                    <input type="number" step="0.001" className="input-gold text-emerald-700" placeholder="0.000" value={editingItem.netWeight || ''} onChange={e => setEditingItem({...editingItem, netWeight: parseFloat(e.target.value) || 0})} />
                  </InputGroup>
                  <InputGroup label="VA (Wastage) %">
                    <input type="number" className="input-gold" placeholder="12" value={editingItem.wastagePercentage || ''} onChange={e => setEditingItem({...editingItem, wastagePercentage: parseFloat(e.target.value) || 0})} />
                  </InputGroup>
                  <InputGroup label="Labor / g">
                    <input type="number" className="input-gold" placeholder="450" value={editingItem.makingChargesPerGram || ''} onChange={e => setEditingItem({...editingItem, makingChargesPerGram: parseFloat(e.target.value) || 0})} />
                  </InputGroup>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <InputGroup label="Stone Charges">
                    <input type="number" className="input-gold" placeholder="0" value={editingItem.stoneCharges || ''} onChange={e => setEditingItem({...editingItem, stoneCharges: parseFloat(e.target.value) || 0})} />
                  </InputGroup>
                  <InputGroup label="HUID ID">
                    <input type="text" className="input-gold uppercase" placeholder="ABC123" value={editingItem.huid || ''} onChange={e => setEditingItem({...editingItem, huid: e.target.value})} />
                  </InputGroup>
                </div>

                <div className="bg-luxury p-6 rounded-[2rem] flex justify-between items-center text-white shadow-2xl">
                  <div>
                    <p className="text-[9px] font-black uppercase text-gold tracking-widest mb-1">Estimated Item Quote</p>
                    <p className="text-3xl font-black">₹{Math.round(itemCalculation.subTotal).toLocaleString()}</p>
                  </div>
                  <button onClick={handleAddItem} className="bg-gold text-luxury px-8 py-3 rounded-xl font-black uppercase text-xs hover:bg-gold-light transition-all shadow-lg active:scale-95">
                    Add Item
                  </button>
                </div>
              </div>

              {/* Cart Review */}
              {cart.length > 0 && (
                <div className="pos-card overflow-hidden">
                  <div className="bg-slate-50 p-4 border-b">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Order Summary ({cart.length} Items)</h4>
                  </div>
                  <div className="divide-y">
                    {cart.map((item, idx) => (
                      <div key={item.id} className="p-4 flex justify-between items-center bg-white group hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-luxury/5 rounded-full flex items-center justify-center text-gold">
                            <Gem size={18} />
                          </div>
                          <div>
                            <p className="font-bold text-sm text-luxury">{item.category} • {item.metalColor}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">{item.purity} • {item.netWeight}g {item.huid && `• HUID: ${item.huid}`}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <p className="font-black text-sm">₹{Math.round(item.totalValue).toLocaleString()}</p>
                          <button onClick={() => setCart(cart.filter(i => i.id !== item.id))} className="text-rose-500 p-2 hover:bg-rose-50 rounded-lg"><Trash2 size={16} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="lg:col-span-4 space-y-6">
              <div className="pos-card p-6 space-y-6 sticky top-8">
                <h3 className="font-black text-luxury uppercase tracking-widest text-xs">Contract Details</h3>
                
                <InputGroup label="Customer Full Name">
                  <input type="text" className="input-gold" value={orderHeader.customerName} onChange={e => setOrderHeader({...orderHeader, customerName: e.target.value})} placeholder="Ex: Rahul Sharma" />
                </InputGroup>
                <InputGroup label="WhatsApp Contact">
                  <input type="tel" className="input-gold" value={orderHeader.customerContact} onChange={e => setOrderHeader({...orderHeader, customerContact: e.target.value})} placeholder="91XXXXXXXXXX" />
                </InputGroup>

                <div className="bg-slate-50 p-6 rounded-[2rem] space-y-4">
                  <div className="flex justify-between text-xs font-bold text-slate-500 uppercase">
                    <span>Subtotal</span>
                    <span>₹{cartTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-slate-500 uppercase">
                    <span>GST ({state.settings.defaultTax}%)</span>
                    <span>₹{Math.round(finalTax).toLocaleString()}</span>
                  </div>
                  <div className="pt-4 border-t border-slate-200 flex justify-between items-end">
                    <span className="text-[10px] font-black uppercase text-luxury tracking-widest">Total Payable</span>
                    <span className="text-3xl font-black text-luxury tracking-tighter">₹{Math.round(cartTotal + finalTax).toLocaleString()}</span>
                  </div>
                </div>

                <button 
                  onClick={handleFinalSubmit}
                  disabled={cart.length === 0}
                  className="w-full bg-gold text-luxury py-5 rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl shadow-gold/20 hover:bg-gold-light transition-all disabled:opacity-50 disabled:grayscale"
                >
                  Generate Order
                </button>

                <div className="flex items-center gap-2 justify-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <ShieldCheck size={14} className="text-emerald-500" /> Bureau of Indian Standards
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ label, value, color }: { label: string, value: string, color: string }) => (
  <div className="pos-card p-6 text-center">
    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
    <p className={`text-2xl font-black ${color} tracking-tighter`}>{value}</p>
  </div>
);

const InputGroup = ({ label, children }: { label: string, children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
    {children}
  </div>
);

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
