
import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, Zap, Smartphone, Key, ShieldCheck, Info, Database, ServerCrash, CheckCircle2, AlertTriangle, Loader2, Wifi } from 'lucide-react';
import { GlobalSettings } from '../types';
import { goldRateService } from '../services/goldRateService';
import { storageService } from '../services/storageService';
import { whatsappService } from '../services/whatsappService';

interface SettingsProps {
  settings: GlobalSettings;
  onUpdate: (settings: GlobalSettings) => void;
}

const Settings: React.FC<SettingsProps> = ({ settings, onUpdate }) => {
  const [localSettings, setLocalSettings] = useState(settings);
  const [syncing, setSyncing] = useState(false);
  
  // DB Test State
  const [dbStatus, setDbStatus] = useState<'IDLE' | 'TESTING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [dbMessage, setDbMessage] = useState('');

  // WhatsApp Test State
  const [waStatus, setWaStatus] = useState<'IDLE' | 'TESTING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [waMessage, setWaMessage] = useState('');

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleLiveSync = async () => {
    setSyncing(true);
    try {
        const result = await goldRateService.fetchLiveRate(true);
        if (result && result.success) {
          const updatedSettings = {
            ...localSettings,
            currentGoldRate24K: result.rate24K,
            currentGoldRate22K: result.rate22K
          };
          setLocalSettings(updatedSettings);
          onUpdate(updatedSettings);
        }
    } finally {
        setSyncing(false);
    }
  };

  const handleTestDatabase = async () => {
      setDbStatus('TESTING');
      setDbMessage('Attempting to connect to server.php...');
      
      const result = await storageService.forceSync();
      
      if (result.success) {
          setDbStatus('SUCCESS');
          setDbMessage(result.message);
      } else {
          setDbStatus('ERROR');
          setDbMessage(result.message);
      }
  };

  const handleTestWhatsApp = async () => {
    // Save current input state first to ensure service uses latest values
    onUpdate(localSettings);
    
    setWaStatus('TESTING');
    setWaMessage('Validating credentials with Meta Graph API...');

    try {
        const result = await whatsappService.validateCredentials();
        if (result.success) {
            setWaStatus('SUCCESS');
            setWaMessage(result.message);
        } else {
            setWaStatus('ERROR');
            setWaMessage(result.message);
        }
    } catch (e: any) {
        setWaStatus('ERROR');
        setWaMessage(e.message || "Unknown Validation Error");
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-12 animate-fadeIn py-4">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-3xl md:text-4xl font-serif-elite font-black text-slate-900 tracking-tight">Console Configuration</h2>
          <p className="text-slate-500 text-xs mt-2 font-medium">Control institutional pricing logic and automated communication protocols.</p>
        </div>
        <div className="flex gap-3">
          <button 
            disabled={syncing}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-5 py-2.5 rounded-2xl font-bold text-[10px] uppercase tracking-widest transition-all hover:bg-slate-50 disabled:opacity-50 shadow-sm"
            onClick={handleLiveSync}
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} /> 
            Sync Market
          </button>
          <button 
            className="flex items-center gap-2 bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-800 shadow-xl transition-all active:scale-95"
            onClick={() => onUpdate(localSettings)}
          >
            <Save size={16} /> Update Console
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Market Pricing Section */}
        <section className="lg:col-span-8 space-y-8">
          
          {/* DATABASE DIAGNOSTICS */}
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200/60 shadow-sm space-y-6">
             <div className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${dbStatus === 'ERROR' ? 'bg-rose-100 text-rose-600' : dbStatus === 'SUCCESS' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                    <Database size={14} />
                </div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Backend Connection</h3>
             </div>
             
             <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                 <button 
                    onClick={handleTestDatabase}
                    disabled={dbStatus === 'TESTING'}
                    className="shrink-0 bg-slate-100 text-slate-700 hover:bg-slate-200 px-5 py-2.5 rounded-xl font-bold text-[10px] flex items-center gap-2 transition-colors disabled:opacity-50"
                 >
                    {dbStatus === 'TESTING' ? <Loader2 className="animate-spin" size={14}/> : <ServerCrash size={14} />}
                    Test Connection
                 </button>
                 
                 <div className={`flex-1 p-3.5 rounded-xl text-xs font-medium flex items-start gap-3 ${
                     dbStatus === 'SUCCESS' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' :
                     dbStatus === 'ERROR' ? 'bg-rose-50 text-rose-800 border border-rose-100' :
                     'bg-slate-50 text-slate-500'
                 }`}>
                     {dbStatus === 'SUCCESS' && <CheckCircle2 className="shrink-0 text-emerald-600" size={18} />}
                     {dbStatus === 'ERROR' && <AlertTriangle className="shrink-0 text-rose-600" size={18} />}
                     <p>{dbMessage || "Click 'Test Connection' to verify server status."}</p>
                 </div>
             </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200/60 shadow-sm space-y-10 relative overflow-hidden">
             <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600">
                    <Zap size={16} />
                </div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Market Pricing Matrix</h3>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <PricingField 
                    label="24K Purity (/g)" 
                    value={localSettings.currentGoldRate24K} 
                    onChange={v => setLocalSettings({...localSettings, currentGoldRate24K: v})}
                />
                <PricingField 
                    label="22K Standard (/g)" 
                    value={localSettings.currentGoldRate22K} 
                    onChange={v => setLocalSettings({...localSettings, currentGoldRate22K: v})}
                />
             </div>

             <div className="pt-8 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-10">
                <PricingField 
                    label="Policy Tax (GST) %" 
                    value={localSettings.defaultTaxRate} 
                    onChange={v => setLocalSettings({...localSettings, defaultTaxRate: v})}
                />
                <PricingField 
                    label="Rate Protection Cap" 
                    value={localSettings.goldRateProtectionMax} 
                    onChange={v => setLocalSettings({...localSettings, goldRateProtectionMax: v})}
                />
             </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200/60 shadow-sm space-y-8">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600">
                        <Smartphone size={16} />
                    </div>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Communication API (Meta)</h3>
                </div>
                <button 
                    onClick={handleTestWhatsApp}
                    disabled={waStatus === 'TESTING'}
                    className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 transition-all ${
                        waStatus === 'SUCCESS' ? 'bg-emerald-100 text-emerald-700' : 
                        waStatus === 'ERROR' ? 'bg-rose-100 text-rose-700' : 
                        'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                >
                    {waStatus === 'TESTING' ? <Loader2 size={12} className="animate-spin" /> : <Wifi size={12} />}
                    Verify Connection
                </button>
             </div>
             
             {waMessage && (
                 <div className={`p-3 rounded-xl text-xs font-bold border ${waStatus === 'SUCCESS' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800'}`}>
                     {waMessage}
                 </div>
             )}
             
             <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <MetaField label="Phone Number ID" value={localSettings.whatsappPhoneNumberId || ''} onChange={v => setLocalSettings({...localSettings, whatsappPhoneNumberId: v})} placeholder="1016..." />
                    <MetaField label="WABA Account ID" value={localSettings.whatsappBusinessAccountId || ''} onChange={v => setLocalSettings({...localSettings, whatsappBusinessAccountId: v})} placeholder="1056..." />
                </div>
                <div className="relative">
                   <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">System Access Token</label>
                   <input 
                    type="password" 
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-3.5 text-xs font-mono focus:bg-white transition-all outline-none" 
                    value={localSettings.whatsappBusinessToken || ''}
                    onChange={e => setLocalSettings({...localSettings, whatsappBusinessToken: e.target.value})}
                   />
                   <Key size={14} className="absolute right-5 bottom-4 text-slate-300" />
                </div>
             </div>
          </div>
        </section>

        {/* Sidebar Info */}
        <aside className="lg:col-span-4 space-y-6">
            <div className="bg-[#0f172a] text-white p-6 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
               <div className="relative z-10 space-y-6">
                  <ShieldCheck size={32} className="text-amber-500" />
                  <h4 className="text-lg font-bold leading-tight">Institutional Integrity Policy</h4>
                  <p className="text-sm text-slate-400 leading-relaxed font-medium">
                    All rate modifications are logged and applied to new contract generation instantly. Rate protection locks for existing VIP clients remain until the specific contract matures.
                  </p>
               </div>
               <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl group-hover:bg-amber-500/20 transition-all"></div>
            </div>

            <div className="bg-amber-50 border border-amber-100 p-6 rounded-[2.5rem] space-y-4">
               <div className="flex items-center gap-2 text-amber-800 font-black text-xs uppercase tracking-widest">
                  <Info size={14} /> Audit Notice
               </div>
               <p className="text-xs text-amber-900/70 leading-relaxed font-medium">
                  Ensure the **WhatsApp Token** has `whatsapp_business_messaging` and `whatsapp_business_management` permissions active in the Meta Developer Portal.
               </p>
            </div>
        </aside>
      </div>
    </div>
  );
};

const PricingField = ({ label, value, onChange }: { label: string, value: number, onChange: (v: number) => void }) => (
  <div className="space-y-3">
    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">{label}</label>
    <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-[15px]">₹</span>
        <input 
            type="number" 
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 pl-9 text-lg font-black text-slate-800 focus:bg-white transition-all outline-none" 
            value={value}
            onChange={e => onChange(parseFloat(e.target.value) || 0)}
        />
    </div>
  </div>
);

const MetaField = ({ label, value, onChange, placeholder }: any) => (
  <div className="space-y-2">
    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">{label}</label>
    <input 
        type="text" 
        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-3.5 text-xs font-bold focus:bg-white transition-all outline-none" 
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
    />
  </div>
);

export default Settings;
