
import { Order, WhatsAppLogEntry, WhatsAppTemplate, GlobalSettings, PaymentPlanTemplate, CatalogItem, Customer } from '../types';
import { INITIAL_SETTINGS, INITIAL_PLAN_TEMPLATES, INITIAL_TEMPLATES, INITIAL_CATALOG } from '../constants';

export interface AppState {
  orders: Order[];
  logs: WhatsAppLogEntry[];
  templates: WhatsAppTemplate[];
  planTemplates: PaymentPlanTemplate[];
  catalog: CatalogItem[];
  settings: GlobalSettings;
  customers: Customer[];
  lastUpdated: number;
}

const STORAGE_KEY = 'aura_gold_app_state';

const DEFAULT_STATE: AppState = {
  orders: [],
  logs: [],
  templates: INITIAL_TEMPLATES,
  planTemplates: INITIAL_PLAN_TEMPLATES,
  catalog: INITIAL_CATALOG,
  settings: {
      ...INITIAL_SETTINGS,
      purityFactor22K: 0.916,
      purityFactor18K: 0.75
  },
  customers: [],
  lastUpdated: Date.now()
};

class StorageService {
  private state: AppState = DEFAULT_STATE;
  private listeners: (() => void)[] = [];
  private syncStatus: 'CONNECTED' | 'LOCAL_FALLBACK' | 'SYNCING' | 'ERROR' = 'LOCAL_FALLBACK';
  private pollInterval: any = null;
  private syncQueue: { endpoint: string, payload: any }[] = [];

  constructor() {
    this.loadFromLocal();
    this.startPolling();
    this.processQueue();
  }

  private loadFromLocal() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.state = { ...DEFAULT_STATE, ...parsed };
      }
    } catch (e) {
      console.warn("Local storage error", e);
    }
  }

  private saveToLocal() {
    try {
      this.state.lastUpdated = Date.now();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.error("Save local error", e);
    }
  }

  private startPolling() {
      if (this.pollInterval) clearInterval(this.pollInterval);
      this.pollInterval = setInterval(() => {
          this.pollLogs();
      }, 5000);
  }

  private async processQueue() {
      setInterval(async () => {
          if (this.syncQueue.length === 0) return;
          const item = this.syncQueue[0];
          try {
              const res = await fetch(`/api/sync/${item.endpoint}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(item.payload)
              });
              if (res.ok) {
                  this.syncQueue.shift(); // Remove on success
              }
          } catch (e) {}
      }, 3000);
  }

  private async pollLogs() {
      try {
          const res = await fetch('/api/whatsapp/logs/poll');
          if (res.ok) {
              const data = await res.json();
              if (data.success && data.logs) {
                  const existingIds = new Set(this.state.logs.map(l => l.id));
                  const newEntries = data.logs.filter((l: any) => !existingIds.has(l.id));
                  if (newEntries.length > 0) {
                      this.state.logs = [...newEntries, ...this.state.logs].slice(0, 1000);
                      this.notify();
                  }
              }
          }
      } catch (e) {}
  }

  public async syncFromServer(): Promise<{ success: boolean; message: string }> {
    this.syncStatus = 'SYNCING';
    this.notify();

    try {
      const res = await fetch('/api/bootstrap');
      if (!res.ok) throw new Error("Bootstrap failed");
      const response = await res.json();
      if (response.success && response.data) {
          this.state = { ...this.state, ...response.data };
          this.saveToLocal();
          this.syncStatus = 'CONNECTED';
      }
    } catch (e) {
      this.syncStatus = 'LOCAL_FALLBACK';
    } finally {
      this.notify();
    }
    return { success: this.syncStatus === 'CONNECTED', message: this.syncStatus };
  }

  private async pushEntity(endpoint: string, payload: any) {
      this.saveToLocal();
      this.notify();
      this.syncQueue.push({ endpoint, payload });
  }

  public getOrders() { return this.state.orders; }
  public setOrders(orders: Order[]) { this.state.orders = orders; this.pushEntity('orders', { orders }); }
  public getLogs() { return this.state.logs; }
  public setLogs(logs: WhatsAppLogEntry[]) { this.state.logs = logs; this.pushEntity('logs', { logs }); }
  public getSettings() { return this.state.settings; }
  public setSettings(settings: GlobalSettings) { this.state.settings = settings; this.pushEntity('settings', { settings }); }
  public getCustomers() { return this.state.customers || []; }
  public setCustomers(customers: Customer[]) { this.state.customers = customers; this.pushEntity('customers', { customers }); }
  public getPlanTemplates() { return this.state.planTemplates; }
  public setPlanTemplates(tpls: PaymentPlanTemplate[]) { this.state.planTemplates = tpls; }
  public getTemplates() { return this.state.templates; }
  public setTemplates(templates: WhatsAppTemplate[]) { this.state.templates = templates; this.pushEntity('templates', { templates }); }
  public getCatalog() { return this.state.catalog; }
  public setCatalog(catalog: CatalogItem[]) { this.state.catalog = catalog; }
  public subscribe(cb: () => void) { this.listeners.push(cb); return () => { this.listeners = this.listeners.filter(l => l !== cb); }; }
  private notify() { this.listeners.forEach(cb => cb()); }
  public async forceSync() { return this.syncFromServer(); }
}

export const storageService = new StorageService();
