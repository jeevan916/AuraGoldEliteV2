
import React, { useState, useMemo } from 'react';
import { 
  Plus, ShoppingBag, Trash2, ShieldCheck, 
  Calculator, User, ChevronRight, X, Loader2, Sparkles, Zap, Image as ImageIcon, Camera, Trash, 
  IndianRupee, ArrowRight, Lock, Calendar, Scale, Tag, Ruler, Upload
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
    stoneCharges: 0, photoUrls: [], huid: '', size: ''
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
    if (!currentItem.netWeight || currentItem.netWeight <= 0) return alert("Net weight is required to add item.");
    
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
        alert("Failed to process image. Ensure file is an image.");
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
    const perMonth = remaining / (plan.months || 1);
    const milestones: Milestone[] = [];
    
    milestones.push({ 
      id: 'ADV', 
      dueDate: new Date().toISOString().split('T')[0], 
      targetAmount: Math.round(advance), 
      cumulativeTarget: Math.round(advance), 
      status: 'PENDING', 
      warningCount: 0 
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
        warningCount: 0 
      });
    }
    return milestones;
  };

  const submitOrder = () => {
    if (cartItems.length === 0) return alert("Please add at least one item.");
    if (!customer.name || !customer.contact) return alert("Customer name and contact are required.");

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
      paymentPlan: { 
        ...plan, 
        milestones, 
        protectionStatus: ProtectionStatus.ACTIVE, 
        protectionRateBooked: orderRate, 
        protectionDeadline: milestones[milestones.length - 1].dueDate, 
        protectionLimit: settings.goldRateProtectionMax 
      } as PaymentPlan
    };
    onSubmit(finalOrder);
  };

  return (
    <div className="flex flex-col min-h-full max-w-4xl mx-auto space-y-4 pb-20">
      
      {/* Stepper */}
      <div className="flex bg-white rounded-2xl border overflow-hidden p-1 shadow-sm">
        {[1, 2, 3].map(s => (
          <div 
            key={s} 
            className={`flex-1 py-3 text-center text-[10px] font-black uppercase tracking-widest transition-all ${
              step === s ? 'bg-slate-900 text-white rounded-xl' : 'text-slate-400'
            }`}
          >
            {s === 1 ? 'Product Specs' : s === 2 ? 'Client' : 'Milestones'}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4 animate-fadeIn">
          {/* Market Context Banner */}
          <div className="bg-slate-900 p-6 rounded-[2rem] flex justify-between items-center text-white shadow-xl">
            <div>
               <p className="text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">Locked Booking Rate</p>
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
                <p className="text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">Grand Total</p>
                <p className="text-3xl font-black text-amber-400">₹{cartTotal.toLocaleString()}</p>
            </div>
          </div>

          <div className="pos-card p-5 space-y-5">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 uppercase tracking-wide">
                <Scale size={16} className="text-amber-500" /> Item Details
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
                <InputWrapper label="Category">
                    <select 
                      className="w-full font-bold bg-transparent outline-none" 
                      value={currentItem.category} 
                      onChange={e => setCurrentItem({...currentItem, category: e.target.value})}
                    >
                        {['Ring', 'Necklace', 'Earrings', 'Bangle', 'Bracelet', 'Chain', 'Pendant', 'Set', 'Mangalsutra'].map(c => <option key={c}>{c}</option>)}
                    </select>
                </InputWrapper>
                <InputWrapper label="Purity">
                    <select 
                      className="w-full font-bold bg-transparent outline-none" 
                      value={currentItem.purity} 
                      onChange={e => setCurrentItem({...currentItem, purity: e.target.value as Purity})}
                    >
                        <option value="22K">22K Standard</option>
                        <option value="24K">24K Pure</option>
                        <option value="18K">18K Luxury</option>
                    </select>
                </InputWrapper>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <InputWrapper label="Gross Wt (g)">
                    <input 
                      type="number" 
                      step="0.001" 
                      className="w-full font-black text-lg bg-transparent" 
                      value={currentItem.grossWeight || ''} 
                      onChange={e => setCurrentItem({...currentItem, grossWeight: parseFloat(e.target.value) || 0})} 
                      placeholder="0.000" 
                    />
                </InputWrapper>
                <InputWrapper label="Net Wt (g)">
                    <input 
                      type="number" 
                      step="0.001" 
                      className="w-full font-black text-lg bg-transparent text-emerald-700" 
                      value={currentItem.netWeight || ''} 
                      onChange={e => setCurrentItem({...currentItem, netWeight: parseFloat(e.target.value) || 0})} 
                      placeholder="0.000" 
                    />
                </InputWrapper>
                <InputWrapper label="HUID">
                    <input 
                      type="text" 
                      className="w-full font-black text-lg bg-transparent text-slate-500" 
                      value={currentItem.huid || ''} 
                      onChange={e => setCurrentItem({...currentItem, huid: e.target.value.toUpperCase()})} 
                      placeholder="ABC1234" 
                    />
                </InputWrapper>
                <InputWrapper label="Size">
                    <input 
                      type="text" 
                      className="w-full font-bold text-lg bg-transparent" 
                      value={currentItem.size || ''} 
                      onChange={e => setCurrentItem({...currentItem, size: e.target.value})} 
                      placeholder="12 / 18''" 
                    />
                </InputWrapper>
            </div>

            <div className="grid grid-cols-3 gap-4">
                <InputWrapper label="VA %"><input type="number" className="w-full font-black text-lg bg-transparent" value={currentItem.wastagePercentage || ''} onChange={e => setCurrentItem({...currentItem, wastagePercentage: parseFloat(e.target.value) || 0})} placeholder="12" /></InputWrapper>
                <InputWrapper label="Labor / g"><input type="number" className="w-full font-black text-lg bg-transparent" value={currentItem.makingChargesPerGram || ''} onChange={e => setCurrentItem({...currentItem, makingChargesPerGram: parseFloat(e.target.value) || 0})} placeholder="450" /></InputWrapper>
                <InputWrapper label="Stone"><input type="number" className="w-full font-black text-lg bg-transparent" value={currentItem.stoneCharges || ''} onChange={e => setCurrentItem({...currentItem, stoneCharges: parseFloat(e.target.value) || 0})} placeholder="0" /></InputWrapper>
            </div>

            <div className="border-t border-slate-100 pt-4">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Item Photos</label>
                <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                    <div className="relative shrink-0">
                        <input 
                            type="file" 
                            accept="image/*" 
                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                            onChange={handleImageUpload}
                            disabled={isCompressing}
                        />
                        <div className="w-20 h-20 bg-slate-100 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 hover:bg-slate-50 transition-colors">
                            {isCompressing ? <Loader2 className="animate-spin" size={20} /> : <Camera size={20} />}
                            <span className="text-[8px] font-bold uppercase mt-1">Add</span>
                        </div>
                    </div>

                    {(currentItem.photoUrls || []).map((url, idx) => (
                        <div key={idx} className="relative shrink-0 w-20 h-20 group">
                            <img src={url} className="w-full h-full object-cover rounded-xl border border-slate-200" />
                            <button 
                                onClick={() => removePhoto(idx)}
                                className="absolute -top-1 -right-1 bg-rose-500 text-white p-1 rounded-full shadow-md hover:bg-rose-600 transition-colors"
                            >
                                <X size={10} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-amber-50 p-5 rounded-2xl border border-amber-200 flex justify-between items-center shadow-inner mt-2">
                <div>
                    <p className="text-[9px] font-black uppercase text-amber-600 mb-1 tracking-wider">Item Total</p>
                    <p className="text-2xl font-black text-slate-900">₹{Math.round(pricing.total).toLocaleString()}</p>
                </div>
                <button 
                  onClick={handleAddItem} 
                  className="bg-slate-900 text-white px-8 py-3.5 rounded-xl font-black text-xs uppercase flex items-center gap-2 active:scale-95 shadow-lg"
                >
                    <Plus size={18} /> Add Item
                </button>
            </div>
          </div>

          {cartItems.length > 0 && (
              <div className="pos-card overflow-hidden">
                  <div className="bg-slate-50 p-4 border-b flex justify-between items-center">
                    <p className="text-[10px] font-black uppercase text-slate-500">Cart Contents ({cartItems.length})</p>
                    <p className="text-xs font-black text-slate-800">₹{cartTotal.toLocaleString()}</p>
                  </div>
                  <div className="divide-y">
                      {cartItems.map(item => (
                          <div key={item.id} className="p-4 flex justify-between items-center bg-white group hover:bg-slate-50">
                              <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 overflow-hidden">
                                    {item.photoUrls?.[0] ? <img src={item.photoUrls[0]} className="w-full h-full object-cover" /> : <ImageIcon size={20} />}
                                  </div>
                                  <div>
                                      <p className="font-black text-sm text-slate-800">{item.category}</p>
                                      <p className="text-[10px] text-slate-400 uppercase font-bold">
                                          Net: {item.netWeight}g • VA: {item.wastagePercentage}%
                                          {item.huid && <span className="ml-2 text-emerald-600">[{item.huid}]</span>}
                                      </p>
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
                    <input 
                      className="w-full font-bold text-xl bg-transparent p-1 outline-none" 
                      value={customer.name} 
                      onChange={e => setCustomer({...customer, name: e.target.value})} 
                      placeholder="Ex: Rajesh Kumar" 
                    />
                </InputWrapper>
                <InputWrapper label="WhatsApp Number">
                    <input 
                      type="tel" 
                      className="w-full font-bold text-xl bg-transparent p-1 outline-none" 
                      value={customer.contact} 
                      onChange={e => setCustomer({...customer, contact: e.target.value})} 
                      placeholder="919876543210" 
                    />
                </InputWrapper>
            </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4 animate-fadeIn py-6">
            <div className="flex justify-between items-end">
                <h3 className="text-lg font-black text-slate-800 ml-1">Payment Strategy</h3>
                <p className="text-xs font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">Total: ₹{cartTotal.toLocaleString()}</p>
            </div>

            <div className="pos-card p-6 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                    <InputWrapper label="Duration (Months)">
                        <input 
                          type="number" 
                          className="w-full font-black text-xl bg-transparent" 
                          value={plan.months} 
                          onChange={e => setPlan({...plan, months: parseInt(e.target.value) || 1})} 
                        />
                    </InputWrapper>
                    <InputWrapper label="Downpayment %">
                        <input 
                          type="number" 
                          className="w-full font-black text-xl bg-transparent" 
                          value={plan.advancePercentage} 
                          onChange={e => setPlan({...plan, advancePercentage: parseInt(e.target.value) || 0})} 
                        />
                    </InputWrapper>
                </div>
                
                <div className="bg-emerald-900 text-white p-5 rounded-[1.5rem] flex items-start gap-4 shadow-xl">
                    <div className="p-2 bg-emerald-800 rounded-lg"><Lock className="text-amber-400" size={24} /></div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-black text-sm uppercase tracking-widest">Rate Protection Active</span>
                            <input 
                              type="checkbox" 
                              className="w-5 h-5 accent-amber-500" 
                              checked={plan.goldRateProtection} 
                              onChange={e => setPlan({...plan, goldRateProtection: e.target.checked})} 
                            />
                        </div>
                        <p className="text-[10px] text-emerald-200/70 leading-relaxed italic">
                            Rate locked at ₹{orderRate}/g. This benefit is valid only for on-time payments.
                        </p>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Action Bar */}
      <div className="action-zone">
         <div className="max-w-4xl mx-auto flex gap-3">
            {step > 1 && (
                <button onClick={() => setStep(step - 1)} className="flex-1 bg-slate-200 text-slate-700 py-4 rounded-2xl font-black uppercase text-xs">Back</button>
            )}
            
            {step < 3 ? (
                <button 
                  disabled={step === 1 && cartItems.length === 0}
                  onClick={() => setStep(step + 1)} 
                  className="flex-[2] bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 shadow-xl disabled:opacity-50"
                >
                    Continue <ChevronRight size={18} />
                </button>
            ) : (
                <button onClick={submitOrder} className="flex-[2] bg-emerald-600 text-white py-4 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 shadow-xl">
                    Generate Order <Sparkles size={18} />
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
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 focus-within:border-amber-500 focus-within:bg-white transition-all">
            {children}
        </div>
    </div>
);

export default OrderForm;
