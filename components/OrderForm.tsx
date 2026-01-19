import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, Trash2, ShieldCheck, Gem, Coins, Scissors, ArrowRight, X, Image as ImageIcon
} from 'lucide-react';
import { 
  Order, JewelryDetail, OrderStatus, GlobalSettings, 
  ProductionStatus, Purity, ProtectionStatus, Milestone, PaymentPlan, PaymentPlanTemplate, CatalogItem, StoneEntry, OldGoldExchange
} from '../types';
import { storageService } from '../services/storageService';
import { pricingService } from '../services/pricingService';

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
  const [orderRate, setOrderRate] = useState(settings.currentGoldRate24K);
  const [protectionRate, setProtectionRate] = useState(settings.currentGoldRate24K);
  
  const [exchanges, setExchanges] = useState<OldGoldExchange[]>([]);
  const [showExchangeModal, setShowExchangeModal] = useState(false);
  const [tempExchange, setTempExchange] = useState<Partial<OldGoldExchange>>({
    description: '', grossWeight: 0, purityPercent: 92, meltingLossPercent: 2, rate: 0
  });

  const [tempStone, setTempStone] = useState<Partial<StoneEntry>>({ type: 'Diamond', weight: 0, unit: 'ct', rate: 0, quality: 'G-H/VVS1' });

  const initialItem: Partial<JewelryDetail> = {
    category: 'Ring', purity: '22K', metalColor: 'Yellow Gold', grossWeight: 0, netWeight: 0, 
    stoneEntries: [], stoneCharges: 0, wastagePercentage: 12, makingChargesPerGram: 450, photoUrls: []
  };
  
  const [currentItem, setCurrentItem] = useState<Partial<JewelryDetail>>(initialItem);
  const [planMode, setPlanMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [manualMilestones, setManualMilestones] = useState<Partial<Milestone>[]>([]);
  const [plan, setPlan] = useState<Partial<PaymentPlan>>({ months: 6, advancePercentage: 10, interestPercentage: 0, goldRateProtection: true });

  const pricing = useMemo(() => pricingService.calculateItemPrice(currentItem, orderRate, settings), [currentItem, orderRate, settings]);
  const cartTotal = useMemo(() => cartItems.reduce((s, i) => s + i.finalAmount, 0), [cartItems]);
  const exchangeTotalValue = useMemo(() => exchanges.reduce((s, e) => s + (e.totalValue || 0), 0), [exchanges]);
  const netPayable = pricingService.round(Math.max(0, cartTotal - exchangeTotalValue));

  const handleAddStone = () => {
    if (!tempStone.weight || !tempStone.rate) return;
    const total = pricingService.round(tempStone.weight * tempStone.rate);
    const entry: StoneEntry = { ...tempStone as any, id: `ST-${Date.now()}`, total };
    setCurrentItem(prev => ({ ...prev, stoneEntries: [...(prev.stoneEntries || []), entry] }));
    setTempStone({ type: 'Diamond', weight: 0, unit: 'ct', rate: 0, quality: 'G-H/VVS1' });
  };

  const handleAddExchange = () => {
    if (!tempExchange.grossWeight || !tempExchange.rate) return;
    const netWeight = ((tempExchange.grossWeight || 0) * (1 - (tempExchange.meltingLossPercent || 0) / 100)) * ((tempExchange.purityPercent || 100) / 100);
    const totalValue = pricingService.round(netWeight * (tempExchange.rate || 0));
    setExchanges([...exchanges, { ...tempExchange as any, netWeight, totalValue }]);
    setShowExchangeModal(false);
  };

  const handleAddItem = () => {
    if (!currentItem.netWeight) return alert("Weight required");
    const item: JewelryDetail = {
      ...currentItem as any,
      id: `ITEM-${Date.now()}`,
      baseMetalValue: pricing.metalValue,
      wastageValue: pricing.wastageValue,
      totalLaborValue: pricing.laborValue,
      stoneCharges: pricing.stoneTotal,
      taxAmount: pricing.tax,
      finalAmount: pricing.total,
      productionStatus: ProductionStatus.DESIGNING,
    };
    setCartItems([...cartItems, item]);
    setCurrentItem(initialItem);
  };

  const generateMilestones = (total: number): Milestone[] => {
    const advance = pricingService.round(total * ((plan.advancePercentage || 10) / 100));
    const perMonth = pricingService.round((total - advance) / (plan.months || 1));
    const milestones: Milestone[] = [{ id: 'ADV', dueDate: new Date().toISOString().split('T')[0], targetAmount: advance, cumulativeTarget: advance, status: 'PENDING', warningCount: 0, description: 'Booking Advance' }];
    for (let i = 1; i <= (plan.months || 1); i++) {
      const d = new Date(); d.setMonth(d.getMonth() + i);
      const amount = (i === plan.months) ? (total - advance - (perMonth * (i - 1))) : perMonth;
      milestones.push({ id: `M${i}`, dueDate: d.toISOString().split('T')[0], targetAmount: pricingService.round(amount), cumulativeTarget: pricingService.round(advance + (perMonth * i)), status: 'PENDING', warningCount: 0, description: `Installment ${i}` });
    }
    return milestones;
  };

  const submitOrder = () => {
    if (cartItems.length === 0 || !customer.name) return;
    const milestones = planMode === 'MANUAL' ? manualMilestones.map((m, i) => ({ ...m, id: `M-${i}`, status: 'PENDING', warningCount: 0 } as any)) : generateMilestones(netPayable);
    const finalOrder: Order = {
      id: `ORD-${Date.now()}`, shareToken: Math.random().toString(36).substring(2, 10), customerName: customer.name, customerContact: customer.contact, customerEmail: customer.email, items: cartItems, oldGoldExchange: exchanges, payments: [], totalAmount: cartTotal, exchangeValue: exchangeTotalValue, netPayable: netPayable, goldRateAtBooking: orderRate, status: OrderStatus.ACTIVE, createdAt: new Date().toISOString(),
      paymentPlan: { ...plan, milestones, protectionStatus: ProtectionStatus.ACTIVE, protectionRateBooked: protectionRate, protectionDeadline: milestones[milestones.length - 1].dueDate, protectionLimit: settings.goldRateProtectionMax } as PaymentPlan
    };
    onSubmit(finalOrder);
  };

  return (
    <div className="flex flex-col max-w-5xl mx-auto space-y-4 pb-20">
      <div className="flex bg-white rounded-2xl border p-1 shadow-sm">
        {[1, 2, 3].map(s => <div key={s} className={`flex-1 py-3 text-center text-[10px] font-black uppercase transition-all ${step === s ? 'bg-slate-900 text-white rounded-xl' : 'text-slate-400'}`}>{s === 1 ? 'Specs' : s === 2 ? 'Customer' : 'Settlement'}</div>)}
      </div>

      {step === 1 && (
        <div className="space-y-4 animate-fadeIn">
          <div className="bg-slate-900 p-8 rounded-[2.5rem] flex justify-between items-center text-white shadow-xl relative overflow-hidden">
            <div>
               <p className="text-[10px] font-black uppercase text-amber-500 mb-1">Live 24K Rate Applied</p>
               <div className="flex items-center gap-2">
                 <span className="text-amber-500 font-black text-2xl">₹</span>
                 <input type="number" className="bg-transparent text-4xl font-black outline-none w-44 border-b border-white/10" value={orderRate} onChange={e => setOrderRate(parseFloat(e.target.value) || 0)} />
               </div>
            </div>
            <div className="text-right">
                <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Order Sub-Total</p>
                <p className="text-4xl font-black text-amber-400">₹{cartTotal.toLocaleString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-6">
                <div className="pos-card p-6">
                    <SectionHeader title="Item Details" icon={Gem} />
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                        <InputWrapper label="Category"><select className="w-full font-bold bg-transparent outline-none" value={currentItem.category} onChange={e => setCurrentItem({...currentItem, category: e.target.value})}>{['Ring', 'Necklace', 'Earrings', 'Bangle'].map(c => <option key={c}>{c}</option>)}</select></InputWrapper>
                        <InputWrapper label="Purity"><select className="w-full font-bold bg-transparent outline-none" value={currentItem.purity} onChange={e => setCurrentItem({...currentItem, purity: e.target.value as any})}><option>22K</option><option>24K</option><option>18K</option></select></InputWrapper>
                        <InputWrapper label="Color"><select className="w-full font-bold bg-transparent outline-none" value={currentItem.metalColor} onChange={e => setCurrentItem({...currentItem, metalColor: e.target.value as any})}><option>Yellow Gold</option><option>Rose Gold</option><option>White Gold</option></select></InputWrapper>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <InputWrapper label="Net Wt (g)"><input type="number" step="0.001" className="w-full font-black bg-transparent" value={currentItem.netWeight || ''} onChange={e => setCurrentItem({...currentItem, netWeight: parseFloat(e.target.value) || 0})} /></InputWrapper>
                        <InputWrapper label="VA %"><input type="number" className="w-full font-bold bg-transparent" value={currentItem.wastagePercentage || ''} onChange={e => setCurrentItem({...currentItem, wastagePercentage: parseFloat(e.target.value) || 0})} /></InputWrapper>
                        <InputWrapper label="Labor / g"><input type="number" className="w-full font-bold bg-transparent" value={currentItem.makingChargesPerGram || ''} onChange={e => setCurrentItem({...currentItem, makingChargesPerGram: parseFloat(e.target.value) || 0})} /></InputWrapper>
                    </div>
                    <div className="space-y-4 mb-6">
                        <label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2"><Scissors size={14}/> Stone Breakdown</label>
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
                                <input className="w-full p-2 rounded-lg border text-xs font-bold" placeholder="Type" value={tempStone.type} onChange={e => setTempStone({...tempStone, type: e.target.value})} />
                                <input type="number" className="w-full p-2 rounded-lg border text-xs font-bold" placeholder="Qty" value={tempStone.weight || ''} onChange={e => setTempStone({...tempStone, weight: parseFloat(e.target.value)})} />
                                <input type="number" className="w-full p-2 rounded-lg border text-xs font-bold" placeholder="Rate" value={tempStone.rate || ''} onChange={e => setTempStone({...tempStone, rate: parseFloat(e.target.value)})} />
                                <button onClick={handleAddStone} className="bg-slate-900 text-white p-2 rounded-lg"><Plus size={16}/></button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="lg:col-span-4 space-y-6">
                <div className="bg-amber-50 p-6 rounded-[2rem] border border-amber-200 shadow-sm">
                    <h4 className="text-xs font-black uppercase text-amber-700 mb-4">Price Estimation</h4>
                    <div className="space-y-3 text-xs">
                        <div className="flex justify-between"><span>Metal</span><span className="font-bold">₹{pricing.metalValue.toLocaleString()}</span></div>
                        <div className="flex justify-between"><span>Labor</span><span className="font-bold">₹{pricing.laborValue.toLocaleString()}</span></div>
                        <div className="flex justify-between"><span>Stones</span><span className="font-bold">₹{pricing.stoneTotal.toLocaleString()}</span></div>
                        <div className="border-t pt-2 flex justify-between font-black text-amber-900"><span>Sub-Total</span><span>₹{(pricing.total - pricing.tax).toLocaleString()}</span></div>
                        <div className="flex justify-between"><span>GST</span><span>₹{pricing.tax.toLocaleString()}</span></div>
                        <div className="border-t-2 border-amber-300 pt-3 flex justify-between text-xl font-black text-slate-900"><span>Total</span><span>₹{pricing.total.toLocaleString()}</span></div>
                    </div>
                    <button onClick={handleAddItem} className="w-full bg-slate-900 text-white py-4 rounded-xl mt-6 font-black uppercase text-[10px] tracking-widest shadow-xl">Add to Cart</button>
                </div>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6 animate-fadeIn py-8 max-w-2xl mx-auto">
            <h3 className="text-2xl font-black text-slate-800">Client Details</h3>
            <div className="pos-card p-10 space-y-8">
                <InputWrapper label="Full Name"><input className="w-full font-bold text-2xl bg-transparent outline-none" value={customer.name} onChange={e => setCustomer({...customer, name: e.target.value})} /></InputWrapper>
                <InputWrapper label="WhatsApp"><input type="tel" className="w-full font-black text-2xl bg-transparent outline-none text-emerald-700" value={customer.contact} onChange={e => setCustomer({...customer, contact: e.target.value})} /></InputWrapper>
            </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6 animate-fadeIn py-4">
            <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white flex justify-between items-center shadow-2xl relative overflow-hidden">
                <div>
                    <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Final Settlement Amount</p>
                    <p className="text-5xl font-black text-white">₹{netPayable.toLocaleString()}</p>
                    <p className="text-[10px] font-bold text-emerald-400 mt-2">Deducted ₹{exchangeTotalValue.toLocaleString()} for exchange</p>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {planTemplates.map(t => (
                    <div key={t.id} onClick={() => setPlan({...plan, type: 'PRE_CREATED', templateId: t.id, months: t.months, advancePercentage: t.advancePercentage, interestPercentage: t.interestPercentage})} className={`p-6 rounded-[2rem] border-2 cursor-pointer transition-all ${plan.templateId === t.id ? 'bg-slate-900 text-white border-slate-900 scale-105 shadow-xl' : 'bg-white border-slate-100'}`}>
                        <h4 className="font-black text-sm uppercase mb-2">{t.name}</h4>
                        <p className="text-2xl font-black mb-4">{t.months} Months</p>
                        <p className="text-[10px] font-bold opacity-60">Interest: {t.interestPercentage}%</p>
                    </div>
                ))}
            </div>
        </div>
      )}

      <div className="fixed bottom-[84px] left-0 right-0 p-4 lg:static lg:bg-none z-30">
          <div className="max-w-5xl mx-auto flex gap-3">
              {step > 1 && <button onClick={() => setStep(step - 1)} className="flex-1 bg-slate-200 text-slate-700 py-5 rounded-2xl font-black uppercase text-xs">Back</button>}
              <button onClick={step === 3 ? submitOrder : () => setStep(step + 1)} className="flex-[2] bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl">{step === 3 ? 'Issue Contract' : 'Next Step'}</button>
          </div>
      </div>
    </div>
  );
};

const SectionHeader = ({ title, icon: Icon }: any) => (
    <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-xl bg-slate-100 text-slate-500"><Icon size={20}/></div>
        <div><h3 className="font-black text-sm uppercase tracking-widest text-slate-800">{title}</h3></div>
    </div>
);

const InputWrapper = ({ label, children }: any) => (
    <div className="space-y-1">
        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 focus-within:border-amber-500 focus-within:bg-white transition-all">{children}</div>
    </div>
);

export default OrderForm;