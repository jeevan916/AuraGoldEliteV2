
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  MessageSquare, Check, CheckCircle2, Clock, AlertCircle, 
  Search, Send, Smartphone, User, Paperclip, X,
  FileText, Plus, RefreshCw, Zap, Lock, Sparkles, BrainCircuit
} from 'lucide-react';
import { WhatsAppLogEntry, MessageStatus, WhatsAppTemplate, Customer, AiChatInsight } from '../types';
import { INITIAL_TEMPLATES } from '../constants';
import { whatsappService } from '../services/whatsappService';
import { geminiService } from '../services/geminiService';

interface WhatsAppPanelProps {
  logs: WhatsAppLogEntry[];
  customers?: Customer[];
  onRefreshStatus: () => void;
  templates?: WhatsAppTemplate[];
  onAddLog?: (log: WhatsAppLogEntry) => void; 
  initialContact?: string | null;
}

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
  const [selectedContact, setSelectedContact] = useState<string | null>(initialContact);
  const [inputText, setInputText] = useState('');
  const [search, setSearch] = useState('');
  
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState('');
  const [newChatName, setNewChatName] = useState('');
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);

  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplate | null>(null);
  const [templateParams, setTemplateParams] = useState<string[]>([]);
  const [paramPlaceholders, setParamPlaceholders] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  
  const [aiInsight, setAiInsight] = useState<AiChatInsight | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialContact) setSelectedContact(initialContact);
  }, [initialContact]);

  const conversations = useMemo(() => {
      const grouped: Record<string, WhatsAppLogEntry[]> = {};
      logs.forEach(log => {
          const key = log.phoneNumber;
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(log);
      });
      
      const logConvos = Object.entries(grouped).map(([phone, msgs]) => ({
          phone,
          name: msgs[0].customerName,
          lastMessage: msgs.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0],
          messages: msgs.sort((a,b) => new Date(a.timestamp).getTime() - new Date(a.timestamp).getTime()),
          timestamp: msgs.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0].timestamp
      }));

      activeSessions.forEach(session => {
          if (!grouped[session.phone]) {
              logConvos.push({
                  phone: session.phone,
                  name: session.name,
                  lastMessage: { message: "Starting...", timestamp: new Date().toISOString(), status: 'QUEUED', id: 'temp', customerName: session.name, phoneNumber: session.phone, type: 'CUSTOM', direction: 'outbound' as const },
                  messages: [],
                  timestamp: new Date().toISOString()
              });
          }
      });
      
      return logConvos.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [logs, activeSessions]);

  const filteredConversations = conversations.filter(c => 
      c.name.toLowerCase().includes(search.toLowerCase()) || 
      c.phone.includes(search)
  );

  const activeConversation = selectedContact ? conversations.find(c => c.phone === selectedContact) : null;
  const isNewConversation = activeConversation ? activeConversation.messages.length === 0 : false;

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages, selectedContact]);
  
  useEffect(() => {
    const runAnalysis = async () => {
        if (!activeConversation) {
            setAiInsight(null);
            return;
        }
        const lastMsg = activeConversation.messages[activeConversation.messages.length - 1];
        if (lastMsg && lastMsg.direction === 'inbound') {
            setIsAnalyzing(true);
            try {
                const insight = await geminiService.analyzeChatContext(activeConversation.messages, templates, activeConversation.name);
                setAiInsight(insight);
            } catch (e) {}
            setIsAnalyzing(false);
        } else {
            setAiInsight(null);
        }
    };
    runAnalysis();
  }, [activeConversation?.messages, activeConversation?.name, templates]);

  useEffect(() => {
    if (selectedTemplate) {
      const matches = selectedTemplate.content.match(/{{(.*?)}}/g);
      const newPlaceholders = matches ? matches.map(m => m.replace(/{{|}}/g, '')) : [];
      setParamPlaceholders(newPlaceholders);
      const newParams = new Array(newPlaceholders.length).fill('');
      newPlaceholders.forEach((m, idx) => {
          if (m.toLowerCase().includes('name') && activeConversation) newParams[idx] = activeConversation.name;
      });
      setTemplateParams(newParams);
    }
  }, [selectedTemplate, activeConversation]);

  const handleStartNewChat = () => {
    if(!newChatPhone) return;
    const formatted = whatsappService.formatPhoneNumber(newChatPhone);
    const exists = activeSessions.find(s => s.phone === formatted);
    if (!exists) setActiveSessions(prev => [...prev, { phone: formatted, name: newChatName || 'Customer' }]);
    setSelectedContact(formatted);
    setShowNewChatModal(false);
    setTimeout(() => setShowTemplateModal(true), 100);
  };

  const handleSendMessage = async () => {
      if (!inputText.trim() || !activeConversation) return;
      const msg = inputText;
      setInputText('');
      setAiInsight(null);
      const result = await whatsappService.sendMessage(activeConversation.phone, msg, activeConversation.name);
      if (result.success && result.logEntry && onAddLog) onAddLog(result.logEntry);
  };

  const handleSendTemplate = async () => {
      if (!selectedTemplate || !activeConversation) return;
      setIsSending(true);
      const result = await whatsappService.sendTemplateMessage(activeConversation.phone, selectedTemplate.name, 'en_US', templateParams, activeConversation.name);
      if (result.success && result.logEntry && onAddLog) {
          onAddLog(result.logEntry);
          setShowTemplateModal(false);
          setSelectedTemplate(null);
      } else {
          alert(`Error: ${result.error}`);
      }
      setIsSending(false);
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
      <div className="w-full md:w-80 bg-slate-50 border-r flex flex-col">
        <div className="p-4 border-b bg-white">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                    <Smartphone className="text-emerald-500" /> Secure Chat
                </h2>
                <button onClick={() => setShowNewChatModal(true)} className="p-2 bg-slate-900 text-white rounded-lg hover:bg-emerald-600 transition-colors">
                    <Plus size={18} />
                </button>
            </div>
            <div className="relative">
                <Search className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
                <input 
                    type="text" placeholder="Search chats..." 
                    className="w-full pl-9 pr-4 py-2 bg-slate-100 border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={search} onChange={e => setSearch(e.target.value)}
                />
            </div>
        </div>
        <div className="flex-1 overflow-y-auto">
            {filteredConversations.map(c => (
                <div 
                    key={c.phone} onClick={() => setSelectedContact(c.phone)}
                    className={`p-4 cursor-pointer hover:bg-slate-100 transition-colors border-b border-slate-100 ${selectedContact === c.phone ? 'bg-amber-50 border-l-4 border-l-amber-500' : ''}`}
                >
                    <div className="flex justify-between items-start mb-1">
                        <h3 className="font-bold text-slate-800 text-sm truncate">{c.name}</h3>
                        <span className="text-[10px] text-slate-400">{c.messages.length > 0 ? new Date(c.lastMessage.timestamp).toLocaleDateString() : 'New'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <p className="text-xs text-slate-500 truncate w-40">{c.messages.length > 0 ? c.lastMessage.message : 'No messages yet'}</p>
                        {c.messages.length > 0 && c.lastMessage.direction === 'outbound' && <StatusIcon status={c.lastMessage.status} />}
                    </div>
                </div>
            ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-[#f0f2f5] relative">
         {activeConversation ? (
            <>
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
                    <button onClick={onRefreshStatus} className="p-2 text-slate-400 hover:bg-slate-50 rounded-full">
                        <RefreshCw size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 z-10">
                    {activeConversation.messages.map(msg => (
                        <div key={msg.id} className={`flex ${msg.direction === 'inbound' ? 'justify-start' : 'justify-end'}`}>
                            <div className={`max-w-[75%] rounded-xl p-3 shadow-sm relative ${msg.direction === 'inbound' ? 'bg-white' : 'bg-[#d9fdd3]'}`}>
                                <p className="text-sm text-slate-800 whitespace-pre-wrap">{msg.message}</p>
                                <div className="flex items-center justify-end gap-1 mt-1">
                                    <span className="text-[10px] text-slate-400">{new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                    {msg.direction === 'outbound' && <StatusIcon status={msg.status} />}
                                </div>
                            </div>
                        </div>
                    ))}
                    <div ref={chatEndRef} />
                </div>
                
                {aiInsight && (
                    <div className="bg-amber-50 border-t border-amber-100 p-3 z-10">
                        <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2">
                                <Sparkles size={14} className="text-amber-500" />
                                <span className="text-xs font-black uppercase text-amber-700">AI Assistant</span>
                            </div>
                            <button onClick={() => setAiInsight(null)} className="text-slate-300 hover:text-slate-500"><X size={14}/></button>
                        </div>
                        <div className="flex gap-2">
                            <div onClick={() => setInputText(aiInsight.suggestedReply)} className="flex-1 bg-white border border-amber-200 p-2 rounded-lg cursor-pointer hover:bg-amber-50">
                                <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Reply Draft</p>
                                <p className="text-xs text-slate-800 line-clamp-1 italic">"{aiInsight.suggestedReply}"</p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="bg-white p-3 border-t z-10 relative">
                    {isNewConversation && (
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-20 flex items-center justify-center">
                            <span className="text-xs font-bold text-slate-500 bg-white px-3 py-1 rounded-full border">
                                <Lock size={12} className="inline mr-1" /> Meta policy requires a template to start.
                            </span>
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                         <button onClick={() => setShowTemplateModal(true)} className="p-3 text-slate-500 hover:bg-slate-100 rounded-full relative z-30">
                            <Paperclip size={20} />
                         </button>
                         <input 
                            type="text" className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500"
                            placeholder={isNewConversation ? "Select template..." : "Type message..."}
                            value={inputText} onChange={e => setInputText(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && !isNewConversation && handleSendMessage()}
                            disabled={isNewConversation}
                         />
                         <button onClick={handleSendMessage} disabled={!inputText.trim() || isNewConversation} className="p-3 bg-emerald-600 text-white rounded-full hover:bg-emerald-700 disabled:opacity-50 shadow-lg">
                            <Send size={18} />
                         </button>
                    </div>
                </div>
            </>
         ) : (
             <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                 <MessageSquare size={48} className="opacity-20 mb-4" />
                 <h3 className="text-lg font-bold">Select a Customer</h3>
                 <p className="text-sm mt-2">Start a real conversation from the sidebar.</p>
             </div>
         )}
      </div>

      {showTemplateModal && (
          <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-fadeIn">
                  <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                      <h3 className="font-bold text-slate-800">WhatsApp Templates</h3>
                      <button onClick={() => setShowTemplateModal(false)} className="text-slate-400 hover:text-rose-500"><X size={20} /></button>
                  </div>
                  <div className="p-4 flex-1 overflow-y-auto space-y-4 max-h-[60vh]">
                    {!selectedTemplate ? (
                        <div className="space-y-2">
                            {templates.map(t => (
                                <div key={t.id} onClick={() => setSelectedTemplate(t)} className="p-3 border rounded-xl hover:bg-emerald-50 hover:border-emerald-300 cursor-pointer">
                                    <p className="font-bold text-sm text-slate-800">{t.name}</p>
                                    <p className="text-xs text-slate-500 truncate">{t.content}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <button onClick={() => setSelectedTemplate(null)} className="text-xs text-emerald-600 font-bold mb-2">&larr; Change Template</button>
                            <div className="bg-slate-50 p-3 rounded-xl text-sm italic border text-slate-600">"{selectedTemplate.content}"</div>
                            {paramPlaceholders.map((ph, idx) => (
                                <div key={idx}>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">{ph}</label>
                                    <input 
                                        type="text" className="w-full border rounded-lg p-2 text-sm"
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
                    )}
                  </div>
                  <div className="p-4 border-t">
                      <button 
                        onClick={handleSendTemplate} disabled={!selectedTemplate || isSending}
                        className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {isSending ? 'Sending...' : 'Send Template'}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {showNewChatModal && (
          <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-fadeIn">
                  <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                      <h3 className="font-bold text-slate-800">New Chat</h3>
                      <button onClick={() => setShowNewChatModal(false)} className="text-slate-400"><X size={20} /></button>
                  </div>
                  <div className="p-6 space-y-4">
                      {customers.length > 0 && (
                          <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Select Registered Client</label>
                            <select 
                                className="w-full border rounded-xl p-3 text-sm font-medium outline-none"
                                onChange={(e) => {
                                    const cust = customers.find(c => c.id === e.target.value);
                                    if (cust) { setNewChatName(cust.name); setNewChatPhone(cust.contact); }
                                }}
                            >
                                <option value="">-- Choose Customer --</option>
                                {customers.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                          </div>
                      )}
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Manual Phone Number</label>
                        <input 
                            type="text" placeholder="919876543210" 
                            className="w-full border rounded-xl p-3 text-sm font-medium outline-none"
                            value={newChatPhone} onChange={e => setNewChatPhone(e.target.value)}
                        />
                      </div>
                      <button 
                        onClick={handleStartNewChat} disabled={!newChatPhone}
                        className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold text-sm shadow-lg mt-4"
                      >
                        Start Messaging
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default WhatsAppPanel;
