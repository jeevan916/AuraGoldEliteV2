
import React from 'react';
import { BrainCircuit, Sparkles, Loader2, Edit, Wrench, UploadCloud, Save } from 'lucide-react';
import { MetaCategory } from '../../types';

interface BuilderTabProps {
  promptText: string;
  setPromptText: (s: string) => void;
  isGenerating: boolean;
  handlePromptGeneration: () => void;
  templateName: string;
  setTemplateName: (s: string) => void;
  generatedContent: string;
  setGeneratedContent: (s: string) => void;
  selectedCategory: MetaCategory;
  setSelectedCategory: (s: MetaCategory) => void;
  highlightEditor: boolean;
  editingMetaId: string | null;
  pushingMeta: boolean;
  handleSaveLocalOrDeploy: (type: 'LOCAL' | 'META') => void;
  editorRef: React.RefObject<HTMLDivElement | null>;
}

export const BuilderTab: React.FC<BuilderTabProps> = ({
  promptText, setPromptText, isGenerating, handlePromptGeneration,
  templateName, setTemplateName, generatedContent, setGeneratedContent,
  selectedCategory, setSelectedCategory, highlightEditor, editingMetaId,
  pushingMeta, handleSaveLocalOrDeploy, editorRef
}) => {
  return (
    <div className="flex flex-col lg:grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
            <div className="bg-gradient-to-br from-indigo-50 to-white p-6 rounded-3xl border border-indigo-100 shadow-sm relative overflow-hidden">
                <div className="flex items-center gap-3 mb-4 relative z-10">
                    <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
                        <BrainCircuit size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-slate-800">Generative Architect</h3>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wide">AI Creates, Names & Groups</p>
                    </div>
                </div>
                
                <div className="space-y-4 relative z-10">
                    <textarea 
                        className="w-full h-32 p-3 bg-white border border-indigo-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner resize-none"
                        placeholder="Describe your template needs..."
                        value={promptText}
                        onChange={(e) => setPromptText(e.target.value)}
                    />
                    <button 
                        onClick={handlePromptGeneration}
                        disabled={isGenerating || !promptText.trim()}
                        className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-sm shadow-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                    >
                        {isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles size={16} className="text-indigo-300"/>}
                        {isGenerating ? 'Designing...' : 'Generate Template'}
                    </button>
                </div>
            </div>
        </div>

        <div className="lg:col-span-8 space-y-6">
            <div ref={editorRef} className={`bg-white p-6 rounded-2xl border shadow-sm animate-fadeIn border-l-4 border-l-blue-500 ${highlightEditor ? 'ring-4 ring-emerald-400 ring-opacity-50 transition-all duration-500' : ''}`}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                      <h4 className="font-bold text-slate-800 flex items-center gap-2">
                          <Edit size={16} className="text-blue-500" /> Template Editor
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">Review AI suggestions before deploying.</p>
                  </div>
                  {editingMetaId && <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold border border-amber-200 flex items-center gap-1"><Wrench size={10}/> Editing Existing</span>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400">Template Name</label>
                      <input 
                          value={templateName}
                          onChange={e => setTemplateName(e.target.value)}
                          className={`w-full font-mono text-sm border rounded-lg p-2 outline-none focus:border-blue-500 ${editingMetaId ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                          placeholder="template_name"
                          readOnly={!!editingMetaId}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400">Meta Category</label>
                      <select 
                          value={selectedCategory} 
                          onChange={e => setSelectedCategory(e.target.value as MetaCategory)}
                          className="w-full text-sm border rounded-lg p-2 outline-none focus:border-blue-500"
                      >
                          <option value="UTILITY">UTILITY (Transactional)</option>
                          <option value="MARKETING">MARKETING (Promotional)</option>
                          <option value="AUTHENTICATION">AUTHENTICATION (OTP)</option>
                      </select>
                    </div>
                </div>

                <label className="text-[10px] font-bold uppercase text-slate-400">Message Body</label>
                <textarea 
                    value={generatedContent} 
                    onChange={e => setGeneratedContent(e.target.value)}
                    className="w-full h-32 p-3 bg-slate-50 rounded-xl text-sm mb-4 outline-none border focus:border-blue-500 font-mono"
                    placeholder="Hello {{1}}, your order is ready..."
                />
                
                <div className="flex flex-col sm:flex-row gap-3">
                    <button 
                      onClick={() => handleSaveLocalOrDeploy('META')} 
                      disabled={pushingMeta}
                      className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold text-xs shadow-md hover:bg-emerald-700 flex items-center justify-center gap-2"
                    >
                       {pushingMeta ? <Loader2 className="animate-spin" /> : <UploadCloud size={16} />}
                       {editingMetaId ? 'Update Meta Template' : 'Deploy to Meta'}
                    </button>
                    <button 
                      onClick={() => handleSaveLocalOrDeploy('LOCAL')} 
                      className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold text-xs hover:bg-slate-200 flex items-center justify-center gap-2"
                    >
                       <Save size={16} /> Save Local Draft
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
};
