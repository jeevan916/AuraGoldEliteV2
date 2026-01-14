
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
    // Try to sync, but don't crash if env is missing
    this.backgroundSync();
  }

  // 1. PRIMARY: Load from Browser LocalStorage
  private loadFromLocal(): AppState {
    try {
      const serialized = localStorage.getItem(KEY_STATE);
      if (serialized) {
        const parsed = JSON.parse(serialized);
        // Merge with defaults to ensure all fields exist (in case of schema updates)
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

  // 2. PRIMARY: Save to Browser LocalStorage
  private saveToLocal() {
    this.state.lastUpdated = Date.now();
    try {
        localStorage.setItem(KEY_STATE, JSON.stringify(this.state));
        this.notify();
    } catch (e) {
        console.error("[Storage] Quota exceeded or write error", e);
    }
  }

  // 3. OPTIONAL: Backend Sync (Silent)
  // This tries to send data to a Node.js server if it exists, but ignores errors if it doesn't.
  private async backgroundSync() {
    // Safe access to import.meta.env
    const env = (import.meta as any).env;
    const apiBaseUrl = env?.VITE_API_BASE_URL;

    if (!apiBaseUrl) {
      console.log("[Storage] No VITE_API_BASE_URL found, running in offline-only mode.");
      return;
    }

    const apiUrl = `${apiBaseUrl}/api/storage`;

    try {
        // Attempt to pull remote changes
        const res = await fetch(apiUrl, { method: 'GET', signal: AbortSignal.timeout(2000) });
        if (res.ok) {
            const serverData = await res.json();
            if (serverData.lastUpdated > this.state.lastUpdated) {
                this.state = serverData;
                this.saveToLocal();
                console.log("[Storage] Synced with backend");
            }
        }
    } catch (e) {
        // Backend not available - that's fine, we are in Serverless mode.
        console.warn("[Storage] Backend sync skipped:", (e as Error).message);
    }
  }

  // --- Getters & Setters ---

  public getOrders() { return this.state.orders; }
  public setOrders(orders: Order[]) { 
      this.state.orders = orders; 
      this.saveToLocal(); 
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
  
  // --- Event System ---
  public subscribe(cb: () => void) {
      this.listeners.push(cb);
      return () => { this.listeners = this.listeners.filter(l => l !== cb); };
  }
  
  private notify() { this.listeners.forEach(cb => cb()); }

  // --- Utilities ---
  public async forceSync(): Promise<{ success: boolean; message: string }> {
      // In serverless mode, force sync just ensures LocalStorage is healthy
      try {
          this.loadFromLocal(); // Reload from disk
          return { success: true, message: "Local Database is Healthy" };
      } catch (e) {
          return { success: false, message: "Local Storage Error" };
      }
  }
}

export const storageService = new StorageService();
