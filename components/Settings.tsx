
import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, Zap, ShieldCheck, Database, ServerCrash, CheckCircle2, AlertTriangle, Loader2, LayoutGrid, Plus, Trash2, Info, Key, Server, Clock, Calendar, MessageSquare, CreditCard, Smartphone, Wrench, Code, Check, Globe } from 'lucide-react';
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
  
  const [dbStatus, setDbStatus] = useState<'IDLE' | 'TESTING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [dbMessage, setDbMessage] = useState('');
  
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

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fadeIn py-4">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-3xl md:text-4xl font-serif-elite font-black text-slate-900 tracking-tight">System Console</h2>
          <p className="text-slate-500 text-xs mt-2 font-medium">Control bullion rates, catalog items, and API gateways.</p>
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
                            <label className="text-[10px] font-black uppercase text-slate-400">VA %</label>
                            <input 
                                type="number"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold"
                                value={newItem.wastagePercentage || ''}
                                onChange={e => setNewItem({...newItem, wastagePercentage: parseFloat(e.target.value)})}
                                placeholder="12"
                            />
                          </div>
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
                      <span className="text-xs text-slate-400">Saved to MySQL Database</span>
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
          
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200/60 shadow-sm space-y-8 relative overflow-hidden">
             
             {/* Pricing Section */}
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600">
                       <Zap size={16} />
                   </div>
                   <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Market Rate Configuration</h3>
                </div>
                <button 
                    disabled={syncing}
                    className="flex items-center gap-2 bg-slate-100 text-slate-600 px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-slate-200 disabled:opacity-50"
                    onClick={handleLiveSync}
                >
                    <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} /> 
                    Sync Live
                </button>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <PricingField label="Gold 24K (/g)" value={localSettings.currentGoldRate24K} onChange={v => setLocalSettings({...localSettings, currentGoldRate24K: v})} />
                <PricingField label="Gold 22K (/g)" value={localSettings.currentGoldRate22K} onChange={v => setLocalSettings({...localSettings, currentGoldRate22K: v})} />
                <PricingField label="Gold 18K (/g)" value={localSettings.currentGoldRate18K} onChange={v => setLocalSettings({...localSettings, currentGoldRate18K: v})} />
                <PricingField label="Silver 999 (/g)" value={localSettings.currentSilverRate} onChange={v => setLocalSettings({...localSettings, currentSilverRate: v})} />
                <PricingField label="Default Tax Rate (%)" value={localSettings.defaultTaxRate} onChange={v => setLocalSettings({...localSettings, defaultTaxRate: v})} />
                <PricingField label="Fetch Interval (Mins)" value={localSettings.goldRateFetchIntervalMinutes} onChange={v => setLocalSettings({...localSettings, goldRateFetchIntervalMinutes: v})} />
             </div>
             
             {/* Recovery Strategy Settings */}
             <div className="pt-6 border-t border-slate-100 space-y-6">
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-rose-50 rounded-lg flex items-center justify-center text-rose-600">
                        <AlertTriangle size={16} />
                    </div>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Recovery & Protection Strategy</h3>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <PricingField label="Protection Limit Max (+₹)" value={localSettings.goldRateProtectionMax} onChange={v => setLocalSettings({...localSettings, goldRateProtectionMax: v})} />
                    <PricingField label="Grace Period (Hours)" value={localSettings.gracePeriodHours} onChange={v => setLocalSettings({...localSettings, gracePeriodHours: v})} />
                 </div>
             </div>

             {/* API INTEGRATION HUB */}
             <div className="pt-10 border-t border-slate-100 space-y-8">
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                        <Globe size={16} />
                    </div>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">API Integration Hub</h3>
                 </div>
                 
                 <div className="grid grid-cols-1 gap-6">
                    {/* WhatsApp */}
                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 relative group">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                <MessageSquare size={18} className="text-emerald-500" /> WhatsApp Business (Meta)
                            </h4>
                            <IntegrationStatus configured={!!localSettings.whatsappBusinessToken} />
                        </div>
                        <div className="space-y-4">
                            <IntegrationInput label="Phone Number ID" value={localSettings.whatsappPhoneNumberId} onChange={v => setLocalSettings({...localSettings, whatsappPhoneNumberId: v})} />
                            <IntegrationInput label="Business Account ID" value={localSettings.whatsappBusinessAccountId} onChange={v => setLocalSettings({...localSettings, whatsappBusinessAccountId: v})} />
                            <IntegrationInput label="Permanent Access Token" value={localSettings.whatsappBusinessToken} onChange={v => setLocalSettings({...localSettings, whatsappBusinessToken: v})} type="password" />
                        </div>
                    </div>

                    {/* Razorpay */}
                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 relative group">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                <CreditCard size={18} className="text-indigo-500" /> Razorpay Gateway
                            </h4>
                            <IntegrationStatus configured={!!localSettings.razorpayKeyId} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <IntegrationInput label="Key ID" value={localSettings.razorpayKeyId} onChange={v => setLocalSettings({...localSettings, razorpayKeyId: v})} />
                            <IntegrationInput label="Key Secret" value={localSettings.razorpayKeySecret} onChange={v => setLocalSettings({...localSettings, razorpayKeySecret: v})} type="password" />
                        </div>
                    </div>

                    {/* Setu */}
                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 relative group">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                <Zap size={18} className="text-amber-500" /> Setu UPI DeepLink
                            </h4>
                            <IntegrationStatus configured={!!localSettings.setuClientId} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <IntegrationInput label="Client ID" value={localSettings.setuClientId} onChange={v => setLocalSettings({...localSettings, setuClientId: v})} />
                            <IntegrationInput label="Product Instance ID (Scheme)" value={localSettings.setuSchemeId} onChange={v => setLocalSettings({...localSettings, setuSchemeId: v})} />
                            <div className="md:col-span-2">
                                <IntegrationInput label="Client Secret" value={localSettings.setuSecret} onChange={v => setLocalSettings({...localSettings, setuSecret: v})} type="password" />
                            </div>
                        </div>
                    </div>

                    {/* Msg91 */}
                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 relative group">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                <Smartphone size={18} className="text-blue-500" /> Msg91 SMS Service
                            </h4>
                            <IntegrationStatus configured={!!localSettings.msg91AuthKey} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <IntegrationInput label="Auth Key" value={localSettings.msg91AuthKey} onChange={v => setLocalSettings({...localSettings, msg91AuthKey: v})} />
                            <IntegrationInput label="Sender ID" value={localSettings.msg91SenderId} onChange={v => setLocalSettings({...localSettings, msg91SenderId: v})} placeholder="AURGLD" />
                        </div>
                    </div>
                 </div>
             </div>
          </div>
          
          <div className="flex justify-end pt-4 pb-20">
               <button 
                disabled={isSaving}
                className={`flex items-center gap-2 px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95 w-full md:w-auto justify-center ${saveSuccess ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-900 text-white hover:bg-black'}`}
                onClick={handleUpdateSettings}
              >
                {isSaving ? (
                    <><Loader2 className="animate-spin" size={16} /> Saving Configuration...</>
                ) : saveSuccess ? (
                    <><Check size={16} /> Configuration Saved</>
                ) : (
                    <><Save size={16} /> Commit All Changes</>
                )}
              </button>
          </div>
        </section>

        <aside className="lg:col-span-4 space-y-6">
            <div className="bg-slate-900 text-white p-8 rounded-[3rem] shadow-2xl relative overflow-hidden group">
               <div className="relative z-10 space-y-6">
                  <ShieldCheck size={40} className="text-amber-500" />
                  <h4 className="text-xl font-bold leading-tight">Institutional Integrity Policy</h4>
                  <p className="text-sm text-slate-400 leading-relaxed font-medium">
                    Automated debt recovery triggers depend on valid API configurations. Ensure WhatsApp and Setu keys are rotated every 90 days.
                  </p>
                  <div className="pt-4 flex flex-col gap-2">
                      <p className="text-[10px] font-black uppercase text-amber-500 tracking-widest">Billing Requirements</p>
                      <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:underline flex items-center gap-1">
                          API Billing Docs <Globe size={10} />
                      </a>
                  </div>
               </div>
               <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl group-hover:bg-amber-500/20 transition-all"></div>
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
        {!label.includes('%') && !label.includes('Mins') && !label.includes('Hours') && <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-[15px]">₹</span>}
        <input 
            type="number" 
            className={`w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-lg font-black text-slate-800 focus:bg-white transition-all outline-none ${(!label.includes('%') && !label.includes('Mins') && !label.includes('Hours')) ? 'pl-9' : 'pl-4'}`} 
            value={value}
            onChange={e => onChange(parseFloat(e.target.value) || 0)}
        />
    </div>
  </div>
);

const IntegrationInput = ({ label, value, onChange, type = 'text', placeholder = '' }: { label: string, value?: string, onChange: (v: string) => void, type?: string, placeholder?: string }) => (
    <div className="space-y-1">
        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
        <input 
            type={type}
            className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-mono font-medium outline-none focus:border-blue-500 transition-colors"
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder || `Enter ${label}...`}
        />
    </div>
);

const IntegrationStatus = ({ configured }: { configured: boolean }) => (
    <div className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider flex items-center gap-1 ${configured ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
        {configured ? <Check size={8}/> : <AlertTriangle size={8}/>}
        {configured ? 'Configured' : 'Missing'}
    </div>
);

export default Settings;
