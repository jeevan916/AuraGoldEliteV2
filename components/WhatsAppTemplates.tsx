
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  MessageSquare, BrainCircuit, Sparkles, Save, Edit, 
  Copy, RefreshCw, Zap, ShieldAlert, Users, Star, Cloud, CheckCircle, UploadCloud, Globe, Laptop,
  Activity, AlertTriangle, AlertCircle, RefreshCcw, Loader2, Terminal, Check, Server, PlusCircle, Code, Trash2, FolderOpen,
  Wrench, ArrowRight, GitMerge, FileJson, XCircle, Stethoscope, Search, FileWarning, ShieldCheck, Workflow, MousePointerClick, Clock, Layers
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
  const [isFixing, setIsFixing] = useState<string | null>(null);
  const [repairing, setRepairing] = useState(false);
  const [repairLogs, setRepairLogs] = useState<string[]>([]);
  
  const logsEndRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const rejectedTemplates = useMemo(() => (templates || []).filter(t => t && t.status === 'REJECTED'), [templates]);

  useEffect(() => {
    if (logsEndRef.current) logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [repairLogs]);

  const addLog = (msg: string) => setRepairLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  
  function inferGroup(t: WhatsAppTemplate): AppTemplateGroup {
      if (!t) return 'UNCATEGORIZED';
      const name = t.name || '';
      const content = t.content || '';
      const txt = (name + content).toLowerCase();
      if (txt.includes('setu') || txt.includes('upi')) return 'SETU_PAYMENT';
      if (txt.includes('payment') || txt.includes('due') || txt.includes('pay')) return 'PAYMENT_COLLECTION';
      if (txt.includes('order') || txt.includes('ship') || txt.includes('delivery')) return 'ORDER_STATUS';
      if (txt.includes('offer') || txt.includes('sale') || txt.includes('exclusive')) return 'MARKETING_PROMO';
      if (txt.includes('help') || txt.includes('support') || txt.includes('welcome')) return 'GENERAL_SUPPORT';
      return 'UNCATEGORIZED';
  }

  const groupedTemplates = useMemo(() => {
      const groups: Record<string, WhatsAppTemplate[]> = {
          'SETU_PAYMENT': [], 'PAYMENT_COLLECTION': [], 'ORDER_STATUS': [],
          'MARKETING_PROMO': [], 'GENERAL_SUPPORT': [], 'SYSTEM_NOTIFICATIONS': [],
          'UNCATEGORIZED': []
      };
      (templates || []).forEach(t => {
          if (!t) return;
          const group = t.appGroup || inferGroup(t);
          if (groups[group]) groups[group].push(t);
          else groups['UNCATEGORIZED'].push(t);
      });
      return groups;
  }, [templates]);

  const handleSyncFromMeta = async (silent: boolean = false) => {
      setSyncingMeta(true);
      if(!silent) addLog("Syncing templates from Meta...");
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
                      name: mt.name, content: text, tactic: 'AUTHORITY', targetProfile: 'REGULAR',
                      isAiGenerated: false, structure: mt.components, source: 'META',
                      status: mt.status, rejectionReason: mt.rejected_reason, category: mt.category,
                      appGroup: existingGroup
                  };
                  if (existingIndex >= 0) {
                      updatedList[existingIndex] = { ...updatedList[existingIndex], status: mt.status, rejectionReason: mt.rejected_reason, structure: mt.components, category: mt.category, content: text };
                  } else {
                      tplObj.appGroup = inferGroup(tplObj);
                      newTpls.push(tplObj);
                  }
              });
              const finalList = [...newTpls, ...updatedList];
              onUpdate(finalList);
              if (!silent) alert(`Synced ${newTpls.length} new templates!`);
              return finalList;
          }
      } catch (error: any) {
          if(!silent) alert(`Sync Failed: ${error.message}`);
          return templates;
      } finally {
          setSyncingMeta(false);
      }
      return templates;
  };

  const handleAutoHeal = async () => {
      setRepairing(true);
      addLog("Initializing Meta Compliance Self-Heal Cycle...");
      let restoredCount = 0;
      const remoteTemplates = await handleSyncFromMeta(true);
      if (remoteTemplates) {
          for (const req of REQUIRED_SYSTEM_TEMPLATES) {
              const match = remoteTemplates.find(t => t.name === req.name);
              if (!match) {
                  addLog(`MISSING: ${req.name}. Recreating...`);
                  await deployHelper(req);
                  restoredCount++;
              } else if (match.status === 'REJECTED') {
                  addLog(`REJECTED: ${req.name}. Fixing...`);
                  await repairHelper(match, req);
                  restoredCount++;
              } else {
                  const reqVars = (req.content.match(/{{[0-9]+}}/g) || []).length;
                  const remoteVars = (match.content.match(/{{[0-9]+}}/g) || []).length;
                  if (reqVars !== remoteVars) {
                      addLog(`MISMATCH: ${req.name}. Correcting structure...`);
                      await repairHelper(match, req);
                      restoredCount++;
                  }
              }
          }
      }
      addLog(`Cycle Complete. Restored ${restoredCount} core assets.`);
      setRepairing(false);
      handleSyncFromMeta(true); 
  };

  const deployHelper = async (req: any) => {
      const payload: WhatsAppTemplate = {
          id: `heal-${Date.now()}`, name: req.name, content: req.content,
          tactic: 'AUTHORITY', targetProfile: 'REGULAR', isAiGenerated: false,
          source: 'LOCAL', category: req.category as MetaCategory,
          variableExamples: req.examples, appGroup: req.appGroup as AppTemplateGroup
      };
      const result = await whatsappService.createMetaTemplate(payload);
      if (result.success) addLog(`SUCCESS: ${req.name} deployed.`);
      else addLog(`FAILED: ${req.name} - ${result.error?.message}`);
  };

  const repairHelper = async (existing: WhatsAppTemplate, required: any) => {
      const payload: WhatsAppTemplate = { ...existing, content: required.content, variableExamples: required.examples, structure: undefined };
      const result = await whatsappService.editMetaTemplate(existing.id, payload);
      if (result.success) addLog(`FIXED: ${required.name} updated.`);
      else addLog(`FIX FAILED: ${required.name} - ${result.error?.message}`);
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
          setActiveTab('BUILDER');
          setHighlightEditor(true);
          setTimeout(() => setHighlightEditor(false), 2000);
      } catch (e: any) { alert("Generation failed: " + e.message); }
      finally { setIsGenerating(false); }
  };

  const handleEditTemplate = (tpl: WhatsAppTemplate) => {
      setTemplateName(tpl.name || '');
      setGeneratedContent(tpl.content || '');
      setSelectedCategory(tpl.category || 'UTILITY');
      setSelectedGroup(tpl.appGroup || inferGroup(tpl));
      setEditingStructure(tpl.structure || []); 
      setVariableExamples(tpl.variableExamples || []);
      setEditingMetaId(tpl.source === 'META' ? tpl.id : null);
      setActiveTab('BUILDER'); 
  };

  const handleAiAutoFix = async (tpl: WhatsAppTemplate) => {
      setIsFixing(tpl.id);
      try {
          const result = await geminiService.fixRejectedTemplate(tpl);
          setTemplateName(result.fixedName);
          setGeneratedContent(result.fixedContent);
          setSelectedCategory(result.category);
          setVariableExamples(result.variableExamples || []); 
          setAiAnalysisReason(result.diagnosis);
          setEditingMetaId(tpl.id);
          setActiveTab('BUILDER');
      } catch (e: any) { alert(`Auto-fix failed: ${e.message}`); }
      finally { setIsFixing(null); }
  };

  const handleDeleteTemplate = async (tpl: WhatsAppTemplate) => {
      if (!confirm(`Permanently delete "${tpl.name}"?`)) return;
      setDeletingId(tpl.id);
      try {
          if (tpl.source === 'META') await whatsappService.deleteMetaTemplate(tpl.name);
          onUpdate(templates.filter(t => t.id !== tpl.id));
      } catch (e: any) { alert(`Delete Failed: ${e.message}`); }
      finally { setDeletingId(null); }
  };

  const handleSaveLocalOrDeploy = async (action: 'LOCAL' | 'META') => {
      if(!generatedContent || !templateName) return alert("Name and Content required");
      const newTpl: WhatsAppTemplate = {
          id: `local-${Date.now()}`, name: templateName, content: generatedContent,
          tactic: selectedTactic, targetProfile: selectedProfile, isAiGenerated: true,
          source: 'LOCAL', category: selectedCategory, appGroup: selectedGroup,
          structure: editingStructure.length > 0 ? editingStructure : undefined,
          variableExamples: variableExamples.length > 0 ? variableExamples : []
      };
      if (action === 'LOCAL') {
          onUpdate([newTpl, ...templates]);
          alert("Saved Local Draft");
      } else {
          setPushingMeta(true);
          let result = editingMetaId ? await whatsappService.editMetaTemplate(editingMetaId, newTpl) : await whatsappService.createMetaTemplate(newTpl);
          setPushingMeta(false);
          if (result.success) {
              // Add comment above fix: Use type assertion for result union type to access finalName
              const deployedTpl = { ...newTpl, name: (result as any).finalName || templateName, source: 'META' as const, status: 'PENDING' as const };
              onUpdate(editingMetaId ? templates.map(t => t.id === editingMetaId ? { ...deployedTpl, id: editingMetaId } : t) : [deployedTpl, ...templates]);
              alert("Template Deployed!");
          } else alert(`Error: ${result.error?.message}`);
      }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-32 flex flex-col h-full overflow-hidden">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b pb-4 shrink-0">
        <div>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2"><Server className="text-amber-500" /> Template Architect</h2>
          <p className="text-slate-500 text-sm">System integrity engine and AI designer.</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
            {(['CORE', 'AUTOMATION', 'BUILDER', 'LIBRARY'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    {tab === 'CORE' ? 'Health' : tab === 'AUTOMATION' ? 'Rules' : tab === 'BUILDER' ? 'AI Designer' : 'Library'}
                </button>
            ))}
            {rejectedTemplates.length > 0 && (
                <button onClick={() => setActiveTab('ISSUES')} className={`ml-2 px-4 py-2 rounded-lg text-xs font-black transition-all ${activeTab === 'ISSUES' ? 'bg-rose-600 text-white shadow-md' : 'text-rose-600 bg-rose-50'}`}>
                   Issues ({rejectedTemplates.length})
                </button>
            )}
        </div>
      </div>

      {activeTab === 'CORE' && (
        <div className="flex flex-col gap-6 flex-1 min-h-0 overflow-hidden">
            <div className="bg-white p-4 rounded-2xl border flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <ShieldCheck size={20} className="text-emerald-500" />
                    <div>
                        <h3 className="font-bold text-slate-800 text-sm">Core System Integrity</h3>
                        <p className="text-[10px] text-slate-500">Ensure mandatory templates match application logic.</p>
                    </div>
                </div>
                <button onClick={handleAutoHeal} disabled={repairing} className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-black text-[10px] uppercase flex items-center gap-2 hover:bg-emerald-700 active:scale-95 shadow-lg shadow-emerald-500/20">
                    {repairing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} AI Self-Heal Core
                </button>
            </div>
            <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    {REQUIRED_SYSTEM_TEMPLATES.map(req => {
                        const match = templates.find(t => t.name === req.name);
                        const isMismatch = match && (match.content.match(/{{[0-9]+}}/g)?.length || 0) !== (req.content.match(/{{[0-9]+}}/g)?.length || 0);
                        return (
                            <div key={req.name} className={`p-4 rounded-2xl border bg-white ${isMismatch ? 'border-amber-400 bg-amber-50' : 'border-slate-100'}`}>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold text-slate-800">{req.name}</span>
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg uppercase ${match ? (isMismatch ? 'bg-amber-100 text-amber-700' : 'bg-emerald-50 text-emerald-600') : 'bg-rose-50 text-rose-600'}`}>
                                        {match ? (isMismatch ? 'Mismatch' : 'Healthy') : 'Missing'}
                                    </span>
                                </div>
                                <p className="text-[10px] text-slate-400 font-mono line-clamp-2">"{req.content}"</p>
                            </div>
                        );
                    })}
                </div>
                <div className="bg-slate-900 rounded-3xl p-6 text-emerald-400 font-mono text-[10px] flex flex-col h-full">
                    <div className="mb-4 text-slate-500 uppercase font-black text-[9px] border-b border-slate-800 pb-2">Terminal Logs</div>
                    <div className="flex-1 overflow-y-auto space-y-1">
                        {/* Add comment above fix: explicitly cast repairLogs to string[] to satisfy TS compiler */}
                        {(repairLogs as string[]).length === 0 ? <span className="opacity-30 italic">Ready for diagnostics...</span> : (repairLogs as string[]).map((l, i) => <div key={i}>{l}</div>)}
                        <div ref={logsEndRef} />
                    </div>
                </div>
            </div>
        </div>
      )}

      {activeTab === 'BUILDER' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0 overflow-y-auto pr-1">
              <div className="lg:col-span-4 space-y-4">
                  <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100">
                      <div className="flex items-center gap-3 mb-4"><BrainCircuit size={24} className="text-indigo-600" /><h3 className="font-bold">AI Strategist</h3></div>
                      <textarea className="w-full h-32 p-3 bg-white rounded-xl text-sm border-none focus:ring-2 focus:ring-indigo-500 shadow-inner" placeholder="Describe your need..." value={promptText} onChange={e => setPromptText(e.target.value)} />
                      <button onClick={() => handlePromptGeneration()} disabled={isGenerating || !promptText.trim()} className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-bold text-xs mt-4 shadow-lg hover:bg-slate-800 flex items-center justify-center gap-2">
                          {isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles size={16} />} {isGenerating ? 'Designing...' : 'Generate Asset'}
                      </button>
                  </div>
              </div>
              <div className="lg:col-span-8 bg-white p-6 rounded-3xl border border-l-4 border-l-blue-500">
                  <div className="flex justify-between items-start mb-4">
                    <h4 className="font-bold flex items-center gap-2"><Edit size={16} className="text-blue-500" /> Editor</h4>
                    {editingMetaId && <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-amber-200">Meta Live Edit</span>}
                  </div>
                  {aiAnalysisReason && <div className="bg-amber-50 p-4 rounded-xl mb-4 border-l-2 border-amber-400 text-sm italic">"{aiAnalysisReason}"</div>}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                      <div><label className="text-[9px] font-bold uppercase text-slate-400">Name</label><input value={templateName} onChange={e => setTemplateName(e.target.value)} className={`w-full text-sm border rounded-lg p-2 ${editingMetaId ? 'bg-slate-50 cursor-not-allowed' : ''}`} readOnly={!!editingMetaId} /></div>
                      <div><label className="text-[9px] font-bold uppercase text-slate-400">Category</label><select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value as any)} className="w-full text-sm border rounded-lg p-2"><option value="UTILITY">UTILITY</option><option value="MARKETING">MARKETING</option></select></div>
                  </div>
                  <textarea value={generatedContent} onChange={e => setGeneratedContent(e.target.value)} className="w-full h-40 p-4 bg-slate-50 rounded-xl text-sm border font-mono" placeholder="Hello {{1}}, your order is ready..." />
                  <div className="flex gap-3 mt-4">
                      <button onClick={() => handleSaveLocalOrDeploy('META')} disabled={pushingMeta} className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold text-xs shadow-md hover:bg-emerald-700 flex items-center justify-center gap-2">{pushingMeta ? <Loader2 className="animate-spin" /> : <UploadCloud size={16} />} {editingMetaId ? 'Update Meta' : 'Deploy to Meta'}</button>
                      <button onClick={() => handleSaveLocalOrDeploy('LOCAL')} className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold text-xs hover:bg-slate-200">Save Local Draft</button>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'ISSUES' && (
          <div className="flex-1 overflow-y-auto space-y-4">
              <div className="bg-rose-50 border-l-4 border-rose-500 p-6 rounded-r-2xl flex justify-between items-center">
                  <div><h3 className="text-lg font-black text-rose-800">Compliance Issues</h3><p className="text-sm text-rose-700">Meta has rejected {rejectedTemplates.length} templates. Let AI fix them.</p></div>
                  <button onClick={handleAutoHeal} disabled={repairing} className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg">{repairing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />} Fix All with AI</button>
              </div>
              <div className="grid grid-cols-1 gap-3">
                  {rejectedTemplates.map(tpl => (
                      <div key={tpl.id} className="bg-white p-5 rounded-2xl border border-rose-100 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
                          <div className="flex-1"><h4 className="font-bold text-slate-800">{tpl.name}</h4><p className="text-xs text-rose-600 italic bg-rose-50/50 p-2 rounded mt-1">Reason: {tpl.rejectionReason || 'Policy Violation'}</p><p className="text-xs text-slate-400 mt-2 font-mono line-clamp-1 opacity-60">"{tpl.content}"</p></div>
                          <div className="flex gap-2 shrink-0"><button onClick={() => handleAiAutoFix(tpl)} disabled={isFixing === tpl.id} className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2">{isFixing === tpl.id ? <Loader2 size={14} className="animate-spin" /> : <Stethoscope size={14} />} Auto-Fix</button><button onClick={() => handleDeleteTemplate(tpl)} className="text-rose-600 border border-rose-200 px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-rose-50"><Trash2 size={14} /></button></div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {activeTab === 'LIBRARY' && (
          <div className="bg-white rounded-[2rem] border shadow-sm flex-1 min-h-0 overflow-hidden flex flex-col">
              <div className="p-6 border-b flex justify-between items-center bg-slate-50/50 shrink-0"><h3 className="font-black text-slate-700 uppercase text-sm tracking-widest">Master Library</h3><button onClick={() => handleSyncFromMeta(false)} className="text-xs font-bold text-amber-600 hover:underline flex items-center gap-1"><RefreshCcw size={12} /> Sync Refresh</button></div>
              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                  {Object.entries(groupedTemplates).map(([group, list]) => (list.length > 0 && <div key={group} className="space-y-4"><div className="flex items-center gap-2 border-b pb-2"><FolderOpen size={16} className="text-slate-400" /><h4 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">{group.replace(/_/g, ' ')}</h4><span className="bg-slate-100 text-[9px] px-2 py-0.5 rounded-full font-black text-slate-400">{list.length}</span></div><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{list.map(t => <div key={t.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:border-amber-200 transition-all group"><div className="flex justify-between items-start mb-2"><h5 className="font-bold text-sm text-slate-800 truncate pr-4">{t.name}</h5><span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${t.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : t.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>{t.status || 'LOCAL'}</span></div><p className="text-[11px] text-slate-500 line-clamp-3 mb-4 italic leading-relaxed">"{t.content}"</p><div className="flex justify-between items-center pt-3 border-t"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t.category}</span><div className="flex gap-2"><button onClick={() => handleEditTemplate(t)} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"><Edit size={12} /></button><button onClick={() => handleDeleteTemplate(t)} className="p-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100"><Trash2 size={12} /></button></div></div></div>)}</div></div>))}
              </div>
          </div>
      )}
    </div>
  );
};

export default WhatsAppTemplates;
