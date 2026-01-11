
import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Power, PowerOff, Save, X } from 'lucide-react';
import { PaymentPlanTemplate } from '../types';

interface PlanManagerProps {
  templates: PaymentPlanTemplate[];
  onUpdate: (templates: PaymentPlanTemplate[]) => void;
}

const PlanManager: React.FC<PlanManagerProps> = ({ templates, onUpdate }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState<Partial<PaymentPlanTemplate>>({});

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
  };

  const startEdit = (t: PaymentPlanTemplate) => {
    setEditingId(t.id);
    setFormData(t);
    setIsAdding(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Payment Plan Management</h2>
          <p className="text-sm text-slate-500">Configure pre-created plans for your customers.</p>
        </div>
        <button 
          onClick={() => { setIsAdding(true); setEditingId(null); setFormData({}); }}
          className="bg-amber-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-amber-700 transition-all"
        >
          <Plus size={18} /> Add New Plan
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(isAdding || editingId) && (
          <div className="bg-amber-50 border-2 border-amber-200 p-6 rounded-2xl shadow-sm space-y-4 animate-fadeIn">
            <h3 className="font-bold text-amber-800">{editingId ? 'Edit Plan' : 'Create New Plan'}</h3>
            <div>
              <label className="text-xs font-bold text-amber-700 uppercase">Plan Name</label>
              <input 
                type="text" 
                className="w-full border-amber-200 rounded-lg p-2 mt-1"
                value={formData.name || ''}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Festive Gold Plan"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-amber-700 uppercase">Months</label>
                <input 
                  type="number" 
                  className="w-full border-amber-200 rounded-lg p-2 mt-1"
                  value={formData.months || ''}
                  onChange={e => setFormData({ ...formData, months: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-amber-700 uppercase">Interest %</label>
                <input 
                  type="number" 
                  className="w-full border-amber-200 rounded-lg p-2 mt-1"
                  value={formData.interestPercentage || 0}
                  onChange={e => setFormData({ ...formData, interestPercentage: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-amber-700 uppercase">Advance %</label>
              <input 
                type="number" 
                className="w-full border-amber-200 rounded-lg p-2 mt-1"
                value={formData.advancePercentage || 0}
                onChange={e => setFormData({ ...formData, advancePercentage: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={handleSave} className="flex-1 bg-amber-600 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-2">
                <Save size={16} /> Save
              </button>
              <button onClick={() => { setIsAdding(false); setEditingId(null); }} className="flex-1 bg-white border border-amber-200 text-amber-700 py-2 rounded-lg font-bold">
                Cancel
              </button>
            </div>
          </div>
        )}

        {templates.map(t => (
          <div key={t.id} className={`bg-white border p-6 rounded-2xl shadow-sm transition-all ${!t.enabled ? 'opacity-60 grayscale' : 'hover:border-amber-400'}`}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-slate-800">{t.name}</h3>
                <p className="text-xs text-slate-500">{t.months} Months Duration</p>
              </div>
              <button 
                onClick={() => handleToggle(t.id)}
                className={`p-2 rounded-lg transition-colors ${t.enabled ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                title={t.enabled ? "Enabled" : "Disabled"}
              >
                {t.enabled ? <Power size={18} /> : <PowerOff size={18} />}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 py-4 border-y border-slate-50 mb-4">
              <div className="text-center">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Interest</p>
                <p className="font-black text-amber-600">{t.interestPercentage}%</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Advance</p>
                <p className="font-black text-slate-800">{t.advancePercentage}%</p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => startEdit(t)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                <Edit2 size={16} />
              </button>
              <button onClick={() => handleDelete(t.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
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
