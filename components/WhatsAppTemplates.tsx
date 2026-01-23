
import React from 'react';
import { 
  Server, MousePointerClick, BrainCircuit, Wrench, FolderOpen, AlertTriangle 
} from 'lucide-react';
import { WhatsAppTemplate } from '../types';
import { useTemplateManagement } from '../hooks/useTemplateManagement';
import { CoreActionTab } from './templates/CoreActionTab';
import { AutomationTab } from './templates/AutomationTab';
import { BuilderTab } from './templates/BuilderTab';
import { LibraryTab } from './templates/LibraryTab';
import { IssuesTab } from './templates/IssuesTab';

interface WhatsAppTemplatesProps {
  templates: WhatsAppTemplate[];
  onUpdate: (templates: WhatsAppTemplate[]) => void;
}

const WhatsAppTemplates: React.FC<WhatsAppTemplatesProps> = ({ templates, onUpdate }) => {
  const { state, actions, refs } = useTemplateManagement(templates, onUpdate);

  return (
    <div className="space-y-6 animate-fadeIn pb-32 flex flex-col">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b pb-4 shrink-0">
        <div>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <Server className="text-amber-500" /> Template Architect
          </h2>
          <p className="text-slate-500 text-sm">Meta Compliance Engine & AI Strategy Generator</p>
        </div>
        
        <div className="w-full md:w-auto overflow-x-auto pb-1 custom-scrollbar">
            <div className="flex bg-slate-100 p-1 rounded-xl w-max">
                {(['CORE', 'AUTOMATION', 'BUILDER', 'LIBRARY'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => actions.setActiveTab(tab)}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${state.activeTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        {tab === 'CORE' && <MousePointerClick size={14} className="text-amber-500" />}
                        {tab === 'AUTOMATION' && <BrainCircuit size={14} className="text-indigo-500" />}
                        {tab === 'BUILDER' && <Wrench size={14} className="text-emerald-500" />}
                        {tab === 'LIBRARY' && <FolderOpen size={14} className="text-slate-400" />}
                        {tab === 'CORE' ? 'Core Actions' : tab === 'AUTOMATION' ? 'Automation Rules' : tab === 'BUILDER' ? 'AI Builder' : 'Library'}
                    </button>
                ))}
                {state.rejectedTemplates.length > 0 && (
                    <button
                        onClick={() => actions.setActiveTab('ISSUES')}
                        className={`px-4 py-2 rounded-lg text-xs font-black transition-all whitespace-nowrap flex items-center gap-2 ${state.activeTab === 'ISSUES' ? 'bg-rose-600 text-white shadow-md' : 'text-rose-600 bg-rose-50 hover:bg-rose-100'}`}
                    >
                        <AlertTriangle size={12} /> Issues ({state.rejectedTemplates.length})
                    </button>
                )}
            </div>
        </div>
      </div>

      {state.activeTab === 'CORE' && (
        <CoreActionTab 
          templates={templates} 
          repairing={state.repairing}
          handleAutoHeal={actions.handleAutoHeal}
          repairLogs={state.repairLogs}
          logsEndRef={refs.logsEndRef}
        />
      )}

      {state.activeTab === 'AUTOMATION' && (
        <AutomationTab 
          templates={templates}
          handleCreateVariant={actions.handleCreateVariant}
          handleDeployStandard={actions.handleDeployStandard}
        />
      )}
      
      {state.activeTab === 'BUILDER' && (
        <BuilderTab 
          promptText={state.promptText}
          setPromptText={actions.setPromptText}
          isGenerating={state.isGenerating}
          handlePromptGeneration={actions.handlePromptGeneration}
          templateName={state.templateName}
          setTemplateName={actions.setTemplateName}
          generatedContent={state.generatedContent}
          setGeneratedContent={actions.setGeneratedContent}
          selectedCategory={state.selectedCategory}
          setSelectedCategory={actions.setSelectedCategory}
          highlightEditor={state.highlightEditor}
          editingMetaId={state.editingMetaId}
          pushingMeta={state.pushingMeta}
          handleSaveLocalOrDeploy={actions.handleSaveLocalOrDeploy}
          editorRef={refs.editorRef}
        />
      )}

      {state.activeTab === 'LIBRARY' && (
        <LibraryTab 
          groupedTemplates={state.groupedTemplates}
          syncingMeta={state.syncingMeta}
          handleSyncFromMeta={actions.handleSyncFromMeta}
          handleEditTemplate={actions.handleEditTemplate}
          handleDeleteTemplate={actions.handleDeleteTemplate}
        />
      )}

      {state.activeTab === 'ISSUES' && (
        <IssuesTab 
          rejectedTemplates={state.rejectedTemplates}
          handleAiAutoFix={actions.handleAiAutoFix}
          isFixing={state.isFixing}
          handleDeleteTemplate={actions.handleDeleteTemplate}
        />
      )}
      
    </div>
  );
};

export default WhatsAppTemplates;
