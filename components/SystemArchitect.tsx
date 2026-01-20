
import React, { useState, useEffect, useRef } from 'react';
import { 
  Code, Terminal, Sparkles, Save, Search, FileCode, RefreshCw, 
  ChevronRight, BrainCircuit, Loader2, AlertTriangle, CheckCircle2,
  X, Laptop, ArrowRight, GitBranch, History, ShieldAlert, Zap
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
  const [viewMode, setViewMode] = useState<'EDITOR' | 'EXPLORER'>('EXPLORER');
  const [status, setStatus] = useState<{ type: 'IDLE' | 'SUCCESS' | 'ERROR', msg: string }>({ type: 'IDLE', msg: '' });

  const fetchFiles = async () => {
    try {
      const res = await fetch('/api/architect/files');
      const data = await res.json();
      if (data.success) setFiles(data.files);
    } catch (e) {}
  };

  useEffect(() => {
    fetchFiles();
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
        setStatus({ type: 'SUCCESS', msg: 'Architect has redesigned the component. Review and Apply.' });
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
    if (!confirm("CRITICAL: This will inject code directly into the backend filesystem and may trigger a server restart. Proceed?")) return;

    setIsApplying(true);
    try {
      const res = await fetch('/api/architect/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          filePath: selectedFile, 
          content: fileContent,
          commitMessage: prompt || 'Manual Code Injection via Architect UI'
        })
      });
      const data = await res.json();
      if (data.success) {
        setStatus({ type: 'SUCCESS', msg: 'System Repaired. Changes are live.' });
        setPrompt('');
      } else {
        setStatus({ type: 'ERROR', msg: data.error || 'Apply failed' });
      }
    } catch (e: any) {
        setStatus({ type: 'ERROR', msg: e.message });
    } finally {
      setIsApplying(false);
    }
  };

  const filteredFiles = files.filter(f => f.path.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="max-w-7xl mx-auto space-y-6 h-[calc(100vh-140px)] flex flex-col animate-fadeIn">
      {/* 1. Header with God Mode Warning */}
      <div className="bg-slate-900 text-white p-6 rounded-[2rem] border border-amber-500/30 relative overflow-hidden shadow-2xl">
         <div className="relative z-10 flex justify-between items-center">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-500 rounded-2xl text-slate-900 shadow-lg shadow-amber-500/20">
                    <Zap size={24} />
                </div>
                <div>
                    <h2 className="text-xl font-black uppercase tracking-widest flex items-center gap-2">
                        System Architect <span className="text-amber-500">[GOD MODE]</span>
                    </h2>
                    <p className="text-xs text-slate-400 font-medium">Direct component injection and self-repair console.</p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-bold uppercase">
                    <ShieldAlert size={12} /> System Write Access Active
                </div>
            </div>
         </div>
         <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-[100px]"></div>
      </div>

      <div className="flex-1 flex gap-6 min-h-0">
        {/* 2. File Explorer Sidebar */}
        <div className="w-80 bg-white rounded-3xl border shadow-sm flex flex-col overflow-hidden">
            <div className="p-4 border-b space-y-3">
                <div className="flex justify-between items-center">
                    <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest">Workspace</h3>
                    <button onClick={fetchFiles} className="text-slate-400 hover:text-amber-500 transition-colors"><RefreshCw size={14}/></button>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                    <input 
                        className="w-full bg-slate-50 border-none rounded-xl pl-9 pr-4 py-2 text-xs font-bold outline-none focus:ring-1 focus:ring-amber-500" 
                        placeholder="Search files..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {filteredFiles.map(file => (
                    <button 
                        key={file.path}
                        onClick={() => handleReadFile(file.path)}
                        className={`w-full text-left px-4 py-2.5 rounded-xl text-[11px] font-bold flex items-center gap-3 transition-all ${
                            selectedFile === file.path ? 'bg-amber-50 text-amber-700' : 'text-slate-500 hover:bg-slate-50'
                        }`}
                    >
                        <FileCode size={14} className={selectedFile === file.path ? 'text-amber-600' : 'text-slate-400'} />
                        <span className="truncate">{file.path}</span>
                    </button>
                ))}
            </div>
        </div>

        {/* 3. Architect Console */}
        <div className="flex-1 flex flex-col gap-6">
            {/* Prompt Box */}
            <div className="bg-white p-6 rounded-[2rem] border shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                        <BrainCircuit size={14} /> Architect Directives
                    </h3>
                    {selectedFile && (
                        <span className="text-[10px] font-mono bg-slate-100 px-2 py-1 rounded border">{selectedFile}</span>
                    )}
                </div>
                <div className="flex gap-4">
                    <textarea 
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-medium focus:bg-white transition-all outline-none min-h-[80px] resize-none shadow-inner"
                        placeholder="Describe the code change or component you want to build/fix...&#10;Ex: 'Add a search bar to the customer list' or 'Fix the total calculation bug in orderDetails'"
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                    />
                    <button 
                        onClick={handleGenerate}
                        disabled={isGenerating || !prompt.trim()}
                        className="w-40 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest flex flex-col items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-xl disabled:opacity-50"
                    >
                        {isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles className="text-amber-400" />}
                        {isGenerating ? 'Thinking...' : 'Design Code'}
                    </button>
                </div>
            </div>

            {/* Status Alert */}
            {status.type !== 'IDLE' && (
                <div className={`p-4 rounded-2xl border flex items-center justify-between animate-slideDown ${
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
                            className="bg-emerald-600 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-700 shadow-md disabled:opacity-50"
                        >
                            {isApplying ? <Loader2 className="animate-spin" size={14}/> : <Save size={14}/>}
                            Apply Injection
                        </button>
                    )}
                </div>
            )}

            {/* Code Preview */}
            <div className="flex-1 bg-[#1e1e1e] rounded-[2rem] border border-white/5 shadow-2xl flex flex-col overflow-hidden">
                <div className="px-6 py-3 border-b border-white/5 flex justify-between items-center bg-[#252526]">
                    <div className="flex items-center gap-2">
                        <Code size={14} className="text-blue-400" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Injection Preview</span>
                    </div>
                    <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-rose-500/30"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500/30"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/30"></div>
                    </div>
                </div>
                <div className="flex-1 relative overflow-hidden">
                    <textarea 
                        className="absolute inset-0 w-full h-full bg-transparent text-emerald-400 p-6 font-mono text-[11px] leading-relaxed resize-none outline-none custom-scrollbar"
                        value={fileContent}
                        onChange={e => setFileContent(e.target.value)}
                        placeholder="// Architect will stream code here..."
                        spellCheck={false}
                    />
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default SystemArchitect;
