
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
  defaultTaxRate: 3,
  goldRateProtectionMax: 500,
  gracePeriodHours: 24, // Default 24 hours grace
  followUpIntervalDays: 3, // Default follow up every 3 days
  whatsappPhoneNumberId: getEnv('VITE_WHATSAPP_PHONE_ID'),
  whatsappBusinessAccountId: getEnv('VITE_WHATSAPP_WABA_ID'),
  whatsappBusinessToken: getEnv('VITE_WHATSAPP_TOKEN'),
  setuClientId: '', // Initialized for V2
  setuSchemeId: '', // Maps to Product Instance ID
  setuSecret: ''
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

// --- COMPLIANCE ENGINE: RECOVERY TEMPLATES ---
export const RECOVERY_TEMPLATES = [
    {
        id: 'auragold_gentle_reminder',
        tone: 'POLITE',
        text: "Hello {{1}}, a gentle reminder that your installment of {{2}} for order {{3}} is due. Please pay here: {{4}} to avoid delays.",
        variables: ['Customer Name', 'Amount', 'Order ID', 'Link']
    },
    {
        id: 'auragold_payment_overdue',
        tone: 'FIRM',
        text: "Dear {{1}}, we noticed your payment of {{2}} is overdue. To maintain your gold rate protection, please clear the dues via: {{3}} today.",
        variables: ['Customer Name', 'Amount', 'Link']
    },
    {
        id: 'auragold_urgent_lapse',
        tone: 'URGENT',
        text: "URGENT {{1}}: Your Gold Rate Protection for order {{2}} expires in 24 hours. Pay {{3}} immediately to save your booked rate: {{4}}",
        variables: ['Customer Name', 'Order ID', 'Amount', 'Link']
    },
    {
        id: 'auragold_vip_nudge',
        tone: 'ENCOURAGING',
        text: "Namaste {{1}}, thank you for being a valued customer. Your jewelry is progressing well! A scheduled payment of {{2}} is coming up on {{3}}. View details: {{4}}",
        variables: ['Customer Name', 'Amount', 'Date', 'Link']
    },
    {
        id: 'setu_payment_link_v1',
        tone: 'FIRM',
        text: "Dear {{1}}, your payment of ₹{{2}} is due. Please use the secure UPI link below to pay immediately.",
        variables: ['Customer Name', 'Amount']
    }
];

export const SYSTEM_TRIGGER_MAP: SystemTrigger[] = [
    { id: 'TRIG_1', label: 'Order Created', description: 'Sent immediately after booking.', requiredVariables: ['Customer Name', 'Order ID', 'Total Amount', 'Token'], defaultTemplateName: 'auragold_order_confirmation', appGroup: 'ORDER_STATUS' },
    { id: 'TRIG_2', label: 'Status Update', description: 'Jewelry stage change (e.g. Polishing).', requiredVariables: ['Customer Name', 'Item Category', 'New Status', 'Token'], defaultTemplateName: 'auragold_production_update', appGroup: 'ORDER_STATUS' },
    { id: 'TRIG_3', label: 'Payment Receipt', description: 'Sent when payment is recorded.', requiredVariables: ['Customer Name', 'Amount Paid', 'Balance Remaining'], defaultTemplateName: 'auragold_payment_receipt', appGroup: 'PAYMENT_COLLECTION' },
    { id: 'TRIG_4', label: 'Payment Request', description: 'Scheduled manual or auto request.', requiredVariables: ['Customer Name', 'Amount Due', 'Due Date', 'Link'], defaultTemplateName: 'auragold_payment_request', appGroup: 'PAYMENT_COLLECTION' },
    { id: 'TRIG_5', label: 'Grace Warning', description: 'Urgent nudge before lapse.', requiredVariables: ['Customer Name', 'Amount Due', 'Hours Left'], defaultTemplateName: 'auragold_grace_warning', appGroup: 'PAYMENT_COLLECTION' },
    { id: 'TRIG_6', label: 'Protection Lapsed', description: 'Contract violation notice.', requiredVariables: ['Customer Name', 'Order ID', 'Link'], defaultTemplateName: 'auragold_protection_lapsed', appGroup: 'SYSTEM_NOTIFICATIONS' },
    { id: 'TRIG_7', label: 'Lapse Quote', description: 'New market rate offer post-lapse.', requiredVariables: ['Customer Name', 'Old Price', 'New Price', 'Rate', 'Link'], defaultTemplateName: 'auragold_lapse_quote', appGroup: 'PAYMENT_COLLECTION' },
    { id: 'TRIG_8', label: 'Refund/Cancel', description: 'Order cancellation notice.', requiredVariables: ['Customer Name', 'Refund Amount', 'Order ID'], defaultTemplateName: 'auragold_refund_processed', appGroup: 'GENERAL_SUPPORT' },
    { id: 'TRIG_9', label: 'Setu UPI Request', description: 'DeepLink for direct UPI payment.', requiredVariables: ['Customer Name', 'Amount Due', 'Link ID'], defaultTemplateName: 'setu_payment_button', appGroup: 'SETU_PAYMENT' }
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

// --- CORE SYSTEM TEMPLATES FOR AUTO-HEAL ---
export const REQUIRED_SYSTEM_TEMPLATES = [
  {
    name: 'auragold_order_confirmation',
    description: 'Sent immediately when an order is created.',
    category: 'UTILITY',
    appGroup: 'ORDER_STATUS',
    variables: ['customer_name', 'order_id', 'total_amount', 'tracking_token'],
    content: "Hello {{1}}, thank you for shopping with AuraGold! Your order {{2}} ({{3}}) has been placed. Track your order here: https://order.auragoldelite.com/?token={{4}} for details.",
    examples: ["John Doe", "ORD-12345", "₹50,000", "AbCd123"]
  },
  {
    name: 'auragold_payment_request',
    description: 'Sent when a scheduled payment is due.',
    category: 'UTILITY',
    appGroup: 'PAYMENT_COLLECTION',
    variables: ['customer_name', 'amount_due', 'due_date', 'payment_token'],
    content: "Dear {{1}}, a gentle reminder that your payment of {{2}} is due by {{3}}. Please complete the payment securely using this link: https://order.auragoldelite.com/?token={{4}} securely.",
    examples: ["Sarah", "₹12,500", "25 Oct 2023", "XyZ987"]
  },
  {
    name: 'setu_payment_button',
    description: 'Compliant Setu payment template with dynamic UPI button.',
    category: 'UTILITY',
    appGroup: 'SETU_PAYMENT',
    variables: ['customer_name', 'amount_due'],
    content: "Dear {{1}}, your payment of ₹{{2}} is due. Click below to pay securely via UPI.",
    examples: ["Aditi", "15,000"],
    structure: [
        { 
            type: "BODY", 
            text: "Dear {{1}}, your payment of ₹{{2}} is due. Click below to pay securely via UPI." 
        },
        { 
            type: "BUTTONS", 
            buttons: [
                { 
                    type: "URL", 
                    text: "Pay Now", 
                    url: "https://setu.co/upi/s/{{1}}" 
                } 
            ]
        }
    ]
  },
  {
    name: 'auragold_production_update',
    description: 'Sent when the jewelry status changes.',
    category: 'UTILITY',
    appGroup: 'ORDER_STATUS',
    variables: ['customer_name', 'item_category', 'new_status', 'tracking_token'],
    content: "Great news {{1}}! Your {{2}} has moved to the {{3}} stage. See photos and updates here: https://order.auragoldelite.com/?token={{4}} on portal.",
    examples: ["Michael", "Ring", "Quality Check", "LmNoP456"]
  },
  {
    name: 'auragold_grace_warning',
    description: 'Critical warning sent hours before lapse.',
    category: 'UTILITY',
    appGroup: 'PAYMENT_COLLECTION',
    variables: ['customer_name', 'amount_due', 'hours_left'],
    content: "Dear {{1}}, payment of ₹{{2}} is pending. Your Gold Rate Protection expires in {{3}} hours. Please complete payment to retain your booked rate.",
    examples: ["Aditi", "12500", "4"]
  },
  {
    name: 'auragold_protection_lapsed',
    description: 'Sent when rate protection is revoked.',
    category: 'UTILITY',
    appGroup: 'SYSTEM_NOTIFICATIONS',
    variables: ['customer_name', 'order_id', 'action_link'],
    content: "Notice for {{1}}: Gold Rate Protection for Order {{2}} has LAPSED due to non-payment. Your order now floats at market price. Select action: https://order.auragoldelite.com/?token={{3}}",
    examples: ["Raj", "ORD-99", "abc12345"]
  }
];
