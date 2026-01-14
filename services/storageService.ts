
import { Order, WhatsAppLogEntry, WhatsAppTemplate, GlobalSettings, PaymentPlanTemplate } from '../types';
import { INITIAL_SETTINGS, INITIAL_PLAN_TEMPLATES } from '../constants';

// Use a strict relative path for the Hostinger Node.js proxy
const API_ENDPOINT = 'api/storage';
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
          this.state = { ...this.state, ...serverData };
          this.saveToLocal();
        }
      }
    } catch (e) {
      console.warn("[Storage] Cloud sync pull failed");
    } finally {
      this.isSyncing = false;
    }
  }

  public async pushToServer() {
    if (this.isSyncing) return;
    this.isSyncing = true;
    try {
       const payload = { ...this.state, lastUpdated: Date.now() };
       await fetch(API_ENDPOINT, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify(payload)
       });
    } catch (e) {
        console.warn("[Storage] Cloud sync push failed");
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
           if (!response.ok) return { success: false, message: `Server error: ${response.status}` };
           return { success: true, message: "AuraCloud Synchronized!" };
      } catch (e: any) {
          return { success: false, message: `Network error: ${e.message}` };
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
