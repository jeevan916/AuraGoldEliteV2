
import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, Zap, Database, ServerCrash, CheckCircle2, AlertTriangle, Loader2, LayoutGrid, Plus, Trash2, Info, Key, Clock, Calendar, MessageSquare, CreditCard, Smartphone, Wrench, Code, Check } from 'lucide-react';
import { GlobalSettings, CatalogItem } from '../types';
import { goldRateService } from '../services/goldRateService';
import { storageService } from '../services/storageService';

interface SettingsProps {
  settings: GlobalSettings;
  onUpdate: (settings: GlobalSettings) => void;
}

const Settings: React.FC<SettingsProps> = ({ settings, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<'CONFIG' | 'CATALOG'>('CONFIG');
  const [localSettings, setLocalSettings] = useState(settings);
  const [catalog, setCatalog] = useState<CatalogItem[]>(storageService.getCatalog());
  
  const [syncing, setSyncing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  useEffect(() => { setLocalSettings(settings); }, [settings]);

  const handleUpdateSettings = async () => {
      setIsSaving(true);
      try {
          await onUpdate(localSettings);
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 2000);
      } finally { setIsSaving(false); }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fadeIn py-4">
      <header className="flex justify-between items-end">
        <div><h2 className="text-3xl font-black text-slate-900 tracking-tight">System Console</h2><p className="text-slate-500 text-xs mt-2 font-medium">Manage Pricing & Architecture</p></div>
        <div className="flex gap-3">
             <button onClick={() => setActiveTab('CONFIG')} className={`px-6 py-2 rounded-xl text-xs font-black uppercase ${activeTab === 'CONFIG' ? 'bg-slate-900 text-white' : 'bg-white text-slate-500'}`}>Config</button>
             <button onClick={() => setActiveTab('CATALOG')} className={`px-6 py-2 rounded-xl text-xs font-black uppercase ${activeTab === 'CATALOG' ? 'bg-amber-500 text-white' : 'bg-white text-slate-500'}`}>Catalog</button>
        </div>
      </header>

      {activeTab === 'CONFIG' && (
      <div className="space-y-8">
          <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-8">
             <SectionHeader title="Market Pricing Matrix" subtitle="Global rates and purity spreads." />
             <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <PricingField label="24K (/g)" value={localSettings.currentGoldRate24K} onChange={v => setLocalSettings({...localSettings, currentGoldRate24K: v})} />
                <PricingField label="22K (/g)" value={localSettings.currentGoldRate22K} onChange={v => setLocalSettings({...localSettings, currentGoldRate22K: v})} />
                <PricingField label="22K Factor (Standard 0.916)" value={localSettings.purityFactor22K || 0.916} onChange={v => setLocalSettings({...localSettings, purityFactor22K: v})} isFactor />
                <PricingField label="18K Factor (Standard 0.75)" value={localSettings.purityFactor18K || 0.75} onChange={v => setLocalSettings({...localSettings, purityFactor18K: v})} isFactor />
             </div>
             <div className="pt-6 border-t flex justify-end">
                <button disabled={isSaving} onClick={handleUpdateSettings} className={`px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-xl ${saveSuccess ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-900 text-white'}`}>
                    {isSaving ? <Loader2 className="animate-spin" /> : saveSuccess ? <Check /> : <Save />} {saveSuccess ? 'Saved' : 'Save Configuration'}
                </button>
             </div>
          </div>
      </div>
      )}
    </div>
  );
};

const PricingField = ({ label, value, onChange, isFactor }: any) => (
  <div className="space-y-3">
    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">{label}</label>
    <div className="relative">
        {!isFactor && <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>}
        <input type="number" step={isFactor ? "0.001" : "1"} className={`w-full bg-slate-50 border rounded-2xl p-4 font-black text-lg text-slate-800 ${isFactor ? 'pl-4' : 'pl-9'}`} value={value} onChange={e => onChange(parseFloat(e.target.value) || 0)} />
    </div>
  </div>
);

const SectionHeader = ({ title, subtitle }: any) => (
    <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600"><Zap size={16}/></div>
        <div><h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">{title}</h3><p className="text-[10px] text-slate-400">{subtitle}</p></div>
    </div>
);

export default Settings;
