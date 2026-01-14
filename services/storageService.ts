
import { Order, WhatsAppLogEntry, WhatsAppTemplate, GlobalSettings, PaymentPlanTemplate } from '../types';
import { INITIAL_SETTINGS, INITIAL_PLAN_TEMPLATES, INITIAL_TEMPLATES } from '../constants';

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
  private isSyncing = false;

  constructor() {
    this.state = this.loadFromLocal();
  }

  private loadFromLocal(): AppState {
    try {
      const serialized = localStorage.getItem(KEY_STATE);
      if (serialized) {
        return { ...DEFAULT_STATE, ...JSON.parse(serialized) };
      }
    } catch (e) {
      console.warn("[Storage] Local cache missing.");
    }
    return DEFAULT_STATE;
  }

  private saveToLocal() {
    this.state.lastUpdated = Date.now();
    try {
        localStorage.setItem(KEY_STATE, JSON.stringify(this.state));
        this.notify();
    } catch (e) {
        console.error("[Storage] Local cache write failed", e);
    }
  }

  /**
   * Authoritative sync from the production MySQL database via Express.
   */
  public async syncFromServer(): Promise<boolean> {
    try {
        const res = await fetch('/api/state');
        if (res.ok) {
            const serverData = await res.json();
            if (serverData) {
                this.state = serverData;
                localStorage.setItem(KEY_STATE, JSON.stringify(this.state));
                this.notify();
                return true;
            }
        }
        return false;
    } catch (e) {
        console.error("[Storage] Critical: Could not reach backend state API.");
        return false;
    }
  }

  private async syncToBackend() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const res = await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.state)
      });
      if (!res.ok) throw new Error("Server rejected state update");
    } catch (e) {
      console.error("[Storage] Error: Persistence to backend failed.", e);
    } finally {
      this.isSyncing = false;
    }
  }

  public getOrders() { return this.state.orders; }
  public setOrders(orders: Order[]) { 
      this.state.orders = orders; 
      this.saveToLocal(); 
      this.syncToBackend();
  }

  public getLogs() { return this.state.logs; }
  public setLogs(logs: WhatsAppLogEntry[]) { 
      this.state.logs = logs; 
      this.saveToLocal(); 
      this.syncToBackend();
  }

  public getTemplates() { return this.state.templates; }
  public setTemplates(templates: WhatsAppTemplate[]) { 
      this.state.templates = templates; 
      this.saveToLocal(); 
      this.syncToBackend();
  }

  public getPlanTemplates() { return this.state.planTemplates; }
  public setPlanTemplates(templates: PaymentPlanTemplate[]) { 
      this.state.planTemplates = templates; 
      this.saveToLocal(); 
      this.syncToBackend();
  }

  public getSettings() { return this.state.settings; }
  public setSettings(settings: GlobalSettings) { 
      this.state.settings = settings; 
      this.saveToLocal(); 
      this.syncToBackend();
  }
  
  public subscribe(cb: () => void) {
      this.listeners.push(cb);
      return () => { this.listeners = this.listeners.filter(l => l !== cb); };
  }
  
  private notify() { this.listeners.forEach(cb => cb()); }

  public async forceSync(): Promise<{ success: boolean; message: string }> {
      const success = await this.syncFromServer();
      if (success) {
          return { success: true, message: "Database synchronization successful." };
      } else {
          return { success: false, message: "Server connection failed. Check backend status." };
      }
  }
}

export const storageService = new StorageService();
