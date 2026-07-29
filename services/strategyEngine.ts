import { Order, GlobalSettings, NotificationTrigger, CollectionTone, RiskProfile } from '../types';
import { whatsappService } from './whatsappService';
import { storageService } from './storageService';

export interface StrategyWorkerLog {
  id: string;
  timestamp: string;
  orderId: string;
  customerName: string;
  triggerType: 'UPCOMING' | 'OVERDUE' | 'SYSTEM';
  templateName: string;
  status: 'EVALUATED' | 'SENT' | 'SKIPPED' | 'FAILED';
  details: string;
  source?: '12PM_DAILY_SCAN' | 'MANUAL_SWEEP' | 'WORKER_TICK';
}

export interface InbuiltCollectionRule {
  id: string;
  name: string;
  condition: string;
  gracePeriodDays: number;
  tone: CollectionTone;
  templateId: string;
  actionSummary: string;
  termsClause: string;
}

export interface TermsClause {
  id: string;
  title: string;
  text: string;
}

export const DEFAULT_TERMS_AND_CONDITIONS: { title: string; version: string; effectiveDate: string; clauses: TermsClause[] } = {
  title: "AuraGold Rate Protection & Collection Policy Terms & Conditions",
  version: "v3.2-InbuiltEngine",
  effectiveDate: "2026-01-01",
  clauses: [
    {
      id: "TC-1",
      title: "Gold Rate Protection Lock",
      text: "The gold purchase rate is locked for active payment plans provided all scheduled installment milestones are paid on or before the agreed promise date."
    },
    {
      id: "TC-2",
      title: "Grace Period & Gentle Reminder Window",
      text: "A 3-day grace period is granted post promise date. Gentle reminders will be sent via automated Meta WhatsApp channels before rate lock escalation."
    },
    {
      id: "TC-3",
      title: "Overdue Breach & Market Rate Adjustment Surcharge",
      text: "Failure to pay within 3 days of the milestone promise date results in immediate rate protection lapse. Outstanding dues will be re-assessed at current prevailing spot market gold rates."
    },
    {
      id: "TC-4",
      title: "Automated Daily 12:00 PM Scan Schedule",
      text: "The system performs an automated collection sweep daily at 12:00 PM IST. Notifications generated during daily sweeps adhere strictly to Meta WhatsApp Business API compliance rules."
    },
    {
      id: "TC-5",
      title: "VIP & High-Value Customer Custom Policy",
      text: "VIP accounts with cumulative purchases exceeding ₹5,00,000 receive dedicated soft-nudge collection workflows with extended 5-day grace periods before rate lock termination."
    }
  ]
};

export const DEFAULT_INBUILT_RULES: InbuiltCollectionRule[] = [
  {
    id: "RULE-1",
    name: "Upcoming Installment Early Nudge",
    condition: "Milestone due within 1 to 15 days",
    gracePeriodDays: 0,
    tone: "ENCOURAGING",
    templateId: "auragold_gentle_reminder",
    actionSummary: "Dispatch gentle WhatsApp reminder with direct payment link.",
    termsClause: "Clause TC-2 (Grace Period & Gentle Reminder Window)"
  },
  {
    id: "RULE-2",
    name: "Promise Date Same-Day Settlement Notice",
    condition: "Milestone due TODAY (0 days)",
    gracePeriodDays: 0,
    tone: "FIRM",
    templateId: "auragold_gentle_reminder",
    actionSummary: "Dispatch firm same-day payment milestone notification.",
    termsClause: "Clause TC-1 (Gold Rate Protection Lock)"
  },
  {
    id: "RULE-3",
    name: "Grace Period Overdue Breach (1-3 Days)",
    condition: "Milestone overdue by 1 to 3 days",
    gracePeriodDays: 3,
    tone: "FIRM",
    templateId: "auragold_payment_overdue",
    actionSummary: "Dispatch overdue breach warning to prevent rate protection lapse.",
    termsClause: "Clause TC-2 & TC-3 (Overdue Breach & Rate Adjustment)"
  },
  {
    id: "RULE-4",
    name: "Protection Lapse & Market Rate Surcharge (>3 Days)",
    condition: "Milestone overdue by >3 days OR protection status LAPSED",
    gracePeriodDays: 0,
    tone: "URGENT",
    templateId: "auragold_urgent_lapse",
    actionSummary: "Issue formal rate lock termination notice & market rate re-adjustment demand.",
    termsClause: "Clause TC-3 (Overdue Breach & Rate Adjustment Surcharge)"
  },
  {
    id: "RULE-5",
    name: "VIP High-Value Customer Extended Soft Nudge",
    condition: "VIP Profile & Milestone overdue <= 5 days",
    gracePeriodDays: 5,
    tone: "ENCOURAGING",
    templateId: "auragold_gentle_reminder",
    actionSummary: "Apply VIP relationship protocol with extended grace period before escalation.",
    termsClause: "Clause TC-5 (VIP & High-Value Customer Policy)"
  }
];

export const strategyEngine = {
  /**
   * Deterministic Inbuilt Strategy Generator that operates standalone without relying on external AI services.
   */
  generateInbuiltStrategy(
    order: Order, 
    type: 'UPCOMING' | 'OVERDUE' | 'SYSTEM', 
    goldRate: number, 
    riskProfile: RiskProfile = 'REGULAR'
  ): { tone: CollectionTone; reasoning: string; templateId: string; variables: string[]; message: string } {
    const customerName = order.customerName || 'Valued Customer';
    const appUrl = window.location.origin;
    const paymentLink = `${appUrl}/?token=${order.shareToken || ''}`;
    const totalPaid = (order.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
    const dueAmount = Math.max(0, (order.totalAmount || 0) - totalPaid);
    const amountStr = `₹${Math.round(dueAmount).toLocaleString('en-IN')}`;

    // Calculate breach days if milestone exists
    let breachDays = 0;
    if (order.paymentPlan?.milestones) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const unpaidMilestones = order.paymentPlan.milestones.filter(m => m.status !== 'PAID');
      if (unpaidMilestones.length > 0) {
        const earliestDue = new Date(unpaidMilestones[0].dueDate);
        const diffDays = Math.round((earliestDue.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) breachDays = Math.abs(diffDays);
      }
    }

    // Rule 5: VIP Custom Policy
    if (riskProfile === 'VIP' && breachDays <= 5) {
      return {
        tone: 'ENCOURAGING',
        reasoning: `Inbuilt Rule #5 (VIP Protocol): Customer holds VIP status (>₹5L purchases). Extended 5-day grace period applied per T&C Clause TC-5. Gentle nudge sent.`,
        templateId: 'auragold_gentle_reminder',
        variables: [customerName, amountStr, order.id, paymentLink],
        message: `Dear VIP Client ${customerName}, gentle reminder that your balance of ${amountStr} for Order ${order.id} is pending. Secure your locked gold rate here: ${paymentLink}`
      };
    }

    // Rule 4: Overdue > 3 days or Lapsed
    if (type === 'OVERDUE' && (breachDays > 3 || order.paymentPlan?.protectionStatus === 'LAPSED')) {
      return {
        tone: 'URGENT',
        reasoning: `Inbuilt Rule #4 (Rate Lock Breach): Payment overdue by ${breachDays} days exceeding 3-day grace period. T&C Clause TC-3 triggered. Surcharge liability applied at ₹${goldRate}/g.`,
        templateId: 'auragold_urgent_lapse',
        variables: [customerName, order.id, amountStr, paymentLink],
        message: `URGENT NOTICE for ${customerName}: Gold Rate Protection for Order ${order.id} has breached the 3-day grace period. Clear ${amountStr} immediately to avoid rate re-adjustment: ${paymentLink}`
      };
    }

    // Rule 3: Overdue 1-3 days
    if (type === 'OVERDUE' || breachDays > 0) {
      return {
        tone: 'FIRM',
        reasoning: `Inbuilt Rule #3 (Grace Period Breach): Payment overdue by ${breachDays} day(s). T&C Clause TC-2 applied. Firm reminder sent before rate lock termination.`,
        templateId: 'auragold_payment_overdue',
        variables: [customerName, amountStr, paymentLink],
        message: `Dear ${customerName}, your installment of ${amountStr} for Order ${order.id} is overdue by ${breachDays} day(s). Please clear dues via: ${paymentLink}`
      };
    }

    // Rule 2: Due Today
    if (breachDays === 0 && type === 'UPCOMING') {
      return {
        tone: 'FIRM',
        reasoning: `Inbuilt Rule #2 (Promise Date Settlement): Installment milestone due today. T&C Clause TC-1 applied to maintain rate lock.`,
        templateId: 'auragold_gentle_reminder',
        variables: [customerName, amountStr, order.id, paymentLink],
        message: `Hello ${customerName}, today is the promise date for your installment of ${amountStr} for Order ${order.id}. Pay here to protect your rate: ${paymentLink}`
      };
    }

    // Rule 1: Default Upcoming
    return {
      tone: 'ENCOURAGING',
      reasoning: `Inbuilt Rule #1 (Early Nudge): Installment due soon (${amountStr}). T&C Clause TC-2 applied for zero-friction payment flow.`,
      templateId: 'auragold_gentle_reminder',
      variables: [customerName, amountStr, order.id, paymentLink],
      message: `Hello ${customerName}, gentle reminder that your upcoming installment of ${amountStr} for Order ${order.id} is scheduled. Pay here: ${paymentLink}`
    };
  },

  /**
   * Calculates status for the 12:00 PM Daily Scan schedule
   */
  getDailyScanInfo(): { nextScanTime: string; lastScanTime: string | null; hasRunToday: boolean } {
    const now = new Date();
    const todayNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
    const lastRunStr = localStorage.getItem('auragold_last_12pm_scan');
    
    let hasRunToday = false;
    if (lastRunStr) {
      const lastRun = new Date(lastRunStr);
      if (lastRun.getFullYear() === now.getFullYear() && 
          lastRun.getMonth() === now.getMonth() && 
          lastRun.getDate() === now.getDate()) {
        hasRunToday = true;
      }
    }

    let nextScan: Date;
    if (now < todayNoon && !hasRunToday) {
      nextScan = todayNoon;
    } else {
      // Tomorrow at 12:00 PM
      nextScan = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12, 0, 0, 0);
    }

    return {
      nextScanTime: nextScan.toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true, month: 'short', day: 'numeric' }),
      lastScanTime: lastRunStr ? new Date(lastRunStr).toLocaleTimeString() : null,
      hasRunToday
    };
  },

  /**
   * Checks if 12:00 PM has arrived today or passed without scan, and executes sweep automatically if needed.
   */
  async checkAndRun12PmAutoScan(orders: Order[], settings?: GlobalSettings): Promise<{ didRun: boolean; results?: any }> {
    const now = new Date();
    const todayNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
    const { hasRunToday } = this.getDailyScanInfo();

    // Trigger auto-scan if it's 12:00 PM or later today and hasn't run yet
    if (now >= todayNoon && !hasRunToday) {
      console.log("[StrategyEngine] 12:00 PM Daily Scan Triggered Automatically!");
      localStorage.setItem('auragold_last_12pm_scan', now.toISOString());
      const sweepResults = await this.runWorkerSweep(orders, settings, '12PM_DAILY_SCAN');
      return { didRun: true, results: sweepResults };
    }

    return { didRun: false };
  },

  /**
   * Scans all orders for payment plan milestones against promise/due dates and protection lapses.
   * Generates dynamic NotificationTriggers mapped to approved Meta WhatsApp templates.
   */
  evaluatePaymentTriggers(orders: Order[], settings?: GlobalSettings): NotificationTrigger[] {
    const triggers: NotificationTrigger[] = [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const activeOrders = orders.filter(o => 
      o.status !== 'DELIVERED' && o.status !== 'CANCELLED'
    );

    for (const order of activeOrders) {
      if (!order.paymentPlan || !Array.isArray(order.paymentPlan.milestones)) continue;

      const customerName = order.customerName || 'Customer';
      const customerContact = order.customerContact;
      if (!customerContact) continue;

      const shareToken = order.shareToken || '';
      const appUrl = window.location.origin;
      const paymentLink = `${appUrl}/?token=${shareToken}`;
      const totalPaid = (order.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
      const orderDueAmount = Math.max(0, (order.totalAmount || 0) - totalPaid);

      // 1. Check Rate Protection Warning or Lapse
      if (order.paymentPlan.protectionStatus === 'WARNING' || order.paymentPlan.protectionStatus === 'LAPSED') {
        const isLapsed = order.paymentPlan.protectionStatus === 'LAPSED';
        const templateName = isLapsed ? 'auragold_rate_adjustment_liability' : 'auragold_urgent_lapse';
        const tone: CollectionTone = 'URGENT';
        const amountStr = `₹${Math.round(orderDueAmount).toLocaleString('en-IN')}`;
        
        triggers.push({
          id: `trig_prot_${order.id}`,
          orderId: order.id,
          customerName,
          customerContact,
          type: 'OVERDUE',
          tone,
          date: new Date().toISOString(),
          sent: false,
          templateName,
          aiRecommendedTemplateId: templateName,
          dueAmount: orderDueAmount,
          breachDays: 1,
          shareToken,
          strategyReasoning: isLapsed 
            ? `Inbuilt Rule #4 (T&C TC-3): Protection Lapsed! Payment milestone missed. Market rate adjustment surcharge applied.`
            : `Inbuilt Rule #4 (T&C TC-2): Protection Warning! Rate lock expires in 24 hours due to unpaid milestone.`,
          message: isLapsed
            ? `URGENT notice for ${customerName}: Rate protection for Order ${order.id} has lapsed. Pay dues to accept new terms: ${paymentLink}`
            : `URGENT ${customerName}: Your Gold Rate Protection for order ${order.id} expires in 24h. Pay ${amountStr} now: ${paymentLink}`,
          aiRecommendedVariables: isLapsed 
            ? [customerName, amountStr, order.id, `${settings?.currentGoldRate22K || 7200}`, shareToken]
            : [customerName, order.id, amountStr, paymentLink]
        });
      }

      // 2. Check Milestones against Due / Promise Dates
      const milestones = order.paymentPlan.milestones;
      for (let i = 0; i < milestones.length; i++) {
        const milestone = milestones[i];
        if (milestone.status === 'PAID') continue;

        const dueDateRaw = new Date(milestone.dueDate);
        if (isNaN(dueDateRaw.getTime())) continue;
        const dueDate = new Date(dueDateRaw.getFullYear(), dueDateRaw.getMonth(), dueDateRaw.getDate());

        // Calculate diffDays: 
        // diffDays > 0 => Due in future (Upcoming)
        // diffDays = 0 => Due Today
        // diffDays < 0 => Overdue (Breached Promise Date)
        const diffTime = dueDate.getTime() - today.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        // Calculate unpaid target for this milestone
        const previousTargets = milestones.slice(0, i).reduce((sum, m) => sum + m.targetAmount, 0);
        const paidTowardsThis = Math.max(0, totalPaid - previousTargets);
        const milestoneDue = Math.max(0, milestone.targetAmount - paidTowardsThis);
        if (milestoneDue <= 0) continue;

        const amountStr = `₹${Math.round(milestoneDue).toLocaleString('en-IN')}`;

        if (diffDays >= 0 && diffDays <= 15) {
          // Upcoming or Due Today Nudge
          const templateName = 'auragold_gentle_reminder';
          const tone: CollectionTone = diffDays === 0 ? 'FIRM' : 'ENCOURAGING';
          const ruleId = diffDays === 0 ? 'Inbuilt Rule #2 (T&C TC-1)' : 'Inbuilt Rule #1 (T&C TC-2)';

          triggers.push({
            id: `trig_m_${order.id}_${milestone.id}`,
            orderId: order.id,
            milestoneId: milestone.id,
            milestoneTitle: milestone.description || `Installment #${i + 1}`,
            customerName,
            customerContact,
            type: 'UPCOMING',
            tone,
            date: milestone.dueDate,
            sent: false,
            templateName,
            aiRecommendedTemplateId: templateName,
            dueAmount: milestoneDue,
            breachDays: 0,
            shareToken,
            strategyReasoning: diffDays === 0 
              ? `${ruleId}: Installment due today (${amountStr}). Same-day settlement notice dispatched to maintain rate lock.`
              : `${ruleId}: Upcoming installment in ${diffDays} days (${amountStr}). Early nudge sent to encourage timely settlement.`,
            message: `Hello ${customerName}, a gentle reminder that your installment of ${amountStr} for order ${order.id} is due. Please pay here: ${paymentLink}`,
            aiRecommendedVariables: [customerName, amountStr, order.id, paymentLink]
          });

        } else if (diffDays < 0) {
          // Breached Promise Date / Payment Overdue
          const breachDays = Math.abs(diffDays);
          const templateName = breachDays <= 3 ? 'auragold_payment_overdue' : 'auragold_urgent_lapse';
          const tone: CollectionTone = breachDays <= 3 ? 'FIRM' : 'URGENT';
          const ruleId = breachDays <= 3 ? 'Inbuilt Rule #3 (T&C TC-2)' : 'Inbuilt Rule #4 (T&C TC-3)';

          triggers.push({
            id: `trig_br_${order.id}_${milestone.id}`,
            orderId: order.id,
            milestoneId: milestone.id,
            milestoneTitle: milestone.description || `Installment #${i + 1}`,
            customerName,
            customerContact,
            type: 'OVERDUE',
            tone,
            date: milestone.dueDate,
            sent: false,
            templateName,
            aiRecommendedTemplateId: templateName,
            dueAmount: milestoneDue,
            breachDays,
            shareToken,
            strategyReasoning: `${ruleId}: Payment Promise Breached by ${breachDays} day(s)! Target due: ${amountStr}. Overdue alert triggered to protect locked gold rate.`,
            message: breachDays <= 3
              ? `Dear ${customerName}, we noticed your payment of ${amountStr} for order ${order.id} is overdue by ${breachDays} day(s). Maintain rate protection via: ${paymentLink}`
              : `URGENT ${customerName}: Your Gold Rate Protection for order ${order.id} is at risk (Overdue ${breachDays}d). Clear ${amountStr} immediately: ${paymentLink}`,
            aiRecommendedVariables: breachDays <= 3
              ? [customerName, amountStr, paymentLink]
              : [customerName, order.id, amountStr, paymentLink]
          });
        }
      }
    }

    return triggers;
  },

  /**
   * Dispatches automated trigger via server API or client WhatsApp service
   */
  async dispatchTrigger(trigger: NotificationTrigger): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      if (trigger.orderId) {
        // Prefer server-side API endpoint if available
        try {
          const apiRes = await fetch(`/api/whatsapp/send-reminder/${trigger.orderId}`, { method: 'POST' });
          if (apiRes.ok) {
            const data = await apiRes.json();
            if (data.success) {
              return { success: true, message: data.message };
            }
          }
        } catch (e) {
          console.warn("[StrategyEngine] API endpoint offline, falling back to client WhatsApp service.");
        }
      }

      // Client-side fallback via whatsappService
      const templateId = trigger.aiRecommendedTemplateId || trigger.templateName || 'auragold_gentle_reminder';
      const vars = trigger.aiRecommendedVariables || [trigger.customerName, `₹${Math.round(trigger.dueAmount || 0)}`, trigger.orderId || '', ''];

      const res = await whatsappService.sendTemplateMessage(
        trigger.customerContact,
        templateId,
        'en_US',
        vars,
        trigger.customerName
      );

      if (res.success) {
        return { success: true, message: `Dispatched ${templateId} via WhatsApp!` };
      } else {
        return { success: false, error: res.error || 'WhatsApp dispatch failed' };
      }
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Runs a complete worker simulation sweep over all active triggers
   */
  async runWorkerSweep(
    orders: Order[], 
    settings?: GlobalSettings, 
    source: '12PM_DAILY_SCAN' | 'MANUAL_SWEEP' | 'WORKER_TICK' = 'WORKER_TICK'
  ): Promise<{ evaluatedCount: number; dispatchedCount: number; logs: StrategyWorkerLog[] }> {
    const triggers = this.evaluatePaymentTriggers(orders, settings);
    const logs: StrategyWorkerLog[] = [];
    let dispatchedCount = 0;

    for (const trigger of triggers) {
      const logItem: StrategyWorkerLog = {
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toLocaleTimeString(),
        orderId: trigger.orderId || 'N/A',
        customerName: trigger.customerName,
        triggerType: trigger.type,
        templateName: trigger.templateName || 'auragold_gentle_reminder',
        status: 'EVALUATED',
        details: trigger.strategyReasoning || 'Payment milestone analyzed',
        source
      };

      // Execute dispatch
      const result = await this.dispatchTrigger(trigger);
      if (result.success) {
        logItem.status = 'SENT';
        logItem.details = result.message || 'Automated WhatsApp reminder sent successfully';
        dispatchedCount++;
      } else {
        logItem.status = 'FAILED';
        logItem.details = `Failed: ${result.error}`;
      }

      logs.push(logItem);
    }

    return {
      evaluatedCount: triggers.length,
      dispatchedCount,
      logs
    };
  }
};

