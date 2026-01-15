
import { Order, WhatsAppLogEntry, WhatsAppTemplate, GlobalSettings, PaymentPlanTemplate, CatalogItem } from '../types';
import { INITIAL_SETTINGS, INITIAL_PLAN_TEMPLATES, INITIAL_TEMPLATES, INITIAL_CATALOG } from '../constants';

export interface AppState {
  orders: Order[];
  logs: WhatsAppLogEntry[];
  templates: WhatsAppTemplate[];
  planTemplates: PaymentPlanTemplate[];
  catalog: CatalogItem[];
  settings: GlobalSettings;
  lastUpdated: number;
}

const STORAGE_KEY = 'aura_gold_app_state';

const DEFAULT_STATE: AppState = {
  orders: [],
  logs: [],
  templates: INITIAL_TEMPLATES,
  planTemplates: INITIAL_PLAN_TEMPLATES,
  catalog: INITIAL_CATALOG,
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
        const parsed = JSON.parse(saved);
        if (!parsed.catalog) parsed.catalog = INITIAL_CATALOG;
        this.state = parsed;
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

  public getSyncStatus() { return this.syncStatus; }

  // --- BOOTSTRAP: FETCH ALL FROM DB ---
  public async syncFromServer(): Promise<{ success: boolean; message: string }> {
    this.syncStatus = 'SYNCING';
    this.notify();

    try {
      const res = await fetch('/api/bootstrap');
      if (!res.ok) throw new Error("Bootstrap failed");
      
      const response = await res.json();
      if (response.success && response.data) {
          const dbData = response.data;
          
          // Merge DB data with defaults
          this.state = {
              orders: dbData.orders || [],
              customers: dbData.customers || [],
              settings: dbData.settings || INITIAL_SETTINGS,
              templates: (dbData.templates && dbData.templates.length > 0) ? dbData.templates : INITIAL_TEMPLATES,
              logs: dbData.logs || [],
              planTemplates: (dbData.planTemplates && dbData.planTemplates.length > 0) ? dbData.planTemplates : INITIAL_PLAN_TEMPLATES,
              catalog: (dbData.catalog && dbData.catalog.length > 0) ? dbData.catalog : INITIAL_CATALOG,
              lastUpdated: Date.now()
          } as any; // Type casting for ease

          this.saveToLocal();
          this.syncStatus = 'CONNECTED';
      } else {
          this.syncStatus = 'LOCAL_FALLBACK';
      }
    } catch (e) {
      console.warn("Sync failed, offline mode");
      this.syncStatus = 'LOCAL_FALLBACK';
    } finally {
      this.notify();
    }
    return { success: this.syncStatus === 'CONNECTED', message: this.syncStatus };
  }

  // --- ENTITY SYNC METHODS ---

  private async pushEntity(endpoint: string, payload: any) {
      this.saveToLocal(); // Always save local first for optimistic UI
      this.notify();
      
      try {
          const res = await fetch(`/api/sync/${endpoint}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
          });
          if (res.ok) this.syncStatus = 'CONNECTED';
          else this.syncStatus = 'ERROR';
      } catch (e) {
          this.syncStatus = 'LOCAL_FALLBACK';
      } finally {
          this.notify();
      }
  }

  public getOrders() { return this.state.orders; }
  public setOrders(orders: Order[]) { 
    this.state.orders = orders; 
    this.pushEntity('orders', { orders }); 
  }

  public getLogs() { return this.state.logs; }
  public setLogs(logs: WhatsAppLogEntry[]) { 
    this.state.logs = logs; 
    this.pushEntity('logs', { logs }); 
  }

  public getTemplates() { return this.state.templates; }
  public setTemplates(templates: WhatsAppTemplate[]) { 
    this.state.templates = templates; 
    this.pushEntity('templates', { templates }); 
  }

  public getPlanTemplates() { return this.state.planTemplates; }
  public setPlanTemplates(templates: PaymentPlanTemplate[]) { 
    this.state.planTemplates = templates; 
    this.pushEntity('plans', { plans: templates }); 
  }

  public getCatalog() { return this.state.catalog; }
  public setCatalog(catalog: CatalogItem[]) {
    this.state.catalog = catalog;
    this.pushEntity('catalog', { catalog });
  }

  public getSettings() { return this.state.settings; }
  public setSettings(settings: GlobalSettings) { 
    this.state.settings = settings; 
    this.pushEntity('settings', { settings }); 
  }

  // Customers are derived in App usually, but if we save them explicitly:
  public setCustomers(customers: any[]) {
      (this.state as any).customers = customers; // Add to state if missing from interface
      this.pushEntity('customers', { customers });
  }

  public subscribe(cb: () => void) {
    this.listeners.push(cb);
    return () => { this.listeners = this.listeners.filter(l => l !== cb); };
  }

  private notify() { 
    this.listeners.forEach(cb => cb()); 
  }

  public async forceSync() { return this.syncFromServer(); }
}

export const storageService = new StorageService();
