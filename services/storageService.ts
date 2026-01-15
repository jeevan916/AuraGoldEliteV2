import { Order, WhatsAppLogEntry, WhatsAppTemplate, GlobalSettings, PaymentPlanTemplate } from '../types';
import { INITIAL_SETTINGS, INITIAL_PLAN_TEMPLATES, INITIAL_TEMPLATES } from '../constants';

export interface AppState {
  orders: Order[];
  logs: WhatsAppLogEntry[];
  templates: WhatsAppTemplate[];
  planTemplates: PaymentPlanTemplate[];
  settings: GlobalSettings;
  lastUpdated: number;
}

const STORAGE_KEY = 'aura_gold_app_state';

const DEFAULT_STATE: AppState = {
  orders: [],
  logs: [],
  templates: INITIAL_TEMPLATES,
  planTemplates: INITIAL_PLAN_TEMPLATES,
  settings: INITIAL_SETTINGS,
  lastUpdated: Date.now()
};

class StorageService {
  private state: AppState = DEFAULT_STATE;
  private listeners: (() => void)[] = [];
  private syncStatus: 'CONNECTED' | 'LOCAL_FALLBACK' | 'SYNCING' | 'ERROR' = 'LOCAL_FALLBACK';

  constructor() {
    this.loadFromLocal();
  }

  private loadFromLocal() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        this.state = JSON.parse(saved);
        console.log("[Storage] Local state loaded.");
      }
    } catch (e) {
      console.warn("[Storage] Failed to load local storage", e);
    }
  }

  private saveToLocal() {
    try {
      this.state.lastUpdated = Date.now();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.error("[Storage] Failed to save to local storage", e);
    }
  }

  public getSyncStatus() {
    return this.syncStatus;
  }

  /**
   * Attempts to pull the latest state from the backend.
   */
  public async syncFromServer(): Promise<{ success: boolean; message: string }> {
    this.syncStatus = 'SYNCING';
    this.notify();

    try {
      console.log("[Storage] Syncing with /api/state...");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch('/api/state', {
        headers: { 
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Server status: ${res.status}`);
      }

      const serverData = await res.json();
      
      if (serverData && serverData.lastUpdated > (this.state.lastUpdated || 0)) {
          console.log("[Storage] Server state is newer. Syncing.");
          this.state = { ...DEFAULT_STATE, ...serverData };
          this.saveToLocal();
      }

      this.syncStatus = 'CONNECTED';
      this.notify();
      return { success: true, message: "Synced with Cloud" };

    } catch (e: any) {
      console.warn("[Storage] Sync failed, using local fallback:", e.message);
      this.syncStatus = 'LOCAL_FALLBACK';
      this.notify();
      return { success: false, message: "Local Cache Active" };
    }
  }

  /**
   * Pushes current state to the persistent backend.
   */
  private async syncToBackend() {
    this.saveToLocal();
    this.notify();

    try {
      const res = await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.state)
      });
      
      if (res.ok) {
        this.syncStatus = 'CONNECTED';
      } else {
        this.syncStatus = 'LOCAL_FALLBACK';
      }
    } catch (e) {
      console.error("[Storage] Backend push error:", e);
      this.syncStatus = 'LOCAL_FALLBACK';
    } finally {
      this.notify();
    }
  }

  public getOrders() { return this.state.orders; }
  public setOrders(orders: Order[]) { 
    this.state.orders = orders; 
    this.syncToBackend(); 
  }

  public getLogs() { return this.state.logs; }
  public setLogs(logs: WhatsAppLogEntry[]) { 
    this.state.logs = logs; 
    this.syncToBackend(); 
  }

  public getTemplates() { return this.state.templates; }
  public setTemplates(templates: WhatsAppTemplate[]) { 
    this.state.templates = templates; 
    this.syncToBackend(); 
  }

  public getPlanTemplates() { return this.state.planTemplates; }
  public setPlanTemplates(templates: PaymentPlanTemplate[]) { 
    this.state.planTemplates = templates; 
    this.syncToBackend(); 
  }

  public getSettings() { return this.state.settings; }
  public setSettings(settings: GlobalSettings) { 
    this.state.settings = settings; 
    this.syncToBackend(); 
  }

  public subscribe(cb: () => void) {
    this.listeners.push(cb);
    return () => { this.listeners = this.listeners.filter(l => l !== cb); };
  }

  private notify() { 
    this.listeners.forEach(cb => cb()); 
  }

  public async forceSync(): Promise<{ success: boolean; message: string }> {
    return this.syncFromServer();
  }
}

export const storageService = new StorageService();
