
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

  /**
   * Initializes global listeners for uncaught errors and promise rejections.
   */
  public initGlobalListeners() {
    window.addEventListener('error', (event) => {
      if (event.message?.includes('cdn.tailwindcss.com')) return;
      this.logError(
        'Browser Runtime',
        event.message || 'Uncaught JavaScript Error',
        'MEDIUM',
        event.error?.stack
      );
    });

    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      let msg = "Unhandled Promise Rejection";
      let source = "Network/API";

      if (typeof reason === 'string') msg = reason;
      else if (reason?.message) msg = reason.message;
      
      if (msg.includes('generativelanguage')) source = 'Gemini AI API';
      if (msg.includes('facebook') || msg.includes('whatsapp')) source = 'Meta WhatsApp API';

      this.logError(source, msg, 'CRITICAL', reason?.stack);
    });

    this.logActivity('STATUS_UPDATE', 'System Intelligence Monitoring Active');
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
    retryAction?: () => Promise<void>
  ) {
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
      retryAction
    };

    this.errors = [newError, ...this.errors].slice(0, this.MAX_ERRORS);
    this.notify();

    if (severity !== 'LOW') {
        this.runAiDiagnosis(newError.id);
    }
  }

  private async runAiDiagnosis(errorId: string) {
    const errorIndex = this.errors.findIndex(e => e.id === errorId);
    if (errorIndex === -1) return;

    const errorObj = this.errors[errorIndex];
    
    if (errorObj.message.includes('403')) {
        this.errors[errorIndex].aiDiagnosis = "API Access Forbidden. Your API Key is likely invalid, expired, or doesn't have permissions.";
        this.errors[errorIndex].status = 'UNRESOLVABLE';
        this.errors[errorIndex].resolutionPath = 'settings';
        this.errors[errorIndex].resolutionCTA = 'Update API Key';
        this.notify();
        return;
    }

    this.errors[errorIndex].status = 'ANALYZING';
    this.notify();

    try {
      const result = await geminiService.diagnoseError(errorObj.message, errorObj.source);
      
      this.errors[errorIndex].aiDiagnosis = result.explanation;
      this.errors[errorIndex].resolutionPath = result.path;
      this.errors[errorIndex].resolutionCTA = result.cta;
      this.errors[errorIndex].suggestedFixData = result.suggestedFixData;
      this.errors[errorIndex].status = 'FIXING';
      this.notify();

      let fixResult = "Manual review required.";
      let resolved = false;

      if (result.action === 'REPAIR_TEMPLATE') {
        fixResult = "Attempting to re-upload System Templates...";
        const failedTemplateName = errorObj.message.match(/template\s+['"]?([a-z0-9_]+)['"]?/i)?.[1];
        const templatesToFix = failedTemplateName 
            ? REQUIRED_SYSTEM_TEMPLATES.filter(t => t.name.includes(failedTemplateName))
            : REQUIRED_SYSTEM_TEMPLATES;

        for (const tpl of templatesToFix) {
           const fullTpl: any = {
               id: 'repair', name: tpl.name, content: tpl.content, 
               tactic: 'AUTHORITY', targetProfile: 'REGULAR', 
               isAiGenerated: false, source: 'LOCAL', category: tpl.category,
               variableExamples: tpl.examples
           };
           const res = await whatsappService.createMetaTemplate(fullTpl);
           if (res.success) {
               fixResult = `Patched template: ${res.finalName}`;
               resolved = true;
           }
        }
      } 
      else if (result.action === 'RETRY_API' && this.errors[errorIndex].retryAction) {
          try {
              await this.errors[errorIndex].retryAction!();
              fixResult = "Automatic retry succeeded.";
              resolved = true;
          } catch (retryErr: any) {}
      }

      this.errors[errorIndex].aiFixApplied = fixResult;
      this.errors[errorIndex].status = resolved ? 'RESOLVED' : 'UNRESOLVABLE';
      this.notify();

    } catch (err) {
      this.errors[errorIndex].status = 'UNRESOLVABLE';
      this.errors[errorIndex].aiDiagnosis = "AI Resolution Engine Timeout.";
      this.notify();
    }
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
