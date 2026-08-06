import React, { useState } from 'react';
import { 
  BrainCircuit, Sparkles, Loader2, Edit, Wrench, UploadCloud, Save, 
  Variable, Plus, Trash2, ExternalLink, Phone, MessageSquare, Info,
  CheckCircle2, AlertCircle, Eye
} from 'lucide-react';
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
  variableExamples?: string[];
  setVariableExamples?: (examples: string[]) => void;
  editingStructure?: any[];
  setEditingStructure?: (structure: any[]) => void;
}

export const BuilderTab: React.FC<BuilderTabProps> = ({
  promptText, setPromptText, isGenerating, handlePromptGeneration,
  templateName, setTemplateName, generatedContent, setGeneratedContent,
  selectedCategory, setSelectedCategory, highlightEditor, editingMetaId,
  pushingMeta, handleSaveLocalOrDeploy, editorRef,
  variableExamples = [], setVariableExamples,
  editingStructure = [], setEditingStructure
}) => {
  const [newButtonType, setNewButtonType] = useState<'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'>('QUICK_REPLY');
  const [newBtnText, setNewBtnText] = useState('');
  const [newBtnUrl, setNewBtnUrl] = useState('https://order.auragoldelite.com/pay/{{1}}');
  const [newBtnUrlExample, setNewBtnUrlExample] = useState('ORD-10023');
  const [newBtnPhone, setNewBtnPhone] = useState('+919876543210');

  // Extract detected variable placeholders from body content
  const matches = generatedContent.match(/{{([0-9]+)}}/g) || [];
  const parsedNums: number[] = matches.map(m => parseInt(m.replace(/[^0-9]/g, ''), 10)).filter(n => !isNaN(n));
  const bodyVarIndices: number[] = Array.from(new Set(parsedNums)).sort((a: number, b: number) => a - b);

  // Update a body variable example
  const handleExampleChange = (index: number, val: string) => {
    if (!setVariableExamples) return;
    const newEx = [...variableExamples];
    while (newEx.length <= index) {
      newEx.push(`sample_${newEx.length + 1}`);
    }
    newEx[index] = val;
    setVariableExamples(newEx);
  };

  // Helper to extract buttons from structure
  const buttonsComponent = editingStructure.find((c: any) => c.type === 'BUTTONS');
  const currentButtons: any[] = buttonsComponent?.buttons || [];

  // Update buttons in editingStructure
  const updateButtonsInStructure = (updatedButtons: any[]) => {
    if (!setEditingStructure) return;
    const newStruct = editingStructure.filter((c: any) => c.type !== 'BUTTONS');
    if (updatedButtons.length > 0) {
      newStruct.push({
        type: 'BUTTONS',
        buttons: updatedButtons
      });
    }
    setEditingStructure(newStruct);
  };

  const handleAddButton = () => {
    if (!newBtnText.trim()) return alert("Button label is required");
    if (currentButtons.length >= 3) return alert("Meta allows maximum 3 buttons per template");

    let buttonObj: any = { text: newBtnText.trim() };

    if (newButtonType === 'QUICK_REPLY') {
      buttonObj.type = 'QUICK_REPLY';
    } else if (newButtonType === 'URL') {
      if (!newBtnUrl.trim()) return alert("Target URL is required");
      buttonObj.type = 'URL';
      buttonObj.url = newBtnUrl.trim();
      if (newBtnUrl.includes('{{1}}')) {
        buttonObj.example = [newBtnUrlExample.trim() || 'ORD-10023'];
      }
    } else if (newButtonType === 'PHONE_NUMBER') {
      if (!newBtnPhone.trim()) return alert("Phone number is required");
      buttonObj.type = 'PHONE_NUMBER';
      buttonObj.phone_number = newBtnPhone.trim();
    }

    updateButtonsInStructure([...currentButtons, buttonObj]);
    setNewBtnText('');
  };

  const handleRemoveButton = (index: number) => {
    const updated = currentButtons.filter((_, i) => i !== index);
    updateButtonsInStructure(updated);
  };

  // Build rendered message preview with sample variable values
  const getRenderedPreview = () => {
    if (!generatedContent) return "Your message preview will appear here...";
    let rendered = generatedContent;
    bodyVarIndices.forEach((idx: number) => {
      const targetIdx: number = idx - 1;
      const exampleVal = variableExamples[targetIdx] || `sample_${idx}`;
      rendered = rendered.replace(new RegExp(`{{${idx}}}`, 'g'), `[${exampleVal}]`);
    });
    return rendered;
  };

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-12 gap-8">
      {/* Left Column: AI Architect Prompt */}
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
            <label htmlFor="promptText" className="sr-only">Prompt Text</label>
            <textarea 
              id="promptText"
              name="promptText"
              className="w-full h-32 p-3 bg-white border border-indigo-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner resize-none"
              placeholder="Describe your template needs (e.g. Setu payment link reminder with 24h urgency and Pay Now button)..."
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

        {/* Real-time WhatsApp Live Preview Card */}
        <div className="bg-slate-900 text-white p-5 rounded-3xl shadow-xl space-y-4 border border-slate-800">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Eye size={13} className="text-emerald-400" /> WhatsApp Live Preview
              </span>
            </div>
            <span className="bg-slate-800 text-amber-400 text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
              {selectedCategory}
            </span>
          </div>

          <div className="bg-emerald-950/40 p-4 rounded-2xl border border-emerald-900/50 relative font-sans">
            <div className="text-xs text-emerald-100 leading-relaxed whitespace-pre-wrap">
              {getRenderedPreview()}
            </div>
            <div className="text-[10px] text-emerald-400/70 text-right mt-2 flex items-center justify-end gap-1 font-mono">
              <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              <CheckCircle2 size={10} className="text-emerald-400" />
            </div>

            {/* Rendered Action / Quick Reply Buttons Preview */}
            {currentButtons.length > 0 && (
              <div className="mt-3 pt-3 border-t border-emerald-900/40 space-y-1.5">
                {currentButtons.map((btn, i) => (
                  <div key={i} className="bg-emerald-900/30 hover:bg-emerald-900/50 border border-emerald-700/40 text-emerald-200 text-center py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all">
                    {btn.type === 'URL' && <ExternalLink size={12} className="text-emerald-400" />}
                    {btn.type === 'PHONE_NUMBER' && <Phone size={12} className="text-emerald-400" />}
                    {btn.type === 'QUICK_REPLY' && <MessageSquare size={12} className="text-emerald-400" />}
                    <span>{btn.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="text-[11px] text-slate-400 bg-slate-800/60 p-3 rounded-xl border border-slate-800 space-y-1">
            <div className="font-bold text-slate-300 flex items-center gap-1">
              <Info size={12} className="text-indigo-400" /> Meta Approval Checklist
            </div>
            <ul className="text-[10px] space-y-1 text-slate-400">
              <li className="flex items-center gap-1">
                {templateName.toLowerCase().startsWith('auragold_') ? '✅' : '⚠️'} Name starts with <code className="text-amber-300">auragold_</code>
              </li>
              <li className="flex items-center gap-1">
                {bodyVarIndices.every((idx: number) => {
                  const targetIdx: number = idx - 1;
                  return !!variableExamples[targetIdx]?.trim();
                }) ? '✅' : '⚠️'} All {bodyVarIndices.length} body variables have sample data
              </li>
              <li className="flex items-center gap-1">
                {currentButtons.every(b => b.type !== 'URL' || !b.url.includes('{{1}}') || (b.example && b.example[0])) ? '✅' : '⚠️'} Action URL variables have sample values
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Right Column: Template Editor & Meta Inputs */}
      <div className="lg:col-span-8 space-y-6">
        <div ref={editorRef} className={`bg-white p-6 rounded-2xl border shadow-sm animate-fadeIn border-l-4 border-l-blue-500 ${highlightEditor ? 'ring-4 ring-emerald-400 ring-opacity-50 transition-all duration-500' : ''}`}>
          <div className="flex justify-between items-start mb-4">
            <div>
              <h4 className="font-bold text-slate-800 flex items-center gap-2">
                <Edit size={16} className="text-blue-500" /> Template Editor
              </h4>
              <p className="text-xs text-slate-500 mt-1">Provide template text, variable sample values, and action buttons required by Meta.</p>
            </div>
            {editingMetaId && (
              <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold border border-amber-200 flex items-center gap-1">
                <Wrench size={10}/> Editing Meta ID
              </span>
            )}
          </div>

          {/* Name & Category */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="templateName" className="text-[10px] font-bold uppercase text-slate-400">Template Name</label>
              <input 
                id="templateName"
                name="templateName"
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                className={`w-full font-mono text-sm border rounded-lg p-2 outline-none focus:border-blue-500 ${editingMetaId ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                placeholder="auragold_payment_reminder"
                readOnly={!!editingMetaId}
              />
            </div>
            <div>
              <label htmlFor="metaCategory" className="text-[10px] font-bold uppercase text-slate-400">Meta Category</label>
              <select 
                id="metaCategory"
                name="metaCategory"
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

          {/* Message Body Textarea */}
          <div className="mb-6">
            <label htmlFor="messageBody" className="text-[10px] font-bold uppercase text-slate-400 flex items-center justify-between mb-1">
              <span>Message Body</span>
              <span className="text-[10px] text-indigo-600 font-medium">Use {"{{1}}"}, {"{{2}}"} for dynamic variables</span>
            </label>
            <textarea 
              id="messageBody"
              name="messageBody"
              value={generatedContent} 
              onChange={e => setGeneratedContent(e.target.value)}
              className="w-full h-32 p-3 bg-slate-50 rounded-xl text-sm outline-none border focus:border-blue-500 font-mono"
              placeholder="Dear {{1}}, your order {{2}} is ready. Pay ₹{{3}} using the link below."
            />
          </div>

          {/* SECTION 1: Meta Required Variable Sample Data Inputs */}
          <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200/80 mb-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg">
                  <Variable size={16} />
                </div>
                <div>
                  <h5 className="font-bold text-xs text-amber-900">Meta Sample Variable Inputs</h5>
                  <p className="text-[11px] text-amber-700">Meta requires real sample values for all body variables (e.g. {"{{1}}"}, {"{{2}}"}) before approving templates.</p>
                </div>
              </div>
              <span className="bg-amber-200/80 text-amber-900 text-[10px] px-2.5 py-0.5 rounded-full font-bold">
                {bodyVarIndices.length} Detected
              </span>
            </div>

            {bodyVarIndices.length === 0 ? (
              <div className="bg-white/80 p-3 rounded-xl border border-amber-200/60 text-xs text-amber-800 flex items-center gap-2">
                <AlertCircle size={14} className="text-amber-600 shrink-0" />
                <span>No variable placeholders like <code className="bg-amber-100 px-1 rounded text-amber-900 font-bold">{"{{1}}"}</code> detected in message body. Add placeholders to enable sample variable input fields.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {bodyVarIndices.map((varIdx: number) => {
                  const targetIdx: number = varIdx - 1;
                  const currentEx = variableExamples[targetIdx] || '';
                  return (
                    <div key={varIdx} className="bg-white p-2.5 rounded-xl border border-amber-200/80 shadow-xs">
                      <label htmlFor={`var-sample-${varIdx}`} className="text-[10px] font-extrabold uppercase text-amber-800 flex items-center justify-between mb-1">
                        <span>Sample Value for {"{{"}{varIdx}{"}}"}</span>
                        <span className="text-[9px] text-amber-600 font-normal">Required by Meta</span>
                      </label>
                      <input 
                        id={`var-sample-${varIdx}`}
                        type="text"
                        value={currentEx}
                        onChange={(e) => handleExampleChange(targetIdx, e.target.value)}
                        placeholder={varIdx === 1 ? "e.g. Rahul Sharma" : varIdx === 2 ? "e.g. ₹25,000" : `e.g. Sample ${varIdx}`}
                        className="w-full text-xs border border-slate-200 rounded-lg p-2 outline-none focus:border-amber-500 font-mono bg-amber-50/20"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECTION 2: Meta Interactive Buttons & Action Variables */}
          <div className="bg-indigo-50/60 p-4 rounded-2xl border border-indigo-200/80 mb-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                  <ExternalLink size={16} />
                </div>
                <div>
                  <h5 className="font-bold text-xs text-indigo-900">Meta Buttons & Action Variables</h5>
                  <p className="text-[11px] text-indigo-700">Add interactive CTA links, Call phone buttons, or Quick Replies to your template.</p>
                </div>
              </div>
              <span className="bg-indigo-200/80 text-indigo-900 text-[10px] px-2.5 py-0.5 rounded-full font-bold">
                {currentButtons.length} / 3 Buttons
              </span>
            </div>

            {/* List of active buttons */}
            {currentButtons.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] font-extrabold uppercase text-indigo-800">Active Template Buttons</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {currentButtons.map((btn, idx) => (
                    <div key={idx} className="bg-white p-3 rounded-xl border border-indigo-200 shadow-xs flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {btn.type === 'URL' && <ExternalLink size={14} className="text-indigo-600 shrink-0" />}
                        {btn.type === 'PHONE_NUMBER' && <Phone size={14} className="text-emerald-600 shrink-0" />}
                        {btn.type === 'QUICK_REPLY' && <MessageSquare size={14} className="text-amber-600 shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">{btn.text}</p>
                          {btn.type === 'URL' && (
                            <p className="text-[10px] font-mono text-slate-500 truncate">{btn.url}</p>
                          )}
                          {btn.type === 'PHONE_NUMBER' && (
                            <p className="text-[10px] font-mono text-slate-500 truncate">{btn.phone_number}</p>
                          )}
                          {btn.type === 'QUICK_REPLY' && (
                            <p className="text-[10px] text-slate-400">Quick Reply Option</p>
                          )}
                        </div>
                      </div>
                      <button 
                        onClick={() => handleRemoveButton(idx)}
                        className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg transition-all shrink-0"
                        title="Remove Button"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add New Button Controls */}
            {currentButtons.length < 3 && (
              <div className="bg-white p-3.5 rounded-xl border border-indigo-200 space-y-3">
                <span className="text-[10px] font-extrabold uppercase text-indigo-800 block">Add New Button</span>
                <div className="grid grid-cols-3 gap-2">
                  <button 
                    onClick={() => setNewButtonType('QUICK_REPLY')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1 ${newButtonType === 'QUICK_REPLY' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                  >
                    <MessageSquare size={12} /> Quick Reply
                  </button>
                  <button 
                    onClick={() => setNewButtonType('URL')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1 ${newButtonType === 'URL' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                  >
                    <ExternalLink size={12} /> URL Link
                  </button>
                  <button 
                    onClick={() => setNewButtonType('PHONE_NUMBER')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1 ${newButtonType === 'PHONE_NUMBER' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                  >
                    <Phone size={12} /> Call Phone
                  </button>
                </div>

                <div className="space-y-2">
                  <div>
                    <label htmlFor="btnLabel" className="text-[10px] font-bold text-slate-500 uppercase">Button Label</label>
                    <input 
                      id="btnLabel"
                      type="text"
                      value={newBtnText}
                      onChange={e => setNewBtnText(e.target.value)}
                      placeholder={newButtonType === 'QUICK_REPLY' ? 'e.g. Confirm Order' : newButtonType === 'URL' ? 'e.g. Pay Securely' : 'e.g. Call Showroom'}
                      className="w-full text-xs border rounded-lg p-2 outline-none focus:border-indigo-500 font-sans"
                    />
                  </div>

                  {newButtonType === 'URL' && (
                    <div className="space-y-2">
                      <div>
                        <label htmlFor="btnUrl" className="text-[10px] font-bold text-slate-500 uppercase flex items-center justify-between">
                          <span>Target URL</span>
                          <span className="text-[9px] text-indigo-600">Supports {"{{1}}"} variable</span>
                        </label>
                        <input 
                          id="btnUrl"
                          type="text"
                          value={newBtnUrl}
                          onChange={e => setNewBtnUrl(e.target.value)}
                          placeholder="https://order.auragoldelite.com/pay/{{1}}"
                          className="w-full text-xs border rounded-lg p-2 outline-none focus:border-indigo-500 font-mono"
                        />
                      </div>
                      {newBtnUrl.includes('{{1}}') && (
                        <div>
                          <label htmlFor="btnUrlEx" className="text-[10px] font-bold text-amber-700 uppercase">Action URL Variable {"{{1}}"} Sample</label>
                          <input 
                            id="btnUrlEx"
                            type="text"
                            value={newBtnUrlExample}
                            onChange={e => setNewBtnUrlExample(e.target.value)}
                            placeholder="e.g. ORD-10023 or setu_bill_123"
                            className="w-full text-xs border border-amber-300 rounded-lg p-2 outline-none focus:border-amber-500 font-mono bg-amber-50/40"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {newButtonType === 'PHONE_NUMBER' && (
                    <div>
                      <label htmlFor="btnPhone" className="text-[10px] font-bold text-slate-500 uppercase">Phone Number</label>
                      <input 
                        id="btnPhone"
                        type="text"
                        value={newBtnPhone}
                        onChange={e => setNewBtnPhone(e.target.value)}
                        placeholder="+919876543210"
                        className="w-full text-xs border rounded-lg p-2 outline-none focus:border-indigo-500 font-mono"
                      />
                    </div>
                  )}

                  <button 
                    onClick={handleAddButton}
                    className="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold text-xs hover:bg-indigo-700 flex items-center justify-center gap-1.5 transition-all shadow-xs"
                  >
                    <Plus size={14} /> Add Button to Template
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons: Deploy / Save Local */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t">
            <button 
              onClick={() => handleSaveLocalOrDeploy('META')} 
              disabled={pushingMeta}
              className="flex-1 bg-emerald-600 text-white py-3.5 rounded-xl font-bold text-xs shadow-md hover:bg-emerald-700 flex items-center justify-center gap-2 transition-all disabled:opacity-70"
            >
              {pushingMeta ? <Loader2 className="animate-spin" /> : <UploadCloud size={16} />}
              {editingMetaId ? 'Update Meta Template' : 'Deploy to Meta'}
            </button>
            <button 
              onClick={() => handleSaveLocalOrDeploy('LOCAL')} 
              className="flex-1 bg-slate-100 text-slate-700 py-3.5 rounded-xl font-bold text-xs hover:bg-slate-200 flex items-center justify-center gap-2 transition-all"
            >
              <Save size={16} /> Save Local Draft
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
