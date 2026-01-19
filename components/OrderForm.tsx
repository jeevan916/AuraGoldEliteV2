
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
import { financialService } from '../services/financialService';

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
  
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [showCatalog, setShowCatalog] = useState(false);
  const [planMode, setPlanMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [manualMilestones, setManualMilestones] = useState<Partial<Milestone>[]>([]);
  
  const initialItem: Partial<JewelryDetail> = {
    category: 'Ring', purity: '22K', metalColor: 'Yellow Gold',
    grossWeight: 0, netWeight: 0, stoneCharges: 0, stoneDetails: '',
    wastagePercentage: 12, makingChargesPerGram: 450, photoUrls: [], huid: '', size: ''
  };
  
  const [currentItem, setCurrentItem] = useState<Partial<JewelryDetail>>(initialItem);
  const [isCompressing, setIsCompressing] = useState(false);

  const [plan, setPlan] = useState<Partial<PaymentPlan>>({
    months: 6, advancePercentage: 10, interestPercentage: 0, goldRateProtection: true, type: 'MANUAL'
  });

  useEffect(() => { setCatalog(storageService.getCatalog()); }, []);
  useEffect(() => { if (step === 1) setProtectionRate(orderRate); }, [orderRate, step]);

  // Use financialService for consistent logic
  const pricing = useMemo(() => {
    return financialService.calculateItemQuote(currentItem, settings, orderRate);
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

  const handleAddItem = () => {
    if (!currentItem.netWeight || currentItem.netWeight <= 0) {
        alert("Net weight is required.");
        return;
    }
    
    const quote = financialService.calculateItemQuote(currentItem, settings, orderRate);
    const item: JewelryDetail = {
      ...currentItem as any,
      ...quote,
      id: `ITEM-${Date.now()}`,
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
        setCurrentItem(prev => ({ ...prev, photoUrls: [...(prev.photoUrls || []), compressed] }));
      } catch (error) { alert("Image processing failed"); } finally { setIsCompressing(false); }
    }
  };

  const generateMilestones = (total: number): Milestone[] => {
    const advance = Math.round(total * ((plan.advancePercentage || 10) / 100));
    const remaining = total - advance;
    const interest = Math.round(remaining * ((plan.interestPercentage || 0) / 100) * ((plan.months || 1) / 12));
    const finalRemaining = remaining + interest;
    const perMonth = Math.round(finalRemaining / (plan.months || 1));
    const milestones: Milestone[] = [];
    
    milestones.push({ 
      id: 'ADV', dueDate: new Date().toISOString().split('T')[0], targetAmount: advance, cumulativeTarget: advance, 
      status: 'PENDING', warningCount: 0, description: 'Advance / Down Payment'
    });

    let runningSum = advance;
    for (let i = 1; i <= (plan.months || 1); i++) {
      const d = new Date(); 
      d.setMonth(d.getMonth() + i);
      const amt = (i === plan.months) ? (total + interest - runningSum) : perMonth;
      runningSum += amt;
      milestones.push({ 
        id: `M${i}`, dueDate: d.toISOString().split('T')[0], targetAmount: amt, cumulativeTarget: runningSum, 
        status: 'PENDING', warningCount: 0, description: `Installment ${i}`
      });
    }
    return milestones;
  };

  const submitOrder = () => {
    if (cartItems.length === 0) return alert("Add items first.");
    if (!customer.name || !customer.contact) return alert("Customer name and contact required.");

    let milestones: Milestone[] = planMode === 'MANUAL' ? manualMilestones.map((m, idx) => ({ ...m, status: 'PENDING', warningCount: 0 } as Milestone)) : generateMilestones(cartTotal);

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
        ...plan, milestones, protectionStatus: ProtectionStatus.ACTIVE, protectionRateBooked: protectionRate,
        protectionDeadline: milestones[milestones.length - 1].dueDate, protectionLimit: settings.goldRateProtectionMax 
      } as PaymentPlan
    };
    onSubmit(finalOrder);
  };

  return (
    <div className="flex flex-col min-h-full max-w-4xl mx-auto space-y-4 pb-20">
      <div className="flex bg-white rounded-2xl border overflow-hidden p-1 shadow-sm">
        {[1, 2, 3].map(s => (
          <div key={s} className={`flex-1 py-3 text-center text-[10px] font-black uppercase transition-all ${step === s ? 'bg-slate-900 text-white rounded-xl' : 'text-slate-400'}`}>
            {s === 1 ? 'Jewellery' : s === 2 ? 'Client' : 'Plan'}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4 animate-fadeIn">
          <div className="bg-slate-900 p-6 rounded-[2rem] flex justify-between items-center text-white shadow-xl">
            <div>
               <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Market Rate (22K)</p>
               <input type="number" className="bg-transparent text-3xl font-black outline-none w-36" value={orderRate} onChange={e => setOrderRate(parseFloat(e.target.value) || 0)} />
            </div>
            <div className="text-right">
                <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Total</p>
                <p className="text-3xl font-black text-amber-400">₹{cartTotal.toLocaleString()}</p>
            </div>
          </div>

          <div className="pos-card p-5 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <InputWrapper label="Category">
                    <select className="w-full font-bold bg-transparent outline-none" value={currentItem.category} onChange={e => setCurrentItem({...currentItem, category: e.target.value})}>
                        {['Ring', 'Necklace', 'Earrings', 'Bangle', 'Bracelet', 'Chain'].map(c => <option key={c}>{c}</option>)}
                    </select>
                </InputWrapper>
                <InputWrapper label="Net Wt (g)">
                    <input type="number" step="0.001" className="w-full font-black text-lg bg-transparent" value={currentItem.netWeight || ''} onChange={e => setCurrentItem({...currentItem, netWeight: parseFloat(e.target.value) || 0})} />
                </InputWrapper>
                <InputWrapper label="Labor / g">
                    <input type="number" className="w-full font-black text-lg bg-transparent" value={currentItem.makingChargesPerGram || ''} onChange={e => setCurrentItem({...currentItem, makingChargesPerGram: parseFloat(e.target.value) || 0})} />
                </InputWrapper>
            </div>
            <div className="bg-amber-50 p-5 rounded-2xl border border-amber-200 flex justify-between items-center">
                <p className="text-2xl font-black">₹{Math.round(pricing.finalAmount || 0).toLocaleString()}</p>
                <button onClick={handleAddItem} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-black text-xs uppercase"><Plus size={18} /> Add</button>
            </div>
          </div>

          {cartItems.length > 0 && (
              <div className="divide-y bg-white rounded-2xl border">
                  {cartItems.map(item => (
                      <div key={item.id} className="p-4 flex justify-between items-center">
                          <div><p className="font-bold">{item.category} ({item.netWeight}g)</p></div>
                          <div className="flex items-center gap-4">
                            <p className="font-black">₹{item.finalAmount.toLocaleString()}</p>
                            <button onClick={() => setCartItems(cartItems.filter(i => i.id !== item.id))} className="text-rose-500"><Trash2 size={18} /></button>
                          </div>
                      </div>
                  ))}
              </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="pos-card p-8 space-y-6 animate-fadeIn">
            <InputWrapper label="Customer Name"><input className="w-full font-bold text-xl bg-transparent" value={customer.name} onChange={e => setCustomer({...customer, name: e.target.value})} /></InputWrapper>
            <InputWrapper label="WhatsApp Number"><input type="tel" className="w-full font-bold text-xl bg-transparent" value={customer.contact} onChange={e => setCustomer({...customer, contact: e.target.value})} /></InputWrapper>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6 animate-fadeIn">
            <div className="pos-card p-6 grid grid-cols-2 md:grid-cols-3 gap-6">
                <InputWrapper label="Months"><input type="number" className="w-full font-black text-xl bg-transparent" value={plan.months} onChange={e => setPlan({...plan, months: parseInt(e.target.value)||1})} /></InputWrapper>
                <InputWrapper label="Advance %"><input type="number" className="w-full font-black text-xl bg-transparent" value={plan.advancePercentage} onChange={e => setPlan({...plan, advancePercentage: parseFloat(e.target.value)||0})} /></InputWrapper>
                <InputWrapper label="Rate Protection"><input type="checkbox" checked={plan.goldRateProtection} onChange={e => setPlan({...plan, goldRateProtection: e.target.checked})} /></InputWrapper>
            </div>
        </div>
      )}

      <div className="flex gap-3">
        {step > 1 && <button onClick={() => setStep(step - 1)} className="flex-1 bg-slate-200 py-4 rounded-2xl font-black uppercase text-xs">Back</button>}
        {step < 3 ? <button disabled={step === 1 && cartItems.length === 0} onClick={() => setStep(step + 1)} className="flex-[2] bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-xs">Continue</button> : <button onClick={submitOrder} className="flex-[2] bg-emerald-600 text-white py-4 rounded-2xl font-black uppercase text-xs">Generate Contract</button>}
      </div>
    </div>
  );
};

const InputWrapper = ({ label, children }: any) => (
    <div className="space-y-1">
        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 shadow-sm">{children}</div>
    </div>
);

export default OrderForm;
