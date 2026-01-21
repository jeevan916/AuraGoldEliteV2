
import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, Zap, ShieldCheck, Database, ServerCrash, CheckCircle2, AlertTriangle, Loader2, LayoutGrid, Plus, Trash2, Info, Key, Server, Clock, Calendar, MessageSquare, CreditCard, Smartphone, Wrench, Code, Check } from 'lucide-react';
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
  const [rateSource, setRateSource] = useState<string>('');
  
  const [dbStatus, setDbStatus] = useState<'IDLE' | 'TESTING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [dbMessage, setDbMessage] = useState('');
  const [debugInfo, setDebugInfo] = useState<any>(null);
  
  // DB Config Form
  const [dbConfig, setDbConfig] = useState({ host: '127.0.0.1', user: '', password: '', database: '' });
  const [savingDb, setSavingDb] = useState(false);

  // Catalog State
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
            currentGoldRate18K: result.rate18K,
            currentSilverRate: result.silver
          };
          setLocalSettings(updatedSettings);
          setRawRateData(result.raw);
          setRateSource(result.source || 'Unknown');
          onUpdate(updatedSettings);
        } else {
            setRawRateData(result.raw || { error: result.error });
            setRateSource("Fetch Failed");
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
          alert("Failed to save settings: " + (e instanceof Error ? e.message : "Unknown error"));
      } finally {
          setIsSaving(false);
      }
  };

  const handleAddCatalogItem = () => {
      if (!newItem.name || !newItem.makingChargesPerGram) return alert("Name and Charges are required");
      const item: CatalogItem = {
          id: `cat-${Date.now()}`,
          category: newItem.category || 'Ring',
          name: newItem.name,
          metalColor: newItem.metalColor || 'Yellow Gold',
          purity: (newItem.purity || '22K') as any,
          wastagePercentage: newItem.wastagePercentage || 0,
          makingChargesPerGram: newItem.makingChargesPerGram,
          stoneCharges: newItem.stoneCharges || 0
      };
      const updated = [...catalog, item];
      setCatalog(updated);
      storageService.setCatalog(updated);
      setNewItem({ category: 'Ring', metalColor: 'Yellow Gold', purity: '22K', name: '', wastagePercentage: 0, makingChargesPerGram: 0 });
  };

  const handleDeleteCatalogItem = (id: string) => {
      const updated = catalog.filter(c => c.id !== id);
      setCatalog(updated);
      storageService.setCatalog(updated);
  };

  const handleTestDatabase = async () => {
      setDbStatus('TESTING');
      setDbMessage('Diagnosing connection...');
      setDebugInfo(null);
      
      try {
          const result = await storageService.forceSync();
          if (result.success) {
              setDbStatus('SUCCESS');
              setDbMessage(result.message);
          } else {
              setDbStatus('ERROR');
              setDbMessage("Connection Failed. Fetching diagnostics...");
              
              const debugRes = await fetch('/api/debug/db');
              const debugData = await debugRes.json();
              
              setDebugInfo(debugData);
              if (debugData.error) {
                  setDbMessage(`Error: ${debugData.error}`);
                  if(debugData.config) {
                      setDbConfig(prev => ({
                          ...prev,
                          host: debugData.config.host || '127.0.0.1',
                          user: debugData.config.user || '',
                          database: debugData.config.database || ''
                      }));
                  }
              } else {
                  setDbMessage("Unknown Connection Error");
              }
          }
      } catch (e: any) {
          setDbStatus('ERROR');
          setDbMessage(`Network Error: ${e.message}`);
      }
  };

  const handleSaveDbConfig = async () => {
      if(!dbConfig.host || !dbConfig.user || !dbConfig.database) {
          return alert("Please fill Host, User and Database fields.");
      }
      setSavingDb(true);
      try {
          const res = await fetch('/api/debug/configure', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify(dbConfig)
          });
          const data = await res.json();
          if(data.success) {
              setDbStatus('SUCCESS');
              setDbMessage('Credentials Saved & Connected!');
              setDebugInfo(null);
          } else {
              setDbMessage("Failed: " + data.error);
              setDbStatus('ERROR');
          }
      } catch(e: any) {
          setDbMessage("Error: " + e.message);
          setDbStatus('ERROR');
      } finally {
          setSavingDb(false);
      }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fadeIn py-4">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-3xl md:text-4xl font-serif-elite font-black text-slate-900 tracking-tight">System Console</h2>
          <p className="text-slate-500 text-xs mt-2 font-medium">Manage pricing, inventory catalog, and integrations.</p>
        </div>
        <div className="flex gap-3">
             <button 
                onClick={() => setActiveTab('CONFIG')}
                className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'CONFIG' ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-500 hover:bg-slate-100'}`}
             >
                 Configuration
             </button>
             <button 
                onClick={() => setActiveTab('CATALOG')}
                className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'CATALOG' ? 'bg-amber-50 text-white shadow-lg' : 'bg-white text-slate-500 hover:bg-slate-100'}`}
             >
                 <LayoutGrid size={14} /> Catalog
             </button>
        </div>
      </header>

      {activeTab === 'CATALOG' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 bg-white p-6 rounded-[2.5rem] border border-amber-100 shadow-sm h-fit">
                  <h3 className="font-black text-slate-800 text-lg mb-6 flex items-center gap-2">
                      <Plus size={20} className="text-amber-500" /> Add Product
                  </h3>
                  <div className="space-y-4">
                      <div>
                          <label className="text-[10px] font-black uppercase text-slate-400">Category</label>
                          <select 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold"
                            value={newItem.category}
                            onChange={e => setNewItem({...newItem, category: e.target.value})}
                          >
                              {['Ring', 'Necklace', 'Earrings', 'Bangle', 'Bracelet', 'Chain', 'Pendant', 'Set', 'Silverware'].map(c => <option key={c}>{c}</option>)}
                          </select>
                      </div>
                      <div>
                          <label className="text-[10px] font-black uppercase text-slate-400">Product Name</label>
                          <input 
                             className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold"
                             placeholder="Ex: Temple Haram"
                             value={newItem.name || ''}
                             onChange={e => setNewItem({...newItem, name: e.target.value})}
                          />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-black uppercase text-slate-400">Purity</label>
                            <select 
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold"
                                value={newItem.purity}
                                onChange={e => setNewItem({...newItem, purity: e.target.value as any})}
                            >
                                <option>22K</option><option>24K</option><option>18K</option><option>999</option><option>925</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] font-black uppercase text-slate-400">Wastage %</label>
                            <input 
                                type="number"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold"
                                value={newItem.wastagePercentage || ''}
                                onChange={e => setNewItem({...newItem, wastagePercentage: parseFloat(e.target.value)})}
                                placeholder="12"
                            />
                          </div>
                      </div>
                      <div>
                            <label className="text-[10px] font-black uppercase text-slate-400">Making (₹/g)</label>
                            <input 
                                type="number"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold"
                                value={newItem.makingChargesPerGram || ''}
                                onChange={e => setNewItem({...newItem, makingChargesPerGram: parseFloat(e.target.value)})}
                                placeholder="450"
                            />
                      </div>
                      <button 
                        onClick={handleAddCatalogItem}
                        className="w-full bg-amber-500 text-white py-4 rounded-xl font-black uppercase tracking-widest hover:bg-amber-600 transition-all shadow-lg mt-2"
                      >
                          Add to Catalog
                      </button>
                  </div>
              </div>

              <div className="lg:col-span-2 space-y-4">
                  <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100">
                      <h3 className="font-bold text-slate-700">Inventory Catalog ({catalog.length} Items)</h3>
                      <span className="text-xs text-slate-400">Saved to Cloud Database</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {catalog.map(item => (
                          <div key={item.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative group hover:border-amber-200 transition-all">
                              <div className="flex justify-between items-start mb-2">
                                  <div>
                                      <h4 className="font-bold text-slate-800">{item.name}</h4>
                                      <p className="text-xs text-slate-500">{item.category} • {item.purity}</p>
                                  </div>
                                  <button onClick={() => handleDeleteCatalogItem(item.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={16} /></button>
                              </div>
                              <div className="flex gap-2 text-[10px] font-black uppercase text-slate-400 mt-2">
                                  <span className="bg-slate-50 px-2 py-1 rounded border">VA: {item.wastagePercentage}%</span>
                                  <span className="bg-slate-50 px-2 py-1 rounded border">MC: ₹{item.makingChargesPerGram}</span>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'CONFIG' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          <div className="lg:col-span-8 space-y-6">
            
            {/* PRICING ENGINE */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl relative overflow-hidden">
                <div className="flex justify-between items-center mb-8 relative z-10">
                    <div>
                        <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                            <Zap className="text-amber-500" /> Pricing Engine
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 font-medium">Auto-sync with IBJA/Market rates or override manually.</p>
                    </div>
                    <button 
                        onClick={handleLiveSync} 
                        disabled={syncing}
                        className={`bg-slate-900 text-white px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg hover:bg-slate-800 transition-all ${syncing ? 'opacity-80' : ''}`}
                    >
                        {syncing ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                        Fetch Live
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                    <PricingField 
                        label="24K Bullion (99.9)" 
                        value={localSettings.currentGoldRate24K} 
                        onChange={v => setLocalSettings({...localSettings, currentGoldRate24K: v})} 
                    />
                    <PricingField 
                        label="22K Standard (916)" 
                        value={localSettings.currentGoldRate22K} 
                        onChange={v => setLocalSettings({...localSettings, currentGoldRate22K: v})} 
                    />
                    <PricingField 
                        label="18K Studded (750)" 
                        value={localSettings.currentGoldRate18K} 
                        onChange={v => setLocalSettings({...localSettings, currentGoldRate18K: v})} 
                    />
                    <PricingField 
                        label="Silver 999 (1g)" 
                        value={localSettings.currentSilverRate} 
                        onChange={v => setLocalSettings({...localSettings, currentSilverRate: v})} 
                        isSilver
                    />
                </div>

                {rawRateData && (
                    <div className="mt-6 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                        <p className="text-[10px] font-black uppercase text-slate-400 mb-2 flex items-center gap-2">
                            <Info size={12} /> Raw Rate Response (Diagnostic)
                        </p>
                        <div className="font-mono text-[10px] text-slate-600 break-all bg-white p-2 rounded border border-slate-100 max-h-32 overflow-y-auto">
                            <div className="mb-2 pb-2 border-b border-slate-100">
                                <span className="font-bold text-amber-600">Source:</span> {rateSource}
                            </div>
                            {rawRateData.debug && (
                                <div className="mb-2 pb-2 border-b border-slate-100">
                                    <span className="font-bold text-blue-600">Extraction Logic:</span> {rawRateData.debug}
                                </div>
                            )}
                            {rawRateData.snippet && (
                                <div>
                                    <span className="font-bold text-slate-400">Raw XML Snippet:</span> {rawRateData.snippet}
                                </div>
                            )}
                            {rawRateData.error && <span className="text-rose-600 font-bold">{rawRateData.error}</span>}
                        </div>
                    </div>
                )}
            </div>

            {/* INTEGRATIONS */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                    <Server className="text-blue-500" /> API Gateway Configuration
                </h3>
                
                <div className="space-y-6">
                    <div className="p-5 rounded-2xl border border-slate-100 bg-slate-50/50">
                        <div className="flex items-center gap-3 mb-4">
                            <MessageSquare className="text-emerald-600" />
                            <h4 className="font-bold text-slate-700 text-sm">WhatsApp Business API</h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <ConfigInput label="Phone Number ID" value={localSettings.whatsappPhoneNumberId} onChange={v => setLocalSettings({...localSettings, whatsappPhoneNumberId: v})} />
                            <ConfigInput label="WABA ID" value={localSettings.whatsappBusinessAccountId} onChange={v => setLocalSettings({...localSettings, whatsappBusinessAccountId: v})} />
                            <div className="md:col-span-2">
                                <ConfigInput label="Permanent Access Token" value={localSettings.whatsappBusinessToken} onChange={v => setLocalSettings({...localSettings, whatsappBusinessToken: v})} type="password" />
                            </div>
                        </div>
                    </div>

                    <div className="p-5 rounded-2xl border border-slate-100 bg-slate-50/50">
                        <div className="flex items-center gap-3 mb-4">
                            <CreditCard className="text-indigo-600" />
                            <h4 className="font-bold text-slate-700 text-sm">Payment Gateways</h4>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <ConfigInput label="Razorpay Key ID" value={localSettings.razorpayKeyId} onChange={v => setLocalSettings({...localSettings, razorpayKeyId: v})} />
                                <ConfigInput label="Razorpay Secret" value={localSettings.razorpayKeySecret} onChange={v => setLocalSettings({...localSettings, razorpayKeySecret: v})} type="password" />
                            </div>
                            <div className="border-t border-slate-200 pt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                                <ConfigInput label="Setu Client ID" value={localSettings.setuClientId} onChange={v => setLocalSettings({...localSettings, setuClientId: v})} />
                                <ConfigInput label="Setu Secret" value={localSettings.setuSecret} onChange={v => setLocalSettings({...localSettings, setuSecret: v})} type="password" />
                                <ConfigInput label="Scheme ID (Product Instance)" value={localSettings.setuSchemeId} onChange={v => setLocalSettings({...localSettings, setuSchemeId: v})} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
             {/* SAVE BUTTON */}
             <button 
                onClick={handleUpdateSettings} 
                disabled={isSaving}
                className={`w-full py-5 rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl flex items-center justify-center gap-2 transition-all ${saveSuccess ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
             >
                 {isSaving ? <Loader2 className="animate-spin" /> : saveSuccess ? <CheckCircle2 /> : <Save />}
                 {saveSuccess ? 'Saved Successfully' : 'Save Changes'}
             </button>

             {/* DATABASE HEALTH */}
             <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                 <h3 className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2">
                     <Database size={16} className="text-slate-400" /> Database Connection
                 </h3>
                 
                 <div className={`p-4 rounded-xl border mb-4 flex flex-col items-center justify-center text-center gap-2 ${dbStatus === 'SUCCESS' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : dbStatus === 'ERROR' ? 'bg-rose-50 border-rose-100 text-rose-700' : 'bg-slate-50 border-slate-100'}`}>
                     {dbStatus === 'TESTING' ? <Loader2 className="animate-spin" /> : dbStatus === 'SUCCESS' ? <CheckCircle2 /> : dbStatus === 'ERROR' ? <ServerCrash /> : <Database />}
                     <p className="text-xs font-bold">{dbMessage || "Status: Idle"}</p>
                 </div>

                 {dbStatus === 'ERROR' && debugInfo && (
                     <div className="space-y-3 animate-fadeIn">
                         <p className="text-[10px] font-black uppercase text-slate-400">Manual Configuration Override</p>
                         <ConfigInput label="Host" value={dbConfig.host} onChange={v => setDbConfig({...dbConfig, host: v})} />
                         <ConfigInput label="User" value={dbConfig.user} onChange={v => setDbConfig({...dbConfig, user: v})} />
                         <ConfigInput label="Password" value={dbConfig.password} onChange={v => setDbConfig({...dbConfig, password: v})} type="password" />
                         <ConfigInput label="Database Name" value={dbConfig.database} onChange={v => setDbConfig({...dbConfig, database: v})} />
                         <button 
                            onClick={handleSaveDbConfig}
                            disabled={savingDb}
                            className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold text-xs uppercase tracking-widest mt-2"
                         >
                             {savingDb ? 'Connecting...' : 'Update Connection'}
                         </button>
                     </div>
                 )}

                 <button onClick={handleTestDatabase} className="w-full bg-white border border-slate-200 text-slate-600 py-3 rounded-xl font-bold text-xs uppercase hover:bg-slate-50">
                     Test Connection
                 </button>
             </div>

             {/* PROTECTION RULES */}
             <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                 <h3 className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2">
                     <ShieldCheck size={16} className="text-slate-400" /> Protection Rules
                 </h3>
                 <div className="space-y-4">
                     <ConfigInput label="Max Liability Limit (₹/g)" value={localSettings.goldRateProtectionMax} onChange={v => setLocalSettings({...localSettings, goldRateProtectionMax: parseFloat(v)})} type="number" />
                     <ConfigInput label="Grace Period (Hours)" value={localSettings.gracePeriodHours} onChange={v => setLocalSettings({...localSettings, gracePeriodHours: parseFloat(v)})} type="number" />
                     <ConfigInput label="Follow-Up Interval (Days)" value={localSettings.followUpIntervalDays} onChange={v => setLocalSettings({...localSettings, followUpIntervalDays: parseFloat(v)})} type="number" />
                 </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

const PricingField = ({ label, value, onChange, isSilver = false }: any) => (
    <div className="relative group">
        <label className="text-[10px] font-black uppercase text-slate-400 mb-1.5 block tracking-widest ml-1">{label}</label>
        <div className="relative">
            <span className={`absolute left-4 top-1/2 -translate-y-1/2 font-black ${isSilver ? 'text-slate-400' : 'text-amber-500'}`}>₹</span>
            <input 
                type="number" 
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-8 pr-4 font-black text-xl text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-amber-500 transition-all"
                value={value}
                onChange={e => onChange(parseFloat(e.target.value))}
            />
        </div>
    </div>
);

const ConfigInput = ({ label, value, onChange, type = "text" }: any) => (
    <div>
        <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block ml-1">{label}</label>
        <input 
            type={type}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all placeholder:text-slate-300"
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            placeholder="Not Configured"
        />
    </div>
);

export default Settings;
