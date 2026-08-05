import React, { useState } from 'react';
import { 
  X, Copy, Check, AlertCircle, Info, Smartphone, 
  ShieldAlert, Terminal, FileJson
} from 'lucide-react';
import { WhatsAppLogEntry } from '../types';

interface MetaRawResponseModalProps {
  log: WhatsAppLogEntry | null;
  onClose: () => void;
}

export const MetaRawResponseModal: React.FC<MetaRawResponseModalProps> = ({ log, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!log) return null;

  // Extract raw JSON payload or build comprehensive diagnostic object
  const rawData = log.rawResponse || log.metaError || {
    status: log.status,
    messageId: log.id,
    recipient: log.phoneNumber,
    customerName: log.customerName,
    type: log.type,
    direction: log.direction,
    messageContent: log.message,
    timestamp: log.timestamp,
    error: log.metaError || "Meta Cloud API returned failure status or undeliverable event.",
    metaTraceId: (log as any).fbtrace_id || null
  };

  const jsonString = JSON.stringify(rawData, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Extract error details if present
  const errorCode = rawData?.error?.code || rawData?.code || rawData?.errors?.[0]?.code;
  const errorMessage = rawData?.error?.message || rawData?.message || rawData?.errors?.[0]?.message || (typeof log.metaError === 'string' ? log.metaError : null);

  // Common Meta error tips
  const getTroubleshootingTip = (code?: number | string) => {
    const codeNum = Number(code);
    switch (codeNum) {
      case 131026:
        return "Message Undeliverable: The recipient number is not registered on WhatsApp or has blocked business messaging.";
      case 132001:
        return "Template Translation Missing: The requested template or language code does not exist or is not approved in Meta WABA Manager.";
      case 131047:
        return "24-Hour Re-engagement Window Expired: Outbound non-template messages cannot be sent outside the 24h window. Use an approved Meta Template.";
      case 190:
        return "Access Token Expired: The Meta WhatsApp Business access token is invalid or expired. Update WHATSAPP_BUSINESS_TOKEN in Settings.";
      case 131009:
        return "Parameter Mismatch: The number of variables in the request does not match the parameters configured in Meta Business Manager.";
      default:
        return "Check your Meta Business Manager console, WABA webhook events, or verify recipient phone number formatting.";
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 bg-slate-900 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <ShieldAlert size={20} />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                Meta Raw API Response
              </h3>
              <p className="text-xs text-slate-400 font-mono truncate max-w-md">
                ID: {log.id}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">Customer</span>
              <p className="font-bold text-xs text-slate-800 truncate">{log.customerName}</p>
              <p className="text-[10px] text-slate-400 font-mono truncate">{log.phoneNumber}</p>
            </div>

            <div className="bg-rose-50 p-3.5 rounded-2xl border border-rose-100">
              <span className="text-[10px] font-black uppercase text-rose-400 tracking-wider block mb-1">Status</span>
              <span className="inline-flex items-center gap-1 text-xs font-black text-rose-600 uppercase">
                <AlertCircle size={12} /> {log.status}
              </span>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">Type / Direction</span>
              <p className="font-bold text-xs text-slate-800 uppercase">{log.type}</p>
              <p className="text-[10px] text-slate-400 uppercase font-bold">{log.direction}</p>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">Timestamp</span>
              <p className="font-bold text-xs text-slate-800">
                {new Date(log.timestamp).toLocaleDateString('en-IN')}
              </p>
              <p className="text-[10px] text-slate-400 font-medium">
                {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          {/* Diagnostic Summary Banner */}
          {(errorCode || errorMessage) && (
            <div className="bg-amber-50 border border-amber-200/80 p-4 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-amber-800 font-bold text-xs">
                <Info size={16} className="text-amber-600 shrink-0" />
                <span>Meta Error Code: {errorCode ? `#${errorCode}` : 'API Error'}</span>
              </div>
              {errorMessage && (
                <p className="text-xs text-amber-900 font-medium leading-relaxed pl-6">
                  {errorMessage}
                </p>
              )}
              {errorCode && (
                <p className="text-[11px] text-amber-700 font-medium italic pl-6 border-t border-amber-200/60 pt-2 mt-2">
                  <strong className="font-bold">Recommendation:</strong> {getTroubleshootingTip(errorCode)}
                </p>
              )}
            </div>
          )}

          {/* Message text snippet */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60 space-y-1">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Message Attempted</span>
            <p className="text-xs text-slate-700 italic leading-relaxed">"{log.message}"</p>
          </div>

          {/* Raw JSON Code Block */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <FileJson size={14} className="text-emerald-600" />
                Complete Raw Response JSON
              </label>
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-200 transition-colors cursor-pointer"
              >
                {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                <span>{copied ? 'Copied!' : 'Copy Raw JSON'}</span>
              </button>
            </div>

            <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 p-4 shadow-inner">
              <pre className="text-xs font-mono text-emerald-400 overflow-x-auto max-h-64 leading-relaxed whitespace-pre-wrap break-all">
                {jsonString}
              </pre>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
          <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
            <Terminal size={12} /> Data captured directly from Meta Cloud API Webhook / HTTP response
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
          >
            Close Diagnostics
          </button>
        </div>

      </div>
    </div>
  );
};
