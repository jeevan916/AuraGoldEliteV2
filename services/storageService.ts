
import { Order, WhatsAppLogEntry, WhatsAppTemplate, GlobalSettings, PaymentPlanTemplate } from '../types';
import { INITIAL_SETTINGS, INITIAL_PLAN_TEMPLATES, INITIAL_TEMPLATES } from '../constants';

// STORAGE KEYS
const KEY_STATE = 'aura_master_state';

export interface AppState {
  orders: Order[];
  logs: WhatsAppLogEntry[];
  templates: WhatsAppTemplate[];
  planTemplates: PaymentPlanTemplate[];
  settings: GlobalSettings;
  lastUpdated: number;
}

const DEFAULT_STATE: AppState = {
  orders: [],
  logs: [],
  templates: INITIAL_TEMPLATES,
  planTemplates: INITIAL_PLAN_TEMPLATES,
  settings: INITIAL_SETTINGS,
  lastUpdated: Date.now()
};

class StorageService {
  private state: AppState;
  private listeners: (() => void)[] = [];

  constructor() {
    this.state = this.loadFromLocal();
    this.backgroundSync();
  }

  private loadFromLocal(): AppState {
    try {
      const serialized = localStorage.getItem(KEY_STATE);
      if (serialized) {
        const parsed = JSON.parse(serialized);
        return {
          ...DEFAULT_STATE,
          ...parsed,
          settings: { ...DEFAULT_STATE.settings, ...parsed.settings }
        };
      }
    } catch (e) {
      console.warn("[Storage] Failed to load local data, using defaults.", e);
    }
    return DEFAULT_STATE;
  }

  private saveToLocal() {
    this.state.lastUpdated = Date.now();
    try {
        localStorage.setItem(KEY_STATE, JSON.stringify(this.state));
        this.notify();
    } catch (e) {
        console.error("[Storage] Write error", e);
    }
  }

  private async backgroundSync() {
    // Safe access to environment variables in Vite
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

    if (!apiBaseUrl) {
      console.warn("[Storage] VITE_API_BASE_URL not defined. Running in Offline/Local-Only mode.");
      return;
    }

    const apiUrl = `${apiBaseUrl}/api/storage.php`;

    try {
        const res = await fetch(apiUrl, { 
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        
        if (res.ok) {
            const serverData = await res.json();
            if (serverData && serverData.lastUpdated > this.state.lastUpdated) {
                this.state = serverData;
                this.saveToLocal();
                console.log("[Storage] Synced with backend");
            }
        }
    } catch (e) {
        console.warn("[Storage] Backend sync skipped: Offline or Server Unreachable.");
    }
  }

  public getOrders() { return this.state.orders; }
  public setOrders(orders: Order[]) { 
      this.state.orders = orders; 
      this.saveToLocal(); 
      this.syncToBackend();
  }

  private async syncToBackend() {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
    if (!apiBaseUrl) return;

    try {
      await fetch(`${apiBaseUrl}/api/storage.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.state)
      });
    } catch (e) {
      console.error("[Storage] Failed to sync to backend", e);
    }
  }

  public getLogs() { return this.state.logs; }
  public setLogs(logs: WhatsAppLogEntry[]) { 
      this.state.logs = logs; 
      this.saveToLocal(); 
  }

  public getTemplates() { return this.state.templates; }
  public setTemplates(templates: WhatsAppTemplate[]) { 
      this.state.templates = templates; 
      this.saveToLocal(); 
  }

  public getPlanTemplates() { return this.state.planTemplates; }
  public setPlanTemplates(templates: PaymentPlanTemplate[]) { 
      this.state.planTemplates = templates; 
      this.saveToLocal(); 
  }

  public getSettings() { return this.state.settings; }
  public setSettings(settings: GlobalSettings) { 
      this.state.settings = settings; 
      this.saveToLocal(); 
  }
  
  public subscribe(cb: () => void) {
      this.listeners.push(cb);
      return () => { this.listeners = this.listeners.filter(l => l !== cb); };
  }
  
  private notify() { this.listeners.forEach(cb => cb()); }

  public async forceSync(): Promise<{ success: boolean; message: string }> {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
      if (!apiBaseUrl) return { success: false, message: "No Backend Configured" };

      try {
          await this.backgroundSync();
          return { success: true, message: "Storage Sync Successful" };
      } catch (e) {
          return { success: false, message: "Sync Failed" };
      }
  }
}

export const storageService = new StorageService();
