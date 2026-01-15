
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  MessageSquare, BrainCircuit, Sparkles, Save, Edit, 
  Copy, RefreshCw, Zap, ShieldAlert, Users, Star, Cloud, CheckCircle, UploadCloud, Globe, Laptop,
  Activity, AlertTriangle, AlertCircle, RefreshCcw, Loader2, Terminal, Check, Server, PlusCircle, Code, Trash2, FolderOpen,
  Wrench, ArrowRight, GitMerge, FileJson
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
  const [activeTab, setActiveTab] = useState<'SYSTEM' | 'STRATEGY' | 'LIBRARY' | 'TRIGGERS'>('SYSTEM');
  
  // Prompt-Based Generator State
  const [promptText, setPromptText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Editor State
  const [templateName, setTemplateName] = useState('');
  const [generatedContent, setGeneratedContent] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MetaCategory>('UTILITY');
  const [selectedGroup, setSelectedGroup] = useState<AppTemplateGroup>('UNCATEGORIZED');
  const [editingStructure, setEditingStructure] = useState<any[]>([]); // Preserves Buttons/Headers during edit
  const [variableExamples, setVariableExamples] = useState<string[]>([]);
  const [highlightEditor, setHighlightEditor] = useState(false); // Visual feedback

  // Tactic State (Fallback/Legacy)
  const [selectedTactic, setSelectedTactic] = useState<PsychologicalTactic>('AUTHORITY');
  const [selectedProfile, setSelectedProfile] = useState<RiskProfile>('REGULAR');

  const [syncingMeta, setSyncingMeta] = useState(false);
  const [pushingMeta, setPushingMeta] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deployingTriggerId, setDeployingTriggerId] = useState<string | null>(null);

  // Auto-Repair State
  const [repairing, setRepairing] = useState(false);
  const [repairLogs, setRepairLogs] = useState<string[]>([]);
  
  // Debug Log State
  const [debugLogs, setDebugLogs] = useState<{timestamp: string, label: string, data: any, isError: boolean}[]>([]);
  
  const logsEndRef = useRef<HTMLDivElement>(null);
  const debugEndRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logsEndRef.current) logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    if (debugEndRef.current) debugEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [repairLogs, debugLogs]);

  const addLog = (msg: string) => setRepairLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  
  const addDebugLog = (label: string, data: any, isError: boolean = false) => {
      setDebugLogs(prev => [{
          timestamp: new Date().toLocaleTimeString(),
          label,
          data,
          isError
      }, ...prev]);
  };

  // Grouping Logic for Library
  const groupedTemplates = useMemo(() => {
      const groups: Record<string, WhatsAppTemplate[]> = {
          'PAYMENT_COLLECTION': [],
          'ORDER_STATUS': [],
          'MARKETING_PROMO': [],
          'GENERAL_SUPPORT': [],
          'SYSTEM_NOTIFICATIONS': [],
          'UNCATEGORIZED': []
      };

      templates.forEach(t => {
          const group = t.appGroup || inferGroup(t);
          if (groups[group]) groups[group].push(t);
          else groups['UNCATEGORIZED'].push(t);
      });
      return groups;
  }, [templates]);

  // Helper to guess group if missing
  function inferGroup(t: WhatsAppTemplate): AppTemplateGroup {
      const txt = (t.name + t.content).toLowerCase();
      if (txt.includes('payment') || txt.includes('due') || txt.includes('pay')) return 'PAYMENT_COLLECTION';
      if (txt.includes('order') || txt.includes('ship') || txt.includes('delivery')) return 'ORDER_STATUS';
      if (txt.includes('offer') || txt.includes('sale') || txt.includes('exclusive')) return 'MARKETING_PROMO';
      if (txt.includes('help') || txt.includes('support') || txt.includes('welcome')) return 'GENERAL_SUPPORT';
      return 'UNCATEGORIZED';
  }

  // --- Core Actions ---

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
                  
                  // Preserve existing local group if updating
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
                      category: mt.category,
                      appGroup: existingGroup // Maintain app context
                  };

                  if (existingIndex >= 0) {
                      updatedList[existingIndex] = { ...updatedList[existingIndex], status: mt.status, structure: mt.components, category: mt.category };
                  } else {
                      // Infer group for new ones
                      tplObj.appGroup = inferGroup(tplObj);
                      newTpls.push(tplObj);
                  }
              });
              
              const finalList = [...newTpls, ...updatedList];
              onUpdate(finalList);
              if (!silent) {
                  alert(`Synced ${newTpls.length} new templates from Meta!`);
                  addLog(`Sync Complete. Total Templates: ${finalList.length}`);
              }
              return finalList;
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
      addLog("Initializing Core Intelligence Auto-Heal...");
      
      const missing = REQUIRED_SYSTEM_TEMPLATES.filter(req => 
          !templates.some(t => t.name === req.name || t.name.startsWith(req.name))
      );

      if (missing.length === 0) {
          addLog("All Core Intelligence templates are active.");
          setRepairing(false);
          return;
      }

      addLog(`Critical: Found ${missing.length} missing automated templates.`);
      let restoredCount = 0;
      let currentTemplates = [...templates];

      for (const req of missing) {
          addLog(`Deploying Core Template: ${req.name}...`);
          try {
              // Construct template object compatible with createMetaTemplate
              const payload: WhatsAppTemplate = {
                  id: `heal-${Date.now()}`,
                  name: req.name,
                  content: req.content,
                  tactic: 'AUTHORITY',
                  targetProfile: 'REGULAR',
                  isAiGenerated: false,
                  source: 'LOCAL',
                  category: req.category as MetaCategory,
                  variableExamples: req.examples,
                  appGroup: req.appGroup as AppTemplateGroup
              };

              const result = await whatsappService.createMetaTemplate(payload);
              
              if (result.success) {
                  addLog(`SUCCESS: ${req.name} deployed. Active as: ${result.finalName}`);
                  restoredCount++;
                  const newTpl: WhatsAppTemplate = { ...payload, name: result.finalName!, source: 'META', status: 'PENDING' };
                  currentTemplates = [newTpl, ...currentTemplates];
                  onUpdate(currentTemplates);
              } else {
                  addLog(`FAILED: ${req.name} - ${result.error?.message || 'Unknown error'}`);
              }
          } catch (e: any) {
              addLog(`CRITICAL EXCEPTION: ${req.name} - ${e.message}`);
          }
      }

      addLog(`Core Regeneration Cycle Complete. Restored ${restoredCount}/${missing.length} templates.`);
      setRepairing(false);
      handleSyncFromMeta(true); 
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
              alert(`Failed: ${result.error?.message}`);
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
      try {
          const result = await geminiService.generateTemplateFromPrompt(finalText);
          
          setTemplateName(result.suggestedName);
          setGeneratedContent(result.content);
          setSelectedCategory(result.metaCategory);
          setSelectedGroup(result.appGroup);
          setSelectedTactic(result.tactic);
          setVariableExamples(result.examples);
          
          // Trigger visual feedback
          setHighlightEditor(true);
          setTimeout(() => setHighlightEditor(false), 2000);
          
          // Move to Editor View
          if (editorRef.current) editorRef.current.scrollIntoView({ behavior: 'smooth' });

      } catch (e: any) {
          alert("Generation failed: " + e.message);
      } finally {
          setIsGenerating(false);
      }
  };

  const handleEditTemplate = (tpl: WhatsAppTemplate) => {
      setTemplateName(tpl.name);
      setGeneratedContent(tpl.content);
      setSelectedCategory(tpl.category || 'UTILITY');
      setSelectedGroup(tpl.appGroup || inferGroup(tpl));
      setEditingStructure(tpl.structure || []); 
      setVariableExamples(tpl.variableExamples || []);
      setActiveTab('STRATEGY');
      
      setTimeout(() => {
          if (editorRef.current) {
              editorRef.current.scrollIntoView({ behavior: 'smooth' });
          }
      }, 100);
  };

  // Special handler to fix rejected system templates by creating a fresh v2
  const handleFixSystemTemplate = (tpl: WhatsAppTemplate, requiredDef: any) => {
      // Create a unique name version to avoid Meta conflicts
      const newName = `${requiredDef.name}_v${Math.floor(Date.now() / 1000).toString().slice(-4)}`;
      
      setTemplateName(newName);
      // LOAD THE SAFE CONTENT FROM CONSTANTS, NOT THE REJECTED CONTENT
      setGeneratedContent(requiredDef.content);
      setSelectedCategory(requiredDef.category as MetaCategory);
      setSelectedGroup(requiredDef.appGroup as AppTemplateGroup);
      setVariableExamples(requiredDef.examples);
      setEditingStructure([]); // Reset structure to allow pure text rebuild if needed
      
      setActiveTab('STRATEGY');
      setHighlightEditor(true);
      setTimeout(() => setHighlightEditor(false), 2000);
      
      if (editorRef.current) editorRef.current.scrollIntoView({ behavior: 'smooth' });
  };

  const handleDeleteTemplate = async (tpl: WhatsAppTemplate) => {
      if (!confirm(`Permanently delete "${tpl.name}" from library? This action cannot be undone.`)) return;

      setDeletingId(tpl.id);
      try {
          onUpdate(templates.filter(t => t.id !== tpl.id));
          alert("Template removed from library.");
      } catch (e: any) {
          alert(`Error: ${e.message}`);
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
      setVariableExamples(trigger.requiredVariables); // Hint for user
      setActiveTab('STRATEGY');
      
      setTimeout(() => {
          if (editorRef.current) editorRef.current.scrollIntoView({ behavior: 'smooth' });
      }, 100);
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
          const result = await whatsappService.createMetaTemplate(newTpl);
          addDebugLog(`Edit/Deploy: ${templateName}`, {
              PAYLOAD_SENT: result.debugPayload,
              META_RESPONSE: result.rawResponse
          }, !result.success);
          setPushingMeta(false);
          
          if (result.success) {
              alert(`Template Fixed & Deployed! Active Name: ${result.finalName}`);
              const deployedTpl = { ...newTpl, name: result.finalName!, source: 'META' as const, status: 'PENDING' as const };
              onUpdate([deployedTpl, ...templates]);
          } else {
              alert(`Deployment Error: ${result.error?.message}. Check 'System Health' Raw Logs for details.`);
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

  const QUICK_PROMPTS = [
    { label: "Payment Reminder", prompt: "Create a polite but firm payment reminder for a jewelry installment that is 3 days overdue." },
    { label: "Production Update", prompt: "Notify customer that their ring casting is done and moved to stone setting stage." },
    { label: "Gold Rate Warning", prompt: "Urgent alert: Gold rate crossed their booked limit, ask for immediate payment to save the rate." },
    { label: "Delivery Ready", prompt: "Exciting news: The jewelry is ready for pickup at the store. Remind to bring ID." }
  ];

  return (
    <div className="space-y-8 animate-fadeIn h-full flex flex-col">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b pb-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <Server className="text-amber-500" /> Template Architect
          </h2>
          <p className="text-slate-500 text-sm">Meta Compliance Engine & AI Strategy Generator</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl overflow-x-auto">
            {(['SYSTEM', 'TRIGGERS', 'STRATEGY', 'LIBRARY'] as const).map(tab => (
                <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${activeTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    {tab === 'SYSTEM' ? 'System Health' : tab === 'TRIGGERS' ? 'Automation Map' : tab === 'STRATEGY' ? 'AI Architect' : 'Library'}
                </button>
            ))}
        </div>
      </div>

      {/* --- TAB: TRIGGER MAP --- */}
      {activeTab === 'TRIGGERS' && (
          <div className="space-y-6">
              <div className="bg-slate-900 text-white p-6 rounded-[2rem] relative overflow-hidden">
                  <div className="relative z-10">
                      <h3 className="text-lg font-black flex items-center gap-2 mb-2">
                          <GitMerge className="text-amber-400" /> Trigger Architecture
                      </h3>
                      <p className="text-slate-400 text-xs max-w-xl leading-relaxed">
                          Visual map of system events and their corresponding WhatsApp templates.
                          Missing templates (marked red) must be deployed for automation to function.
                      </p>
                  </div>
                  <div className="absolute right-0 bottom-0 opacity-10">
                      <BrainCircuit size={150} />
                  </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                  {SYSTEM_TRIGGER_MAP.map((trigger, idx) => {
                      const match = templates.find(t => t.name === trigger.defaultTemplateName || t.name.startsWith(trigger.defaultTemplateName));
                      const requiredDef = REQUIRED_SYSTEM_TEMPLATES.find(r => r.name === trigger.defaultTemplateName);
                      const isMissing = !match;
                      
                      return (
                          <div key={trigger.id} className={`bg-white p-5 rounded-2xl border shadow-sm flex flex-col gap-4 ${isMissing ? 'border-l-4 border-l-rose-500' : 'border-l-4 border-l-emerald-500'}`}>
                              
                              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                  <div className="flex items-start gap-4">
                                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${isMissing ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                          {idx + 1}
                                      </div>
                                      <div>
                                          <div className="flex items-center gap-2">
                                              <h4 className="font-bold text-slate-800 text-sm">{trigger.label}</h4>
                                              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${isMissing ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                  {isMissing ? 'MISSING TEMPLATE' : 'ACTIVE'}
                                              </span>
                                          </div>
                                          <p className="text-xs text-slate-500 mt-1">{trigger.description}</p>
                                      </div>
                                  </div>

                                  <div className="flex items-center gap-2">
                                      {isMissing && requiredDef && (
                                          <button 
                                            onClick={() => handleDeployStandard(trigger, requiredDef)}
                                            disabled={deployingTriggerId === trigger.id}
                                            className="text-[10px] font-bold bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition-all whitespace-nowrap shadow-md flex items-center gap-2"
                                          >
                                              {deployingTriggerId === trigger.id ? <Loader2 size={12} className="animate-spin"/> : <UploadCloud size={12} />}
                                              Deploy Standard
                                          </button>
                                      )}
                                      <button 
                                        onClick={() => handleCreateVariant(trigger)}
                                        className="text-[10px] font-bold bg-white border border-slate-200 text-slate-600 px-3 py-2 rounded-lg hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 transition-all whitespace-nowrap shadow-sm"
                                      >
                                          + Create Variant
                                      </button>
                                  </div>
                              </div>

                              {/* Details Panel */}
                              <div className="bg-slate-50 p-4 rounded-xl flex flex-col md:flex-row gap-6 text-xs border border-slate-100">
                                  <div className="flex-1">
                                      <p className="font-black text-slate-400 uppercase tracking-widest mb-2">Required Variables</p>
                                      <div className="flex flex-wrap gap-2">
                                          {trigger.requiredVariables.map(v => (
                                              <span key={v} className="bg-white border px-2 py-1 rounded text-slate-600 font-mono font-medium">{v}</span>
                                          ))}
                                      </div>
                                  </div>
                                  
                                  <div className="flex-1 border-l pl-6 border-slate-200">
                                       <p className="font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                           {isMissing ? 'Recommended Template Content' : 'Active Template Content'}
                                           <FileJson size={12} />
                                       </p>
                                       <div className="font-mono text-slate-600 italic bg-white p-3 rounded-lg border border-dashed border-slate-200">
                                           "{match ? match.content : requiredDef?.content || 'No default definition found.'}"
                                       </div>
                                       {isMissing && (
                                           <p className="text-[10px] text-rose-500 mt-2 font-medium flex items-center gap-1">
                                               <AlertCircle size={10} /> Automation will fail until this template is deployed.
                                           </p>
                                       )}
                                  </div>
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      )}

      {/* --- TAB 1: SYSTEM HEALTH --- */}
      {activeTab === 'SYSTEM' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
                <div className="bg-white p-6 rounded-3xl border shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <ShieldAlert className="text-emerald-500" /> Core Template Status
                        </h3>
                        <div className="flex gap-2">
                             <button 
                                onClick={handleAutoHeal}
                                disabled={repairing}
                                className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center gap-2 disabled:opacity-50 shadow-sm"
                             >
                                {repairing ? <Loader2 size={12} className="animate-spin" /> : <Wrench size={12} />}
                                Regenerate Core
                             </button>
                        </div>
                    </div>
                    <div className="space-y-3">
                        {REQUIRED_SYSTEM_TEMPLATES.map(req => {
                            const match = templates.find(t => t.name === req.name || t.name.startsWith(req.name));
                            return (
                                <div key={req.name} className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full ${match && match.status === 'APPROVED' ? 'bg-emerald-500' : match ? 'bg-amber-500' : 'bg-rose-500'}`}></div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-700">{req.name}</p>
                                            <p className="text-[10px] text-slate-400 uppercase tracking-wide">{req.category}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {match ? (
                                            <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${getStatusColor(match.status)}`}>
                                                {match.status || 'LOCAL'}
                                            </span>
                                        ) : (
                                            <span className="text-[10px] font-black uppercase px-2 py-1 rounded-full bg-rose-100 text-rose-700">MISSING</span>
                                        )}
                                        {match && (match.status === 'REJECTED' || match.source === 'LOCAL') && (
                                            <button 
                                                onClick={() => handleFixSystemTemplate(match, req)}
                                                className="text-amber-600 hover:text-amber-800 bg-amber-50 px-2 py-1 rounded text-[10px] font-bold border border-amber-200"
                                                title="Fix by creating new version with safe content"
                                            >
                                                Fix & Redeploy
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <div className="bg-black/90 rounded-3xl p-6 font-mono text-xs text-emerald-400 overflow-y-auto h-[300px] border border-slate-800 shadow-inner">
                     <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-2 text-slate-400">
                        <Terminal size={14} /> Intelligence Logs
                     </div>
                     {repairLogs.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50">
                            <Activity size={32} className="mb-2" />
                            <p>Waiting for diagnostic run...</p>
                        </div>
                     ) : (
                        <div className="space-y-1.5">
                            {repairLogs.map((log, i) => (
                                <div key={i} className="break-all border-b border-white/5 pb-1 mb-1 last:border-0">{log}</div>
                            ))}
                            <div ref={logsEndRef} />
                        </div>
                     )}
                </div>
            </div>
        </div>
      )}

      {/* --- TAB 2: AI STRATEGY (Prompt Box) --- */}
      {activeTab === 'STRATEGY' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-4 space-y-6">
                  {/* GENERATIVE PROMPT BOX */}
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
                              placeholder="Describe your template needs...&#10;Ex: 'Send a polite reminder to high risk customers 2 days after due date to pay via UPI.'"
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

                      <div className="relative z-10">
                         <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Quick Context Prompts</p>
                         <div className="grid grid-cols-1 gap-2">
                             {QUICK_PROMPTS.map((q, i) => (
                                 <button
                                    key={i}
                                    onClick={() => handlePromptGeneration(q.prompt)}
                                    className="text-left px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-colors border border-indigo-100 flex items-center justify-between group"
                                 >
                                    <span>{q.label}</span>
                                    <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                 </button>
                             ))}
                         </div>
                      </div>

                      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500 opacity-5 rounded-full blur-3xl"></div>
                  </div>
              </div>

              <div className="lg:col-span-8 space-y-6">
                  {/* Manual Editor / AI Output */}
                  <div ref={editorRef} className={`bg-white p-6 rounded-2xl border shadow-sm animate-fadeIn border-l-4 border-l-blue-500 ${highlightEditor ? 'ring-4 ring-emerald-400 ring-opacity-50 transition-all duration-500' : ''}`}>
                      <div className="flex justify-between items-start mb-4">
                        <div>
                            <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                <Edit size={16} className="text-blue-500" /> Template Editor
                            </h4>
                            <p className="text-xs text-slate-500 mt-1">
                                Review AI suggestions before deploying to Meta.
                            </p>
                        </div>
                        {highlightEditor && <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold animate-pulse">Content Generated!</span>}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <label className="text-[10px] font-bold uppercase text-slate-400">Template Name</label>
                            <input 
                                value={templateName}
                                onChange={e => setTemplateName(e.target.value)}
                                className="w-full font-mono text-sm border rounded-lg p-2 outline-none focus:border-blue-500"
                                placeholder="template_name"
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
                          <div className="col-span-2">
                            <label className="text-[10px] font-bold uppercase text-slate-400">App Group (Context)</label>
                            <select 
                                value={selectedGroup} 
                                onChange={e => setSelectedGroup(e.target.value as AppTemplateGroup)}
                                className="w-full text-sm border rounded-lg p-2 outline-none focus:border-blue-500 bg-slate-50 font-bold text-slate-700"
                            >
                                <option value="PAYMENT_COLLECTION">Payment Collection</option>
                                <option value="ORDER_STATUS">Order Status</option>
                                <option value="MARKETING_PROMO">Marketing / Promo</option>
                                <option value="GENERAL_SUPPORT">General Support</option>
                                <option value="SYSTEM_NOTIFICATIONS">System Notifications</option>
                                <option value="UNCATEGORIZED">Uncategorized</option>
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
                      
                      <div className="flex gap-3">
                          <button 
                            onClick={() => handleSaveLocalOrDeploy('META')} 
                            disabled={pushingMeta}
                            className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold text-xs shadow-md hover:bg-emerald-700 flex items-center justify-center gap-2"
                          >
                             {pushingMeta ? <Loader2 className="animate-spin" /> : <UploadCloud size={16} />}
                             Deploy to Meta
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

      {/* --- TAB 3: GROUPED LIBRARY --- */}
      {activeTab === 'LIBRARY' && (
          <div className="bg-white rounded-3xl border shadow-sm p-6">
              <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                      <Server size={18} className="text-slate-400" /> Grouped Library
                  </h3>
                  <button onClick={() => handleSyncFromMeta(false)} className="text-xs font-bold text-amber-600 hover:underline flex items-center gap-1">
                      <RefreshCcw size={12} /> Refresh Status
                  </button>
              </div>
              
              <div className="space-y-8">
                  {Object.entries(groupedTemplates).map(([groupKey, unknownTemplates]) => {
                      const groupTemplates = unknownTemplates as WhatsAppTemplate[];
                      if (groupTemplates.length === 0) return null;
                      return (
                          <div key={groupKey} className="animate-fadeIn">
                              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                                  <FolderOpen size={16} className="text-slate-400" />
                                  <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest">
                                      {getGroupLabel(groupKey)}
                                  </h4>
                                  <span className="bg-slate-100 text-slate-500 text-[9px] px-2 py-0.5 rounded-full font-bold">
                                      {groupTemplates.length}
                                  </span>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  {groupTemplates.map(t => (
                                      <div key={t.id} className="border p-4 rounded-2xl hover:border-blue-400 transition-all group relative bg-slate-50/50">
                                          <div className="flex justify-between items-start mb-2">
                                              <div className="font-bold text-sm text-slate-800 truncate pr-2" title={t.name}>{t.name}</div>
                                              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${getStatusColor(t.status)}`}>{t.status || 'LOCAL'}</span>
                                          </div>
                                          <p className="text-xs text-slate-500 line-clamp-3 mb-3 italic">"{t.content}"</p>
                                          <div className="flex justify-between items-center mt-auto border-t pt-3">
                                              <span className="text-[10px] font-bold text-slate-400">{t.category || 'UTILITY'}</span>
                                              <div className="flex gap-2">
                                                  <button 
                                                    onClick={() => handleEditTemplate(t)}
                                                    className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1 text-[10px] font-bold"
                                                    title="Edit / New Version"
                                                  >
                                                    <Edit size={12} /> Edit
                                                  </button>
                                                  <button 
                                                    onClick={() => handleDeleteTemplate(t)}
                                                    disabled={deletingId === t.id}
                                                    className="p-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors flex items-center gap-1 text-[10px] font-bold"
                                                    title="Delete"
                                                  >
                                                     {deletingId === t.id ? <Loader2 size={12} className="animate-spin"/> : <Trash2 size={12} />}
                                                  </button>
                                              </div>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      );
                  })}
                  {templates.length === 0 && <p className="text-center text-slate-400 italic">No templates loaded. Try syncing from System Health.</p>}
              </div>
          </div>
      )}
    </div>
  );
};

export default WhatsAppTemplates;
