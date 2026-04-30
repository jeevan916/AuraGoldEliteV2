import React, { useState, useEffect } from 'react';
import { Activity, RefreshCw, ScrollText } from 'lucide-react';

interface WebhookLog {
    id: number;
    provider: string;
    event_type: string;
    payload: any;
    created_at: string;
}

const WebhookLogs = () => {
    const [logs, setLogs] = useState<WebhookLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchLogs = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/logs/webhooks');
            if (!res.ok) throw new Error("Failed to fetch");
            const data = await res.json();
            if (data.success) {
                setLogs(data.logs || []);
            } else {
                setError(data.error);
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 30000); // Poll every 30 seconds
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="max-w-7xl mx-auto space-y-6 h-[calc(100vh-140px)] flex flex-col py-4">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 shrink-0">
                <div>
                    <h2 className="text-3xl md:text-4xl font-serif-elite font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <Activity className="text-indigo-600" size={32} />
                        Webhook Analytics
                    </h2>
                    <p className="text-slate-500 text-xs mt-2 font-medium">Real-time listening for Setu UPI and external events.</p>
                </div>
                <button 
                    onClick={fetchLogs} 
                    className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-colors"
                    disabled={loading}
                >
                    <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                    Refresh
                </button>
            </header>

            {error && (
                <div className="bg-rose-50 text-rose-600 p-4 rounded-xl text-xs font-bold">
                    Error loading webhooks: {error}
                </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                {logs.length === 0 && !loading && (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed rounded-3xl bg-slate-50/50 py-20">
                        <ScrollText size={48} className="mb-4 text-slate-200" />
                        <p className="font-black uppercase tracking-widest text-sm">No Webhooks Received</p>
                        <p className="text-xs mt-2">Listening for incoming connections...</p>
                    </div>
                )}

                {logs.map((log) => (
                    <div key={log.id} className="bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col">
                        <div className="bg-slate-50 p-4 border-b flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                                    {log.provider}
                                </span>
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                    log.event_type.includes('SUCCESS') ? 'bg-emerald-100 text-emerald-700' : 
                                    log.event_type.includes('FAIL') ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-700'
                                }`}>
                                    {log.event_type}
                                </span>
                            </div>
                            <span className="text-[10px] font-bold text-slate-400">
                                {new Date(log.created_at).toLocaleString()}
                            </span>
                        </div>
                        <div className="p-4 bg-slate-900 text-slate-300 font-mono text-xs overflow-x-auto">
                            <pre>{JSON.stringify(log.payload, null, 2)}</pre>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default WebhookLogs;
