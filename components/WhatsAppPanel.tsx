
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  MessageSquare, Check, CheckCircle2, Clock, AlertCircle, 
  Search, Send, MoreVertical, Phone, User, Paperclip, X,
  FileText, Smartphone, Plus, RefreshCw, Zap, ArrowDownLeft, Lock, Sparkles, BrainCircuit
} from 'lucide-react';
import { WhatsAppLogEntry, MessageStatus, WhatsAppTemplate, Customer, AiChatInsight } from '../types';
import { INITIAL_TEMPLATES } from '../constants';
import { whatsappService } from '../services/whatsappService';
import { geminiService } from '../services/geminiService';

interface WhatsAppPanelProps {
  logs: WhatsAppLogEntry[];
  customers?: Customer[]; // New prop to pick customers
  onRefreshStatus: () => void;
  templates?: WhatsAppTemplate[];
  onAddLog?: (log: WhatsAppLogEntry) => void; 
  // FIX: Added initialContact prop to allow deep linking from waLogs or other views
  initialContact?: string | null;
}

// Simple helper type for an active chat session that might not have logs yet
interface ActiveSession {
    phone: string;
    name: string;
}

const WhatsAppPanel: React.FC<WhatsAppPanelProps> = ({ 
  logs, 
  customers = [], 
  onRefreshStatus, 
  templates = INITIAL_TEMPLATES, 
  onAddLog,
  initialContact = null
}) => {
  // FIX: Initialize selectedContact with the passed initialContact prop
  const [selectedContact, setSelectedContact] = useState<string | null>(initialContact);
  const [inputText, setInputText] = useState('');
  const [search, setSearch] = useState('');
  
  // New Chat State
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState('');
  const [newChatName, setNewChatName] = useState('');
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);

  // Template Modal State
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplate | null>(null);
  const [templateParams, setTemplateParams] = useState<string[]>([]);
  const [paramPlaceholders, setParamPlaceholders] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [simulatingInbound, setSimulatingInbound] = useState(false);
  
  // AI Smart Assist State
  const [aiInsight, setAiInsight] = useState<AiChatInsight | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // FIX: Sync selectedContact if the initialContact prop changes after mounting
  useEffect(() => {
    if (initialContact !== null && initialContact !== undefined) {
      setSelectedContact(initialContact);
    }
  }, [initialContact]);

  // Group logs by Phone Number to create "Conversations"
  const conversations = useMemo(() => {
      // 1. Group existing logs
      const grouped: Record<string, WhatsAppLogEntry[]> = {};
      logs.forEach(log => {
          const key = log.phoneNumber;
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(log);
      });
      
      // 2. Create conversation objects from logs
      const logConvos = Object.entries(grouped).map(([phone, msgs]) => ({
          phone,
          name: msgs[0].customerName, // Assume name is consistent for phone
          lastMessage: msgs.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0],
          messages: msgs.sort((a,b) => new Date(a.timestamp).getTime() - new Date(a.timestamp).getTime()),
          timestamp: msgs.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0].timestamp
      }));

      // 3. Merge "Active Sessions" (chats started but no logs yet)
      activeSessions.forEach(session => {
          if (!grouped[session.phone]) {
              logConvos.push({
                  phone: session.phone,
                  name: session.name,
                  lastMessage: { message: "Drafting...", timestamp: new Date().toISOString(), status: 'QUEUED', id: 'temp', customerName: session.name, phoneNumber: session.phone, type: 'CUSTOM', direction: 'outbound' as const }, // Dummy last message
                  messages: [],
                  timestamp: new Date().toISOString()
              });
          }
      });
      
      // Sort all by latest timestamp
      return logConvos.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [logs, activeSessions]);

  // Filter conversations
  const filteredConversations = conversations.filter(c => 
      c.name.toLowerCase().includes(search.toLowerCase()) || 
      c.phone.includes(search)
  );

  const activeConversation = selectedContact ? conversations.find(c => c.phone === selectedContact) : null;
  const isNewConversation = activeConversation ? activeConversation.messages.length === 0 : false;

  useEffect(() => {
    // Scroll to bottom of chat when messages change
    if (chatEndRef.current) {
        chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeConversation?.messages, selectedContact]);
  
  // --- AI Analysis Logic ---
  // Trigger analysis when the active conversation changes OR a new inbound message arrives
  useEffect(() => {
    const runAnalysis = async () => {
        if (!activeConversation) {
            setAiInsight(null);
            return;
        }

        const lastMsg = activeConversation.messages[activeConversation.messages.length - 1];
        
        // Only analyze if the last message is INBOUND (from customer)
        if (lastMsg && lastMsg.direction === 'inbound') {
            setIsAnalyzing(true);
            const insight = await geminiService.analyzeChatContext(
                activeConversation.messages, 
                templates, 
                activeConversation.name
            );
            setAiInsight(insight);
            setIsAnalyzing(false);
        } else {
            setAiInsight(null); // Reset if I just replied
        }
    };

    runAnalysis();
  }, [activeConversation?.messages, activeConversation?.name, templates]);

  // --- Logic for Templates (Copied/Adapted from previous implementation) ---
  useEffect(() => {
    if (selectedTemplate) {
      const newPlaceholders: string[] = [];
      const matches = selectedTemplate.content.match(/{{(.*?)}}/g);
      if (matches) {
        matches.forEach(m => newPlaceholders.push(m.replace(/{{|}}/g, '')));
      }
      // Button params
      if (selectedTemplate.structure) {
         const btnComp = selectedTemplate.structure.find((c: any) => c.type === 'BUTTONS');
         if (btnComp && btnComp.buttons) {
             btnComp.buttons.forEach((btn: any) => {
                 if (btn.type === 'URL' && btn.url && btn.url.includes('{{1}}')) {
                     newPlaceholders.push('button_url_param');
                 }
             });
         }
      }

      if (newPlaceholders.length > 0) {
        setParamPlaceholders(newPlaceholders);
        setTemplateParams(new Array(newPlaceholders.length).fill(''));
        
        // Auto-fill customer name
        if (activeConversation) {
            const newParams = new Array(newPlaceholders.length).fill('');
            newPlaceholders.forEach((m, idx) => {
                if (m.toLowerCase().includes('name')) {
                    newParams[idx] = activeConversation.name;
                }
            });
            setTemplateParams(newParams);
        }
      } else {
        setParamPlaceholders([]);
        setTemplateParams([]);
      }
    }
  }, [selectedTemplate, activeConversation]);

  const handleStartNewChat = () => {
    if(!newChatPhone) return;
    const formatted = whatsappService.formatPhoneNumber(newChatPhone);
    
    // Check if already exists in activeSessions
    const exists = activeSessions.find(s => s.phone === formatted);
    if (!exists) {
        setActiveSessions(prev => [...prev, { phone: formatted, name: newChatName || 'Unknown Customer' }]);
    }
    
    setSelectedContact(formatted);
    setShowNewChatModal(false);
    setNewChatName('');
    setNewChatPhone('');

    // Force open template modal for new chats as per policy
    setTimeout(() => setShowTemplateModal(true), 100);
  };

  const handleSendMessage = async () => {
      if (!inputText.trim() || !activeConversation) return;
      
      const msg = inputText;
      setInputText('');
      setAiInsight(null); // Clear insight once we reply
      
      // Fix: Expected 3 arguments, but got 4. Removed 'Manual Chat'.
      const result = await whatsappService.sendMessage(activeConversation.phone, msg, activeConversation.name);
      
      if (result.success && result.logEntry && onAddLog) {
          onAddLog(result.logEntry);
          // Simulate reply for demo
          const reply = await whatsappService.simulateIncomingReply(activeConversation.phone, activeConversation.name);
          onAddLog(reply);
      }
  };

  const handleSimulateIncoming = async () => {
      if (!activeConversation || !onAddLog) return;
      setSimulatingInbound(true);
      const reply = await whatsappService.simulateIncomingReply(activeConversation.phone, activeConversation.name);
      onAddLog(reply);
      setSimulatingInbound(false);
  };

  const handleSendTemplate = async () => {
      if (!selectedTemplate || !activeConversation) return;
      
      setIsSending(true);
      // Fix: Expected 5 arguments, but got 6. Removed selectedTemplate.structure.
      const result = await whatsappService.sendTemplateMessage(
          activeConversation.phone,
          selectedTemplate.name,
          'en_US',
          templateParams,
          activeConversation.name
      );

      if (result.success && result.logEntry && onAddLog) {
          onAddLog(result.logEntry);
          setShowTemplateModal(false);
          setSelectedTemplate(null);
          setAiInsight(null); // Clear insight
           // Simulate reply for demo
          const reply = await whatsappService.simulateIncomingReply(activeConversation.phone, activeConversation.name);
          onAddLog(reply);
      } else {
          alert(`Failed: ${result.error}`);
      }
      setIsSending(false);
  };
  
  const applyAiSuggestion = () => {
      if (aiInsight?.suggestedReply) {
          setInputText(aiInsight.suggestedReply);
      }
  };

  const applyAiTemplate = () => {
      if (aiInsight?.recommendedTemplateId) {
          const tpl = templates.find(t => t.id === aiInsight.recommendedTemplateId);
          if (tpl) {
              setSelectedTemplate(tpl);
              setShowTemplateModal(true);
          }
      }
  };

  const StatusIcon = ({ status }: { status: MessageStatus }) => {
    switch (status) {
      case 'READ': return <div className="flex"><CheckCircle2 size={12} className="text-blue-500" /><CheckCircle2 size={12} className="text-blue-500 -ml-1.5" /></div>;
      case 'DELIVERED': return <div className="flex"><CheckCircle2 size={12} className="text-slate-400" /><CheckCircle2 size={12} className="text-slate-400 -ml-1.5" /></div>;
      case 'SENT': return <Check size={12} className="text-slate-400" />;
      default: return <Clock size={12} className="text-slate-300" />;
    }
  };

  return (
    <div className="flex h-[calc(100vh-140px)] bg-white rounded-3xl border shadow-xl overflow-hidden animate-fadeIn relative">
      
      {/* Sidebar: Conversations */}
      <div className="w-full md:w-80 bg-slate-50 border-r flex flex-col">
        <div className="p-4 border-b bg-white">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                    <Smartphone className="text-emerald-500" /> WhatsApp
                </h2>
                <button 
                    onClick={() => setShowNewChatModal(true)}
                    className="p-2 bg-slate-900 text-white rounded-lg hover:bg-emerald-600 transition-colors"
                    title="New Chat"
                >
                    <Plus size={18} />
                </button>
            </div>
            <div className="relative">
                <Search className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
                <input 
                    type="text" 
                    placeholder="Search chats..." 
                    className="w-full pl-9 pr-4 py-2 bg-slate-100 border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>
        </div>

        <div className="flex-1 overflow-y-auto">
            {filteredConversations.map(c => (
                <div 
                    key={c.phone} 
                    onClick={() => setSelectedContact(c.phone)}
                    className={`p-4 cursor-pointer hover:bg-slate-100 transition-colors border-b border-slate-100 ${selectedContact === c.phone ? 'bg-amber-50 border-l-4 border-l-amber-500' : ''}`}
                >
                    <div className="flex justify-between items-start mb-1">
                        <h3 className="font-bold text-slate-800 text-sm">{c.name}</h3>
                        <span className="text-[10px] text-slate-400">
                             {c.messages.length > 0 ? new Date(c.lastMessage.timestamp).toLocaleDateString() : 'New'}
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <p className="text-xs text-slate-500 truncate w-40 italic">
                            {c.messages.length > 0 ? c.lastMessage.message : 'Drafting new conversation...'}
                        </p>
                        {c.messages.length > 0 && c.lastMessage.direction === 'outbound' && <StatusIcon status={c.lastMessage.status} />}
                    </div>
                </div>
            ))}
            {filteredConversations.length === 0 && (
                <div className="p-8 text-center text-slate-400">
                    <MessageSquare className="mx-auto mb-2 opacity-20" size={32} />
                    <p className="text-xs">No active conversations</p>
                    <button 
                        onClick={() => setShowNewChatModal(true)}
                        className="mt-4 text-emerald-600 text-xs font-bold hover:underline"
                    >
                        Start a new chat
                    </button>
                </div>
            )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-[#e5ddd5] relative">
         {/* Background Pattern Overlay */}
         <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

         {activeConversation ? (
            <>
                {/* Chat Header */}
                <div className="bg-white p-4 border-b flex justify-between items-center z-10 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center text-slate-500">
                            <User size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800">{activeConversation.name}</h3>
                            <p className="text-xs text-slate-500">{activeConversation.phone}</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={handleSimulateIncoming} 
                            disabled={simulatingInbound}
                            title="Simulate Incoming Reply (Debug)" 
                            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full border border-transparent hover:border-emerald-100 transition-all"
                        >
                            <ArrowDownLeft size={20} className={simulatingInbound ? 'animate-bounce' : ''} />
                        </button>
                        <button onClick={onRefreshStatus} title="Refresh Status" className="p-2 text-slate-400 hover:bg-slate-50 rounded-full">
                            <RefreshCw size={20} />
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 z-10">
                    {activeConversation.messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                             <div className="bg-white/50 p-6 rounded-full mb-4">
                                <Send size={32} className="opacity-30" />
                             </div>
                             <p className="text-sm font-bold text-slate-600">Start Conversation</p>
                             <p className="text-xs max-w-xs text-center mt-2 mb-6">
                                To initiate a chat with a customer who hasn't messaged you recently, you must send a template.
                             </p>
                             <button 
                                onClick={() => setShowTemplateModal(true)}
                                className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg hover:bg-emerald-700 transition-all flex items-center gap-2"
                             >
                                <FileText size={16} /> Select Template
                             </button>
                        </div>
                    ) : (
                        activeConversation.messages.map(msg => (
                            <div key={msg.id} className={`flex ${msg.direction === 'inbound' ? 'justify-start' : 'justify-end'}`}>
                                <div className={`max-w-[70%] rounded-xl p-3 shadow-sm relative ${
                                    msg.direction === 'inbound' 
                                    ? 'bg-white rounded-tl-none' 
                                    : (msg.type === 'TEMPLATE' ? 'bg-amber-50 border border-amber-200 rounded-tr-none' : 'bg-[#d9fdd3] rounded-tr-none')
                                }`}>
                                    {msg.type === 'TEMPLATE' && <p className="text-[10px] font-bold text-amber-600 uppercase mb-1 flex items-center gap-1"><FileText size={10} /> Template</p>}
                                    <p className="text-sm text-slate-800 whitespace-pre-wrap">{msg.message}</p>
                                    <div className="flex items-center justify-end gap-1 mt-1">
                                        <span className="text-[10px] text-slate-400">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                        {msg.direction === 'outbound' && <StatusIcon status={msg.status} />}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                    <div ref={chatEndRef} />
                </div>
                
                {/* AI Smart Assist Panel */}
                {(isAnalyzing || aiInsight) && (
                    <div className="bg-gradient-to-r from-amber-50 to-white border-t border-amber-100 p-3 z-10 animate-slideUp">
                        {isAnalyzing ? (
                            <div className="flex items-center gap-2 text-xs font-bold text-amber-600">
                                <BrainCircuit size={14} className="animate-spin" />
                                AI Reading customer intent...
                            </div>
                        ) : aiInsight ? (
                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                        <Sparkles size={14} className="text-amber-500 fill-amber-500" />
                                        <span className="text-xs font-black uppercase text-amber-700">Smart Assist</span>
                                        <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded-full font-bold">{aiInsight.intent}</span>
                                        <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded-full font-bold">{aiInsight.tone} Tone</span>
                                    </div>
                                    <button onClick={() => setAiInsight(null)} className="text-slate-300 hover:text-slate-500"><X size={14}/></button>
                                </div>
                                <div className="flex gap-2">
                                    <div 
                                        onClick={applyAiSuggestion}
                                        className="flex-1 bg-white border border-amber-200 p-2 rounded-lg cursor-pointer hover:bg-amber-50 transition-colors"
                                    >
                                        <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Suggested Reply</p>
                                        <p className="text-xs text-slate-800 line-clamp-1 italic">"{aiInsight.suggestedReply}"</p>
                                    </div>
                                    {aiInsight.recommendedTemplateId && (
                                        <div 
                                            onClick={applyAiTemplate}
                                            className="flex-1 bg-white border border-emerald-200 p-2 rounded-lg cursor-pointer hover:bg-emerald-50 transition-colors"
                                        >
                                            <p className="text-[10px] text-emerald-600 uppercase font-bold mb-1 flex items-center gap-1"><FileText size={10} /> Recommended Template</p>
                                            <p className="text-xs text-slate-800 line-clamp-1">{templates.find(t => t.id === aiInsight.recommendedTemplateId)?.name || 'Unknown Template'}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : null}
                    </div>
                )}

                {/* Input Area */}
                <div className="bg-white p-3 border-t z-10 relative">
                    {/* Lock Overlay for New Conversations */}
                    {isNewConversation && (
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-20 flex items-center justify-center">
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 bg-white px-3 py-1 rounded-full shadow-sm border">
                                <Lock size={12} /> Free text disabled until conversation starts
                            </div>
                        </div>
                    )}
                    
                    <div className="flex items-center gap-2">
                         <button 
                            onClick={() => setShowTemplateModal(true)}
                            className="p-3 text-slate-500 hover:bg-slate-100 rounded-full transition-colors relative z-30"
                            title="Send Template"
                        >
                            <Paperclip size={20} />
                         </button>
                         <input 
                            type="text" 
                            className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500"
                            placeholder={isNewConversation ? "Send a template to start conversation..." : "Type a message..."}
                            value={inputText}
                            onChange={e => setInputText(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && !isNewConversation && handleSendMessage()}
                            disabled={isNewConversation}
                         />
                         <button 
                            onClick={handleSendMessage}
                            disabled={!inputText.trim() || isNewConversation}
                            className="p-3 bg-emerald-600 text-white rounded-full hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-lg"
                        >
                            <Send size={18} />
                         </button>
                    </div>
                </div>
            </>
         ) : (
             <div className="flex-1 flex flex-col items-center justify-center text-slate-400 z-10">
                 <div className="w-24 h-24 bg-slate-200/50 rounded-full flex items-center justify-center mb-4">
                     <Smartphone size={40} className="opacity-50" />
                 </div>
                 <h3 className="text-lg font-bold text-slate-500">WhatsApp for Web</h3>
                 <p className="text-sm max-w-xs text-center mt-2">Select a chat from the sidebar to start messaging your customers.</p>
                 <button 
                    onClick={() => setShowNewChatModal(true)}
                    className="mt-6 bg-slate-900 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg hover:bg-slate-800 transition-all flex items-center gap-2"
                >
                    <Plus size={16} /> Start New Conversation
                </button>
             </div>
         )}

         {/* Template Modal Overlay */}
         {showTemplateModal && (
             <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                 <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90%] animate-fadeIn">
                     <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                         <h3 className="font-bold text-slate-800">Select Template</h3>
                         <button onClick={() => setShowTemplateModal(false)} className="text-slate-400 hover:text-rose-500"><X size={20} /></button>
                     </div>
                     
                     <div className="p-4 flex-1 overflow-y-auto space-y-4">
                        {!selectedTemplate ? (
                            <div className="space-y-2">
                                {templates.map(t => (
                                    <div 
                                        key={t.id} 
                                        onClick={() => setSelectedTemplate(t)}
                                        className="p-3 border rounded-xl hover:bg-amber-50 hover:border-amber-300 cursor-pointer transition-all"
                                    >
                                        <p className="font-bold text-sm text-slate-800">{t.name}</p>
                                        <p className="text-xs text-slate-500 truncate">{t.content}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <button onClick={() => setSelectedTemplate(null)} className="text-xs text-amber-600 font-bold mb-2 hover:underline">&larr; Back to list</button>
                                <div className="bg-slate-50 p-3 rounded-xl text-sm italic border text-slate-600">
                                    "{selectedTemplate.content}"
                                </div>
                                {paramPlaceholders.length > 0 ? (
                                    <div className="space-y-3">
                                        <p className="text-xs font-black uppercase text-slate-400">Fill Variables</p>
                                        {paramPlaceholders.map((ph, idx) => (
                                            <div key={idx}>
                                                <label className="text-[10px] font-bold text-emerald-600 uppercase block mb-1">{ph}</label>
                                                <input 
                                                    type="text" 
                                                    className="w-full border rounded-lg p-2 text-sm"
                                                    value={templateParams[idx] || ''}
                                                    onChange={e => {
                                                        const newP = [...templateParams];
                                                        newP[idx] = e.target.value;
                                                        setTemplateParams(newP);
                                                    }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                ) : <p className="text-xs text-slate-400">No variables to fill.</p>}
                            </div>
                        )}
                     </div>

                     <div className="p-4 border-t bg-slate-50">
                         <button 
                            onClick={handleSendTemplate}
                            disabled={!selectedTemplate || isSending}
                            className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-emerald-700 disabled:opacity-50"
                        >
                            {isSending ? 'Sending...' : 'Send Template'}
                         </button>
                     </div>
                 </div>
             </div>
         )}

         {/* New Chat Modal */}
         {showNewChatModal && (
             <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                 <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-fadeIn">
                     <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                         <h3 className="font-bold text-slate-800">Start New Chat</h3>
                         <button onClick={() => setShowNewChatModal(false)} className="text-slate-400 hover:text-rose-500"><X size={20} /></button>
                     </div>
                     <div className="p-6 space-y-4">
                         {/* Existing Customer Selector */}
                         {customers.length > 0 && (
                             <div>
                                <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Pick Existing Customer</label>
                                <select 
                                    className="w-full border rounded-xl p-3 text-sm font-medium outline-none focus:border-emerald-500"
                                    onChange={(e) => {
                                        if (e.target.value) {
                                            const cust = customers.find(c => c.id === e.target.value);
                                            if (cust) {
                                                setNewChatName(cust.name);
                                                setNewChatPhone(cust.contact);
                                            }
                                        }
                                    }}
                                >
                                    <option value="">-- Select Customer --</option>
                                    {customers.map(c => (
                                        <option key={c.id} value={c.id}>{c.name} ({c.contact})</option>
                                    ))}
                                </select>
                             </div>
                         )}

                         <div className="relative flex py-1 items-center">
                            <div className="flex-grow border-t border-slate-200"></div>
                            <span className="flex-shrink-0 mx-4 text-[10px] font-bold text-slate-400 uppercase">Or Enter Manually</span>
                            <div className="flex-grow border-t border-slate-200"></div>
                        </div>

                         <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Phone Number</label>
                            <input 
                                type="text" 
                                placeholder="919876543210" 
                                className="w-full border rounded-xl p-3 text-sm font-medium outline-none focus:border-emerald-500"
                                value={newChatPhone}
                                onChange={e => setNewChatPhone(e.target.value)}
                            />
                         </div>
                         <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Contact Name</label>
                            <input 
                                type="text" 
                                placeholder="John Doe" 
                                className="w-full border rounded-xl p-3 text-sm font-medium outline-none focus:border-emerald-500"
                                value={newChatName}
                                onChange={e => setNewChatName(e.target.value)}
                            />
                         </div>
                         <button 
                            onClick={handleStartNewChat}
                            disabled={!newChatPhone}
                            className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold text-sm shadow-lg hover:bg-emerald-700 disabled:opacity-50 mt-4"
                        >
                            Start Conversation
                         </button>
                     </div>
                 </div>
             </div>
         )}

      </div>
    </div>
  );
};

export default WhatsAppPanel;
