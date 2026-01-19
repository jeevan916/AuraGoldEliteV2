import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, Zap, ShieldCheck, Database, ServerCrash, CheckCircle2, AlertTriangle, Loader2, LayoutGrid, Plus, Trash2, Info, Key, Server, Clock, Calendar, MessageSquare, CreditCard, Smartphone, Wrench, Code, Check, Scale } from 'lucide-react';
import { GlobalSettings, CatalogItem } from '../types';
import { goldRateService } from '../services/goldRateService';
import { storageService } from '../services/storageService';
import { whatsappService } from '../services/whatsappService';

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
  
  const [rawRateData, setRawRateData] = useState<any>(null);
  const [dbStatus, setDbStatus] = useState<'IDLE' | 'TESTING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [dbMessage, setDbMessage] = useState('');
  
  const [dbConfig, setDbConfig] = useState({ host: '127.0.0.1', user: '', password: '', database: '' });
  const [savingDb, setSavingDb] = useState(false);

  const [newItem, setNewItem] = useState<Partial<CatalogItem>>({
      category: 'Ring', metalColor: 'Yellow Gold', purity: '22K'
  });

  useEffect(() => {
    setLocalSettings(settings);
    setCatalog(storageService.getCatalog());
  }, [settings]);

  const handleLiveSync = async () => {
    setSyncing(true);
    try {
        const result = await goldRateService.fetchLiveRate();
        if (result && result.success) {
          const updatedSettings = {
            ...localSettings,
            currentGoldRate24K: result.rate24K,
            currentGoldRate22K: result.rate22K,
            currentGoldRate18K: result.rate18K
          };
          setLocalSettings(updatedSettings);
          onUpdate(updatedSettings);
        }
    } finally {
        setSyncing(false);
    }
  };

  const handleUpdateSettings = async () => {
      setIsSaving(true);
      try {
          await onUpdate(localSettings);
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 2000);
      } catch (e) {
          alert("Failed to save settings");
      } finally {
          setIsSaving(false);
      }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fadeIn py-4">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-3xl md:text-4xl font-serif font-black text-slate-900 tracking-tight">System Console</h2>
          <p className="text-slate-500 text-xs mt-2 font-medium">Manage pricing spreads, inventory catalog, and integrations.</p>
        </div>
        <div className="flex gap-3">
             <button onClick={() => setActiveTab('CONFIG')} className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'CONFIG' ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-500 hover:bg-slate-100'}`}>Configuration</button>
             <button onClick={() => setActiveTab('CATALOG')} className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'CATALOG' ? 'bg-amber-50 text-amber-900 shadow-lg' : 'bg-white text-slate-500 hover:bg-slate-100'}`}><LayoutGrid size={14} /> Catalog</button>
        </div>
      </header>

      {activeTab === 'CONFIG' && (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <section className="lg:col-span-8 space-y-8">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-8">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600"><Zap size={16} /></div>
                   <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Market Pricing Matrix</h3>
                </div>
                <button disabled={syncing} className="flex items-center gap-2 bg-slate-100 text-slate-600 px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-slate-200" onClick={handleLiveSync}>
                    <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} /> Fetch Live
                </button>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <PricingField label="24K Base Rate (/g)" value={localSettings.currentGoldRate24K} onChange={v => setLocalSettings({...localSettings, currentGoldRate24K: v})} />
                <PricingField label="Default GST (%)" value={localSettings.defaultTaxRate} onChange={v => setLocalSettings({...localSettings, defaultTaxRate: v})} />
             </div>

             <div className="pt-6 border-t border-slate-100">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600"><Scale size={16} /></div>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Regional Purity Spreads</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">22K Conversion Factor</label>
                        <input type="number" step="0.001" className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-lg font-black text-slate-800" value={localSettings.purityFactor22K} onChange={e => setLocalSettings({...localSettings, purityFactor22K: parseFloat(e.target.value) || 0})} />
                        <p className="text-[9px] text-slate-400">Current 22K: ₹{Math.round(localSettings.currentGoldRate24K * localSettings.purityFactor22K)}</p>
                    </div>
                    <div className="space-y-3">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">18K Conversion Factor</label>
                        <input type="number" step="0.001" className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-lg font-black text-slate-800" value={localSettings.purityFactor18K} onChange={e => setLocalSettings({...localSettings, purityFactor18K: parseFloat(e.target.value) || 0})} />
                        <p className="text-[9px] text-slate-400">Current 18K: ₹{Math.round(localSettings.currentGoldRate24K * localSettings.purityFactor18K)}</p>
                    </div>
                </div>
             </div>
          </div>
          <div className="flex justify-end pt-4">
               <button disabled={isSaving} className={`flex items-center gap-2 px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl transition-all ${saveSuccess ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`} onClick={handleUpdateSettings}>
                {isSaving ? <Loader2 className="animate-spin" size={16} /> : saveSuccess ? <Check size={16} /> : <Save size={16} />} Save Configuration
              </button>
          </div>
        </section>
        <aside className="lg:col-span-4 space-y-6">
            <div className="bg-[#0f172a] text-white p-6 rounded-[2.5rem] shadow-2xl">
                  <ShieldCheck size={32} className="text-amber-500 mb-4" />
                  <h4 className="text-lg font-bold mb-2">Financial Integrity</h4>
                  <p className="text-sm text-slate-400 leading-relaxed">Adjust purity factors to account for local market premiums. Every calculation is strictly rounded to prevent rounding drift.</p>
            </div>
        </aside>
      </div>
      )}
    </div>
  );
};

const PricingField = ({ label, value, onChange }: any) => (
  <div className="space-y-3">
    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">{label}</label>
    <div className="relative">
        <input type="number" className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-lg font-black text-slate-800 outline-none" value={value} onChange={e => onChange(parseFloat(e.target.value) || 0)} />
    </div>
  </div>
);

export default Settings;