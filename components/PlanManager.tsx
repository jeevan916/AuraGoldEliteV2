import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Power, PowerOff, Save, X, Sparkles, BrainCircuit, Loader2, ArrowRight, Calculator, IndianRupee, Tag, ShieldCheck, Percent, Layers, CheckCircle } from 'lucide-react';
import { PaymentPlanTemplate } from '../types';
import { geminiService } from '../services/geminiService';

interface PlanManagerProps {
  templates: PaymentPlanTemplate[];
  onUpdate: (templates: PaymentPlanTemplate[]) => void;
}

const PlanManager: React.FC<PlanManagerProps> = ({ templates, onUpdate }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState<Partial<PaymentPlanTemplate>>({});
  
  // AI State
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAiInput, setShowAiInput] = useState(false);

  // Filter & Playground state
  const [selectedRangeFilter, setSelectedRangeFilter] = useState<string>('ALL');
  const [testAmount, setTestAmount] = useState<number>(35000);

  const handleToggle = (id: string) => {
    onUpdate(templates.map(t => t.id === id ? { ...t, enabled: !t.enabled } : t));
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this payment plan scheme?")) {
      onUpdate(templates.filter(t => t.id !== id));
    }
  };

  const handleSave = () => {
    if (!formData.name || !formData.months) return;

    const finalMonths = parseInt(formData.months as any) || 1;
    const finalInterest = parseFloat(formData.interestPercentage as any) || 0;
    const finalAdvance = parseFloat(formData.advancePercentage as any) || 0;
    const finalMinAmount = formData.minPurchaseAmount !== undefined && formData.minPurchaseAmount !== null ? (parseFloat(formData.minPurchaseAmount as any) || 0) : 0;
    const finalMaxAmount = formData.maxPurchaseAmount !== undefined && formData.maxPurchaseAmount !== null ? (parseFloat(formData.maxPurchaseAmount as any) || 0) : 0;
    const finalSubvention = formData.subventionPercentage !== undefined && formData.subventionPercentage !== null ? (parseFloat(formData.subventionPercentage as any) || 0) : 0;
    const finalSubventionNote = formData.subventionNote || '';

    if (editingId) {
      onUpdate(templates.map(t => t.id === editingId ? { 
        ...t, 
        ...formData,
        months: finalMonths,
        interestPercentage: finalInterest,
        advancePercentage: finalAdvance,
        minPurchaseAmount: finalMinAmount,
        maxPurchaseAmount: finalMaxAmount,
        subventionPercentage: finalSubvention,
        subventionNote: finalSubventionNote
      } as PaymentPlanTemplate : t));
    } else {
      const newPlan: PaymentPlanTemplate = {
        id: `tpl-${Date.now()}`,
        name: formData.name!,
        months: finalMonths,
        interestPercentage: finalInterest,
        advancePercentage: finalAdvance,
        minPurchaseAmount: finalMinAmount,
        maxPurchaseAmount: finalMaxAmount,
        subventionPercentage: finalSubvention,
        subventionNote: finalSubventionNote,
        enabled: true
      };
      onUpdate([...templates, newPlan]);
    }
    setEditingId(null);
    setIsAdding(false);
    setFormData({});
    setShowAiInput(false);
  };

  const handleAiGenerate = async () => {
      if (!aiPrompt) return;
      setIsGenerating(true);
      try {
          const result = await geminiService.generatePaymentPlan(aiPrompt);
          setFormData({
              name: result.name,
              months: result.months,
              interestPercentage: result.interestPercentage,
              advancePercentage: result.advancePercentage,
              minPurchaseAmount: result.minPurchaseAmount ?? 10000,
              maxPurchaseAmount: result.maxPurchaseAmount ?? 50000,
              subventionPercentage: result.subventionPercentage ?? 2,
              subventionNote: result.subventionNote ?? 'AI Generated Subvented Scheme'
          });
          setIsAdding(true);
          setAiPrompt('');
          setShowAiInput(false);
      } catch (e) {
          alert("AI Generation failed. Please try manual entry.");
      } finally {
          setIsGenerating(false);
      }
  };

  const startEdit = (t: PaymentPlanTemplate) => {
    setEditingId(t.id);
    setFormData(t);
    setIsAdding(false);
    setShowAiInput(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Helper to test if a scheme matches purchase amount
  const matchesPurchaseAmount = (t: PaymentPlanTemplate, amt: number) => {
    if (!amt || amt <= 0) return true;
    const min = t.minPurchaseAmount || 0;
    const max = t.maxPurchaseAmount || 0;
    if (min > 0 && amt < min) return false;
    if (max > 0 && amt > max) return false;
    return true;
  };

  // Filter templates by range filter tab
  const filteredTemplates = templates.filter(t => {
    if (selectedRangeFilter === '10K_50K') {
      const min = t.minPurchaseAmount || 0;
      const max = t.maxPurchaseAmount || 0;
      return (min >= 10000 || max <= 50000) && max > 0 && max <= 50000;
    }
    if (selectedRangeFilter === '50K_120K') {
      const min = t.minPurchaseAmount || 0;
      const max = t.maxPurchaseAmount || 0;
      return (min >= 50000 || max <= 120000) && min >= 50000 && max <= 120000 && max > 0;
    }
    if (selectedRangeFilter === '120K_PLUS') {
      const min = t.minPurchaseAmount || 0;
      const max = t.maxPurchaseAmount || 0;
      return min >= 120000 || max === 0;
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-fadeIn pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
              <BrainCircuit className="text-amber-500" /> Range-Based Payment Schemes & Subventions
          </h2>
          <p className="text-sm text-slate-500 font-medium">
            Offer tailored installment schemes based on order purchase amount brackets (e.g. ₹10,000–₹50,000, ₹50,001–₹120,000, ₹120,000+) with merchant subventions.
          </p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
             <button 
                onClick={() => { setShowAiInput(!showAiInput); setIsAdding(false); setEditingId(null); }}
                className={`flex-1 md:flex-initial text-white px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm transition-all ${showAiInput ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
            >
                <Sparkles size={16} /> AI Generate
            </button>
            <button 
                onClick={() => { 
                  setIsAdding(true); 
                  setEditingId(null); 
                  setFormData({ minPurchaseAmount: 10000, maxPurchaseAmount: 50000, subventionPercentage: 2, subventionNote: 'Special Subvention Offer' }); 
                  setShowAiInput(false); 
                }}
                className="flex-1 md:flex-initial bg-slate-900 text-white px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm hover:bg-slate-800 transition-all"
            >
                <Plus size={16} /> New Scheme
            </button>
        </div>
      </div>

      {/* AI Input Area */}
      {showAiInput && (
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 p-6 rounded-[2rem] animate-slideDown shadow-sm space-y-3">
               <h3 className="text-xs font-black uppercase text-indigo-800 flex items-center gap-2 tracking-wider">
                   <BrainCircuit size={16} /> AI Range Scheme Strategist
               </h3>
               <div className="flex gap-3">
                   <input 
                      type="text" 
                      className="flex-1 border-none rounded-xl p-4 text-sm font-bold text-slate-800 bg-white focus:ring-2 focus:ring-indigo-500 outline-none shadow-inner"
                      placeholder="e.g., Create 3 subvented schemes for purchases between ₹10,000 and ₹50,000 with 0% interest and 2% merchant subvention..."
                      value={aiPrompt}
                      onChange={e => setAiPrompt(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAiGenerate()}
                   />
                   <button 
                      onClick={handleAiGenerate}
                      disabled={isGenerating || !aiPrompt}
                      className="bg-indigo-600 text-white px-6 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center"
                   >
                      {isGenerating ? <Loader2 className="animate-spin" size={18} /> : <ArrowRight size={18} />}
                   </button>
               </div>
               <div className="flex gap-2 overflow-x-auto pb-1">
                   {[
                     "Subvented ₹10k to ₹50k Low-Ticket Scheme", 
                     "Mid-Segment ₹50k to ₹1.2 Lakh Zero Down Payment", 
                     "VIP High-Value Above ₹1.2 Lakh Premium Flex"
                   ].map(p => (
                       <button key={p} onClick={() => setAiPrompt(p)} className="whitespace-nowrap px-3 py-1.5 bg-white text-indigo-600 rounded-lg text-xs font-bold border border-indigo-100 hover:bg-indigo-100 transition-colors">
                           {p}
                       </button>
                   ))}
               </div>
          </div>
      )}

      {/* Manual Add / Edit Form */}
      {(isAdding || editingId) && (
        <div className="bg-amber-50/70 border border-amber-200 p-6 rounded-[2rem] shadow-md space-y-4 animate-fadeIn relative">
          <div className="flex justify-between items-center">
            <h3 className="font-black text-amber-800 text-lg flex items-center gap-2">
              <Calculator size={18} className="text-amber-600" />
              {editingId ? 'Modify Scheme & Range Parameters' : 'Configure New Range-Based Scheme'}
            </h3>
            <button onClick={() => { setIsAdding(false); setEditingId(null); }} className="p-1 text-amber-500 hover:text-amber-800 transition-colors rounded-lg bg-white/50">
              <X size={20}/>
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-amber-800 uppercase tracking-widest ml-1">Scheme Name</label>
              <input 
                type="text" 
                className="w-full border border-amber-100 rounded-xl p-3 mt-1 font-bold text-slate-800 bg-white focus:ring-2 focus:ring-amber-500 outline-none shadow-sm"
                value={formData.name || ''}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Budget Starter 3-Month Zero-Cost"
              />
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-black text-amber-800 uppercase tracking-widest ml-1">Tenure (Months)</label>
                <input 
                  type="number" 
                  className="w-full border border-amber-100 rounded-xl p-3 mt-1 font-black text-slate-800 bg-white focus:ring-2 focus:ring-amber-500 outline-none shadow-sm"
                  value={formData.months ?? ''}
                  onChange={e => setFormData({ ...formData, months: e.target.value === '' ? '' : (parseInt(e.target.value) || 1) as any })}
                  placeholder="6"
                  min="1"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-amber-800 uppercase tracking-widest ml-1">Interest % (p.a.)</label>
                <input 
                  type="number" 
                  step="0.1"
                  className="w-full border border-amber-100 rounded-xl p-3 mt-1 font-black text-slate-800 bg-white focus:ring-2 focus:ring-amber-500 outline-none shadow-sm"
                  value={formData.interestPercentage ?? ''}
                  onChange={e => setFormData({ ...formData, interestPercentage: e.target.value === '' ? '' : (parseFloat(e.target.value) || 0) as any })}
                  placeholder="0"
                  min="0"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-amber-800 uppercase tracking-widest ml-1">Advance Down %</label>
                <input 
                  type="number" 
                  step="1"
                  className="w-full border border-amber-100 rounded-xl p-3 mt-1 font-black text-slate-800 bg-white focus:ring-2 focus:ring-amber-500 outline-none shadow-sm"
                  value={formData.advancePercentage ?? ''}
                  onChange={e => setFormData({ ...formData, advancePercentage: e.target.value === '' ? '' : (parseFloat(e.target.value) || 0) as any })}
                  placeholder="10"
                  min="0"
                  max="100"
                />
              </div>
            </div>
          </div>

          {/* Purchase Amount Range & Subvention Settings */}
          <div className="p-4 bg-white/90 rounded-2xl border border-amber-200/60 space-y-3">
             <div className="flex items-center gap-2 text-xs font-black text-amber-900 uppercase tracking-wider">
                <Tag size={14} className="text-amber-600" /> Purchase Amount Eligibility & Merchant Subvention Rules
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                 <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Min Purchase (₹)</label>
                    <input 
                       type="number" 
                       className="w-full border border-slate-200 rounded-xl p-2.5 mt-1 font-bold text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none"
                       value={formData.minPurchaseAmount ?? ''}
                       onChange={e => setFormData({ ...formData, minPurchaseAmount: e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0) })}
                       placeholder="10000"
                    />
                 </div>
                 <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Max Purchase (₹, 0=∞)</label>
                    <input 
                       type="number" 
                       className="w-full border border-slate-200 rounded-xl p-2.5 mt-1 font-bold text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none"
                       value={formData.maxPurchaseAmount ?? ''}
                       onChange={e => setFormData({ ...formData, maxPurchaseAmount: e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0) })}
                       placeholder="50000"
                    />
                 </div>
                 <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Merchant Subvention %</label>
                    <input 
                       type="number" 
                       step="0.5"
                       className="w-full border border-slate-200 rounded-xl p-2.5 mt-1 font-bold text-emerald-700 bg-emerald-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                       value={formData.subventionPercentage ?? ''}
                       onChange={e => setFormData({ ...formData, subventionPercentage: e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0) })}
                       placeholder="2"
                    />
                 </div>
                 <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Subvention Description / Note</label>
                    <input 
                       type="text" 
                       className="w-full border border-slate-200 rounded-xl p-2.5 mt-1 font-medium text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none"
                       value={formData.subventionNote || ''}
                       onChange={e => setFormData({ ...formData, subventionNote: e.target.value })}
                       placeholder="e.g. 2% Merchant Subvention for budget segment"
                    />
                 </div>
             </div>
          </div>

          {/* Real-time configuration test preview */}
          {formData.months && (
            <div className="bg-white/80 p-4 rounded-2xl border border-amber-200/50 text-xs font-medium text-slate-600 flex flex-wrap gap-x-6 gap-y-2">
              <span className="font-bold text-slate-700">Scheme Preview for ₹35,000 Purchase:</span>
              <span>Down Payment: <strong className="text-slate-900">₹{Math.round(35000 * ((formData.advancePercentage || 0) / 100)).toLocaleString('en-IN')}</strong> ({formData.advancePercentage || 0}%)</span>
              {Boolean(formData.subventionPercentage) && (
                <span className="text-emerald-700 font-bold">Subvention Savings: ₹{Math.round(35000 * ((formData.subventionPercentage || 0) / 100)).toLocaleString('en-IN')} ({formData.subventionPercentage}%)</span>
              )}
              <span>Monthly EMI: <strong className="text-indigo-600 font-black">₹{Math.round(((35000 - 35000 * ((formData.advancePercentage || 0) / 100)) + (35000 - 35000 * ((formData.advancePercentage || 0) / 100)) * ((formData.interestPercentage || 0) / 100) * ((formData.months || 1) / 12)) / (formData.months || 1)).toLocaleString('en-IN')}/mo</strong></span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button 
              onClick={() => { setIsAdding(false); setEditingId(null); }} 
              className="px-4 py-3 border border-amber-300 text-amber-800 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-amber-100/50 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave} 
              disabled={!formData.name || !formData.months}
              className="bg-amber-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-sm hover:bg-amber-700 transition-all disabled:opacity-50"
            >
              <Save size={16} /> {editingId ? 'Update Scheme' : 'Save Scheme'}
            </button>
          </div>
        </div>
      )}

      {/* Range Segment Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-2">
          <Layers size={18} className="text-slate-500" />
          <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Filter Purchase Segment:</span>
        </div>
        <div className="flex gap-2 overflow-x-auto w-full sm:w-auto custom-scrollbar pb-1 sm:pb-0">
          {[
            { id: 'ALL', label: `All Schemes (${templates.length})` },
            { id: '10K_50K', label: '₹10k – ₹50k Segment' },
            { id: '50K_120K', label: '₹50k – ₹120k Segment' },
            { id: '120K_PLUS', label: '₹120k+ VIP Segment' }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setSelectedRangeFilter(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-black tracking-wide whitespace-nowrap transition-all border ${selectedRangeFilter === tab.id ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Live Interactive Purchase Amount Simulator */}
      <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-[2rem] p-6 shadow-xl space-y-4 relative overflow-hidden">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
              <div>
                  <h3 className="text-base font-black flex items-center gap-2 text-amber-400">
                      <Calculator size={18} /> Interactive Purchase Amount Simulator
                  </h3>
                  <p className="text-xs text-slate-300 font-medium">Test an order purchase amount to see eligible range schemes, down payment, and subvention discounts in real-time.</p>
              </div>
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/20 w-full md:w-auto">
                  <span className="text-xs font-black text-amber-300 uppercase tracking-widest flex items-center gap-1">
                     <IndianRupee size={12} /> Test Order Amount:
                  </span>
                  <input 
                      type="number" 
                      value={testAmount === 0 ? '' : testAmount}
                      onChange={e => setTestAmount(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-36 bg-transparent border-none p-0 font-black text-white text-lg focus:ring-0 focus:outline-none"
                      placeholder="35000"
                  />
              </div>
          </div>
          
          {/* Quick preset amount chips */}
          <div className="flex gap-2 flex-wrap text-xs relative z-10">
              {[15000, 35000, 75000, 110000, 180000, 250000].map(amt => (
                  <button 
                      key={amt}
                      onClick={() => setTestAmount(amt)}
                      className={`px-3.5 py-1.5 rounded-xl font-black transition-all border ${testAmount === amt ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md font-bold' : 'bg-white/10 text-slate-200 border-white/10 hover:bg-white/20'}`}
                  >
                      ₹{amt.toLocaleString('en-IN')}
                  </button>
              ))}
          </div>

          {testAmount > 0 && (
            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs font-bold text-slate-300">
              <span>Matching Schemes for ₹{testAmount.toLocaleString('en-IN')}: <strong className="text-amber-400">{templates.filter(t => matchesPurchaseAmount(t, testAmount)).length} eligible</strong></span>
              <span className="text-[11px] text-emerald-400 flex items-center gap-1"><ShieldCheck size={14}/> Range Eligibility Verified</span>
            </div>
          )}
      </div>

      {/* Schemes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map(t => {
          const isEligibleForTest = matchesPurchaseAmount(t, testAmount);

          // Calculations based on testAmount
          const advanceAmount = testAmount * (t.advancePercentage / 100);
          const remaining = Math.max(0, testAmount - advanceAmount);
          const interestAmount = remaining * (t.interestPercentage / 100) * (t.months / 12);
          const totalPayableRemaining = remaining + interestAmount;
          const emiAmount = totalPayableRemaining / t.months;

          // Subvention savings
          const subventionAmount = t.subventionPercentage ? testAmount * (t.subventionPercentage / 100) : 0;

          const minAmt = t.minPurchaseAmount || 0;
          const maxAmt = t.maxPurchaseAmount || 0;
          const rangeText = minAmt > 0 || maxAmt > 0 
            ? (maxAmt > 0 ? `₹${minAmt.toLocaleString('en-IN')} – ₹${maxAmt.toLocaleString('en-IN')}` : `> ₹${minAmt.toLocaleString('en-IN')}`)
            : 'All Purchase Amounts';

          return (
            <div 
              key={t.id} 
              className={`bg-white border p-6 rounded-[2rem] shadow-sm transition-all flex flex-col justify-between ${
                !t.enabled 
                  ? 'opacity-60 bg-slate-50/50 grayscale' 
                  : isEligibleForTest 
                    ? 'border-amber-300 ring-2 ring-amber-100 shadow-md' 
                    : 'border-slate-100 opacity-80'
              }`}
            >
              <div>
                {/* Header & Badges */}
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-black text-slate-800 text-base leading-snug">{t.name}</h3>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border border-amber-100">
                        {t.months} Months
                      </span>
                      <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider border border-indigo-100">
                        <Tag size={10} /> {rangeText}
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleToggle(t.id)}
                    className={`p-2 rounded-xl transition-colors ${t.enabled ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                    title={t.enabled ? "Scheme Active" : "Scheme Paused"}
                  >
                    {t.enabled ? <Power size={18} /> : <PowerOff size={18} />}
                  </button>
                </div>

                {/* Subvention Banner if configured */}
                {Boolean(t.subventionPercentage) && (
                  <div className="my-3 p-2.5 bg-emerald-50 border border-emerald-100 rounded-xl text-xs font-bold text-emerald-800 flex items-center justify-between">
                     <span className="flex items-center gap-1.5">
                        <Percent size={14} className="text-emerald-600" />
                        Merchant Subvention: <strong>{t.subventionPercentage}%</strong>
                     </span>
                     {Boolean(subventionAmount) && testAmount > 0 && (
                       <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-md font-black">
                         Save ₹{Math.round(subventionAmount).toLocaleString('en-IN')}
                       </span>
                     )}
                  </div>
                )}

                {/* Primary rates */}
                <div className="grid grid-cols-2 gap-2 py-3 border-y border-slate-50 mb-3 bg-slate-50/40 rounded-2xl px-2">
                  <div className="text-center">
                    <p className="text-[9px] uppercase font-black text-slate-400 tracking-widest">Interest Rate</p>
                    <p className="font-black text-amber-600 text-lg">{t.interestPercentage}% <span className="text-[10px] text-slate-400 font-bold">p.a.</span></p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] uppercase font-black text-slate-400 tracking-widest">Down Payment</p>
                    <p className="font-black text-slate-800 text-lg">{t.advancePercentage}%</p>
                  </div>
                </div>

                {/* Live Simulation calculations for this card */}
                {testAmount > 0 && (
                  <div className={`space-y-2 mb-3 p-3.5 rounded-2xl text-xs font-bold ${isEligibleForTest ? 'bg-gradient-to-br from-amber-50/40 to-orange-50/50 border border-amber-200/60 text-slate-700' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}>
                    <div className="flex justify-between items-center pb-1 border-b border-slate-200/60">
                      <span className="text-[10px] uppercase tracking-wider font-black text-slate-500">Order ₹{testAmount.toLocaleString('en-IN')} Breakdown</span>
                      {isEligibleForTest ? (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md font-black flex items-center gap-1">
                          <CheckCircle size={10} /> Eligible
                        </span>
                      ) : (
                        <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-md font-black">
                          Out of Range
                        </span>
                      )}
                    </div>
                    {isEligibleForTest && (
                      <>
                        <div className="flex justify-between">
                          <span>Down Payment (Advance):</span>
                          <span className="text-slate-900 font-black">₹{Math.round(advanceAmount).toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Financed Balance:</span>
                          <span className="text-slate-900">₹{Math.round(remaining).toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between border-t border-slate-100/80 pt-1.5 mt-1 font-black">
                          <span className="text-slate-800">Monthly EMI:</span>
                          <span className="text-indigo-600 text-sm">₹{Math.round(emiAmount).toLocaleString('en-IN')}/mo</span>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {t.subventionNote && (
                  <p className="text-[11px] text-slate-400 italic mb-3 font-medium">"{t.subventionNote}"</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3 mt-2">
                <button 
                  onClick={() => startEdit(t)} 
                  className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors border border-slate-100 bg-white"
                >
                  <Edit2 size={13} /> Edit
                </button>
                <button 
                  onClick={() => handleDelete(t.id)} 
                  className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors border border-slate-100 bg-white"
                >
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </div>
          );
        })}
        {filteredTemplates.length === 0 && (
          <div className="col-span-full bg-white p-12 text-center rounded-[2rem] border border-slate-100">
            <Calculator className="mx-auto text-slate-300 mb-3 animate-pulse" size={48} />
            <h4 className="font-black text-slate-800 text-lg">No Schemes Found for Selected Filter</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">Try selecting "All Schemes" or configure a new range-based scheme above.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlanManager;
