
import React, { useState, useEffect, useRef } from 'react';
import { 
  Code, Terminal, Sparkles, Save, Search, FileCode, RefreshCw, 
  ChevronRight, BrainCircuit, Loader2, AlertTriangle, CheckCircle2,
  X, Laptop, ArrowRight, GitBranch, History, ShieldAlert, Zap, Command, Trash2,
  Settings, GitPullRequest, RotateCcw, Database, HardDrive, Cpu, Globe, Map, BookOpen, Layers, Activity, Undo2
} from 'lucide-react';
import { ArchitectFile, SystemMap, ComponentDiscovery } from '../types';

const ComponentMemoryCard: React.FC<{ comp: ComponentDiscovery; color?: string }> = ({ comp, color = "bg-slate-50" }) => (
    <div className={`${color} p-5 rounded-2xl border border-black/5 hover:shadow-md transition-all group`}>
        <div className="flex justify-between items-start mb-3">
            <div>
                <p className="font-black text-slate-800 text-sm">{comp.name}</p>
                <p className="text-[9px] text-slate-400 font-mono truncate max-w-[200px]">{comp.path}</p>
            </div>
            <span className="text-[8px] font-black uppercase text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">Discoverable</span>
        </div>
        <p className="text-xs text-slate-600 line-clamp-2 italic mb-4 leading-relaxed">"{comp.purpose}"</p>
        <div className="flex flex-wrap gap-1">
            {comp.exports.slice(0, 3).map(e => (
                <span key={e} className="bg-white px-2 py-0.5 rounded-lg border text-[9px] font-bold text-slate-500">{e}</span>
            ))}
            {comp.exports.length > 3 && <span className="text-[9px] text-slate-300 ml-1">+{comp.exports.length - 3} more</span>}
        </div>
    </div>
);

const SystemArchitect: React.FC = () => {
  const [files, setFiles] = useState<ArchitectFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'EDITOR' | 'TERMINAL' | 'DEVOPS' | 'MEMORY'>('EDITOR');
  const [status, setStatus] = useState<{ type: 'IDLE' | 'SUCCESS' | 'ERROR', msg: string }>({ type: 'IDLE', msg: '' });

  // Terminal & Memory State
  const [cmd, setCmd] = useState('');
  const [termOutput, setTermOutput] = useState<{ cmd: string, out: string, err?: string }[]>([]);
  const [isExec, setIsExec] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [gitInfo, setGitInfo] = useState<{ branch: string, changes: string[] }>({ branch: 'unknown', changes: [] });
  const [systemMemory, setSystemMemory] = useState<SystemMap | null>(null);

  // Check for fix prompts from Logs
  useEffect(() => {
      const pendingFix = sessionStorage.getItem('architect_fix_prompt');
      const targetFile = sessionStorage.getItem('architect_target_file');
      if (pendingFix) {
          setPrompt(`[LOG FIX DIRECTIVE]: ${pendingFix}`);
          if (targetFile) {
              const match = files.find(f => f.path.includes(targetFile) || targetFile.includes(f.path));
              if (match) handleReadFile(match.path);
          }
          sessionStorage.removeItem('architect_fix_prompt');
          sessionStorage.removeItem('architect_target_file');
      }
  }, [files.length]);

  const fetchFiles = async () => {
    try {
      const res = await fetch('/api/architect/files');
      const data = await res.json();
      if (data.success) setFiles(data.files);
      else throw new Error(data.error);
    } catch (e: any) {
        setStatus({ type: 'ERROR', msg: `Failed to load file tree: ${e.message}` });
    }
  };

  const fetchMemory = async () => {
      try {
          const res = await fetch('/api/architect/memory');
          const data = await res.json();
          if (data.success) setSystemMemory(data.memory);
      } catch (e) {}
  };

  const handleIndexSystem = async () => {
      setIsIndexing(true);
      try {
          const res = await fetch('/api/architect/index', { method: 'POST' });
          const data = await res.json();
          if (data.success) {
              setSystemMemory(data.memory);
              setStatus({ type: 'SUCCESS', msg: "Cognitive Memory Re-Indexed." });
          }
      } catch (e: any) {
          setStatus({ type: 'ERROR', msg: e.message });
      } finally {
          setIsIndexing(false);
      }
  };

  useEffect(() => {
    fetchFiles();
    fetchMemory();
  }, []);

  const handleReadFile = async (path: string) => {
    setSelectedFile(path);
    setStatus({ type: 'IDLE', msg: '' });
    try {
      const res = await fetch('/api/architect/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: path })
      });
      const data = await res.json();
      if (data.success) {
        setFileContent(data.content);
        setViewMode('EDITOR');
      }
    } catch (e) {}
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setStatus({ type: 'IDLE', msg: '' });
    
    try {
      const res = await fetch('/api/architect/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt, 
          filePath: selectedFile,
          contextFiles: ['types.ts', 'server.js', 'App.tsx'].filter(f => f !== selectedFile)
        })
      });
      const data = await res.json();
      if (data.success) {
        setFileContent(data.content);
        setStatus({ type: 'SUCCESS', msg: 'AI Implementation ready. Review syntax before deploying.' });
      } else {
        setStatus({ type: 'ERROR', msg: data.error || 'Generation failed' });
      }
    } catch (e: any) {
        setStatus({ type: 'ERROR', msg: e.message });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApply = async () => {
    if (!selectedFile || !fileContent) return;
    if (!confirm("Inject code into production? This will overwrite existing logic.")) return;

    setIsApplying(true);
    try {
      const res = await fetch('/api/architect/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: selectedFile, content: fileContent })
      });
      const data = await res.json();
      if (data.success) {
        setStatus({ type: 'SUCCESS', msg: 'Injection Successful. System self-repair initiated.' });
        setPrompt('');
      } else {
          throw new Error(data.error);
      }
    } catch (e: any) {
        setStatus({ type: 'ERROR', msg: e.message });
    } finally {
      setIsApplying(false);
    }
  };

  const handleRestore = async () => {
      if (!selectedFile) return;
      if (!confirm("Revert this module to its last stable backup?")) return;
      setIsRestoring(true);
      try {
          const res = await fetch('/api/architect/restore', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filePath: selectedFile })
          });
          const data = await res.json();
          if (data.success) {
              setFileContent(data.content);
              setStatus({ type: 'SUCCESS', msg: data.message });
          } else {
              throw new Error(data.error);
          }
      } catch (e: any) {
          setStatus({ type: 'ERROR', msg: e.message });
      } finally {
          setIsRestoring(false);
      }
  };

  const runQuickAction = async (command: string) => {
      setIsExec(true);
      try {
          const res = await fetch('/api/architect/terminal', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ command })
          });
          const data = await res.json();
          setTermOutput(prev => [...prev, { cmd: command, out: data.output, err: data.error }]);
      } catch (e: any) {
          setTermOutput(prev => [...prev, { cmd: command, out: '', err: e.message }]);
      } finally {
          setIsExec(false);
      }
  };

  const filteredFiles = files.filter(f => f.path.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="max-w-7xl mx-auto space-y-6 h-[calc(100vh-140px)] flex flex-col animate-fadeIn">
      {/* Header */}
      <div className="bg-[#0f172a] text-white p-6 rounded-[2.5rem] border border-slate-800 relative overflow-hidden shadow-2xl shrink-0">
         <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-500 rounded-2xl text-slate-900 shadow-lg shadow-amber-500/20">
                    <Zap size={24} />
                </div>
                <div>
                    <h2 className="text-xl font-black uppercase tracking-widest flex items-center gap-2">
                        Architect <span className="text-amber-500 text-xs px-2 py-0.5 bg-amber-500/10 rounded-lg">GOD MODE</span>
                    </h2>
                    <div className="flex items-center gap-3 mt-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                        <span className="flex items-center gap-1"><BrainCircuit size={10} className={systemMemory ? "text-emerald-500" : "text-slate-500"}/> {systemMemory ? "Cognitive Active" : "Memory Offline"}</span>
                        <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
                        <span className="flex items-center gap-1 text-blue-400"><Activity size={10}/> System Pulse: OK</span>
                    </div>
                </div>
            </div>
            
            <div className="flex bg-slate-900/50 backdrop-blur-md p-1 rounded-2xl border border-slate-800">
                {(['EDITOR', 'TERMINAL', 'MEMORY', 'DEVOPS'] as const).map(tab => (
                    <button 
                        key={tab}
                        onClick={() => {
                            setViewMode(tab);
                            setStatus({ type: 'IDLE', msg: '' });
                        }}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewMode === tab ? 'bg-amber-500 text-slate-900 shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        {tab}
                    </button>
                ))}
            </div>
         </div>
      </div>

      <div className="flex-1 flex gap-6 min-h-0">
        {/* Explorer */}
        <div className="w-80 bg-white rounded-[2.5rem] border shadow-sm flex flex-col overflow-hidden shrink-0">
            <div className="p-6 border-b space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest">Master Tree</h3>
                    <button onClick={fetchFiles} className="text-slate-400 hover:text-amber-500 transition-colors"><RefreshCw size={14}/></button>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input className="w-full bg-slate-50 border-none rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold outline-none" placeholder="Find file..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
                {filteredFiles.map(file => (
                    <button key={file.path} onClick={() => handleReadFile(file.path)} className={`w-full text-left px-4 py-3 rounded-xl text-[10px] font-bold flex items-center gap-3 transition-all ${selectedFile === file.path ? 'bg-amber-50 text-amber-700' : 'text-slate-500 hover:bg-slate-50'}`}>
                        <FileCode size={14} className={selectedFile === file.path ? 'text-amber-600' : 'text-slate-300'} />
                        <span className="truncate flex-1">{file.path}</span>
                    </button>
                ))}
            </div>
        </div>

        {/* View Content */}
        <div className="flex-1 flex flex-col gap-6 min-w-0">
            {viewMode === 'EDITOR' && (
                <>
                    <div className={`p-6 rounded-[2.5rem] border shadow-sm space-y-4 shrink-0 transition-all ${prompt.includes('[LOG FIX') ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100'}`}>
                        <div className="flex justify-between items-center mb-1">
                             <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                                 <BrainCircuit size={14} className="text-amber-500" /> Transformation Directive
                             </h3>
                             {prompt.includes('[LOG FIX') && <span className="bg-indigo-600 text-white px-2 py-0.5 rounded text-[8px] font-black uppercase animate-pulse">Diagnostic Hook Active</span>}
                        </div>
                        <textarea className="w-full h-24 bg-white/50 border border-slate-200 rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-amber-500/20 outline-none resize-none shadow-inner" placeholder="Describe logic transformation..." value={prompt} onChange={e => setPrompt(e.target.value)} />
                        <div className="flex justify-end gap-3">
                             {selectedFile && (
                                 <button onClick={handleRestore} disabled={isRestoring} className="px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest text-slate-400 hover:text-slate-600 flex items-center gap-2">
                                     {isRestoring ? <Loader2 size={12} className="animate-spin" /> : <Undo2 size={14} />} Restore Backup
                                 </button>
                             )}
                             <button onClick={handleGenerate} disabled={isGenerating || !prompt.trim()} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl flex items-center gap-3 disabled:opacity-50 hover:bg-black transition-all">
                                {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} className="text-amber-400" />} Rewrite logic
                             </button>
                        </div>
                    </div>
                    {status.type !== 'IDLE' && (
                        <div className={`p-4 rounded-2xl border flex items-center justify-between animate-slideDown ${status.type === 'SUCCESS' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                            <span className="text-xs font-bold">{status.msg}</span>
                            {status.type === 'SUCCESS' && <button onClick={handleApply} disabled={isApplying} className="bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-[10px] font-black uppercase hover:bg-emerald-700">Deploy Injection</button>}
                        </div>
                    )}
                    <div className="flex-1 bg-[#1e1e1e] rounded-[2.5rem] border border-white/5 shadow-2xl overflow-hidden flex flex-col">
                        <textarea className="flex-1 bg-transparent text-emerald-400 p-8 font-mono text-[11px] leading-relaxed outline-none resize-none custom-scrollbar" value={fileContent} onChange={e => setFileContent(e.target.value)} spellCheck={false} />
                    </div>
                </>
            )}

            {viewMode === 'MEMORY' && (
                <div className="flex-1 bg-white rounded-[2.5rem] border shadow-sm p-8 flex flex-col animate-fadeIn overflow-hidden">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                                <BrainCircuit className="text-indigo-500" /> Cognitive Intelligence Map
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">Self-discovery index of all registered modules and their dependencies.</p>
                        </div>
                        <button onClick={handleIndexSystem} disabled={isIndexing} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-black text-[10px] uppercase flex items-center gap-2 hover:bg-indigo-700 shadow-lg disabled:opacity-50">
                            {isIndexing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Re-Index Codebase
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-8 pr-2 custom-scrollbar">
                        {systemMemory ? (
                            <>
                                <section>
                                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 flex items-center gap-2">
                                        <Layers size={14} /> Components Registry
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {systemMemory.components.map(c => (
                                            <ComponentMemoryCard key={c.path} comp={c} />
                                        ))}
                                    </div>
                                </section>
                                <section>
                                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 flex items-center gap-2">
                                        <Cpu size={14} /> Application Services
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {systemMemory.services.map(s => (
                                            <ComponentMemoryCard key={s.path} comp={s} color="bg-blue-50" />
                                        ))}
                                    </div>
                                </section>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-20 border-2 border-dashed rounded-3xl">
                                <Map size={48} className="opacity-20 mb-4" />
                                <p className="font-bold text-sm uppercase">Intelligence Map Depleted</p>
                                <p className="text-xs mt-1">Re-index required to restore architectural awareness.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {viewMode === 'TERMINAL' && (
                <div className="flex-1 bg-slate-950 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-slate-900 animate-fadeIn">
                    <div className="flex-1 overflow-y-auto p-8 font-mono text-xs custom-scrollbar space-y-2">
                        {termOutput.map((o, i) => (
                            <div key={i}>
                                <div className="text-emerald-500 font-bold">$ {o.cmd}</div>
                                {o.out && <pre className="text-slate-300 ml-4 mb-2">{o.out}</pre>}
                                {o.err && <pre className="text-rose-400 ml-4 mb-2">{o.err}</pre>}
                            </div>
                        ))}
                    </div>
                    <form onSubmit={e => { e.preventDefault(); runQuickAction(cmd); setCmd(''); }} className="p-4 bg-slate-900 border-t border-slate-800 flex gap-4">
                        <input className="flex-1 bg-black border border-slate-800 rounded-xl px-4 py-3 text-emerald-400 font-mono text-sm outline-none focus:border-amber-500/50" placeholder="Enter bash command..." value={cmd} onChange={e => setCmd(e.target.value)} disabled={isExec} />
                    </form>
                </div>
            )}

            {viewMode === 'DEVOPS' && (
                 <div className="flex-1 bg-white rounded-[2.5rem] p-8 border shadow-sm animate-fadeIn">
                     <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-3"><RotateCcw className="text-rose-500" /> Maintenance & Control</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div className="bg-rose-50 p-6 rounded-3xl border border-rose-100 space-y-4">
                             <h4 className="font-bold text-rose-800">Cluster Lifecycle</h4>
                             <p className="text-xs text-rose-600">Force environment reload after heavy module changes.</p>
                             <button onClick={() => runQuickAction('pm2 restart all || node server.js')} className="w-full bg-rose-600 text-white py-3 rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-rose-700">Restart Server</button>
                         </div>
                         <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-4">
                             <h4 className="font-bold text-slate-800">Source Integrity</h4>
                             <p className="text-xs text-slate-500">Sync with primary repository branch.</p>
                             <button onClick={() => runQuickAction('git pull origin main')} className="w-full bg-slate-900 text-white py-3 rounded-xl font-black text-[10px] uppercase hover:bg-black">Pull Main Branch</button>
                         </div>
                     </div>
                 </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default SystemArchitect;
