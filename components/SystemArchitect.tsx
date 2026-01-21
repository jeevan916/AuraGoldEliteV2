
import React, { useState, useEffect } from 'react';
import { 
  Folder, FileCode, ChevronRight, ChevronDown, Terminal, 
  Play, Save, RefreshCw, Loader2, Cpu, Code, ArrowRight, ShieldAlert
} from 'lucide-react';

interface FileNode {
  path: string;
  lastModified: string;
}

const SystemArchitect: React.FC = () => {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [prompt, setPrompt] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState('Online');

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      const res = await fetch('/api/architect/files');
      const data = await res.json();
      if (data.success) {
          setFiles(data.files);
          setStatus('Connected');
      } else {
          setStatus('API Error');
      }
    } catch (e) {
      console.error(e);
      setStatus('Offline');
    }
  };

  const loadFile = async (path: string) => {
    setSelectedFile(path);
    setLoading(true);
    setFileContent(''); 
    setOutput(''); 
    
    try {
      const res = await fetch('/api/architect/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: path })
      });
      const data = await res.json();
      if (data.success) setFileContent(data.content);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!prompt) return;
    setProcessing(true);
    try {
      const res = await fetch('/api/architect/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, filePath: selectedFile })
      });
      const data = await res.json();
      if (data.success) {
          setOutput(data.content);
      } else {
          alert(`Generation Error: ${data.error}`);
      }
    } catch (e) {
      alert("Network failed during generation");
    } finally {
      setProcessing(false);
    }
  };

  const handleApply = async () => {
    if (!selectedFile || !output) return;
    if (!confirm(`WARNING: This will overwrite ${selectedFile}. Continue?`)) return;
    
    try {
      const res = await fetch('/api/architect/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: selectedFile, content: output })
      });
      const data = await res.json();
      if (data.success) {
        setFileContent(output);
        setOutput('');
        alert("System Updated Successfully");
        fetchFiles(); // Refresh timestamps
      } else {
          alert(`Apply Error: ${data.error}`);
      }
    } catch (e) {
      alert("Failed to apply changes");
    }
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-[#0f172a] text-slate-300 font-mono overflow-hidden rounded-xl border border-slate-800 shadow-2xl mx-auto max-w-[1920px]">
      {/* Header */}
      <div className="h-14 border-b border-slate-800 flex items-center px-4 justify-between bg-slate-900 shrink-0">
        <div className="flex items-center gap-3 text-amber-500">
          <div className="p-1.5 bg-amber-500/10 rounded">
            <Cpu size={18} />
          </div>
          <span className="font-bold tracking-[0.2em] text-sm">ARCHITECT // GOD MODE</span>
        </div>
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-slate-500">
                <span className={`w-2 h-2 rounded-full ${status === 'Connected' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
                System Integrity: {status}
            </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar: File Explorer */}
        <div className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex justify-between items-center bg-slate-900/50">
            <span>Project Explorer</span>
            <button onClick={fetchFiles} className="hover:text-amber-500 transition-colors"><RefreshCw size={12} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
            {files.map((f) => (
              <div 
                key={f.path} 
                onClick={() => loadFile(f.path)}
                className={`flex items-center gap-2 p-2.5 rounded cursor-pointer text-xs transition-all border border-transparent ${
                    selectedFile === f.path 
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                    : 'hover:bg-slate-800 text-slate-400'
                }`}
              >
                <FileCode size={14} className={selectedFile === f.path ? "text-amber-500" : "opacity-50"} />
                <span className="truncate flex-1 font-medium">{f.path}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Center: Editor */}
        <div className="flex-1 flex flex-col border-r border-slate-800 bg-[#0f172a] min-w-0">
          <div className="h-10 border-b border-slate-800 flex items-center px-4 bg-slate-900/50 text-xs text-slate-400 justify-between">
            <span className="font-mono">{selectedFile || 'Select a file to inspect'}</span>
            {selectedFile && <span className="text-[10px] uppercase tracking-widest opacity-50">Read Only View</span>}
          </div>
          <div className="flex-1 relative overflow-hidden">
            {loading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-500">
                <Loader2 className="animate-spin text-amber-500" size={32} />
                <span className="text-xs uppercase tracking-widest">Fetching Source...</span>
              </div>
            ) : (
              <textarea 
                className="w-full h-full bg-[#0f172a] text-slate-300 p-6 outline-none text-xs font-mono resize-none leading-relaxed custom-scrollbar selection:bg-amber-500/30"
                value={fileContent}
                readOnly
                spellCheck={false}
                placeholder="// Source code will appear here..."
              />
            )}
          </div>
        </div>

        {/* Right: AI Panel */}
        <div className="w-96 bg-slate-900 flex flex-col border-l border-slate-800 shrink-0">
          <div className="p-3 border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-900/50">
            Gemini Directives
          </div>
          
          <div className="p-4 flex-1 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Prompt</label>
              <textarea 
                className="w-full h-32 bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs text-slate-200 outline-none focus:border-amber-500 transition-colors resize-none placeholder:text-slate-600"
                placeholder="Ex: Refactor this component to use a grid layout, or fix the import error..."
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
              />
              <button 
                onClick={handleGenerate}
                disabled={processing || !selectedFile}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-amber-900/20"
              >
                {processing ? <Loader2 size={14} className="animate-spin" /> : <Terminal size={14} />}
                {processing ? 'Processing...' : 'Execute Directive'}
              </button>
            </div>

            {output && (
              <div className="flex-1 flex flex-col gap-2 min-h-0 border-t border-slate-800 pt-4 mt-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                    <Code size={12} /> Output Ready
                  </span>
                  <button 
                    onClick={handleApply} 
                    className="text-[10px] font-bold bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded hover:bg-emerald-500/20 flex items-center gap-1.5 transition-colors"
                  >
                    <Save size={12} /> Apply Changes
                  </button>
                </div>
                <div className="flex-1 bg-[#0a0f1e] rounded-lg border border-emerald-500/20 p-3 overflow-auto custom-scrollbar relative group">
                  <pre className="text-[10px] text-emerald-300 whitespace-pre-wrap font-mono leading-relaxed">
                    {output}
                  </pre>
                </div>
              </div>
            )}
            
            {!output && (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-700 space-y-2 border-t border-slate-800 mt-2">
                    <ShieldAlert size={32} className="opacity-20" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-center">Ready for Instructions</p>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemArchitect;
