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
  const [deployingTriggerId, setDeployingTriggerId] = useState<string | null>(null);
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
          'SETU_PAYMENT': [],
          'PAYMENT_COLLECTION': [],
          'ORDER_STATUS': [],
          'MARKETING_PROMO': [],
          'GENERAL_SUPPORT': [],
          'SYSTEM_NOTIFICATIONS': [],
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
                      updatedList[existingIndex] = { 
                          ...updatedList[existingIndex], 
                          id: mt.id, // CRITICAL: Update ID to Meta ID to prevent "Unsupported post request" errors on edit
                          status: mt.status, 
                          rejectionReason: mt.rejected_reason,
                          structure: mt.components, 
                          category: mt.category,
                          content: text
                      };
                  } else {
                      tplObj.appGroup = inferGroup(tplObj);
                      newTpls.push(tplObj);
                  }
              });
              
              const finalList = [...newTpls, ...updatedList];
              // Remove duplicates based on ID preference (Keep Meta IDs)
              const uniqueMap = new Map();
              finalList.forEach(item => {
                  if(!uniqueMap.has(item.name)) uniqueMap.set(item.name, item);
                  else if(item.id && !item.id.startsWith('sys-') && uniqueMap.get(item.name).id.startsWith('sys-')) {
                      // Replace local placeholder with real Meta record
                      uniqueMap.set(item.name, item);
                  }
              });
              const uniqueList = Array.from(uniqueMap.values());

              onUpdate(uniqueList);
              if (!silent) {
                  alert(`Synced ${newTpls.length} new templates from Meta!`);
                  addLog(`Sync Complete. Total Templates: ${uniqueList.length}`);
              }
              return uniqueList;
          }
      } catch (error: any) {
          if(!silent) alert(`Sync Failed: ${error.message}`);
          addLog(`Sync Error: ${error.message}`);
          return templates;
      } finally {
          setSyncingMeta(false);
      }
  };

  const handleAutoHeal = async () => {
      setRepairing(true);
      addLog("Initializing Gemini 2.5 Structural Integrity Check...");
      
      let restoredCount = 0;
      // Force sync first to get latest IDs
      const remoteTemplates = await handleSyncFromMeta(true);
      
      for (const req of REQUIRED_SYSTEM_TEMPLATES) {
          const match = remoteTemplates?.find(t => t.name === req.name);
          
          if (!match) {
              addLog(`MISSING: ${req.name}. Deploying fresh...`);
              await deployHelper(req);
              restoredCount++;
          } else {
              if (match.status === 'REJECTED') {
                  addLog(`REJECTED: ${req.name}. Fixing...`);
                  await repairHelper(match, req);
                  restoredCount++;
                  continue;
              }

              const reqVars = (req.content.match(/{{[0-9]+}}/g) || []).length;
              const remoteVars = (match.content.match(/{{[0-9]+}}/g) || []).length;
              const isDrasticallyDifferent = Math.abs(req.content.length - match.content.length) > 50;

              if (reqVars !== remoteVars || isDrasticallyDifferent) {
                  addLog(`MISMATCH: ${req.name}. App expects ${reqVars} vars, Meta has ${remoteVars}. Harmonizing...`);
                  // Ensure we use the template object from the FRESH sync to get the correct Meta ID
                  await repairHelper(match, req); 
                  restoredCount++;
              } else {
                  addLog(`OK: ${req.name} verified.`);
              }
          }
      }

      addLog(`Cycle Complete. Actions: ${restoredCount}.`);
      setRepairing(false);
      handleSyncFromMeta(true); 
  };

  const deployHelper = async (req: any) => {
      const validation = await geminiService.validateAndFixTemplate(req.content, req.name, req.category);
      
      const payload: WhatsAppTemplate = {
          id: `heal-${Date.now()}`,
          name: req.name,
          content: validation.optimizedContent, 
          tactic: 'AUTHORITY',
          targetProfile: 'REGULAR',
          isAiGenerated: !validation.isCompliant,
          source: 'LOCAL',
          category: req.category as MetaCategory,
          variableExamples: req.examples,
          appGroup: req.appGroup as AppTemplateGroup
      };

      const result = await whatsappService.createMetaTemplate(payload);
      if (result.success) {
          addLog(`SUCCESS: ${req.name} deployed.`);
      } else {
          addLog(`FAILED: ${req.name} - ${result.error?.message || JSON.stringify(result.error)}`);
      }
  };

  const repairHelper = async (existingMetaTpl: WhatsAppTemplate, requiredDef: any) => {
      const fix = await geminiService.validateAndFixTemplate(requiredDef.content, requiredDef.name, requiredDef.category);
      
      if (!fix.isCompliant) {
          addLog(`AI OPTIMIZATION: Rewrote ${requiredDef.name} for compliance.`);
      }

      const payload: WhatsAppTemplate = {
          ...existingMetaTpl,
          content: fix.optimizedContent,
          variableExamples: requiredDef.examples, 
          structure: undefined // Clear structure to force rebuild from content + examples
      };

      if (existingMetaTpl.id.startsWith('sys-') || existingMetaTpl.id.startsWith('local-')) {
          addLog(`ERROR: Cannot repair ${requiredDef.name} because we lack the Meta ID. Trying create instead.`);
          await deployHelper(requiredDef);
          return;
      }

      const result = await whatsappService.editMetaTemplate(existingMetaTpl.id, payload);
      if (result.success) {
          addLog(`FIXED: ${requiredDef.name} updated on Meta.`);
      } else {
          addLog(`FIX FAILED: ${requiredDef.name} - ${result.error?.message || JSON.stringify(result.error)}`);
      }
  };

  const handleDeployStandard = async (trigger: SystemTrigger, def: any) => {
      setDeployingTriggerId(trigger.id);
      try {
          const payload: WhatsAppTemplate = {
              id: `std-${Date.now()}`,
              name: def.name,
              content: def.content,
              tactic: 'AUTHORITY',
              targetProfile: 'REGULAR',
              isAiGenerated: false,
              source: 'LOCAL',
              category: def.category as MetaCategory,
              variableExamples: def.examples,
              appGroup: def.appGroup as AppTemplateGroup
          };

          const result = await whatsappService.createMetaTemplate(payload);
          
          if (result.success) {
              const newTpl: WhatsAppTemplate = { ...payload, name: result.finalName!, source: 'META', status: 'PENDING' };
              onUpdate([newTpl, ...templates]);
              alert(`Deployed: ${result.finalName}`);
          } else {
              alert(`Failed: ${result.error?.message || 'Unknown Error'}`);
          }
      } catch (e: any) {
          alert(`Error: ${e.message}`);
      } finally {
          setDeployingTriggerId(null);
      }
  };

  const handlePromptGeneration = async (textOverride?: string) => {
      const finalText = textOverride || promptText;
      if (!finalText.trim()) return;
      setIsGenerating(true);
      setAiAnalysisReason(null);
      setEditingMetaId(null); 
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
      } finally {
          setIsGenerating(false);
      }
  };

  const handleEditTemplate = (tpl: WhatsAppTemplate) => {
      setTemplateName(tpl.name || '');
      setGeneratedContent(tpl.content || '');
      setSelectedCategory(tpl.category || 'UTILITY');
      setSelectedGroup(tpl.appGroup || inferGroup(tpl));
      setEditingStructure(tpl.structure || []); 
      setVariableExamples(tpl.variableExamples || []);
      setAiAnalysisReason(null);
      if (tpl.source === 'META') setEditingMetaId(tpl.id);
      else setEditingMetaId(null);
      setActiveTab('BUILDER'); 
      setTimeout(() => { if (editorRef.current) editorRef.current.scrollIntoView({ behavior: 'smooth' }); }, 100);
  };

  const handleAiAutoFix = async (tpl: WhatsAppTemplate) => {
      setIsFixing(tpl.id);
      try {
          const result = await geminiService.fixRejectedTemplate(tpl);
          const fixedTemplate = {
              ...tpl,
              content: result.fixedContent,
              category: result.category,
              variableExamples: result.variableExamples || []
          };
          const updateResult = await whatsappService.editMetaTemplate(tpl.id, fixedTemplate);
          if (updateResult.success) {
              setAiAnalysisReason(`AUTO-FIX SUCCESS: ${result.diagnosis}`);
              onUpdate(templates.map(t => t.id === tpl.id ? { ...fixedTemplate, status: 'PENDING', rejectionReason: undefined } : t));
              setTemplateName(result.fixedName);
              setGeneratedContent(result.fixedContent);
              setSelectedCategory(result.category);
              setVariableExamples(result.variableExamples || []);
              setActiveTab('BUILDER');
              setHighlightEditor(true);
              setTimeout(() => setHighlightEditor(false), 2000);
          } else {
              setAiAnalysisReason(`AI FIX UPLOAD FAILED: ${updateResult.error?.message}`);
              alert(`Meta rejected the fix: ${updateResult.error?.message}`);
          }
      } catch (e: any) {
          alert(`Auto-fix failed: ${e.message}`);
      } finally {
          setIsFixing(null);
      }
  };

  const handleDeleteTemplate = async (tpl: WhatsAppTemplate) => {
      const isMeta = tpl.source === 'META';
      const msg = isMeta ? `WARNING: Permanently DELETE "${tpl.name}" from Meta?` : `Delete "${tpl.name}" locally?`;
      if (!confirm(msg)) return;
      setDeletingId(tpl.id);
      try {
          if (isMeta) {
              const res = await whatsappService.deleteMetaTemplate(tpl.name);
              if (!res.success) throw new Error(res.error?.message || "Delete Failed");
          }
          onUpdate(templates.filter(t => t.id !== tpl.id));
          alert("Template deleted.");
      } catch (e: any) {
          alert(`Delete Failed: ${e.message}`);
      } finally {
          setDeletingId(null);
      }
  };

  const handleCreateVariant = (trigger: SystemTrigger) => {
      setTemplateName(`${trigger.defaultTemplateName}_v2`);
      const placeholderText = trigger.requiredVariables.map((v, i) => `{{${i+1}}}`).join(' ');
      setGeneratedContent(`New variant for ${trigger.label}: ${placeholderText}...`);
      setSelectedCategory('UTILITY');
      setSelectedGroup(trigger.appGroup);
      setVariableExamples(trigger.requiredVariables);
      setActiveTab('BUILDER');
      setAiAnalysisReason(null);
      setEditingMetaId(null);
      setTimeout(() => { if (editorRef.current) editorRef.current.scrollIntoView({ behavior: 'smooth' }); }, 100);
  };

  const handleSaveLocalOrDeploy = async (action: 'LOCAL' | 'META') => {
      if(!generatedContent || !templateName) return alert("Name and Content required");
      
      const newTpl: WhatsAppTemplate = {
          id: `local-${Date.now()}`,
          name: templateName,
          content: generatedContent,
          tactic: selectedTactic,
          targetProfile: selectedProfile,
          isAiGenerated: true,
          source: 'LOCAL',
          category: selectedCategory,
          appGroup: selectedGroup,
          structure: editingStructure.length > 0 ? editingStructure : undefined,
          variableExamples: variableExamples.length > 0 ? variableExamples : generatedContent.match(/{{[0-9]+}}/g)?.map((_, i) => `Sample${i+1}`) || []
      };

      if (action === 'LOCAL') {
          onUpdate([newTpl, ...templates]);
          alert("Saved to Local Library");
      } else {
          setPushingMeta(true);
          let result;
          
          if (editingMetaId && !editingMetaId.startsWith('local-')) {
              result = await whatsappService.editMetaTemplate(editingMetaId, newTpl);
              if (result.success) alert("Template Edited Successfully!");
          } else {
              result = await whatsappService.createMetaTemplate(newTpl);
              if (result.success) alert(`Template Deployed! Active Name: ${result.finalName}`);
          }
          
          setPushingMeta(false);
          
          if (result.success) {
              const deployedTpl = { ...newTpl, name: result.finalName || templateName, source: 'META' as const, status: 'PENDING' as const };
              if (editingMetaId) {
                  onUpdate(templates.map(t => t.id === editingMetaId ? { ...deployedTpl, id: editingMetaId } : t));
              } else {
                  onUpdate([deployedTpl, ...templates]);
              }
              setAiAnalysisReason(null);
              setEditingMetaId(null);
          } else {
              alert(`Deployment Error: ${result.error?.message || JSON.stringify(result.error)}`);
          }
      }
      setGeneratedContent('');
      setTemplateName('');
      setEditingStructure([]);
  };

  const getStatusColor = (status?: string) => {
      switch(status) {
          case 'APPROVED': return 'bg-emerald-100 text-emerald-700';
          case 'REJECTED': return 'bg-rose-100 text-rose-700';
          case 'PENDING': return 'bg-amber-100 text-amber-700';
          default: return 'bg-slate-100 text-slate-500';
      }
  };

  const getGroupLabel = (key: string) => {
      return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-32 flex flex-col">
      {/* Header & Separate Tabs */}
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
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        {tab === 'CORE' && <MousePointerClick size={14} className="text-amber-500" />}
                        {tab === 'AUTOMATION' && <BrainCircuit size={14} className="text-indigo-500" />}
                        {tab === 'BUILDER' && <Wrench size={14} className="text-emerald-500" />}
                        {tab === 'LIBRARY' && <FolderOpen size={14} className="text-slate-400" />}
                        {tab === 'CORE' ? 'Core Actions' : tab === 'AUTOMATION' ? 'Automation Rules' : tab === 'BUILDER' ? 'AI Builder' : 'Library'}
                    </button>
                ))}
                {rejectedTemplates.length > 0 && (
                    <button
                        onClick={() => setActiveTab('ISSUES')}
                        className={`px-4 py-2 rounded-lg text-xs font-black transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'ISSUES' ? 'bg-rose-600 text-white shadow-md' : 'text-rose-600 bg-rose-50 hover:bg-rose-100'}`}
                    >
                        <AlertTriangle size={12} /> Issues ({rejectedTemplates.length})
                    </button>
                )}
            </div>
        </div>
      </div>

      {/* --- TAB: CORE ACTIONS (Fixed/Required) --- */}
      {activeTab === 'CORE' && (
        <div className="flex flex-col gap-6 h-[calc(100vh-200px)] overflow-hidden">
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm shrink-0 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-amber-100 text-amber-700 p-2 rounded-xl"><ShieldCheck size={20} /></div>
                    <div>
                        <h3 className="font-bold text-slate-800 text-sm">Core Action Templates</h3>
                        <p className="text-[10px] text-slate-500">Fixed messages triggered by buttons. Hard requirements.</p>
                    </div>
                </div>
                <button 
                    onClick={handleAutoHeal}
                    disabled={repairing}
                    className="text-[10px] font-black uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-700 px-6 py-2.5 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95"
                >
                    {repairing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    AI Self-Heal Core
                </button>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0 overflow-hidden p-2">
                <div className="space-y-3 overflow-y-auto custom-scrollbar pr-2 h-full">
                    {REQUIRED_SYSTEM_TEMPLATES.map(req => {
                        const match = templates.find(t => t.name === req.name || t.name.startsWith(req.name));
                        const isMismatch = match && (
                            (match.content?.match(/{{[0-9]+}}/g)?.length || 0) !== (req.content.match(/{{[0-9]+}}/g)?.length || 0)
                        );

                        return (
                            <div key={req.name} className={`flex flex-col gap-2 p-4 rounded-2xl border bg-white transition-colors shadow-sm ${isMismatch ? 'border-amber-400 bg-amber-50' : 'border-slate-100 hover:border-amber-200'}`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-3 h-3 rounded-full shrink-0 ${match ? (isMismatch ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500') : 'bg-rose-500 animate-pulse'}`}></div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-800">{req.name}</p>
                                            <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">{req.appGroup}</p>
                                        </div>
                                    </div>
                                    <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase ${match ? (isMismatch ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-600') : 'bg-rose-50 text-rose-600'}`}>
                                        {match ? (isMismatch ? 'Structure Mismatch' : 'Active') : 'Missing'}
                                    </span>
                                </div>
                                <div className="bg-slate-50 p-3 rounded-xl text-[10px] text-slate-600 font-mono leading-relaxed border border-slate-100">
                                    <p className="font-bold text-[8px] text-slate-400 mb-1 uppercase">Required Structure:</p>
                                    "{req.content}"
                                </div>
                                {isMismatch && (
                                    <div className="text-[9px] text-amber-700 italic flex items-center gap-1">
                                        <AlertTriangle size={10} /> Auto-Heal will overwrite Meta version to match App requirements.
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
                
                <div className="bg-slate-900 rounded-3xl p-6 text-emerald-400 font-mono text-[10px] overflow-hidden flex flex-col h-full shadow-inner border border-slate-800">
                    <div className="flex items-center gap-2 mb-4 text-slate-500 uppercase font-bold tracking-widest text-[9px] border-b border-slate-800 pb-2 shrink-0">
                        <Terminal size={14} /> System Health Console
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
                        {repairLogs.length === 0 ? <span className="opacity-30">System idle. Ready for diagnostics.</span> : repairLogs.map((l, i) => <div key={i}>{l}</div>)}
                        <div ref={logsEndRef} />
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* --- TAB: AUTOMATION (Restored) --- */}
      {activeTab === 'AUTOMATION' && (
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
      )}
      
      {activeTab === 'BUILDER' && (
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
                              onClick={() => handlePromptGeneration()}
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
      )}

      {/* --- TAB: LIBRARY (Restored) --- */}
      {activeTab === 'LIBRARY' && (
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
                                    <div key={tpl.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group relative">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-2">
                                                {tpl.source === 'META' ? <Cloud size={14} className="text-blue-400" /> : <Laptop size={14} className="text-slate-400" />}
                                                <span className="font-bold text-sm text-slate-800 truncate max-w-[150px]" title={tpl.name}>{tpl.name}</span>
                                            </div>
                                            <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full ${getStatusColor(tpl.status)}`}>
                                                {tpl.status || 'DRAFT'}
                                            </span>
                                        </div>
                                        
                                        <p className="text-xs text-slate-500 line-clamp-3 mb-4 h-12 leading-relaxed">
                                            {tpl.content}
                                        </p>

                                        <div className="flex gap-2 border-t pt-3">
                                            <button onClick={() => handleEditTemplate(tpl)} className="flex-1 py-2 rounded-lg bg-slate-50 text-slate-600 text-[10px] font-bold uppercase hover:bg-slate-100 flex items-center justify-center gap-1">
                                                <Edit size={12} /> Edit
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
      )}

      {/* --- TAB: ISSUES (Restored) --- */}
      {activeTab === 'ISSUES' && (
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
      )}
      
    </div>
  );
};

export default WhatsAppTemplates;