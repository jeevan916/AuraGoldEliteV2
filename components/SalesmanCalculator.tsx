import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Calculator, Bookmark, Download, RotateCcw, Eye, EyeOff, Sparkles, Check,
  Zap, Search, Printer, Plus, Send, Copy, Layers, ShieldCheck, CheckCircle2,
  RefreshCw, Clock, ArrowRight, Maximize2, Minimize2
} from 'lucide-react';
import { 
  GlobalSettings, JewelryDetail, ProductionStatus, Purity, 
  PaymentPlanTemplate, Customer, AuthUser, Order, OrderStatus,
  OldGoldExchangeItem, SalesmanEstimate, ProtectionStatus
} from '../types';
import { INITIAL_PLAN_TEMPLATES } from '../constants';
import { goldRateService } from '../services/goldRateService';

// Sub-components
import { WizardStepNav } from './salesman/WizardStepNav';
import { Step1CustomerRates } from './salesman/Step1CustomerRates';
import { Step2JewelryCart } from './salesman/Step2JewelryCart';
import { Step3OldGoldTradeIn } from './salesman/Step3OldGoldTradeIn';
import { Step4PaymentQuotation } from './salesman/Step4PaymentQuotation';
import { SalesmanModals } from './salesman/SalesmanModals';
import { CustomerShowcaseView } from './salesman/CustomerShowcaseView';
import { ExpressQuickEstimator } from './salesman/ExpressQuickEstimator';
import { QuotationPrintSlip } from './salesman/QuotationPrintSlip';
import { EstimateSearchModal } from './salesman/EstimateSearchModal';

interface SalesmanCalculatorProps {
  settings: GlobalSettings;
  planTemplates?: PaymentPlanTemplate[];
  customers?: Customer[];
  currentUser?: AuthUser | null;
  onConvertToOrder?: (order: Order) => void;
  onRefreshRates?: () => Promise<void>;
}

export const SalesmanCalculator: React.FC<SalesmanCalculatorProps> = ({
  settings,
  planTemplates = [],
  customers = [],
  currentUser,
  onConvertToOrder,
  onRefreshRates
}) => {
  // --- CALCULATOR OPERATING MODE: EXPRESS (1-Screen Live) vs WIZARD (4-Step Multi-Item) ---
  const [calculatorMode, setCalculatorMode] = useState<'EXPRESS' | 'WIZARD'>('EXPRESS');

  // --- WIZARD STEP STATE (1: Customer & Rates, 2: Cart Items, 3: Old Gold, 4: Payment & Quote) ---
  const [currentStep, setCurrentStep] = useState<number>(1);

  // --- ESTIMATE HEADER STATE ---
  const [estimateId, setEstimateId] = useState(() => `EST-${Date.now().toString().slice(-6)}`);
  const [customerName, setCustomerName] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [customerCity, setCustomerCity] = useState('');
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [salesmanName, setSalesmanName] = useState(currentUser?.username || 'Showroom Sales Desk');
  
  // Rate Controls (Live or Custom for this Quote)
  const [rate24K, setRate24K] = useState(settings.currentGoldRate24K || 7500);
  const [rate22K, setRate22K] = useState(settings.currentGoldRate22K || 6875);
  const [rate18K, setRate18K] = useState(settings.currentGoldRate18K || 5625);
  const [rate14K, setRate14K] = useState(Math.round((settings.currentGoldRate24K || 7500) * 0.585));
  const [rateSilver, setRateSilver] = useState(settings.currentSilverRate || 92);
  const [isCustomRate, setIsCustomRate] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [refreshingRates, setRefreshingRates] = useState(false);

  // --- FULLSCREEN SHOWROOM MODE STATE ---
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleToggleFullscreen = () => {
    if (!isFullscreen) {
      setIsFullscreen(true);
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } else {
      setIsFullscreen(false);
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Sync with live settings when live mode is active
  useEffect(() => {
    if (!isCustomRate) {
      setRate24K(settings.currentGoldRate24K || 7500);
      setRate22K(settings.currentGoldRate22K || 6875);
      setRate18K(settings.currentGoldRate18K || 5625);
      setRate14K(Math.round((settings.currentGoldRate24K || 7500) * 0.585));
      setRateSilver(settings.currentSilverRate || 92);
    }
  }, [settings, isCustomRate]);

  // --- NEW JEWELLERY CART STATE ---
  const [cartItems, setCartItems] = useState<JewelryDetail[]>([
    {
      id: `ITEM-${Date.now()}-1`,
      category: 'Ring',
      metalColor: 'Yellow Gold',
      grossWeight: 6.000,
      netWeight: 5.500,
      wastagePercentage: 10,
      wastageValue: 0,
      makingChargesPerGram: 550,
      totalLaborValue: 0,
      stoneCharges: 0,
      stoneDetails: '',
      otherCharges: 45, // Hallmarking
      purity: '22K',
      taxAmount: 0,
      baseMetalValue: 0,
      finalAmount: 0,
      customizationDetails: '22K Gold Finger Ring',
      productionStatus: ProductionStatus.DESIGNING,
      photoUrls: []
    }
  ]);

  // Modal / Drawer state for adding or editing an item
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState<Partial<JewelryDetail>>({
    category: 'Ring',
    metalColor: 'Yellow Gold',
    purity: '22K',
    grossWeight: 5.500,
    netWeight: 5.000,
    wastagePercentage: 10,
    makingChargesPerGram: 550,
    stoneCharges: 0,
    stoneDetails: '',
    otherCharges: 45,
    customizationDetails: ''
  });

  // --- OLD GOLD EXCHANGE STATE ---
  const [enableOldGold, setEnableOldGold] = useState(false);
  const [oldGoldItems, setOldGoldItems] = useState<OldGoldExchangeItem[]>([]);
  const [showOldGoldModal, setShowOldGoldModal] = useState(false);
  const [editingOldGoldId, setEditingOldGoldId] = useState<string | null>(null);
  const [oldGoldForm, setOldGoldForm] = useState<Partial<OldGoldExchangeItem>>({
    description: 'Old 22K Gold Scrap / Exchange',
    metalType: 'GOLD',
    grossWeight: 10.000,
    deductionWeight: 0.200,
    netMeltingWeight: 9.800,
    purity: '22K',
    customPurityPercent: 91.6,
    meltingLossPercentage: 1.0,
    ratePerGram: rate22K
  });

  // --- DISCOUNT & PAYMENT PLAN STATE ---
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [taxRate] = useState<number>(settings.defaultTaxRate || 3);
  
  // Available Range-Based Payment Schemes
  const activePlanTemplates = useMemo(() => {
    return (planTemplates && planTemplates.length > 0) ? planTemplates : INITIAL_PLAN_TEMPLATES;
  }, [planTemplates]);

  // Payment Plan / EMI Simulator State
  const [planType, setPlanType] = useState<'FULL' | 'PLAN'>('FULL');
  const [selectedRangeFilter, setSelectedRangeFilter] = useState<'ALL' | '10K_50K' | '50K_120K' | '120K_PLUS' | 'CUSTOM'>('ALL');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('p2');
  const [selectedPlanName, setSelectedPlanName] = useState<string>('Budget Flex (6 Months)');
  const [planMonths, setPlanMonths] = useState<number>(6);
  const [planAdvancePercent, setPlanAdvancePercent] = useState<number>(15);
  const [planAdvanceAmount, setPlanAdvanceAmount] = useState<number>(0);
  const [useOldGoldAsAdvance, setUseOldGoldAsAdvance] = useState(true);
  const [planInterestPercent, setPlanInterestPercent] = useState<number>(3);
  const [subventionPercentage, setSubventionPercentage] = useState<number>(2);
  const [rateProtectionEnabled, setRateProtectionEnabled] = useState(true);

  // UI Presentation Mode & Modals
  const [customerViewActive, setCustomerViewActive] = useState(false);
  const [expandedBifurcationId, setExpandedBifurcationId] = useState<string | null>(null);
  const [savedEstimates, setSavedEstimates] = useState<SalesmanEstimate[]>([]);
  const [showSavedQuotesModal, setShowSavedQuotesModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedPrintEstimate, setSelectedPrintEstimate] = useState<SalesmanEstimate | null>(null);
  const [copiedText, setCopiedText] = useState(false);
  const [conversionSuccess, setConversionSuccess] = useState<string | null>(null);

  // Auto-Save Status: 'SAVED' | 'SAVING' | 'IDLE'
  const [autoSaveStatus, setAutoSaveStatus] = useState<'SAVED' | 'SAVING' | 'IDLE'>('IDLE');
  const autoSaveTimerRef = useRef<any>(null);

  // Load saved estimates from localStorage and attempt sync with backend
  useEffect(() => {
    try {
      const stored = localStorage.getItem('auragold_saved_estimates');
      if (stored) {
        setSavedEstimates(JSON.parse(stored));
      }
    } catch(e) {}

    // Fetch latest estimates from database if accessible
    fetch('/api/sync/estimates')
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.estimates) && data.estimates.length > 0) {
          setSavedEstimates(prev => {
            const map = new Map<string, SalesmanEstimate>();
            data.estimates.forEach((e: SalesmanEstimate) => map.set(e.id, e));
            prev.forEach(e => {
              if (!map.has(e.id)) map.set(e.id, e);
            });
            const merged = Array.from(map.values()).sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
            try { localStorage.setItem('auragold_saved_estimates', JSON.stringify(merged)); } catch(err) {}
            return merged;
          });
        }
      })
      .catch(() => {});
  }, []);

  // Helper: Get applicable benchmark rate for jewellery items
  const getPurityRate = (purity: Purity | string, metalColor: string = 'Yellow Gold') => {
    if (metalColor === 'Silver' || purity === '925' || purity === '999') {
      return purity === '925' ? Math.round(rateSilver * 0.925) : rateSilver;
    }
    switch(purity) {
      case '24K': return rate24K;
      case '22K': return rate22K;
      case '20K': return Math.round(rate24K * (83.33 / 100));
      case '18K': return rate18K;
      case '14K': return rate14K;
      default: return rate22K;
    }
  };

  // Helper: Get applicable standard benchmark buying rate for Old Gold Exchange
  const getOldGoldBenchmarkRate = (metalType: 'GOLD' | 'SILVER', purity: string, customPurity?: number) => {
    if (metalType === 'SILVER') {
      if (purity === '925') return Math.round(rateSilver * 0.925);
      if (purity === '800') return Math.round(rateSilver * 0.800);
      if (purity === 'CUSTOM') return Math.round(rateSilver * ((customPurity || 92.5) / 100));
      return rateSilver;
    }
    switch (purity) {
      case '24K': return rate24K;
      case '22K': return rate22K;
      case '20K': return Math.round(rate24K * (83.33 / 100));
      case '18K': return rate18K;
      case '14K': return rate14K;
      case 'CUSTOM': return Math.round(rate24K * ((customPurity || 91.6) / 100));
      default: return rate22K;
    }
  };

  // --- ITEM COST BIFURCATION CALCULATOR ---
  const calculateItemBifurcation = (item: Partial<JewelryDetail>) => {
    const gross = Number(item.grossWeight) || 0;
    const net = Number(item.netWeight) || gross || 0;
    const purity = item.purity || '22K';
    const metalColor = item.metalColor || 'Yellow Gold';
    const currentRate = getPurityRate(purity, metalColor);

    const baseMetalValue = Math.round(net * currentRate);
    const wastagePct = Number(item.wastagePercentage) || 0;
    const wastageValue = Math.round(baseMetalValue * (wastagePct / 100));
    const makingPerGram = Number(item.makingChargesPerGram) || 0;
    const totalLaborValue = Math.round(makingPerGram * net);
    const stoneCharges = Number(item.stoneCharges) || 0;
    const otherCharges = Number(item.otherCharges) || 45;
    const preTaxTotal = baseMetalValue + wastageValue + totalLaborValue + stoneCharges + otherCharges;
    const taxAmount = Math.round(preTaxTotal * (taxRate / 100));
    const finalAmount = preTaxTotal + taxAmount;

    return {
      grossWeight: gross,
      netWeight: net,
      baseMetalValue,
      wastagePercentage: wastagePct,
      wastageValue,
      makingChargesPerGram: makingPerGram,
      totalLaborValue,
      stoneCharges,
      otherCharges,
      preTaxTotal,
      taxAmount,
      finalAmount
    };
  };

  // --- RECALCULATE CART ITEMS ---
  const recalculatedCartItems = useMemo(() => {
    return cartItems.map(item => {
      const calc = calculateItemBifurcation(item);
      return {
        ...item,
        baseMetalValue: calc.baseMetalValue,
        wastageValue: calc.wastageValue,
        totalLaborValue: calc.totalLaborValue,
        taxAmount: calc.taxAmount,
        finalAmount: calc.finalAmount
      };
    });
  }, [cartItems, rate24K, rate22K, rate18K, rate14K, rateSilver, taxRate]);

  // --- CART TOTALS ---
  const cartTotals = useMemo(() => {
    let totalGrossWeight = 0;
    let totalNetWeight = 0;
    let totalMetalValue = 0;
    let totalWastageValue = 0;
    let totalMakingValue = 0;
    let totalStoneValue = 0;
    let totalOtherCharges = 0;
    let subTotalPreTax = 0;
    let totalGst = 0;
    let grossCartTotal = 0;

    recalculatedCartItems.forEach(item => {
      totalGrossWeight += Number(item.grossWeight) || 0;
      totalNetWeight += Number(item.netWeight) || 0;
      totalMetalValue += item.baseMetalValue || 0;
      totalWastageValue += item.wastageValue || 0;
      totalMakingValue += item.totalLaborValue || 0;
      totalStoneValue += item.stoneCharges || 0;
      totalOtherCharges += item.otherCharges || 45;
      totalGst += item.taxAmount || 0;
      grossCartTotal += item.finalAmount || 0;
    });

    subTotalPreTax = totalMetalValue + totalWastageValue + totalMakingValue + totalStoneValue + totalOtherCharges;

    return {
      totalGrossWeight: Number(totalGrossWeight.toFixed(3)),
      totalNetWeight: Number(totalNetWeight.toFixed(3)),
      totalMetalValue,
      totalWastageValue,
      totalMakingValue,
      totalStoneValue,
      totalOtherCharges,
      subTotalPreTax,
      totalGst,
      grossCartTotal
    };
  }, [recalculatedCartItems]);

  // --- RECALCULATE OLD GOLD ITEMS ---
  const recalculatedOldGoldItems = useMemo(() => {
    return oldGoldItems.map(item => {
      const gross = Number(item.grossWeight) || 0;
      const deduction = Number(item.deductionWeight) || 0;
      const netMelt = Math.max(0, gross - deduction);
      const meltingLoss = item.meltingLossPercentage ?? 1;
      const effectivePurityRatio = (item.purity === 'CUSTOM' ? (item.customPurityPercent || 91.6) : (item.purity === '24K' ? 99.9 : item.purity === '22K' ? 91.6 : item.purity === '18K' ? 75.0 : 58.5)) / 100;
      const fineGoldWeight = Number((netMelt * (1 - meltingLoss / 100) * effectivePurityRatio).toFixed(3));
      const applicableRate = item.ratePerGram || getOldGoldBenchmarkRate(item.metalType, item.purity, item.customPurityPercent);
      const exchangeValue = Math.round(netMelt * (1 - meltingLoss / 100) * applicableRate);

      return {
        ...item,
        grossWeight: gross,
        deductionWeight: deduction,
        netMeltingWeight: netMelt,
        fineGoldWeight,
        ratePerGram: applicableRate,
        exchangeValue
      };
    });
  }, [oldGoldItems, rate24K, rate22K, rate18K, rateSilver]);

  // --- OLD GOLD TOTALS ---
  const oldGoldTotals = useMemo(() => {
    let totalGross = 0;
    let totalDeduction = 0;
    let totalNetMelt = 0;
    let totalFineGold = 0;
    let totalCredit = 0;

    recalculatedOldGoldItems.forEach(item => {
      totalGross += item.grossWeight || 0;
      totalDeduction += item.deductionWeight || 0;
      totalNetMelt += item.netMeltingWeight || 0;
      totalFineGold += item.fineGoldWeight || 0;
      totalCredit += item.exchangeValue || 0;
    });

    return {
      totalGrossWeight: Number(totalGross.toFixed(3)),
      totalDeductionWeight: Number(totalDeduction.toFixed(3)),
      totalNetMeltWeight: Number(totalNetMelt.toFixed(3)),
      totalFineGoldWeight: Number(totalFineGold.toFixed(3)),
      totalCredit,
      itemCount: recalculatedOldGoldItems.length
    };
  }, [recalculatedOldGoldItems]);

  // --- NET COMMERCIAL TOTALS ---
  const netPayable = useMemo(() => {
    const gross = cartTotals.grossCartTotal;
    const oldGoldCredit = enableOldGold ? oldGoldTotals.totalCredit : 0;
    const discount = discountAmount || 0;
    return Math.max(0, gross - oldGoldCredit - discount);
  }, [cartTotals.grossCartTotal, enableOldGold, oldGoldTotals.totalCredit, discountAmount]);

  const subventionDiscountAmount = useMemo(() => {
    if (planType !== 'PLAN' || !subventionPercentage || subventionPercentage <= 0) return 0;
    const commercialGross = Math.max(0, cartTotals.grossCartTotal - (discountAmount || 0));
    return Math.round(commercialGross * (subventionPercentage / 100));
  }, [planType, subventionPercentage, cartTotals.grossCartTotal, discountAmount]);

  const netPayableAfterSubvention = useMemo(() => {
    return Math.max(0, netPayable - subventionDiscountAmount);
  }, [netPayable, subventionDiscountAmount]);

  const netWeightDifference = useMemo(() => {
    const oldWeight = enableOldGold ? oldGoldTotals.totalNetMeltWeight : 0;
    return Number((cartTotals.totalNetWeight - oldWeight).toFixed(3));
  }, [cartTotals.totalNetWeight, enableOldGold, oldGoldTotals.totalNetMeltWeight]);

  // --- PAYMENT PLAN CALCULATIONS ---
  const planCalculations = useMemo(() => {
    const oldGoldCredit = enableOldGold ? oldGoldTotals.totalCredit : 0;
    const commercialGross = Math.max(0, cartTotals.grossCartTotal - (discountAmount || 0) - subventionDiscountAmount);

    let requiredDownPayment = 0;
    if (planAdvanceAmount > 0) {
      requiredDownPayment = Math.min(commercialGross, planAdvanceAmount);
    } else if (planAdvancePercent > 0) {
      requiredDownPayment = Math.round(commercialGross * (planAdvancePercent / 100));
    } else {
      requiredDownPayment = 0;
    }

    let netDownPaymentPayable = 0;
    let oldGoldAppliedToDownPayment = 0;
    let oldGoldSurplusToEMI = 0;
    let totalAdvanceValue = 0;

    if (enableOldGold && oldGoldCredit > 0) {
      if (oldGoldCredit >= requiredDownPayment) {
        netDownPaymentPayable = 0;
        oldGoldAppliedToDownPayment = requiredDownPayment;
        oldGoldSurplusToEMI = oldGoldCredit - requiredDownPayment;
        totalAdvanceValue = oldGoldCredit;
      } else {
        netDownPaymentPayable = requiredDownPayment - oldGoldCredit;
        oldGoldAppliedToDownPayment = oldGoldCredit;
        oldGoldSurplusToEMI = 0;
        totalAdvanceValue = requiredDownPayment;
      }
    } else {
      netDownPaymentPayable = requiredDownPayment;
      oldGoldAppliedToDownPayment = 0;
      oldGoldSurplusToEMI = 0;
      totalAdvanceValue = requiredDownPayment;
    }

    const principalFinanced = Math.max(0, commercialGross - totalAdvanceValue);
    const interestAmount = Math.round(principalFinanced * (planInterestPercent / 100) * (planMonths / 12));
    const totalFinanced = principalFinanced + interestAmount;
    const totalPayableWithPlan = totalAdvanceValue + totalFinanced;
    const totalCustomerCashOutflow = netDownPaymentPayable + totalFinanced;
    const monthlyInstallment = planMonths > 0 ? Math.round(totalFinanced / planMonths) : totalFinanced;

    const milestones: any[] = [];
    const today = new Date();
    
    if (enableOldGold && oldGoldCredit > 0) {
      milestones.push({
        id: `M-OG-${Date.now()}`,
        dueDate: today.toISOString().split('T')[0],
        targetAmount: oldGoldCredit,
        cumulativeTarget: oldGoldCredit,
        status: 'PAID' as 'PAID',
        warningCount: 0,
        description: `Old Gold Trade-in Credit (${oldGoldTotals.itemCount} item(s), ${oldGoldTotals.totalNetMeltWeight}g melt)`
      });
    }

    if (netDownPaymentPayable > 0) {
      const cumAdvance = (enableOldGold ? oldGoldCredit : 0) + netDownPaymentPayable;
      milestones.push({
        id: `M-CASH-ADV-${Date.now()}`,
        dueDate: today.toISOString().split('T')[0],
        targetAmount: netDownPaymentPayable,
        cumulativeTarget: cumAdvance,
        status: 'PENDING' as 'PENDING',
        warningCount: 0,
        description: `Net Down Payment (Cash / UPI / Card)`
      });
    } else if (!enableOldGold && totalAdvanceValue > 0) {
      milestones.push({
        id: `M-ADV-${Date.now()}`,
        dueDate: today.toISOString().split('T')[0],
        targetAmount: totalAdvanceValue,
        cumulativeTarget: totalAdvanceValue,
        status: 'PENDING' as 'PENDING',
        warningCount: 0,
        description: `Initial Down Payment / Advance (${planAdvancePercent}%)`
      });
    }

    let runningSum = (enableOldGold ? oldGoldCredit : 0) + netDownPaymentPayable;
    for (let i = 1; i <= planMonths; i++) {
      const dueDate = new Date(today);
      dueDate.setMonth(today.getMonth() + i);
      
      const isLast = i === planMonths;
      const thisEmi = isLast 
        ? Math.max(0, totalFinanced - monthlyInstallment * (planMonths - 1))
        : monthlyInstallment;
      
      runningSum += thisEmi;
      
      milestones.push({
        id: `M-${i}-${Date.now()}`,
        dueDate: dueDate.toISOString().split('T')[0],
        targetAmount: thisEmi,
        cumulativeTarget: runningSum,
        status: 'PENDING' as 'PENDING',
        warningCount: 0,
        description: `Installment Milestone #${i} of ${planMonths}`
      });
    }

    return {
      requiredDownPayment,
      oldGoldCredit,
      netDownPaymentPayable,
      oldGoldAppliedToDownPayment,
      oldGoldSurplusToEMI,
      totalAdvanceValue,
      advancePaid: totalAdvanceValue,
      cashAdvance: netDownPaymentPayable,
      oldGoldAdvance: oldGoldCredit,
      principalFinanced,
      interestAmount,
      totalFinanced,
      totalPayableWithPlan,
      totalCustomerCashOutflow,
      monthlyInstallment,
      subventionSavings: subventionDiscountAmount,
      milestones
    };
  }, [
    cartTotals.grossCartTotal,
    discountAmount,
    planMonths, 
    planAdvancePercent, 
    planAdvanceAmount, 
    planInterestPercent, 
    enableOldGold, 
    oldGoldTotals.totalCredit, 
    oldGoldTotals.itemCount,
    oldGoldTotals.totalNetMeltWeight,
    subventionDiscountAmount
  ]);

  // --- OLD GOLD IN EXPRESS MODE ---
  const [expressOldGoldGrossWeight, setExpressOldGoldGrossWeight] = useState<number>(0);
  const [expressOldGoldPurity, setExpressOldGoldPurity] = useState<string>('22K');
  const [expressOldGoldRate, setExpressOldGoldRate] = useState<number>(rate22K);

  const expressOldGoldCredit = useMemo(() => {
    if (!enableOldGold || expressOldGoldGrossWeight <= 0) return 0;
    const applicableRate = expressOldGoldRate || getOldGoldBenchmarkRate('GOLD', expressOldGoldPurity);
    const purityRatio = expressOldGoldPurity === '24K' ? 1 : expressOldGoldPurity === '22K' ? 0.916 : expressOldGoldPurity === '18K' ? 0.75 : 0.585;
    return Math.round(expressOldGoldGrossWeight * 0.99 * applicableRate);
  }, [enableOldGold, expressOldGoldGrossWeight, expressOldGoldPurity, expressOldGoldRate, rate22K, rate24K, rate18K]);

  // --- CURRENT ESTIMATE OBJECT ---
  const currentEstimateObject: SalesmanEstimate = useMemo(() => {
    const combinedOldGoldItems = calculatorMode === 'EXPRESS' && enableOldGold && expressOldGoldGrossWeight > 0 ? [
      {
        id: `OG-EXP-${Date.now()}`,
        description: `Old Gold Scrap (${expressOldGoldPurity})`,
        metalType: 'GOLD' as const,
        grossWeight: expressOldGoldGrossWeight,
        deductionWeight: 0,
        netMeltingWeight: expressOldGoldGrossWeight,
        fineGoldWeight: Number((expressOldGoldGrossWeight * 0.916).toFixed(3)),
        purity: expressOldGoldPurity,
        meltingLossPercentage: 1.0,
        ratePerGram: expressOldGoldRate || rate22K,
        exchangeValue: expressOldGoldCredit
      }
    ] : enableOldGold ? recalculatedOldGoldItems : [];

    const effectiveOldGoldCredit = calculatorMode === 'EXPRESS' ? expressOldGoldCredit : (enableOldGold ? oldGoldTotals.totalCredit : 0);

    return {
      id: estimateId,
      customerName: customerName || 'Walk-in Client',
      customerContact: customerContact || '',
      customerCity,
      date: new Date().toISOString(),
      items: recalculatedCartItems,
      oldGoldItems: combinedOldGoldItems,
      goldRate22K: rate22K,
      goldRate24K: rate24K,
      goldRate18K: rate18K,
      silverRate: rateSilver,
      discountAmount,
      taxRate,
      totalJewelryValue: cartTotals.subTotalPreTax,
      totalGstAmount: cartTotals.totalGst,
      grossCartAmount: cartTotals.grossCartTotal,
      totalOldGoldCredit: effectiveOldGoldCredit,
      netPayableAmount: planType === 'PLAN' ? netPayableAfterSubvention : Math.max(0, netPayable - (calculatorMode === 'EXPRESS' ? expressOldGoldCredit : 0)),
      paymentPlan: {
        type: 'MANUAL',
        months: planMonths,
        interestPercentage: planInterestPercent,
        advancePercentage: planAdvancePercent,
        goldRateProtection: rateProtectionEnabled,
        protectionLimit: 500,
        protectionRateBooked: rate22K,
        protectionDeadline: new Date().toISOString(),
        milestones: planCalculations.milestones,
        protectionStatus: ProtectionStatus.ACTIVE
      },
      salesmanName,
      notes: ''
    };
  }, [
    estimateId, customerName, customerContact, customerCity,
    recalculatedCartItems, enableOldGold, recalculatedOldGoldItems,
    calculatorMode, expressOldGoldGrossWeight, expressOldGoldPurity, expressOldGoldRate, expressOldGoldCredit,
    rate22K, rate24K, rate18K, rateSilver, discountAmount, taxRate,
    cartTotals, oldGoldTotals, netPayable, netPayableAfterSubvention,
    planType, planMonths, planInterestPercent, planAdvancePercent,
    rateProtectionEnabled, planCalculations.milestones, salesmanName
  ]);

  // --- AUTOMATIC SAVING OF ESTIMATE (ONLY WHEN CUSTOMER DETAILS ARE ENTERED) ---
  useEffect(() => {
    const hasCustomerDetails = (customerName && customerName.trim().length >= 2) || (customerContact && customerContact.replace(/\D/g, '').length >= 5);
    const hasValidCalculation = cartTotals.totalNetWeight > 0 || (enableOldGold && (oldGoldTotals.totalNetMeltWeight > 0 || expressOldGoldGrossWeight > 0));

    // Do NOT auto-save on blank scratchpad calculations to avoid polluting database
    if (!hasCustomerDetails || !hasValidCalculation) {
      setAutoSaveStatus('IDLE');
      return;
    }

    setAutoSaveStatus('SAVING');
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    autoSaveTimerRef.current = setTimeout(() => {
      // 1. Update localStorage
      setSavedEstimates(prev => {
        const filtered = prev.filter(e => e.id !== currentEstimateObject.id);
        const updated = [currentEstimateObject, ...filtered].slice(0, 50);
        try {
          localStorage.setItem('auragold_saved_estimates', JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });

      // 2. Background sync to backend API
      fetch('/api/sync/estimates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estimate: currentEstimateObject })
      }).catch(() => {});

      setAutoSaveStatus('SAVED');
    }, 1000);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [customerName, customerContact, currentEstimateObject, cartTotals.totalNetWeight, enableOldGold, oldGoldTotals.totalNetMeltWeight, expressOldGoldGrossWeight]);

  // --- ITEM FORM HANDLERS ---
  const handleOpenAddItemModal = () => {
    setEditingItemId(null);
    setItemForm({
      category: 'Ring',
      metalColor: 'Yellow Gold',
      purity: '22K',
      grossWeight: 6.000,
      netWeight: 5.500,
      wastagePercentage: 10,
      makingChargesPerGram: 550,
      stoneCharges: 0,
      stoneDetails: '',
      otherCharges: 45,
      customizationDetails: '22K Gold Finger Ring'
    });
    setShowItemModal(true);
  };

  const handleEditItem = (item: JewelryDetail) => {
    setEditingItemId(item.id);
    setItemForm({ ...item });
    setShowItemModal(true);
  };

  const handleSaveItemForm = () => {
    if (!itemForm.netWeight || itemForm.netWeight <= 0) {
      alert("Please enter a valid Net Gold Weight (in grams).");
      return;
    }

    if (editingItemId) {
      setCartItems(cartItems.map(i => i.id === editingItemId ? {
        ...i,
        ...itemForm,
        category: itemForm.category || i.category,
        purity: itemForm.purity || i.purity,
        grossWeight: Number(itemForm.grossWeight) || Number(itemForm.netWeight) || 1,
        netWeight: Number(itemForm.netWeight) || 1,
        wastagePercentage: Number(itemForm.wastagePercentage) || 0,
        makingChargesPerGram: Number(itemForm.makingChargesPerGram) || 0,
        stoneCharges: Number(itemForm.stoneCharges) || 0,
        stoneDetails: itemForm.stoneDetails || '',
        customizationDetails: itemForm.customizationDetails || ''
      } as JewelryDetail : i));
    } else {
      const newItem: JewelryDetail = {
        id: `ITEM-${Date.now()}`,
        category: itemForm.category || 'Ring',
        metalColor: itemForm.metalColor || 'Yellow Gold',
        grossWeight: Number(itemForm.grossWeight) || Number(itemForm.netWeight) || 1,
        netWeight: Number(itemForm.netWeight) || 1,
        wastagePercentage: Number(itemForm.wastagePercentage) || 0,
        wastageValue: 0,
        makingChargesPerGram: Number(itemForm.makingChargesPerGram) || 0,
        totalLaborValue: 0,
        stoneCharges: Number(itemForm.stoneCharges) || 0,
        stoneDetails: itemForm.stoneDetails || '',
        otherCharges: 45,
        purity: (itemForm.purity as any) || '22K',
        taxAmount: 0,
        baseMetalValue: 0,
        finalAmount: 0,
        customizationDetails: itemForm.customizationDetails || `${itemForm.purity || '22K'} ${itemForm.category || 'Jewellery'}`,
        productionStatus: ProductionStatus.DESIGNING,
        photoUrls: []
      };
      setCartItems([...cartItems, newItem]);
    }

    setShowItemModal(false);
    setEditingItemId(null);
  };

  const handleDeleteItem = (id: string) => {
    setCartItems(cartItems.filter(i => i.id !== id));
  };

  // Add Item directly from Express Quick Estimator to Cart
  const handleAddToCartFromExpress = (newItem: JewelryDetail) => {
    setCartItems(prev => [newItem, ...prev]);
    setCalculatorMode('WIZARD');
    setCurrentStep(2);
  };

  // --- OLD GOLD FORM HANDLERS ---
  const handleOpenAddOldGoldModal = () => {
    setEditingOldGoldId(null);
    setOldGoldForm({
      description: 'Old 22K Gold Scrap / Broken Chain',
      metalType: 'GOLD',
      grossWeight: 10.000,
      deductionWeight: 0.200,
      netMeltingWeight: 9.800,
      purity: '22K',
      customPurityPercent: 91.6,
      meltingLossPercentage: 1.0,
      ratePerGram: rate22K
    });
    setShowOldGoldModal(true);
  };

  const handleEditOldGoldItem = (item: OldGoldExchangeItem) => {
    setEditingOldGoldId(item.id);
    setOldGoldForm({ ...item });
    setShowOldGoldModal(true);
  };

  const handleSaveOldGoldForm = () => {
    const gross = Number(oldGoldForm.grossWeight) || 0;
    const deduction = Number(oldGoldForm.deductionWeight) || 0;
    const netMelt = Math.max(0, gross - deduction);

    if (gross <= 0 || netMelt <= 0) {
      alert("Please enter a valid gross scrap weight.");
      return;
    }

    if (editingOldGoldId) {
      setOldGoldItems(oldGoldItems.map(i => i.id === editingOldGoldId ? {
        ...i,
        ...oldGoldForm,
        grossWeight: gross,
        deductionWeight: deduction,
        netMeltingWeight: netMelt,
      } as OldGoldExchangeItem : i));
    } else {
      const newOldItem: OldGoldExchangeItem = {
        id: `OG-${Date.now()}`,
        description: oldGoldForm.description || 'Old Gold Scrap',
        metalType: oldGoldForm.metalType || 'GOLD',
        grossWeight: gross,
        deductionWeight: deduction,
        netMeltingWeight: netMelt,
        fineGoldWeight: 0,
        purity: oldGoldForm.purity || '22K',
        customPurityPercent: oldGoldForm.customPurityPercent,
        meltingLossPercentage: oldGoldForm.meltingLossPercentage ?? 1,
        ratePerGram: oldGoldForm.ratePerGram || rate22K,
        exchangeValue: 0
      };
      setOldGoldItems([...oldGoldItems, newOldItem]);
      setEnableOldGold(true);
    }

    setShowOldGoldModal(false);
    setEditingOldGoldId(null);
  };

  const handleDeleteOldGoldItem = (id: string) => {
    const updated = oldGoldItems.filter(i => i.id !== id);
    setOldGoldItems(updated);
    if (updated.length === 0) setEnableOldGold(false);
  };

  // Track the live item from Express Estimator
  const [activeExpressItem, setActiveExpressItem] = useState<JewelryDetail | null>(null);

  // --- WHATSAPP ESTIMATE BUILDER ---
  const constructWhatsAppEstimateMessage = (explicitItem?: JewelryDetail) => {
    const itemsToShare = explicitItem && explicitItem.netWeight > 0
      ? [explicitItem]
      : calculatorMode === 'EXPRESS' && activeExpressItem && activeExpressItem.netWeight > 0
        ? [activeExpressItem]
        : recalculatedCartItems;

    const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    let msg = `✨ *AURAGOLD JEWELLERS — ESTIMATE QUOTATION* ✨\n`;
    msg += `📋 *Quote ID:* ${estimateId}\n`;
    msg += `📅 *Date:* ${dateStr}\n`;
    if (customerName) msg += `👤 *Customer:* ${customerName}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📈 *TODAY'S BENCHMARK RATES:*\n`;
    msg += `• 22K (916 Hallmark): ₹${rate22K.toLocaleString('en-IN')}/g\n`;
    msg += `• 24K Pure Gold: ₹${rate24K.toLocaleString('en-IN')}/g\n`;
    msg += `• 18K Diamond Gold: ₹${rate18K.toLocaleString('en-IN')}/g\n`;
    msg += `• Silver: ₹${rateSilver.toLocaleString('en-IN')}/g\n\n`;

    msg += `🛍️ *ITEMIZED BREAKDOWN (${itemsToShare.length} Items):*\n`;
    itemsToShare.forEach((item, idx) => {
      msg += `*${idx + 1}. ${item.customizationDetails || `${item.purity} ${item.category}`} (${item.purity})*\n`;
      msg += `  • Net Wt: ${item.netWeight}g @ ₹${getPurityRate(item.purity, item.metalColor)}/g\n`;
      if (item.wastagePercentage > 0) msg += `  • Making Charges / Labour (${item.wastagePercentage}%): ₹${item.wastageValue.toLocaleString('en-IN')}\n`;
      if (item.makingChargesPerGram > 0) msg += `  • Majuri: ₹${item.totalLaborValue.toLocaleString('en-IN')} (₹${item.makingChargesPerGram}/g)\n`;
      if (item.stoneCharges > 0) msg += `  • Stones: ₹${item.stoneCharges.toLocaleString('en-IN')}\n`;
      msg += `  • GST (3%): ₹${item.taxAmount.toLocaleString('en-IN')}\n`;
      msg += `  ➡️ *Item Total: ₹${item.finalAmount.toLocaleString('en-IN')}*\n\n`;
    });

    const effectiveOldGoldCredit = calculatorMode === 'EXPRESS' ? expressOldGoldCredit : (enableOldGold ? oldGoldTotals.totalCredit : 0);

    if (enableOldGold && effectiveOldGoldCredit > 0) {
      msg += `━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `🪙 *OLD GOLD / SCRAP TRADE-IN VALUE:*\n`;
      if (calculatorMode === 'EXPRESS') {
        msg += `  • Scrap Weight: ${expressOldGoldGrossWeight}g (${expressOldGoldPurity})\n`;
        msg += `  • Exchange Rate: ₹${expressOldGoldRate}/g\n`;
      } else {
        recalculatedOldGoldItems.forEach((og, idx) => {
          msg += `  ${idx + 1}. ${og.description} (${og.purity === 'CUSTOM' ? `${og.customPurityPercent}%` : og.purity})\n`;
          msg += `     Net Melt: ${og.netMeltingWeight}g @ ₹${og.ratePerGram}/g\n`;
          msg += `     Credit: ₹${og.exchangeValue.toLocaleString('en-IN')}\n`;
        });
      }
      msg += `  ➡️ *Total Trade-in Credit: -₹${effectiveOldGoldCredit.toLocaleString('en-IN')}*\n\n`;
    }

    const effectiveGross = itemsToShare.reduce((s, i) => s + (i.finalAmount || 0), 0);
    const effectiveNetPayable = Math.max(0, effectiveGross - discountAmount - effectiveOldGoldCredit);

    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `💰 *Gross Jewellery Total:* ₹${effectiveGross.toLocaleString('en-IN')}\n`;
    if (enableOldGold && effectiveOldGoldCredit > 0) {
      msg += `🪙 *Old Gold Trade-in Credit:* -₹${effectiveOldGoldCredit.toLocaleString('en-IN')}\n`;
    }
    if (discountAmount > 0) {
      msg += `🏷️ *Showroom Goodwill Discount:* -₹${discountAmount.toLocaleString('en-IN')}\n`;
    }
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `⭐ *NET PAYABLE AMOUNT: ₹${effectiveNetPayable.toLocaleString('en-IN')}*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;

    if (planType === 'PLAN') {
      msg += `\n💳 *PAYMENT SCHEME: ${selectedPlanName || `${planMonths} Months EMI Plan`}*\n`;
      if (subventionPercentage > 0) {
        msg += `🌟 *Merchant Subvention Benefit:* ${subventionPercentage}% (Saved -₹${planCalculations.subventionSavings.toLocaleString('en-IN')})\n`;
      }
      
      msg += `• Plan Down Payment (${planAdvancePercent}%): ₹${planCalculations.requiredDownPayment.toLocaleString('en-IN')}\n`;
      if (enableOldGold && oldGoldTotals.totalCredit > 0) {
        msg += `• Less Old Gold Credit: -₹${oldGoldTotals.totalCredit.toLocaleString('en-IN')}\n`;
        if (planCalculations.netDownPaymentPayable > 0) {
          msg += `• *Net Down Payment to Pay Today: ₹${planCalculations.netDownPaymentPayable.toLocaleString('en-IN')}* (Cash / UPI)\n`;
        } else {
          msg += `• *Net Down Payment to Pay Today: ₹0* (100% Covered by Old Gold)\n`;
        }
      } else {
        msg += `• *Net Down Payment to Pay Today: ₹${planCalculations.netDownPaymentPayable.toLocaleString('en-IN')}*\n`;
      }

      msg += `• Remaining Financed Balance: ₹${planCalculations.principalFinanced.toLocaleString('en-IN')}\n`;
      if (planCalculations.interestAmount > 0) {
        msg += `• Total Interest (${planInterestPercent}% p.a.): ₹${planCalculations.interestAmount.toLocaleString('en-IN')}\n`;
      }
      msg += `• Monthly Installment: *₹${planCalculations.monthlyInstallment.toLocaleString('en-IN')}/month* (${planMonths} Months)\n`;
      msg += `• Total Financed over EMIs: ₹${planCalculations.totalFinanced.toLocaleString('en-IN')}\n`;
      if (rateProtectionEnabled) {
        msg += `🛡️ *Gold Rate Protection:* Locked @ ₹${rate22K}/g\n`;
      }
    }

    msg += `\n📍 *AuraGold Elite Showroom*\n`;
    msg += `📞 *Sales Executive:* ${salesmanName}\n`;
    msg += `_Note: This estimate is valid for today's market rates._`;

    return msg;
  };

  const handleShareWhatsApp = (explicitItem?: JewelryDetail) => {
    let targetPhone = customerContact ? customerContact.trim() : '';
    if (!targetPhone) {
      const phoneInput = prompt("Enter customer's 10-digit WhatsApp number (or leave blank to choose contact in WhatsApp):", "");
      if (phoneInput === null) return;
      if (phoneInput.trim()) {
        targetPhone = phoneInput.trim();
        setCustomerContact(targetPhone);
      }
    }

    const messageText = constructWhatsAppEstimateMessage(explicitItem);
    const encoded = encodeURIComponent(messageText);

    if (targetPhone) {
      const cleanPhone = targetPhone.replace(/[^0-9]/g, '');
      const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
      window.open(`https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encoded}`, '_blank');
    } else {
      window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
    }
  };

  const handleCopyText = (explicitItem?: JewelryDetail) => {
    const text = constructWhatsAppEstimateMessage(explicitItem);
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2500);
  };

  // Print Slip
  const handleOpenPrintSlip = (est?: SalesmanEstimate, explicitItem?: JewelryDetail) => {
    if (explicitItem && explicitItem.netWeight > 0) {
      const printEst: SalesmanEstimate = {
        ...currentEstimateObject,
        items: [explicitItem],
        totalJewelryValue: explicitItem.baseMetalValue + (explicitItem.wastageValue || 0) + (explicitItem.totalLaborValue || 0) + (explicitItem.stoneCharges || 0) + (explicitItem.otherCharges || 45),
        totalGstAmount: explicitItem.taxAmount,
        grossCartAmount: explicitItem.finalAmount,
        netPayableAmount: Math.max(0, explicitItem.finalAmount - discountAmount - (enableOldGold ? expressOldGoldCredit : 0))
      };
      setSelectedPrintEstimate(printEst);
    } else {
      setSelectedPrintEstimate(est || currentEstimateObject);
    }
    setShowPrintModal(true);
  };

  // --- CONVERT TO FORMAL ORDER ---
  const handleConvertEstimateToOrder = (explicitItem?: JewelryDetail) => {
    const itemsToConvert: JewelryDetail[] = [];
    if (explicitItem && explicitItem.netWeight > 0) {
      itemsToConvert.push(explicitItem);
    } else if (calculatorMode === 'EXPRESS' && activeExpressItem && activeExpressItem.netWeight > 0) {
      itemsToConvert.push(activeExpressItem);
    } else if (recalculatedCartItems.length > 0) {
      itemsToConvert.push(...recalculatedCartItems);
    }

    if (itemsToConvert.length === 0) {
      alert("Please enter a valid jewellery net weight to convert to a booking order.");
      return;
    }

    const orderId = `ORD-${Date.now().toString().slice(-6)}`;
    const effectiveTotalAmount = itemsToConvert.reduce((s, i) => s + (i.finalAmount || 0), 0);
    const initialPayments: any[] = [];
    const effectiveOldGoldCredit = calculatorMode === 'EXPRESS' ? expressOldGoldCredit : (enableOldGold ? oldGoldTotals.totalCredit : 0);

    if (enableOldGold && effectiveOldGoldCredit > 0) {
      initialPayments.push({
        id: `PAY-OG-${Date.now()}`,
        amount: effectiveOldGoldCredit,
        date: new Date().toISOString().split('T')[0],
        method: 'OLD_GOLD',
        note: `Exchange Credit: ${calculatorMode === 'EXPRESS' ? `${expressOldGoldGrossWeight}g Old Gold (${expressOldGoldPurity})` : `${oldGoldTotals.itemCount} item(s) (${oldGoldTotals.totalNetMeltWeight}g melt)`}`,
        orderId
      });
    }

    // Generate milestones matching OrderForm.tsx standard logic
    const today = new Date();
    let milestones: any[] = [];

    if (planType === 'PLAN') {
      milestones = planCalculations.milestones;
    } else {
      // FULL Booking Payment Flow
      if (effectiveOldGoldCredit > 0) {
        milestones.push({
          id: `M-OG-${Date.now()}`,
          dueDate: today.toISOString().split('T')[0],
          targetAmount: effectiveOldGoldCredit,
          cumulativeTarget: effectiveOldGoldCredit,
          status: 'PAID',
          warningCount: 0,
          description: 'Old Gold Trade-in Credit'
        });
      }
      const remainingCash = Math.max(0, effectiveTotalAmount - discountAmount - effectiveOldGoldCredit);
      if (remainingCash > 0) {
        milestones.push({
          id: `M-1-${Date.now()}`,
          dueDate: today.toISOString().split('T')[0],
          targetAmount: remainingCash,
          cumulativeTarget: effectiveTotalAmount - discountAmount,
          status: 'PENDING',
          warningCount: 0,
          description: 'Booking Advance / Net Total'
        });
      }
    }

    const lastMilestoneDate = milestones.length > 0
      ? milestones[milestones.length - 1].dueDate
      : new Date().toISOString().split('T')[0];

    const newOrder: Order = {
      id: orderId,
      shareToken: Math.random().toString(36).substring(2, 10),
      customerName: customerName.trim() || 'Walk-in Valued Client',
      customerContact: customerContact.trim() || '',
      items: itemsToConvert,
      payments: initialPayments,
      totalAmount: Math.max(0, effectiveTotalAmount - discountAmount),
      discountAmount: discountAmount,
      goldRateAtBooking: rate22K,
      status: OrderStatus.ACTIVE,
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.username || salesmanName || 'Sales Desk',
      paymentPlan: {
        type: 'MANUAL',
        months: planType === 'PLAN' ? planMonths : 1,
        interestPercentage: planType === 'PLAN' ? planInterestPercent : 0,
        advancePercentage: planType === 'PLAN' ? planAdvancePercent : 100,
        goldRateProtection: planType === 'PLAN' ? rateProtectionEnabled : true,
        protectionLimit: settings.goldRateProtectionMax || 500,
        protectionRateBooked: rate22K,
        protectionDeadline: lastMilestoneDate,
        milestones,
        protectionStatus: (planType === 'PLAN' ? (rateProtectionEnabled ? ProtectionStatus.ACTIVE : ProtectionStatus.NONE) : ProtectionStatus.ACTIVE)
      }
    };

    if (onConvertToOrder) {
      onConvertToOrder(newOrder);
    } else {
      setConversionSuccess(orderId);
      alert(`Estimate converted to Booking Order ${orderId} successfully!`);
    }
  };

  // --- SAVE & LOAD ESTIMATES ---
  const handleSaveEstimateManual = () => {
    const updated = [currentEstimateObject, ...savedEstimates.filter(e => e.id !== estimateId)].slice(0, 50);
    setSavedEstimates(updated);
    localStorage.setItem('auragold_saved_estimates', JSON.stringify(updated));
    fetch('/api/sync/estimates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estimate: currentEstimateObject })
    }).catch(() => {});
    alert(`Estimate ${estimateId} saved successfully!`);
  };

  const handleLoadEstimate = (est: SalesmanEstimate) => {
    setEstimateId(est.id);
    setCustomerName(est.customerName);
    setCustomerContact(est.customerContact);
    setCustomerCity(est.customerCity || '');
    setCartItems(est.items || []);
    if (est.oldGoldItems && est.oldGoldItems.length > 0) {
      setOldGoldItems(est.oldGoldItems);
      setEnableOldGold(true);
    } else {
      setOldGoldItems([]);
      setEnableOldGold(false);
    }
    setRate22K(est.goldRate22K);
    setRate24K(est.goldRate24K);
    setRate18K(est.goldRate18K);
    setRateSilver(est.silverRate);
    setDiscountAmount(est.discountAmount || 0);
    if (est.paymentPlan) {
      setPlanMonths(est.paymentPlan.months || 6);
      setPlanAdvancePercent(est.paymentPlan.advancePercentage || 20);
      setPlanInterestPercent(est.paymentPlan.interestPercentage || 0);
      setRateProtectionEnabled(est.paymentPlan.goldRateProtection ?? true);
      setPlanType('PLAN');
    } else {
      setPlanType('FULL');
    }
    setShowSavedQuotesModal(false);
    setCalculatorMode('WIZARD');
    setCurrentStep(4);
  };

  const handleResetCalculator = () => {
    if (confirm("Reset the current calculation to a fresh new estimate?")) {
      setEstimateId(`EST-${Date.now().toString().slice(-6)}`);
      setCustomerName('');
      setCustomerContact('');
      setCustomerCity('');
      setDiscountAmount(0);
      setPlanType('FULL');
      setEnableOldGold(false);
      setOldGoldItems([]);
      setCurrentStep(1);
      setCartItems([
        {
          id: `ITEM-${Date.now()}-1`,
          category: 'Ring',
          metalColor: 'Yellow Gold',
          grossWeight: 6.000,
          netWeight: 5.500,
          wastagePercentage: 10,
          wastageValue: 0,
          makingChargesPerGram: 550,
          totalLaborValue: 0,
          stoneCharges: 0,
          stoneDetails: '',
          otherCharges: 45,
          purity: '22K',
          taxAmount: 0,
          baseMetalValue: 0,
          finalAmount: 0,
          customizationDetails: '22K Gold Finger Ring',
          productionStatus: ProductionStatus.DESIGNING,
          photoUrls: []
        }
      ]);
    }
  };

  // --- RENDER ---
  return (
    <div className={`space-y-4 font-sans max-w-6xl mx-auto transition-all ${
      isFullscreen 
        ? 'fixed inset-0 z-[9999] bg-[#F2F2F7] overflow-y-auto p-4 sm:p-6 w-screen h-screen min-h-screen' 
        : 'pb-36 px-2 sm:px-4'
    }`}>
      
      {/* 1. TOP SHOWROOM HEADER & CONTROL STRIP */}
      <div className="bg-white/95 backdrop-blur-md rounded-3xl p-3.5 sm:p-4 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 text-white flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
            <Calculator size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-serif font-black text-base sm:text-lg text-slate-900 tracking-tight">
                Salesman Estimator
              </h1>
              <span className="bg-amber-100/80 text-amber-950 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full font-mono">
                {estimateId}
              </span>
              {autoSaveStatus === 'SAVED' && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 size={11} />
                  <span>Saved</span>
                </span>
              )}
              {autoSaveStatus === 'SAVING' && (
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                  <span>Saving...</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              Transparent live quote & labour breakdown engine
            </p>
          </div>
        </div>

        {/* Action Controls: Search, Showcase, Print, Fullscreen, New */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto flex-wrap justify-end">
          <button
            type="button"
            onClick={() => setShowSavedQuotesModal(true)}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all"
            title="Search all estimates"
          >
            <Search size={13} />
            <span>Quotes ({savedEstimates.length})</span>
          </button>

          <button
            type="button"
            onClick={handleToggleFullscreen}
            className={`px-3 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              isFullscreen 
                ? 'bg-amber-500 text-slate-950 font-black ring-2 ring-amber-400/40 shadow-sm' 
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen Mode"}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            <span className="hidden sm:inline">{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
          </button>

          <button
            type="button"
            onClick={() => setCustomerViewActive(!customerViewActive)}
            className={`px-3 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              customerViewActive 
                ? 'bg-emerald-600 text-white shadow-xs' 
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
            title="Customer Showcase Mode"
          >
            {customerViewActive ? <Eye size={13} /> : <EyeOff size={13} />}
            <span className="hidden sm:inline">{customerViewActive ? 'Showroom' : 'Showcase'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenPrintSlip()}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-colors"
            title="Print Quotation Slip"
          >
            <Printer size={13} />
            <span className="hidden sm:inline">Slip</span>
          </button>

          <button
            type="button"
            onClick={handleResetCalculator}
            className="px-3 py-2 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-colors"
            title="Reset to fresh calculation"
          >
            <RotateCcw size={13} />
            <span>New</span>
          </button>
        </div>
      </div>

      {/* 2. MODE SWITCHER SEGMENTED TABS (iOS Segmented Bar) */}
      {!customerViewActive && (
        <div className="bg-slate-100/90 p-1 rounded-2xl flex gap-1 border border-slate-200/60 shadow-2xs">
          <button
            type="button"
            onClick={() => setCalculatorMode('EXPRESS')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
              calculatorMode === 'EXPRESS'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/40'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Zap size={14} className={calculatorMode === 'EXPRESS' ? 'text-amber-500 fill-amber-500' : ''} />
            <span>Express Estimator (1-Screen)</span>
          </button>

          <button
            type="button"
            onClick={() => setCalculatorMode('WIZARD')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
              calculatorMode === 'WIZARD'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/40'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Layers size={14} className={calculatorMode === 'WIZARD' ? 'text-amber-600' : ''} />
            <span>Multi-Item & EMI Wizard ({recalculatedCartItems.length})</span>
          </button>
        </div>
      )}

      {/* 3. CUSTOMER SHOWCASE VIEW (IF TOGGLED) */}
      {customerViewActive ? (
        <CustomerShowcaseView
          customerName={customerName}
          estimateId={estimateId}
          rate22K={rate22K}
          recalculatedCartItems={recalculatedCartItems}
          grossCartTotal={cartTotals.grossCartTotal}
          enableOldGold={enableOldGold}
          oldGoldCredit={oldGoldTotals.totalCredit}
          discountAmount={discountAmount}
          netPayable={planType === 'PLAN' ? netPayableAfterSubvention : netPayable}
          planType={planType}
          selectedPlanName={selectedPlanName}
          planMonths={planMonths}
          planCalculations={planCalculations}
          onCloseShowcase={() => setCustomerViewActive(false)}
        />
      ) : calculatorMode === 'EXPRESS' ? (
        /* --- EXPRESS QUICK ESTIMATOR (1-SCREEN LIVE RATE & BREAKDOWN) --- */
        <ExpressQuickEstimator
          rate24K={rate24K}
          rate22K={rate22K}
          rate18K={rate18K}
          rate14K={rate14K}
          rateSilver={rateSilver}
          onOpenRateModal={() => setShowRateModal(true)}
          onRefreshRates={onRefreshRates}
          refreshingRates={refreshingRates}
          customerName={customerName}
          setCustomerName={setCustomerName}
          customerContact={customerContact}
          setCustomerContact={setCustomerContact}
          customerCity={customerCity}
          setCustomerCity={setCustomerCity}
          estimateId={estimateId}
          discountAmount={discountAmount}
          setDiscountAmount={setDiscountAmount}
          taxRate={taxRate}
          enableOldGold={enableOldGold}
          setEnableOldGold={setEnableOldGold}
          oldGoldGrossWeight={expressOldGoldGrossWeight}
          setOldGoldGrossWeight={setExpressOldGoldGrossWeight}
          oldGoldPurity={expressOldGoldPurity}
          setOldGoldPurity={setExpressOldGoldPurity}
          oldGoldRate={expressOldGoldRate}
          setOldGoldRate={setExpressOldGoldRate}
          oldGoldCredit={expressOldGoldCredit}
          onExpressItemChange={setActiveExpressItem}
          onAddToCart={handleAddToCartFromExpress}
          onShareWhatsApp={handleShareWhatsApp}
          onCopyQuote={handleCopyText}
          onToggleCustomerView={() => setCustomerViewActive(true)}
          onPrintSlip={(item) => handleOpenPrintSlip(undefined, item)}
          onConvertEstimateToOrder={handleConvertEstimateToOrder}
          onSaveEstimateManual={handleSaveEstimateManual}
          copiedText={copiedText}
          autoSaveStatus={autoSaveStatus}
          isFullscreen={isFullscreen}
          onToggleFullscreen={handleToggleFullscreen}
        />
      ) : (
        /* --- WIZARD MODE: 4-STEP MULTI-ITEM & EMI SIMULATOR --- */
        <>
          <WizardStepNav
            currentStep={currentStep}
            setCurrentStep={setCurrentStep}
            cartItemCount={recalculatedCartItems.length}
            enableOldGold={enableOldGold}
            oldGoldItemCount={recalculatedOldGoldItems.length}
            netPayableAmount={planType === 'PLAN' ? netPayableAfterSubvention : netPayable}
          />

          {/* STEP 1: CUSTOMER & BENCHMARK RATES */}
          {currentStep === 1 && (
            <Step1CustomerRates
              customerName={customerName}
              setCustomerName={setCustomerName}
              customerContact={customerContact}
              setCustomerContact={setCustomerContact}
              customerCity={customerCity}
              setCustomerCity={setCustomerCity}
              customers={customers}
              showCustomerSearch={showCustomerSearch}
              setShowCustomerSearch={setShowCustomerSearch}
              rate24K={rate24K}
              rate22K={rate22K}
              rate18K={rate18K}
              rate14K={rate14K}
              rateSilver={rateSilver}
              isCustomRate={isCustomRate}
              refreshingRates={refreshingRates}
              onRefreshRates={onRefreshRates}
              onOpenRateModal={() => setShowRateModal(true)}
            />
          )}

          {/* STEP 2: SELECTED JEWELLERY CART */}
          {currentStep === 2 && (
            <Step2JewelryCart
              cartItems={cartItems}
              recalculatedCartItems={recalculatedCartItems}
              cartTotals={cartTotals}
              expandedBifurcationId={expandedBifurcationId}
              setExpandedBifurcationId={setExpandedBifurcationId}
              onOpenAddItemModal={handleOpenAddItemModal}
              onEditItem={handleEditItem}
              onDeleteItem={handleDeleteItem}
            />
          )}

          {/* STEP 3: OLD GOLD EXCHANGE & SCRAP TRADE-IN */}
          {currentStep === 3 && (
            <Step3OldGoldTradeIn
              enableOldGold={enableOldGold}
              setEnableOldGold={setEnableOldGold}
              oldGoldItems={oldGoldItems}
              recalculatedOldGoldItems={recalculatedOldGoldItems}
              oldGoldTotals={oldGoldTotals}
              netWeightDifference={netWeightDifference}
              onOpenAddOldGoldModal={handleOpenAddOldGoldModal}
              onEditOldGoldItem={handleEditOldGoldItem}
              onDeleteOldGoldItem={handleDeleteOldGoldItem}
            />
          )}

          {/* STEP 4: FINAL PAYMENT & QUOTATION SETTLEMENT */}
          {currentStep === 4 && (
            <Step4PaymentQuotation
              grossCartTotal={cartTotals.grossCartTotal}
              enableOldGold={enableOldGold}
              oldGoldCredit={oldGoldTotals.totalCredit}
              discountAmount={discountAmount}
              setDiscountAmount={setDiscountAmount}
              netPayable={netPayable}
              subventionDiscountAmount={subventionDiscountAmount}
              netPayableAfterSubvention={netPayableAfterSubvention}
              planType={planType}
              setPlanType={setPlanType}
              activePlanTemplates={activePlanTemplates}
              selectedRangeFilter={selectedRangeFilter}
              setSelectedRangeFilter={setSelectedRangeFilter}
              selectedTemplateId={selectedTemplateId}
              setSelectedTemplateId={setSelectedTemplateId}
              selectedPlanName={selectedPlanName}
              setSelectedPlanName={setSelectedPlanName}
              planMonths={planMonths}
              setPlanMonths={setPlanMonths}
              planAdvancePercent={planAdvancePercent}
              setPlanAdvancePercent={setPlanAdvancePercent}
              planAdvanceAmount={planAdvanceAmount}
              setPlanAdvanceAmount={setPlanAdvanceAmount}
              useOldGoldAsAdvance={useOldGoldAsAdvance}
              setUseOldGoldAsAdvance={setUseOldGoldAsAdvance}
              planInterestPercent={planInterestPercent}
              setPlanInterestPercent={setPlanInterestPercent}
              subventionPercentage={subventionPercentage}
              setSubventionPercentage={setSubventionPercentage}
              rateProtectionEnabled={rateProtectionEnabled}
              setRateProtectionEnabled={setRateProtectionEnabled}
              planCalculations={planCalculations}
              rate22K={rate22K}
              copiedText={copiedText}
              onShareWhatsApp={handleShareWhatsApp}
              onCopyText={handleCopyText}
              onConvertEstimateToOrder={handleConvertEstimateToOrder}
              onSaveEstimate={handleSaveEstimateManual}
              onToggleCustomerView={() => setCustomerViewActive(true)}
              customerViewActive={customerViewActive}
            />
          )}
        </>
      )}

      {/* 4. MODALS CONTAINER */}
      <SalesmanModals
        showItemModal={showItemModal}
        setShowItemModal={setShowItemModal}
        editingItemId={editingItemId}
        itemForm={itemForm}
        setItemForm={setItemForm}
        onSaveItemForm={handleSaveItemForm}

        showOldGoldModal={showOldGoldModal}
        setShowOldGoldModal={setShowOldGoldModal}
        editingOldGoldId={editingOldGoldId}
        oldGoldForm={oldGoldForm}
        setOldGoldForm={setOldGoldForm}
        onSaveOldGoldForm={handleSaveOldGoldForm}
        getOldGoldBenchmarkRate={getOldGoldBenchmarkRate}

        showRateModal={showRateModal}
        setShowRateModal={setShowRateModal}
        rate22K={rate22K}
        setRate22K={setRate22K}
        rate24K={rate24K}
        setRate24K={setRate24K}
        rate18K={rate18K}
        setRate18K={setRate18K}
        rate14K={rate14K}
        setRate14K={setRate14K}
        rateSilver={rateSilver}
        setRateSilver={setRateSilver}
        setIsCustomRate={setIsCustomRate}
        defaultSettings24K={settings.currentGoldRate24K || 7500}
        defaultSettings22K={settings.currentGoldRate22K || 6875}
        defaultSettings18K={settings.currentGoldRate18K || 5625}
        defaultSettingsSilver={settings.currentSilverRate || 92}

        showSavedQuotesModal={showSavedQuotesModal}
        setShowSavedQuotesModal={setShowSavedQuotesModal}
        savedEstimates={savedEstimates}
        onLoadEstimate={handleLoadEstimate}
        onDeleteSavedEstimate={(id) => {
          const updated = savedEstimates.filter(e => e.id !== id);
          setSavedEstimates(updated);
          localStorage.setItem('auragold_saved_estimates', JSON.stringify(updated));
          fetch(`/api/sync/estimates/${id}`, { method: 'DELETE' }).catch(() => {});
        }}
        onPrintEstimate={(est) => handleOpenPrintSlip(est)}
        onShareWhatsApp={(est) => {
          handleLoadEstimate(est);
          handleShareWhatsApp();
        }}
      />

      {/* 5. PRINTABLE QUOTATION SLIP MODAL */}
      <QuotationPrintSlip
        show={showPrintModal}
        onClose={() => {
          setShowPrintModal(false);
          setSelectedPrintEstimate(null);
        }}
        estimate={selectedPrintEstimate}
        settings={settings}
      />

    </div>
  );
};

export default SalesmanCalculator;
