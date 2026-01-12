
import { Order, WhatsAppLogEntry, WhatsAppTemplate, GlobalSettings } from '../types';
import { INITIAL_SETTINGS } from '../constants';

const API_ENDPOINT = '/api/storage';
const SYNC_INTERVAL = 30000; // Sync every 30 seconds

export interface AppState {
  orders: Order[];
  logs: WhatsAppLogEntry[];
  templates: WhatsAppTemplate[];
  settings: GlobalSettings;
  lastUpdated: number;
}

class StorageService {
  private state: AppState = {
    orders: [],
    logs: [],
    templates: [],
    settings: INITIAL_SETTINGS,
    lastUpdated: 0
  };

  private isSyncing = false;
  private listeners: (() => void)[] = [];

  constructor() {
    this.loadFromLocal();
    this.pullFromServer();
    
    setInterval(() => {
        this.pushToServer();
    }, SYNC_INTERVAL);
  }

  private loadFromLocal() {
    try {
      const orders = localStorage.getItem('aura_orders');
      const logs = localStorage.getItem('aura_whatsapp_logs');
      const templates = localStorage.getItem('aura_whatsapp_templates');
      const settings = localStorage.getItem('aura_settings');
      
      this.state.orders = orders ? JSON.parse(orders) : [];
      this.state.logs = logs ? JSON.parse(logs) : [];
      this.state.templates = templates ? JSON.parse(templates) : [];
      this.state.settings = settings ? JSON.parse(settings) : INITIAL_SETTINGS;
    } catch (e) {
      console.warn("AuraGold: Local storage parse error", e);
    }
  }

  public saveToLocal() {
    localStorage.setItem('aura_orders', JSON.stringify(this.state.orders));
    localStorage.setItem('aura_whatsapp_logs', JSON.stringify(this.state.logs));
    localStorage.setItem('aura_whatsapp_templates', JSON.stringify(this.state.templates));
    localStorage.setItem('aura_settings', JSON.stringify(this.state.settings));
    this.notify();
  }

  public async pullFromServer() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const response = await fetch(API_ENDPOINT);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const serverData = await response.json();
      
      if (serverData && (serverData.lastUpdated > this.state.lastUpdated || !this.state.lastUpdated)) {
          this.state.orders = serverData.orders || [];
          this.state.logs = serverData.logs || [];
          this.state.templates = serverData.templates || [];
          this.state.settings = serverData.settings || this.state.settings;
          this.state.lastUpdated = serverData.lastUpdated || Date.now();
          this.saveToLocal(); 
          console.log("AuraGold: Pulled latest state from server.");
      }
    } catch (e: any) {
      console.warn("AuraGold: Pull failed", e.message);
    } finally {
      this.isSyncing = false;
    }
  }

  public async pushToServer() {
    if (this.isSyncing) return;
    
    this.isSyncing = true;
    try {
       const payload = {
           ...this.state,
           lastUpdated: Date.now()
       };

       const response = await fetch(API_ENDPOINT, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify(payload)
       });

       if (!response.ok) throw new Error(`Push failed: ${response.status}`);
       console.log("AuraGold: State synced to MySQL.");
    } catch (e: any) {
        console.warn("AuraGold: Push failed", e.message);
    } finally {
        this.isSyncing = false;
    }
  }

  public async forceSync(): Promise<{ success: boolean; message: string }> {
      try {
           const payload = {
               ...this.state,
               lastUpdated: Date.now()
           };

           const response = await fetch(API_ENDPOINT, {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify(payload)
           });

           if (response.ok) {
               return { success: true, message: "AuraGold: Express Backend Connected & Synced!" };
           } else {
               return { success: false, message: `Server Error: ${response.status}` };
           }
      } catch (e: any) {
          return { success: false, message: `Network Error: ${e.message}` };
      }
  }

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
  public getSettings() { return this.state.settings; }
  public setSettings(settings: GlobalSettings) {
      this.state.settings = settings;
      this.saveToLocal();
  }
  public subscribe(cb: () => void) {
      this.listeners.push(cb);
      return () => { this.listeners = this.listeners.filter(l => l !== cb); };
  }
  private notify() {
      this.listeners.forEach(cb => cb());
  }
}

export const storageService = new StorageService();
