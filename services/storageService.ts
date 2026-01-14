
import { Order, WhatsAppLogEntry, WhatsAppTemplate, GlobalSettings, PaymentPlanTemplate } from '../types';
import { INITIAL_SETTINGS, INITIAL_PLAN_TEMPLATES } from '../constants';

const API_ENDPOINT = '/api/storage';
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
        
        // Smart Merge for Settings: Env Vars (INITIAL_SETTINGS) should override empty LocalStorage values
        let mergedSettings = parsed.settings ? { ...INITIAL_SETTINGS, ...parsed.settings } : INITIAL_SETTINGS;
        
        if (!mergedSettings.whatsappPhoneNumberId && INITIAL_SETTINGS.whatsappPhoneNumberId) {
            mergedSettings.whatsappPhoneNumberId = INITIAL_SETTINGS.whatsappPhoneNumberId;
        }
        if (!mergedSettings.whatsappBusinessAccountId && INITIAL_SETTINGS.whatsappBusinessAccountId) {
            mergedSettings.whatsappBusinessAccountId = INITIAL_SETTINGS.whatsappBusinessAccountId;
        }
        if (!mergedSettings.whatsappBusinessToken && INITIAL_SETTINGS.whatsappBusinessToken) {
            mergedSettings.whatsappBusinessToken = INITIAL_SETTINGS.whatsappBusinessToken;
        }

        this.state = {
          ...this.state,
          ...parsed,
          orders: Array.isArray(parsed.orders) ? parsed.orders : [],
          logs: Array.isArray(parsed.logs) ? parsed.logs : [],
          templates: Array.isArray(parsed.templates) ? parsed.templates : [],
          planTemplates: Array.isArray(parsed.planTemplates) ? parsed.planTemplates : INITIAL_PLAN_TEMPLATES,
          settings: mergedSettings
        };
      }
    } catch (e) {
      console.warn("[Storage] Local storage parse error", e);
    }
  }

  private saveToLocal() {
    try {
      localStorage.setItem('aura_master_state', JSON.stringify(this.state));
      localStorage.setItem('aura_settings', JSON.stringify(this.state.settings));
      this.notify();
    } catch (e) {
      console.error("[Storage] Local save failed", e);
    }
  }

  public async pullFromServer() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const response = await fetch(API_ENDPOINT);
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      
      const serverData = await response.json();
      
      if (serverData && serverData.lastUpdated > this.state.lastUpdated) {
          // Apply same smart merge logic for server data
          let mergedSettings = serverData.settings ? { ...this.state.settings, ...serverData.settings } : this.state.settings;
          
          if (!mergedSettings.whatsappPhoneNumberId && INITIAL_SETTINGS.whatsappPhoneNumberId) {
              mergedSettings.whatsappPhoneNumberId = INITIAL_SETTINGS.whatsappPhoneNumberId;
          }

          this.state = {
            ...this.state,
            ...serverData,
            orders: Array.isArray(serverData.orders) ? serverData.orders : this.state.orders,
            logs: Array.isArray(serverData.logs) ? serverData.logs : this.state.logs,
            templates: Array.isArray(serverData.templates) ? serverData.templates : this.state.templates,
            planTemplates: Array.isArray(serverData.planTemplates) ? serverData.planTemplates : this.state.planTemplates,
            settings: mergedSettings
          };
          this.saveToLocal();
      }
    } catch (e: any) {
      console.warn("[Storage] Remote pull failed, using local:", e.message);
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

       if (!response.ok) throw new Error(`Push failed: ${response.status}`);
    } catch (e: any) {
        console.warn("[Storage] Background push failed:", e.message);
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
  public getPlanTemplates() { return this.state.planTemplates; }
  public setPlanTemplates(planTemplates: PaymentPlanTemplate[]) {
      this.state.planTemplates = planTemplates;
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
