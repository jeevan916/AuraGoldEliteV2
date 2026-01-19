
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
    try {
      const savedErrors = localStorage.getItem('aura_error_logs');
      if (savedErrors) this.errors = JSON.parse(savedErrors);
      
      const savedActivity = localStorage.getItem('aura_activity_logs');
      if (savedActivity) this.activities = JSON.parse(savedActivity);
    } catch (e) {
      console.warn("[ErrorService] Local storage corruption. Starting fresh.", e);
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
          raw = reason; // Store the actual error object
      }
      
      if (msg.includes('generativelanguage')) source = 'Gemini AI API';
      if (msg.includes('facebook') || msg.includes('whatsapp')) source = 'Meta WhatsApp API';

      this.logError(source, msg, 'CRITICAL', reason?.stack, undefined, raw);
    });

    this.logActivity('STATUS_UPDATE', 'Self-Healing Intelligence V2.5 Active');
  }

  private notify() {
    try {
      localStorage.setItem('aura_error_logs', JSON.stringify(this.errors));
      localStorage.setItem('aura_activity_logs', JSON.stringify(this.activities));
    } catch (e) {
      console.error("[ErrorService] Failed to persist logs", e);
    }
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

  public logWarning(source: string, message: string, metadata?: any) {
      this.logError(source, message, 'LOW');
      if (metadata) {
          this.logActivity('STATUS_UPDATE', `Warning at ${source}: ${message}`, metadata);
      }
  }

  public async logError(
    source: string, 
    message: string, 
    severity: ErrorSeverity = 'MEDIUM', 
    stack?: string,
    retryAction?: () => Promise<void>,
    rawContext?: any
  ) {
    // Debounce duplicate errors
    if (message === this.lastErrorMsg && Date.now() - this.lastErrorTime < 2000) return;
    this.lastErrorMsg = message;
    this.lastErrorTime = Date.now();

    const newError: AppError = {
      id: `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString(),
      source,
      message,
      stack,
      severity,
      status: 'NEW',
      retryAction,
      rawContext // Pass through the raw data from the caller
    };

    this.errors = [newError, ...this.errors].slice(0, this.MAX_ERRORS);
    this.notify();

    if (severity !== 'LOW') {
        this.runIntelligentAnalysis(newError.id);
    }
  }

  private async runIntelligentAnalysis(errorId: string) {
    const errorIndex = this.errors.findIndex(e => e.id === errorId);
    if (errorIndex === -1) return;

    const errorObj = this.errors[errorIndex];
    this.updateError(errorIndex, { status: 'ANALYZING' });

    try {
      // Pass the rawContext to Gemini for deep inspection
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
          resolutionCTA: diagnosis.fixType === 'AUTO' ? 'Auto-Repairing...' : (diagnosis.implementationPrompt ? 'View Fix Directive' : 'Manual Review')
      });

      if (diagnosis.fixType === 'AUTO') {
          if (diagnosis.action === 'REPAIR_TEMPLATE' || errorObj.message.toLowerCase().includes('template')) {
             await this.attemptTemplateAutoHeal(errorIndex, errorObj.message);
          } else if (diagnosis.action === 'RETRY_API' && errorObj.retryAction) {
             await errorObj.retryAction();
             this.updateError(errorIndex, { status: 'AUTO_FIXED', aiFixApplied: 'Auto-Retry Successful' });
          }
      } else if (diagnosis.fixType === 'MANUAL_CODE') {
          this.updateError(errorIndex, { status: 'REQUIRES_CODE_CHANGE' });
      }

    } catch (err) {
      this.updateError(errorIndex, { status: 'UNRESOLVABLE', aiDiagnosis: "Diagnostic Engine Failure." });
    }
  }

  private async attemptTemplateAutoHeal(index: number, msg: string) {
      this.logActivity('AUTO_HEAL', 'Executing payload repair based on API feedback...');
      
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
              this.logActivity('AUTO_HEAL', `Successfully restored structural integrity for: ${tpl.name}`);
          }
      }

      if (fixed) {
          this.updateError(index, { status: 'AUTO_FIXED', aiFixApplied: `Repaired template structure: ${failedName || 'Core Registry'}` });
      } else {
          this.updateError(index, { status: 'UNRESOLVABLE', aiFixApplied: 'Structural repair unsuccessful. Manual engineering required.' });
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
