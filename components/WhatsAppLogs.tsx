import React, { useState, useMemo } from 'react';
import { 
  Search, Filter, Smartphone, Calendar, CheckCircle2, 
  Clock, AlertCircle, MessageCircle, ArrowDownLeft, ArrowUpRight, 
  ExternalLink, FileText, Check, User, Edit2, X, Info, Image as ImageIcon
} from 'lucide-react';
import { WhatsAppLogEntry, MessageStatus } from '../types';
import { whatsappService } from '../services/whatsappService';
import { MetaRawResponseModal } from './MetaRawResponseModal';

const getLogMediaUrl = (log: WhatsAppLogEntry): string | null => {
  if (log.mediaUrl) return log.mediaUrl;
  if (log.mediaId) return `/api/whatsapp/media/${log.mediaId}`;
  
  const raw = log.rawResponse || (log as any).raw || {};
  const mediaId = raw.image?.id || raw.document?.id || raw.sticker?.id;
  if (mediaId) {
    return `/api/whatsapp/media/${mediaId}`;
  }

  if (log.message && (log.message.startsWith('/uploads/') || log.message.startsWith('http://') || log.message.startsWith('https://')) && (log.message.match(/\.(jpeg|jpg|gif|png|webp)/i))) {
    return log.message;
  }

  return null;
};

interface WhatsAppLogsProps {
  logs: WhatsAppLogEntry[];
  onViewChat: (phone: string) => void;
  onAddLog?: (log: WhatsAppLogEntry) => void;
}

const WhatsAppLogs: React.FC<WhatsAppLogsProps> = ({ logs, onViewChat, onAddLog }) => {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INBOUND' | 'OUTBOUND'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'READ' | 'DELIVERED' | 'SENT' | 'FAILED'>('ALL');

  const [editingLog, setEditingLog] = useState<WhatsAppLogEntry | null>(null);
  const [editText, setEditText] = useState('');
  const [editError, setEditError] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [rawModalLog, setRawModalLog] = useState<WhatsAppLogEntry | null>(null);

  const handleStartEdit = (log: WhatsAppLogEntry) => {
    setEditingLog(log);
    setEditText(log.message);
    setEditError('');
    setEditSubmitting(false);
  };

  const handleSaveEdit = async () => {
    if (!editingLog) return;
    setEditSubmitting(true);
    setEditError('');
    try {
      const res = await whatsappService.editMessage(editingLog.id, editText);
      if (res.success) {
        if (onAddLog) {
          onAddLog({
            ...editingLog,
            message: editText,
            isEdited: true,
            editedAt: new Date().toISOString()
          });
        }
        setEditingLog(null);
      } else {
        setEditError(res.error || "Failed to edit message");
      }
    } catch (e: any) {
      setEditError(e.message || "An error occurred during editing");
    } finally {
      setEditSubmitting(false);
    }
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch = log.customerName.toLowerCase().includes(search.toLowerCase()) || 
                           log.phoneNumber.includes(search) || 
                           log.message.toLowerCase().includes(search.toLowerCase());
      
      const matchesType = typeFilter === 'ALL' || 
                         (typeFilter === 'INBOUND' && log.direction === 'inbound') ||
                         (typeFilter === 'OUTBOUND' && log.direction === 'outbound');
      
      const matchesStatus = statusFilter === 'ALL' || log.status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [logs, search, typeFilter, statusFilter]);

  const StatusBadge = ({ status, log }: { status: MessageStatus; log?: WhatsAppLogEntry }) => {
    switch (status) {
      case 'READ':
        return <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded-md text-[10px] font-black flex items-center gap-1 uppercase border border-blue-100">
          <CheckCircle2 size={10} /> Read
        </span>;
      case 'DELIVERED':
        return <span className="bg-emerald-50 text-emerald-600 px-2 py-1 rounded-md text-[10px] font-black flex items-center gap-1 uppercase border border-emerald-100">
          <Check size={10} /> Delivered
        </span>;
      case 'SENT':
        return <span className="bg-slate-50 text-slate-500 px-2 py-1 rounded-md text-[10px] font-black flex items-center gap-1 uppercase border border-slate-100">
          <Check size={10} /> Sent
        </span>;
      case 'FAILED':
        return <button 
          onClick={(e) => {
            e.stopPropagation();
            if (log) setRawModalLog(log);
          }}
          className="bg-rose-50 text-rose-600 hover:bg-rose-100 hover:border-rose-300 px-2.5 py-1 rounded-md text-[10px] font-black flex items-center gap-1.5 uppercase border border-rose-200 transition-all cursor-pointer shadow-xs group/failed"
          title="Click to view raw JSON Meta response"
        >
          <AlertCircle size={10} className="text-rose-600" /> 
          <span>Failed</span>
          <Info size={10} className="text-rose-500 opacity-80 group-hover/failed:scale-125 transition-transform ml-0.5" />
        </button>;
      default:
        return <span className="bg-amber-50 text-amber-600 px-2 py-1 rounded-md text-[10px] font-black flex items-center gap-1 uppercase border border-amber-100">
          <Clock size={10} /> {status}
        </span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
         <div className="bg-white p-5 rounded-2xl border shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><Smartphone size={20}/></div>
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Messages</p>
                <p className="text-xl font-black text-slate-800">{logs.length}</p>
            </div>
         </div>
         <div className="bg-white p-5 rounded-2xl border shadow-sm flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><ArrowUpRight size={20}/></div>
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Outbound</p>
                <p className="text-xl font-black text-slate-800">{logs.filter(l => l.direction === 'outbound').length}</p>
            </div>
         </div>
         <div className="bg-white p-5 rounded-2xl border shadow-sm flex items-center gap-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl"><ArrowDownLeft size={20}/></div>
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inbound</p>
                <p className="text-xl font-black text-slate-800">{logs.filter(l => l.direction === 'inbound').length}</p>
            </div>
         </div>
         <div className="bg-white p-5 rounded-2xl border shadow-sm flex items-center gap-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl"><MessageCircle size={20}/></div>
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Read Rate</p>
                <p className="text-xl font-black text-slate-800">
                    {Math.round((logs.filter(l => l.status === 'READ').length / (logs.filter(l => l.direction === 'outbound').length || 1)) * 100)}%
                </p>
            </div>
         </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border shadow-sm flex flex-col md:flex-row gap-4 items-center">
         <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
                type="text" 
                placeholder="Search by customer, number or message..." 
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                value={search}
                onChange={e => setSearch(e.target.value)}
            />
         </div>
         <div className="flex gap-2 w-full md:w-auto">
             <select 
                className="flex-1 md:flex-none px-3 py-2.5 bg-slate-50 border-none rounded-xl text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-amber-500"
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value as any)}
             >
                <option value="ALL">All Types</option>
                <option value="OUTBOUND">Outbound</option>
                <option value="INBOUND">Inbound</option>
             </select>
             <select 
                className="flex-1 md:flex-none px-3 py-2.5 bg-slate-50 border-none rounded-xl text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-amber-500"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
             >
                <option value="ALL">All Status</option>
                <option value="SENT">Sent</option>
                <option value="DELIVERED">Delivered</option>
                <option value="READ">Read</option>
                <option value="FAILED">Failed</option>
             </select>
         </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-[2rem] border shadow-xl overflow-hidden">
         <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead className="bg-slate-50/80 text-[10px] font-black uppercase text-slate-400 tracking-[0.1em] border-b">
                    <tr>
                        <th className="px-8 py-5">Customer / Contact</th>
                        <th className="px-8 py-5">Direction / Type</th>
                        <th className="px-8 py-5">Message Content</th>
                        <th className="px-8 py-5">Timestamp</th>
                        <th className="px-8 py-5">Status</th>
                        <th className="px-8 py-5 text-right">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {filteredLogs.map(log => (
                        <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="px-8 py-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-400">
                                        {log.customerName.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800 leading-none mb-1.5">{log.customerName}</p>
                                        <p className="text-[10px] text-slate-400 font-mono tracking-tighter">{log.phoneNumber}</p>
                                    </div>
                                </div>
                            </td>
                            <td className="px-8 py-6">
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center gap-1.5">
                                        {log.direction === 'inbound' ? 
                                            <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter">Inbound</span> : 
                                            <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter">Outbound</span>
                                        }
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{log.type}</span>
                                        {log.direction === 'outbound' && log.sentBy && (
                                            <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter border border-slate-200">
                                                By: {log.sentBy}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </td>
                            <td className="px-8 py-6">
                                <div className="max-w-[300px]">
                                    {(() => {
                                        const mediaSrc = getLogMediaUrl(log);
                                        if (mediaSrc) {
                                            return (
                                                <div className="flex items-center gap-2.5 my-1">
                                                    <a href={mediaSrc} target="_blank" rel="noopener noreferrer" className="relative group shrink-0">
                                                        <img src={mediaSrc} alt="Thumbnail" className="w-12 h-12 rounded-lg object-cover border border-slate-200 group-hover:opacity-80 transition-opacity shadow-sm" />
                                                    </a>
                                                    <div>
                                                        <span className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                                                            <ImageIcon size={12} /> Image Received
                                                        </span>
                                                        <a href={mediaSrc} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-600 font-bold hover:underline block mt-0.5">
                                                            View Full Size ↗
                                                        </a>
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return (
                                            <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed italic">
                                                "{log.message}"
                                            </p>
                                        );
                                    })()}
                                    {log.isEdited && (
                                        <span className="inline-flex items-center gap-1 text-[9px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-black uppercase tracking-tighter border border-emerald-100 mt-1">
                                            Edited
                                        </span>
                                    )}
                                </div>
                            </td>
                            <td className="px-8 py-6">
                                <p className="text-sm font-bold text-slate-700">
                                    {new Date(log.timestamp).toLocaleDateString('en-IN')}
                                </p>
                                <p className="text-[10px] text-slate-400 font-medium">
                                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </td>
                            <td className="px-8 py-6">
                                <StatusBadge status={log.status} log={log} />
                            </td>
                            <td className="px-8 py-6 text-right">
                                <div className="flex items-center justify-end gap-2">
                                    {log.status === 'FAILED' && (
                                        <button 
                                            onClick={() => setRawModalLog(log)}
                                            className="p-2.5 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl hover:bg-rose-100 hover:border-rose-300 transition-all shadow-sm group-hover:scale-110 flex items-center gap-1 cursor-pointer"
                                            title="View Complete Raw Meta API Response JSON"
                                        >
                                            <Info size={16} />
                                        </button>
                                    )}
                                    {log.direction === 'outbound' && (
                                        <button 
                                            onClick={() => handleStartEdit(log)}
                                            className="p-2.5 bg-white border border-slate-200 text-slate-400 rounded-xl hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 transition-all shadow-sm group-hover:scale-110"
                                            title="Edit Sent Message"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                    )}
                                    <button 
                                        onClick={() => onViewChat(log.phoneNumber)}
                                        className="p-2.5 bg-white border border-slate-200 text-slate-400 rounded-xl hover:text-amber-600 hover:border-amber-200 hover:bg-amber-50 transition-all shadow-sm group-hover:scale-110"
                                        title="View Full Chat"
                                    >
                                        <ExternalLink size={16} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    {filteredLogs.length === 0 && (
                        <tr>
                            <td colSpan={6} className="py-24 text-center">
                                <div className="max-w-xs mx-auto space-y-3 opacity-20">
                                    <MessageCircle className="w-16 h-16 mx-auto text-slate-400" />
                                    <p className="font-black uppercase tracking-widest text-sm">No Communication Logs</p>
                                </div>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
         </div>
      </div>

      {editingLog && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-fadeIn">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Edit2 size={16} className="text-emerald-600" />
                Edit Sent WhatsApp Message
              </h3>
              <button onClick={() => setEditingLog(null)} className="text-slate-400 hover:text-rose-500">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3.5 rounded-xl leading-relaxed">
                <strong>Important Note:</strong> Editing sent messages updates the message body on the customer's WhatsApp device via Meta APIs. Best used to retract incorrect messages or fix minor typos.
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  Recipient
                </label>
                <p className="text-sm font-bold text-slate-700">
                  {editingLog.customerName} ({editingLog.phoneNumber})
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    Message Body
                  </label>
                  <button 
                    type="button" 
                    onClick={() => setEditText('This message was retracted.')}
                    className="text-[10px] font-bold text-emerald-600 hover:underline lowercase"
                  >
                    Use Retraction Notice
                  </button>
                </div>
                <textarea
                  className="w-full h-32 border border-slate-200 rounded-xl p-3 text-sm focus:border-emerald-500 outline-none transition-colors leading-relaxed"
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  placeholder="Enter corrected message..."
                />
              </div>

              {editError && (
                <p className="text-xs font-semibold text-rose-500 bg-rose-50 border border-rose-100 p-2.5 rounded-lg">
                  {editError}
                </p>
              )}
            </div>
            <div className="p-4 border-t bg-slate-50 flex gap-3">
              <button
                onClick={() => setEditingLog(null)}
                className="flex-1 bg-white border border-slate-200 text-slate-700 py-3 rounded-xl font-bold text-sm hover:bg-slate-50 transition-colors"
                disabled={editSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-emerald-700 disabled:opacity-50 shadow-lg transition-colors"
                disabled={editSubmitting || !editText.trim()}
              >
                {editSubmitting ? 'Saving Changes...' : 'Save Overwrite'}
              </button>
            </div>
          </div>
        </div>
      )}

      {rawModalLog && (
        <MetaRawResponseModal 
          log={rawModalLog} 
          onClose={() => setRawModalLog(null)} 
        />
      )}
    </div>
  );
};

export default WhatsAppLogs;
