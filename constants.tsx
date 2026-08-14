
import { GlobalSettings, PaymentPlanTemplate, WhatsAppTemplate, SystemTrigger, MetaCategory, AppTemplateGroup } from './types';

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
  preferredRateProvider: 'auto', // Default: Auto (Priority List)
  karigars: [],
  whatsappPhoneNumberId: getEnv('VITE_WHATSAPP_PHONE_ID'),
  whatsappBusinessAccountId: getEnv('VITE_WHATSAPP_WABA_ID'),
  whatsappBusinessToken: getEnv('VITE_WHATSAPP_TOKEN'),
  setuClientId: '', // Initialized for V2
  setuSchemeId: '', // Maps to Product Instance ID
  setuSecret: '',
  setuMode: 'PRODUCTION',
  breachBufferMinutes: 30,
  cooldownHours: 24,
  reminderScheduleDays: [15, 7, 3],
  overdueFrequencyDays: 2,
  maxRemindersPerMilestone: 5
};

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
  // Range: 10,000 to 50,000 (Subvented Starter Bracket)
  { 
    id: 'p1', 
    name: 'Starter Zero-Cost (3 Months)', 
    months: 3, 
    interestPercentage: 0, 
    advancePercentage: 10, 
    minPurchaseAmount: 10000, 
    maxPurchaseAmount: 50000, 
    subventionPercentage: 3, 
    subventionNote: 'Merchant Subvented Flow: 3% fee absorbed by merchant for low purchase segment',
    enabled: true 
  },
  { 
    id: 'p2', 
    name: 'Budget Flex (6 Months)', 
    months: 6, 
    interestPercentage: 3, 
    advancePercentage: 15, 
    minPurchaseAmount: 10000, 
    maxPurchaseAmount: 50000, 
    subventionPercentage: 2, 
    subventionNote: '2% Subvention Discount Applied',
    enabled: true 
  },
  { 
    id: 'p3', 
    name: 'Easy Saver (9 Months)', 
    months: 9, 
    interestPercentage: 4, 
    advancePercentage: 20, 
    minPurchaseAmount: 10000, 
    maxPurchaseAmount: 50000, 
    subventionPercentage: 1.5, 
    subventionNote: 'Subvented 1.5% for 9-month budget buyers',
    enabled: true 
  },
  // Range: 50,001 to 1,20,000 (Mid-Range Jewelry Bracket)
  { 
    id: 'p4', 
    name: 'Gold Value Special (6 Months)', 
    months: 6, 
    interestPercentage: 2, 
    advancePercentage: 15, 
    minPurchaseAmount: 50001, 
    maxPurchaseAmount: 120000, 
    subventionPercentage: 2, 
    subventionNote: 'Mid-Tier Subvention Offer for Orders ₹50k - ₹120k',
    enabled: true 
  },
  { 
    id: 'p5', 
    name: 'Standard Gold EMI (9 Months)', 
    months: 9, 
    interestPercentage: 3.5, 
    advancePercentage: 20, 
    minPurchaseAmount: 50001, 
    maxPurchaseAmount: 120000, 
    subventionPercentage: 1, 
    subventionNote: '1% Merchant Subvention',
    enabled: true 
  },
  { 
    id: 'p6', 
    name: 'Annual Gold Smart (12 Months)', 
    months: 12, 
    interestPercentage: 5, 
    advancePercentage: 10, 
    minPurchaseAmount: 50001, 
    maxPurchaseAmount: 120000, 
    subventionPercentage: 1.5, 
    subventionNote: '1.5% Merchant Rate Support',
    enabled: true 
  },
  // Range: 1,20,001+ (High Value VIP Segment)
  { 
    id: 'p7', 
    name: 'VIP High-Value Royal (12 Months)', 
    months: 12, 
    interestPercentage: 4, 
    advancePercentage: 10, 
    minPurchaseAmount: 120001, 
    maxPurchaseAmount: 0, 
    subventionPercentage: 2.5, 
    subventionNote: 'Exclusive VIP Subvention for Purchases > ₹1,20,000',
    enabled: true 
  },
  { 
    id: 'p8', 
    name: 'Diamond Heritage Flex (18 Months)', 
    months: 18, 
    interestPercentage: 6, 
    advancePercentage: 15, 
    minPurchaseAmount: 120001, 
    maxPurchaseAmount: 0, 
    subventionPercentage: 2, 
    subventionNote: 'Long-term High Ticket Subvention',
    enabled: true 
  }
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
    { id: 'TRIG_8', label: '8. Setu UPI Button', description: 'Manual deep link trigger.', requiredVariables: ['Customer Name', 'Amount', 'LinkSuffix'], defaultTemplateName: 'auragold_setu_payment', appGroup: 'SETU_PAYMENT' },
    { id: 'TRIG_9', label: '9. Finished Photo', description: 'Header Image + Order Link.', requiredVariables: ['Customer Name', 'Order ID', 'Link'], defaultTemplateName: 'auragold_finished_item_showcase', appGroup: 'ORDER_STATUS' },
    { id: 'TRIG_10', label: '10. Gentle Reminder', description: 'Gentle reminder for upcoming payment.', requiredVariables: ['Customer Name', 'Amount', 'Order ID', 'Link'], defaultTemplateName: 'auragold_gentle_reminder', appGroup: 'PAYMENT_COLLECTION' },
    { id: 'TRIG_11', label: '11. Payment Overdue', description: 'Firm reminder for overdue payment.', requiredVariables: ['Customer Name', 'Amount', 'Link'], defaultTemplateName: 'auragold_payment_overdue', appGroup: 'PAYMENT_COLLECTION' },
    { id: 'TRIG_12', label: '12. Urgent Lapse', description: 'Urgent reminder before rate protection lapses.', requiredVariables: ['Customer Name', 'Order ID', 'Amount', 'Link'], defaultTemplateName: 'auragold_urgent_lapse', appGroup: 'PAYMENT_COLLECTION' },
    { id: 'TRIG_13', label: '13. Liability Adjustment', description: 'Surcharge applied (Limit Breached & Milestone Missed).', requiredVariables: ['Customer Name', 'Surcharge Amount', 'Order ID', 'New Base Rate', 'Link'], defaultTemplateName: 'auragold_rate_adjustment_liability', appGroup: 'SYSTEM_NOTIFICATIONS' },
    { id: 'TRIG_14', label: '14. Rate Stabilized', description: 'Gold rate falls back under protection limit.', requiredVariables: ['Customer Name', 'Surcharge Amount', 'Order ID', 'New Base Rate', 'Link'], defaultTemplateName: 'auragold_rate_stabilized', appGroup: 'SYSTEM_NOTIFICATIONS' },
    { id: 'TRIG_15', label: '15. Handover Confirmation', description: 'Sent on order completion and handover.', requiredVariables: ['Customer Name', 'Order ID', 'Items List', 'Savings Amount', 'Link'], defaultTemplateName: 'auragold_order_delivered', appGroup: 'ORDER_STATUS' }
];

// --- CORE SYSTEM TEMPLATES (THE 14 MANDATORY ONES) ---
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
    content: "Important update for {{1}}: We would like to inform you that the actual production weight for your {{2}} has been finalized. The final weight is {{3}}g, compared to the initial estimated weight of {{4}}g. This results in a net value change of ₹{{5}}. We have updated your final invoice accordingly to reflect this adjustment.",
    examples: ["Sarah", "Ring", "4.2", "3.8", "2500"]
  },
  // 3) Recalculate
  {
    name: 'auragold_order_revised',
    description: 'Sent when recalculate button is pressed.',
    category: 'UTILITY',
    appGroup: 'ORDER_STATUS',
    variables: ['customer_name', 'order_id', 'new_total', 'reason', 'token_link'],
    content: "Dear {{1}}, we are writing to inform you that your Order {{2}} has been successfully revised in our system. The new total amount for your order is now ₹{{3}}. This adjustment was made due to the following reason: {{4}}. You can view your updated order details and track its progress securely by clicking here: https://order.auragoldelite.com/?token={{5}}",
    examples: ["Raj", "ORD-99", "55000", "Weight Adjustment", "XyZ789"]
  },
  // 4) Payment Received (Store) - FIXED for Meta Ratio Policy
  {
    name: 'auragold_payment_receipt_store',
    description: 'Cash/Card/Old Gold receipt at store.',
    category: 'UTILITY',
    appGroup: 'PAYMENT_COLLECTION',
    variables: ['customer_name', 'amount_paid', 'payment_mode', 'order_id', 'balance_remaining'],
    content: "Hello {{1}}, this is an official receipt from AuraGold. We acknowledge receiving a payment of ₹{{2}} via {{3}} towards your Order ID {{4}}. Thank you for visiting our store. Your remaining outstanding balance is ₹{{5}}.",
    examples: ["Priya", "20000", "Cash", "ORD-123", "5000"]
  },
  // 5) Stage Update - FIXED for Meta Ratio Policy
  {
    name: 'auragold_production_update',
    description: 'Moved to next stage (Processing, Ready, etc).',
    category: 'UTILITY',
    appGroup: 'ORDER_STATUS',
    variables: ['customer_name', 'item_name', 'order_id', 'new_stage', 'token_link'],
    content: "Hello {{1}}, we have an update regarding your item {{2}} under Order ID {{3}}. The production status has now moved to the {{4}} stage. You can view the detailed progress tracking here: https://order.auragoldelite.com/?token={{5}}",
    examples: ["Amit", "Necklace", "ORD-55", "Hallmarking", "AbC999"]
  },
  // 6) Remote Payment Success - FIXED for Meta Ratio Policy
  {
    name: 'auragold_payment_success_remote',
    description: 'Success for Setu/Razorpay.',
    category: 'UTILITY',
    appGroup: 'PAYMENT_COLLECTION',
    variables: ['customer_name', 'amount', 'method', 'order_id', 'balance_remaining'],
    content: "Dear {{1}}, your secure payment has been successfully confirmed. We have received ₹{{2}} via {{3}} for your Order ID {{4}}. Your ledger has been updated. The new remaining balance is ₹{{5}}.",
    examples: ["Sneha", "5000", "UPI", "ORD-22", "10000"]
  },
  // 7) Market Adjustment (Surcharge)
  {
    name: 'auragold_rate_adjustment_alert',
    description: 'Triggered when protection limit is breached.',
    category: 'UTILITY',
    appGroup: 'SYSTEM_NOTIFICATIONS',
    variables: ['customer_name', 'surcharge_amount', 'order_id', 'new_base_rate', 'token_link'],
    content: "Important notice for {{1}}: We are writing to inform you that the current market gold rate has unfortunately exceeded your agreed protection limit. As a result, a necessary adjustment surcharge of ₹{{2}} has been applied to your Order {{3}}. The new base rate for your order is now ₹{{4}}/g. You can review these changes and your updated order details securely here: https://order.auragoldelite.com/?token={{5}}",
    examples: ["Rahul", "1500", "ORD-77", "6800", "Lmn456"]
  },
  // 8) Setu UPI Button (Manual)
  {
    name: 'auragold_setu_payment',
    description: 'Manual trigger for UPI Deep Link.',
    category: 'UTILITY',
    appGroup: 'SETU_PAYMENT',
    variables: ['customer_name', 'amount', 'link_suffix'],
    content: "Dear {{1}}, please pay ₹{{2}} securely using the UPI button below.",
    examples: ["Aditi", "15000", "hz83jd"],
    structure: [
        { type: "BODY", text: "Dear {{1}}, please pay ₹{{2}} securely using the UPI button below." },
        { type: "BUTTONS", buttons: [{ type: "URL", text: "Pay Now", url: `{{APP_URL}}/api/setu/pay?s={{1}}` }] }
    ]
  },
  // 9) Finished Photo Upload
  {
    name: 'auragold_finished_item_showcase',
    description: 'Sends header image + order link.',
    category: 'UTILITY',
    appGroup: 'ORDER_STATUS',
    variables: ['customer_name', 'order_id', 'token_link'],
    content: "Great news, {{1}}! Your custom jewelry piece is finally ready. We are excited to share the finished look for your Order {{2}}. The item has passed our quality checks and we are now ready for the final handover. Please review the details.",
    examples: ["Karan", "ORD-88", "OpQ123"],
    structure: [
        { type: "HEADER", format: "IMAGE" },
        { type: "BODY", text: "Great news, {{1}}! Your custom jewelry piece is finally ready. We are excited to share the finished look for your Order {{2}}. The item has passed our quality checks and we are now ready for the final handover. Please review the details." },
        { type: "BUTTONS", buttons: [{ type: "URL", text: "View Order", url: "https://order.auragoldelite.com/?token={{1}}" }] }
    ]
  },
  // 10) Gentle Reminder
  {
    name: 'auragold_gentle_reminder',
    description: 'Gentle reminder for upcoming payment.',
    category: 'UTILITY',
    appGroup: 'PAYMENT_COLLECTION',
    variables: ['customer_name', 'amount', 'order_id', 'link'],
    content: "Hello {{1}}, a gentle reminder that your installment of {{2}} for order {{3}} is due. Please pay here: {{4}} to avoid delays.",
    examples: ["John", "₹15,000", "ORD-123", "https://order.auragoldelite.com/?token=abc"]
  },
  // 11) Payment Overdue
  {
    name: 'auragold_payment_overdue',
    description: 'Firm reminder for overdue payment.',
    category: 'UTILITY',
    appGroup: 'PAYMENT_COLLECTION',
    variables: ['customer_name', 'amount', 'link'],
    content: "Dear {{1}}, we noticed your payment of {{2}} is overdue. To maintain your gold rate protection, please clear the dues via: {{3}} today.",
    examples: ["Sarah", "₹15,000", "https://order.auragoldelite.com/?token=abc"]
  },
  // 12) Urgent Lapse
  {
    name: 'auragold_urgent_lapse',
    description: 'Urgent reminder before rate protection lapses.',
    category: 'UTILITY',
    appGroup: 'PAYMENT_COLLECTION',
    variables: ['customer_name', 'order_id', 'amount', 'link'],
    content: "URGENT {{1}}: Your Gold Rate Protection for order {{2}} expires in 24 hours. Pay {{3}} immediately to save your booked rate: {{4}}",
    examples: ["Mike", "ORD-123", "₹15,000", "https://order.auragoldelite.com/?token=abc"]
  },
  // 13) Rate Adjustment Liability
  {
    name: 'auragold_rate_adjustment_liability',
    description: 'Triggered when protection limit is breached and a milestone is missed.',
    category: 'UTILITY',
    appGroup: 'SYSTEM_NOTIFICATIONS',
    variables: ['customer_name', 'surcharge_amount', 'order_id', 'new_base_rate', 'token_link'],
    content: "URGENT notice for {{1}}: Due to a missed payment milestone, your rate protection for Order {{3}} has lapsed. A market adjustment surcharge of ₹{{2}} has been applied. The new base rate is now ₹{{4}}/g. Please review and accept the new terms here: https://order.auragoldelite.com/?token={{5}}",
    examples: ["Rahul", "1500", "ORD-77", "6800", "Lmn456"]
  },
  // 14) Rate Stabilized
  {
    name: 'auragold_rate_stabilized',
    description: 'Triggered when the gold rate falls back under the protection limit.',
    category: 'UTILITY',
    appGroup: 'SYSTEM_NOTIFICATIONS',
    variables: ['customer_name', 'surcharge_amount', 'order_id', 'new_base_rate', 'token_link'],
    content: "Good news for {{1}}: The current market gold rate has stabilized and fallen back within your protection limit for Order {{3}}. The previous market adjustment surcharge of ₹{{2}} has been removed. Your base rate is restored to ₹{{4}}/g. You can review your updated order details securely here: https://order.auragoldelite.com/?token={{5}}",
    examples: ["Rahul", "1500", "ORD-77", "6800", "Lmn456"]
  },
  // 15) External Payment Link Request (Part / Full Payment)
  {
    name: 'auragold_external_payment_request',
    description: 'Sent for external payment link requests. Supports full or flexible part payments.',
    category: 'UTILITY',
    appGroup: 'SETU_PAYMENT',
    variables: ['customer_name', 'amount', 'purpose', 'payment_link'],
    content: "Dear {{1}}, a payment request of ₹{{2}} has been created for Your order No {{3}} at Sanghavi Jewellers. You can pay securely in full or in flexible part payments via UPI.",
    examples: ["Rajesh Kumar", "25,000", "Gold Jewelry Purchase", "ext_1785901329447_qgxjd"],
    structure: [
        { type: "BODY", text: "Dear {{1}}, a payment request of ₹{{2}} has been created for Your order No {{3}} at Sanghavi Jewellers. You can pay securely in full or in flexible part payments via UPI." },
        { type: "BUTTONS", buttons: [{ type: "URL", text: "Pay Now", url: "https://order.auragoldelite.com/?token={{1}}" }] }
    ]
  },
  // 16) Handover Confirmation
  {
    name: 'auragold_order_delivered',
    description: 'Sent upon order handover & delivery confirmation to customer.',
    category: 'UTILITY',
    appGroup: 'ORDER_STATUS',
    variables: ['customer_name', 'order_id', 'items_list', 'net_protection_savings', 'token_link'],
    content: "Dear {{1}}, thank you for choosing AuraGold! Your Order {{2}} ({{3}}) has been successfully handed over to you. Through our Gold Rate Protection, you saved a total of {{4}} on your order. You can view your completed order receipt and certificate here: https://order.auragoldelite.com/?token={{5}}\n\nWe look forward to serving you again!",
    examples: ["Rahul Sharma", "ORD-10023", "Gold Ring, Bangle", "₹12,500", "1q648vdxmjn"]
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
