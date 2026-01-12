
import { useState, useEffect } from 'react';
import { WhatsAppLogEntry, WhatsAppTemplate } from '../types';
import { INITIAL_TEMPLATES } from '../constants';
import { storageService } from '../services/storageService';

export function useWhatsApp() {
  const [logs, setLogsState] = useState<WhatsAppLogEntry[]>(storageService.getLogs());
  const [templates, setTemplatesState] = useState<WhatsAppTemplate[]>(storageService.getTemplates().length > 0 ? storageService.getTemplates() : INITIAL_TEMPLATES);

  useEffect(() => {
    const unsubscribe = storageService.subscribe(() => {
        setLogsState([...storageService.getLogs()]);
        const sTpls = storageService.getTemplates();
        if (sTpls.length > 0) setTemplatesState(sTpls);
    });
    return unsubscribe;
  }, []);

  const setLogs = (newLogs: WhatsAppLogEntry[]) => {
      setLogsState(newLogs);
      storageService.setLogs(newLogs);
  };

  const setTemplates = (newTemplates: WhatsAppTemplate[]) => {
      setTemplatesState(newTemplates);
      storageService.setTemplates(newTemplates);
  };

  const addLog = (log: WhatsAppLogEntry) => {
    const updated = [log, ...logs];
    setLogs(updated); // Update React state immediately
    // StorageService update happens in background via setLogs
    storageService.setLogs(updated);
  };

  return { logs, setLogs, templates, setTemplates, addLog };
}
