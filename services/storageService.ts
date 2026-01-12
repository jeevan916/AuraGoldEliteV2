
import { Order, WhatsAppLogEntry, WhatsAppTemplate } from '../types';
import { errorService } from './errorService';

// Use an absolute path if hosted at root, or relative if using hash routing.
// For Hostinger "public_html/api", this should be valid.
const API_ENDPOINT = 'api/server.php';
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
      
      if (response.status === 404) {
          console.warn("[Storage] API not found (404). Backend files might be missing.");
          this.isSyncing = false;
          return;
      }
      
      if (!response.ok) throw new Error(`Server returned ${response.status} ${response.statusText}`);
      
      const text = await response.text();
      let serverData;
      
      try {
        serverData = JSON.parse(text);
      } catch (e) {
        // If PHP crashes, it often returns HTML. We log a snippet to help debug.
        console.error("[Storage] Invalid JSON from server:", text.substring(0, 150));
        // Don't throw to UI, just stay offline
        this.isSyncing = false;
        return;
      }
      
      // Merge logic: Trust server if it has data
      if (serverData && Array.isArray(serverData.orders)) {
          if (serverData.orders.length >= this.state.orders.length) {
              this.state.orders = serverData.orders;
              this.state.logs = serverData.logs || [];
              this.state.templates = serverData.templates || [];
              this.saveToLocal(); // Update local cache
              console.log("[Storage] Synced from Server");
          }
      }
    } catch (e: any) {
      console.debug(`[Storage] Pull skipped: ${e.message}`);
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

       if (response.status === 404) {
          // Backend missing, suppress error
          this.isSyncing = false;
          return;
       }

       if (!response.ok) throw new Error(`Push failed: ${response.status}`);
       
       const text = await response.text();
       try { JSON.parse(text); } catch(e) { throw new Error("Server response not JSON"); }
       
    } catch (e: any) {
        // Silent fail to avoid spamming user
    } finally {
        this.isSyncing = false;
    }
  }

  // --- ACCESSORS ---

  public getOrders() { return this.state.orders; }
  public setOrders(orders: Order[]) { 
      this.state.orders = orders; 
      this.saveToLocal();
      this.pushToServer(); // Trigger immediate push
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
