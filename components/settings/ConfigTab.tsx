
import React, { useState } from 'react';
import { 
    Zap, Loader2, RefreshCw, Info, Server, MessageSquare, CreditCard, 
    Save, CheckCircle2, Database, ServerCrash, ShieldCheck, Clock, HardDrive, Share2
} from 'lucide-react';
import { GlobalSettings } from '../../types';
import { goldRateService } from '../../services/goldRateService';
import { storageService } from '../../services/storageService';
import { PricingField, ConfigInput } from './Shared';

interface ConfigTabProps {
    settings: GlobalSettings;
    onUpdate: (newSettings: GlobalSettings) => Promise<void>;
}

const ConfigTab: React.FC<ConfigTabProps> = ({ settings, onUpdate }) => {
    const [localSettings, setLocalSettings] = useState(settings);
    const [syncing, setSyncing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    
    // Diagnostic State
    const [rawRateData, setRawRateData] = useState<any>(null);
    const [rateSource, setRateSource] = useState<string>('');
    const [dbStatus, setDbStatus] = useState<'IDLE' | 'TESTING' | 'SUCCESS' | 'ERROR'>('IDLE');
    const [dbMessage, setDbMessage] = useState('');
    const [debugInfo, setDebugInfo] = useState<any>(null);
    const [dbConfig, setDbConfig] = useState({ host: '127.0.0.1', user: '', password: '', database: '' });
    const [savingDb, setSavingDb] = useState(false);

    const updateLocalStateFromFetch = (result: any) => {
        if (result && result.success) {
            const updated = {
                ...localSettings,
                currentGoldRate24K: result.rate24k || result.rate24K,
                currentGoldRate22K: result.rate22k || result.rate22K,
                currentGoldRate18K: result.rate18k || result.rate18K,
                currentSilverRate: result.silver || result.rateSilver
            };
            setLocalSettings(updated);
            
            const debugRaw = result.raw || {};
            if (result.error) {
                debugRaw.error = result.error;
            }
            
            setRawRateData(debugRaw);
            setRateSource(result.source || 'Unknown');
        } else {
            setRawRateData(result.raw || { error: result.error });
            setRateSource("Fetch Failed");
        }
    };

    const handleLiveSync = async () => {
        setSyncing(true);
        try {
            const result = await goldRateService.fetchLiveRate();
            updateLocalStateFromFetch(result);
        } finally {
            setSyncing(false);
        }
    };

    const handleForceFetch = async (providerId: string) => {
        setSyncing(true);
        try {
            const res = await fetch('/api/rates/force-update', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ providerId })
            });
            const result = await res.json();
            updateLocalStateFromFetch(result);
        } catch (e: any) {
            alert("Force update failed: " + e.message);
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fadeIn">
            <div className="lg:col-span-8 space-y-6">
                
                {/* PRICING ENGINE */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl relative overflow-hidden">
                    <div className="flex justify-between items-center mb-8 relative z-10">
                        <div>
                            <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                <Zap className="text-amber-500" /> Pricing Engine
                            </h3>
                            <p className="text-xs text-slate-500 mt-1 font-medium">Auto-sync with Sagar Jewellers (Live) or override manually.</p>
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10 mb-6">
                        <PricingField label="24K Bullion (99.9)" value={localSettings.currentGoldRate24K} onChange={(v: number) => setLocalSettings({...localSettings, currentGoldRate24K: v})} />
                        <PricingField label="22K Standard (916)" value={localSettings.currentGoldRate22K} onChange={(v: number) => setLocalSettings({...localSettings, currentGoldRate22K: v})} />
                        <PricingField label="18K Studded (750)" value={localSettings.currentGoldRate18K} onChange={(v: number) => setLocalSettings({...localSettings, currentGoldRate18K: v})} />
                        <PricingField label="Silver 999 (1g)" value={localSettings.currentSilverRate} onChange={(v: number) => setLocalSettings({...localSettings, currentSilverRate: v})} isSilver />
                    </div>

                    {/* SOURCE SWITCHING PANEL */}
                    <div className="mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-200 relative z-10">
                        <div className="flex items-center gap-2 mb-3">
                            <Share2 size={14} className="text-blue-500" />
                            <h4 className="text-[10px] font-black uppercase text-slate-600 tracking-widest">Source Diagnostics & Switching</h4>
                        </div>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => handleForceFetch('sagar')}
                                disabled={syncing}
                                className="flex-1 bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:border-amber-400 hover:text-amber-600 transition-all flex items-center justify-center gap-2"
                            >
                                Force Sagar
                            </button>
                            <button 
                                onClick={() => handleForceFetch('batuk')}
                                disabled={syncing}
                                className="flex-1 bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:border-blue-400 hover:text-blue-600 transition-all flex items-center justify-center gap-2"
                            >
                                Force Batuk
                            </button>
                        </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                            <Clock size={14} className="text-slate-400" />
                            <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Background Automation</h4>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <ConfigInput 
                                    label="Server Fetch Interval (Minutes)" 
                                    value={localSettings.goldRateFetchIntervalMinutes} 
                                    onChange={(v: string) => setLocalSettings({...localSettings, goldRateFetchIntervalMinutes: parseInt(v) || 60})} 
                                    type="number" 
                                />
                            </div>
                            
                            {/* Server-Side Persistence Indicator */}
                            <div className="bg-white border border-indigo-100 p-4 rounded-xl flex items-start gap-3 shadow-sm">
                                <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                                    <HardDrive size={18} />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-indigo-900">Always-On Background Persistence</p>
                                    <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                                        The Node.js server runs a background loop (every {localSettings.goldRateFetchIntervalMinutes || 60} mins) to fetch and save rates to the database, 
                                        ensuring 24/7 history <strong>even when the app is closed</strong>.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {rawRateData && (
                        <div className="mt-6 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                            <p className="text-[10px] font-black uppercase text-slate-400 mb-2 flex items-center gap-2">
                                <Info size={12} /> Raw Rate Response (Diagnostic)
                            </p>
                            <div className="font-mono text-[10px] text-slate-600 break-all bg-white p-2 rounded border border-slate-100 max-h-64 overflow-y-auto">
                                <div className="mb-2 pb-2 border-b border-slate-100">
                                    <span className="font-bold text-amber-600">Source:</span> {rateSource}
                                </div>
                                {rawRateData.matchDebug && (
                                    <div className="mb-2 pb-2 border-b border-slate-100">
                                        <span className="font-bold text-blue-600">Parser Logic:</span> {rawRateData.matchDebug}
                                    </div>
                                )}
                                
                                {/* TABLE MAPPING START */}
                                {rawRateData.fullMap ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-100 text-slate-500 border-b border-slate-200">
                                                    <th className="p-2 whitespace-nowrap">Idx</th>
                                                    <th className="p-2 w-full">Column Data (Tab Separated)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {rawRateData.fullMap.map((row: any) => (
                                                    <tr key={row.index} className="hover:bg-slate-50">
                                                        <td className="p-2 font-bold text-slate-400 border-r">{row.index}</td>
                                                        <td className="p-2">
                                                            <div className="flex flex-wrap gap-2">
                                                                {row.cols.map((col: string, cIdx: number) => (
                                                                    <span key={cIdx} className="inline-block px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-700" title={`Column ${cIdx}`}>
                                                                        <span className="text-[8px] text-slate-400 mr-1 font-bold">{cIdx}:</span>
                                                                        {col}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    rawRateData.rawSnippet && <div><span className="font-bold text-slate-400">Snippet:</span> <pre>{rawRateData.rawSnippet}</pre></div>
                                )}
                                {/* TABLE MAPPING END */}

                                {rawRateData.error && <span className="text-rose-600 font-bold block mt-2 border-t pt-2">Error: {rawRateData.error}</span>}
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
                            <div className="flex items-center gap-3 mb-4"><MessageSquare className="text-emerald-600" /><h4 className="font-bold text-slate-700 text-sm">WhatsApp Business API</h4></div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <ConfigInput label="Phone Number ID" value={localSettings.whatsappPhoneNumberId} onChange={(v: string) => setLocalSettings({...localSettings, whatsappPhoneNumberId: v})} />
                                <ConfigInput label="WABA ID" value={localSettings.whatsappBusinessAccountId} onChange={(v: string) => setLocalSettings({...localSettings, whatsappBusinessAccountId: v})} />
                                <div className="md:col-span-2"><ConfigInput label="Permanent Access Token" value={localSettings.whatsappBusinessToken} onChange={(v: string) => setLocalSettings({...localSettings, whatsappBusinessToken: v})} type="password" /></div>
                            </div>
                        </div>
                        <div className="p-5 rounded-2xl border border-slate-100 bg-slate-50/50">
                            <div className="flex items-center gap-3 mb-4"><CreditCard className="text-indigo-600" /><h4 className="font-bold text-slate-700 text-sm">Payment Gateways</h4></div>
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <ConfigInput label="Razorpay Key ID" value={localSettings.razorpayKeyId} onChange={(v: string) => setLocalSettings({...localSettings, razorpayKeyId: v})} />
                                    <ConfigInput label="Razorpay Secret" value={localSettings.razorpayKeySecret} onChange={(v: string) => setLocalSettings({...localSettings, razorpayKeySecret: v})} type="password" />
                                </div>
                                <div className="border-t border-slate-200 pt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <ConfigInput label="Setu Client ID" value={localSettings.setuClientId} onChange={(v: string) => setLocalSettings({...localSettings, setuClientId: v})} />
                                    <ConfigInput label="Setu Secret" value={localSettings.setuSecret} onChange={(v: string) => setLocalSettings({...localSettings, setuSecret: v})} type="password" />
                                    <ConfigInput label="Scheme ID" value={localSettings.setuSchemeId} onChange={(v: string) => setLocalSettings({...localSettings, setuSchemeId: v})} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="lg:col-span-4 space-y-6">
                <button 
                    onClick={handleUpdateSettings} 
                    disabled={isSaving}
                    className={`w-full py-5 rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl flex items-center justify-center gap-2 transition-all ${saveSuccess ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                >
                    {isSaving ? <Loader2 className="animate-spin" /> : saveSuccess ? <CheckCircle2 /> : <Save />}
                    {saveSuccess ? 'Saved Successfully' : 'Save Changes'}
                </button>

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
                            <ConfigInput label="Host" value={dbConfig.host} onChange={(v: string) => setDbConfig({...dbConfig, host: v})} />
                            <ConfigInput label="User" value={dbConfig.user} onChange={(v: string) => setDbConfig({...dbConfig, user: v})} />
                            <ConfigInput label="Password" value={dbConfig.password} onChange={(v: string) => setDbConfig({...dbConfig, password: v})} type="password" />
                            <ConfigInput label="Database Name" value={dbConfig.database} onChange={(v: string) => setDbConfig({...dbConfig, database: v})} />
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

                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                    <h3 className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2">
                        <ShieldCheck size={16} className="text-slate-400" /> Protection Rules
                    </h3>
                    <div className="space-y-4">
                        <ConfigInput label="Max Liability Limit (₹/g)" value={localSettings.goldRateProtectionMax} onChange={(v: string) => setLocalSettings({...localSettings, goldRateProtectionMax: parseFloat(v)})} type="number" />
                        <ConfigInput label="Grace Period (Hours)" value={localSettings.gracePeriodHours} onChange={(v: string) => setLocalSettings({...localSettings, gracePeriodHours: parseFloat(v)})} type="number" />
                        <ConfigInput label="Follow-Up Interval (Days)" value={localSettings.followUpIntervalDays} onChange={(v: string) => setLocalSettings({...localSettings, followUpIntervalDays: parseFloat(v)})} type="number" />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfigTab;
