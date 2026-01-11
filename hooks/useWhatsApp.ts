
import { useState, useEffect } from 'react';
import { WhatsAppLogEntry, WhatsAppTemplate } from '../types';
import { INITIAL_TEMPLATES } from '../constants';

export function useWhatsApp() {
  const [logs, setLogs] = useState<WhatsAppLogEntry[]>([]);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>(INITIAL_TEMPLATES);

  useEffect(() => {
    // Load Logs
    try {
      const savedLogs = localStorage.getItem('aura_whatsapp_logs');
      if (savedLogs) {
        const parsed = JSON.parse(savedLogs);
        if (Array.isArray(parsed)) setLogs(parsed);
      }
    } catch (e) {
      console.warn("Corrupted WhatsApp logs found. Resetting.", e);
      localStorage.removeItem('aura_whatsapp_logs');
    }
    
    // Load Templates
    try {
      const savedTpls = localStorage.getItem('aura_whatsapp_templates');
      if (savedTpls) {
        const parsed = JSON.parse(savedTpls);
        if (Array.isArray(parsed)) {
            setTemplates(parsed);
        } else {
            setTemplates(INITIAL_TEMPLATES);
        }
      }
    } catch (e) {
      console.warn("Corrupted templates found. Resetting to defaults.", e);
      localStorage.removeItem('aura_whatsapp_templates');
      setTemplates(INITIAL_TEMPLATES);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('aura_whatsapp_logs', JSON.stringify(logs));
  }, [logs]);

  useEffect(() => {
    localStorage.setItem('aura_whatsapp_templates', JSON.stringify(templates));
  }, [templates]);

  const addLog = (log: WhatsAppLogEntry) => {
    setLogs(prev => [log, ...prev]);
  };

  return { logs, setLogs, templates, setTemplates, addLog };
}
