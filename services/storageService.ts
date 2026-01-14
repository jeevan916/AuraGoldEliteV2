
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
  private isSyncing = false;
  private syncStatus: 'CONNECTED' | 'OFFLINE' | 'SYNCING' | 'ERROR' = 'OFFLINE';

  constructor() {}

  public getSyncStatus() {
      return this.syncStatus;
  }

  /**
   * Fetches state from server. Must succeed for app to boot.
   */
  public async syncFromServer(): Promise<{success: boolean, error?: string}> {
    this.syncStatus = 'SYNCING';
    this.notify();
    
    try {
        const res = await fetch('/api/state', {
            headers: { 'Accept': 'application/json' }
        });
        
        if (!res.ok) {
            const errorMsg = `Server Response: ${res.status} ${res.statusText}`;
            this.syncStatus = 'ERROR';
            this.notify();
            return { success: false, error: errorMsg };
        }

        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            this.syncStatus = 'ERROR';
            this.notify();
            return { success: false, error: "The server returned a non-JSON response (likely a 404/500 HTML page). Verify your Node.js startup file." };
        }

        const serverData = await res.json();
        this.state = {
            ...DEFAULT_STATE,
            ...serverData,
            lastUpdated: serverData.lastUpdated || Date.now()
        };
        
        this.syncStatus = 'CONNECTED';
        this.notify();
        return { success: true };
    } catch (e: any) {
        this.syncStatus = 'OFFLINE';
        this.notify();
        return { success: false, error: e.message || "Network Connectivity Error" };
    }
  }

  private async syncToBackend() {
    this.syncStatus = 'SYNCING';
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
          this.syncStatus = 'ERROR';
      }
    } catch (e) {
      this.syncStatus = 'OFFLINE';
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
  
  private notify() { this.listeners.forEach(cb => cb()); }

  public async forceSync(): Promise<{ success: boolean; message: string }> {
      const res = await this.syncFromServer();
      if (res.success) {
          return { success: true, message: "Live Sync Complete." };
      } else {
          return { success: false, message: res.error || "Sync Failed." };
      }
  }
}

export const storageService = new StorageService();
