import React, { useState, useEffect } from 'react';
import { 
    Database, ShieldCheck, Download, RefreshCw, Trash2, 
    CheckCircle2, AlertTriangle, Play, Loader2, Clock, FileCode
} from 'lucide-react';

interface BackupRecord {
    id: string;
    filename: string;
    backup_type: 'AUTO' | 'MANUAL' | 'CLONE';
    timestamp: string;
    dbSize: number;
    appSize: number;
}

const BackupSection: React.FC = () => {
    const [backups, setBackups] = useState<BackupRecord[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isActionPending, setIsActionPending] = useState<string | null>(null);
    const [isMock, setIsMock] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [showConfirmRestore, setShowConfirmRestore] = useState<BackupRecord | null>(null);

    const fetchBackups = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const res = await fetch('/api/backups');
            const data = await res.json();
            if (data.success) {
                setBackups(data.backups);
                setIsMock(data.isMock);
            } else {
                setErrorMessage(data.error || "Failed to load backups list.");
            }
        } catch (e: any) {
            setErrorMessage("Network error: Failed to connect to backups API.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchBackups();
    }, []);

    const handleCreateBackup = async (type: 'MANUAL' | 'CLONE') => {
        setIsActionPending(type);
        setErrorMessage(null);
        setSuccessMessage(null);
        try {
            const res = await fetch('/api/backups/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, includeApp: true })
            });
            const data = await res.json();
            if (data.success) {
                setSuccessMessage(`Success: ${type === 'CLONE' ? 'Last Resort Recovery Clone' : 'Manual Backup'} created successfully.`);
                fetchBackups();
            } else {
                setErrorMessage(data.error || "Failed to create backup.");
            }
        } catch (e: any) {
            setErrorMessage("Network error: Failed to create backup.");
        } finally {
            setIsActionPending(null);
        }
    };

    const handleRestoreBackup = async (bkp: BackupRecord) => {
        setIsActionPending(`restore-${bkp.id}`);
        setErrorMessage(null);
        setSuccessMessage(null);
        setShowConfirmRestore(null);
        try {
            const res = await fetch(`/api/backups/restore/${bkp.id}`, {
                method: 'POST'
            });
            const data = await res.json();
            if (data.success) {
                setSuccessMessage(`System Restored Successfully! All database tables rebuilt using backup ${bkp.id}.`);
                // Force reload of main app data after short delay so users see updated tables
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            } else {
                setErrorMessage(data.error || "Restore failed.");
            }
        } catch (e: any) {
            setErrorMessage("Network error: Restore execution failed.");
        } finally {
            setIsActionPending(null);
        }
    };

    const handleDeleteBackup = async (id: string) => {
        if (!confirm("Are you sure you want to permanently delete this backup file from disk?")) return;
        setIsActionPending(`delete-${id}`);
        setErrorMessage(null);
        setSuccessMessage(null);
        try {
            const res = await fetch(`/api/backups/delete/${id}`, {
                method: 'POST'
            });
            const data = await res.json();
            if (data.success) {
                setSuccessMessage("Backup deleted from server.");
                fetchBackups();
            } else {
                setErrorMessage(data.error || "Failed to delete backup.");
            }
        } catch (e: any) {
            setErrorMessage("Network error: Failed to delete backup.");
        } finally {
            setIsActionPending(null);
        }
    };

    const formatBytes = (bytes: number) => {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatDate = (dateStr: string) => {
        try {
            return new Date(dateStr).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return dateStr;
        }
    };

    return (
        <div id="system-backups-panel" className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <Database className="text-indigo-600" /> Backups & System Recovery
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 font-medium">
                        Automatic daily app/DB archives & database clones for ultimate disaster recovery.
                    </p>
                </div>
                <div className="flex items-center gap-2 self-stretch md:self-auto">
                    <button 
                        onClick={fetchBackups}
                        disabled={isLoading}
                        className="p-3 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl text-slate-600 transition-all"
                        title="Refresh Backup List"
                    >
                        <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
                    </button>
                    <button
                        onClick={() => handleCreateBackup('MANUAL')}
                        disabled={!!isActionPending}
                        className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm"
                    >
                        {isActionPending === 'MANUAL' ? <Loader2 className="animate-spin" size={14} /> : <Database size={14} />}
                        Manual Backup
                    </button>
                    <button
                        onClick={() => handleCreateBackup('CLONE')}
                        disabled={!!isActionPending}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm"
                    >
                        {isActionPending === 'CLONE' ? <Loader2 className="animate-spin" size={14} /> : <ShieldCheck size={14} />}
                        Create DB Clone
                    </button>
                </div>
            </div>

            {/* Notification Messages */}
            {errorMessage && (
                <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-start gap-3 text-rose-800 text-xs font-bold animate-fadeIn">
                    <AlertTriangle size={16} className="text-rose-500 mt-0.5 shrink-0" />
                    <div>{errorMessage}</div>
                </div>
            )}
            {successMessage && (
                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-start gap-3 text-emerald-800 text-xs font-bold animate-fadeIn">
                    <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                    <div>{successMessage}</div>
                </div>
            )}

            {/* Last Resort Recovery Information */}
            <div className="bg-slate-50 border border-slate-200/60 p-5 rounded-2xl">
                <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600 shrink-0">
                        <ShieldCheck size={18} />
                    </div>
                    <div className="space-y-1">
                        <h4 className="text-xs font-black text-indigo-900 uppercase tracking-wide">Last Resort Recovery Mechanism</h4>
                        <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                            A **Database Clone** takes a snapshot of your tables and persists it directly inside MySQL's isolated storage layer. 
                            If the app container's local disk is wiped during server redeployments, this clone remains completely safe inside the SQL server. 
                            Simply select a clone below and click **Restore** to reconstruct your databases instantly.
                        </p>
                    </div>
                </div>
            </div>

            {/* Backups List */}
            <div className="border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/30">
                <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                    <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Available Backup Archives (Last 7 Days)</h4>
                    <span className="text-[10px] text-slate-400 font-bold">{backups.length} total</span>
                </div>

                {isLoading && backups.length === 0 ? (
                    <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                        <Loader2 className="animate-spin text-slate-400" size={24} />
                        <span className="text-xs font-bold">Scanning backups storage...</span>
                    </div>
                ) : backups.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">
                        <Database size={32} className="mx-auto mb-2 opacity-40 text-slate-400" />
                        <p className="text-xs font-bold">No backups found. Creating your first automatic backup is pending.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 bg-white">
                        {backups.map((bkp) => {
                            const isDailyAuto = bkp.backup_type === 'AUTO';
                            const isClone = bkp.backup_type === 'CLONE';
                            
                            return (
                                <div key={bkp.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-all">
                                    <div className="flex items-start gap-3">
                                        <div className={`p-2.5 rounded-xl shrink-0 ${isClone ? 'bg-purple-50 text-purple-600 border border-purple-100' : isDailyAuto ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                                            {isClone ? <ShieldCheck size={18} /> : isDailyAuto ? <Clock size={18} /> : <FileCode size={18} />}
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-xs font-bold text-slate-700">{bkp.id}</span>
                                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${isClone ? 'bg-purple-100 text-purple-700' : isDailyAuto ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                                                    {isClone ? 'Last Resort Clone' : isDailyAuto ? 'Auto Daily' : 'Manual'}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-slate-400 font-bold flex items-center gap-1.5">
                                                <span>📅 {formatDate(bkp.timestamp)}</span>
                                                <span>•</span>
                                                <span>💾 DB: {formatBytes(bkp.dbSize)}</span>
                                                {bkp.appSize > 0 && (
                                                    <>
                                                        <span>•</span>
                                                        <span>📦 App: {formatBytes(bkp.appSize)}</span>
                                                    </>
                                                )}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 self-end sm:self-auto">
                                        <a 
                                            href={`/api/backups/download/${bkp.id}`}
                                            className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl transition-all"
                                            title="Download Database JSON"
                                        >
                                            <Download size={14} />
                                        </a>
                                        <button
                                            onClick={() => setShowConfirmRestore(bkp)}
                                            disabled={!!isActionPending}
                                            className="bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-700 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all"
                                            title="Restore Backup"
                                        >
                                            {isActionPending === `restore-${bkp.id}` ? <Loader2 className="animate-spin" size={12} /> : <RefreshCw size={12} />}
                                            Restore
                                        </button>
                                        <button
                                            onClick={() => handleDeleteBackup(bkp.id)}
                                            disabled={!!isActionPending}
                                            className="p-2 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-600 rounded-xl transition-all"
                                            title="Delete Backup File"
                                        >
                                            {isActionPending === `delete-${bkp.id}` ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Confirm Restore Dialog */}
            {showConfirmRestore && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
                    <div className="bg-white rounded-3xl max-w-md w-full border border-slate-100 p-6 shadow-2xl space-y-6">
                        <div className="flex items-center gap-3 text-amber-600">
                            <div className="p-3 bg-amber-50 rounded-2xl">
                                <AlertTriangle size={24} />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-slate-800">Confirm System Restore</h3>
                                <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wide mt-0.5">Disaster Recovery Protocol</p>
                            </div>
                        </div>

                        <div className="space-y-2 text-xs font-medium text-slate-500 leading-relaxed">
                            <p>
                                You are about to restore the system database state to backup <strong className="font-bold text-slate-700">{showConfirmRestore.id}</strong> (created on {formatDate(showConfirmRestore.timestamp)}).
                            </p>
                            <p className="bg-amber-50/50 border border-amber-100 p-3 rounded-xl text-amber-800 font-bold">
                                ⚠️ WARNING: This will drop current data in all tables and overwrite them completely with the data from this backup snapshot. This action cannot be undone.
                            </p>
                        </div>

                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowConfirmRestore(null)}
                                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 font-bold text-xs uppercase tracking-wider hover:bg-slate-50 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleRestoreBackup(showConfirmRestore)}
                                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs uppercase tracking-wider transition-all shadow-md flex items-center gap-2"
                            >
                                <Play size={12} fill="currentColor" />
                                Yes, Execute Restore
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BackupSection;
