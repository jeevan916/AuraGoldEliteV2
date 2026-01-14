
import { Order, WhatsAppLogEntry, WhatsAppTemplate, GlobalSettings, PaymentPlanTemplate } from '../types';
import { INITIAL_SETTINGS, INITIAL_PLAN_TEMPLATES } from '../constants';

// Architecture Compliance:
// If VITE_API_BASE_URL is set, use it.
// Otherwise, if DEV mode, use localhost:3000.
const API_BASE = (import.meta as any).env.VITE_API_BASE_URL || ((import.meta as any).env.DEV ? 'http://localhost:3000' : '');

// Points to Node.js server endpoints (defined in server.js)
const API_ENDPOINT = `${API_BASE}/api/storage`;
const HEALTH_ENDPOINT = `${API_BASE}/api/health`;

const SYNC_INTERVAL = 30000; 

export interface AppState {
  orders: Order[];
  logs: WhatsAppLogEntry[];
  templates: WhatsAppTemplate[];
  planTemplates: PaymentPlanTemplate[];
  settings: GlobalSettings;
  lastUpdated: number;
}

class StorageService {
  private state: AppState = {
    orders: [],
    logs: [],
    templates: [],
    planTemplates: INITIAL_PLAN_TEMPLATES,
    settings: INITIAL_SETTINGS,
    lastUpdated: 0
  };

  private isSyncing = false;
  private listeners: (() => void)[] = [];

  constructor() {
    this.loadFromLocal();
    this.pullFromServer();
    setInterval(() => this.pushToServer(), SYNC_INTERVAL);
  }

  private loadFromLocal() {
    try {
      const data = localStorage.getItem('aura_master_state');
      if (data) {
        const parsed = JSON.parse(data);
        this.state = {
          ...this.state,
          ...parsed,
          settings: parsed.settings ? { ...INITIAL_SETTINGS, ...parsed.settings } : INITIAL_SETTINGS
        };
      }
    } catch (e) {
      console.warn("[Storage] Cache load failed");
    }
  }

  private saveToLocal() {
    localStorage.setItem('aura_master_state', JSON.stringify(this.state));
    this.notify();
  }

  public async pullFromServer() {
    if (this.isSyncing) return;
    this.isSyncing = true;
    try {
      const response = await fetch(API_ENDPOINT);
      if (response.ok) {
        const serverData = await response.json();
        if (serverData && serverData.lastUpdated > this.state.lastUpdated) {
          console.log("[Storage] Pulled newer state from server");
          this.state = { ...this.state, ...serverData };
          this.saveToLocal();
        }
      } else {
        // Silent fail on pull is okay, we rely on local
      }
    } catch (e) {
      // Offline or server down, ignore
    } finally {
      this.isSyncing = false;
    }
  }

  public async pushToServer() {
    if (this.isSyncing) return;
    this.isSyncing = true;
    try {
       const payload = { ...this.state, lastUpdated: Date.now() };
       const response = await fetch(API_ENDPOINT, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify(payload)
       });
       if (!response.ok) {
           console.warn("[Storage] Background push failed");
       }
    } catch (e) {
        // Offline
    } finally {
        this.isSyncing = false;
    }
  }

  public async forceSync(): Promise<{ success: boolean; message: string }> {
      try {
           const payload = { ...this.state, lastUpdated: Date.now() };
           const response = await fetch(API_ENDPOINT, {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify(payload)
           });
           if (!response.ok) {
               return { success: false, message: `Server Check Failed: ${response.status}` };
           }
           return { success: true, message: "Synchronized with Node.js Backend!" };
      } catch (e: any) {
          return { success: false, message: `Connection Failed: Is server.js running?` };
      }
  }

  public async checkHealth(): Promise<{ status: string; mode: 'mysql' | 'local_fs' | 'offline'; timestamp?: string }> {
    try {
        const response = await fetch(HEALTH_ENDPOINT);
        if (response.ok) {
            return await response.json();
        }
        return { status: 'error', mode: 'offline' };
    } catch (e) {
        return { status: 'error', mode: 'offline' };
    }
  }

  public getOrders() { return this.state.orders; }
  public setOrders(orders: Order[]) { this.state.orders = orders; this.saveToLocal(); }
  public getLogs() { return this.state.logs; }
  public setLogs(logs: WhatsAppLogEntry[]) { this.state.logs = logs; this.saveToLocal(); }
  public getTemplates() { return this.state.templates; }
  public setTemplates(templates: WhatsAppTemplate[]) { this.state.templates = templates; this.saveToLocal(); }
  public getPlanTemplates() { return this.state.planTemplates; }
  public setPlanTemplates(planTemplates: PaymentPlanTemplate[]) { this.state.planTemplates = planTemplates; this.saveToLocal(); }
  public getSettings() { return this.state.settings; }
  public setSettings(settings: GlobalSettings) { this.state.settings = settings; this.saveToLocal(); }
  
  public subscribe(cb: () => void) {
      this.listeners.push(cb);
      return () => { this.listeners = this.listeners.filter(l => l !== cb); };
  }
  
  private notify() { this.listeners.forEach(cb => cb()); }
}

export const storageService = new StorageService();
