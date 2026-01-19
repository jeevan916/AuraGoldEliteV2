import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, ShoppingBag, Trash2, ShieldCheck, 
  Calculator, User, ChevronRight, X, Loader2, Sparkles, Zap, Image as ImageIcon, Camera, Trash, 
  IndianRupee, ArrowRight, Lock, Calendar, Scale, Tag, Ruler, Upload, Gem, LayoutGrid, BrainCircuit, CheckCircle2,
  CalendarDays, AlignLeft, Info, Coins, Scissors
} from 'lucide-react';
import { 
  Order, JewelryDetail, OrderStatus, GlobalSettings, 
  ProductionStatus, Purity, ProtectionStatus, Milestone, PaymentPlan, PaymentPlanTemplate, CatalogItem, StoneEntry, OldGoldExchange
} from '../types';
import { compressImage } from '../services/imageOptimizer';
import { storageService } from '../services/storageService';

interface OrderFormProps {
  settings: GlobalSettings;
  planTemplates?: PaymentPlanTemplate[];
  onSubmit: (order: Order) => void;
  onCancel: () => void;
}

const OrderForm: React.FC<OrderFormProps> = ({ settings, planTemplates = [], onSubmit, onCancel }) => {
  const [step, setStep] = useState(1);
  const [customer, setCustomer] = useState({ name: '', contact: '', email: '' });
  const [cartItems, setCartItems] = useState<JewelryDetail[]>([]);
  const [orderRate, setOrderRate] = useState(settings.currentGoldRate22K);
  const [protectionRate, setProtectionRate] = useState(settings.currentGoldRate22K);
  
  // New: Old Gold Exchange State
  const [exchanges, setExchanges] = useState<OldGoldExchange[]>([]);
  const [showExchangeModal, setShowExchangeModal] = useState(false);
  const [tempExchange, setTempExchange] = useState<Partial<OldGoldExchange>>({
    description: 'Customer Ring', grossWeight: 0, purityPercent: 92, meltingLossPercent: 2, rate: settings.currentGoldRate22K - 200
  });

  // Catalog State
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [showCatalog, setShowCatalog] = useState(false);
  
  // Stone Entry State
  const [tempStone, setTempStone] = useState<Partial<StoneEntry>>({ type: 'Diamond', weight: 0, unit: 'ct', rate: 0, quality: 'G-H/VVS1' });

  // Manual Milestones State
  const [planMode, setPlanMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [manualMilestones, setManualMilestones] = useState<Partial<Milestone>[]>([]);
  
  const initialItem: Partial<JewelryDetail> = {
    category: 'Ring', 
    purity: '22K', 
    metalColor: 'Yellow Gold',
    grossWeight: 0, 
    netWeight: 0, 
    stoneEntries: [],
    stoneCharges: 0,
    wastagePercentage: 12, 
    makingChargesPerGram: 450, 
    photoUrls: [], 
    huid: '', 
    size: '',
    customizationDetails: ''
  };
  
  const [currentItem, setCurrentItem] = useState<Partial<JewelryDetail>>(initialItem);
  const [isCompressing, setIsCompressing] = useState(false);

  const [plan, setPlan] = useState<Partial<PaymentPlan>>({
    months: 6, 
    advancePercentage: 10, 
    interestPercentage: 0,
    goldRateProtection: true,
    type: 'MANUAL'
  });

  useEffect(() => {
    setCatalog(storageService.getCatalog());
  }, []);

  useEffect(() => {
    if (step === 1) setProtectionRate(orderRate);
  }, [orderRate, step]);

  // --- Calculations ---

  const currentStoneTotal = useMemo(() => {
    return (currentItem.stoneEntries || []).reduce((acc, s) => acc + (s.total || 0), 0);
  }, [currentItem.stoneEntries]);

  const pricing = useMemo(() => {
    const rate = currentItem.purity === '24K' ? settings.currentGoldRate24K : 
                 currentItem.purity === '18K' ? settings.currentGoldRate18K : orderRate;
    const metalValue = (currentItem.netWeight || 0) * rate;
    const wastageValue = metalValue * ((currentItem.wastagePercentage || 0) / 100);
    const laborValue = (currentItem.makingChargesPerGram || 0) * (currentItem.netWeight || 0);
    const subTotal = metalValue + wastageValue + laborValue + currentStoneTotal;
    const tax = subTotal * (settings.defaultTaxRate / 100);
    return { metalValue, wastageValue, laborValue, tax, total: subTotal + tax };
  }, [currentItem, orderRate, settings, currentStoneTotal]);

  const cartTotal = useMemo(() => cartItems.reduce((s, i) => s + i.finalAmount, 0), [cartItems]);
  const exchangeTotalValue = useMemo(() => exchanges.reduce((s, e) => s + (e.totalValue || 0), 0), [exchanges]);
  const netPayable = Math.max(0, cartTotal - exchangeTotalValue);

  // --- Actions ---

  const handleAddStone = () => {
    if (!tempStone.weight || !tempStone.rate) return;
    const total = (tempStone.weight || 0) * (tempStone.rate || 0);
    const entry: StoneEntry = { ...tempStone as any, id: `ST-${Date.now()}`, total };
    setCurrentItem(prev => ({
        ...prev,
        stoneEntries: [...(prev.stoneEntries || []), entry],
        stoneCharges: (prev.stoneCharges || 0) + total
    }));
    setTempStone({ type: 'Diamond', weight: 0, unit: 'ct', rate: 0, quality: 'G-H/VVS1' });
  };

  const handleAddExchange = () => {
    if (!tempExchange.grossWeight || !tempExchange.rate) return;
    const meltingLoss = (tempExchange.grossWeight || 0) * ((tempExchange.meltingLossPercent || 0) / 100);
    const netWeight = ((tempExchange.grossWeight || 0) - meltingLoss) * ((tempExchange.purityPercent || 100) / 100);
    const totalValue = netWeight * (tempExchange.rate || 0);
    
    setExchanges([...exchanges, { ...tempExchange as any, netWeight, totalValue }]);
    setShowExchangeModal(false);
    setTempExchange({ description: '', grossWeight: 0, purityPercent: 92, meltingLossPercent: 2, rate: orderRate - 200 });
  };

  const handleAddItem = () => {
    if (!currentItem.netWeight || currentItem.netWeight <= 0) {
        alert("Net weight is required to generate a valid item quote.");
        return;
    }
    
    const item: JewelryDetail = {
      ...currentItem as any,
      id: `ITEM-${Date.now()}`,
      baseMetalValue: pricing.metalValue,
      wastageValue: pricing.wastageValue,
      totalLaborValue: pricing.laborValue,
      stoneCharges: currentStoneTotal,
      taxAmount: pricing.tax,
      finalAmount: pricing.total,
      productionStatus: ProductionStatus.DESIGNING,
    };
    
    setCartItems([...cartItems, item]);
    setCurrentItem(initialItem);
  };

  const submitOrder = () => {
    if (cartItems.length === 0) return alert("Please add at least one jewellery item.");
    if (!customer.name || !customer.contact) return alert("Customer Name and Contact Number are mandatory.");

    let milestones: Milestone[] = [];
    if (planMode === 'MANUAL') {
        if (Math.abs(manualTotalScheduled - netPayable) > 10) {
            return alert(`Manual schedule matches ₹${manualTotalScheduled}, but net payable is ₹${Math.round(netPayable)}. Please balance the payments.`);
        }
        milestones = manualMilestones.map((m, idx) => ({ ...m, id: `M-${idx+1}`, status: 'PENDING', warningCount: 0 } as any));
    } else {
        milestones = generateMilestones(netPayable);
    }

    const finalOrder: Order = {
      id: `ORD-${Date.now()}`,
      shareToken: Math.random().toString(36).substring(2, 10),
      customerName: customer.name,
      customerContact: customer.contact,
      customerEmail: customer.email,
      items: cartItems,
      oldGoldExchange: exchanges,
      payments: [],
      totalAmount: cartTotal,
      exchangeValue: exchangeTotalValue,
      netPayable: netPayable,
      goldRateAtBooking: orderRate,
      status: OrderStatus.ACTIVE,
      createdAt: new Date().toISOString(),
      paymentPlan: { ...plan, milestones, protectionStatus: ProtectionStatus.ACTIVE, protectionRateBooked: protectionRate, protectionDeadline: milestones[milestones.length - 1].dueDate, protectionLimit: settings.goldRateProtectionMax } as PaymentPlan
    };
    onSubmit(finalOrder);
  };

  const generateMilestones = (total: number): Milestone[] => {
    const advance = total * ((plan.advancePercentage || 10) / 100);
    const perMonth = (total - advance) / (plan.months || 1);
    const milestones: Milestone[] = [{ id: 'ADV', dueDate: new Date().toISOString().split('T')[0], targetAmount: Math.round(advance), cumulativeTarget: Math.round(advance), status: 'PENDING', warningCount: 0, description: 'Booking Advance' }];
    for (let i = 1; i <= (plan.months || 1); i++) {
      const d = new Date(); d.setMonth(d.getMonth() + i);
      milestones.push({ id: `M${i}`, dueDate: d.toISOString().split('T')[0], targetAmount: Math.round(perMonth), cumulativeTarget: Math.round(advance + (perMonth * i)), status: 'PENDING', warningCount: 0, description: `Installment ${i}` });
    }
    return milestones;
  };

  const manualTotalScheduled = useMemo(() => manualMilestones.reduce((acc, m) => acc + (m.targetAmount || 0), 0), [manualMilestones]);

  return (
    <div className="flex flex-col min-h-full max-w-5xl mx-auto space-y-4 pb-20">
      
      <div className="flex bg-white rounded-2xl border overflow-hidden p-1 shadow-sm">
        {[1, 2, 3].map(s => (
          <div key={s} className={`flex-1 py-3 text-center text-[10px] font-black uppercase tracking-widest transition-all ${step === s ? 'bg-slate-900 text-white rounded-xl' : 'text-slate-400'}`}>
            {s === 1 ? 'Design & Specs' : s === 2 ? 'Customer & KYC' : 'Settlement & EMI'}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4 animate-fadeIn">
          {/* Rate & Cart Summary */}
          <div className="bg-slate-900 p-8 rounded-[2.5rem] flex justify-between items-center text-white shadow-2xl border border-slate-800 relative overflow-hidden">
            <div className="relative z-10">
               <p className="text-[10px] font-black uppercase text-amber-500 mb-1 tracking-[0.2em]">Live Gold Rate Applied</p>
               <div className="flex items-center gap-2">
                 <span className="text-amber-500 font-black text-2xl">₹</span>
                 <input type="number" className="bg-transparent text-4xl font-black outline-none w-44 border-b border-white/10" value={orderRate} onChange={e => setOrderRate(parseFloat(e.target.value) || 0)} />
                 <span className="text-slate-500 font-bold text-sm">/g</span>
               </div>
            </div>
            <div className="text-right relative z-10">
                <p className="text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">Order Sub-Total</p>
                <p className="text-4xl font-black text-amber-400">₹{cartTotal.toLocaleString()}</p>
                {exchangeTotalValue > 0 && <p className="text-xs font-bold text-emerald-400 mt-1">- ₹{exchangeTotalValue.toLocaleString()} (Exchange)</p>}
            </div>
            <div className="absolute top-0 right-0 opacity-10 pointer-events-none translate-x-1/4 -translate-y-1/4"><Gem size={200} /></div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-6">
                <div className="pos-card p-6">
                    <SectionHeader title="Item Details" icon={Gem} />
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                        <InputWrapper label="Category"><select className="w-full font-bold bg-transparent outline-none" value={currentItem.category} onChange={e => setCurrentItem({...currentItem, category: e.target.value})}>{['Ring', 'Necklace', 'Earrings', 'Bangle', 'Set', 'Pendant', 'Chain'].map(c => <option key={c}>{c}</option>)}</select></InputWrapper>
                        <InputWrapper label="Purity"><select className="w-full font-bold bg-transparent outline-none" value={currentItem.purity} onChange={e => setCurrentItem({...currentItem, purity: e.target.value as any})}><option>22K</option><option>24K</option><option>18K</option></select></InputWrapper>
                        <InputWrapper label="Color"><select className="w-full font-bold bg-transparent outline-none" value={currentItem.metalColor} onChange={e => setCurrentItem({...currentItem, metalColor: e.target.value as any})}><option>Yellow Gold</option><option>Rose Gold</option><option>White Gold</option></select></InputWrapper>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <InputWrapper label="Gross Wt (g)"><input type="number" step="0.001" className="w-full font-bold bg-transparent" value={currentItem.grossWeight || ''} onChange={e => setCurrentItem({...currentItem, grossWeight: parseFloat(e.target.value) || 0})} /></InputWrapper>
                        <InputWrapper label="Net Wt (g)"><input type="number" step="0.001" className="w-full font-black bg-transparent text-emerald-700" value={currentItem.netWeight || ''} onChange={e => setCurrentItem({...currentItem, netWeight: parseFloat(e.target.value) || 0})} /></InputWrapper>
                        <InputWrapper label="VA %"><input type="number" className="w-full font-bold bg-transparent" value={currentItem.wastagePercentage || ''} onChange={e => setCurrentItem({...currentItem, wastagePercentage: parseFloat(e.target.value) || 0})} /></InputWrapper>
                        <InputWrapper label="Labor / g"><input type="number" className="w-full font-bold bg-transparent" value={currentItem.makingChargesPerGram || ''} onChange={e => setCurrentItem({...currentItem, makingChargesPerGram: parseFloat(e.target.value) || 0})} /></InputWrapper>
                    </div>

                    <div className="space-y-4 mb-6">
                        <label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2"><Scissors size={14}/> Stone Breakdown</label>
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
                                <div className="md:col-span-1"><label className="text-[8px] font-bold uppercase text-slate-400">Type</label><input className="w-full p-2 rounded-lg border text-xs font-bold" value={tempStone.type} onChange={e => setTempStone({...tempStone, type: e.target.value})} /></div>
                                <div><label className="text-[8px] font-bold uppercase text-slate-400">Qty/Wt</label><input type="number" className="w-full p-2 rounded-lg border text-xs font-bold" value={tempStone.weight || ''} onChange={e => setTempStone({...tempStone, weight: parseFloat(e.target.value)})} /></div>
                                <div><label className="text-[8px] font-bold uppercase text-slate-400">Rate</label><input type="number" className="w-full p-2 rounded-lg border text-xs font-bold" value={tempStone.rate || ''} onChange={e => setTempStone({...tempStone, rate: parseFloat(e.target.value)})} /></div>
                                <div className="md:col-span-1"><label className="text-[8px] font-bold uppercase text-slate-400">Specs</label><input className="w-full p-2 rounded-lg border text-xs" value={tempStone.quality || ''} onChange={e => setTempStone({...tempStone, quality: e.target.value})} /></div>
                                <button onClick={handleAddStone} className="bg-slate-900 text-white p-2 rounded-lg flex items-center justify-center hover:bg-slate-800 transition-colors"><Plus size={16}/></button>
                            </div>
                            
                            {(currentItem.stoneEntries || []).length > 0 && (
                                <div className="mt-4 space-y-2">
                                    {currentItem.stoneEntries?.map((s, idx) => (
                                        <div key={s.id} className="flex justify-between items-center bg-white p-2 rounded-lg border text-xs font-medium">
                                            <span>{s.type} ({s.weight}{s.unit}) @ ₹{s.rate} {s.quality && <span className="text-slate-400 ml-1">• {s.quality}</span>}</span>
                                            <div className="flex items-center gap-3">
                                                <span className="font-bold">₹{s.total.toLocaleString()}</span>
                                                <button onClick={() => setCurrentItem({...currentItem, stoneEntries: currentItem.stoneEntries?.filter((_, i) => i !== idx)})} className="text-rose-500"><X size={12}/></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <InputWrapper label="HUID"><input className="w-full font-bold bg-transparent uppercase" value={currentItem.huid || ''} onChange={e => setCurrentItem({...currentItem, huid: e.target.value.toUpperCase()})} placeholder="Hallmark ID" /></InputWrapper>
                        <InputWrapper label="Size / Remarks"><input className="w-full font-bold bg-transparent" value={currentItem.size || ''} onChange={e => setCurrentItem({...currentItem, size: e.target.value})} placeholder="e.g. 14 / Custom Engrave" /></InputWrapper>
                    </div>
                </div>
            </div>

            <div className="lg:col-span-4 space-y-6">
                <div className="bg-amber-50 p-6 rounded-[2rem] border border-amber-200 shadow-sm">
                    <h4 className="text-xs font-black uppercase text-amber-700 mb-4 tracking-widest">Price Estimation</h4>
                    <div className="space-y-3">
                        <div className="flex justify-between text-xs font-medium"><span>Metal Value</span><span className="font-bold">₹{Math.round(pricing.metalValue).toLocaleString()}</span></div>
                        <div className="flex justify-between text-xs font-medium"><span>Wastage (VA)</span><span className="font-bold">₹{Math.round(pricing.wastageValue).toLocaleString()}</span></div>
                        <div className="flex justify-between text-xs font-medium"><span>Labor (MC)</span><span className="font-bold">₹{Math.round(pricing.laborValue).toLocaleString()}</span></div>
                        <div className="flex justify-between text-xs font-medium"><span>Stone Charges</span><span className="font-bold">₹{Math.round(currentStoneTotal).toLocaleString()}</span></div>
                        <div className="border-t border-amber-200 pt-2 flex justify-between text-sm font-black text-amber-900"><span>Sub-Total</span><span>₹{Math.round(pricing.total - pricing.tax).toLocaleString()}</span></div>
                        <div className="flex justify-between text-xs font-medium text-slate-500"><span>GST ({settings.defaultTaxRate}%)</span><span>₹{Math.round(pricing.tax).toLocaleString()}</span></div>
                        <div className="border-t-2 border-amber-300 pt-3 flex justify-between text-xl font-black text-slate-900"><span>Total</span><span>₹{Math.round(pricing.total).toLocaleString()}</span></div>
                    </div>
                    <button onClick={handleAddItem} className="w-full bg-slate-900 text-white py-4 rounded-xl mt-6 font-black uppercase text-xs tracking-widest shadow-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
                        <Plus size={18} /> Add to Cart
                    </button>
                </div>

                <div className="bg-emerald-900 p-6 rounded-[2rem] text-white shadow-xl">
                    <SectionHeader title="Old Gold Exchange" icon={Coins} dark />
                    <p className="text-[10px] text-emerald-300 mb-4">Accepting scrap gold for deduction.</p>
                    {exchanges.length > 0 ? (
                        <div className="space-y-2 mb-4">
                            {exchanges.map((e, idx) => (
                                <div key={idx} className="bg-emerald-800/50 p-3 rounded-xl border border-emerald-700/50 flex justify-between items-center">
                                    <div><p className="text-[10px] font-bold">{e.description}</p><p className="text-xs font-black">{e.grossWeight}g • {e.purityPercent}%</p></div>
                                    <div className="text-right">
                                        <p className="font-black text-amber-400">₹{Math.round(e.totalValue).toLocaleString()}</p>
                                        <button onClick={() => setExchanges(exchanges.filter((_, i) => i !== idx))} className="text-emerald-400"><X size={12}/></button>
                                    </div>
                                </div>
                            ))}
                            <div className="pt-2 border-t border-emerald-700 flex justify-between font-black text-sm"><span>Total Deduction</span><span className="text-amber-400">₹{exchangeTotalValue.toLocaleString()}</span></div>
                        </div>
                    ) : (
                        <div className="text-[10px] italic text-emerald-400 mb-4 text-center py-4 border border-dashed border-emerald-700 rounded-xl">No exchange gold recorded.</div>
                    )}
                    <button onClick={() => setShowExchangeModal(true)} className="w-full bg-white/10 hover:bg-white/20 border border-white/20 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Record Exchange Gold</button>
                </div>
            </div>
          </div>

          {cartItems.length > 0 && (
              <div className="pos-card overflow-hidden">
                  <div className="bg-slate-50 p-4 border-b flex justify-between items-center">
                    <p className="text-[10px] font-black uppercase text-slate-500">Inventory Basket ({cartItems.length} Items)</p>
                    <p className="text-xs font-black text-slate-800 uppercase tracking-widest">Cart Total: ₹{cartTotal.toLocaleString()}</p>
                  </div>
                  <div className="divide-y">
                      {cartItems.map(item => (
                          <div key={item.id} className="p-4 flex justify-between items-center group hover:bg-slate-50 transition-colors">
                              <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 overflow-hidden border">
                                    {item.photoUrls?.[0] ? <img src={item.photoUrls[0]} className="w-full h-full object-cover" /> : <ImageIcon size={20} />}
                                  </div>
                                  <div>
                                      <p className="font-black text-sm text-slate-800">{item.category} ({item.metalColor})</p>
                                      <p className="text-[9px] text-slate-400 uppercase font-bold">{item.purity} • {item.netWeight}g • {item.stoneEntries.length} Stones</p>
                                  </div>
                              </div>
                              <div className="flex items-center gap-4">
                                  <p className="font-black text-sm text-slate-900">₹{Math.round(item.finalAmount).toLocaleString()}</p>
                                  <button onClick={() => setCartItems(cartItems.filter(i => i.id !== item.id))} className="text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-colors"><Trash2 size={16} /></button>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6 animate-fadeIn py-8 max-w-2xl mx-auto">
            <h3 className="text-2xl font-black text-slate-800">Client Identification</h3>
            <div className="pos-card p-10 space-y-8">
                <InputWrapper label="Customer Full Name"><input className="w-full font-bold text-2xl bg-transparent outline-none" value={customer.name} onChange={e => setCustomer({...customer, name: e.target.value})} placeholder="e.g. Priyanshu Mehta" /></InputWrapper>
                <InputWrapper label="WhatsApp Primary Contact"><input type="tel" className="w-full font-black text-2xl bg-transparent outline-none text-emerald-700" value={customer.contact} onChange={e => setCustomer({...customer, contact: e.target.value})} placeholder="91XXXXXXXXXX" /></InputWrapper>
                <InputWrapper label="Email Address (Optional)"><input type="email" className="w-full font-bold text-lg bg-transparent outline-none" value={customer.email || ''} onChange={e => setCustomer({...customer, email: e.target.value})} placeholder="client@auragold.com" /></InputWrapper>
            </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6 animate-fadeIn py-4">
            <div className="flex bg-slate-100 p-1 rounded-2xl mb-4">
                <button onClick={() => setPlanMode('AUTO')} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${planMode === 'AUTO' ? 'bg-white shadow-md text-slate-900' : 'text-slate-400'}`}>Standard Installments</button>
                <button onClick={() => setPlanMode('MANUAL')} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${planMode === 'MANUAL' ? 'bg-white shadow-md text-slate-900' : 'text-slate-400'}`}>Bespoke Schedule</button>
            </div>

            <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white flex justify-between items-center shadow-2xl relative overflow-hidden">
                <div>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-1">Final Settlement Amount</p>
                    <p className="text-5xl font-black text-white">₹{Math.round(netPayable).toLocaleString()}</p>
                    <p className="text-[10px] font-bold text-emerald-400 mt-2">After deducting ₹{exchangeTotalValue.toLocaleString()} exchange value</p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Protection Limit</p>
                    <p className="text-xl font-bold">₹{protectionRate.toLocaleString()}/g</p>
                </div>
            </div>

            {planMode === 'AUTO' ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {planTemplates.map(t => (
                        <div key={t.id} onClick={() => setPlan({...plan, type: 'PRE_CREATED', templateId: t.id, months: t.months, advancePercentage: t.advancePercentage, interestPercentage: t.interestPercentage})} className={`p-6 rounded-[2rem] border-2 cursor-pointer transition-all ${plan.templateId === t.id ? 'bg-slate-900 text-white border-slate-900 scale-105 shadow-xl' : 'bg-white border-slate-100 hover:border-amber-400'}`}>
                            <h4 className="font-black text-sm uppercase tracking-widest mb-2">{t.name}</h4>
                            <p className="text-2xl font-black mb-4">{t.months} Months</p>
                            <div className="text-[10px] font-bold opacity-60">
                                <p>Advance: {t.advancePercentage}%</p>
                                <p>Interest: {t.interestPercentage}%</p>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="pos-card overflow-hidden">
                    <div className="bg-slate-50 p-4 border-b flex justify-between">
                        <span className="text-xs font-black uppercase text-slate-400">Scheduled Milestones</span>
                        <span className={`text-xs font-black ${Math.abs(manualTotalScheduled - netPayable) < 10 ? 'text-emerald-600' : 'text-rose-500'}`}>Covered: ₹{manualTotalScheduled.toLocaleString()}</span>
                    </div>
                    {manualMilestones.map((m, idx) => (
                        <div key={idx} className="flex p-4 gap-4 border-b items-center">
                            <input className="flex-1 bg-transparent font-bold text-sm" placeholder="Description" value={m.description || ''} onChange={e => { const u = [...manualMilestones]; u[idx].description = e.target.value; setManualMilestones(u); }} />
                            <input type="date" className="w-36 bg-transparent text-xs" value={m.dueDate} onChange={e => { const u = [...manualMilestones]; u[idx].dueDate = e.target.value; setManualMilestones(u); }} />
                            <input type="number" className="w-28 bg-transparent font-black text-right" value={m.targetAmount || ''} onChange={e => { const u = [...manualMilestones]; u[idx].targetAmount = parseFloat(e.target.value); setManualMilestones(u); }} />
                            <button onClick={() => setManualMilestones(manualMilestones.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-rose-500"><Trash2 size={16}/></button>
                        </div>
                    ))}
                    <button onClick={() => setManualMilestones([...manualMilestones, { description: '', dueDate: new Date().toISOString().split('T')[0], targetAmount: 0 }])} className="w-full py-4 text-xs font-bold text-slate-500 hover:bg-slate-50 transition-colors">+ Add Payment Phase</button>
                </div>
            )}
        </div>
      )}

      {/* Exchange Modal */}
      {showExchangeModal && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl animate-slideUp">
                  <div className="flex justify-between items-center mb-8">
                      <h3 className="text-xl font-black text-slate-800">Old Gold Valuation</h3>
                      <button onClick={() => setShowExchangeModal(false)}><X size={24}/></button>
                  </div>
                  <div className="space-y-6">
                      <InputWrapper label="Jewellery Description"><input className="w-full font-bold bg-transparent" value={tempExchange.description} onChange={e => setTempExchange({...tempExchange, description: e.target.value})} /></InputWrapper>
                      <div className="grid grid-cols-2 gap-4">
                          <InputWrapper label="Gross Weight (g)"><input type="number" className="w-full font-bold bg-transparent" value={tempExchange.grossWeight || ''} onChange={e => setTempExchange({...tempExchange, grossWeight: parseFloat(e.target.value)})} /></InputWrapper>
                          <InputWrapper label="Purchase Rate (/g)"><input type="number" className="w-full font-bold bg-transparent" value={tempExchange.rate || ''} onChange={e => setTempExchange({...tempExchange, rate: parseFloat(e.target.value)})} /></InputWrapper>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <InputWrapper label="Purity %"><input type="number" className="w-full font-bold bg-transparent" value={tempExchange.purityPercent || ''} onChange={e => setTempExchange({...tempExchange, purityPercent: parseFloat(e.target.value)})} /></InputWrapper>
                          <InputWrapper label="Melting Loss %"><input type="number" className="w-full font-bold bg-transparent" value={tempExchange.meltingLossPercent || ''} onChange={e => setTempExchange({...tempExchange, meltingLossPercent: parseFloat(e.target.value)})} /></InputWrapper>
                      </div>
                      <button onClick={handleAddExchange} className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl">Confirm Valuation</button>
                  </div>
              </div>
          </div>
      )}

      <div className="fixed bottom-[84px] left-0 right-0 p-4 lg:static lg:bg-none z-30">
          <div className="max-w-5xl mx-auto flex gap-3">
              {step > 1 && <button onClick={() => setStep(step - 1)} className="flex-1 bg-slate-200 text-slate-700 py-5 rounded-2xl font-black uppercase text-xs tracking-widest">Back</button>}
              <button 
                onClick={step === 3 ? submitOrder : () => setStep(step + 1)}
                className="flex-[2] bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all"
              >
                  {step === 3 ? <><ShieldCheck size={20} className="text-amber-400"/> Issue Digital Contract</> : <>Next Step <ArrowRight size={20}/></>}
              </button>
          </div>
      </div>
    </div>
  );
};

const SectionHeader = ({ title, icon: Icon, subtitle, dark = false }: any) => (
    <div className="flex items-center gap-3 mb-6">
        <div className={`p-2 rounded-xl ${dark ? 'bg-emerald-800' : 'bg-slate-100 text-slate-500'}`}><Icon size={20}/></div>
        <div><h3 className={`font-black text-sm uppercase tracking-widest ${dark ? 'text-white' : 'text-slate-800'}`}>{title}</h3>{subtitle && <p className="text-[10px] text-slate-400">{subtitle}</p>}</div>
    </div>
);

const InputWrapper = ({ label, children }: any) => (
    <div className="space-y-1">
        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 focus-within:border-amber-500 focus-within:bg-white transition-all shadow-sm">
            {children}
        </div>
    </div>
);

export default OrderForm;
