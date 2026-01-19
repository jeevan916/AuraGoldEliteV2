
export type Purity = '18K' | '22K' | '24K';

export enum OrderStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  OVERDUE = 'OVERDUE',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED'
}

export enum ProductionStatus {
  DESIGNING = 'DESIGNING',
  PRODUCTION = 'PRODUCTION',
  QUALITY_CHECK = 'QUALITY_CHECK',
  READY = 'READY',
  DELIVERED = 'DELIVERED'
}

export enum ProtectionStatus {
  ACTIVE = 'ACTIVE',
  WARNING = 'WARNING',
  LAPSED = 'LAPSED'
}

export interface CatalogItem {
  id: string;
  category: string;
  name: string;
  metalColor: string;
  purity: Purity;
  wastagePercentage: number;
  makingChargesPerGram: number;
  stoneCharges?: number;
}

export interface Milestone {
  id: string;
  dueDate: string;
  targetAmount: number;
  cumulativeTarget: number;
  status: 'PENDING' | 'PARTIAL' | 'PAID';
  warningCount: number;
  description?: string; // Manual instruction/note
}

export interface PaymentPlan {
  type: 'PRE_CREATED' | 'MANUAL';
  templateId?: string;
  months: number;
  interestPercentage: number;
  advancePercentage: number;
  goldRateProtection: boolean;
  protectionLimit: number;
  protectionRateBooked: number;
  protectionDeadline: string;
  milestones: Milestone[];
  protectionStatus: ProtectionStatus;
  gracePeriodEndAt?: string;
}

export interface JewelryDetail {
  id: string;
  category: string;
  metalColor: 'Yellow Gold' | 'Rose Gold' | 'White Gold';
  grossWeight?: number;
  netWeight: number;
  wastagePercentage: number;
  wastageValue: number;
  makingChargesPerGram: number;
  totalLaborValue: number;
  stoneCharges: number;
  stoneDetails?: string; 
  purity: Purity;
  taxAmount: number;
  finalAmount: number;
  baseMetalValue: number;
  customizationDetails: string;
  productionStatus: ProductionStatus;
  photoUrls: string[];
  huid?: string;
  size?: string;
}

export interface Payment {
  id: string;
  date: string;
  amount: number;
  method: string;
  note?: string;
  orderId?: string;
}

export interface OrderSnapshot {
  timestamp: string;
  originalTotal: number;
  originalRate: number;
  itemsSnapshot: JewelryDetail[];
  reason: string;
}

export interface Order {
  id: string;
  customerName: string;
  customerContact: string;
  customerEmail?: string;
  secondaryContact?: string;
  shareToken: string;
  items: JewelryDetail[];
  payments: Payment[];
  totalAmount: number;
  goldRateAtBooking: number;
  paymentPlan: PaymentPlan;
  status: OrderStatus;
  createdAt: string;
  originalSnapshot?: OrderSnapshot; // Stores the proof of contract before lapse
}

export interface GlobalSettings {
  currentGoldRate24K: number;
  currentGoldRate22K: number;
  currentGoldRate18K: number;
  defaultTaxRate: number;
  goldRateProtectionMax: number;
  gracePeriodHours: number; // New: Hours before lapse triggers
  followUpIntervalDays: number; // New: Days between post-lapse reminders
  whatsappPhoneNumberId?: string;
  whatsappBusinessAccountId?: string;
  whatsappBusinessToken?: string;
  razorpayKeyId?: string;
  razorpayKeySecret?: string;
  setuClientId?: string; // New for V2
  setuSchemeId?: string; // Mapped to Product Instance ID in V2
  setuSecret?: string;
  msg91AuthKey?: string;
  msg91SenderId?: string;
}

export type MessageStatus = 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'QUEUED';

export interface WhatsAppLogEntry {
  id: string;
  customerName: string;
  phoneNumber: string;
  message: string;
  status: MessageStatus;
  timestamp: string;
  direction: 'outbound' | 'inbound';
  type: 'TEMPLATE' | 'CUSTOM' | 'INBOUND';
  context?: string;
}

export type CollectionTone = 'POLITE' | 'FIRM' | 'URGENT' | 'ENCOURAGING';
export type AppResolutionPath = 'settings' | 'templates' | 'whatsapp' | 'none';

export interface Customer {
  id: string;
  name: string;
  contact: string;
  email?: string;
  secondaryContact?: string;
  orderIds: string[];
  totalSpent: number;
  joinDate: string;
}

export interface CreditworthinessReport {
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  persona: string;
  nextBestAction: string;
  communicationStrategy: string;
  negotiationLeverage: string;
}

export type ErrorSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ErrorStatus = 'NEW' | 'ANALYZING' | 'AUTO_FIXED' | 'REQUIRES_CODE_CHANGE' | 'RESOLVED' | 'UNRESOLVABLE';

export interface AppError {
  id: string;
  timestamp: string;
  source: string;
  message: string;
  stack?: string;
  severity: ErrorSeverity;
  status: ErrorStatus;
  
  // Intelligent Diagnosis Fields
  aiDiagnosis?: string;
  aiFixApplied?: string; // If auto-fixed, what did we do?
  implementationPrompt?: string; // If code change needed, here is the prompt for AI Studio
  resolutionPath?: AppResolutionPath;
  resolutionCTA?: string;
  suggestedFixData?: any;
  retryAction?: () => Promise<void>;
}

export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  actionType: 'ORDER_CREATED' | 'STATUS_UPDATE' | 'TEMPLATE_SENT' | 'MANUAL_MESSAGE_SENT' | 'PAYMENT_RECORDED' | 'PROTECTION_LAPSED' | 'AUTO_HEAL' | 'NAVIGATION' | 'API_CALL' | 'API_SUCCESS' | 'USER_ACTION';
  details: string;
  metadata?: any;
}

export interface NotificationTrigger {
  id: string;
  customerName: string;
  customerContact: string; // Added for direct sending
  type: 'UPCOMING' | 'OVERDUE' | 'SYSTEM';
  message: string; // The preview text
  date: string;
  sent: boolean;
  tone?: CollectionTone;
  strategyReasoning?: string;
  
  // COMPLIANCE FIELDS
  aiRecommendedTemplateId?: string;
  aiRecommendedVariables?: string[];
}

export type PsychologicalTactic = 'LOSS_AVERSION' | 'SOCIAL_PROOF' | 'AUTHORITY' | 'RECIPROCITY' | 'URGENCY' | 'EMPATHY';
export type RiskProfile = 'VIP' | 'REGULAR' | 'FORGETFUL' | 'HIGH_RISK';
export type MetaCategory = 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
export type AppTemplateGroup = 'PAYMENT_COLLECTION' | 'ORDER_STATUS' | 'MARKETING_PROMO' | 'GENERAL_SUPPORT' | 'SYSTEM_NOTIFICATIONS' | 'SETU_PAYMENT' | 'UNCATEGORIZED';

export interface WhatsAppTemplate {
  id: string;
  name: string;
  content: string;
  tactic: PsychologicalTactic;
  targetProfile: RiskProfile;
  isAiGenerated: boolean;
  source: 'LOCAL' | 'META';
  status?: string;
  rejectionReason?: string; // New field for Meta rejection logs
  category?: MetaCategory;
  appGroup?: AppTemplateGroup;
  structure?: any[];
  variableExamples?: string[];
}

export interface SystemTrigger {
  id: string;
  label: string;
  description: string;
  requiredVariables: string[]; // e.g., ["name", "amount"]
  defaultTemplateName: string;
  appGroup: AppTemplateGroup;
}

export interface PaymentPlanTemplate {
  id: string;
  name: string;
  months: number;
  interestPercentage: number;
  advancePercentage: number;
  enabled: boolean;
}

export interface AiChatInsight {
  intent: string;
  tone: string;
  suggestedReply: string;
  recommendedTemplateId?: string;
}
