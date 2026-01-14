import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Power, PowerOff, Save, X, Sparkles, BrainCircuit, Loader2, ArrowRight } from 'lucide-react';
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

  const handleToggle = (id: string) => {
    onUpdate(templates.map(t => t.id === id ? { ...t, enabled: !t.enabled } : t));
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this plan?")) {
      onUpdate(templates.filter(t => t.id !== id));
    }
  };

  const handleSave = () => {
    if (!formData.name || !formData.months) return;

    if (editingId) {
      onUpdate(templates.map(t => t.id === editingId ? { ...t, ...formData } as PaymentPlanTemplate : t));
    } else {
      const newPlan: PaymentPlanTemplate = {
        id: `tpl-${Date.now()}`,
        name: formData.name!,
        months: formData.months || 1,
        interestPercentage: formData.interestPercentage || 0,
        advancePercentage: formData.advancePercentage || 0,
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
              advancePercentage: result.advancePercentage
          });
          setIsAdding(true); // Open the manual form with pre-filled data
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
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
              <BrainCircuit className="text-amber-500" /> AI Plan Manager
          </h2>
          <p className="text-sm text-slate-500">Configure financial schemes manually or generate them using AI strategy.</p>
        </div>
        <div className="flex gap-3">
             <button 
                onClick={() => { setShowAiInput(!showAiInput); setIsAdding(false); }}
                className="bg-indigo-600 text-white px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg hover:bg-indigo-700 transition-all"
            >
                <Sparkles size={16} /> AI Auto-Create
            </button>
            <button 
                onClick={() => { setIsAdding(true); setEditingId(null); setFormData({}); setShowAiInput(false); }}
                className="bg-slate-900 text-white px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg hover:bg-slate-800 transition-all"
            >
                <Plus size={16} /> Manual Add
            </button>
        </div>
      </div>

      {/* AI Input Area */}
      {showAiInput && (
          <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-[2rem] animate-slideDown shadow-inner">
               <h3 className="text-sm font-black uppercase text-indigo-800 mb-2 flex items-center gap-2">
                   <BrainCircuit size={16} /> Describe your Strategy
               </h3>
               <div className="flex gap-3">
                   <input 
                      type="text" 
                      className="flex-1 border-none rounded-xl p-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="Ex: Aggressive 3-month recovery plan for high risk customers with 15% interest..."
                      value={aiPrompt}
                      onChange={e => setAiPrompt(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAiGenerate()}
                   />
                   <button 
                      onClick={handleAiGenerate}
                      disabled={isGenerating || !aiPrompt}
                      className="bg-indigo-600 text-white px-6 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all"
                   >
                      {isGenerating ? <Loader2 className="animate-spin" /> : <ArrowRight />}
                   </button>
               </div>
               <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
                   {["High Risk Short Term", "Long Term VIP No Interest", "Festive 11+1 Scheme"].map(p => (
                       <button key={p} onClick={() => setAiPrompt(p)} className="whitespace-nowrap px-3 py-1 bg-white text-indigo-600 rounded-lg text-xs font-bold border border-indigo-100 hover:bg-indigo-100">
                           {p}
                       </button>
                   ))}
               </div>
          </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(isAdding || editingId) && (
          <div className="bg-amber-50 border-2 border-amber-200 p-6 rounded-[2rem] shadow-xl space-y-4 animate-fadeIn relative">
            <h3 className="font-black text-amber-800 text-lg">{editingId ? 'Edit Plan' : 'New Plan Details'}</h3>
            <button onClick={() => { setIsAdding(false); setEditingId(null); }} className="absolute top-6 right-6 text-amber-400 hover:text-amber-700"><X size={20}/></button>
            
            <div>
              <label className="text-[10px] font-black text-amber-700 uppercase tracking-widest ml-1">Plan Name</label>
              <input 
                type="text" 
                className="w-full border-none rounded-xl p-3 mt-1 font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 outline-none"
                value={formData.name || ''}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Festive Gold Plan"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black text-amber-700 uppercase tracking-widest ml-1">Months</label>
                <input 
                  type="number" 
                  className="w-full border-none rounded-xl p-3 mt-1 font-black text-slate-800 focus:ring-2 focus:ring-amber-500 outline-none"
                  value={formData.months || ''}
                  onChange={e => setFormData({ ...formData, months: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-amber-700 uppercase tracking-widest ml-1">Interest %</label>
                <input 
                  type="number" 
                  className="w-full border-none rounded-xl p-3 mt-1 font-black text-slate-800 focus:ring-2 focus:ring-amber-500 outline-none"
                  value={formData.interestPercentage || 0}
                  onChange={e => setFormData({ ...formData, interestPercentage: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black text-amber-700 uppercase tracking-widest ml-1">Advance %</label>
              <input 
                type="number" 
                className="w-full border-none rounded-xl p-3 mt-1 font-black text-slate-800 focus:ring-2 focus:ring-amber-500 outline-none"
                value={formData.advancePercentage || 0}
                onChange={e => setFormData({ ...formData, advancePercentage: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="pt-2">
              <button onClick={handleSave} className="w-full bg-amber-600 text-white py-3 rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-md hover:bg-amber-700 transition-all">
                <Save size={16} /> Save Plan
              </button>
            </div>
          </div>
        )}

        {templates.map(t => (
          <div key={t.id} className={`bg-white border p-6 rounded-[2rem] shadow-sm transition-all group ${!t.enabled ? 'opacity-60 grayscale' : 'hover:border-amber-400 hover:shadow-md'}`}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-black text-slate-800 text-lg">{t.name}</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">{t.months} Months Duration</p>
              </div>
              <button 
                onClick={() => handleToggle(t.id)}
                className={`p-2 rounded-xl transition-colors ${t.enabled ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                title={t.enabled ? "Enabled" : "Disabled"}
              >
                {t.enabled ? <Power size={18} /> : <PowerOff size={18} />}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 py-4 border-y border-slate-50 mb-4 bg-slate-50/50 rounded-xl px-2">
              <div className="text-center">
                <p className="text-[9px] uppercase font-black text-slate-400 tracking-widest">Interest</p>
                <p className="font-black text-amber-600 text-xl">{t.interestPercentage}%</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] uppercase font-black text-slate-400 tracking-widest">Advance</p>
                <p className="font-black text-slate-800 text-xl">{t.advancePercentage}%</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => startEdit(t)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors">
                <Edit2 size={16} />
              </button>
              <button onClick={() => handleDelete(t.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlanManager;