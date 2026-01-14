
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
 * Authoritative empty state. 
 * The app will not populate these until the server confirms the connection.
 */
const AUTHORITATIVE_EMPTY_STATE: AppState = {
  orders: [],
  logs: [],
  templates: [],
  planTemplates: [],
  settings: INITIAL_SETTINGS,
  lastUpdated: 0
};

class StorageService {
  private state: AppState = AUTHORITATIVE_EMPTY_STATE;
  private listeners: (() => void)[] = [];
  private syncStatus: 'CONNECTED' | 'OFFLINE' | 'SYNCING' | 'ERROR' = 'OFFLINE';

  constructor() {}

  public getSyncStatus() {
    return this.syncStatus;
  }

  /**
   * Authoritative sync from MySQL backend via Express API. 
   * This is a hard requirement for the app to function.
   */
  public async syncFromServer(): Promise<{ success: boolean; error?: string; code?: number }> {
    this.syncStatus = 'SYNCING';
    this.notify();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

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
          error: "The server returned HTML instead of JSON. This typically happens when a 404 page is served by Hostinger/Apache instead of the Node.js API." 
        };
      }

      const serverData = await res.json();
      
      // Hydrate authoritative state
      this.state = {
        ...AUTHORITATIVE_EMPTY_STATE,
        ...serverData,
        lastUpdated: serverData.lastUpdated || Date.now()
      };

      this.syncStatus = 'CONNECTED';
      this.notify();
      return { success: true };

    } catch (e: any) {
      this.syncStatus = 'OFFLINE';
      this.notify();
      const message = e.name === 'AbortError' 
        ? "Connection Timeout: The database is taking too long to respond." 
        : (e.message || "Network Gateway Failure: Cannot reach /api/state");
      return { success: false, error: message };
    }
  }

  /**
   * Persists authoritative state to live MySQL backend.
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
      return { success: true, message: "Database connection healthy. Data synchronized." };
    } else {
      return { success: false, message: res.error || "Handshake failed." };
    }
  }
}

export const storageService = new StorageService();
