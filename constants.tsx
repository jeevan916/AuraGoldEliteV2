
import { GlobalSettings, PaymentPlanTemplate, WhatsAppTemplate } from './types';

// Helper to safely access environment variables in both Node and Browser
const getEnv = (key: string): string => {
  try {
    // Vite-style env access - casting to any to fix "Property 'env' does not exist on type 'ImportMeta'"
    if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env[key]) {
      return (import.meta as any).env[key];
    }
    // Node-style env access
    if (typeof process !== 'undefined' && process.env && (process.env as any)[key]) {
      return (process.env as any)[key] as string;
    }
  } catch (e) {
    // Silent fail for environment access
  }
  return '';
};

export const INITIAL_SETTINGS: GlobalSettings = {
  currentGoldRate24K: 7200,
  currentGoldRate22K: 6600,
  currentGoldRate18K: 5400,
  defaultTaxRate: 3,
  goldRateProtectionMax: 500,
  whatsappPhoneNumberId: getEnv('VITE_WHATSAPP_PHONE_ID'),
  whatsappBusinessAccountId: getEnv('VITE_WHATSAPP_WABA_ID'),
  whatsappBusinessToken: getEnv('VITE_WHATSAPP_TOKEN')
};

export const JEWELRY_CATEGORIES = [
  'Ring', 'Necklace', 'Earrings', 'Bracelet', 'Bangle', 'Pendant', 'Chain'
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
    content: "Hello {{1}}, thank you for shopping with AuraGold! Your order {{2}} ({{3}}) has been placed. Track your order here: https://auragold.com/view/{{4}} for details.",
    examples: ["John Doe", "ORD-12345", "₹50,000", "AbCd123"]
  },
  {
    name: 'auragold_payment_request',
    description: 'Sent when a scheduled payment is due.',
    category: 'UTILITY',
    variables: ['customer_name', 'amount_due', 'due_date', 'payment_token'],
    content: "Dear {{1}}, a gentle reminder that your payment of {{2}} is due by {{3}}. Please complete the payment securely using this link: https://auragold.com/pay/{{4}} securely.",
    examples: ["Sarah", "₹12,500", "25 Oct 2023", "XyZ987"]
  },
  {
    name: 'auragold_production_update',
    description: 'Sent when the jewelry status changes.',
    category: 'UTILITY',
    variables: ['customer_name', 'item_category', 'new_status', 'tracking_token'],
    content: "Great news {{1}}! Your {{2}} has moved to the {{3}} stage. See photos and updates here: https://auragold.com/status/{{4}} on portal.",
    examples: ["Michael", "Ring", "Quality Check", "LmNoP456"]
  }
];
