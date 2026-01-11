
import React, { useState, useEffect } from 'react';
import { RefreshCw, ExternalLink, Globe, AlertCircle, Loader2 } from 'lucide-react';
import { proxyService } from '../services/proxyService';

interface WebFrameProps {
  url: string;
  title: string;
  height?: string;
  refreshInterval?: number; // in seconds
}

const WebFrame: React.FC<WebFrameProps> = ({ url, title, height = "400px", refreshInterval }) => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadContent = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await proxyService.fetchText(url);
      if (result.success && result.data) {
        // Inject <base> tag so relative links/images resolve correctly to the original domain
        const baseUrl = new URL(url).origin;
        const sanitized = result.data.replace('<head>', `<head><base href="${baseUrl}/" target="_blank">`);
        setContent(sanitized);
        setLastUpdated(new Date());
      } else {
        setError(result.error || "Failed to load content");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContent();
    if (refreshInterval) {
      const interval = setInterval(loadContent, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [url]);

  return (
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col h-full">
      {/* Browser Header */}
      <div className="bg-slate-50 border-b p-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Globe size={14} className="text-slate-400" />
          <span className="text-xs font-black text-slate-700 uppercase tracking-wide truncate max-w-[200px]" title={title}>
            {title}
          </span>
        </div>
        <div className="flex items-center gap-2">
           {lastUpdated && <span className="text-[9px] text-slate-400 font-mono hidden sm:inline">{lastUpdated.toLocaleTimeString()}</span>}
           <button 
             onClick={loadContent} 
             disabled={loading}
             className="p-1.5 hover:bg-white rounded-lg text-slate-500 transition-colors"
           >
             <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
           </button>
           <a 
             href={url} 
             target="_blank" 
             rel="noreferrer"
             className="p-1.5 hover:bg-white rounded-lg text-slate-500 transition-colors"
           >
             <ExternalLink size={14} />
           </a>
        </div>
      </div>

      {/* Content Area */}
      <div className="relative flex-1 bg-slate-100" style={{ height }}>
        {loading && !content && (
           <div className="absolute inset-0 flex items-center justify-center text-slate-400 gap-2">
             <Loader2 className="animate-spin" /> Loading external feed...
           </div>
        )}
        
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-rose-500 p-6 text-center">
            <AlertCircle size={32} className="mb-2" />
            <p className="font-bold text-sm">Content Blocked or Unavailable</p>
            <p className="text-xs mt-1 text-slate-500">{error}</p>
          </div>
        ) : (
          <iframe 
            title={title}
            srcDoc={content}
            className="w-full h-full border-none bg-white"
            sandbox="allow-scripts allow-same-origin" // Sandboxing for security
          />
        )}
      </div>
      
      <div className="bg-slate-50 p-2 text-[9px] text-slate-400 text-center border-t">
         Powered by AllOrigins Proxy • Content rendered securely via iframe
      </div>
    </div>
  );
};

export default WebFrame;
