
import { AppError, ErrorSeverity, ActivityLogEntry } from '../types';
import { geminiService } from './geminiService';

type ErrorListener = (errors: AppError[], activities: ActivityLogEntry[]) => void;

class ErrorService {
  private errors: AppError[] = [];
  private activities: ActivityLogEntry[] = [];
  private listeners: ErrorListener[] = [];
  private readonly MAX_LOGS = 100;

  constructor() {
    const savedErrors = localStorage.getItem('aura_error_logs');
    if (savedErrors) this.errors = JSON.parse(savedErrors);
    const savedActivity = localStorage.getItem('aura_activity_logs');
    if (savedActivity) this.activities = JSON.parse(savedActivity);
  }

  public initGlobalListeners() {
    window.addEventListener('error', (event) => {
      this.logError('Browser Runtime', event.message || 'Error', 'CRITICAL', event.error?.stack);
    });
    this.logActivity('SYSTEM_START', 'System Intelligence Active');
  }

  private notify() {
    localStorage.setItem('aura_error_logs', JSON.stringify(this.errors));
    localStorage.setItem('aura_activity_logs', JSON.stringify(this.activities));
    this.listeners.forEach(l => l(this.errors, this.activities));
  }

  public subscribe(listener: ErrorListener) {
    this.listeners.push(listener);
    listener(this.errors, this.activities);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  public logActivity(actionType: string, details: string) {
      const act: ActivityLogEntry = { id: `ACT-${Date.now()}`, timestamp: new Date().toISOString(), actionType, details };
      this.activities = [act, ...this.activities].slice(0, this.MAX_LOGS);
      this.notify();
      this.pushToServer({ activity: act });
  }

  public async logError(source: string, message: string, severity: ErrorSeverity = 'MEDIUM', stack?: string) {
    const err: AppError = { id: `ERR-${Date.now()}`, timestamp: new Date().toISOString(), source, message, stack, severity, status: 'NEW' };
    this.errors = [err, ...this.errors].slice(0, this.MAX_LOGS);
    this.notify();
    this.pushToServer({ error: err });

    if (severity !== 'LOW') {
        const diagnosis = await geminiService.diagnoseError(message, source, stack);
        const idx = this.errors.findIndex(e => e.id === err.id);
        if (idx !== -1) {
            this.errors[idx] = { ...this.errors[idx], aiDiagnosis: diagnosis.explanation, implementationPrompt: diagnosis.implementationPrompt, status: 'ANALYZING' };
            this.notify();
        }
    }
  }

  private async pushToServer(payload: any) {
      try {
          await fetch('/api/sync/logs/system', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
          });
      } catch (e) {}
  }

  public clearErrors() { this.errors = []; this.notify(); }
  public clearActivity() { this.activities = []; this.notify(); }
}

export const errorService = new ErrorService();
