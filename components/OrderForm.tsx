import React, { useState, useMemo } from 'react';
import { 
  Plus, ShoppingBag, Trash2, ShieldCheck, 
  Calculator, User, ChevronRight, X, Loader2, Sparkles, Zap, Image as ImageIcon, Camera, Trash, 
  IndianRupee, ArrowRight, Lock, Calendar
} from 'lucide-react';
import { 
  Order, JewelryDetail, OrderStatus, GlobalSettings, 
  ProductionStatus, Purity, ProtectionStatus, Milestone, PaymentPlan, PaymentPlanTemplate
} from '../types';
import { compressImage } from '../services/imageOptimizer';

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
  
  const initialItem: Partial<JewelryDetail> = {
    category: 'Ring', purity: '22K', metalColor: 'Yellow Gold',
    grossWeight: 0, netWeight: 0, wastagePercentage: 12, makingChargesPerGram: 450, 
    stoneCharges: 0, photoUrls: []
  };
  const [currentItem, setCurrentItem] = useState<Partial<JewelryDetail>>(initialItem);
  const [isCompressing, setIsCompressing] = useState(false);

  const [plan, setPlan] = useState<Partial<PaymentPlan>>({
    months: 6, advancePercentage: 10, goldRateProtection: true
  });

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

  const handleAddItem = () => {
    if (!currentItem.netWeight || currentItem.netWeight <= 0) return alert("Enter weight");
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

  const generateMilestones = (total: number): Milestone[] => {
    const advance = total * ((plan.advancePercentage || 10) / 100);
    const remaining = total - advance;
    const perMonth = remaining / (plan.months || 1);
    const milestones: Milestone[] = [];
    milestones.push({ id: 'ADV', dueDate: new Date().toISOString().split('T')[0], targetAmount: Math.round(advance), cumulativeTarget: Math.round(advance), status: 'PENDING', warningCount: 0 });
    for (let i = 1; i <= (plan.months || 1); i++) {
      const d = new Date(); d.setMonth(d.getMonth() + i);
      milestones.push({ id: `M${i}`, dueDate: d.toISOString().split('T')[0], targetAmount: Math.round(perMonth), cumulativeTarget: Math.round(advance + (perMonth * i)), status: 'PENDING', warningCount: 0 });
    }
    return milestones;
  };

  const applyTemplate = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const tplId = e.target.value;
      if (!tplId) return;
      const tpl = planTemplates.find(t => t.id === tplId);
      if (tpl) {
          setPlan({
              ...plan,
              months: tpl.months,
              advancePercentage: tpl.advancePercentage,
              interestPercentage: tpl.interestPercentage,
              templateId: tpl.id
          });
      }
  };

  const submitOrder = () => {
    const milestones = generateMilestones(cartTotal);
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
      paymentPlan: { ...plan, milestones, protectionStatus: ProtectionStatus.ACTIVE, protectionRateBooked: orderRate, protectionDeadline: milestones[milestones.length - 1].dueDate, protectionLimit: settings.goldRateProtectionMax } as PaymentPlan
    };
    onSubmit(finalOrder);
  };

  return (
    <div className="flex flex-col min-h-full max-w-4xl mx-auto space-y-4 pb-20">
      
      {/* Header Indicators */}
      <div className="flex bg-white rounded-2xl border overflow-hidden p-1 shadow-sm">
        {[1, 2, 3].map(s => (
          <div key={s} className={`flex-1 py-3 text-center text-[10px] font-black uppercase tracking-widest transition-all ${step === s ? 'bg-slate-900 text-white rounded-xl' : 'text-slate-400'}`}>
            {s === 1 ? 'Details' : s === 2 ? 'Customer' : 'Collection Plan'}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4 animate-fadeIn">
          {/* Rate Entry */}
          <div className="bg-slate-900 p-6 rounded-[2rem] flex justify-between items-center text-white shadow-xl">
            <div>
               <p className="text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">Rate Lock for Customer</p>
               <div className="flex items-center gap-2">
                 <span className="text-amber-500 font-black">₹</span>
                 <input type="number" className="bg-transparent text-3xl font-black outline-none w-36 border-b border-white/10" value={orderRate} onChange={e => setOrderRate(parseFloat(e.target.value) || 0)} />
               </div>
            </div>
            <div className="text-right">
                <p className="text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">Est. Total</p>
                <p className="text-3xl font-black text-amber-400">₹{cartTotal.toLocaleString()}</p>
            </div>
          </div>

          <div className="pos-card p-5 space-y-5">
            <div className="grid grid-cols-2 gap-4">
                <InputWrapper label="Category">
                    <select className="w-full font-bold bg-transparent outline-none" value={currentItem.category} onChange={e => setCurrentItem({...currentItem, category: e.target.value})}>
                        {['Ring', 'Necklace', 'Earrings', 'Bangle', 'Bracelet', 'Chain'].map(c => <option key={c}>{c}</option>)}
                    </select>
                </InputWrapper>
                <InputWrapper label="Purity">
                    <select className="w-full font-bold bg-transparent outline-none" value={currentItem.purity} onChange={e => setCurrentItem({...currentItem, purity: e.target.value as Purity})}>
                        <option value="22K">22K Standard</option>
                        <option value="24K">24K Pure</option>
                        <option value="18K">18K Rose/White</option>
                    </select>
                </InputWrapper>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <InputWrapper label="Net Wt (g)"><input type="number" step="0.001" className="w-full font-black text-lg bg-transparent" value={currentItem.netWeight || ''} onChange={e => setCurrentItem({...currentItem, netWeight: parseFloat(e.target.value) || 0})} placeholder="0.000" /></InputWrapper>
                <InputWrapper label="VA %"><input type="number" className="w-full font-black text-lg bg-transparent" value={currentItem.wastagePercentage || ''} onChange={e => setCurrentItem({...currentItem, wastagePercentage: parseFloat(e.target.value) || 0})} placeholder="12" /></InputWrapper>
                <InputWrapper label="Making/g"><input type="number" className="w-full font-black text-lg bg-transparent" value={currentItem.makingChargesPerGram || ''} onChange={e => setCurrentItem({...currentItem, makingChargesPerGram: parseFloat(e.target.value) || 0})} placeholder="450" /></InputWrapper>
                <InputWrapper label="Stone Cost"><input type="number" className="w-full font-black text-lg bg-transparent" value={currentItem.stoneCharges || ''} onChange={e => setCurrentItem({...currentItem, stoneCharges: parseFloat(e.target.value) || 0})} placeholder="0" /></InputWrapper>
            </div>

            <div className="bg-amber-50 p-5 rounded-2xl border border-amber-200 flex justify-between items-center shadow-inner">
                <div>
                    <p className="text-[9px] font-black uppercase text-amber-600 mb-1">Item Appraisal</p>
                    <p className="text-2xl font-black text-slate-900">₹{Math.round(pricing.total).toLocaleString()}</p>
                </div>
                <button onClick={handleAddItem} className="bg-slate-900 text-white px-8 py-3.5 rounded-xl font-black text-xs uppercase flex items-center gap-2 active:scale-95 shadow-lg">
                    <Plus size={18} /> Append Item
                </button>
            </div>
          </div>

          {cartItems.length > 0 && (
              <div className="pos-card overflow-hidden">
                  <div className="bg-slate-50 p-4 border-b flex justify-between items-center">
                    <p className="text-[10px] font-black uppercase text-slate-500">Order Contents ({cartItems.length})</p>
                    <p className="text-xs font-black text-slate-800">Total: ₹{cartTotal.toLocaleString()}</p>
                  </div>
                  <div className="divide-y">
                      {cartItems.map(item => (
                          <div key={item.id} className="p-4 flex justify-between items-center bg-white group hover:bg-slate-50 transition-colors">
                              <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                                    <ImageIcon size={20} />
                                  </div>
                                  <div>
                                      <p className="font-black text-sm text-slate-800">{item.category}</p>
                                      <p className="text-[10px] text-slate-400 uppercase font-bold">{item.netWeight}g • VA {item.wastagePercentage}%</p>
                                  </div>
                              </div>
                              <div className="flex items-center gap-4">
                                  <p className="font-black text-sm">₹{item.finalAmount.toLocaleString()}</p>
                                  <button onClick={() => setCartItems(cartItems.filter(i => i.id !== item.id))} className="text-rose-500 p-2 hover:bg-rose-50 rounded-lg"><X size={18} /></button>
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
            <h3 className="text-lg font-black text-slate-800 ml-1">Customer Verification</h3>
            <div className="pos-card p-8 space-y-6">
                <InputWrapper label="Full Name">
                    <input className="w-full font-bold text-xl bg-transparent p-1 outline-none" value={customer.name} onChange={e => setCustomer({...customer, name: e.target.value})} placeholder="Ex: Rahul Sharma" />
                </InputWrapper>
                <InputWrapper label="WhatsApp Number (With Country Code)">
                    <input type="tel" className="w-full font-bold text-xl bg-transparent p-1 outline-none" value={customer.contact} onChange={e => setCustomer({...customer, contact: e.target.value})} placeholder="919876543210" />
                </InputWrapper>
                <p className="text-[10px] text-slate-400 italic">Messages will be sent to this number for collection reminders.</p>
            </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4 animate-fadeIn py-6">
            <div className="flex justify-between items-end">
                <h3 className="text-lg font-black text-slate-800 ml-1">Milestone Strategy</h3>
                <p className="text-xs font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">Target: ₹{cartTotal.toLocaleString()}</p>
            </div>

            <div className="pos-card p-6 space-y-6">
                
                {planTemplates.length > 0 && (
                    <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl">
                        <label className="text-[10px] font-black uppercase text-indigo-400 tracking-widest mb-2 block flex items-center gap-2">
                             <Sparkles size={12} /> Auto-Apply Strategy
                        </label>
                        <select 
                            className="w-full p-2 rounded-lg text-sm font-bold text-indigo-900 border-none bg-white outline-none focus:ring-2 focus:ring-indigo-400"
                            onChange={applyTemplate}
                            defaultValue=""
                        >
                            <option value="" disabled>-- Select a Plan Template --</option>
                            {planTemplates.filter(t => t.enabled).map(t => (
                                <option key={t.id} value={t.id}>{t.name} ({t.months} Months)</option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-6">
                    <InputWrapper label="Installments (Months)">
                        <input type="number" className="w-full font-black text-xl bg-transparent" value={plan.months} onChange={e => setPlan({...plan, months: parseInt(e.target.value) || 1})} />
                    </InputWrapper>
                    <InputWrapper label="Booking Advance %">
                        <input type="number" className="w-full font-black text-xl bg-transparent" value={plan.advancePercentage} onChange={e => setPlan({...plan, advancePercentage: parseInt(e.target.value) || 0})} />
                    </InputWrapper>
                </div>
                
                <div className="bg-emerald-900 text-white p-5 rounded-[1.5rem] flex items-start gap-4 shadow-xl">
                    <div className="p-2 bg-emerald-800 rounded-lg"><Lock className="text-amber-400" size={24} /></div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-black text-sm uppercase tracking-widest">Rate Protection Active</span>
                            <input type="checkbox" className="w-5 h-5 accent-amber-500" checked={plan.goldRateProtection} onChange={e => setPlan({...plan, goldRateProtection: e.target.checked})} />
                        </div>
                        <p className="text-[10px] text-emerald-200/70 leading-relaxed italic">
                            Current Rate: ₹{orderRate}/g. This rate is valid only if installments are paid within 48 hours of due date. 
                            Failure triggers automatic "Rate Lapse" penalty to market price.
                        </p>
                    </div>
                </div>
            </div>

            {/* Schedule Table */}
            <div className="pos-card overflow-hidden">
                <div className="bg-slate-900 p-4"><p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Projected Collection Ledger</p></div>
                <div className="divide-y divide-slate-100">
                    {generateMilestones(cartTotal).map((m, i) => (
                        <div key={i} className="flex justify-between items-center p-4 bg-white">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1">{i === 0 ? 'Downpayment (Today)' : `Installment #${i}`}</p>
                                <p className="font-bold text-slate-800 text-sm">{new Date(m.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                            </div>
                            <div className="text-right">
                                <p className="font-black text-slate-900 text-lg">₹{m.targetAmount.toLocaleString()}</p>
                                <p className="text-[10px] font-bold text-emerald-600 uppercase">Status: Scheduled</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}

      {/* --- ACTION BAR --- */}
      <div className="action-zone">
         <div className="max-w-4xl mx-auto flex gap-3">
            {step > 1 && (
                <button onClick={() => setStep(step - 1)} className="flex-1 bg-slate-200 text-slate-700 py-4 rounded-2xl font-black uppercase text-xs transition-all active:scale-95">Back</button>
            )}
            
            {step === 1 && (
                <button disabled={cartItems.length === 0} onClick={() => setStep(2)} className="flex-[2] bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 shadow-xl disabled:opacity-50 active:scale-95 transition-all">
                    Confirm Customer <ChevronRight size={18} />
                </button>
            )}

            {step === 2 && (
                <button disabled={!customer.name || !customer.contact} onClick={() => setStep(3)} className="flex-[2] bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 shadow-xl disabled:opacity-50 active:scale-95 transition-all">
                    Set Milestones <ChevronRight size={18} />
                </button>
            )}

            {step === 3 && (
                <button onClick={submitOrder} className="flex-[2] bg-emerald-600 text-white py-4 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all">
                    Create Gold Contract <Sparkles size={18} />
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
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 focus-within:border-amber-500 focus-within:bg-white transition-all shadow-inner">
            {children}
        </div>
    </div>
);

export default OrderForm;