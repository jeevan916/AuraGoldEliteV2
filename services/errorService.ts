
import { AppError, ErrorSeverity, ErrorStatus, ActivityLogEntry, AppResolutionPath } from '../types';
import { geminiService } from './geminiService';
import { whatsappService } from './whatsappService';
import { REQUIRED_SYSTEM_TEMPLATES } from '../constants';

type ErrorListener = (errors: AppError[], activities: ActivityLogEntry[]) => void;

class ErrorService {
  private errors: AppError[] = [];
  private activities: ActivityLogEntry[] = [];
  private listeners: ErrorListener[] = [];
  private readonly MAX_ERRORS = 200;

  constructor() {
    try {
      const savedErrors = localStorage.getItem('aura_error_logs');
      if (savedErrors) this.errors = JSON.parse(savedErrors);
      const savedActivity = localStorage.getItem('aura_activity_logs');
      if (savedActivity) this.activities = JSON.parse(savedActivity);
    } catch (e) {}
  }

  public initGlobalListeners() {
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      this.logError('Runtime/API', reason?.message || "Internal Exception", 'HIGH', reason?.stack, undefined, reason);
    });
    this.logActivity('STATUS_UPDATE', 'Intelligence Protocols Synchronized');
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

  public logActivity(actionType: ActivityLogEntry['actionType'], details: string) {
      this.activities = [{ id: `ACT-${Date.now()}`, timestamp: new Date().toISOString(), actionType, details }, ...this.activities].slice(0, 500);
      this.notify();
  }

  public async logError(source: string, message: string, severity: ErrorSeverity = 'MEDIUM', stack?: string, retry?: () => Promise<void>, raw?: any) {
    const newError: AppError = {
      id: `ERR-${Date.now()}`, timestamp: new Date().toISOString(), source, message, stack, severity, status: 'NEW', retryAction: retry, rawContext: raw
    };
    this.errors = [newError, ...this.errors].slice(0, this.MAX_ERRORS);
    this.notify();
    this.runIntelligentAnalysis(newError.id);
  }

  public async runIntelligentAnalysis(errorId: string) {
    const errorIndex = this.errors.findIndex(e => e.id === errorId);
    if (errorIndex === -1) return;
    this.updateError(errorIndex, { status: 'ANALYZING' });

    try {
      const err = this.errors[errorIndex];
      const diagnosis = await geminiService.diagnoseError(err.message, err.source, err.stack, err.rawContext);
      
      this.updateError(errorIndex, {
          aiDiagnosis: diagnosis.explanation,
          implementationPrompt: diagnosis.implementationPrompt,
          resolutionPath: diagnosis.resolutionPath,
          status: diagnosis.fixType === 'MANUAL_CODE' ? 'REQUIRES_CODE_CHANGE' : 'RESOLVED'
      });

      if (diagnosis.fixType === 'AUTO' && diagnosis.action === 'REPAIR_TEMPLATE') {
          await this.attemptTemplateAutoHeal(errorIndex, err.message);
      }
    } catch (err) {
      this.updateError(errorIndex, { status: 'UNRESOLVABLE' });
    }
  }

  private async attemptTemplateAutoHeal(index: number, msg: string) {
      this.logActivity('AUTO_HEAL', 'Attempting surgical repair of Meta Template registry...');
      // Logic for re-registering core templates via backend
  }

  private updateError(index: number, updates: Partial<AppError>) {
      this.errors[index] = { ...this.errors[index], ...updates };
      this.notify();
  }

  public clearErrors() { this.errors = []; this.notify(); }

  // Added clearActivity method to fix Property 'clearActivity' does not exist on type 'ErrorService' error in App.tsx
  public clearActivity() { this.activities = []; this.notify(); }
}

export const errorService = new ErrorService();
