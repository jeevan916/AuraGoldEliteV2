
import React from 'react';
import { RefreshCw, FolderOpen, Cloud, Laptop, Edit, Trash2, AlertOctagon } from 'lucide-react';
import { WhatsAppTemplate } from '../../types';

interface LibraryTabProps {
  groupedTemplates: Record<string, WhatsAppTemplate[]>;
  syncingMeta: boolean;
  handleSyncFromMeta: (silent: boolean) => void;
  handleEditTemplate: (tpl: WhatsAppTemplate) => void;
  handleDeleteTemplate: (tpl: WhatsAppTemplate) => void;
}

export const LibraryTab: React.FC<LibraryTabProps> = ({
  groupedTemplates, syncingMeta, handleSyncFromMeta, handleEditTemplate, handleDeleteTemplate
}) => {
  const getStatusColor = (status?: string) => {
      switch(status) {
          case 'APPROVED': return 'bg-emerald-100 text-emerald-700';
          case 'REJECTED': return 'bg-rose-100 text-rose-700';
          case 'PENDING': return 'bg-amber-100 text-amber-700';
          case 'MISSING': return 'bg-slate-800 text-white animate-pulse';
          default: return 'bg-slate-100 text-slate-500';
      }
  };

  const getGroupLabel = (key: string) => {
      return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  return (
    <div className="space-y-8">
        <div className="flex justify-between items-center bg-white p-4 rounded-2xl border shadow-sm">
            <div>
                <h3 className="font-bold text-slate-800">Template Registry</h3>
                <p className="text-xs text-slate-500">Local & Meta Synced Templates</p>
            </div>
            <button 
                onClick={() => handleSyncFromMeta(false)} 
                disabled={syncingMeta}
                className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-50 flex items-center gap-2"
            >
                <RefreshCw size={14} className={syncingMeta ? 'animate-spin' : ''} />
                {syncingMeta ? 'Syncing...' : 'Sync from Meta'}
            </button>
        </div>

        {Object.entries(groupedTemplates).map(([group, rawList]) => {
            const groupTemplates = rawList as WhatsAppTemplate[];
            if (groupTemplates.length === 0) return null;
            return (
                <div key={group} className="space-y-3">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                        <FolderOpen size={12} /> {getGroupLabel(group)}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {groupTemplates.map(tpl => (
                            <div key={tpl.id} className={`bg-white p-5 rounded-2xl border shadow-sm hover:shadow-md transition-all group relative ${tpl.status === 'MISSING' ? 'border-rose-300 bg-rose-50' : 'border-slate-100'}`}>
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-2">
                                        {tpl.source === 'META' ? <Cloud size={14} className="text-blue-400" /> : <Laptop size={14} className="text-slate-400" />}
                                        <span className="font-bold text-sm text-slate-800 truncate max-w-[150px]" title={tpl.name}>{tpl.name}</span>
                                    </div>
                                    <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full ${getStatusColor(tpl.status)}`}>
                                        {tpl.status === 'MISSING' ? 'MISSING ON META' : (tpl.status || 'DRAFT')}
                                    </span>
                                </div>
                                
                                <p className="text-xs text-slate-500 line-clamp-3 mb-4 h-12 leading-relaxed">
                                    {tpl.content}
                                </p>

                                {tpl.status === 'MISSING' && (
                                    <div className="mb-2 text-[9px] text-rose-600 flex items-center gap-1 font-bold">
                                        <AlertOctagon size={10} /> Disparity: Not found on Meta
                                    </div>
                                )}

                                <div className="flex gap-2 border-t pt-3">
                                    <button onClick={() => handleEditTemplate(tpl)} className="flex-1 py-2 rounded-lg bg-slate-50 text-slate-600 text-[10px] font-bold uppercase hover:bg-slate-100 flex items-center justify-center gap-1">
                                        <Edit size={12} /> {tpl.status === 'MISSING' ? 'Re-Deploy' : 'Edit'}
                                    </button>
                                    <button onClick={() => handleDeleteTemplate(tpl)} className="py-2 px-3 rounded-lg bg-white border border-slate-200 text-rose-500 hover:bg-rose-50 hover:border-rose-200 transition-colors">
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )
        })}
    </div>
  );
};
