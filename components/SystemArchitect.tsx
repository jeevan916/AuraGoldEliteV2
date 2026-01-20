
import React, { useState, useEffect, useRef } from 'react';
import { 
  Code, Terminal, Sparkles, Save, Search, FileCode, RefreshCw, 
  ChevronRight, BrainCircuit, Loader2, AlertTriangle, CheckCircle2,
  X, Laptop, ArrowRight, GitBranch, History, ShieldAlert, Zap, Command, Trash2,
  Settings, GitPullRequest, RotateCcw, Database, HardDrive, Cpu, Globe
} from 'lucide-react';
import { ArchitectFile } from '../types';

const SystemArchitect: React.FC = () => {
  const [files, setFiles] = useState<ArchitectFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'EDITOR' | 'TERMINAL' | 'DEVOPS'>('EDITOR');
  const [status, setStatus] = useState<{ type: 'IDLE' | 'SUCCESS' | 'ERROR', msg: string }>({ type: 'IDLE', msg: '' });

  // Terminal & Git State
  const [cmd, setCmd] = useState('');
  const [termOutput, setTermOutput] = useState<{ cmd: string, out: string, err?: string }[]>([]);
  const [isExec, setIsExec] = useState(false);
  const [gitInfo, setGitInfo] = useState<{ branch: string, changes: string[] }>({ branch: 'unknown', changes: [] });

  const fetchFiles = async () => {
    try {
      const res = await fetch('/api/architect/files');
      const data = await res.json();
      if (data.success) setFiles(data.files);
    } catch (e) {}
  };

  const fetchGitStatus = async () => {
    try {
      const res = await fetch('/api/architect/git-status');
      const data = await res.json();
      if (data.success) setGitInfo({ branch: data.branch, changes: data.changes });
    } catch (e) {}
  };

  useEffect(() => {
    fetchFiles();
    fetchGitStatus();
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
        setStatus({ type: 'SUCCESS', msg: 'AI has architected the solution. Review and Commit.' });
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
    if (!confirm("Confirming File Injection. This will overwrite production code. Proceed?")) return;

    setIsApplying(true);
    try {
      const res = await fetch('/api/architect/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          filePath: selectedFile, 
          content: fileContent,
          commitMessage: prompt || 'Architect Hotfix'
        })
      });
      const data = await res.json();
      if (data.success) {
        setStatus({ type: 'SUCCESS', msg: 'Injection Successful. Check DevOps tab to restart server.' });
        setPrompt('');
        fetchGitStatus();
      } else {
        setStatus({ type: 'ERROR', msg: data.error || 'Apply failed' });
      }
    } catch (e: any) {
        setStatus({ type: 'ERROR', msg: e.message });
    } finally {
      setIsApplying(false);
    }
  };

  const runQuickAction = async (command: string) => {
      setCmd(command);
      // Automatically triggers form submit logic via handleRunCommand in real scenario
      // But we call it directly here for speed
      setIsExec(true);
      try {
          const res = await fetch('/api/architect/terminal', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ command })
          });
          const data = await res.json();
          setTermOutput(prev => [...prev, { cmd: command, out: data.output, err: data.error }]);
          fetchGitStatus();
      } catch (e: any) {
          setTermOutput(prev => [...prev, { cmd: command, out: '', err: e.message }]);
      } finally {
          setIsExec(false);
          setCmd('');
      }
  };

  const filteredFiles = files.filter(f => f.path.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="max-w-7xl mx-auto space-y-6 h-[calc(100vh-140px)] flex flex-col animate-fadeIn">
      {/* 1. Header with System Health Indicators */}
      <div className="bg-[#0f172a] text-white p-6 rounded-[2.5rem] border border-slate-800 relative overflow-hidden shadow-2xl shrink-0">
         <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-500 rounded-2xl text-slate-900 shadow-lg shadow-amber-500/20">
                    <Cpu size={24} />
                </div>
                <div>
                    <h2 className="text-xl font-black uppercase tracking-widest flex items-center gap-2">
                        System Architect <span className="text-amber-500 text-xs px-2 py-0.5 bg-amber-500/10 rounded-lg">GOD MODE</span>
                    </h2>
                    <div className="flex items-center gap-3 mt-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                        <span className="flex items-center gap-1"><GitBranch size={10} className="text-emerald-500"/> {gitInfo.branch}</span>
                        <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
                        <span className="flex items-center gap-1 text-blue-400"><Globe size={10}/> Production Cluster</span>
                    </div>
                </div>
            </div>
            
            <div className="flex bg-slate-900/50 backdrop-blur-md p-1 rounded-2xl border border-slate-800">
                <button 
                    onClick={() => setViewMode('EDITOR')}
                    className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewMode === 'EDITOR' ? 'bg-amber-500 text-slate-900 shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                >
                    <Code size={14} /> Editor
                </button>
                <button 
                    onClick={() => setViewMode('TERMINAL')}
                    className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewMode === 'TERMINAL' ? 'bg-amber-500 text-slate-900 shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                >
                    <Terminal size={14} /> Terminal
                </button>
                <button 
                    onClick={() => setViewMode('DEVOPS')}
                    className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewMode === 'DEVOPS' ? 'bg-amber-500 text-slate-900 shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                >
                    <Settings size={14} /> DevOps
                </button>
            </div>
         </div>
         <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-[120px]"></div>
      </div>

      <div className="flex-1 flex gap-6 min-h-0">
        {/* 2. File Explorer (Visible in Editor Mode) */}
        {viewMode === 'EDITOR' && (
            <div className="w-80 bg-white rounded-[2.5rem] border shadow-sm flex flex-col overflow-hidden shrink-0 animate-fadeIn">
                <div className="p-6 border-b space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest">Repository</h3>
                        <button onClick={fetchFiles} className="text-slate-400 hover:text-amber-500 transition-colors"><RefreshCw size={14}/></button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input 
                            className="w-full bg-slate-50 border-none rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500/20" 
                            placeholder="Find file..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
                    {filteredFiles.map(file => (
                        <button 
                            key={file.path}
                            onClick={() => handleReadFile(file.path)}
                            className={`w-full text-left px-4 py-3 rounded-xl text-[11px] font-bold flex items-center gap-3 transition-all ${
                                selectedFile === file.path ? 'bg-amber-50 text-amber-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'
                            }`}
                        >
                            <FileCode size={14} className={selectedFile === file.path ? 'text-amber-600' : 'text-slate-300'} />
                            <span className="truncate flex-1">{file.path}</span>
                        </button>
                    ))}
                </div>
            </div>
        )}

        {/* 3. Main Action Panel */}
        <div className="flex-1 flex flex-col gap-6 min-w-0">
            {viewMode === 'EDITOR' && (
                <>
                    <div className="bg-white p-6 rounded-[2.5rem] border shadow-sm space-y-4 shrink-0">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                                <BrainCircuit size={14} /> AI Implementation Prompt
                            </h3>
                            {selectedFile && (
                                <span className="text-[10px] font-black font-mono bg-slate-100 px-3 py-1 rounded-lg border border-slate-200 text-slate-500">{selectedFile}</span>
                            )}
                        </div>
                        <div className="flex gap-4">
                            <textarea 
                                className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-medium focus:bg-white transition-all outline-none min-h-[100px] resize-none shadow-inner"
                                placeholder="Describe the architectural change needed... AI will rewrite the entire file safely."
                                value={prompt}
                                onChange={e => setPrompt(e.target.value)}
                            />
                            <button 
                                onClick={handleGenerate}
                                disabled={isGenerating || !prompt.trim()}
                                className="w-48 bg-[#0f172a] text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] flex flex-col items-center justify-center gap-3 hover:bg-black transition-all shadow-xl disabled:opacity-50"
                            >
                                {isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles className="text-amber-400" />}
                                {isGenerating ? 'Thinking...' : 'Rewrite File'}
                            </button>
                        </div>
                    </div>

                    {status.type !== 'IDLE' && (
                        <div className={`p-4 rounded-2xl border flex items-center justify-between animate-slideDown shrink-0 ${
                            status.type === 'SUCCESS' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
                        }`}>
                            <div className="flex items-center gap-3">
                                {status.type === 'SUCCESS' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                                <span className="text-xs font-bold">{status.msg}</span>
                            </div>
                            {status.type === 'SUCCESS' && (
                                <button 
                                    onClick={handleApply}
                                    disabled={isApplying}
                                    className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-700 shadow-lg disabled:opacity-50"
                                >
                                    {isApplying ? <Loader2 className="animate-spin" size={14}/> : <Save size={14}/>}
                                    Deploy Changes
                                </button>
                            )}
                        </div>
                    )}

                    <div className="flex-1 bg-[#1e1e1e] rounded-[2.5rem] border border-white/5 shadow-2xl flex flex-col overflow-hidden">
                        <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-[#252526]">
                            <div className="flex items-center gap-3">
                                <div className="flex gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500/50"></div>
                                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50"></div>
                                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50"></div>
                                </div>
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Source Buffer</span>
                            </div>
                        </div>
                        <div className="flex-1 relative overflow-hidden">
                            <textarea 
                                className="absolute inset-0 w-full h-full bg-transparent text-emerald-400 p-8 font-mono text-[11px] leading-relaxed resize-none outline-none custom-scrollbar"
                                value={fileContent}
                                onChange={e => setFileContent(e.target.value)}
                                placeholder="// Select a file or use AI Architect..."
                                spellCheck={false}
                            />
                        </div>
                    </div>
                </>
            )}

            {viewMode === 'TERMINAL' && (
                <div className="flex-1 bg-slate-950 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-slate-900 animate-fadeIn">
                    <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
                        <div className="flex items-center gap-2 text-amber-500">
                            <Terminal size={18} />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Secure Node Shell</span>
                        </div>
                        <div className="flex gap-2">
                             <button onClick={() => runQuickAction('ls -R')} className="px-3 py-1 bg-slate-800 text-slate-400 rounded-lg text-[9px] font-bold uppercase hover:bg-slate-700">List Files</button>
                             <button onClick={() => runQuickAction('npm install')} className="px-3 py-1 bg-slate-800 text-slate-400 rounded-lg text-[9px] font-bold uppercase hover:bg-slate-700">Update Deps</button>
                             <button onClick={() => setTermOutput([])} className="p-1 text-slate-600 hover:text-rose-400 transition-colors"><Trash2 size={16} /></button>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-8 font-mono text-xs custom-scrollbar space-y-4">
                        {termOutput.map((o, i) => (
                            <div key={i} className="space-y-1 animate-fadeIn">
                                <div className="flex items-center gap-2 text-slate-500">
                                    <span className="opacity-50 text-emerald-500 font-bold">$</span>
                                    <span>{o.cmd}</span>
                                </div>
                                {o.out && <pre className="text-slate-300 whitespace-pre-wrap pl-4 border-l border-slate-800 ml-1 py-1">{o.out}</pre>}
                                {o.err && <pre className="text-rose-400 whitespace-pre-wrap pl-4 border-l border-rose-900/50 ml-1 py-1">{o.err}</pre>}
                            </div>
                        ))}
                        {isExec && <div className="text-amber-500 animate-pulse flex items-center gap-2 font-black text-[10px] uppercase tracking-widest"><Loader2 size={12} className="animate-spin"/> System Executing Directive...</div>}
                    </div>

                    <form onSubmit={(e) => { e.preventDefault(); runQuickAction(cmd); }} className="p-4 bg-slate-900 border-t border-slate-800 flex gap-4">
                        <div className="flex-1 relative">
                            <Command className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-700" size={14} />
                            <input 
                                className="w-full bg-black border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-emerald-500 font-mono text-sm outline-none focus:border-amber-500/50 transition-all"
                                placeholder="Enter bash command..."
                                value={cmd}
                                onChange={e => setCmd(e.target.value)}
                                disabled={isExec}
                            />
                        </div>
                        <button 
                            type="submit"
                            disabled={isExec || !cmd.trim()}
                            className="bg-amber-600 text-slate-900 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-amber-500 disabled:opacity-50 transition-all shadow-lg"
                        >
                            Run
                        </button>
                    </form>
                </div>
            )}

            {viewMode === 'DEVOPS' && (
                <div className="flex-1 space-y-6 animate-fadeIn overflow-y-auto pr-2 custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* GIT STATUS CARD */}
                        <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6">
                             <div className="flex justify-between items-center">
                                 <h3 className="text-sm font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                                     <GitPullRequest size={16} className="text-blue-500" /> Git Repository Control
                                 </h3>
                                 <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter border border-blue-100">{gitInfo.branch}</span>
                             </div>
                             
                             <div className="space-y-4">
                                 <p className="text-xs text-slate-500 font-medium">Uncommitted changes in working directory:</p>
                                 <div className="max-h-40 overflow-y-auto bg-slate-50 rounded-2xl p-4 border border-slate-100 font-mono text-[10px] space-y-1">
                                     {gitInfo.changes.length > 0 ? gitInfo.changes.map((c, i) => (
                                         <div key={i} className="text-slate-600 flex items-center gap-2">
                                             <span className="text-amber-500 font-bold">{c.charAt(0)}</span>
                                             <span>{c.substring(2)}</span>
                                         </div>
                                     )) : <div className="text-slate-400 italic">Working tree clean. All changes committed.</div>}
                                 </div>
                                 <div className="flex gap-3">
                                     <button onClick={() => runQuickAction('git pull origin main')} className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-black transition-all">
                                         <GitPullRequest size={14} /> Pull Updates
                                     </button>
                                     <button onClick={() => runQuickAction('git add . && git commit -m "Architect self-repair commit" && git push origin main')} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-blue-700 transition-all">
                                         <Save size={14} /> Push Changes
                                     </button>
                                 </div>
                             </div>
                        </div>

                        {/* SERVER CONTROL CARD */}
                        <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6">
                            <h3 className="text-sm font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                                <RotateCcw size={16} className="text-rose-500" /> Server Life Cycle
                            </h3>
                            <div className="space-y-6">
                                <div className="bg-rose-50 border border-rose-100 p-5 rounded-[2rem] flex items-start gap-4">
                                    <div className="p-2 bg-white rounded-xl shadow-sm text-rose-500"><RotateCcw size={20} /></div>
                                    <div className="flex-1">
                                        <p className="font-bold text-slate-800 text-sm">Force Application Restart</p>
                                        <p className="text-[10px] text-rose-600 mt-1 leading-relaxed">Essential after AI changes to core modules. Uses PM2 or system reload directives.</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <button onClick={() => runQuickAction('pm2 restart all || node server.js')} className="bg-rose-600 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-rose-600/20 hover:bg-rose-700 transition-all">
                                        Restart Cluster
                                    </button>
                                    <button onClick={() => runQuickAction('npm run build')} className="bg-slate-100 text-slate-600 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all">
                                        Rebuild Assets
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* INFRASTRUCTURE MONITOR */}
                    <div className="bg-[#0f172a] p-8 rounded-[2.5rem] shadow-2xl border border-slate-800 relative overflow-hidden">
                        <div className="relative z-10 space-y-8">
                            <div className="flex justify-between items-center">
                                <h3 className="text-sm font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                                    <HardDrive size={16} className="text-amber-500" /> Hostinger Infrastructure Overview
                                </h3>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Environment Live</span>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Node.js Version</p>
                                    <p className="text-2xl font-black text-white">{window.navigator.userAgent.includes('Electron') ? 'Internal' : 'v20.x Cluster'}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Database Driver</p>
                                    <p className="text-2xl font-black text-white">MySQL (mysql2)</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Memory Usage</p>
                                    <p className="text-2xl font-black text-white">Optimize Active</p>
                                </div>
                            </div>
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
