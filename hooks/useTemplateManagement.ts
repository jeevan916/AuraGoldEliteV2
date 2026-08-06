
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

  // Filter for both explicit REJECTED status and our new MISSING status (disparities)
  const rejectedTemplates = useMemo(() => (templates || []).filter(t => t && (t.status === 'REJECTED' || t.status === 'MISSING')), [templates]);

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

  const getBaseName = (n: string) => (n || '').toLowerCase().trim().replace(/_v\d+$/i, '');

  const handleSyncFromMeta = async (silent: boolean = false) => {
      setSyncingMeta(true);
      if(!silent) addLog("Syncing templates from Meta...");
      try {
          const metaTemplatesRaw = await whatsappService.fetchMetaTemplates();
          if (metaTemplatesRaw) {
              // POLICY FILTER: Only process INCOMING templates starting with 'auragold'
              const metaTemplates = metaTemplatesRaw.filter((t: any) => t.name.toLowerCase().startsWith('auragold'));

              // 1. Create a quick lookup map of what actually exists on Meta right now
              const metaMap = new Map<string, any>();
              metaTemplates.forEach((mt: any) => metaMap.set(mt.name.toLowerCase(), mt));

              // 2. Sort local templates so real Meta templates take precedence over sys- placeholders
              const sortedLocal = [...templates].sort((a, b) => {
                  const aIsSys = a.id?.startsWith('sys-') ? 1 : 0;
                  const bIsSys = b.id?.startsWith('sys-') ? 1 : 0;
                  return aIsSys - bIsSys;
              });

              const seenLocalBaseNames = new Set<string>();
              
              const processedLocal = sortedLocal
                  .filter(localTpl => localTpl && localTpl.name && localTpl.name.toLowerCase().startsWith('auragold'))
                  .filter(localTpl => {
                      // Deduplicate local templates by base name
                      const baseName = getBaseName(localTpl.name);
                      if (seenLocalBaseNames.has(baseName)) return false;
                      seenLocalBaseNames.add(baseName);
                      return true;
                  })
                  .map(localTpl => {
                      let remoteKey = localTpl.name.toLowerCase();
                      let remote = metaMap.get(remoteKey);

                      if (!remote) {
                          const localBase = getBaseName(localTpl.name);
                          for (const [k, v] of metaMap.entries()) {
                              if (getBaseName(k) === localBase) {
                                  remote = v;
                                  remoteKey = k;
                                  break;
                              }
                          }
                      }

                      if (remote) {
                          metaMap.delete(remoteKey);
                          
                          const bodyComp = remote.components?.find((c: any) => c.type === 'BODY');
                          const remoteContent = bodyComp?.text || "";
                          const hasDisparity = remoteContent.replace(/\s+/g, ' ').trim() !== localTpl.content.replace(/\s+/g, ' ').trim();
                          
                          return {
                              ...localTpl,
                              id: remote.id,
                              name: remote.name, // Use registered template name from Meta
                              status: remote.status,
                              category: remote.category,
                              structure: remote.components,
                              content: bodyComp?.text || localTpl.content, 
                              rejectionReason: remote.rejected_reason || undefined,
                              source: 'META' as const,
                              hasDisparity,
                              disparityReason: hasDisparity ? "Local content differs from Meta" : undefined
                          };
                      } else {
                          // MATCH NOT FOUND: Check if it should be purged or flagged
                          if (localTpl.source === 'META' && !localTpl.id.startsWith('sys-')) {
                              // Template from previous WABA ID or deleted from Meta -> Purge it from state
                              return null;
                          }
                          if (localTpl.id.startsWith('sys-')) {
                              return {
                                  ...localTpl,
                                  status: 'MISSING', 
                                  rejectionReason: 'System template not found on current Meta WABA ID. Re-sync system templates to register on this WABA.',
                              };
                          }
                          // If it's a local draft, leave it alone
                          return localTpl;
                      }
                  })
                  .filter(Boolean) as WhatsAppTemplate[];

              // 3. Add any NEW templates found on Meta that weren't in local
              const newFromMeta: WhatsAppTemplate[] = [];
              metaMap.forEach((mt: any) => {
                  const bodyComp = mt.components?.find((c: any) => c.type === 'BODY');
                  const tplObj: WhatsAppTemplate = {
                      id: mt.id,
                      name: mt.name,
                      content: bodyComp?.text || "No Content",
                      tactic: 'AUTHORITY',
                      targetProfile: 'REGULAR',
                      isAiGenerated: false,
                      structure: mt.components,
                      source: 'META',
                      status: mt.status,
                      rejectionReason: mt.rejected_reason,
                      category: mt.category,
                      appGroup: inferGroup({ name: mt.name, content: bodyComp?.text } as any)
                  };
                  newFromMeta.push(tplObj);
              });

              const finalList = [...processedLocal, ...newFromMeta];
              const missingCount = finalList.filter(t => t.status === 'MISSING').length;
              const purgedCount = templates.length - processedLocal.length; // Approximate count of purged items

              onUpdate(finalList);
              
              if (!silent) {
                  let msg = `Sync Complete.`;
                  if (newFromMeta.length > 0) msg += ` Imported ${newFromMeta.length} new templates.`;
                  if (missingCount > 0) msg += ` Flagged ${missingCount} templates as MISSING on Meta.`;
                  if (purgedCount > 0) msg += ` Purged ${purgedCount} non-Auragold templates from local library.`;
                  
                  const ignoredExternal = metaTemplatesRaw.length - metaTemplates.length;
                  if (ignoredExternal > 0) msg += ` Ignored ${ignoredExternal} external templates.`;
                  
                  alert(msg);
                  addLog(msg);
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

  const alignExamples = (content: string, providedExamples: string[] = []): string[] => {
      const matches = content.match(/{{([0-9]+)}}/g) || [];
      const indices = matches.map(m => parseInt(m.replace(/[^0-9]/g, ''), 10));
      const maxIndex = indices.length > 0 ? Math.max(...indices) : 0;
      
      let finalExamples = [...providedExamples];
      while(finalExamples.length < maxIndex) {
          finalExamples.push(`Sample ${finalExamples.length + 1}`);
      }
      if(finalExamples.length > maxIndex) {
          finalExamples = finalExamples.slice(0, maxIndex);
      }
      return finalExamples.map((ex, i) => {
          if (typeof ex === 'string') ex = ex.trim();
          if (!ex) {
              if (i === 0) return 'Rahul Sharma';
              if (i === 1) return '₹25,000';
              if (i === 2) return 'ORD-10023';
              return `Sample ${i + 1}`;
          }
          return ex;
      });
  };

  const handleAutoHeal = async () => {
      setRepairing(true);
      addLog("Initializing Gemini 2.5 Structural Integrity Check...");
      let restoredCount = 0;
      const remoteTemplates = await handleSyncFromMeta(true);
      
      for (const req of REQUIRED_SYSTEM_TEMPLATES) {
          const reqBase = getBaseName(req.name);
          const match = remoteTemplates?.find(t => t.name === req.name || getBaseName(t.name) === reqBase);
          if (!match) {
              addLog(`MISSING: ${req.name}. Deploying fresh...`);
              await deployHelper(req);
              restoredCount++;
          } else {
              if (match.status === 'REJECTED' || match.status === 'MISSING') {
                  addLog(`${match.status}: ${req.name}. Fixing...`);
                  await repairHelper(match, req);
                  restoredCount++;
                  continue;
              }
              const reqVars = (req.content.match(/{{[0-9]+}}/g) || []).length;
              const remoteVars = (match.content.match(/{{[0-9]+}}/g) || []).length;
              const isDrasticallyDifferent = Math.abs(req.content.length - match.content.length) > 50;

              let buttonMismatch = false;
              if (req.structure) {
                  const reqButtons = req.structure.find((c: any) => c.type === 'BUTTONS')?.buttons || [];
                  const matchButtons = match.structure?.find((c: any) => c.type === 'BUTTONS')?.buttons || [];
                  
                  if (reqButtons.length !== matchButtons.length) {
                      buttonMismatch = true;
                  } else {
                      for (let i = 0; i < reqButtons.length; i++) {
                          if (reqButtons[i].type === 'URL' && reqButtons[i].url !== matchButtons[i].url) {
                              buttonMismatch = true;
                              break;
                          }
                      }
                  }
              }

              const isApproved = match.status === 'APPROVED' || match.status === 'ACTIVE';

              if (reqVars !== remoteVars || (!isApproved && isDrasticallyDifferent) || buttonMismatch) {
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
          appGroup: req.appGroup as AppTemplateGroup,
          structure: (req as any).structure 
      };
      
      let result = await whatsappService.createMetaTemplate(payload);
      
      // --- AI AUTO-RETRY LOOP ---
      if (!result.success && result.rawError) {
          addLog(`FAILED: ${req.name} - ${result.error?.message}. Triggering AI Auto-Fix Loop...`);
          try {
              const aiFix = await geminiService.fixRejectedTemplate({
                  ...payload,
                  rejectionReason: typeof result.error === 'string' ? result.error : JSON.stringify(result.rawError)
              });
              
              if(aiFix.fixedContent) {
                  addLog(`🤖 AI Rewrote Payload: ${aiFix.diagnosis}`);
                  const newExamples = alignExamples(aiFix.fixedContent, req.examples);
                  const retryPayload = { ...payload, content: aiFix.fixedContent, variableExamples: newExamples };
                  
                  result = await whatsappService.createMetaTemplate(retryPayload);
                  if (result.success) {
                      addLog(`✅ RETRY SUCCESS: ${req.name} deployed.`);
                  }
              }
          } catch(e: any) {
              addLog(`❌ AI Retry Failed: ${e.message}`);
          }
      }
      // --------------------------

      if (result.success) {
          addLog(`SUCCESS: ${req.name} deployed.`);
      } else {
          addLog(`FINAL FAIL: ${req.name} - ${result.error?.message}`);
          if (result.rawError) await runDeepDiagnostics(result.rawError, payload);
      }
  };

  const repairHelper = async (existingMetaTpl: WhatsAppTemplate, requiredDef: any) => {
      const fix = await geminiService.validateAndFixTemplate(requiredDef.content, requiredDef.name, requiredDef.category);
      const safeExamples = alignExamples(fix.optimizedContent, requiredDef.examples);

      const payload: WhatsAppTemplate = {
          ...existingMetaTpl,
          content: fix.optimizedContent,
          variableExamples: safeExamples, 
          structure: (requiredDef as any).structure ? (requiredDef as any).structure : undefined
      };
      
      if (existingMetaTpl.id.startsWith('sys-') || existingMetaTpl.id.startsWith('local-')) {
          await deployHelper(requiredDef);
          return;
      }
      
      let result = await whatsappService.editMetaTemplate(existingMetaTpl.id, payload);

      // --- AI AUTO-RETRY LOOP ---
      if (!result.success && result.rawError) {
          addLog(`EDIT FAILED: ${requiredDef.name} - ${result.error?.message}. Triggering AI Auto-Fix Loop...`);
          try {
              const aiFix = await geminiService.fixRejectedTemplate({
                  ...payload,
                  rejectionReason: typeof result.error === 'string' ? result.error : JSON.stringify(result.rawError)
              });
              
              if(aiFix.fixedContent) {
                  addLog(`🤖 AI Rewrote Payload: ${aiFix.diagnosis}`);
                  const newExamples = alignExamples(aiFix.fixedContent, requiredDef.examples);
                  const retryPayload = { ...payload, content: aiFix.fixedContent, variableExamples: newExamples };
                  
                  result = await whatsappService.editMetaTemplate(existingMetaTpl.id, retryPayload);
                  if (result.success) {
                      addLog(`✅ RETRY SUCCESS: ${requiredDef.name} edited.`);
                  }
              }
          } catch(e: any) {
              addLog(`❌ AI Retry Failed: ${e.message}`);
          }
      }
      // --------------------------

      if (result.success) {
          addLog(`FIXED: ${requiredDef.name} updated on Meta.`);
      } else {
          addLog(`FIX FAILED: ${requiredDef.name} - ${result.error?.message}`);
          if (result.rawError) await runDeepDiagnostics(result.rawError, payload);
      }
  };

  // NEW: Deep Diagnostic Loop
  const runDeepDiagnostics = async (rawError: any, payload: any) => {
      addLog(`⚡ Invoking Gemini 3 Pro for Root Cause Analysis...`);
      try {
          const diagnosis = await geminiService.diagnoseError(
              "Meta Template API Rejected Payload",
              "WhatsAppTemplates",
              JSON.stringify(rawError),
              { payload }
          );
          addLog(`🤖 AI DIAGNOSIS: ${diagnosis.explanation}`);
          if (diagnosis.implementationPrompt) {
              addLog(`💡 SUGGESTION: ${diagnosis.implementationPrompt.substring(0, 100)}...`);
          }
      } catch (e) {
          addLog(`Diagnosis failed.`);
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
              appGroup: def.appGroup as AppTemplateGroup,
              structure: (def as any).structure
          };
          const result = await whatsappService.createMetaTemplate(payload);
          if (result.success) {
              const newTpl: WhatsAppTemplate = { ...payload, name: result.finalName!, source: 'META', status: 'PENDING' };
              onUpdate([newTpl, ...templates]);
              alert(`Deployed: ${result.finalName}`);
          } else {
              alert(`Failed: ${result.error?.message}`);
              if (result.rawError) await runDeepDiagnostics(result.rawError, payload);
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
          
          let updateResult;
          // If status is MISSING, we must create it fresh, not edit
          if (tpl.status === 'MISSING') {
              updateResult = await whatsappService.createMetaTemplate(fixedTemplate);
          } else {
              updateResult = await whatsappService.editMetaTemplate(tpl.id, fixedTemplate);
          }

          if (updateResult.success) {
              setAiAnalysisReason(`AUTO-FIX SUCCESS: ${result.diagnosis}`);
              // Update local state to pending
              onUpdate(templates.map(t => t.id === tpl.id ? { 
                  ...fixedTemplate, 
                  status: 'PENDING', 
                  rejectionReason: undefined,
                  id: updateResult.finalName ? tpl.id : tpl.id // keep ID if edit, might change if create
              } : t));
              
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
              if (updateResult.rawError) await runDeepDiagnostics(updateResult.rawError, fixedTemplate);
          }
      } catch (e: any) { alert(`Auto-fix failed: ${e.message}`); } 
      finally { setIsFixing(null); }
  };

  const handleDeleteTemplate = async (tpl: WhatsAppTemplate) => {
      const isMeta = tpl.source === 'META';
      // If it's missing on Meta, we just delete locally without calling API
      const isMissing = tpl.status === 'MISSING';

      if (!confirm(isMeta && !isMissing ? `WARNING: Permanently DELETE "${tpl.name}" from Meta?` : `Delete "${tpl.name}" locally?`)) return;
      setDeletingId(tpl.id);
      try {
          if (isMeta && !isMissing) {
              const res = await whatsappService.deleteMetaTemplate(tpl.name);
              if (!res.success) throw new Error(res.error?.message || "Delete Failed");
          }
          onUpdate(templates.filter(t => t.id !== tpl.id));
          alert("Template deleted.");
      } catch (e: any) { alert(`Delete Failed: ${e.message}`); } 
      finally { setDeletingId(null); }
  };

  const [isGeneratingVariant, setIsGeneratingVariant] = useState(false);
  const [variantTrigger, setVariantTrigger] = useState<SystemTrigger | null>(null);
  const [showVariantModal, setShowVariantModal] = useState(false);

  // ... (existing state)

  const handleSaveLocalOrDeploy = async (action: 'LOCAL' | 'META') => {
      if(!generatedContent || !templateName) return alert("Name and Content required");
      
      const safeExamples = alignExamples(generatedContent, variableExamples);

      // ENFORCE NAMING CONVENTION IN BUILDER
      let safeName = templateName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      if (!safeName.startsWith('auragold_')) safeName = `auragold_${safeName}`;

      const newTpl: WhatsAppTemplate = {
          id: `local-${Date.now()}`,
          name: safeName,
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
          alert("Saved to Local Library with prefix 'auragold_'");
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
              const deployedTpl = { ...newTpl, name: result.finalName || safeName, source: 'META' as const, status: 'PENDING' as const };
              if (editingMetaId) {
                  onUpdate(templates.map(t => t.id === editingMetaId ? { ...deployedTpl, id: editingMetaId } : t));
              } else {
                  onUpdate([deployedTpl, ...templates]);
              }
              setAiAnalysisReason(null);
              setEditingMetaId(null);
          } else {
              alert(`Deployment Error: ${result.error?.message || JSON.stringify(result.error)}`);
              if (result.rawError) await runDeepDiagnostics(result.rawError, newTpl);
          }
      }
      setGeneratedContent('');
      setTemplateName('');
      setEditingStructure([]);
  };

  const handleCreateVariant = (trigger: SystemTrigger) => {
      setVariantTrigger(trigger);
      setShowVariantModal(true);
  };

  const handleGenerateVariant = async (goal: string) => {
      if (!variantTrigger) return;
      setIsGeneratingVariant(true);
      try {
          const originalContent = templates.find(t => t.name === variantTrigger.defaultTemplateName)?.content || "";
          const result = await geminiService.generateVariant(originalContent, goal);
          
          // For now, just alert the result as we don't have the full variant saving logic yet
          alert(`Generated Variant: ${result.content}\n\nDiagnosis: ${result.diagnosis}`);
          setShowVariantModal(false);
      } catch (e: any) { alert("Generation failed: " + e.message); }
      finally { setIsGeneratingVariant(false); }
  };

  const handleSimulateTrigger = async (trigger: SystemTrigger, template?: WhatsAppTemplate) => {
      if (!template) {
          alert("No active template linked to this trigger. Please deploy or link a template first.");
          return;
      }

      const phone = prompt(`Enter WhatsApp number to simulate '${trigger.label}'\n(Include country code, e.g., 919876543210):`);
      if (!phone) return;

      // Generate dummy variables based on required variables
      const dummyVars = trigger.requiredVariables.map((v) => {
          const lowerV = v.toLowerCase();
          if (lowerV.includes('amount') || lowerV.includes('price')) return '1000';
          if (lowerV.includes('date')) return '2026-12-31';
          if (lowerV.includes('link') || lowerV.includes('url') || lowerV.includes('suffix')) return 'test_link_123';
          return `Test_${v.replace(/\s+/g, '')}`;
      });

      // Heuristic: if the last variable is a link, Meta usually expects it as a button parameter
      let bodyVars = [...dummyVars];
      let buttonVar = undefined;
      const lastVarName = trigger.requiredVariables[trigger.requiredVariables.length - 1]?.toLowerCase() || '';
      if (lastVarName.includes('link') || lastVarName.includes('url') || lastVarName.includes('suffix')) {
          buttonVar = bodyVars.pop(); 
      }

      try {
          const res = await whatsappService.sendTemplateMessage(
              phone,
              template.name,
              'en_US',
              bodyVars,
              'Simulation User',
              buttonVar,
              undefined,
              'SYSTEM'
          );

          if (res.success) {
              alert(`✅ Simulation sent successfully to ${phone}!`);
          } else {
              alert(`❌ Simulation failed: ${res.error}\n\nMake sure your WhatsApp Business account is properly configured and the template is approved on Meta.`);
          }
      } catch (e: any) {
          alert(`Error: ${e.message}`);
      }
  };

  return {
    state: {
      activeTab, promptText, isGenerating, templateName, generatedContent, selectedCategory, 
      selectedGroup, editingStructure, variableExamples, highlightEditor, aiAnalysisReason, 
      editingMetaId, selectedTactic, selectedProfile, syncingMeta, pushingMeta, deletingId, 
      deployingTriggerId, isFixing, repairing, repairLogs, rejectedTemplates, groupedTemplates,
      isGeneratingVariant, showVariantModal, variantTrigger
    },
    actions: {
      setActiveTab, setPromptText, setTemplateName, setGeneratedContent, setSelectedCategory, 
      setSelectedGroup, setSelectedTactic, setEditingStructure, setVariableExamples, setHighlightEditor,
      handleSyncFromMeta, handleAutoHeal, handleDeployStandard, handlePromptGeneration, 
      handleEditTemplate, handleAiAutoFix, handleDeleteTemplate, handleCreateVariant, handleSaveLocalOrDeploy,
      handleGenerateVariant, setShowVariantModal, handleSimulateTrigger
    },
    refs: { logsEndRef, editorRef }
  };
}
