
import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, AlertTriangle, Zap, AlertCircle, Smartphone, Key, Building } from 'lucide-react';
import { GlobalSettings } from '../types';
import { goldRateService } from '../services/goldRateService';

interface SettingsProps {
  settings: GlobalSettings;
  onUpdate: (settings: GlobalSettings) => void;
}

const Settings: React.FC<SettingsProps> = ({ settings, onUpdate }) => {
  const [localSettings, setLocalSettings] = useState(settings);
  const [syncing, setSyncing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  // Synchronization: When parent updates settings (e.g. background gold rate fetch), update local state
  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleLiveSync = async () => {
    setSyncing(true);
    setLastError(null);
    try {
        // Force refresh on button click
        const result = await goldRateService.fetchLiveRate(true);
        
        if (result && result.success) {
          const updatedSettings = {
            ...localSettings,
            currentGoldRate24K: result.rate24K,
            currentGoldRate22K: result.rate22K
          };
          setLocalSettings(updatedSettings);
          // Also update parent immediately so other components see it
          onUpdate(updatedSettings);
          alert("Live gold rates updated successfully!");
        } else {
          setLastError(result?.error || "Unknown synchronization error.");
        }
    } catch (e: any) {
        setLastError(`Crash prevented: ${e.message}`);
    } finally {
        setSyncing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Store Configuration</h2>
          <p className="text-slate-500 text-sm">Control pricing logic and live market integration.</p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
           <button 
            disabled={syncing}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-900 text-white px-5 py-3 rounded-xl font-bold text-sm transition-all hover:bg-slate-800 disabled:opacity-50`}
            onClick={handleLiveSync}
          >
            <Zap size={16} className={syncing ? 'animate-pulse text-amber-400' : 'text-amber-400'} /> 
            {syncing ? 'Syncing...' : 'Sync Live Rates'}
          </button>
          <button 
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-amber-600 text-white px-8 py-3 rounded-xl font-bold text-sm hover:bg-amber-700 shadow-lg shadow-amber-100"
            onClick={() => onUpdate(localSettings)}
          >
            <Save size={18} /> Save Changes
          </button>
        </div>
      </div>

      {lastError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-2xl flex items-start gap-3 animate-fadeIn">
          <AlertCircle className="shrink-0 mt-0.5" size={18} />
          <div>
            <p className="font-bold text-sm uppercase tracking-wider">Sync Error</p>
            <p className="text-xs opacity-90">{lastError}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-3xl border shadow-sm space-y-6">
          <h3 className="font-black text-xs text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <RefreshCw size={14} className="text-amber-500" /> Current Gold Rates
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">24K Gold Rate (per gram)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                <input 
                  type="number" 
                  className="w-full border-slate-100 rounded-2xl p-4 pl-10 outline-none ring-2 ring-slate-50 focus:ring-amber-500 font-black text-xl" 
                  value={localSettings.currentGoldRate24K}
                  onChange={e => setLocalSettings({...localSettings, currentGoldRate24K: parseFloat(e.target.value) || 0})}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">22K Gold Rate (per gram)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                <input 
                  type="number" 
                  className="w-full border-slate-100 rounded-2xl p-4 pl-10 outline-none ring-2 ring-slate-50 focus:ring-amber-500 font-black text-xl" 
                  value={localSettings.currentGoldRate22K}
                  onChange={e => setLocalSettings({...localSettings, currentGoldRate22K: parseFloat(e.target.value) || 0})}
                />
              </div>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 font-medium italic">Rates are used for all new order calculations in real-time.</p>
        </div>

        <div className="bg-white p-8 rounded-3xl border shadow-sm space-y-6">
          <h3 className="font-black text-xs text-slate-400 uppercase tracking-widest flex items-center gap-2">
            Business Policy & Tax
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Tax (GST) %</label>
              <input 
                type="number" 
                className="w-full border-slate-100 rounded-2xl p-4 ring-2 ring-slate-50 focus:ring-amber-500 font-black text-xl" 
                value={localSettings.defaultTaxRate}
                onChange={e => setLocalSettings({...localSettings, defaultTaxRate: parseFloat(e.target.value) || 0})}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Rate Protection Cap (₹/g)</label>
              <input 
                type="number" 
                className="w-full border-slate-100 rounded-2xl p-4 ring-2 ring-slate-50 focus:ring-amber-500 font-black text-xl" 
                value={localSettings.goldRateProtectionMax}
                onChange={e => setLocalSettings({...localSettings, goldRateProtectionMax: parseFloat(e.target.value) || 0})}
              />
            </div>
          </div>
        </div>

        {/* New WhatsApp Integration Section */}
        <div className="md:col-span-2 bg-slate-900 text-white p-8 rounded-3xl shadow-xl space-y-6">
          <div className="flex items-center gap-3 mb-2">
             <div className="p-3 bg-emerald-500/20 rounded-xl">
               <Smartphone className="text-emerald-400" />
             </div>
             <div>
               <h3 className="font-black text-lg tracking-tight">WhatsApp Business API</h3>
               <p className="text-xs text-slate-400">Configure Meta credentials for real automated messaging.</p>
             </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2 uppercase flex items-center gap-2">
                Phone Number ID
              </label>
              <input 
                type="text" 
                className="w-full bg-slate-800 border-slate-700 rounded-xl p-4 text-white font-mono text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="e.g. 1016..."
                value={localSettings.whatsappPhoneNumberId || ''}
                onChange={e => setLocalSettings({...localSettings, whatsappPhoneNumberId: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2 uppercase flex items-center gap-2">
                <Building size={12} /> Business Account ID (WABA)
              </label>
              <input 
                type="text" 
                className="w-full bg-slate-800 border-slate-700 rounded-xl p-4 text-white font-mono text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="e.g. 1056..."
                value={localSettings.whatsappBusinessAccountId || ''}
                onChange={e => setLocalSettings({...localSettings, whatsappBusinessAccountId: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2 uppercase flex items-center gap-2">
                <Key size={12} /> Access Token
              </label>
              <input 
                type="password" 
                className="w-full bg-slate-800 border-slate-700 rounded-xl p-4 text-white font-mono text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="Meta Graph API Token"
                value={localSettings.whatsappBusinessToken || ''}
                onChange={e => setLocalSettings({...localSettings, whatsappBusinessToken: e.target.value})}
              />
            </div>
          </div>
          <p className="text-[10px] text-slate-500 italic border-t border-slate-700/50 pt-4 mt-2">
            * These credentials are stored locally in your browser storage. If you clear cache, you must re-enter them.
          </p>
        </div>
      </div>

      <div className="bg-amber-50 border-2 border-amber-100 rounded-3xl p-6 flex gap-4">
        <div className="p-3 bg-white rounded-2xl shadow-sm h-fit">
           <AlertTriangle className="text-amber-600" />
        </div>
        <div>
          <p className="text-amber-900 font-bold mb-1">Impact Disclaimer</p>
          <p className="text-xs text-amber-800 leading-relaxed">
            Changing these rates will instantly update the calculator for all **new orders**. Existing payment plans with "Gold Rate Protection" enabled are locked to the rates at which they were created.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Settings;
