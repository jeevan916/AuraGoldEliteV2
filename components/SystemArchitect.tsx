
import React, { useState, useEffect, useRef } from 'react';
import { 
  Code, Terminal, Sparkles, Save, Search, FileCode, RefreshCw, 
  BrainCircuit, Loader2, AlertTriangle, CheckCircle2,
  X, Laptop, ArrowRight, GitBranch, History, ShieldAlert, Zap, Command, Trash2,
  RotateCcw, Cpu, Globe, Layers, Activity, Undo2, PlayCircle
} from 'lucide-react';
import { ArchitectFile, SystemMap, ComponentDiscovery } from '../types';

const ComponentMemoryCard: React.FC<{ comp: ComponentDiscovery; color?: string }> = ({ comp, color = "bg-slate-50" }) => (
    <div className={`${color} p-5 rounded-2xl border border-black/5 hover:shadow-md transition-all group`}>
        <div className="flex justify-between items-start mb-3">
            <div>
                <p className="font-black text-slate-800 text-sm">{comp.name}</p>
                <p className="text-[9px] text-slate-400 font-mono truncate max-w-[200px]">{comp.path}</p>
            </div>
            <span className="text-[8px] font-black uppercase text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">Mapped</span>
        </div>
        <p className="text-xs text-slate-600 line-clamp-2 italic mb-4 leading-relaxed">"{comp.purpose}"</p>
        <div className="flex flex-wrap gap-1">
            {comp.exports.slice(0, 3).map(e => (
                <span key={e} className="bg-white px-2 py-0.5 rounded-lg border text-[9px] font-bold text-slate-500">{e}</span>
            ))}
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
  const [execLogs, setExecLogs] = useState<string[]>([]);

  const addExecLog = (msg: string) => setExecLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));

  useEffect(() => {
      const pendingFix = sessionStorage.getItem('architect_fix_prompt');
      const targetFile = sessionStorage.getItem('architect_target_file');
      if (pendingFix) {
          setPrompt(`[URGENT REPAIR]: ${pendingFix}`);
          if (targetFile) {
              const match = files.find(f => f.path.includes(targetFile));
              if (match) handleReadFile(match.path);
          }
          sessionStorage.removeItem('architect_fix_prompt');
          sessionStorage.removeItem('architect_target_file');
      }
  }, [files.length]);

  const [cmd, setCmd] = useState('');
  const [termOutput, setTermOutput] = useState<{ cmd: string, out: string, err?: string }[]>([]);
  const [isExec, setIsExec] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [systemMemory, setSystemMemory] = useState<SystemMap | null>(null);

  const fetchFiles = async () => {
    try {
      const res = await fetch('/api/architect/files');
      const data = await res.json();
      if (data.success) setFiles(data.files);
    } catch (e) {}
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
      addExecLog("Scanning codebase for cognitive mapping...");
      try {
          const res = await fetch('/api/architect/index', { method: 'POST' });
          const data = await res.json();
          if (data.success) {
              setSystemMemory(data.memory);
              addExecLog("Codebase successfully re-indexed.");
          }
      } finally { setIsIndexing(false); }
  };

  useEffect(() => {
    fetchFiles();
    fetchMemory();
  }, []);

  const handleReadFile = async (path: string) => {
    setSelectedFile(path);
    addExecLog(`Opening module: ${path}`);
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
    addExecLog("Consulting Gemini 3 Pro for architectural transformation...");
    try {
      const res = await fetch('/api/architect/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, filePath: selectedFile })
      });
      const data = await res.json();
      if (data.success) {
        setFileContent(data.content);
        setStatus({ type: 'SUCCESS', msg: 'Blueprint generated. Verify syntax.' });
        addExecLog("New logic compiled successfully.");
      } else {
        setStatus({ type: 'ERROR', msg: data.error });
        addExecLog(`Generation error: ${data.error}`);
      }
    } finally { setIsGenerating(false); }
  };

  const handleApply = async () => {
    if (!selectedFile || !fileContent) return;
    setIsApplying(true);
    addExecLog(`Injecting changes into ${selectedFile}...`);
    try {
      const res = await fetch('/api/architect/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: selectedFile, content: fileContent })
      });
      const data = await res.json();
      if (data.success) {
        setStatus({ type: 'SUCCESS', msg: 'System node updated successfully.' });
        addExecLog("Injection verified. Node cache cleared.");
      } else {
          throw new Error(data.error);
      }
    } catch (e: any) {
        setStatus({ type: 'ERROR', msg: e.message });
        addExecLog(`Critical write error: ${e.message}`);
    } finally { setIsApplying(false); }
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
                        Supreme Architect <span className="text-amber-500 text-[10px] px-2 py-0.5 bg-amber-500/10 rounded-lg">LEVEL 5 ACCESS</span>
                    </h2>
                    <div className="flex items-center gap-3 mt-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                        <span className="flex items-center gap-1"><BrainCircuit size={10} className={systemMemory ? "text-emerald-500" : "text-slate-500"}/> {systemMemory ? "Cognitive Link: LIVE" : "Memory: OFFLINE"}</span>
                        <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
                        <span className="flex items-center gap-1 text-blue-400"><Activity size={10}/> Node Status: ACTIVE</span>
                    </div>
                </div>
            </div>
            
            <div className="flex bg-slate-900/50 backdrop-blur-md p-1 rounded-2xl border border-slate-800">
                {(['EDITOR', 'TERMINAL', 'MEMORY', 'DEVOPS'] as const).map(tab => (
                    <button 
                        key={tab} onClick={() => setViewMode(tab)}
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
                    <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest">Topology</h3>
                    <button onClick={fetchFiles} className="text-slate-400 hover:text-amber-500 transition-colors"><RefreshCw size={14}/></button>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input className="w-full bg-slate-50 border-none rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold outline-none" placeholder="Target module..." value={search} onChange={e => setSearch(e.target.value)} />
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
            {/* Monitor Widget */}
            <div className="p-4 bg-slate-900 text-[9px] font-mono text-emerald-500 h-32 overflow-y-auto custom-scrollbar">
                <p className="text-slate-500 mb-1">--- EXECUTION STREAM ---</p>
                {execLogs.map((log, i) => <div key={i} className="mb-0.5">{log}</div>)}
            </div>
        </div>

        {/* Console */}
        <div className="flex-1 flex flex-col gap-6 min-w-0">
            {viewMode === 'EDITOR' && (
                <>
                    <div className={`p-6 rounded-[2.5rem] border shadow-sm space-y-4 shrink-0 transition-all ${prompt.includes('[URGENT') ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-100'}`}>
                        <div className="flex justify-between items-center mb-1">
                             <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                                 <BrainCircuit size={14} className="text-amber-500" /> Transformation Directive
                             </h3>
                             {prompt.includes('[URGENT') && <span className="bg-rose-600 text-white px-2 py-0.5 rounded text-[8px] font-black uppercase animate-pulse">Critical Repair Mode</span>}
                        </div>
                        <textarea className="w-full h-24 bg-white/50 border border-slate-200 rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-amber-500/20 outline-none resize-none shadow-inner" placeholder="Describe architectural logic changes..." value={prompt} onChange={e => setPrompt(e.target.value)} />
                        <div className="flex justify-end gap-3">
                             <button onClick={handleGenerate} disabled={isGenerating || !prompt.trim()} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl flex items-center gap-3 disabled:opacity-50 hover:bg-black transition-all">
                                {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} className="text-amber-400" />} Rewrite Engine
                             </button>
                        </div>
                    </div>
                    {status.type !== 'IDLE' && (
                        <div className={`p-4 rounded-2xl border flex items-center justify-between animate-slideDown ${status.type === 'SUCCESS' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                            <span className="text-xs font-bold">{status.msg}</span>
                            {status.type === 'SUCCESS' && <button onClick={handleApply} disabled={isApplying} className="bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-[10px] font-black uppercase hover:bg-emerald-700 flex items-center gap-2">
                                {isApplying ? <Loader2 size={12} className="animate-spin"/> : <PlayCircle size={14}/>} Deploy To Production
                            </button>}
                        </div>
                    )}
                    <div className="flex-1 bg-[#1e1e1e] rounded-[2.5rem] border border-white/5 shadow-2xl overflow-hidden flex flex-col">
                        <textarea className="flex-1 bg-transparent text-emerald-400 p-8 font-mono text-[11px] leading-relaxed outline-none resize-none custom-scrollbar" value={fileContent} onChange={e => setFileContent(e.target.value)} spellCheck={false} />
                    </div>
                </>
            )}
            {/* Other modes logic... */}
        </div>
      </div>
    </div>
  );
};

export default SystemArchitect;
