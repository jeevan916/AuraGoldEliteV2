
import React from 'react';
import { Workflow } from 'lucide-react';
import { SYSTEM_TRIGGER_MAP, REQUIRED_SYSTEM_TEMPLATES } from '../../constants';
import { WhatsAppTemplate } from '../../types';

interface AutomationTabProps {
  templates: WhatsAppTemplate[];
  handleCreateVariant: (trigger: any) => void;
  handleDeployStandard: (trigger: any, def: any) => void;
}

export const AutomationTab: React.FC<AutomationTabProps> = ({ 
  templates, handleCreateVariant, handleDeployStandard 
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SYSTEM_TRIGGER_MAP.map(trigger => {
            const match = templates.find(t => t.name === trigger.defaultTemplateName);
            return (
                <div key={trigger.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                        <div>
                            <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                <Workflow size={16} className="text-indigo-500" />
                                {trigger.label}
                            </h4>
                            <p className="text-[10px] text-slate-500 mt-1">{trigger.description}</p>
                        </div>
                        <div className={`px-2 py-1 rounded text-[9px] font-black uppercase ${match ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                            {match ? 'Active' : 'Inactive'}
                        </div>
                    </div>
                    
                    {match ? (
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-600 font-mono truncate">
                            {match.name}
                        </div>
                    ) : (
                        <div className="p-3 rounded-xl border border-dashed border-slate-300 text-xs text-slate-400 text-center italic">
                            No template linked
                        </div>
                    )}

                    <div className="flex gap-2 mt-auto">
                        <button 
                            onClick={() => handleCreateVariant(trigger)}
                            className="flex-1 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold uppercase hover:bg-indigo-100 transition-colors"
                        >
                            Create Variant
                        </button>
                        {!match && (
                            <button 
                                onClick={() => handleDeployStandard(trigger, REQUIRED_SYSTEM_TEMPLATES.find(t => t.name === trigger.defaultTemplateName))}
                                className="flex-1 py-2 bg-slate-900 text-white rounded-lg text-[10px] font-bold uppercase hover:bg-slate-800 transition-colors"
                            >
                                Deploy Standard
                            </button>
                        )}
                    </div>
                </div>
            );
        })}
    </div>
  );
};
