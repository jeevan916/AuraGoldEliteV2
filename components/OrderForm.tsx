import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, ShoppingBag, Trash2, ShieldCheck, 
  Calculator, User, ChevronRight, X, Loader2, Sparkles, Zap, Image as ImageIcon, Camera, Trash, 
  IndianRupee, ArrowRight, Lock, Calendar, Scale, Tag, Ruler, Upload, Gem, LayoutGrid, BrainCircuit, CheckCircle2,
  CalendarDays, AlignLeft, ArrowLeft
} from 'lucide-react';
import { 
  Order, JewelryDetail, OrderStatus, GlobalSettings, 
  ProductionStatus, Purity, ProtectionStatus, Milestone, PaymentPlan, PaymentPlanTemplate, CatalogItem
} from '../types';
import { compressImage } from '../services/imageOptimizer';
import { storageService } from '../services/storageService';
import { financialService } from '../services/financialService';
import { Button, Card, SectionHeader, Badge } from './shared/BaseUI';

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
    grossWeight: 0, netWeight: 0, stoneCharges: 0, stoneDetails: '',
    wastagePercentage: 12, makingChargesPerGram: 450, photoUrls: [], huid: '', size: ''
  };
  
  const [currentItem, setCurrentItem] = useState<Partial<JewelryDetail>>(initialItem);
  const [isCompressing, setIsCompressing] = useState(false);

  const [plan, setPlan] = useState<Partial<PaymentPlan>>({
    months: 6, advancePercentage: 10, interestPercentage: 0, goldRateProtection: true, type: 'MANUAL'
  });

  const pricing = useMemo(() => {
    return financialService.calculateItemQuote(currentItem, settings, orderRate);
  }, [currentItem, orderRate, settings]);

  const cartTotal = useMemo(() => cartItems.reduce((s, i) => s + i.finalAmount, 0), [cartItems]);

  const handleAddItem = () => {
    if (!currentItem.netWeight || currentItem.netWeight <= 0) return alert("Net weight is required.");
    
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

  const submitOrder = () => {
    if (cartItems.length === 0) return alert("Add items first.");
    if (!customer.name || !customer.contact) return alert("Customer details required.");

    const advance = Math.round(cartTotal * ((plan.advancePercentage || 10) / 100));
    const milestones: Milestone[] = [{
        id: 'ADV', dueDate: new Date().toISOString().split('T')[0], targetAmount: advance, cumulativeTarget: advance,
        status: 'PENDING', warningCount: 0, description: 'Booking Advance'
    }];

    const finalOrder: Order = {
      id: `ORD-${Date.now()}`,
      shareToken: Math.random().toString(36).substring(2, 15),
      customerName: customer.name,
      customerContact: customer.contact,
      items: cartItems,
      payments: [],
      totalAmount: cartTotal,
      goldRateAtBooking: orderRate,
      status: OrderStatus.ACTIVE,
      createdAt: new Date().toISOString(),
      paymentPlan: { 
        ...plan, milestones, protectionStatus: ProtectionStatus.ACTIVE, protectionRateBooked: orderRate,
        protectionDeadline: new Date(Date.now() + 180 * 86400000).toISOString(), protectionLimit: settings.goldRateProtectionMax 
      } as PaymentPlan
    };
    onSubmit(finalOrder);
  };

  return (
    <div className="flex flex-col min-h-full max-w-4xl mx-auto space-y-8 pb-32 animate-fadeIn">
      {/* Header Wizard Nav */}
      <div className="flex items-center justify-between bg-white rounded-[2rem] p-2 border border-slate-100 shadow-sm">
        <button onClick={onCancel} className="p-4 text-slate-400 hover:text-rose-500 transition-colors"><X size={20}/></button>
        <div className="flex flex-1 justify-center gap-2">
            {[1, 2, 3].map(s => (
                <div key={s} className={`h-1.5 rounded-full transition-all duration-500 ${step >= s ? 'w-12 bg-slate-900' : 'w-4 bg-slate-100'}`} />
            ))}
        </div>
        <div className="px-6"><span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Step {step}/3</span></div>
      </div>

      {step === 1 && (
        <div className="space-y-6 animate-fadeIn">
          <Card className="bg-slate-900 text-white border-none shadow-2xl relative overflow-hidden">
            <div className="relative z-10 flex justify-between items-center">
                <div>
                   <p className="text-[10px] font-black uppercase text-amber-500 tracking-[0.3em] mb-2">Booking Rate (22K)</p>
                   <div className="flex items-center gap-2">
                      <span className="text-3xl font-serif">₹</span>
                      <input type="number" className="bg-transparent text-5xl font-black outline-none w-48 tracking-tighter" value={orderRate} onChange={e => setOrderRate(parseFloat(e.target.value) || 0)} />
                   </div>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Total Quote</p>
                    <p className="text-4xl font-black text-amber-400 tracking-tight">₹{cartTotal.toLocaleString()}</p>
                </div>
            </div>
            <div className="absolute -right-10 -bottom-10 opacity-5"><IndianRupee size={200}/></div>
          </Card>

          <Card className="space-y-8">
            <SectionHeader title="Jewelry Configuration" subtitle="Define weights and labor parameters." />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputGroup label="Category">
                    <select className="w-full font-bold bg-transparent outline-none text-lg" value={currentItem.category} onChange={e => setCurrentItem({...currentItem, category: e.target.value})}>
                        {['Ring', 'Necklace', 'Earrings', 'Bangle', 'Bracelet', 'Chain'].map(c => <option key={c}>{c}</option>)}
                    </select>
                </InputGroup>
                <InputGroup label="Net Weight (g)">
                    <input type="number" step="0.001" className="w-full font-black text-2xl bg-transparent outline-none" value={currentItem.netWeight || ''} onChange={e => setCurrentItem({...currentItem, netWeight: parseFloat(e.target.value) || 0})} placeholder="0.000" />
                </InputGroup>
                <InputGroup label="Wastage %">
                    <input type="number" className="w-full font-bold text-lg bg-transparent outline-none" value={currentItem.wastagePercentage || ''} onChange={e => setCurrentItem({...currentItem, wastagePercentage: parseFloat(e.target.value) || 0})} />
                </InputGroup>
                <InputGroup label="Labor / Gram">
                    <input type="number" className="w-full font-bold text-lg bg-transparent outline-none" value={currentItem.makingChargesPerGram || ''} onChange={e => setCurrentItem({...currentItem, makingChargesPerGram: parseFloat(e.target.value) || 0})} />
                </InputGroup>
            </div>
            
            <div className="bg-amber-50 p-8 rounded-[2rem] border border-amber-200 flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                   <p className="text-[10px] font-black uppercase text-amber-700 tracking-widest mb-1">Calculated Item Total</p>
                   <p className="text-3xl font-black text-slate-900">₹{Math.round(pricing.finalAmount || 0).toLocaleString()}</p>
                </div>
                <Button variant="gold" size="lg" onClick={handleAddItem} className="px-10">
                    <Plus size={20} /> Add to Order
                </Button>
            </div>
          </Card>

          {cartItems.length > 0 && (
              <div className="space-y-3">
                  <SectionHeader title="Order Inventory" subtitle={`${cartItems.length} items ready for booking.`} />
                  {cartItems.map((item, idx) => (
                      <div key={item.id} className="bg-white p-6 rounded-3xl border border-slate-100 flex justify-between items-center group animate-fadeIn shadow-sm hover:border-amber-200 transition-all">
                          <div className="flex items-center gap-4">
                             <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 font-bold">{idx + 1}</div>
                             <div>
                                <p className="font-black text-slate-800 uppercase tracking-wide">{item.category}</p>
                                <p className="text-xs text-slate-400 font-bold">{item.netWeight}g • VA {item.wastagePercentage}%</p>
                             </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <p className="font-black text-lg text-slate-900">₹{item.finalAmount.toLocaleString()}</p>
                            <button onClick={() => setCartItems(cartItems.filter(i => i.id !== item.id))} className="text-slate-300 hover:text-rose-500 transition-colors p-2"><Trash2 size={20} /></button>
                          </div>
                      </div>
                  ))}
              </div>
          )}
        </div>
      )}

      {step === 2 && (
        <Card className="space-y-8 animate-fadeIn">
            <SectionHeader title="Customer Link" subtitle="Identify the primary contract holder." />
            <div className="space-y-6">
                <InputGroup label="Full Name">
                    <input className="w-full font-serif font-black text-2xl bg-transparent outline-none" value={customer.name} onChange={e => setCustomer({...customer, name: e.target.value})} placeholder="Aditi Rao" />
                </InputGroup>
                <InputGroup label="WhatsApp Mobile">
                    <input type="tel" className="w-full font-black text-2xl bg-transparent outline-none tracking-widest" value={customer.contact} onChange={e => setCustomer({...customer, contact: e.target.value})} placeholder="91XXXXXXXXXX" />
                </InputGroup>
            </div>
        </Card>
      )}

      {step === 3 && (
        <Card className="space-y-8 animate-fadeIn">
            <SectionHeader title="Financial Strategy" subtitle="Define protection and installment terms." />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <InputGroup label="Contract Duration (Months)">
                    <input type="number" className="w-full font-black text-2xl bg-transparent outline-none" value={plan.months} onChange={e => setPlan({...plan, months: parseInt(e.target.value)||1})} />
                </InputGroup>
                <InputGroup label="Booking Advance %">
                    <input type="number" className="w-full font-black text-2xl bg-transparent outline-none" value={plan.advancePercentage} onChange={e => setPlan({...plan, advancePercentage: parseFloat(e.target.value)||0})} />
                </InputGroup>
                <div className="md:col-span-2 p-6 bg-slate-50 rounded-3xl flex items-center justify-between border border-slate-100">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl ${plan.goldRateProtection ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-400'}`}>
                            <ShieldCheck size={24} />
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-800 text-sm">Gold Rate Protection</h4>
                            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mt-1">Locks rate until delivery</p>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={plan.goldRateProtection} onChange={e => setPlan({...plan, goldRateProtection: e.target.checked})} />
                        <div className="w-14 h-8 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-slate-900"></div>
                    </label>
                </div>
            </div>
        </Card>
      )}

      {/* Navigation Actions */}
      <div className="flex gap-4">
        {step > 1 && (
            <Button variant="secondary" size="lg" className="flex-1" onClick={() => setStep(step - 1)}>
                <ArrowLeft size={16} /> Back
            </Button>
        )}
        <Button 
            variant={step === 3 ? 'gold' : 'primary'} 
            size="lg" 
            className="flex-[2]" 
            disabled={step === 1 && cartItems.length === 0} 
            onClick={() => step < 3 ? setStep(step + 1) : submitOrder()}
        >
            {step < 3 ? 'Continue' : 'Finalize Contract'} <ArrowRight size={16} />
        </Button>
      </div>
    </div>
  );
};

const InputGroup = ({ label, children }: any) => (
    <div className="space-y-2">
        <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">{label}</label>
        <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 shadow-inner hover:border-slate-300 transition-colors">{children}</div>
    </div>
);

export default OrderForm;