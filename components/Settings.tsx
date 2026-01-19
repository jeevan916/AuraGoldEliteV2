
import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, Zap, ShieldCheck, Database, ServerCrash, CheckCircle2, AlertTriangle, Loader2, LayoutGrid, Plus, Trash2, Info, Key, Server, Clock, Calendar, MessageSquare, CreditCard, Smartphone, Wrench, Code } from 'lucide-react';
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
  const [rawRateData, setRawRateData] = useState<any>(null);
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
            currentGoldRate22K: result.rate22K
          };
          setLocalSettings(updatedSettings);
          setRawRateData(result.raw);
          onUpdate(updatedSettings);
        } else {
            setRawRateData(result.raw || { error: result.error });
        }
    } finally {
        setSyncing(false);
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
                className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'CATALOG' ? 'bg-amber-500 text-white shadow-lg' : 'bg-white text-slate-500 hover:bg-slate-100'}`}
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
                              {['Ring', 'Necklace', 'Earrings', 'Bangle', 'Bracelet', 'Chain', 'Pendant', 'Set'].map(c => <option key={c}>{c}</option>)}
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
                                <option>22K</option><option>24K</option><option>18K</option>
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
                                      <p className="text-xs text-slate-500">{item.category} • {item.metalColor} • {item.purity}</p>
                                  </div>
                                  <button onClick={() => handleDeleteCatalogItem(item.id)} className="text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={16}/></button>
                              </div>
                              <div className="flex gap-4 mt-3 pt-3 border-t border-slate-50">
                                  <div>
                                      <p className="text-[9px] font-black uppercase text-slate-400">VA %</p>
                                      <p className="font-bold text-slate-700">{item.wastagePercentage}%</p>
                                  </div>
                                  <div>
                                      <p className="text-[9px] font-black uppercase text-slate-400">MC / g</p>
                                      <p className="font-bold text-slate-700">₹{item.makingChargesPerGram}</p>
                                  </div>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'CONFIG' && (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <section className="lg:col-span-8 space-y-8">
          
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200/60 shadow-sm space-y-6">
             <div className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${dbStatus === 'ERROR' ? 'bg-rose-100 text-rose-600' : dbStatus === 'SUCCESS' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                    <Database size={14} />
                </div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Backend Connection</h3>
             </div>
             
             {debugInfo && dbStatus === 'ERROR' && (
                 <div className="bg-slate-900 text-slate-300 p-4 rounded-xl text-xs font-mono overflow-auto border border-slate-800">
                     <p className="text-amber-400 font-bold mb-2">Diagnostic Report:</p>
                     <p>Detected Host: {debugInfo.config?.host}</p>
                     <p>Detected DB: {debugInfo.config?.database}</p>
                     <p>Connected: NO</p>
                     {debugInfo.error && <p className="text-rose-400 mt-2">Error: {debugInfo.error}</p>}
                 </div>
             )}

             <div className="flex flex-col gap-4">
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
                 
                 {/* Self-Healing Form: Only show if error or explicitly testing */}
                 {dbStatus === 'ERROR' && (
                     <div className="mt-4 p-5 bg-slate-50 rounded-2xl border border-slate-200 animate-fadeIn">
                         <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-4 flex items-center gap-2">
                             <Wrench size={14} className="text-amber-500" /> Manual Configuration
                         </h4>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div>
                                 <label className="text-[9px] font-bold text-slate-400 uppercase">DB Host</label>
                                 <input className="w-full p-2 rounded-lg border text-xs font-mono mt-1" value={dbConfig.host} onChange={e => setDbConfig({...dbConfig, host: e.target.value})} />
                             </div>
                             <div>
                                 <label className="text-[9px] font-bold text-slate-400 uppercase">DB User</label>
                                 <input className="w-full p-2 rounded-lg border text-xs font-mono mt-1" value={dbConfig.user} onChange={e => setDbConfig({...dbConfig, user: e.target.value})} />
                             </div>
                             <div>
                                 <label className="text-[9px] font-bold text-slate-400 uppercase">DB Password</label>
                                 <input type="password" className="w-full p-2 rounded-lg border text-xs font-mono mt-1" value={dbConfig.password} onChange={e => setDbConfig({...dbConfig, password: e.target.value})} />
                             </div>
                             <div>
                                 <label className="text-[9px] font-bold text-slate-400 uppercase">DB Name</label>
                                 <input className="w-full p-2 rounded-lg border text-xs font-mono mt-1" value={dbConfig.database} onChange={e => setDbConfig({...dbConfig, database: e.target.value})} />
                             </div>
                         </div>
                         <button 
                            onClick={handleSaveDbConfig}
                            disabled={savingDb}
                            className="mt-4 w-full bg-slate-900 text-white py-3 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                         >
                             {savingDb ? <Loader2 className="animate-spin" size={14}/> : <Save size={14}/>}
                             Save Credentials & Reconnect
                         </button>
                         <p className="text-[9px] text-slate-400 mt-2 text-center">
                             This will update the .env file on your server securely.
                         </p>
                     </div>
                 )}
             </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200/60 shadow-sm space-y-8 relative overflow-hidden">
             
             {/* Pricing Section */}
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600">
                       <Zap size={16} />
                   </div>
                   <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Market Pricing Matrix</h3>
                </div>
                <button 
                    disabled={syncing}
                    className="flex items-center gap-2 bg-slate-100 text-slate-600 px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-slate-200 disabled:opacity-50"
                    onClick={handleLiveSync}
                >
                    <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} /> 
                    Fetch Live
                </button>
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

             {/* Raw Response Diagnostics */}
             {rawRateData && (
                 <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 mt-4 animate-fadeIn">
                     <div className="flex items-center gap-2 mb-4">
                         <Code size={16} className="text-slate-400" />
                         <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Raw Rate Response (Diagnostic)</span>
                     </div>
                     <pre className="text-[11px] font-mono text-slate-600 overflow-auto bg-white p-4 rounded-xl border border-slate-100 max-h-48 custom-scrollbar">
                         {JSON.stringify(rawRateData, null, 2)}
                     </pre>
                     <p className="text-[9px] text-slate-400 mt-2 italic">
                         *Verify 'gSell' value above. Our engine rounds this value for 24K and calculates others based on purity.
                     </p>
                 </div>
             )}
             
             {/* Recovery Strategy Settings */}
             <div className="pt-6 border-t border-slate-100 space-y-6">
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-rose-50 rounded-lg flex items-center justify-center text-rose-600">
                        <AlertTriangle size={16} />
                    </div>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Protection Lapse Strategy</h3>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="space-y-3">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                            <Clock size={12} /> Grace Period (Hours)
                        </label>
                        <div className="relative">
                            <input 
                                type="number" 
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-lg font-black text-slate-800 focus:bg-white transition-all outline-none" 
                                value={localSettings.gracePeriodHours}
                                onChange={e => setLocalSettings({...localSettings, gracePeriodHours: parseInt(e.target.value) || 0})}
                            />
                            <p className="text-[9px] text-slate-400 mt-2 ml-1">Messages sent 5-6 times/day during this period.</p>
                        </div>
                     </div>
                     <div className="space-y-3">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                            <Calendar size={12} /> Follow-up Interval (Days)
                        </label>
                        <div className="relative">
                            <input 
                                type="number" 
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-lg font-black text-slate-800 focus:bg-white transition-all outline-none" 
                                value={localSettings.followUpIntervalDays}
                                onChange={e => setLocalSettings({...localSettings, followUpIntervalDays: parseInt(e.target.value) || 3})}
                            />
                            <p className="text-[9px] text-slate-400 mt-2 ml-1">Frequency of reminders after lapse event.</p>
                        </div>
                     </div>
                 </div>
             </div>

             {/* Integrations Section */}
             <div className="pt-6 border-t border-slate-100 space-y-6">
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                        <Key size={16} />
                    </div>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">API Integrations</h3>
                 </div>
                 
                 {/* WhatsApp Config */}
                 <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                     <h4 className="font-bold text-slate-700 flex items-center gap-2 text-sm">
                        <MessageSquare size={16} className="text-emerald-500" /> WhatsApp Business API (Meta)
                     </h4>
                     <div className="grid grid-cols-1 gap-4">
                         <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Phone Number ID</label>
                            <input 
                                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-mono font-medium outline-none focus:border-blue-500"
                                value={localSettings.whatsappPhoneNumberId || ''}
                                onChange={e => setLocalSettings({...localSettings, whatsappPhoneNumberId: e.target.value})}
                                placeholder="100609..."
                            />
                         </div>
                         <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Business Account ID (WABA)</label>
                            <input 
                                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-mono font-medium outline-none focus:border-blue-500"
                                value={localSettings.whatsappBusinessAccountId || ''}
                                onChange={e => setLocalSettings({...localSettings, whatsappBusinessAccountId: e.target.value})}
                                placeholder="100609..."
                            />
                         </div>
                         <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Permanent Access Token</label>
                            <input 
                                type="password"
                                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-mono font-medium outline-none focus:border-blue-500"
                                value={localSettings.whatsappBusinessToken || ''}
                                onChange={e => setLocalSettings({...localSettings, whatsappBusinessToken: e.target.value})}
                                placeholder="EAAG..."
                            />
                         </div>
                     </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                     {/* Razorpay Config */}
                     <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                         <h4 className="font-bold text-slate-700 flex items-center gap-2 text-sm">
                            <CreditCard size={16} className="text-indigo-500" /> Razorpay
                         </h4>
                         <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Key ID</label>
                            <input 
                                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-mono font-medium outline-none focus:border-indigo-500"
                                value={localSettings.razorpayKeyId || ''}
                                onChange={e => setLocalSettings({...localSettings, razorpayKeyId: e.target.value})}
                                placeholder="rzp_live_..."
                            />
                         </div>
                         <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Key Secret</label>
                            <input 
                                type="password"
                                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-mono font-medium outline-none focus:border-indigo-500"
                                value={localSettings.razorpayKeySecret || ''}
                                onChange={e => setLocalSettings({...localSettings, razorpayKeySecret: e.target.value})}
                                placeholder="Keep secret..."
                            />
                         </div>
                     </div>

                     {/* Msg91 Config */}
                     <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                         <h4 className="font-bold text-slate-700 flex items-center gap-2 text-sm">
                            <Smartphone size={16} className="text-blue-500" /> Msg91 SMS
                         </h4>
                         <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Auth Key</label>
                            <input 
                                type="password"
                                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-mono font-medium outline-none focus:border-blue-500"
                                value={localSettings.msg91AuthKey || ''}
                                onChange={e => setLocalSettings({...localSettings, msg91AuthKey: e.target.value})}
                                placeholder="324..."
                            />
                         </div>
                         <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sender ID</label>
                            <input 
                                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-mono font-medium outline-none focus:border-blue-500"
                                value={localSettings.msg91SenderId || ''}
                                onChange={e => setLocalSettings({...localSettings, msg91SenderId: e.target.value})}
                                placeholder="AURGLD"
                            />
                         </div>
                     </div>

                     {/* Setu UPI Config (UPDATED FOR V2) */}
                     <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                         <h4 className="font-bold text-slate-700 flex items-center gap-2 text-sm">
                            <Zap size={16} className="text-amber-500" /> Setu UPI (V2)
                         </h4>
                         <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Client ID</label>
                            <input 
                                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-mono font-medium outline-none focus:border-amber-500"
                                value={localSettings.setuClientId || ''}
                                onChange={e => setLocalSettings({...localSettings, setuClientId: e.target.value})}
                                placeholder="Client ID from Setu Bridge"
                            />
                         </div>
                         <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Secret</label>
                            <input 
                                type="password"
                                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-mono font-medium outline-none focus:border-amber-500"
                                value={localSettings.setuSecret || ''}
                                onChange={e => setLocalSettings({...localSettings, setuSecret: e.target.value})}
                                placeholder="Client Secret"
                            />
                         </div>
                         <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Product Instance ID</label>
                            <input 
                                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-mono font-medium outline-none focus:border-amber-500"
                                value={localSettings.setuSchemeId || ''}
                                onChange={e => setLocalSettings({...localSettings, setuSchemeId: e.target.value})}
                                placeholder="Product Instance ID (e.g. 6608...)"
                            />
                         </div>
                     </div>
                 </div>
             </div>
          </div>
          
          <div className="flex justify-end pt-4">
               <button 
                className="flex items-center gap-2 bg-emerald-600 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-emerald-700 shadow-xl transition-all active:scale-95 w-full md:w-auto justify-center"
                onClick={() => onUpdate(localSettings)}
              >
                <Save size={16} /> Save Configuration
              </button>
          </div>
        </section>

        <aside className="lg:col-span-4 space-y-6">
            <div className="bg-[#0f172a] text-white p-6 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
               <div className="relative z-10 space-y-6">
                  <ShieldCheck size={32} className="text-amber-500" />
                  <h4 className="text-lg font-bold leading-tight">Institutional Integrity Policy</h4>
                  <p className="text-sm text-slate-400 leading-relaxed font-medium">
                    Protection Lapse logic will automatically switch contracts to current market rates after the grace period ends.
                  </p>
               </div>
               <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl group-hover:bg-amber-500/20 transition-all"></div>
            </div>
        </aside>
      </div>
      )}
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
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 pl-9 text-lg font-black text-slate-800 focus:bg-white transition-all outline-none" 
            value={value}
            onChange={e => onChange(parseFloat(e.target.value) || 0)}
        />
    </div>
  </div>
);

export default Settings;
