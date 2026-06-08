
import React, { useState, useEffect } from 'react';
import { Lock, User, Loader2, ShieldCheck, Database, ServerCrash } from 'lucide-react';
import { AuthUser } from '../types';

interface LoginProps {
    onLogin: (user: AuthUser) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [dbStatus, setDbStatus] = useState<{ isMock: boolean, host: string, status: string } | null>(null);

    useEffect(() => {
        // Fetch DB status on mount
        fetch('/api/debug/db')
            .then(res => res.json())
            .then(data => {
                setDbStatus({
                    isMock: data.config?.isMockMode || false,
                    host: data.config?.host || 'Unknown',
                    status: data.status || 'Unknown'
                });
            })
            .catch(err => console.error("Failed to fetch DB status", err));
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (!res.ok) {
                let errorText = await res.text();
                try {
                    const errorJson = JSON.parse(errorText);
                    setError(errorJson.error || `Server error: ${res.status}`);
                } catch (parseError) {
                    setError(`Server returned ${res.status}: ${errorText.substring(0, 50)}...`);
                }
                setLoading(false);
                return;
            }

            const data = await res.json();

            if (data.success && data.user) {
                // Save to local storage for persistence
                localStorage.setItem('aura_auth', JSON.stringify(data.user));
                onLogin(data.user);
            } else {
                setError(data.error || 'Login failed');
            }
        } catch (e: any) {
            setError(`Connection failed: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
            
            {/* DB Status Banner */}
            {dbStatus && (
                <div className={`max-w-md w-full mb-4 p-4 rounded-2xl flex items-center gap-3 shadow-sm border ${dbStatus.isMock ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
                    <div className={`p-2 rounded-xl ${dbStatus.isMock ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                        {dbStatus.isMock ? <ServerCrash size={20} /> : <Database size={20} />}
                    </div>
                    <div>
                        <h3 className="text-xs font-black uppercase tracking-widest">{dbStatus.isMock ? 'Mock Database Active' : 'Live Database Connected'}</h3>
                        <p className="text-[10px] font-medium opacity-80 mt-0.5">
                            {dbStatus.isMock 
                                ? "Warning: Using temporary memory. Data will be lost on restart." 
                                : `Connected to MySQL at ${dbStatus.host}`}
                        </p>
                    </div>
                </div>
            )}

            <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100">
                <div className="bg-slate-900 p-8 text-center relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20 mx-auto mb-4">
                            <span className="font-serif font-black text-white text-3xl">A</span>
                        </div>
                        <h1 className="font-serif font-bold text-2xl text-white tracking-tight">AuraGold Elite</h1>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Staff Secure Portal</p>
                    </div>
                    {/* Background Decor */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -ml-10 -mb-10"></div>
                </div>

                <div className="p-8">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Username</label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input 
                                    type="text" 
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-12 pr-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-amber-500 transition-all"
                                    placeholder="Enter ID"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input 
                                    type="password" 
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-12 pr-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-amber-500 transition-all"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="bg-rose-50 text-rose-600 px-4 py-3 rounded-xl text-xs font-bold flex items-center gap-2 border border-rose-100">
                                <div className="w-1 h-1 bg-rose-500 rounded-full"></div>
                                {error}
                            </div>
                        )}

                        <button 
                            type="submit" 
                            disabled={loading || !username || !password}
                            className="w-full bg-slate-900 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {loading ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />}
                            Authenticate
                        </button>
                    </form>

                    <div className="mt-8 text-center">
                        <p className="text-[10px] text-slate-400">
                            Authorized personnel only. <br/>Access is monitored and logged.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
