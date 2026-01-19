
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

// Added missing CollectionTone for AI communication strategies
export type CollectionTone = 'POLITE' | 'FIRM' | 'URGENT' | 'ENCOURAGING';

// Added missing PsychologicalTactic for behavioral nudges
export type PsychologicalTactic = 'LOSS_AVERSION' | 'SOCIAL_PROOF' | 'AUTHORITY' | 'RECIPROCITY' | 'URGENCY' | 'EMPATHY';

// Added missing RiskProfile for customer segmentation
export type RiskProfile = 'VIP' | 'REGULAR' | 'FORGETFUL' | 'HIGH_RISK';

// Added missing MetaCategory for WhatsApp Template compliance
export type MetaCategory = 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';

// Added missing AppTemplateGroup for organizing templates
export type AppTemplateGroup = 'PAYMENT_COLLECTION' | 'ORDER_STATUS' | 'MARKETING_PROMO' | 'GENERAL_SUPPORT' | 'SYSTEM_NOTIFICATIONS' | 'SETU_PAYMENT' | 'UNCATEGORIZED';

// Added missing AppResolutionPath for error diagnostic steering
export type AppResolutionPath = 'settings' | 'templates' | 'whatsapp' | 'none';

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
  description?: string; 
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
  originalSnapshot?: OrderSnapshot; 
}

export interface GlobalSettings {
  currentGoldRate24K: number;
  currentGoldRate22K: number;
  currentGoldRate18K: number;
  purityFactor22K: number; // Configurable purity spread
  purityFactor18K: number; // Configurable purity spread
  defaultTaxRate: number;
  goldRateProtectionMax: number;
  gracePeriodHours: number;
  followUpIntervalDays: number;
  whatsappPhoneNumberId?: string;
  whatsappBusinessAccountId?: string;
  whatsappBusinessToken?: string;
  razorpayKeyId?: string;
  razorpayKeySecret?: string;
  setuClientId?: string;
  setuSchemeId?: string;
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

export interface Customer {
  id: string;
  name: string;
  contact: string;
  email?: string;
  secondaryContact?: string;
  orderIds: string[];
  totalSpent: number;
  joinDate: string;
  lastActive?: string;
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
  aiDiagnosis?: string;
  aiFixApplied?: string;
  implementationPrompt?: string;
  resolutionPath?: string;
  resolutionCTA?: string;
}

export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  actionType: string;
  details: string;
  metadata?: any;
}

export interface NotificationTrigger {
  id: string;
  customerName: string;
  customerContact: string;
  type: 'UPCOMING' | 'OVERDUE' | 'SYSTEM';
  message: string;
  date: string;
  sent: boolean;
  tone?: CollectionTone;
  strategyReasoning?: string;
  aiRecommendedTemplateId?: string;
  aiRecommendedVariables?: string[];
}

export interface PaymentPlanTemplate {
  id: string;
  name: string;
  months: number;
  interestPercentage: number;
  advancePercentage: number;
  enabled: boolean;
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  content: string;
  tactic: string;
  targetProfile: string;
  isAiGenerated: boolean;
  source: 'LOCAL' | 'META';
  status?: string;
  rejectionReason?: string;
  category?: MetaCategory;
  appGroup?: AppTemplateGroup;
  structure?: any[];
  variableExamples?: string[];
}

// Added missing SystemTrigger interface for system automation mapping
export interface SystemTrigger {
  id: string;
  label: string;
  description: string;
  requiredVariables: string[];
  defaultTemplateName: string;
  appGroup: AppTemplateGroup;
}

// Added missing CreditworthinessReport for AI customer analysis
export interface CreditworthinessReport {
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  persona: string;
  nextBestAction: string;
  communicationStrategy: string;
  negotiationLeverage: string;
}

// Added missing AiChatInsight for real-time AI response suggestions
export interface AiChatInsight {
  intent: string;
  tone: string;
  suggestedReply: string;
  recommendedTemplateId?: string;
}
