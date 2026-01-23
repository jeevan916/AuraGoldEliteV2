
import { useState, useEffect, useRef, useMemo } from 'react';
import { WhatsAppTemplate, PsychologicalTactic, RiskProfile, MetaCategory, AppTemplateGroup, SystemTrigger } from '../types';
import { REQUIRED_SYSTEM_TEMPLATES } from '../constants';
import { geminiService } from '../services/geminiService';
import { whatsappService } from '../services/whatsappService';

export function useTemplateManagement(templates: WhatsAppTemplate[], onUpdate: (templates: WhatsAppTemplate[]) => void) {
  const [activeTab, setActiveTab] = useState<'CORE' | 'AUTOMATION' | 'BUILDER' | 'LIBRARY' | 'ISSUES'>('CORE');
  
  // Builder State
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

  // System State
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
                          id: mt.id,
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
              const uniqueMap = new Map();
              finalList.forEach(item => {
                  if(!uniqueMap.has(item.name)) uniqueMap.set(item.name, item);
                  else if(item.id && !item.id.startsWith('sys-') && uniqueMap.get(item.name).id.startsWith('sys-')) {
                      uniqueMap.set(item.name, item);
                  }
              });
              const uniqueList = Array.from(uniqueMap.values()) as WhatsAppTemplate[];

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

  // Helper to ensure example count matches variable count to prevent "Invalid parameter"
  const alignExamples = (content: string, providedExamples: string[] = []): string[] => {
      const varCount = (content.match(/{{[0-9]+}}/g) || []).length;
      let finalExamples = [...providedExamples];
      
      // Pad if missing
      while(finalExamples.length < varCount) {
          finalExamples.push(`sample_${finalExamples.length + 1}`);
      }
      
      // Trim if too many
      if(finalExamples.length > varCount) {
          finalExamples = finalExamples.slice(0, varCount);
      }
      
      return finalExamples;
  };

  const handleAutoHeal = async () => {
      setRepairing(true);
      addLog("Initializing Gemini 2.5 Structural Integrity Check...");
      let restoredCount = 0;
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
                  addLog(`MISMATCH: ${req.name}. Harmonizing...`);
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
      
      const safeExamples = alignExamples(validation.optimizedContent, req.examples);

      const payload: WhatsAppTemplate = {
          id: `heal-${Date.now()}`,
          name: req.name,
          content: validation.optimizedContent, 
          tactic: 'AUTHORITY',
          targetProfile: 'REGULAR',
          isAiGenerated: !validation.isCompliant,
          source: 'LOCAL',
          category: req.category as MetaCategory,
          variableExamples: safeExamples,
          appGroup: req.appGroup as AppTemplateGroup
      };
      const result = await whatsappService.createMetaTemplate(payload);
      if (result.success) addLog(`SUCCESS: ${req.name} deployed.`);
      else addLog(`FAILED: ${req.name} - ${result.error?.message}`);
  };

  const repairHelper = async (existingMetaTpl: WhatsAppTemplate, requiredDef: any) => {
      const fix = await geminiService.validateAndFixTemplate(requiredDef.content, requiredDef.name, requiredDef.category);
      
      const safeExamples = alignExamples(fix.optimizedContent, requiredDef.examples);

      const payload: WhatsAppTemplate = {
          ...existingMetaTpl,
          content: fix.optimizedContent,
          variableExamples: safeExamples, 
          structure: undefined 
      };
      
      if (existingMetaTpl.id.startsWith('sys-') || existingMetaTpl.id.startsWith('local-')) {
          await deployHelper(requiredDef);
          return;
      }
      const result = await whatsappService.editMetaTemplate(existingMetaTpl.id, payload);
      if (result.success) addLog(`FIXED: ${requiredDef.name} updated on Meta.`);
      else addLog(`FIX FAILED: ${requiredDef.name} - ${result.error?.message}`);
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
      } catch (e: any) { alert(`Error: ${e.message}`); } 
      finally { setDeployingTriggerId(null); }
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
          const safeExamples = alignExamples(result.fixedContent, result.variableExamples);

          const fixedTemplate = {
              ...tpl,
              content: result.fixedContent,
              category: result.category,
              variableExamples: safeExamples || []
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
      } catch (e: any) { alert(`Auto-fix failed: ${e.message}`); } 
      finally { setIsFixing(null); }
  };

  const handleDeleteTemplate = async (tpl: WhatsAppTemplate) => {
      const isMeta = tpl.source === 'META';
      if (!confirm(isMeta ? `WARNING: Permanently DELETE "${tpl.name}" from Meta?` : `Delete "${tpl.name}" locally?`)) return;
      setDeletingId(tpl.id);
      try {
          if (isMeta) {
              const res = await whatsappService.deleteMetaTemplate(tpl.name);
              if (!res.success) throw new Error(res.error?.message || "Delete Failed");
          }
          onUpdate(templates.filter(t => t.id !== tpl.id));
          alert("Template deleted.");
      } catch (e: any) { alert(`Delete Failed: ${e.message}`); } 
      finally { setDeletingId(null); }
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
      
      const safeExamples = alignExamples(generatedContent, variableExamples);

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
          variableExamples: safeExamples
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

  return {
    state: {
      activeTab, promptText, isGenerating, templateName, generatedContent, selectedCategory, 
      selectedGroup, editingStructure, variableExamples, highlightEditor, aiAnalysisReason, 
      editingMetaId, selectedTactic, selectedProfile, syncingMeta, pushingMeta, deletingId, 
      deployingTriggerId, isFixing, repairing, repairLogs, rejectedTemplates, groupedTemplates
    },
    actions: {
      setActiveTab, setPromptText, setTemplateName, setGeneratedContent, setSelectedCategory, 
      setSelectedGroup, setSelectedTactic, setEditingStructure, setVariableExamples, setHighlightEditor,
      handleSyncFromMeta, handleAutoHeal, handleDeployStandard, handlePromptGeneration, 
      handleEditTemplate, handleAiAutoFix, handleDeleteTemplate, handleCreateVariant, handleSaveLocalOrDeploy
    },
    refs: { logsEndRef, editorRef }
  };
}
