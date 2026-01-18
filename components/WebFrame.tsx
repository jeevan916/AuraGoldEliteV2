
import React, { useState } from 'react';
import { ExternalLink, Globe, Loader2 } from 'lucide-react';

interface WebFrameProps {
  url: string;
  title: string;
  height?: string;
  refreshInterval?: number; // Ignored in simple mode
}

const WebFrame: React.FC<WebFrameProps> = ({ url, title, height = "400px" }) => {
  const [loading, setLoading] = useState(true);

  return (
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="bg-slate-50 border-b p-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Globe size={14} className="text-slate-400" />
          <span className="text-xs font-black text-slate-700 uppercase tracking-wide truncate max-w-[200px]" title={title}>
            {title}
          </span>
        </div>
        <div className="flex items-center gap-2">
           <a 
             href={url} 
             target="_blank" 
             rel="noreferrer"
             className="flex items-center gap-1 bg-white border px-2 py-1 rounded-lg text-[9px] font-bold text-slate-600 hover:text-blue-600 transition-colors"
           >
             <ExternalLink size={10} /> Open Externally
           </a>
        </div>
      </div>

      {/* Content Area - Direct Iframe */}
      <div className="relative flex-1 bg-slate-100" style={{ height }}>
        {loading && (
           <div className="absolute inset-0 flex items-center justify-center text-slate-400 gap-2 z-0">
             <Loader2 className="animate-spin" /> Loading...
           </div>
        )}
        
        <iframe 
            title={title}
            src={url}
            className="w-full h-full border-none bg-white relative z-10"
            sandbox="allow-scripts allow-same-origin allow-popups"
            onLoad={() => setLoading(false)}
        />
      </div>
      
      <div className="bg-slate-50 p-2 text-[9px] text-slate-400 text-center border-t">
         If content fails to load due to security settings, use the 'Open Externally' button.
      </div>
    </div>
  );
};

export default WebFrame;
