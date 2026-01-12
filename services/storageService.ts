
import { Order, WhatsAppLogEntry, WhatsAppTemplate } from '../types';
import { errorService } from './errorService';

const API_ENDPOINT = './api/server.php';
const SYNC_INTERVAL = 10000; // 10 seconds

export interface AppState {
  orders: Order[];
  logs: WhatsAppLogEntry[];
  templates: WhatsAppTemplate[];
  lastUpdated: number;
}

class StorageService {
  private state: AppState = {
    orders: [],
    logs: [],
    templates: [],
    lastUpdated: 0
  };

  private isSyncing = false;
  private listeners: (() => void)[] = [];

  constructor() {
    this.loadFromLocal();
    // Auto-sync on load
    this.pullFromServer();
    
    // Periodic sync
    setInterval(() => {
        this.pushToServer();
    }, SYNC_INTERVAL);
  }

  // --- LOCAL STORAGE ---

  private loadFromLocal() {
    try {
      const orders = localStorage.getItem('aura_orders');
      const logs = localStorage.getItem('aura_whatsapp_logs');
      const templates = localStorage.getItem('aura_whatsapp_templates');
      
      this.state.orders = orders ? JSON.parse(orders) : [];
      this.state.logs = logs ? JSON.parse(logs) : [];
      this.state.templates = templates ? JSON.parse(templates) : [];
    } catch (e) {
      console.warn("Local storage parse error", e);
    }
  }

  public saveToLocal() {
    localStorage.setItem('aura_orders', JSON.stringify(this.state.orders));
    localStorage.setItem('aura_whatsapp_logs', JSON.stringify(this.state.logs));
    localStorage.setItem('aura_whatsapp_templates', JSON.stringify(this.state.templates));
    this.notify();
  }

  // --- SERVER SYNC ---

  public async pullFromServer() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const response = await fetch(API_ENDPOINT);
      if (!response.ok) throw new Error("Server offline");
      
      const serverData = await response.json();
      
      // Simple conflict resolution: Server wins if it has data and local is empty, 
      // or if server timestamp is newer. For now, we merge carefully.
      if (serverData && Array.isArray(serverData.orders)) {
          // If server has more data than local, trust server
          if (serverData.orders.length >= this.state.orders.length) {
              this.state.orders = serverData.orders;
              this.state.logs = serverData.logs || [];
              this.state.templates = serverData.templates || [];
              this.saveToLocal(); // Update local cache
              console.log("[Storage] Synced from Hostinger Server");
          }
      }
    } catch (e) {
      // Silent fail - offline mode
    } finally {
      this.isSyncing = false;
    }
  }

  public async pushToServer() {
    if (this.isSyncing) return;
    
    // Only push if we have data
    if (this.state.orders.length === 0) return;

    this.isSyncing = true;
    try {
       const payload = {
           orders: this.state.orders,
           logs: this.state.logs,
           templates: this.state.templates,
           lastUpdated: Date.now()
       };

       const response = await fetch(API_ENDPOINT, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify(payload)
       });

       if (!response.ok) throw new Error("Sync failed");
       
    } catch (e: any) {
        errorService.logWarning('Database', `Sync to Hostinger failed: ${e.message}`);
    } finally {
        this.isSyncing = false;
    }
  }

  // --- ACCESSORS ---

  public getOrders() { return this.state.orders; }
  public setOrders(orders: Order[]) { 
      this.state.orders = orders; 
      this.saveToLocal();
      this.pushToServer(); // Trigger immediate push on critical change
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

  public subscribe(cb: () => void) {
      this.listeners.push(cb);
      return () => { this.listeners = this.listeners.filter(l => l !== cb); };
  }

  private notify() {
      this.listeners.forEach(cb => cb());
  }
}

export const storageService = new StorageService();
