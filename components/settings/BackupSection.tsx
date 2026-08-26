import React, { useState, useEffect } from 'react';
import { 
    Database, ShieldCheck, Download, RefreshCw, Trash2, 
    CheckCircle2, AlertTriangle, Play, Loader2, Clock, FileCode,
    History, Eye, EyeOff, CornerUpLeft, Server, HardDrive, ShieldAlert, Check
} from 'lucide-react';

interface BackupRecord {
    id: string;
    filename: string;
    backup_type: 'AUTO' | 'MANUAL' | 'CLONE';
    timestamp: string;
    dbSize: number;
    appSize: number;
}

interface JournalEntry {
    id: string;
    entity_type: string;
    entity_id: string;
    action: string;
    payload: string;
    checksum: string;
    timestamp: string;
}

interface JournalStats {
    dbCount: number;
    diskSize: number;
    lastTimestamp: string | null;
    syncStatus: string;
    redundancy: string;
}

const BackupSection: React.FC = () => {
    // Archives state
    const [backups, setBackups] = useState<BackupRecord[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isActionPending, setIsActionPending] = useState<string | null>(null);
    const [isMock, setIsMock] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [showConfirmRestore, setShowConfirmRestore] = useState<BackupRecord | null>(null);

    // Ledger state
    const [activeTab, setActiveTab] = useState<'archives' | 'ledger'>('archives');
    const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
    const [journalStats, setJournalStats] = useState<JournalStats | null>(null);
    const [isJournalLoading, setIsJournalLoading] = useState(false);
    const [expandedJournalId, setExpandedJournalId] = useState<string | null>(null);
    const [verificationResult, setVerificationResult] = useState<{
        status: string;
        totalScanned: number;
        verifiedCount: number;
        corruptedCount: number;
        success: boolean;
    } | null>(null);
    const [isVerifying, setIsVerifying] = useState(false);
    const [showConfirmRevert, setShowConfirmRevert] = useState<JournalEntry | null>(null);
    const [filterEntity, setFilterEntity] = useState<string>('ALL');

    const getAuthHeaders = (extra: Record<string, string> = {}) => {
        const headers: Record<string, string> = { ...extra };
        try {
            const authStr = localStorage.getItem('aura_auth');
            if (authStr) {
                const user = JSON.parse(authStr);
                if (user && user.token) {
                    headers['Authorization'] = `Bearer ${user.token}`;
                }
            }
        } catch (e) {}
        return headers;
    };

    const getAuthToken = () => {
        try {
            const authStr = localStorage.getItem('aura_auth');
            if (authStr) {
                const user = JSON.parse(authStr);
                return user?.token || '';
            }
        } catch (e) {}
        return '';
    };

    const fetchBackups = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const token = getAuthToken();
            if (!token) {
                setErrorMessage("Authentication required. Please log in as an administrator to manage backups.");
                setIsLoading(false);
                return;
            }
            const res = await fetch('/api/backups', {
                headers: getAuthHeaders()
            });
            const data = await res.json();
            if (data.success) {
                setBackups(data.backups || []);
                setIsMock(data.isMock || false);
            } else {
                setErrorMessage(data.error || "Failed to load backups list.");
            }
        } catch (e: any) {
            setErrorMessage("Network error: Failed to connect to backups API.");
        } finally {
            setIsLoading(false);
        }
    };

    const fetchJournal = async () => {
        setIsJournalLoading(true);
        try {
            const token = getAuthToken();
            if (!token) return;

            // Fetch entries
            const entriesRes = await fetch('/api/journal', {
                headers: getAuthHeaders()
            });
            const entriesData = await entriesRes.json();
            if (entriesData.success) {
                setJournalEntries(entriesData.entries || []);
            }

            // Fetch stats
            const statsRes = await fetch('/api/journal/stats', {
                headers: getAuthHeaders()
            });
            const statsData = await statsRes.json();
            if (statsData.success) {
                setJournalStats(statsData);
            }
        } catch (e: any) {
            console.error("Failed to load live journal entries:", e);
        } finally {
            setIsJournalLoading(false);
        }
    };

    useEffect(() => {
        fetchBackups();
        fetchJournal();
    }, []);

    const handleCreateBackup = async (type: 'MANUAL' | 'CLONE') => {
        setIsActionPending(type);
        setErrorMessage(null);
        setSuccessMessage(null);
        try {
            const res = await fetch('/api/backups/create', {
                method: 'POST',
                headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ type, includeApp: true })
            });
            if (res.status === 401) {
                setErrorMessage("Authentication required. Please log in as an administrator.");
                return;
            }
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
                method: 'POST',
                headers: getAuthHeaders()
            });
            if (res.status === 401) {
                setErrorMessage("Authentication required. Please log in as an administrator.");
                return;
            }
            const data = await res.json();
            if (data.success) {
                setSuccessMessage(`System Restored Successfully! All database tables rebuilt using backup ${bkp.id}.`);
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
                method: 'POST',
                headers: getAuthHeaders()
            });
            if (res.status === 401) {
                setErrorMessage("Authentication required. Please log in as an administrator.");
                return;
            }
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

    const handleVerifyJournal = async () => {
        setIsVerifying(true);
        setErrorMessage(null);
        setSuccessMessage(null);
        try {
            const res = await fetch('/api/journal/verify', {
                headers: getAuthHeaders()
            });
            if (res.status === 401) {
                setErrorMessage("Authentication required. Please log in as an administrator to run cryptographic audits.");
                return;
            }
            const data = await res.json();
            if (data.success) {
                setVerificationResult(data);
                if (data.status === 'PRISTINE') {
                    if (data.totalScanned === 0) {
                        setSuccessMessage("Cryptographic Audit Trail Verified: Ledger is pristine (0 transactions recorded). Dual-layer mirroring active.");
                    } else {
                        setSuccessMessage(`Cryptographic Audit Trail Verified: All ${data.verifiedCount} historical transactions matched their digital signatures perfectly!`);
                    }
                } else {
                    setErrorMessage(`Warning: Detected ${data.corruptedCount} altered or corrupted journal entries in active memory.`);
                }
            } else {
                setErrorMessage(data.error || "Cryptographic verification protocol could not be completed.");
            }
        } catch (e: any) {
            setErrorMessage("Network error during cryptographic validation.");
        } finally {
            setIsVerifying(false);
        }
    };

    const handleRevertJournal = async (entry: JournalEntry) => {
        setIsActionPending(`revert-${entry.id}`);
        setErrorMessage(null);
        setSuccessMessage(null);
        setShowConfirmRevert(null);
        try {
            const res = await fetch(`/api/journal/revert/${entry.id}`, {
                method: 'POST',
                headers: getAuthHeaders()
            });
            if (res.status === 401) {
                setErrorMessage("Authentication required. Please log in as an administrator.");
                return;
            }
            const data = await res.json();
            if (data.success) {
                setSuccessMessage(`State Restored Successfully! ${entry.entity_type} state rolled back to transaction state ${entry.id}.`);
                fetchJournal();
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            } else {
                setErrorMessage(data.error || "State reversion protocol failed.");
            }
        } catch (e: any) {
            setErrorMessage("Network error during state reversion execution.");
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
                minute: '2-digit',
                second: '2-digit'
            });
        } catch (e) {
            return dateStr;
        }
    };

    const filteredEntries = filterEntity === 'ALL' 
        ? journalEntries 
        : journalEntries.filter(entry => entry.entity_type === filterEntity);

    return (
        <div id="system-backups-panel" className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
            
            {/* Main Tabs Navigation */}
            <div className="flex border-b border-slate-100 pb-3 justify-between items-center gap-4 flex-wrap">
                <div className="flex gap-2">
                    <button
                        onClick={() => { setActiveTab('archives'); setErrorMessage(null); setSuccessMessage(null); }}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'archives' ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                    >
                        <Database size={14} />
                        Daily Backup Archives
                    </button>
                    <button
                        onClick={() => { setActiveTab('ledger'); setErrorMessage(null); setSuccessMessage(null); }}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'ledger' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-indigo-50/60 text-indigo-700 hover:bg-indigo-50'}`}
                    >
                        <History size={14} />
                        Live Transaction Mirror & Ledger (PITR)
                    </button>
                </div>
                <div className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wide bg-slate-50 border border-slate-100 px-3 py-1 rounded-lg">
                    Bank-Grade Data Replication Enabled
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

            {activeTab === 'archives' ? (
                // ------------------ TAB 1: ARCHIVES & SYSTEM RECOVERY ------------------
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
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
                                                    href={`/api/backups/download/${bkp.id}?auth_token=${encodeURIComponent(getAuthToken())}`}
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
                </div>
            ) : (
                // ------------------ TAB 2: LIVE TRANSACTION JOURNAL LEDGER & PITR ------------------
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h3 className="text-lg font-black text-indigo-950 flex items-center gap-2">
                                <History className="text-indigo-600" /> Live Transaction Mirror & Ledger
                            </h3>
                            <p className="text-xs text-slate-500 mt-1 font-medium">
                                Bank-grade replication: Every record is mirrored cryptographically to an append-only relational ledger and a separate disk file journal.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 self-stretch md:self-auto">
                            <button 
                                onClick={fetchJournal}
                                disabled={isJournalLoading}
                                className="p-3 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl text-slate-600 transition-all"
                                title="Refresh Ledger"
                            >
                                <RefreshCw size={16} className={isJournalLoading ? "animate-spin" : ""} />
                            </button>
                            <button
                                onClick={handleVerifyJournal}
                                disabled={isVerifying}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm"
                            >
                                {isVerifying ? <Loader2 className="animate-spin" size={14} /> : <ShieldCheck size={14} />}
                                Verify Ledger Signatures
                            </button>
                            <a
                                href={`/api/journal/download?auth_token=${encodeURIComponent(getAuthToken())}`}
                                className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm text-center"
                                title="Download live_journal_mirror.log"
                            >
                                <Download size={14} />
                                Export Log File
                            </a>
                        </div>
                    </div>

                    {/* Dual-layer Health Metrics Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-emerald-50/40 border border-emerald-100 p-4 rounded-2xl flex items-center gap-3">
                            <div className="p-2.5 bg-emerald-100 rounded-xl text-emerald-700">
                                <Server size={18} />
                            </div>
                            <div>
                                <h5 className="text-[10px] font-black uppercase text-slate-500 tracking-wider">SQL Mirror Ledger</h5>
                                <p className="text-xs font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                                    <CheckCircle2 size={12} className="text-emerald-600" /> Active ({journalStats?.dbCount || 0} entries)
                                </p>
                            </div>
                        </div>

                        <div className="bg-emerald-50/40 border border-emerald-100 p-4 rounded-2xl flex items-center gap-3">
                            <div className="p-2.5 bg-emerald-100 rounded-xl text-emerald-700">
                                <HardDrive size={18} />
                            </div>
                            <div>
                                <h5 className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Disk Journal Mirror</h5>
                                <p className="text-xs font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                                    <CheckCircle2 size={12} className="text-emerald-600" /> Dual-Layer Redundant ({formatBytes(journalStats?.diskSize || 0)})
                                </p>
                            </div>
                        </div>

                        <div className="bg-indigo-50/40 border border-indigo-100 p-4 rounded-2xl flex items-center gap-3">
                            <div className="p-2.5 bg-indigo-100 rounded-xl text-indigo-700">
                                <ShieldCheck size={18} />
                            </div>
                            <div>
                                <h5 className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Audit Signature Status</h5>
                                <p className="text-xs font-bold text-slate-800 mt-0.5">
                                    SHA256 Cryptography
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Cryptographic Verification Result */}
                    {verificationResult && (
                        <div className={`p-5 rounded-2xl border ${verificationResult.status === 'PRISTINE' ? 'bg-emerald-50/60 border-emerald-100 text-emerald-900' : 'bg-rose-50/60 border-rose-100 text-rose-900'}`}>
                            <div className="flex items-start gap-3">
                                {verificationResult.status === 'PRISTINE' ? (
                                    <ShieldCheck size={20} className="text-emerald-600 shrink-0 mt-0.5" />
                                ) : (
                                    <ShieldAlert size={20} className="text-rose-600 shrink-0 mt-0.5" />
                                )}
                                <div className="space-y-1.5 w-full">
                                    <h4 className="text-xs font-black uppercase tracking-wide">
                                        CRYPTOGRAPHIC AUDIT COMPLETED: {verificationResult.status}
                                    </h4>
                                    <p className="text-[11px] font-medium leading-relaxed opacity-90">
                                        {verificationResult.status === 'PRISTINE' 
                                            ? `All scanned historical entries have been parsed and re-hashed. Every entry's cryptographic signature matches the computed data payload hash exactly. No unauthorized modifications detected.` 
                                            : `Warning! Audit found mismatches on historical signatures! This is an indication of potential raw data tampering outside authorized pathways.`
                                        }
                                    </p>
                                    <div className="flex justify-between items-center text-[10px] font-black bg-white/40 border border-current/10 p-2.5 rounded-xl w-full">
                                        <span>Total Records Scanned: {verificationResult.totalScanned}</span>
                                        <span>Verified Pristine: {verificationResult.verifiedCount}</span>
                                        <span className={verificationResult.corruptedCount > 0 ? "text-rose-700" : ""}>Mismatches: {verificationResult.corruptedCount}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Live Ledger Filter Control */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black uppercase text-slate-400">Entity filter:</span>
                            {['ALL', 'ORDER', 'CUSTOMER', 'SETTINGS'].map((ent) => (
                                <button
                                    key={ent}
                                    onClick={() => setFilterEntity(ent)}
                                    className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${filterEntity === ent ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                                >
                                    {ent}
                                </button>
                            ))}
                        </div>
                        <span className="text-[10px] text-slate-400 font-extrabold">{filteredEntries.length} entries shown</span>
                    </div>

                    {/* Chronological Ledger Table */}
                    <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-sm divide-y divide-slate-100">
                        {isJournalLoading && filteredEntries.length === 0 ? (
                            <div className="p-16 flex flex-col items-center justify-center text-slate-400 gap-2">
                                <Loader2 className="animate-spin text-indigo-600" size={24} />
                                <span className="text-xs font-bold">Parsing immutable transaction logs...</span>
                            </div>
                        ) : filteredEntries.length === 0 ? (
                            <div className="p-16 text-center text-slate-400">
                                <History size={36} className="mx-auto mb-2 opacity-30 text-indigo-600" />
                                <p className="text-xs font-bold">No historical entries match this filter.</p>
                            </div>
                        ) : (
                            filteredEntries.map((entry) => {
                                const isExpanded = expandedJournalId === entry.id;
                                const isOrder = entry.entity_type === 'ORDER';
                                const isCustomer = entry.entity_type === 'CUSTOMER';
                                const isSettings = entry.entity_type === 'SETTINGS';

                                return (
                                    <div key={entry.id} className={`transition-all hover:bg-slate-50/40 ${isExpanded ? 'bg-indigo-50/10' : ''}`}>
                                        <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                                            <div className="flex items-start gap-3">
                                                <div className={`p-2 rounded-xl shrink-0 ${isOrder ? 'bg-blue-50 text-blue-600' : isCustomer ? 'bg-emerald-50 text-emerald-600' : 'bg-purple-50 text-purple-600'}`}>
                                                    <FileCode size={16} />
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-mono font-bold text-slate-700">{entry.id}</span>
                                                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${isOrder ? 'bg-blue-100 text-blue-800' : isCustomer ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'}`}>
                                                            {entry.entity_type}
                                                        </span>
                                                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[8px] font-black uppercase tracking-wider">
                                                            {entry.action}
                                                        </span>
                                                    </div>
                                                    <p className="text-[10px] text-slate-400 font-bold flex items-center gap-1.5">
                                                        <span>📅 {formatDate(entry.timestamp)}</span>
                                                        <span>•</span>
                                                        <span>IDRef: {entry.entity_id}</span>
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 self-end sm:self-auto">
                                                <button
                                                    onClick={() => setExpandedJournalId(isExpanded ? null : entry.id)}
                                                    className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg transition-all flex items-center gap-1 text-[10px] font-bold"
                                                    title={isExpanded ? "Hide Payload" : "Inspect Payload"}
                                                >
                                                    {isExpanded ? <EyeOff size={12} /> : <Eye size={12} />}
                                                    {isExpanded ? 'Hide' : 'Inspect'}
                                                </button>
                                                <button
                                                    onClick={() => setShowConfirmRevert(entry)}
                                                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all"
                                                    title="Point-in-Time Restore State"
                                                >
                                                    <CornerUpLeft size={12} />
                                                    Restore State
                                                </button>
                                            </div>
                                        </div>

                                        {/* Collapsible JSON payload inspector */}
                                        {isExpanded && (
                                            <div className="px-4 pb-4 animate-slideDown">
                                                <div className="bg-slate-900 rounded-xl p-4 font-mono text-[10px] text-emerald-400 overflow-x-auto max-h-64 border border-slate-800 space-y-2">
                                                    <div className="flex justify-between items-center text-[9px] text-slate-500 border-b border-slate-800 pb-1.5 font-sans">
                                                        <span>SHA256 SIGNATURE: {entry.checksum}</span>
                                                        <span className="flex items-center gap-1 text-emerald-500">
                                                            <Check size={10} /> CRYPTOGRAPHICALLY SECURED
                                                        </span>
                                                    </div>
                                                    <pre className="whitespace-pre-wrap">{JSON.stringify(JSON.parse(entry.payload), null, 2)}</pre>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {/* Confirm Full System Restore Dialog */}
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

            {/* Confirm Point-in-Time State Reversion Dialog */}
            {showConfirmRevert && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
                    <div className="bg-white rounded-3xl max-w-md w-full border border-slate-100 p-6 shadow-2xl space-y-6">
                        <div className="flex items-center gap-3 text-indigo-600">
                            <div className="p-3 bg-indigo-50 rounded-2xl">
                                <History size={24} />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-slate-800">Point-in-Time Recovery</h3>
                                <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wide mt-0.5">Selective State Restoration</p>
                            </div>
                        </div>

                        <div className="space-y-2 text-xs font-medium text-slate-500 leading-relaxed">
                            <p>
                                You are about to selectively restore <strong className="font-bold text-slate-700">{showConfirmRevert.entity_type} #{showConfirmRevert.entity_id}</strong> back to its historical state captured in transaction <strong className="font-mono text-slate-700">{showConfirmRevert.id}</strong> on {formatDate(showConfirmRevert.timestamp)}.
                            </p>
                            <p className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl text-indigo-800 font-bold">
                                ℹ️ Note: This will safely overwrite only the specific record for this {showConfirmRevert.entity_type.toLowerCase()}, leaving the rest of your active databases completely untouched. Any missing records will be recreated.
                            </p>
                        </div>

                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowConfirmRevert(null)}
                                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 font-bold text-xs uppercase tracking-wider hover:bg-slate-50 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleRevertJournal(showConfirmRevert)}
                                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider transition-all shadow-md flex items-center gap-2"
                            >
                                <CornerUpLeft size={12} />
                                Execute Restore State
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BackupSection;
