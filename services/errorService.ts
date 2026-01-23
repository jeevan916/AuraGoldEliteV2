
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
  private readonly MAX_ACTIVITIES = 500;
  private lastErrorMsg: string = '';
  private lastErrorTime: number = 0;

  constructor() {
    // Initial fetch from DB
    this.fetchErrorsFromDb();
  }

  private async fetchErrorsFromDb() {
      try {
          const res = await fetch('/api/logs/errors');
          const data = await res.json();
          if (data.success && Array.isArray(data.errors)) {
              this.errors = data.errors;
              this.notify();
          }
      } catch (e) {
          console.warn("[ErrorService] Failed to fetch historical errors", e);
      }
  }

  public initGlobalListeners() {
    window.addEventListener('error', (event) => {
      if (event.message?.includes('cdn.tailwindcss.com')) return;
      this.logError(
        'Browser Runtime',
        event.message || 'Uncaught JavaScript Error',
        'CRITICAL',
        event.error?.stack
      );
    });

    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      let msg = "Unhandled Promise Rejection";
      let source = "Network/API";
      let raw = null;

      if (typeof reason === 'string') msg = reason;
      else if (reason?.message) {
          msg = reason.message;
          raw = reason;
      }
      
      if (msg.includes('generativelanguage')) source = 'Gemini AI API';
      if (msg.includes('facebook') || msg.includes('whatsapp')) source = 'Meta WhatsApp API';

      this.logError(source, msg, 'CRITICAL', reason?.stack, undefined, raw);
    });

    this.logActivity('STATUS_UPDATE', 'Self-Healing Core V5.1 Connected (DB Persisted Logs)');
  }

  private notify() {
    this.listeners.forEach(l => l(this.errors, this.activities));
  }

  public subscribe(listener: ErrorListener) {
    this.listeners.push(listener);
    listener(this.errors, this.activities);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  public logActivity(
      actionType: ActivityLogEntry['actionType'],
      details: string,
      metadata?: any
  ) {
      const newActivity: ActivityLogEntry = {
          id: `ACT-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          timestamp: new Date().toISOString(),
          actionType,
          details,
          metadata
      };
      this.activities = [newActivity, ...this.activities].slice(0, this.MAX_ACTIVITIES);
      this.notify();
  }

  public async logError(
    source: string, 
    message: string, 
    severity: ErrorSeverity = 'MEDIUM', 
    stack?: string,
    retryAction?: () => Promise<void>,
    rawContext?: any
  ) {
    if (message === this.lastErrorMsg && Date.now() - this.lastErrorTime < 2000) return;
    this.lastErrorMsg = message;
    this.lastErrorTime = Date.now();

    const newError: AppError = {
      id: `ERR-${Date.now()}`,
      timestamp: new Date().toISOString(),
      source,
      message,
      stack,
      severity,
      status: 'NEW',
      retryAction,
      rawContext 
    };

    // 1. Update Local State Immediately
    this.errors = [newError, ...this.errors].slice(0, this.MAX_ERRORS);
    this.notify();

    // 2. Persist to Database asynchronously
    try {
        await fetch('/api/logs/error', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newError)
        });
    } catch (e) {
        console.error("Critical: Failed to save error to DB", e);
    }

    // 3. Trigger AI
    if (severity !== 'LOW') {
        this.runIntelligentAnalysis(newError.id);
    }
  }

  public async runIntelligentAnalysis(errorId: string) {
    const errorIndex = this.errors.findIndex(e => e.id === errorId);
    if (errorIndex === -1) return;

    const errorObj = this.errors[errorIndex];
    this.updateError(errorIndex, { status: 'ANALYZING', aiDiagnosis: "Gemini 3 Pro performing deep system inspection..." });

    try {
      const diagnosis = await geminiService.diagnoseError(
          errorObj.message, 
          errorObj.source, 
          errorObj.stack, 
          errorObj.rawContext
      );
      
      this.updateError(errorIndex, {
          aiDiagnosis: diagnosis.explanation,
          implementationPrompt: diagnosis.implementationPrompt,
          resolutionPath: diagnosis.resolutionPath,
          resolutionCTA: diagnosis.fixType === 'AUTO' ? 'Auto-Healing Initiated' : (diagnosis.implementationPrompt ? 'Deploy Code Patch' : 'Manual Audit Required')
      });

      if (diagnosis.fixType === 'AUTO') {
          if (diagnosis.action === 'REPAIR_TEMPLATE') {
             await this.attemptTemplateAutoHeal(errorIndex, errorObj.message);
          } else if (diagnosis.action === 'RETRY_API' && errorObj.retryAction) {
             await errorObj.retryAction();
             this.updateError(errorIndex, { status: 'AUTO_FIXED', aiFixApplied: 'Auto-Retry Succeeded' });
          }
      } else if (diagnosis.fixType === 'MANUAL_CODE') {
          this.updateError(errorIndex, { status: 'REQUIRES_CODE_CHANGE' });
      }

    } catch (err) {
      this.updateError(errorIndex, { status: 'UNRESOLVABLE', aiDiagnosis: "Strategic analysis engine error." });
    }
  }

  private async attemptTemplateAutoHeal(index: number, msg: string) {
      this.logActivity('AUTO_HEAL', 'AI initiating structural repair of Meta payload...');
      
      const failedNameMatch = msg.match(/template\s+['"]?([a-z0-9_]+)['"]?/i);
      const failedName = failedNameMatch ? failedNameMatch[1] : null;
      
      let fixed = false;
      const candidates = failedName 
        ? REQUIRED_SYSTEM_TEMPLATES.filter(t => t.name.includes(failedName))
        : REQUIRED_SYSTEM_TEMPLATES; 

      for (const tpl of candidates) {
          const payload = {
               id: 'heal', name: tpl.name, content: tpl.content, 
               tactic: 'AUTHORITY', targetProfile: 'REGULAR', 
               isAiGenerated: false, source: 'LOCAL', category: tpl.category,
               variableExamples: tpl.examples, appGroup: tpl.appGroup
          };
          const res = await whatsappService.createMetaTemplate(payload as any);
          if (res.success) {
              fixed = true;
              this.logActivity('AUTO_HEAL', `Restored template integrity: ${tpl.name}`);
          }
      }

      if (fixed) {
          this.updateError(index, { status: 'AUTO_FIXED', aiFixApplied: `Payload sanitized and synchronized for: ${failedName || 'Core Registry'}` });
      } else {
          this.updateError(index, { status: 'UNRESOLVABLE', aiFixApplied: 'AI repair cycle completed without successful injection. Manual Meta Console review required.' });
      }
  }

  private updateError(index: number, updates: Partial<AppError>) {
      this.errors[index] = { ...this.errors[index], ...updates };
      this.notify();
  }

  public clearErrors() {
    this.errors = [];
    this.notify();
  }

  public clearActivity() {
      this.activities = [];
      this.notify();
  }
}

export const errorService = new ErrorService();
