import React, { useState, useMemo } from 'react';
import { 
  Plus, ShoppingBag, Trash2, ShieldCheck, 
  Calculator, User, ChevronRight, X, Loader2, Sparkles, Zap, Image as ImageIcon, Camera, Trash, 
  IndianRupee, ArrowRight
} from 'lucide-react';
import { 
  Order, JewelryDetail, OrderStatus, GlobalSettings, 
  ProductionStatus, Purity, ProtectionStatus, Milestone, PaymentPlan
} from './types';
import { compressImage } from './services/imageOptimizer';

interface OrderFormProps {
  settings: GlobalSettings;
  onSubmit: (order: Order) => void;
  onCancel: () => void;
}

const OrderForm: React.FC<OrderFormProps> = ({ settings, onSubmit, onCancel }) => {
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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setIsCompressing(true);
      const urls: string[] = [];
      const files = Array.from(e.target.files) as File[];
      for (const file of files) {
        const compressed = await compressImage(file);
        urls.push(compressed);
      }
      setCurrentItem(prev => ({ ...prev, photoUrls: [...(prev.photoUrls || []), ...urls] }));
      setIsCompressing(false);
    }
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
    <div className="flex flex-col min-h-full max-w-4xl mx-auto space-y-4">
      
      {/* Header Indicators */}
      <div className="flex bg-white rounded-2xl border overflow-hidden p-1">
        {[1, 2, 3].map(s => (
          <div key={s} className={`flex-1 py-2 text-center text-[10px] font-black uppercase tracking-widest transition-colors ${step === s ? 'bg-slate-900 text-white rounded-xl' : 'text-slate-400'}`}>
            {s === 1 ? 'Calculate' : s === 2 ? 'Client' : 'Finalize'}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4 pb-48">
          {/* Rate Entry */}
          <div className="pos-card p-4 flex justify-between items-center bg-slate-900 text-white">
            <div>
               <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Booking Rate (22K)</p>
               <input type="number" className="bg-transparent text-2xl font-black outline-none w-32 border-b border-white/20" value={orderRate} onChange={e => setOrderRate(parseFloat(e.target.value) || 0)} />
            </div>
            <div className="text-right">
                <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Total Cart</p>
                <p className="text-2xl font-black text-amber-400">₹{cartTotal.toLocaleString()}</p>
            </div>
          </div>

          {/* Calculator Section */}
          <div className="pos-card p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <InputWrapper label="Category">
                    <select className="w-full font-bold bg-transparent" value={currentItem.category} onChange={e => setCurrentItem({...currentItem, category: e.target.value})}>
                        {['Ring', 'Necklace', 'Earrings', 'Bangle', 'Bracelet', 'Chain'].map(c => <option key={c}>{c}</option>)}
                    </select>
                </InputWrapper>
                <InputWrapper label="Purity">
                    <select className="w-full font-bold bg-transparent" value={currentItem.purity} onChange={e => setCurrentItem({...currentItem, purity: e.target.value as Purity})}>
                        <option value="22K">22K Standard</option>
                        <option value="24K">24K Pure</option>
                        <option value="18K">18K Rose/White</option>
                    </select>
                </InputWrapper>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <InputWrapper label="Net Wt (g)"><input type="number" step="0.001" className="w-full font-black text-lg" value={currentItem.netWeight || ''} onChange={e => setCurrentItem({...currentItem, netWeight: parseFloat(e.target.value) || 0})} placeholder="0.000" /></InputWrapper>
                <InputWrapper label="Wastage %"><input type="number" className="w-full font-black text-lg" value={currentItem.wastagePercentage || ''} onChange={e => setCurrentItem({...currentItem, wastagePercentage: parseFloat(e.target.value) || 0})} placeholder="12" /></InputWrapper>
                <InputWrapper label="Making/g"><input type="number" className="w-full font-black text-lg" value={currentItem.makingChargesPerGram || ''} onChange={e => setCurrentItem({...currentItem, makingChargesPerGram: parseFloat(e.target.value) || 0})} placeholder="450" /></InputWrapper>
                <InputWrapper label="Stone Cost"><input type="number" className="w-full font-black text-lg" value={currentItem.stoneCharges || ''} onChange={e => setCurrentItem({...currentItem, stoneCharges: parseFloat(e.target.value) || 0})} placeholder="0" /></InputWrapper>
            </div>

            {/* LIVE ITEM VALUATION - HIGH VISIBILITY */}
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 flex justify-between items-center">
                <div>
                    <p className="text-[10px] font-black uppercase text-amber-700">Estimated Item Price</p>
                    <p className="text-2xl font-black text-slate-900">₹{Math.round(pricing.total).toLocaleString()}</p>
                </div>
                <button onClick={handleAddItem} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-xs uppercase flex items-center gap-2 active:scale-95">
                    <Plus size={16} /> Add to Cart
                </button>
            </div>
          </div>

          {/* Cart Table */}
          {cartItems.length > 0 && (
              <div className="pos-card overflow-hidden">
                  <div className="bg-slate-50 p-3 border-b"><p className="text-[10px] font-black uppercase text-slate-500">Order Contents</p></div>
                  <div className="divide-y">
                      {cartItems.map(item => (
                          <div key={item.id} className="p-4 flex justify-between items-center">
                              <div>
                                  <p className="font-bold text-sm">{item.category} ({item.netWeight}g)</p>
                                  <p className="text-[10px] text-slate-400 uppercase font-bold">{item.purity} • VA {item.wastagePercentage}%</p>
                              </div>
                              <div className="flex items-center gap-4">
                                  <p className="font-black text-sm">₹{item.finalAmount.toLocaleString()}</p>
                                  <button onClick={() => setCartItems(cartItems.filter(i => i.id !== item.id))} className="text-rose-500"><X size={18} /></button>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4 pt-4 pb-48">
            <h3 className="text-lg font-black text-slate-800 ml-1">Customer Information</h3>
            <div className="pos-card p-6 space-y-6">
                <InputWrapper label="Full Name">
                    <input className="w-full font-bold text-lg p-2" value={customer.name} onChange={e => setCustomer({...customer, name: e.target.value})} placeholder="Ex: Rahul Sharma" />
                </InputWrapper>
                <InputWrapper label="WhatsApp Number">
                    <input type="tel" className="w-full font-bold text-lg p-2" value={customer.contact} onChange={e => setCustomer({...customer, contact: e.target.value})} placeholder="+91" />
                </InputWrapper>
            </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4 pt-4 pb-48">
            <h3 className="text-lg font-black text-slate-800 ml-1">Payment & Plan</h3>
            <div className="pos-card p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <InputWrapper label="Duration (Months)">
                        <input type="number" className="w-full font-black text-lg" value={plan.months} onChange={e => setPlan({...plan, months: parseInt(e.target.value) || 1})} />
                    </InputWrapper>
                    <InputWrapper label="Advance %">
                        <input type="number" className="w-full font-black text-lg" value={plan.advancePercentage} onChange={e => setPlan({...plan, advancePercentage: parseInt(e.target.value) || 0})} />
                    </InputWrapper>
                </div>
                <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
                    <input type="checkbox" className="w-5 h-5 accent-amber-600" checked={plan.goldRateProtection} onChange={e => setPlan({...plan, goldRateProtection: e.target.checked})} />
                    <div>
                        <p className="text-xs font-black text-amber-900">Lock Gold Rate at ₹{orderRate}/g</p>
                        <p className="text-[9px] text-amber-700 italic">Rate protection active for full duration.</p>
                    </div>
                </div>
            </div>

            {/* Schedule Table */}
            <div className="pos-card p-4">
                <p className="text-[10px] font-black uppercase text-slate-400 mb-4 tracking-widest">Installment Preview</p>
                <div className="space-y-2">
                    {generateMilestones(cartTotal).map((m, i) => (
                        <div key={i} className="flex justify-between items-center text-xs p-2 border-b last:border-0">
                            <span className="font-bold text-slate-500">{i === 0 ? 'Downpayment' : `Month ${i}`}</span>
                            <span className="font-black text-slate-800">₹{m.targetAmount.toLocaleString()}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}

      {/* --- GUARANTEED ACTION ZONE (MOBILE BUTTONS) --- */}
      <div className="action-zone">
         <div className="flex gap-3">
            {step > 1 && (
                <button onClick={() => setStep(step - 1)} className="flex-1 bg-slate-200 text-slate-700 py-4 rounded-xl font-black uppercase text-xs">Back</button>
            )}
            
            {step === 1 && (
                <button disabled={cartItems.length === 0} onClick={() => setStep(2)} className="flex-[2] bg-slate-900 text-white py-4 rounded-xl font-black uppercase text-xs flex items-center justify-center gap-2 shadow-lg disabled:opacity-50">
                    Next: Client Info <ChevronRight size={18} />
                </button>
            )}

            {step === 2 && (
                <button disabled={!customer.name || !customer.contact} onClick={() => setStep(3)} className="flex-[2] bg-slate-900 text-white py-4 rounded-xl font-black uppercase text-xs flex items-center justify-center gap-2 shadow-lg disabled:opacity-50">
                    Next: Set Plan <ChevronRight size={18} />
                </button>
            )}

            {step === 3 && (
                <button onClick={submitOrder} className="flex-[2] bg-emerald-600 text-white py-4 rounded-xl font-black uppercase text-xs flex items-center justify-center gap-2 shadow-lg">
                    Generate Booking <Sparkles size={18} />
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
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus-within:border-amber-500 transition-colors">
            {children}
        </div>
    </div>
);

export default OrderForm;