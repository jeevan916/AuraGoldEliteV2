
import { GlobalSettings, PaymentPlanTemplate, WhatsAppTemplate, CatalogItem, SystemTrigger, MetaCategory, AppTemplateGroup } from './types';

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
  currentSilverRate: 90, // Default Silver Rate (1g)
  defaultTaxRate: 3,
  goldRateProtectionMax: 500,
  gracePeriodHours: 24, // Default 24 hours grace
  followUpIntervalDays: 3, // Default follow up every 3 days
  goldRateFetchIntervalMinutes: 60, // Default 60 mins
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
  'Ring', 'Necklace', 'Earrings', 'Bracelet', 'Bangle', 'Pendant', 'Chain', 'Mangalsutra', 'Set', 'Coins', 'Kada', 'Silverware'
];

export const PURITY_OPTIONS = ['22K', '24K', '18K', '999', '925'];

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
    }
];

export const SYSTEM_TRIGGER_MAP: SystemTrigger[] = [
    { id: 'TRIG_1', label: '1. Order Created', description: 'Includes rate protection & agreement button.', requiredVariables: ['Customer Name', 'Item Name', 'Total Value', 'Terms', 'Schedule List', 'Token'], defaultTemplateName: 'auragold_order_agreement', appGroup: 'ORDER_STATUS' },
    { id: 'TRIG_2', label: '2. Weight Updated', description: 'Sent after production edit.', requiredVariables: ['Customer Name', 'Item Name', 'New Weight', 'Old Weight', 'Value Change'], defaultTemplateName: 'auragold_weight_update', appGroup: 'ORDER_STATUS' },
    { id: 'TRIG_3', label: '3. Order Revised', description: 'After recalculation button press.', requiredVariables: ['Customer Name', 'Order ID', 'New Total', 'Reason', 'Link'], defaultTemplateName: 'auragold_order_revised', appGroup: 'ORDER_STATUS' },
    { id: 'TRIG_4', label: '4. Store Payment', description: 'Cash/Card/Old Gold receipt.', requiredVariables: ['Customer Name', 'Amount', 'Mode', 'Order ID', 'Balance'], defaultTemplateName: 'auragold_payment_receipt_store', appGroup: 'PAYMENT_COLLECTION' },
    { id: 'TRIG_5', label: '5. Stage Update', description: 'Moved to Processing/Hallmarking/etc.', requiredVariables: ['Customer Name', 'Item', 'Order ID', 'New Stage', 'Link'], defaultTemplateName: 'auragold_production_update', appGroup: 'ORDER_STATUS' },
    { id: 'TRIG_6', label: '6. Remote Payment Success', description: 'Success for Payment Link/Gateway.', requiredVariables: ['Customer Name', 'Amount', 'Method', 'Order ID', 'Balance'], defaultTemplateName: 'auragold_payment_success_remote', appGroup: 'PAYMENT_COLLECTION' },
    { id: 'TRIG_7', label: '7. Market Adjustment', description: 'Surcharge applied (Limit Breached).', requiredVariables: ['Customer Name', 'Surcharge Amount', 'Order ID', 'New Base Rate', 'Link'], defaultTemplateName: 'auragold_rate_adjustment_alert', appGroup: 'SYSTEM_NOTIFICATIONS' },
    { id: 'TRIG_8', label: '8. Setu UPI Button', description: 'Manual deep link trigger.', requiredVariables: ['Customer Name', 'Amount', 'LinkSuffix'], defaultTemplateName: 'setu_payment_button', appGroup: 'SETU_PAYMENT' },
    { id: 'TRIG_9', label: '9. Finished Photo', description: 'Header Image + Order Link.', requiredVariables: ['Customer Name', 'Order ID', 'Link'], defaultTemplateName: 'auragold_finished_item_showcase', appGroup: 'ORDER_STATUS' }
];

// --- CORE SYSTEM TEMPLATES (THE 9 MANDATORY ONES) ---
export const REQUIRED_SYSTEM_TEMPLATES = [
  // 1) Order Created (Agreement)
  {
    name: 'auragold_order_agreement',
    description: 'Sent on creation. Includes Rate Protection details and Payment Schedule.',
    category: 'UTILITY',
    appGroup: 'ORDER_STATUS',
    variables: ['customer_name', 'item_name', 'total_value', 'payment_terms', 'schedule_list', 'token_link'],
    content: "Dear {{1}}, thank you for choosing AuraGold. We are pleased to share the details and payment schedule for your order of {{2}}.\n\nTotal Order Value: ₹{{3}} (rate protection limited)\nPayment Terms: {{4}}\n\nPayment Schedule:\n{{5}}\n\nYou can view the detailed breakdown and track your order progress here: https://order.auragoldelite.com/?token={{6}}\n\n!!!Pay your payments ON Time to prevent Gold Rate Protection Lapses!!!",
    examples: ["John", "Ring", "80,772.6", "3 Months Installment", "1. 6 Jan: ₹16,155\n2. 6 Feb: ₹21,539", "1q648vdxmjn"]
  },
  // 2) Weight Changed
  {
    name: 'auragold_weight_update',
    description: 'Sent when item weight is edited post-production.',
    category: 'UTILITY',
    appGroup: 'ORDER_STATUS',
    variables: ['customer_name', 'item_name', 'new_weight', 'old_weight', 'value_change'],
    content: "Update for {{1}}: The actual production weight for {{2}} is {{3}}g (Estimated: {{4}}g). Net value change: ₹{{5}}. We have updated your final invoice accordingly.",
    examples: ["Sarah", "Ring", "4.2", "3.8", "2500"]
  },
  // 3) Recalculate
  {
    name: 'auragold_order_revised',
    description: 'Sent when recalculate button is pressed.',
    category: 'UTILITY',
    appGroup: 'ORDER_STATUS',
    variables: ['customer_name', 'order_id', 'new_total', 'reason', 'token_link'],
    content: "Dear {{1}}, your Order {{2}} has been revised. New Total: ₹{{3}}. Reason: {{4}}. View updated details here: https://order.auragoldelite.com/?token={{5}}",
    examples: ["Raj", "ORD-99", "55000", "Weight Adjustment", "XyZ789"]
  },
  // 4) Payment Received (Store)
  {
    name: 'auragold_payment_receipt_store',
    description: 'Cash/Card/Old Gold receipt at store.',
    category: 'UTILITY',
    appGroup: 'PAYMENT_COLLECTION',
    variables: ['customer_name', 'amount_paid', 'payment_mode', 'order_id', 'balance_remaining'],
    content: "Dear {{1}}, Receipt: We received ₹{{2}} via {{3}} for Order {{4}}. Thank you for visiting! Remaining Balance: ₹{{5}}.",
    examples: ["Priya", "20000", "Cash", "ORD-123", "5000"]
  },
  // 5) Stage Update
  {
    name: 'auragold_production_update',
    description: 'Moved to next stage (Processing, Ready, etc).',
    category: 'UTILITY',
    appGroup: 'ORDER_STATUS',
    variables: ['customer_name', 'item_name', 'order_id', 'new_stage', 'token_link'],
    content: "Status Update {{1}}: Your {{2}} (Order {{3}}) has moved to: {{4}}. Track progress: https://order.auragoldelite.com/?token={{5}}",
    examples: ["Amit", "Necklace", "ORD-55", "Hallmarking", "AbC999"]
  },
  // 6) Remote Payment Success
  {
    name: 'auragold_payment_success_remote',
    description: 'Success for Setu/Razorpay.',
    category: 'UTILITY',
    appGroup: 'PAYMENT_COLLECTION',
    variables: ['customer_name', 'amount', 'method', 'order_id', 'balance_remaining'],
    content: "Dear {{1}}, Payment Confirmed! We received ₹{{2}} via {{3}} against Order {{4}}. Your new balance is ₹{{5}}.",
    examples: ["Sneha", "5000", "UPI", "ORD-22", "10000"]
  },
  // 7) Market Adjustment (Surcharge)
  {
    name: 'auragold_rate_adjustment_alert',
    description: 'Triggered when protection limit is breached.',
    category: 'UTILITY',
    appGroup: 'SYSTEM_NOTIFICATIONS',
    variables: ['customer_name', 'surcharge_amount', 'order_id', 'new_base_rate', 'token_link'],
    content: "Important {{1}}: Market Gold Rate exceeded protection limit. An adjustment of ₹{{2}} is applied to Order {{3}}. New Base Rate: ₹{{4}}/g. Details: https://order.auragoldelite.com/?token={{5}}",
    examples: ["Rahul", "1500", "ORD-77", "6800", "Lmn456"]
  },
  // 8) Setu UPI Button (Manual)
  {
    name: 'setu_payment_button',
    description: 'Manual trigger for UPI Deep Link.',
    category: 'UTILITY',
    appGroup: 'SETU_PAYMENT',
    variables: ['customer_name', 'amount', 'link_suffix'],
    content: "Dear {{1}}, please pay ₹{{2}} securely using the UPI button below.",
    examples: ["Aditi", "15000", "hz83jd"],
    structure: [
        { type: "BODY", text: "Dear {{1}}, please pay ₹{{2}} securely using the UPI button below." },
        { type: "BUTTONS", buttons: [{ type: "URL", text: "Pay Now", url: "https://setu.co/upi/s/{{1}}" }] }
    ]
  },
  // 9) Finished Photo Upload
  {
    name: 'auragold_finished_item_showcase',
    description: 'Sends header image + order link.',
    category: 'UTILITY',
    appGroup: 'ORDER_STATUS',
    variables: ['customer_name', 'order_id', 'token_link'],
    content: "Your jewelry is ready {{1}}! Check out the finished look for Order {{2}}. We are ready for handover.",
    examples: ["Karan", "ORD-88", "OpQ123"],
    structure: [
        { type: "HEADER", format: "IMAGE" },
        { type: "BODY", text: "Your jewelry is ready {{1}}! Check out the finished look for Order {{2}}. We are ready for handover." },
        { type: "BUTTONS", buttons: [{ type: "URL", text: "View Order", url: "https://order.auragoldelite.com/?token={{1}}" }] }
    ]
  }
];

export const INITIAL_TEMPLATES: WhatsAppTemplate[] = REQUIRED_SYSTEM_TEMPLATES.map(req => ({
    id: `sys-${req.name}`,
    name: req.name,
    content: req.content,
    category: req.category as MetaCategory,
    appGroup: req.appGroup as AppTemplateGroup,
    source: 'LOCAL',
    status: 'APPROVED',
    isAiGenerated: false,
    tactic: 'AUTHORITY',
    targetProfile: 'REGULAR',
    variableExamples: req.examples,
    structure: (req as any).structure
}));
