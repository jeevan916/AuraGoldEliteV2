
import { Order, WhatsAppLogEntry, WhatsAppTemplate, GlobalSettings } from '../types';
import { INITIAL_SETTINGS } from '../constants';
import { errorService } from './errorService';

// Updated endpoint: Removed the dot (.) from .builds as servers block hidden folders
const API_ENDPOINT = 'builds/api/server.php';
const SYNC_INTERVAL = 10000; // 10 seconds

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
  private backendAvailable = true; // Assume true initially

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
      const settings = localStorage.getItem('aura_settings');
      
      this.state.orders = orders ? JSON.parse(orders) : [];
      this.state.logs = logs ? JSON.parse(logs) : [];
      this.state.templates = templates ? JSON.parse(templates) : [];
      this.state.settings = settings ? JSON.parse(settings) : INITIAL_SETTINGS;
    } catch (e) {
      console.warn("Local storage parse error", e);
    }
  }

  public saveToLocal() {
    localStorage.setItem('aura_orders', JSON.stringify(this.state.orders));
    localStorage.setItem('aura_whatsapp_logs', JSON.stringify(this.state.logs));
    localStorage.setItem('aura_whatsapp_templates', JSON.stringify(this.state.templates));
    localStorage.setItem('aura_settings', JSON.stringify(this.state.settings));
    this.notify();
  }

  // --- SERVER SYNC ---

  public async pullFromServer() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const response = await fetch(API_ENDPOINT, {
        headers: { 'Accept': 'application/json' }
      });
      
      if (response.status === 404) {
          if (this.backendAvailable) {
             console.warn(`[Storage] API not found (404) at ${API_ENDPOINT}. Check if folder is renamed to 'builds' (no dot).`);
             this.backendAvailable = false;
          }
          this.isSyncing = false;
          return;
      }
      
      if (!response.ok) throw new Error(`Server returned ${response.status} ${response.statusText}`);
      
      const text = await response.text();

      // Check if response is HTML (Common with SPA fallbacks or default 404 pages)
      if (text.trim().startsWith('<')) {
         if (this.backendAvailable) {
             console.warn(`[Storage] Server returned HTML instead of JSON. Check ${API_ENDPOINT} path.`);
             this.backendAvailable = false;
         }
         this.isSyncing = false;
         return;
      }

      let serverData;
      
      try {
        serverData = JSON.parse(text);
        this.backendAvailable = true; // If we got JSON, backend is up
      } catch (e) {
        if (this.backendAvailable) {
             console.error("[Storage] Invalid JSON from server:", text.substring(0, 150));
        }
        this.isSyncing = false;
        return;
      }
      
      // Merge logic: Trust server if it has data
      if (serverData && (serverData.lastUpdated > this.state.lastUpdated || !this.state.lastUpdated)) {
          this.state.orders = Array.isArray(serverData.orders) ? serverData.orders : this.state.orders;
          this.state.logs = Array.isArray(serverData.logs) ? serverData.logs : this.state.logs;
          this.state.templates = Array.isArray(serverData.templates) ? serverData.templates : this.state.templates;
          
          if (serverData.settings) {
              this.state.settings = { ...this.state.settings, ...serverData.settings };
          }
          
          this.state.lastUpdated = serverData.lastUpdated || Date.now();
          this.saveToLocal(); 
      }
    } catch (e: any) {
      // Silent catch for periodic sync
    } finally {
      this.isSyncing = false;
    }
  }

  public async pushToServer() {
    if (this.isSyncing || !this.backendAvailable) return;
    
    this.isSyncing = true;
    try {
       const payload = {
           orders: this.state.orders,
           logs: this.state.logs,
           templates: this.state.templates,
           settings: this.state.settings,
           lastUpdated: Date.now()
       };

       const response = await fetch(API_ENDPOINT, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify(payload)
       });

       if (response.status === 404) {
          this.backendAvailable = false;
          this.isSyncing = false;
          return;
       }

       if (!response.ok) throw new Error(`Push failed: ${response.status}`);
       
       const text = await response.text();
       if (text.trim().startsWith('<')) {
           this.backendAvailable = false;
           return;
       }
       try { JSON.parse(text); } catch(e) { throw new Error("Server response not JSON"); }
       
    } catch (e: any) {
        // Silent catch
    } finally {
        this.isSyncing = false;
    }
  }

  public async forceSync(): Promise<{ success: boolean; message: string }> {
      this.backendAvailable = true; 
      this.isSyncing = false; 
      
      try {
           const payload = {
               orders: this.state.orders,
               logs: this.state.logs,
               templates: this.state.templates,
               settings: this.state.settings,
               lastUpdated: Date.now()
           };

           const response = await fetch(API_ENDPOINT, {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify(payload)
           });

           if (response.status === 404) {
               return { success: false, message: `Error 404: '${API_ENDPOINT}' not found. Ensure folder is 'builds' (no dot) and 'server.php' is renamed correctly.` };
           }

           if (response.status === 403) {
               return { success: false, message: `Error 403: Forbidden. Your server is blocking access to this folder. Try renaming '.builds' to just 'builds'.` };
           }

           const text = await response.text();
           
           if (text.trim().startsWith('<')) {
               return { success: false, message: `Server returned HTML. This usually means the PHP file wasn't found and the server is showing a 404 page.` };
           }

           try {
               const json = JSON.parse(text);
               if (json.error) {
                   return { success: false, message: `Database Error: ${json.error}` };
               }
               return { success: true, message: "Connected & Saved Successfully!" };
           } catch (e) {
               return { success: false, message: `Invalid JSON Response. Is 'server.php' correct?` };
           }

      } catch (e: any) {
          return { success: false, message: `Network Error: ${e.message}` };
      }
  }

  // --- ACCESSORS ---
  public getOrders() { return this.state.orders; }
  public setOrders(orders: Order[]) { 
      this.state.orders = orders; 
      this.saveToLocal();
      this.pushToServer();
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
      this.pushToServer();
  }
  public subscribe(cb: () => void) {
      this.listeners.push(cb);
      return () => { this.listeners = this.listeners.filter(l => l !== cb); };
  }
  public isBackendOnline() {
      return this.backendAvailable;
  }
  private notify() {
      this.listeners.forEach(cb => cb());
  }
}

export const storageService = new StorageService();
