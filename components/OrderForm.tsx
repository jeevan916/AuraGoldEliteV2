
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, ShoppingBag, Trash2, ShieldCheck, 
  Calculator, User, ChevronRight, X, Loader2, Sparkles, Zap, Image as ImageIcon, Camera, Trash, 
  IndianRupee, ArrowRight, Lock, Calendar, Scale, Tag, Ruler, Upload, Gem, LayoutGrid, BrainCircuit, CheckCircle2,
  CalendarDays, AlignLeft
} from 'lucide-react';
import { 
  Order, JewelryDetail, OrderStatus, GlobalSettings, 
  ProductionStatus, Purity, ProtectionStatus, Milestone, PaymentPlan, PaymentPlanTemplate, CatalogItem
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
  const [customer, setCustomer] = useState({ name: '', contact: '' });
  const [cartItems, setCartItems] = useState<JewelryDetail[]>([]);
  const [orderRate, setOrderRate] = useState(settings.currentGoldRate22K);
  const [protectionRate, setProtectionRate] = useState(settings.currentGoldRate22K);
  
  // Catalog State
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [showCatalog, setShowCatalog] = useState(false);
  
  // Manual Milestones State
  const [planMode, setPlanMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [manualMilestones, setManualMilestones] = useState<Partial<Milestone>[]>([]);
  
  const initialItem: Partial<JewelryDetail> = {
    category: 'Ring', 
    purity: '22K', 
    metalColor: 'Yellow Gold',
    grossWeight: 0, 
    netWeight: 0, 
    stoneCharges: 0,
    stoneDetails: '',
    wastagePercentage: 12, 
    makingChargesPerGram: 450, 
    photoUrls: [], 
    huid: '', 
    size: ''
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

  // Sync protection rate with order rate initially, but allow deviation
  useEffect(() => {
      // Only sync if step is 1 (during initial rate setting) to prevent overwriting manual edits in step 3
      if (step === 1) {
          setProtectionRate(orderRate);
      }
  }, [orderRate, step]);

  const pricing = useMemo(() => {
    const rate = currentItem.purity === '24K' ? settings.currentGoldRate24K : 
                 currentItem.purity === '18K' ? settings.currentGoldRate18K : orderRate;
    const metalValue = (currentItem.netWeight || 0) * rate;
    const wastageValue = metalValue * ((currentItem.wastagePercentage || 0) / 100);
    const laborValue = (currentItem.makingChargesPerGram || 0) * (currentItem.netWeight || 0);
    const subTotal = metalValue + wastageValue + laborValue + (currentItem.stoneCharges || 0);
    const tax = subTotal * (settings.defaultTaxRate / 100);
    return { metalValue, wastageValue, laborValue, tax, total: subTotal + tax };
  }, [currentItem, orderRate, settings]);

  const cartTotal = useMemo(() => cartItems.reduce((s, i) => s + i.finalAmount, 0), [cartItems]);

  const handleSelectCatalogItem = (catItem: CatalogItem) => {
      setCurrentItem({
          ...currentItem,
          category: catItem.category,
          purity: catItem.purity,
          metalColor: catItem.metalColor as any,
          wastagePercentage: catItem.wastagePercentage,
          makingChargesPerGram: catItem.makingChargesPerGram,
          stoneCharges: catItem.stoneCharges || 0
      });
      setShowCatalog(false);
  };

  const handleApplyTemplate = (t: PaymentPlanTemplate) => {
      setPlan({
          ...plan,
          type: 'PRE_CREATED',
          templateId: t.id,
          months: t.months,
          advancePercentage: t.advancePercentage,
          interestPercentage: t.interestPercentage,
          goldRateProtection: true // Templates default to protected
      });
      setPlanMode('AUTO');
  };

  const handleManualPlanChange = (key: keyof PaymentPlan, value: any) => {
      setPlan(prev => ({
          ...prev,
          [key]: value,
          type: 'MANUAL',
          templateId: undefined // Clear template selection on manual edit
      }));
  };

  // Manual Milestone Management
  const handleAddManualMilestone = () => {
      setManualMilestones([...manualMilestones, { 
          id: `M-${Date.now()}`, 
          dueDate: new Date().toISOString().split('T')[0], 
          targetAmount: 0, 
          description: '' 
      }]);
  };

  const handleUpdateManualMilestone = (index: number, key: keyof Milestone, value: any) => {
      const updated = [...manualMilestones];
      updated[index] = { ...updated[index], [key]: value };
      setManualMilestones(updated);
  };

  const handleRemoveManualMilestone = (index: number) => {
      const updated = [...manualMilestones];
      updated.splice(index, 1);
      setManualMilestones(updated);
  };

  const manualTotalScheduled = useMemo(() => manualMilestones.reduce((acc, m) => acc + (m.targetAmount || 0), 0), [manualMilestones]);

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
      taxAmount: pricing.tax,
      finalAmount: pricing.total,
      productionStatus: ProductionStatus.DESIGNING,
      photoUrls: currentItem.photoUrls || []
    };
    
    setCartItems([...cartItems, item]);
    setCurrentItem(initialItem);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIsCompressing(true);
      try {
        const compressed = await compressImage(e.target.files[0]);
        setCurrentItem(prev => ({
          ...prev,
          photoUrls: [...(prev.photoUrls || []), compressed]
        }));
      } catch (error) {
        alert("Failed to process image. Ensure file is a standard image format.");
      } finally {
        setIsCompressing(false);
      }
    }
  };

  const removePhoto = (index: number) => {
    setCurrentItem(prev => ({
        ...prev,
        photoUrls: (prev.photoUrls || []).filter((_, i) => i !== index)
    }));
  };

  const generateMilestones = (total: number): Milestone[] => {
    const advance = total * ((plan.advancePercentage || 10) / 100);
    const remaining = total - advance;
    
    // Simple Interest Logic: (Principal * Rate * Time_in_years) / 100
    // Time is months/12
    const interest = remaining * ((plan.interestPercentage || 0) / 100) * ((plan.months || 1) / 12);
    const finalRemaining = remaining + interest;
    
    const perMonth = finalRemaining / (plan.months || 1);
    const milestones: Milestone[] = [];
    
    milestones.push({ 
      id: 'ADV', 
      dueDate: new Date().toISOString().split('T')[0], 
      targetAmount: Math.round(advance), 
      cumulativeTarget: Math.round(advance), 
      status: 'PENDING', 
      warningCount: 0,
      description: 'Advance / Down Payment'
    });

    for (let i = 1; i <= (plan.months || 1); i++) {
      const d = new Date(); 
      d.setMonth(d.getMonth() + i);
      milestones.push({ 
        id: `M${i}`, 
        dueDate: d.toISOString().split('T')[0], 
        targetAmount: Math.round(perMonth), 
        cumulativeTarget: Math.round(advance + (perMonth * i)), 
        status: 'PENDING', 
        warningCount: 0,
        description: `Installment ${i}`
      });
    }
    return milestones;
  };

  const submitOrder = () => {
    if (cartItems.length === 0) return alert("Please add at least one jewellery item.");
    if (!customer.name || !customer.contact) return alert("Customer Name and Contact Number are mandatory.");

    let milestones: Milestone[] = [];

    if (planMode === 'MANUAL') {
        if (Math.abs(manualTotalScheduled - cartTotal) > 10) {
            return alert(`Manual schedule matches ₹${manualTotalScheduled}, but order total is ₹${Math.round(cartTotal)}. Please balance the payments.`);
        }
        if (manualMilestones.length === 0) return alert("Please add at least one payment milestone.");
        
        let cumulative = 0;
        milestones = manualMilestones.map((m, idx) => {
            cumulative += (m.targetAmount || 0);
            return {
                ...m,
                id: `M-${idx+1}`,
                cumulativeTarget: cumulative,
                status: 'PENDING',
                warningCount: 0
            } as Milestone;
        });
    } else {
        milestones = generateMilestones(cartTotal);
    }

    const finalOrder: Order = {
      id: `ORD-${Date.now()}`,
      shareToken: Math.random().toString(36).substring(2, 10),
      customerName: customer.name,
      customerContact: customer.contact,
      items: cartItems,
      payments: [],
      totalAmount: cartTotal,
      goldRateAtBooking: orderRate,
      status: OrderStatus.ACTIVE,
      createdAt: new Date().toISOString(),
      paymentPlan: { 
        ...plan, 
        milestones, 
        protectionStatus: ProtectionStatus.ACTIVE, 
        protectionRateBooked: protectionRate, // Explicit protection rate
        protectionDeadline: milestones[milestones.length - 1].dueDate, 
        protectionLimit: settings.goldRateProtectionMax 
      } as PaymentPlan
    };
    onSubmit(finalOrder);
  };

  return (
    <div className="flex flex-col min-h-full max-w-4xl mx-auto space-y-4 pb-20">
      
      <div className="flex bg-white rounded-2xl border overflow-hidden p-1 shadow-sm">
        {[1, 2, 3].map(s => (
          <div 
            key={s} 
            className={`flex-1 py-3 text-center text-[10px] font-black uppercase tracking-widest transition-all ${
              step === s ? 'bg-slate-900 text-white rounded-xl' : 'text-slate-400'
            }`}
          >
            {s === 1 ? 'Jewellery Specs' : s === 2 ? 'Client Details' : 'Payment Plan'}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4 animate-fadeIn">
          <div className="bg-slate-900 p-6 rounded-[2rem] flex justify-between items-center text-white shadow-xl border border-slate-800">
            <div>
               <p className="text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">Locked 22K Rate</p>
               <div className="flex items-center gap-2">
                 <span className="text-amber-500 font-black">₹</span>
                 <input 
                   type="number" 
                   className="bg-transparent text-3xl font-black outline-none w-36 border-b border-white/10" 
                   value={orderRate} 
                   onChange={e => setOrderRate(parseFloat(e.target.value) || 0)} 
                 />
               </div>
            </div>
            <div className="text-right">
                <p className="text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">Order Estimate</p>
                <p className="text-3xl font-black text-amber-400">₹{cartTotal.toLocaleString()}</p>
            </div>
          </div>

          <div className="pos-card p-5 space-y-6 relative">
            <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 uppercase tracking-wide">
                    <Gem size={16} className="text-amber-500" /> Item Specification
                </h3>
                <button 
                    onClick={() => setShowCatalog(!showCatalog)}
                    className="flex items-center gap-2 bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-amber-100 transition-colors"
                >
                    <LayoutGrid size={12} /> Select from Catalog
                </button>
            </div>

            {/* Catalog Popup */}
            {showCatalog && (
                <div className="absolute top-16 right-4 z-50 bg-white shadow-2xl rounded-2xl border border-slate-100 w-72 p-4 animate-slideUp">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-black uppercase text-slate-400">Quick Select</span>
                        <button onClick={() => setShowCatalog(false)}><X size={16} /></button>
                    </div>
                    <div className="max-h-60 overflow-y-auto space-y-2">
                        {catalog.length === 0 ? <p className="text-xs text-slate-400 italic">No items in catalog.</p> : catalog.map(c => (
                            <div key={c.id} onClick={() => handleSelectCatalogItem(c)} className="p-3 bg-slate-50 hover:bg-amber-50 rounded-xl cursor-pointer border border-transparent hover:border-amber-200">
                                <p className="font-bold text-slate-800 text-sm">{c.name}</p>
                                <p className="text-[10px] text-slate-500">{c.category} • {c.purity} • {c.wastagePercentage}% VA</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <InputWrapper label="Category">
                    <select 
                      className="w-full font-bold bg-transparent outline-none text-slate-800" 
                      value={currentItem.category} 
                      onChange={e => setCurrentItem({...currentItem, category: e.target.value})}
                    >
                        {['Ring', 'Necklace', 'Earrings', 'Bangle', 'Bracelet', 'Chain', 'Pendant', 'Set', 'Mangalsutra', 'Coins', 'Kada'].map(c => <option key={c}>{c}</option>)}
                    </select>
                </InputWrapper>
                <InputWrapper label="Purity">
                    <select 
                      className="w-full font-bold bg-transparent outline-none text-slate-800" 
                      value={currentItem.purity} 
                      onChange={e => setCurrentItem({...currentItem, purity: e.target.value as Purity})}
                    >
                        <option value="22K">22K Hallmark</option>
                        <option value="24K">24K Bullion</option>
                        <option value="18K">18K Studded</option>
                    </select>
                </InputWrapper>
                <InputWrapper label="Metal Color">
                    <select 
                      className="w-full font-bold bg-transparent outline-none text-slate-800" 
                      value={currentItem.metalColor} 
                      onChange={e => setCurrentItem({...currentItem, metalColor: e.target.value as any})}
                    >
                        <option value="Yellow Gold">Yellow Gold</option>
                        <option value="Rose Gold">Rose Gold</option>
                        <option value="White Gold">White Gold</option>
                    </select>
                </InputWrapper>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <InputWrapper label="Gross Wt (g)">
                    <input 
                      type="number" step="0.001" className="w-full font-black text-lg bg-transparent" 
                      value={currentItem.grossWeight || ''} 
                      onChange={e => setCurrentItem({...currentItem, grossWeight: parseFloat(e.target.value) || 0})} 
                      placeholder="0.000" 
                    />
                </InputWrapper>
                <InputWrapper label="Net Wt (g)">
                    <input 
                      type="number" step="0.001" className="w-full font-black text-lg bg-transparent text-emerald-700" 
                      value={currentItem.netWeight || ''} 
                      onChange={e => setCurrentItem({...currentItem, netWeight: parseFloat(e.target.value) || 0})} 
                      placeholder="0.000" 
                    />
                </InputWrapper>
                <InputWrapper label="HUID (Unique ID)">
                    <input 
                      type="text" className="w-full font-black text-lg bg-transparent text-slate-500 uppercase" 
                      value={currentItem.huid || ''} 
                      onChange={e => setCurrentItem({...currentItem, huid: e.target.value.toUpperCase()})} 
                      placeholder="ABC123" 
                    />
                </InputWrapper>
                <InputWrapper label="Size/Length">
                    <input 
                      type="text" className="w-full font-bold text-lg bg-transparent" 
                      value={currentItem.size || ''} 
                      onChange={e => setCurrentItem({...currentItem, size: e.target.value})} 
                      placeholder="e.g. 14 / 2.4" 
                    />
                </InputWrapper>
            </div>

            <div className="grid grid-cols-2 gap-4">
                 <InputWrapper label="Stone Charges">
                    <input type="number" className="w-full font-black text-lg bg-transparent" value={currentItem.stoneCharges || ''} onChange={e => setCurrentItem({...currentItem, stoneCharges: parseFloat(e.target.value) || 0})} placeholder="0" />
                </InputWrapper>
                <InputWrapper label="Stone Details">
                    <input type="text" className="w-full font-bold text-sm bg-transparent" value={currentItem.stoneDetails || ''} onChange={e => setCurrentItem({...currentItem, stoneDetails: e.target.value})} placeholder="Ex: 5pcs CZ / 0.10ct Diamond" />
                </InputWrapper>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <InputWrapper label="Wastage (VA %)">
                    <input type="number" className="w-full font-black text-lg bg-transparent" value={currentItem.wastagePercentage || ''} onChange={e => setCurrentItem({...currentItem, wastagePercentage: parseFloat(e.target.value) || 0})} placeholder="12" />
                </InputWrapper>
                <InputWrapper label="Labor / g">
                    <input type="number" className="w-full font-black text-lg bg-transparent" value={currentItem.makingChargesPerGram || ''} onChange={e => setCurrentItem({...currentItem, makingChargesPerGram: parseFloat(e.target.value) || 0})} placeholder="450" />
                </InputWrapper>
            </div>

            <div className="border-t border-slate-100 pt-4">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Reference Photos (Hallmark/Design)</label>
                <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                    <div className="relative shrink-0">
                        <input 
                            type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10"
                            onChange={handleImageUpload} disabled={isCompressing}
                        />
                        <div className="w-20 h-20 bg-slate-100 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 hover:bg-slate-50 transition-colors">
                            {isCompressing ? <Loader2 className="animate-spin" size={20} /> : <Camera size={20} />}
                            <span className="text-[8px] font-bold uppercase mt-1">Capture</span>
                        </div>
                    </div>
                    {(currentItem.photoUrls || []).map((url, idx) => (
                        <div key={idx} className="relative shrink-0 w-20 h-20 group">
                            <img src={url} className="w-full h-full object-cover rounded-xl border border-slate-200" />
                            <button onClick={() => removePhoto(idx)} className="absolute -top-1 -right-1 bg-rose-500 text-white p-1 rounded-full shadow-md hover:bg-rose-600 transition-colors">
                                <X size={10} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-amber-50 p-5 rounded-2xl border border-amber-200 flex justify-between items-center shadow-inner">
                <div>
                    <p className="text-[9px] font-black uppercase text-amber-600 mb-1 tracking-wider">Estimated Value</p>
                    <p className="text-2xl font-black text-slate-900">₹{Math.round(pricing.total).toLocaleString()}</p>
                </div>
                <button 
                  onClick={handleAddItem} 
                  className="bg-slate-900 text-white px-8 py-3.5 rounded-xl font-black text-xs uppercase flex items-center gap-2 active:scale-95 shadow-lg"
                >
                    <Plus size={18} /> Add to Order
                </button>
            </div>
          </div>

          {cartItems.length > 0 && (
              <div className="pos-card overflow-hidden">
                  <div className="bg-slate-50 p-4 border-b flex justify-between items-center">
                    <p className="text-[10px] font-black uppercase text-slate-500">Selected Items ({cartItems.length})</p>
                    <p className="text-xs font-black text-slate-800 uppercase tracking-widest">Running Total: ₹{cartTotal.toLocaleString()}</p>
                  </div>
                  <div className="divide-y">
                      {cartItems.map(item => (
                          <div key={item.id} className="p-4 flex justify-between items-center bg-white group hover:bg-slate-50 transition-colors">
                              <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 overflow-hidden">
                                    {item.photoUrls?.[0] ? <img src={item.photoUrls[0]} className="w-full h-full object-cover" /> : <ImageIcon size={20} />}
                                  </div>
                                  <div>
                                      <p className="font-black text-sm text-slate-800">{item.category} • {item.metalColor}</p>
                                      <p className="text-[10px] text-slate-400 uppercase font-bold">
                                          {item.purity} • {item.netWeight}g
                                          {item.huid && <span className="ml-2 text-emerald-600 font-mono tracking-tighter">[{item.huid}]</span>}
                                      </p>
                                      {item.stoneDetails && <p className="text-[9px] text-amber-700 italic font-medium">{item.stoneDetails}</p>}
                                  </div>
                              </div>
                              <div className="flex items-center gap-4">
                                  <p className="font-black text-sm">₹{Math.round(item.finalAmount).toLocaleString()}</p>
                                  <button onClick={() => setCartItems(cartItems.filter(i => i.id !== item.id))} className="text-rose-500 p-2 hover:bg-rose-50 rounded-lg"><Trash2 size={18} /></button>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4 animate-fadeIn py-6">
            <h3 className="text-lg font-black text-slate-800 ml-1">Client Authorization</h3>
            <div className="pos-card p-8 space-y-6">
                <InputWrapper label="Customer Legal Name">
                    <input 
                      className="w-full font-bold text-xl bg-transparent p-1 outline-none" 
                      value={customer.name} 
                      onChange={e => setCustomer({...customer, name: e.target.value})} 
                      placeholder="Ex: Ananya Sharma" 
                    />
                </InputWrapper>
                <InputWrapper label="Verified WhatsApp Number">
                    <input 
                      type="tel" className="w-full font-bold text-xl bg-transparent p-1 outline-none" 
                      value={customer.contact} 
                      onChange={e => setCustomer({...customer, contact: e.target.value})} 
                      placeholder="91XXXXXXXXXX" 
                    />
                </InputWrapper>
            </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6 animate-fadeIn py-4">
            
            {/* Mode Toggle */}
            <div className="flex bg-slate-100 p-1 rounded-xl">
                <button 
                    onClick={() => setPlanMode('AUTO')}
                    className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${planMode === 'AUTO' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}
                >
                    Auto-Generate
                </button>
                <button 
                    onClick={() => setPlanMode('MANUAL')}
                    className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${planMode === 'MANUAL' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}
                >
                    Manual Schedule
                </button>
            </div>

            {planMode === 'AUTO' && (
                <>
                    <div>
                        <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <BrainCircuit size={16} /> Select Plan Template
                        </h3>
                        <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                            {planTemplates.map(t => (
                                <div 
                                    key={t.id} 
                                    onClick={() => handleApplyTemplate(t)}
                                    className={`min-w-[180px] p-4 rounded-2xl border cursor-pointer transition-all ${
                                        plan.templateId === t.id ? 'bg-slate-900 text-white border-slate-900 shadow-xl scale-105' : 'bg-white text-slate-600 border-slate-200 hover:border-amber-400'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="font-black text-xs uppercase tracking-wide opacity-80">{t.months} Months</span>
                                        {plan.templateId === t.id && <CheckCircle2 size={16} className="text-emerald-400" />}
                                    </div>
                                    <h4 className="font-bold text-sm leading-tight mb-2">{t.name}</h4>
                                    <div className="text-[10px] font-bold opacity-70">
                                        <div>Interest: {t.interestPercentage}%</div>
                                        <div>Advance: {t.advancePercentage}%</div>
                                    </div>
                                </div>
                            ))}
                            {planTemplates.length === 0 && <div className="text-xs text-slate-400 italic p-4">No templates found. Configure manually.</div>}
                        </div>
                    </div>

                    <div className="flex justify-between items-end border-t pt-4">
                        <h3 className="text-lg font-black text-slate-800 ml-1">Manual Configuration</h3>
                        <p className="text-xs font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full uppercase tracking-tighter">Agreement Total: ₹{cartTotal.toLocaleString()}</p>
                    </div>

                    <div className="pos-card p-6 space-y-6">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                            <InputWrapper label="Installment Period (Months)">
                                <input 
                                type="number" className="w-full font-black text-xl bg-transparent" 
                                value={plan.months} 
                                onChange={e => handleManualPlanChange('months', parseInt(e.target.value) || 1)} 
                                />
                            </InputWrapper>
                            <InputWrapper label="Booking Advance %">
                                <input 
                                type="number" className="w-full font-black text-xl bg-transparent" 
                                value={plan.advancePercentage} 
                                onChange={e => handleManualPlanChange('advancePercentage', parseFloat(e.target.value) || 0)} 
                                />
                            </InputWrapper>
                            <InputWrapper label="Interest % (Flat)">
                                <input 
                                type="number" className="w-full font-black text-xl bg-transparent" 
                                value={plan.interestPercentage || 0} 
                                onChange={e => handleManualPlanChange('interestPercentage', parseFloat(e.target.value) || 0)} 
                                />
                            </InputWrapper>
                        </div>
                    </div>
                </>
            )}

            {planMode === 'MANUAL' && (
                <div className="animate-fadeIn space-y-4">
                    <div className="flex justify-between items-center bg-white p-4 rounded-2xl border shadow-sm">
                        <div>
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Order Total</p>
                            <p className="text-xl font-black text-slate-800">₹{cartTotal.toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Scheduled</p>
                            <p className={`text-xl font-black ${Math.abs(manualTotalScheduled - cartTotal) < 10 ? 'text-emerald-600' : 'text-rose-500'}`}>
                                ₹{manualTotalScheduled.toLocaleString()}
                            </p>
                        </div>
                    </div>

                    <div className="pos-card overflow-hidden">
                        <div className="bg-slate-50 p-3 flex text-[9px] font-black uppercase text-slate-400 tracking-widest border-b">
                            <div className="flex-[2]">Instruction</div>
                            <div className="flex-1">Date</div>
                            <div className="flex-1">Amount</div>
                            <div className="w-8"></div>
                        </div>
                        {manualMilestones.map((m, idx) => (
                            <div key={m.id} className="flex items-center border-b p-2 gap-2 group hover:bg-slate-50 transition-colors">
                                <div className="flex-[2]">
                                    <input 
                                        type="text" 
                                        className="w-full bg-transparent font-bold text-sm outline-none placeholder:text-slate-300"
                                        placeholder="e.g. Advance / Diwali Payment"
                                        value={m.description || ''}
                                        onChange={(e) => handleUpdateManualMilestone(idx, 'description', e.target.value)}
                                    />
                                </div>
                                <div className="flex-1">
                                    <input 
                                        type="date"
                                        className="w-full bg-transparent font-medium text-xs outline-none"
                                        value={m.dueDate}
                                        onChange={(e) => handleUpdateManualMilestone(idx, 'dueDate', e.target.value)}
                                    />
                                </div>
                                <div className="flex-1">
                                    <input 
                                        type="number"
                                        className="w-full bg-transparent font-black text-sm outline-none text-slate-800"
                                        placeholder="0"
                                        value={m.targetAmount || ''}
                                        onChange={(e) => handleUpdateManualMilestone(idx, 'targetAmount', parseFloat(e.target.value) || 0)}
                                    />
                                </div>
                                <button onClick={() => handleRemoveManualMilestone(idx)} className="w-8 text-slate-300 hover:text-rose-500">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                        <button onClick={handleAddManualMilestone} className="w-full py-3 flex items-center justify-center gap-2 text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors">
                            <Plus size={14} /> Add Payment Milestone
                        </button>
                    </div>
                    {Math.abs(manualTotalScheduled - cartTotal) > 10 && (
                        <div className="text-center text-xs text-rose-500 font-bold bg-rose-50 p-2 rounded-lg">
                            Balance Remaining: ₹{(cartTotal - manualTotalScheduled).toLocaleString()}
                        </div>
                    )}
                </div>
            )}
            
            {/* Common Protection Settings */}
            <div className={`p-5 rounded-[1.5rem] flex flex-col gap-4 shadow-xl border transition-colors mt-6 ${plan.goldRateProtection ? 'bg-emerald-900 border-emerald-800 text-white' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${plan.goldRateProtection ? 'bg-emerald-800' : 'bg-slate-200'}`}>
                        <Lock className={plan.goldRateProtection ? "text-amber-400" : "text-slate-400"} size={24} />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                            <span className="font-black text-sm uppercase tracking-widest">Rate Protection</span>
                            <div className="relative inline-block w-10 h-6 align-middle select-none transition duration-200 ease-in">
                                <input 
                                    type="checkbox" 
                                    name="toggle" 
                                    id="toggle" 
                                    className="toggle-checkbox absolute block w-4 h-4 rounded-full bg-white border-4 appearance-none cursor-pointer translate-x-1"
                                    style={{ right: plan.goldRateProtection ? '2px' : 'auto', left: plan.goldRateProtection ? 'auto' : '2px', top: '4px' }}
                                    checked={plan.goldRateProtection} 
                                    onChange={e => handleManualPlanChange('goldRateProtection', e.target.checked)}
                                />
                                <label htmlFor="toggle" className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${plan.goldRateProtection ? 'bg-emerald-500' : 'bg-slate-300'}`}></label>
                            </div>
                        </div>
                        <p className={`text-[10px] leading-relaxed italic ${plan.goldRateProtection ? 'text-emerald-200/70' : 'text-slate-400'}`}>
                            {plan.goldRateProtection 
                                ? `Rate guaranteed if installments cleared on time.` 
                                : "Rate is NOT protected. Final billing based on delivery day rate."}
                        </p>
                    </div>
                </div>

                {/* Explicit Protection Rate Input */}
                {plan.goldRateProtection && (
                    <div className="bg-emerald-800/50 p-4 rounded-xl border border-emerald-700/50 flex flex-col md:flex-row gap-4 items-center animate-fadeIn">
                        <div className="flex-1">
                            <label className="text-[10px] font-black text-amber-400 uppercase tracking-widest block mb-1">Protected Rate Cap (₹/g)</label>
                            <input 
                                type="number" 
                                className="w-full bg-transparent text-2xl font-black text-white outline-none border-b border-white/20 pb-1"
                                value={protectionRate}
                                onChange={e => setProtectionRate(parseFloat(e.target.value) || 0)}
                            />
                        </div>
                        <div className="text-xs text-emerald-200/80 max-w-[200px]">
                            This rate will be used for the final settlement regardless of future market increases.
                        </div>
                    </div>
                )}
            </div>
        </div>
      )}

      {/* Persistent Navigation */}
      <div className="action-zone">
         <div className="max-w-4xl mx-auto flex gap-3">
            {step > 1 && (
                <button onClick={() => setStep(step - 1)} className="flex-1 bg-slate-200 text-slate-700 py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all">Back</button>
            )}
            {step < 3 ? (
                <button 
                  disabled={step === 1 && cartItems.length === 0}
                  onClick={() => setStep(step + 1)} 
                  className="flex-[2] bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 shadow-xl disabled:opacity-50 tracking-widest"
                >
                    Continue <ChevronRight size={18} />
                </button>
            ) : (
                <button onClick={submitOrder} className="flex-[2] bg-emerald-600 text-white py-4 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 shadow-xl tracking-widest">
                    Generate Contract <Sparkles size={18} />
                </button>
            )}
         </div>
      </div>

    </div>
  );
};

const InputWrapper = ({ label, children }: any) => (
    <div className="space-y-1">
        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 focus-within:border-amber-500 focus-within:bg-white transition-all shadow-sm">
            {children}
        </div>
    </div>
);

export default OrderForm;
