
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

/**
 * Empty authoritative state. 
 * The app will not populate these until the server confirms the connection.
 */
const EMPTY_STATE: AppState = {
  orders: [],
  logs: [],
  templates: [],
  planTemplates: [],
  settings: INITIAL_SETTINGS,
  lastUpdated: 0
};

class StorageService {
  private state: AppState = EMPTY_STATE;
  private listeners: (() => void)[] = [];
  private syncStatus: 'CONNECTED' | 'OFFLINE' | 'SYNCING' | 'ERROR' = 'OFFLINE';

  constructor() {}

  public getSyncStatus() {
    return this.syncStatus;
  }

  /**
   * Authoritative sync from MySQL backend. 
   * If this fails, the app must halt.
   */
  public async syncFromServer(): Promise<{ success: boolean; error?: string; code?: number }> {
    this.syncStatus = 'SYNCING';
    this.notify();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

      const res = await fetch('/api/state', {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        this.syncStatus = 'ERROR';
        this.notify();
        return { 
          success: false, 
          error: `HTTP Error ${res.status}: ${res.statusText}`,
          code: res.status
        };
      }

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        this.syncStatus = 'ERROR';
        this.notify();
        return { 
          success: false, 
          error: "The gateway returned an invalid response (HTML). This usually means the Node.js process is stopped or a 404/500 page was served." 
        };
      }

      const serverData = await res.json();
      
      // Successfully hydrated from live DB
      this.state = {
        ...EMPTY_STATE,
        ...serverData,
        lastUpdated: serverData.lastUpdated || Date.now()
      };

      this.syncStatus = 'CONNECTED';
      this.notify();
      return { success: true };

    } catch (e: any) {
      this.syncStatus = 'OFFLINE';
      this.notify();
      const message = e.name === 'AbortError' ? "Connection Timeout (Database Unresponsive)" : (e.message || "Network Gateway Failure");
      return { success: false, error: message };
    }
  }

  /**
   * Persists state to MySQL backend.
   */
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

  // --- Authoritative Getters/Setters ---
  
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
    const res = await this.syncFromServer();
    if (res.success) {
      return { success: true, message: "Database link active. State synchronized." };
    } else {
      return { success: false, message: res.error || "Sync failed." };
    }
  }
}

export const storageService = new StorageService();
