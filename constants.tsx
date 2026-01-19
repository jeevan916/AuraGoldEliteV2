
import { GlobalSettings, PaymentPlanTemplate, WhatsAppTemplate, CatalogItem, SystemTrigger } from './types';

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
  purityFactor22K: 0.916,
  purityFactor18K: 0.75,
  defaultTaxRate: 3,
  goldRateProtectionMax: 500,
  gracePeriodHours: 24,
  followUpIntervalDays: 3,
  whatsappPhoneNumberId: getEnv('VITE_WHATSAPP_PHONE_ID'),
  whatsappBusinessAccountId: getEnv('VITE_WHATSAPP_WABA_ID'),
  whatsappBusinessToken: getEnv('VITE_WHATSAPP_TOKEN'),
  setuClientId: '',
  setuSchemeId: '',
  setuSecret: ''
};

export const INITIAL_CATALOG: CatalogItem[] = [
  { id: 'c1', category: 'Ring', name: 'Standard Wedding Band', metalColor: 'Yellow Gold', purity: '22K', wastagePercentage: 12, makingChargesPerGram: 450, stoneCharges: 0 },
  { id: 'c2', category: 'Necklace', name: 'Antique Temple Haram', metalColor: 'Yellow Gold', purity: '22K', wastagePercentage: 18, makingChargesPerGram: 600, stoneCharges: 2500 },
];

export const JEWELRY_CATEGORIES = ['Ring', 'Necklace', 'Earrings', 'Bracelet', 'Bangle', 'Pendant', 'Chain', 'Mangalsutra', 'Set', 'Coins', 'Kada'];
export const PURITY_OPTIONS = ['22K', '24K', '18K'];

export const INITIAL_PLAN_TEMPLATES: PaymentPlanTemplate[] = [
  { id: 'p1', name: 'Short Term (3 Months)', months: 3, interestPercentage: 0, advancePercentage: 20, enabled: true },
  { id: 'p2', name: 'Standard (6 Months)', months: 6, interestPercentage: 5, advancePercentage: 15, enabled: true },
];

export const PSYCHOLOGICAL_TACTICS = [
  { id: 'LOSS_AVERSION', label: 'Loss Aversion', description: 'Emphasize losing Gold Rate Protection.' },
  { id: 'URGENCY', label: 'Urgency', description: 'Limited time to avoid release of item.' },
  { id: 'EMPATHY', label: 'Empathy', description: 'Gentle check-in for forgetful clients.' }
];

// --- ADDED MISSING RISK PROFILES ---
export const RISK_PROFILES = [
  { id: 'VIP', label: 'VIP Customer', description: 'High net worth, priority service.' },
  { id: 'REGULAR', label: 'Regular', description: 'Standard client profile.' },
  { id: 'FORGETFUL', label: 'Forgetful', description: 'Likely to miss deadlines but reliable.' },
  { id: 'HIGH_RISK', label: 'High Risk', description: 'Previous payment delays or new profile.' }
];

export const RECOVERY_TEMPLATES = [
    { id: 'auragold_gentle_reminder', tone: 'POLITE', text: "Hello {{1}}, installment of {{2}} for order {{3}} is due. Pay here: {{4}}", variables: ['Name', 'Amount', 'ID', 'Link'] },
];

// --- IMPROVED SYSTEM TRIGGER MAP ---
export const SYSTEM_TRIGGER_MAP: SystemTrigger[] = [
    { id: 'TRIG_1', label: 'Order Confirmation', description: 'Interactive receipt with tracking button.', requiredVariables: ['Name', 'ID', 'Total', 'Token'], defaultTemplateName: 'auragold_order_receipt', appGroup: 'ORDER_STATUS' },
    { id: 'TRIG_2', label: 'Payment Success', description: 'Acknowledgment with ledger link.', requiredVariables: ['Name', 'Amount', 'Balance', 'Token'], defaultTemplateName: 'auragold_payment_ack', appGroup: 'PAYMENT_COLLECTION' },
    { id: 'TRIG_3', label: 'Collection Request', description: 'One-tap UPI payment button.', requiredVariables: ['Name', 'Amount', 'LinkID'], defaultTemplateName: 'auragold_collection_link', appGroup: 'SETU_PAYMENT' },
    { id: 'TRIG_4', label: 'Production Ready', description: 'Collection notice with photo link.', requiredVariables: ['Name', 'Item', 'Token'], defaultTemplateName: 'auragold_item_ready', appGroup: 'ORDER_STATUS' }
];

// --- CORE SYSTEM TEMPLATES WITH INTERACTIVE BUTTONS ---
export const REQUIRED_SYSTEM_TEMPLATES = [
  {
    name: 'auragold_order_receipt',
    description: 'Booking confirmation with Track Order button.',
    category: 'UTILITY',
    appGroup: 'ORDER_STATUS',
    examples: ["Aditi", "ORD-101", "₹75,000", "ABC123"],
    content: "Namaste {{1}}! Your booking for Order {{2}} ({{3}}) is confirmed at AuraGold. You can track your design progress and payment schedule using the link below.",
    structure: [
        { type: "BODY", text: "Namaste {{1}}! Your booking for Order {{2}} ({{3}}) is confirmed at AuraGold. You can track your design progress and payment schedule using the link below." },
        { type: "BUTTONS", buttons: [{ type: "URL", text: "Track Design Progress", url: "https://order.auragoldelite.com/?token={{1}}" }] }
    ]
  },
  {
    name: 'auragold_payment_ack',
    description: 'Payment confirmation with View Ledger button.',
    category: 'UTILITY',
    appGroup: 'PAYMENT_COLLECTION',
    examples: ["John", "₹15,000", "₹40,000", "ABC123"],
    content: "Receipt: ₹{{2}} received for Order. Your updated balance is ₹{{3}}. Thank you for choosing AuraGold!",
    structure: [
        { type: "BODY", text: "Receipt: ₹{{2}} received for Order. Your updated balance is ₹{{3}}. Thank you for choosing AuraGold!" },
        { type: "BUTTONS", buttons: [{ type: "URL", text: "View Digital Ledger", url: "https://order.auragoldelite.com/?token={{1}}" }] }
    ]
  },
  {
    name: 'auragold_collection_link',
    description: 'Direct UPI payment button via Setu.',
    category: 'UTILITY',
    appGroup: 'SETU_PAYMENT',
    examples: ["Sarah", "₹12,500", "upi_link_suffix"],
    content: "Hello {{1}}, an installment of ₹{{2}} is due. Tap below to pay securely via any UPI app (GPay/PhonePe).",
    structure: [
        { type: "BODY", text: "Hello {{1}}, an installment of ₹{{2}} is due. Tap below to pay securely via any UPI app (GPay/PhonePe)." },
        { type: "BUTTONS", buttons: [{ type: "URL", text: "Pay via UPI", url: "https://setu.co/upi/s/{{1}}" }] }
    ]
  },
  {
      name: 'auragold_item_ready',
      description: 'Handover notification.',
      category: 'UTILITY',
      appGroup: 'ORDER_STATUS',
      examples: ["Raj", "Wedding Set", "ABC123"],
      content: "Great news {{1}}! Your {{2}} is ready for handover. Please visit our boutique or schedule a delivery via the portal.",
      structure: [
          { type: "BODY", text: "Great news {{1}}! Your {{2}} is ready for handover. Please visit our boutique or schedule a delivery via the portal." },
          { type: "BUTTONS", buttons: [{ type: "URL", text: "View Ready Item", url: "https://order.auragoldelite.com/?token={{1}}" }] }
      ]
  }
];

// --- ADDED MISSING INITIAL TEMPLATES ---
export const INITIAL_TEMPLATES: WhatsAppTemplate[] = REQUIRED_SYSTEM_TEMPLATES.map((t, idx) => ({
    id: `sys-${idx}`,
    name: t.name,
    content: t.content,
    tactic: 'AUTHORITY',
    targetProfile: 'REGULAR',
    isAiGenerated: false,
    source: 'LOCAL',
    category: t.category as any,
    appGroup: t.appGroup as any,
    variableExamples: t.examples,
    structure: t.structure
}));
