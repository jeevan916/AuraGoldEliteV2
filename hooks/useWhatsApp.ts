
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
    setLogsState(currentLogs => {
        const existingIndex = currentLogs.findIndex(l => l.id === log.id);
        let updated;
        if (existingIndex > -1) {
            updated = [...currentLogs];
            updated[existingIndex] = log;
        } else {
            updated = [log, ...currentLogs];
        }
        storageService.setLogs(updated);
        return updated;
    });
  };

  return { logs, setLogs, templates, setTemplates, addLog };
}
