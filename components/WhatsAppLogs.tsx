
import React, { useState, useMemo } from 'react';
import { 
  Search, Filter, Smartphone, Calendar, CheckCircle2, 
  Clock, AlertCircle, MessageCircle, ArrowDownLeft, ArrowUpRight, 
  ExternalLink, FileText, Check, User
} from 'lucide-react';
import { WhatsAppLogEntry, MessageStatus } from '../types';

interface WhatsAppLogsProps {
  logs: WhatsAppLogEntry[];
  onViewChat: (phone: string) => void;
}

const WhatsAppLogs: React.FC<WhatsAppLogsProps> = ({ logs, onViewChat }) => {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INBOUND' | 'OUTBOUND'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'READ' | 'DELIVERED' | 'SENT' | 'FAILED'>('ALL');

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

  const StatusBadge = ({ status }: { status: MessageStatus }) => {
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
        return <span className="bg-rose-50 text-rose-600 px-2 py-1 rounded-md text-[10px] font-black flex items-center gap-1 uppercase border border-rose-100">
          <AlertCircle size={10} /> Failed
        </span>;
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
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{log.type}</span>
                                </div>
                            </td>
                            <td className="px-8 py-6">
                                <div className="max-w-[300px]">
                                    <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed italic">
                                        "{log.message}"
                                    </p>
                                </div>
                            </td>
                            <td className="px-8 py-6">
                                <p className="text-sm font-bold text-slate-700">
                                    {new Date(log.timestamp).toLocaleDateString()}
                                </p>
                                <p className="text-[10px] text-slate-400 font-medium">
                                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </td>
                            <td className="px-8 py-6">
                                <StatusBadge status={log.status} />
                            </td>
                            <td className="px-8 py-6 text-right">
                                <button 
                                    onClick={() => onViewChat(log.phoneNumber)}
                                    className="p-2.5 bg-white border border-slate-200 text-slate-400 rounded-xl hover:text-amber-600 hover:border-amber-200 hover:bg-amber-50 transition-all shadow-sm group-hover:scale-110"
                                    title="View Full Chat"
                                >
                                    <ExternalLink size={16} />
                                </button>
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
    </div>
  );
};

export default WhatsAppLogs;
