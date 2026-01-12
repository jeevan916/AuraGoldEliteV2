
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, PlusCircle, ShoppingBag, Trash2, ShieldCheck, 
  Calculator, User, ChevronRight, X, Loader2, Sparkles, Zap
} from 'lucide-react';
import { 
  Order, JewelryDetail, OrderStatus, GlobalSettings, 
  ProductionStatus, Purity, ProtectionStatus, Milestone, PaymentPlan, PaymentPlanTemplate, Customer
} from '../types';
import { compressImage } from '../services/imageOptimizer';

interface OrderFormProps {
  settings: GlobalSettings;
  onSubmit: (order: Order) => void;
  onCancel: () => void;
  planTemplates?: PaymentPlanTemplate[];
  existingCustomers?: Customer[];
}

const OrderForm: React.FC<OrderFormProps> = ({ settings, onSubmit, onCancel }) => {
  const [step, setStep] = useState(1);
  const [customer, setCustomer] = useState({ name: '', contact: '', email: '' });
  
  // Cart & Pricing
  const [cartItems, setCartItems] = useState<JewelryDetail[]>([]);
  const [orderRate, setOrderRate] = useState(settings.currentGoldRate22K);
  
  // Current Item Input
  const initialItem: Partial<JewelryDetail> = {
    category: 'Ring', purity: '22K', metalColor: 'Yellow Gold',
    grossWeight: 0, netWeight: 0, wastagePercentage: 12, makingChargesPerGram: 450, 
    stoneCharges: 0, photoUrls: []
  };
  const [currentItem, setCurrentItem] = useState<Partial<JewelryDetail>>(initialItem);
  const [isCompressing, setIsCompressing] = useState(false);

  // Installment Plan
  const [plan, setPlan] = useState<Partial<PaymentPlan>>({
    months: 6, advancePercentage: 10, goldRateProtection: true
  });

  const currentItemPricing = useMemo(() => {
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
      baseMetalValue: currentItemPricing.metalValue,
      wastageValue: currentItemPricing.wastageValue,
      totalLaborValue: currentItemPricing.laborValue,
      taxAmount: currentItemPricing.tax,
      finalAmount: currentItemPricing.total,
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
    
    milestones.push({
      id: 'ADV', dueDate: new Date().toISOString().split('T')[0],
      targetAmount: Math.round(advance), cumulativeTarget: Math.round(advance),
      status: 'PENDING', warningCount: 0
    });

    for (let i = 1; i <= (plan.months || 1); i++) {
      const d = new Date(); d.setMonth(d.getMonth() + i);
      milestones.push({
        id: `M${i}`, dueDate: d.toISOString().split('T')[0],
        targetAmount: Math.round(perMonth), cumulativeTarget: Math.round(advance + (perMonth * i)),
        status: 'PENDING', warningCount: 0
      });
    }
    return milestones;
  };

  const handleFinalSubmit = () => {
    if (cartItems.length === 0) return alert("Add items first");
    if (!customer.name || !customer.contact) return alert("Customer details missing");

    const milestones = generateMilestones(cartTotal);
    const finalOrder: Order = {
      id: `ORD-${Date.now()}`,
      shareToken: Math.random().toString(36).substring(2, 10),
      customerName: customer.name,
      customerContact: customer.contact,
      customerEmail: customer.email,
      items: cartItems,
      payments: [],
      totalAmount: cartTotal,
      goldRateAtBooking: orderRate,
      status: OrderStatus.ACTIVE,
      createdAt: new Date().toISOString(),
      paymentPlan: {
        ...plan,
        type: 'PRE_CREATED',
        milestones,
        protectionStatus: ProtectionStatus.ACTIVE,
        protectionRateBooked: orderRate,
        protectionDeadline: milestones[milestones.length - 1].dueDate,
        protectionLimit: settings.goldRateProtectionMax
      } as PaymentPlan
    };

    onSubmit(finalOrder);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setIsCompressing(true);
      const urls: string[] = [];
      for (const file of Array.from(e.target.files)) {
        const compressed = await compressImage(file);
        urls.push(compressed);
      }
      setCurrentItem(prev => ({ ...prev, photoUrls: [...(prev.photoUrls || []), ...urls] }));
      setIsCompressing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Steps Header */}
      <div className="flex border-b bg-white rounded-t-3xl overflow-hidden">
        {[1, 2, 3].map(s => (
          <div key={s} className={`flex-1 p-6 text-center text-sm font-bold transition-all ${step === s ? 'bg-amber-600 text-white' : 'text-slate-400 bg-slate-50'}`}>
            Step {s}: {s === 1 ? 'Jewellery Details' : s === 2 ? 'Customer Info' : 'Plan Summary'}
          </div>
        ))}
      </div>

      <div className="bg-white p-8 rounded-b-3xl shadow-xl border border-slate-100 min-h-[600px]">
        {step === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-fadeIn">
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-slate-900 rounded-2xl p-6 text-white">
                <div className="flex items-center gap-3 mb-4">
                  <Zap size={20} className="text-amber-400" />
                  <h3 className="font-black uppercase tracking-widest text-sm">Booking Gold Rate</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <input 
                    type="number" 
                    className="bg-slate-800 border-none rounded-xl p-4 text-amber-400 font-black text-xl"
                    value={orderRate}
                    onChange={e => setOrderRate(parseFloat(e.target.value) || 0)}
                  />
                  <div className="flex items-center text-xs text-slate-400 italic">
                    Rate at which entire order is locked for customer.
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400">Category</label>
                  <select className="w-full border rounded-xl p-3 font-bold" value={currentItem.category} onChange={e => setCurrentItem({...currentItem, category: e.target.value})}>
                    {['Ring', 'Necklace', 'Bangle', 'Earrings', 'Chain', 'Bracelet'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400">Purity</label>
                  <select className="w-full border rounded-xl p-3 font-bold" value={currentItem.purity} onChange={e => setCurrentItem({...currentItem, purity: e.target.value as Purity})}>
                    <option value="22K">22 Karat (Standard)</option>
                    <option value="24K">24 Karat (Pure)</option>
                    <option value="18K">18 Karat (Rose/White)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <InputGroup label="Gross Weight (g)" val={currentItem.grossWeight} onChange={v => setCurrentItem({...currentItem, grossWeight: v})} />
                <InputGroup label="Net Weight (g)" val={currentItem.netWeight} onChange={v => setCurrentItem({...currentItem, netWeight: v})} />
                <InputGroup label="VA (Wastage) %" val={currentItem.wastagePercentage} onChange={v => setCurrentItem({...currentItem, wastagePercentage: v})} />
                <InputGroup label="Making/g" val={currentItem.makingChargesPerGram} onChange={v => setCurrentItem({...currentItem, makingChargesPerGram: v})} />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">Add Photos</label>
                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors relative">
                  <input type="file" multiple className="absolute inset-0 opacity-0 cursor-pointer" onChange={handlePhotoUpload} />
                  {isCompressing ? <Loader2 className="animate-spin text-amber-600" /> : <PlusCircle className="text-slate-300" size={32} />}
                  <span className="text-xs font-bold text-slate-400 mt-2">Upload Jewelry Images</span>
                </div>
                <div className="flex gap-2 mt-2">
                  {currentItem.photoUrls?.map((url, i) => (
                    <img key={i} src={url} className="w-12 h-12 rounded-lg object-cover border" />
                  ))}
                </div>
              </div>

              <button onClick={handleAddItem} className="w-full bg-slate-900 text-white py-4 rounded-xl font-black uppercase tracking-widest text-sm hover:bg-slate-800 transition-all shadow-xl">
                Add Item to Cart
              </button>
            </div>

            <div className="lg:col-span-5 space-y-6">
              <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100">
                <h4 className="font-black text-amber-800 uppercase text-xs mb-4 flex items-center gap-2"><Calculator size={14}/> Live Valuation</h4>
                <div className="space-y-3">
                  <PriceRow label="Metal Value" val={currentItemPricing.metalValue} />
                  <PriceRow label="Wastage (VA)" val={currentItemPricing.wastageValue} />
                  <PriceRow label="Making Charges" val={currentItemPricing.laborValue} />
                  <div className="border-t border-amber-200 pt-3 flex justify-between items-center">
                    <span className="font-black text-amber-900">Subtotal</span>
                    <span className="text-2xl font-black text-amber-900">₹{Math.round(currentItemPricing.total).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white border rounded-3xl p-6 shadow-sm flex flex-col h-full min-h-[300px]">
                <h4 className="font-black text-slate-800 uppercase text-xs mb-4 flex items-center gap-2"><ShoppingBag size={14}/> Cart ({cartItems.length})</h4>
                <div className="flex-1 space-y-3 overflow-y-auto max-h-[300px]">
                  {cartItems.map(item => (
                    <div key={item.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl group">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-lg border overflow-hidden">
                          <img src={item.photoUrls[0]} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{item.category}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">{item.netWeight}g • {item.purity}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-black text-slate-700">₹{item.finalAmount.toLocaleString()}</span>
                        <button onClick={() => setCartItems(cartItems.filter(i => i.id !== item.id))} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"><X size={16} /></button>
                      </div>
                    </div>
                  ))}
                  {cartItems.length === 0 && <p className="text-center text-slate-400 py-10 italic">Your cart is empty.</p>}
                </div>
                <div className="border-t pt-4 mt-auto">
                  <div className="flex justify-between items-center mb-4">
                    <span className="font-bold text-slate-400">Order Total</span>
                    <span className="text-3xl font-black text-slate-900">₹{cartTotal.toLocaleString()}</span>
                  </div>
                  <button disabled={cartItems.length === 0} onClick={() => setStep(2)} className="w-full bg-amber-600 text-white py-4 rounded-xl font-black uppercase tracking-widest text-xs disabled:opacity-50 hover:bg-amber-700 shadow-xl transition-all flex items-center justify-center gap-2">
                    Next Step <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="max-w-xl mx-auto space-y-8 animate-fadeIn py-10">
            <div className="text-center">
              <h3 className="text-2xl font-black text-slate-800">Customer Identity</h3>
              <p className="text-slate-400 text-sm">Enter details for order tracking and WhatsApp recovery.</p>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Full Name</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold focus:ring-2 focus:ring-amber-500 transition-all"
                  value={customer.name}
                  onChange={e => setCustomer({...customer, name: e.target.value})}
                  placeholder="e.g. Rajesh Singh"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">WhatsApp Primary</label>
                <input 
                  type="tel" 
                  className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold focus:ring-2 focus:ring-amber-500 transition-all"
                  value={customer.contact}
                  onChange={e => setCustomer({...customer, contact: e.target.value})}
                  placeholder="+91"
                />
              </div>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setStep(1)} className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-xl font-bold uppercase text-xs">Back</button>
              <button 
                disabled={!customer.name || !customer.contact}
                onClick={() => setStep(3)} 
                className="flex-1 bg-amber-600 text-white py-4 rounded-xl font-bold uppercase text-xs shadow-xl shadow-amber-200 hover:bg-amber-700 disabled:opacity-50 transition-all"
              >
                Set Payment Plan
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 animate-fadeIn">
            <div className="space-y-6">
              <h3 className="text-xl font-black text-slate-800">Installment Strategy</h3>
              <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-6">
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400">Duration (Months)</label>
                      <input type="number" className="w-full border rounded-xl p-3 font-bold" value={plan.months} onChange={e => setPlan({...plan, months: parseInt(e.target.value) || 1})} />
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400">Advance %</label>
                      <input type="number" className="w-full border rounded-xl p-3 font-bold" value={plan.advancePercentage} onChange={e => setPlan({...plan, advancePercentage: parseInt(e.target.value) || 0})} />
                   </div>
                </div>
                
                <div className="bg-amber-50 p-5 rounded-2xl border border-amber-100 space-y-4">
                   <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" className="w-5 h-5 accent-amber-600" checked={plan.goldRateProtection} onChange={e => setPlan({...plan, goldRateProtection: e.target.checked})} />
                      <span className="font-black uppercase text-xs text-amber-800 flex items-center gap-2"><ShieldCheck size={16}/> Enable Rate Protection</span>
                   </label>
                   {plan.goldRateProtection && (
                     <p className="text-[10px] text-amber-700 leading-relaxed italic">
                        Locks gold rate at ₹{orderRate}/g. Policy voids if any installment is missed beyond the 7-day grace period. Market rate applies thereafter.
                     </p>
                   )}
                </div>
              </div>

              <div className="flex gap-4">
                <button onClick={() => setStep(2)} className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-xl font-bold uppercase text-xs">Back</button>
                <button 
                  onClick={handleFinalSubmit}
                  className="flex-[2] bg-emerald-600 text-white py-4 rounded-xl font-black uppercase text-xs shadow-xl shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                >
                  Confirm & Finalize <Sparkles size={16} />
                </button>
              </div>
            </div>

            <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden">
               <h4 className="text-amber-400 font-black uppercase tracking-widest text-xs mb-6">Negotiated Schedule</h4>
               <div className="space-y-4 relative z-10 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {generateMilestones(cartTotal).map((m, i) => (
                    <div key={i} className="flex justify-between items-center p-4 bg-white/5 rounded-2xl border border-white/10">
                       <div>
                          <p className="text-[10px] font-black uppercase text-slate-500 mb-1">{i === 0 ? 'Initial Advance' : `Milestone ${i}`}</p>
                          <p className="font-bold text-sm">{new Date(m.dueDate).toLocaleDateString()}</p>
                       </div>
                       <div className="text-right">
                          <p className="text-xl font-black text-amber-400">₹{m.targetAmount.toLocaleString()}</p>
                          <p className="text-[10px] font-bold text-slate-500 uppercase">Status: Pending</p>
                       </div>
                    </div>
                  ))}
               </div>
               <div className="mt-8 pt-8 border-t border-white/10 flex justify-between items-center relative z-10">
                  <div className="flex items-center gap-3">
                     <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center text-amber-400">
                        <User />
                     </div>
                     <div>
                        <p className="font-bold">{customer.name}</p>
                        <p className="text-xs text-slate-400">{customer.contact}</p>
                     </div>
                  </div>
               </div>
               <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500 opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const InputGroup = ({ label, val, onChange }: any) => (
  <div className="space-y-1">
    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">{label}</label>
    <input 
      type="number" 
      className="w-full border border-slate-200 rounded-xl p-3 font-bold focus:ring-2 focus:ring-amber-500 outline-none" 
      value={val || ''}
      onChange={e => onChange(parseFloat(e.target.value) || 0)}
    />
  </div>
);

const PriceRow = ({ label, val }: any) => (
  <div className="flex justify-between items-center text-sm">
    <span className="text-amber-900/60 font-medium">{label}</span>
    <span className="font-bold text-amber-900">₹{Math.round(val).toLocaleString()}</span>
  </div>
);

export default OrderForm;
