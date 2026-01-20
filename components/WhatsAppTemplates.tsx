
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  MessageSquare, BrainCircuit, Sparkles, Save, Edit, 
  Copy, RefreshCw, Zap, ShieldAlert, Users, Star, Cloud, CheckCircle, UploadCloud, Globe, Laptop,
  Activity, AlertTriangle, AlertCircle, RefreshCcw, Loader2, Terminal, Check, Server, PlusCircle, Code, Trash2, FolderOpen,
  Wrench, ArrowRight, GitMerge, FileJson, XCircle, Stethoscope, Search, FileWarning, ShieldCheck, Workflow, MousePointerClick, Clock, Layers, Bolt
} from 'lucide-react';
import { WhatsAppTemplate, PsychologicalTactic, RiskProfile, MetaCategory, AppTemplateGroup, SystemTrigger } from '../types';
import { PSYCHOLOGICAL_TACTICS, RISK_PROFILES, REQUIRED_SYSTEM_TEMPLATES, SYSTEM_TRIGGER_MAP } from '../constants';
import { geminiService } from '../services/geminiService';
import { whatsappService } from '../services/whatsappService';

interface WhatsAppTemplatesProps {
  templates: WhatsAppTemplate[];
  onUpdate: (templates: WhatsAppTemplate[]) => void;
}

const WhatsAppTemplates: React.FC<WhatsAppTemplatesProps> = ({ templates, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<'CORE' | 'AUTOMATION' | 'BUILDER' | 'LIBRARY' | 'ISSUES'>('CORE');
  const [promptText, setPromptText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  
  const [templateName, setTemplateName] = useState('');
  const [generatedContent, setGeneratedContent] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MetaCategory>('UTILITY');
  const [selectedGroup, setSelectedGroup] = useState<AppTemplateGroup>('UNCATEGORIZED');
  const [editingStructure, setEditingStructure] = useState<any[]>([]); 
  const [variableExamples, setVariableExamples] = useState<string[]>([]);
  const [highlightEditor, setHighlightEditor] = useState(false); 
  const [aiAnalysisReason, setAiAnalysisReason] = useState<string | null>(null);
  const [editingMetaId, setEditingMetaId] = useState<string | null>(null);

  const [selectedTactic, setSelectedTactic] = useState<PsychologicalTactic>('AUTHORITY');
  const [selectedProfile, setSelectedProfile] = useState<RiskProfile>('REGULAR');

  const [syncingMeta, setSyncingMeta] = useState(false);
  const [pushingMeta, setPushingMeta] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deployingTriggerId, setDeployingTriggerId] = useState<string | null>(null);
  
  const [isFixing, setIsFixing] = useState<string | null>(null);
  const [repairing, setRepairing] = useState(false);
  const [repairLogs, setRepairLogs] = useState<string[]>([]);
  
  const logsEndRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  // Fast Validation Logic
  const handleLiveComplianceCheck = async () => {
      if (!generatedContent || generatedContent.length < 20) return;
      setIsValidating(true);
      try {
          const res = await geminiService.validateAndFixTemplate(generatedContent, templateName, selectedCategory);
          if (!res.isCompliant) {
              setAiAnalysisReason(`Compliance Risk: ${res.explanation}`);
          } else {
              setAiAnalysisReason(null);
          }
      } catch (e) {}
      setIsValidating(false);
  };

  useEffect(() => {
    const timer = setTimeout(handleLiveComplianceCheck, 1500);
    return () => clearTimeout(timer);
  }, [generatedContent]);

  const addLog = (msg: string) => setRepairLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  
  const handleSyncFromMeta = async (silent: boolean = false) => {
      setSyncingMeta(true);
      try {
          const metaTemplates = await whatsappService.fetchMetaTemplates();
          if (metaTemplates) {
              const newTpls: WhatsAppTemplate[] = [];
              const updatedList = [...templates];
              metaTemplates.forEach((mt: any) => {
                  const existingIndex = updatedList.findIndex(t => t.name === mt.name);
                  const bodyComp = mt.components?.find((c: any) => c.type === 'BODY');
                  const text = bodyComp?.text || "No Content";
                  const existingGroup = existingIndex >= 0 ? updatedList[existingIndex].appGroup : undefined;
                  const tplObj: WhatsAppTemplate = {
                      id: mt.id || `meta-${Math.random()}`,
                      name: mt.name,
                      content: text,
                      tactic: 'AUTHORITY',
                      targetProfile: 'REGULAR',
                      isAiGenerated: false,
                      structure: mt.components,
                      source: 'META',
                      status: mt.status,
                      rejectionReason: mt.rejected_reason,
                      category: mt.category,
                      appGroup: existingGroup
                  };
                  if (existingIndex >= 0) {
                      updatedList[existingIndex] = { ...updatedList[existingIndex], status: mt.status, rejectionReason: mt.rejected_reason, structure: mt.components, category: mt.category, content: text };
                  } else {
                      newTpls.push(tplObj);
                  }
              });
              onUpdate([...newTpls, ...updatedList]);
          }
      } catch (e) {} finally { setSyncingMeta(false); }
  };

  const handlePromptGeneration = async (textOverride?: string) => {
      const finalText = textOverride || promptText;
      if (!finalText.trim()) return;
      setIsGenerating(true);
      try {
          const result = await geminiService.generateTemplateFromPrompt(finalText);
          setTemplateName(result.suggestedName);
          setGeneratedContent(result.content);
          setSelectedCategory(result.metaCategory);
          setSelectedGroup(result.appGroup);
          setSelectedTactic(result.tactic);
          setVariableExamples(result.examples);
          setHighlightEditor(true);
          setTimeout(() => setHighlightEditor(false), 2000);
          if (editorRef.current) editorRef.current.scrollIntoView({ behavior: 'smooth' });
      } catch (e: any) {
          alert("Generation failed: " + e.message);
      } finally { setIsGenerating(false); }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-32 flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b pb-4 shrink-0">
        <div>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <Server className="text-amber-500" /> Template Architect
          </h2>
          <p className="text-slate-500 text-sm">Meta Compliance Engine & AI Strategy Generator</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
            {(['CORE', 'AUTOMATION', 'BUILDER', 'LIBRARY'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>
                    {tab}
                </button>
            ))}
        </div>
      </div>

      {activeTab === 'BUILDER' && (
          <div className="flex flex-col lg:grid lg:grid-cols-12 gap-8">
              <div className="lg:col-span-4 space-y-6">
                  <div className="bg-[#0f172a] p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
                      <div className="relative z-10 space-y-6">
                          <div className="flex items-center gap-3">
                              <div className="p-3 bg-blue-500/20 rounded-xl text-blue-400">
                                  <Bolt size={24} />
                              </div>
                              <div>
                                  <h3 className="font-bold text-lg">Gen-AI Strategy</h3>
                                  <p className="text-[9px] uppercase font-black text-slate-500 tracking-widest">Using Gemini 3 Pro</p>
                              </div>
                          </div>
                          <textarea 
                              className="w-full h-32 p-4 bg-white/5 border border-white/10 rounded-2xl text-sm focus:outline-none focus:border-blue-400 transition-all resize-none font-medium"
                              placeholder="Describe a collection strategy... AI will architect the full Meta template."
                              value={promptText}
                              onChange={e => setPromptText(e.target.value)}
                          />
                          <button 
                              onClick={() => handlePromptGeneration()}
                              disabled={isGenerating || !promptText.trim()}
                              className="w-full bg-blue-600 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-600/20 hover:bg-blue-500 transition-all disabled:opacity-50"
                          >
                              {isGenerating ? <Loader2 className="animate-spin" /> : 'Generate Blueprint'}
                          </button>
                      </div>
                      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl"></div>
                  </div>
              </div>

              <div className="lg:col-span-8 space-y-6">
                  <div ref={editorRef} className={`bg-white p-8 rounded-[2.5rem] border shadow-sm transition-all duration-500 ${highlightEditor ? 'border-emerald-400 ring-4 ring-emerald-400/10' : 'border-slate-100'}`}>
                      <div className="flex justify-between items-center mb-6">
                          <h4 className="font-black text-slate-800 text-sm uppercase tracking-wide flex items-center gap-2">
                              <Wrench size={18} className="text-blue-500" /> Draft Architect
                              {isValidating && <Loader2 size={12} className="animate-spin text-blue-500" />}
                          </h4>
                          <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter ${aiAnalysisReason ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                              {aiAnalysisReason ? 'Compliance Check Failed' : 'Compliant Draft'}
                          </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                          <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Unique Handle</label>
                              <input className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-mono text-xs font-bold" value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="template_handle_01" />
                          </div>
                          <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Meta Category</label>
                              <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold" value={selectedCategory} onChange={e => setSelectedCategory(e.target.value as any)}>
                                  <option value="UTILITY">UTILITY (Standard)</option>
                                  <option value="MARKETING">MARKETING (Offers)</option>
                              </select>
                          </div>
                      </div>

                      <div className="space-y-2 mb-6">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Payload Content</label>
                          <textarea className="w-full h-40 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-medium focus:bg-white transition-all outline-none leading-relaxed" value={generatedContent} onChange={e => setGeneratedContent(e.target.value)} />
                      </div>

                      {aiAnalysisReason && (
                          <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3 animate-slideDown">
                              <ShieldAlert className="text-rose-600 shrink-0 mt-1" size={18} />
                              <p className="text-xs text-rose-700 font-bold italic">"{aiAnalysisReason}"</p>
                          </div>
                      )}

                      <div className="flex gap-4">
                          <button onClick={() => {}} className="flex-1 bg-slate-900 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-black transition-all">
                             Deploy to Meta (Live)
                          </button>
                          <button onClick={() => {}} className="px-8 bg-slate-100 text-slate-600 py-4 rounded-xl font-bold text-xs uppercase hover:bg-slate-200">
                             Save Draft
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default WhatsAppTemplates;
