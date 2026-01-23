
import React from 'react';
import { CheckCircle, AlertTriangle, Loader2, Sparkles } from 'lucide-react';
import { WhatsAppTemplate } from '../../types';

interface IssuesTabProps {
  rejectedTemplates: WhatsAppTemplate[];
  handleAiAutoFix: (tpl: WhatsAppTemplate) => void;
  isFixing: string | null;
  handleDeleteTemplate: (tpl: WhatsAppTemplate) => void;
}

export const IssuesTab: React.FC<IssuesTabProps> = ({
  rejectedTemplates, handleAiAutoFix, isFixing, handleDeleteTemplate
}) => {
  return (
    <div className="space-y-4">
        {rejectedTemplates.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
                <CheckCircle size={48} className="mx-auto mb-4 opacity-20" />
                <p className="font-bold uppercase tracking-widest text-sm">No Rejected Templates</p>
            </div>
        ) : (
            rejectedTemplates.map(tpl => (
                <div key={tpl.id} className="bg-rose-50 border border-rose-100 p-6 rounded-2xl flex flex-col md:flex-row gap-6">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="text-rose-600" size={20} />
                            <h3 className="font-bold text-rose-800">{tpl.name}</h3>
                        </div>
                        <p className="text-sm text-rose-700 mb-4 bg-white/50 p-3 rounded-xl border border-rose-100">
                            Reason: <span className="font-bold">{tpl.rejectionReason || 'Unknown Policy Violation'}</span>
                        </p>
                        <div className="text-xs text-slate-600 italic bg-white p-3 rounded-xl border border-slate-100">
                            "{tpl.content}"
                        </div>
                    </div>
                    <div className="flex flex-col justify-center gap-3 min-w-[200px]">
                        <button 
                            onClick={() => handleAiAutoFix(tpl)}
                            disabled={!!isFixing}
                            className="bg-rose-600 text-white py-3 rounded-xl font-bold text-xs uppercase shadow-lg hover:bg-rose-700 flex items-center justify-center gap-2"
                        >
                            {isFixing === tpl.id ? <Loader2 className="animate-spin" /> : <Sparkles size={16} />}
                            AI Auto-Fix
                        </button>
                        <button 
                            onClick={() => handleDeleteTemplate(tpl)}
                            className="bg-white border border-rose-200 text-rose-600 py-3 rounded-xl font-bold text-xs uppercase hover:bg-rose-50"
                        >
                            Delete
                        </button>
                    </div>
                </div>
            ))
        )}
    </div>
  );
};
