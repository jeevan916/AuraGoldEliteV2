
import { GlobalSettings, PaymentPlanTemplate, WhatsAppTemplate, CatalogItem } from './types';

// Helper to safely access environment variables
const getEnv = (key: string): string => {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env[key]) {
      return (import.meta as any).env[key];
    }
    if (typeof process !== 'undefined' && process.env && (process.env as any)[key]) {
      return (process.env as any)[key] as string;
    }
  } catch (e) {}
  return '';
};

export const INITIAL_SETTINGS: GlobalSettings = {
  currentGoldRate24K: 7200,
  currentGoldRate22K: 6600,
  currentGoldRate18K: 5400,
  defaultTaxRate: 3,
  goldRateProtectionMax: 500,
  gracePeriodHours: 24, // Default 24 hours grace
  followUpIntervalDays: 3, // Default follow up every 3 days
  whatsappPhoneNumberId: getEnv('VITE_WHATSAPP_PHONE_ID'),
  whatsappBusinessAccountId: getEnv('VITE_WHATSAPP_WABA_ID'),
  whatsappBusinessToken: getEnv('VITE_WHATSAPP_TOKEN')
};

export const INITIAL_CATALOG: CatalogItem[] = [
  { id: 'c1', category: 'Ring', name: 'Standard Wedding Band', metalColor: 'Yellow Gold', purity: '22K', wastagePercentage: 12, makingChargesPerGram: 450, stoneCharges: 0 },
  { id: 'c2', category: 'Necklace', name: 'Antique Temple Haram', metalColor: 'Yellow Gold', purity: '22K', wastagePercentage: 18, makingChargesPerGram: 600, stoneCharges: 2500 },
  { id: 'c3', category: 'Earrings', name: 'Diamond Studded Tops', metalColor: 'Rose Gold', purity: '18K', wastagePercentage: 15, makingChargesPerGram: 800, stoneCharges: 15000 },
  { id: 'c4', category: 'Bangle', name: 'Daily Wear Kadas', metalColor: 'Yellow Gold', purity: '22K', wastagePercentage: 10, makingChargesPerGram: 400, stoneCharges: 0 },
];

export const JEWELRY_CATEGORIES = [
  'Ring', 'Necklace', 'Earrings', 'Bracelet', 'Bangle', 'Pendant', 'Chain', 'Mangalsutra', 'Set', 'Coins', 'Kada'
];

export const PURITY_OPTIONS = ['22K', '24K', '18K'];

export const PRE_CREATED_PLANS = [
  { name: 'Short Term (3 Months)', months: 3, interest: 0, advance: 20 },
  { name: 'Standard (6 Months)', months: 6, interest: 5, advance: 15 },
  { name: 'Long Term (12 Months)', months: 12, interest: 8, advance: 10 },
];

export const INITIAL_PLAN_TEMPLATES: PaymentPlanTemplate[] = [
  { id: 'p1', name: 'Short Term (3 Months)', months: 3, interestPercentage: 0, advancePercentage: 20, enabled: true },
  { id: 'p2', name: 'Standard (6 Months)', months: 6, interestPercentage: 5, advancePercentage: 15, enabled: true },
  { id: 'p3', name: 'Long Term (12 Months)', months: 12, interestPercentage: 8, advancePercentage: 10, enabled: true },
];

export const PSYCHOLOGICAL_TACTICS = [
  { id: 'LOSS_AVERSION', label: 'Loss Aversion', description: 'Emphasize losing Gold Rate Protection or credit score.' },
  { id: 'SOCIAL_PROOF', label: 'Social Proof', description: 'Mention how other VIP customers are clearing dues.' },
  { id: 'AUTHORITY', label: 'Authority', description: 'Formal notice from the Accounts Department.' },
  { id: 'RECIPROCITY', label: 'Reciprocity', description: 'We held the item for you, please reciprocate with payment.' },
  { id: 'URGENCY', label: 'Urgency/Scarcity', description: 'Limited time to avoid penalties or release of item.' },
  { id: 'EMPATHY', label: 'Empathy/Helper', description: 'Gentle, understanding check-in for forgetful clients.' }
];

export const RISK_PROFILES = [
  { id: 'VIP', label: 'VIP / Reliable', color: 'bg-emerald-100 text-emerald-800' },
  { id: 'REGULAR', label: 'Standard Customer', color: 'bg-blue-100 text-blue-800' },
  { id: 'FORGETFUL', label: 'Forgetful Payer', color: 'bg-amber-100 text-amber-800' },
  { id: 'HIGH_RISK', label: 'High Risk / Defaulter', color: 'bg-rose-100 text-rose-800' }
];

// --- DETERMINISTIC AUTOMATION TEMPLATES ---
export const AUTOMATION_TEMPLATES = {
    ORDER_CONFIRMATION: (name: string, items: string, total: number, months: number, milestones: string, token: string) => 
        `Dear ${name}, thank you for choosing AuraGold. We are pleased to share the details and payment schedule for your order of ${items}.\n\nTotal Order Value: ₹${total.toLocaleString()}\nPayment Terms: ${months} Months Installment\n\nPayment Milestones:\n${milestones}\n\nYou can view the detailed breakdown and track your order progress here: order.auragoldelite.com/token=${token}\nIt is a privilege to craft this piece for you.`,
    
    PAYMENT_DUE_TODAY: (name: string, amount: number, orderId: string) => 
        `Hello ${name}, a gentle reminder that your scheduled payment of ₹${amount.toLocaleString()} for Order #${orderId} is due today. Timely payment helps maintain your Gold Rate Protection benefit.`,
    
    PAYMENT_OVERDUE: (name: string, amount: number, date: string) => 
        `Dear ${name}, we missed your payment of ₹${amount.toLocaleString()} which was due on ${new Date(date).toLocaleDateString()}. Please clear this at your earliest convenience to keep your order active.`,
    
    GOLD_RATE_WARNING: (name: string, amount: number) => 
        `⚠️ Urgent: Dear ${name}, your Gold Rate Protection is at risk of lapsing due to the overdue payment of ₹${amount.toLocaleString()}. Please clear dues immediately to avoid repricing at current higher market rates.`,
        
    STATUS_UPDATE: (name: string, item: string, status: string, token: string) => 
        `Update for ${name}: Your ${item} has moved to the '${status}' stage! Our craftsmen are ensuring perfection. Track live status here: order.auragoldelite.com/token=${token}`,

    // Multi-Language Warning Cycle
    GRACE_WARNING_1: (name: string, amount: number) => 
        `[URGENT] Dear ${name}, your payment of ₹${amount} is critically overdue. Protection lapses in a few hours. Pay Now to save rate.`,
    
    GRACE_WARNING_2: (name: string, amount: number) => 
        `नमस्ते ${name}, आपकी ₹${amount} की पेमेंट बाकी है। गोल्ड रेट सुरक्षा समाप्त होने वाली है। कृपया तुरंत भुगतान करें।`,
        
    GRACE_WARNING_3: (name: string, amount: number) => 
        `Attention ${name}: Final hours to save your Gold Rate Booking. Pay ₹${amount} immediately via UPI to avoid contract cancellation.`,
        
    GRACE_WARNING_4: (name: string, amount: number) => 
        `LAST REMINDER: ${name}, do not ignore. Pay ₹${amount} or order will be re-calculated at today's high gold rate.`,

    // Lapse & Follow-up
    PROTECTION_LAPSED: (name: string, token: string) => 
        `NOTICE: Dear ${name}, due to non-payment, your Gold Rate Protection has LAPSED. Your order is now floating at market price. Select action: order.auragoldelite.com/token=${token}`,
        
    // Dynamic Quotation on Lapse Event
    LAPSE_DYNAMIC_QUOTE: (name: string, oldTotal: number, newTotal: number, currentRate: number, token: string) => 
        `[ACTION REQUIRED] ${name}, your order value has increased due to lapse.\n\n📉 Old Locked Price: ₹${oldTotal.toLocaleString()}\n📈 New Market Price: ₹${newTotal.toLocaleString()} (@ ₹${currentRate}/g)\n\nThis quote is valid for 1 hour. Options:\n1. REPOPULATE: Accept new rate & continue payment plan.\n2. REFUND: Cancel order.\n\nClick to Decide: order.auragoldelite.com/token=${token}`
};

export const INITIAL_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: 't0',
    name: 'welcome_initiate',
    content: "Hello {{name}}, welcome to AuraGold! We are excited to assist you with your jewelry journey. How can we help you today?",
    tactic: 'EMPATHY',
    targetProfile: 'REGULAR',
    isAiGenerated: false,
    source: 'LOCAL',
    category: 'MARKETING'
  },
  {
    id: 't1',
    name: 'gentle_nudge_vip',
    content: "Hello {{name}}, we hope you're enjoying your day! Just a small reminder about your upcoming installment of ₹{{amount}}. We appreciate your consistent trust in AuraGold.",
    tactic: 'EMPATHY',
    targetProfile: 'VIP',
    isAiGenerated: false,
    source: 'LOCAL',
    category: 'UTILITY'
  },
  {
    id: 't2',
    name: 'rate_protection_warning',
    content: "Dear {{name}}, urgent reminder: Your Gold Rate Protection expires in 24 hours if the payment of ₹{{amount}} isn't cleared. Don't lose your locked-in rate!",
    tactic: 'LOSS_AVERSION',
    targetProfile: 'HIGH_RISK',
    isAiGenerated: false,
    source: 'LOCAL',
    category: 'UTILITY'
  }
];

export const REQUIRED_SYSTEM_TEMPLATES = [
  {
    name: 'auragold_order_confirmation',
    description: 'Sent immediately when an order is created.',
    category: 'UTILITY',
    variables: ['customer_name', 'order_id', 'total_amount', 'tracking_token'],
    content: "Hello {{1}}, thank you for shopping with AuraGold! Your order {{2}} ({{3}}) has been placed. Track your order here: https://order.auragoldelite.com/token={{4}} for details.",
    examples: ["John Doe", "ORD-12345", "₹50,000", "AbCd123"]
  },
  {
    name: 'auragold_payment_request',
    description: 'Sent when a scheduled payment is due.',
    category: 'UTILITY',
    variables: ['customer_name', 'amount_due', 'due_date', 'payment_token'],
    content: "Dear {{1}}, a gentle reminder that your payment of {{2}} is due by {{3}}. Please complete the payment securely using this link: https://order.auragoldelite.com/token={{4}} securely.",
    examples: ["Sarah", "₹12,500", "25 Oct 2023", "XyZ987"]
  },
  {
    name: 'auragold_production_update',
    description: 'Sent when the jewelry status changes.',
    category: 'UTILITY',
    variables: ['customer_name', 'item_category', 'new_status', 'tracking_token'],
    content: "Great news {{1}}! Your {{2}} has moved to the {{3}} stage. See photos and updates here: https://order.auragoldelite.com/token={{4}} on portal.",
    examples: ["Michael", "Ring", "Quality Check", "LmNoP456"]
  }
];
