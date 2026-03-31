
import React from 'react';
import { Workflow, Play, Settings } from 'lucide-react';
import { SYSTEM_TRIGGER_MAP, REQUIRED_SYSTEM_TEMPLATES } from '../../constants';
import { WhatsAppTemplate } from '../../types';
import { VariantGeneratorModal } from './VariantGeneratorModal';

interface AutomationTabProps {
  templates: WhatsAppTemplate[];
  handleCreateVariant: (trigger: any) => void;
  handleDeployStandard: (trigger: any, def: any) => void;
  handleGenerateVariant: (goal: string) => void;
  setShowVariantModal: (show: boolean) => void;
  isGeneratingVariant: boolean;
  showVariantModal: boolean;
  variantTrigger: any;
}

export const AutomationTab: React.FC<AutomationTabProps> = ({ 
  templates, handleCreateVariant, handleDeployStandard, handleGenerateVariant, setShowVariantModal, isGeneratingVariant, showVariantModal, variantTrigger
}) => {
  return (
    <div className="grid grid-cols-1 gap-4">
        {SYSTEM_TRIGGER_MAP.map(trigger => {
            const match = templates.find(t => t.name === trigger.defaultTemplateName);
            return (
                <div key={trigger.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-4">
                        <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                            <Workflow size={16} className="text-indigo-500" />
                            {trigger.label}
                        </h4>
                        <p className="text-[10px] text-slate-500 mt-1">{trigger.description}</p>
                    </div>
                    
                    <div className="col-span-3">
                        <select className="w-full p-2 text-xs border border-slate-200 rounded-lg bg-white">
                            <option>Standard Variant</option>
                        </select>
                    </div>

                    <div className="col-span-2 flex justify-center">
                        <div className={`px-2 py-1 rounded text-[9px] font-black uppercase ${match ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                            {match ? 'Active' : 'Inactive'}
                        </div>
                    </div>

                    <div className="col-span-3 flex gap-2 justify-end">
                        <button className="p-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100" title="Simulate Trigger">
                            <Play size={14} />
                        </button>
                        <button 
                            onClick={() => handleCreateVariant(trigger)}
                            className="px-3 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold uppercase hover:bg-indigo-100 transition-colors"
                        >
                            Create Variant
                        </button>
                    </div>
                </div>
            );
        })}
        {variantTrigger && (
            <VariantGeneratorModal 
                isOpen={showVariantModal}
                onClose={() => setShowVariantModal(false)}
                trigger={variantTrigger}
                onGenerate={handleGenerateVariant}
                isGenerating={isGeneratingVariant}
            />
        )}
    </div>
  );
};
