
import React, { useState } from 'react';
import { Send, MessageSquare, Phone, ExternalLink, AlertCircle } from 'lucide-react';
import { Card, Button, SectionHeader } from '../shared/BaseUI';
import { WhatsAppLogEntry } from '../../types';
import { whatsappService } from '../../services/whatsappService';

interface CommunicationWidgetProps {
  logs: WhatsAppLogEntry[];
  customerPhone: string;
  customerName: string;
  onLogAdded: (log: WhatsAppLogEntry) => void;
  compact?: boolean;
}

export const CommunicationWidget: React.FC<CommunicationWidgetProps> = ({ 
  logs, customerPhone, customerName, onLogAdded, compact = false 
}) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Helper: Normalize phone to last 10 digits for accurate matching
  const normalize = (p: string) => p ? p.replace(/\D/g, '').slice(-10) : '';
  const targetPhone = normalize(customerPhone);

  // Strict Filter: Only show logs that match the specific customer's 10-digit mobile
  const customerLogs = logs.filter(l => {
    if (!targetPhone) return false; // Safety: Never show logs if target is undefined
    return normalize(l.phoneNumber) === targetPhone;
  }).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const handleSend = async () => {
    if (!message.trim()) return;
    if (!targetPhone) {
        alert("Cannot send: No valid phone number linked to this customer.");
        return;
    }
    
    setSending(true);
    try {
      const res = await whatsappService.sendMessage(customerPhone, message, customerName);
      if (res.success && res.logEntry) {
        onLogAdded(res.logEntry);
        setMessage('');
      } else {
        alert(`Failed to send: ${res.error || 'Unknown Error'}`);
      }
    } catch (e: any) {
        alert(`Error: ${e.message}`);
    } finally {
      setSending(false);
    }
  };

  const openWhatsApp = () => {
    if (!targetPhone) return;
    window.open(`https://wa.me/${targetPhone}`, '_blank');
  };

  if (!targetPhone) {
      return (
        <div className="flex flex-col h-full min-h-[200px] items-center justify-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-400 p-6">
            <AlertCircle size={32} className="mb-2 opacity-50" />
            <p className="text-xs font-black uppercase tracking-widest text-center">No Contact Number</p>
            <p className="text-[10px] text-center mt-1">Add a valid phone number to the customer profile to enable chat.</p>
        </div>
      );
  }

  if (compact) {
    return (
      <Card className="p-4 flex items-center justify-between bg-emerald-50 border-emerald-100">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-200 text-emerald-800 rounded-lg"><MessageSquare size={16}/></div>
          <div>
            <p className="text-[10px] font-black uppercase text-emerald-700">Quick Chat</p>
            <p className="text-xs font-bold text-emerald-900 truncate max-w-[150px]">
              {customerLogs[0]?.message || "Start conversation"}
            </p>
          </div>
        </div>
        <Button size="sm" variant="primary" onClick={openWhatsApp} className="bg-emerald-600">
          Open
        </Button>
      </Card>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-[400px]">
      <SectionHeader 
        title="Secure Comm. Log" 
        subtitle={`${customerLogs.length} messages on record`}
        action={
          <button onClick={openWhatsApp} className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 hover:underline">
            Open WhatsApp App <ExternalLink size={10} />
          </button>
        } 
      />

      <Card className="flex-1 flex flex-col overflow-hidden bg-slate-50 border-slate-200">
        <div className="flex-1 overflow-y-auto p-4 space-y-3 flex flex-col-reverse custom-scrollbar">
          {customerLogs.map((log) => (
            <div key={log.id} className={`flex ${log.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-3 rounded-2xl text-xs font-medium leading-relaxed shadow-sm ${
                log.direction === 'outbound' 
                  ? 'bg-white border border-slate-200 text-slate-700 rounded-tr-none' 
                  : 'bg-emerald-100 text-emerald-900 rounded-tl-none border border-emerald-200'
              }`}>
                {log.message}
                <div className="mt-1 text-[8px] opacity-50 font-black uppercase text-right">
                  {new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • {log.status}
                </div>
              </div>
            </div>
          ))}
          {customerLogs.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
              <MessageSquare size={32} className="opacity-20"/>
              <p className="text-xs italic font-medium">No history found. Send a message to start.</p>
            </div>
          )}
        </div>

        <div className="p-3 bg-white border-t border-slate-100 flex gap-2">
          <input 
            className="flex-1 bg-slate-50 border-none rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-slate-200 transition-all"
            placeholder="Type message..."
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
          />
          <Button size="sm" onClick={handleSend} loading={sending} disabled={!message}>
            <Send size={14} />
          </Button>
        </div>
      </Card>
    </div>
  );
};
