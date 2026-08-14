import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calculator, Bookmark, Download, RotateCcw, Eye, EyeOff, Sparkles, Check
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
      category: 'Necklace',
      metalColor: 'Yellow Gold',
      grossWeight: 22.500,
      netWeight: 21.000,
      wastagePercentage: 10,
      wastageValue: 0,
      makingChargesPerGram: 550,
      totalLaborValue: 0,
      stoneCharges: 3500,
      stoneDetails: 'CZ & Semi-precious Ruby (1.500g)',
      otherCharges: 45, // Hallmarking
      purity: '22K',
      taxAmount: 0,
      baseMetalValue: 0,
      finalAmount: 0,
      customizationDetails: '22K Bridal Choker Necklace',
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

  // UI Presentation Mode
  const [customerViewActive, setCustomerViewActive] = useState(false);
  const [expandedBifurcationId, setExpandedBifurcationId] = useState<string | null>(null);
  const [savedEstimates, setSavedEstimates] = useState<SalesmanEstimate[]>([]);
  const [showSavedQuotesModal, setShowSavedQuotesModal] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [conversionSuccess, setConversionSuccess] = useState<string | null>(null);

  // Load saved estimates from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('auragold_saved_estimates');
      if (stored) setSavedEstimates(JSON.parse(stored));
    } catch(e) {}
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
    const totalGrossWeight = Number(recalculatedCartItems.reduce((sum, i) => sum + (Number(i.grossWeight) || 0), 0).toFixed(3));
    const totalNetWeight = Number(recalculatedCartItems.reduce((sum, i) => sum + (Number(i.netWeight) || 0), 0).toFixed(3));
    const totalMetalValue = recalculatedCartItems.reduce((sum, i) => sum + i.baseMetalValue, 0);
    const totalWastageValue = recalculatedCartItems.reduce((sum, i) => sum + i.wastageValue, 0);
    const totalMakingValue = recalculatedCartItems.reduce((sum, i) => sum + i.totalLaborValue, 0);
    const totalStoneValue = recalculatedCartItems.reduce((sum, i) => sum + (i.stoneCharges || 0), 0);
    const totalOtherCharges = recalculatedCartItems.reduce((sum, i) => sum + (i.otherCharges || 0), 0);
    const subTotalPreTax = totalMetalValue + totalWastageValue + totalMakingValue + totalStoneValue + totalOtherCharges;
    const totalGst = recalculatedCartItems.reduce((sum, i) => sum + i.taxAmount, 0);
    const grossCartTotal = recalculatedCartItems.reduce((sum, i) => sum + i.finalAmount, 0);

    return {
      totalGrossWeight,
      totalNetWeight,
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

  // --- OLD GOLD RECALCULATIONS ---
  const recalculatedOldGoldItems = useMemo(() => {
    return oldGoldItems.map(item => {
      const gross = Number(item.grossWeight) || 0;
      const deduction = Number(item.deductionWeight) || 0;
      const netMelt = Math.max(0, gross - deduction);
      const lossPct = Number(item.meltingLossPercentage) || 0;
      const netAfterLoss = netMelt * (1 - (lossPct / 100));

      let purityFraction = 0.916;
      if (item.metalType === 'SILVER') {
        if (item.purity === '925') purityFraction = 0.925;
        else if (item.purity === '800') purityFraction = 0.800;
        else if (item.purity === 'CUSTOM') purityFraction = (Number(item.customPurityPercent) || 92.5) / 100;
        else purityFraction = 0.999;
      } else {
        if (item.purity === '24K') purityFraction = 0.999;
        else if (item.purity === '22K') purityFraction = 0.916;
        else if (item.purity === '20K') purityFraction = 0.833;
        else if (item.purity === '18K') purityFraction = 0.750;
        else if (item.purity === '14K') purityFraction = 0.585;
        else if (item.purity === 'CUSTOM') purityFraction = (Number(item.customPurityPercent) || 91.6) / 100;
      }

      const fineGoldWeight = Number((netAfterLoss * purityFraction).toFixed(3));
      const defaultBenchmarkRate = getOldGoldBenchmarkRate(item.metalType, item.purity, item.customPurityPercent);
      const rate = Number(item.ratePerGram) || defaultBenchmarkRate;
      const exchangeValue = Math.round(netAfterLoss * rate);

      return {
        ...item,
        netMeltingWeight: Number(netMelt.toFixed(3)),
        fineGoldWeight,
        ratePerGram: rate,
        exchangeValue
      };
    });
  }, [oldGoldItems, rate24K, rate22K, rate18K, rate14K, rateSilver]);

  const oldGoldTotals = useMemo(() => {
    const totalGrossWeight = Number(recalculatedOldGoldItems.reduce((sum, i) => sum + i.grossWeight, 0).toFixed(3));
    const totalNetMeltWeight = Number(recalculatedOldGoldItems.reduce((sum, i) => sum + i.netMeltingWeight, 0).toFixed(3));
    const totalFineWeight = Number(recalculatedOldGoldItems.reduce((sum, i) => sum + (i.fineGoldWeight || 0), 0).toFixed(3));
    const totalCredit = recalculatedOldGoldItems.reduce((sum, i) => sum + i.exchangeValue, 0);

    return {
      itemCount: recalculatedOldGoldItems.length,
      totalGrossWeight,
      totalNetMeltWeight,
      totalFineWeight,
      totalCredit
    };
  }, [recalculatedOldGoldItems]);

  // --- FINAL NET SETTLEMENT CALCULATION ---
  const netPayable = useMemo(() => {
    const gross = cartTotals.grossCartTotal;
    const oldGoldCredit = enableOldGold ? oldGoldTotals.totalCredit : 0;
    const discount = discountAmount || 0;
    return Math.max(0, gross - oldGoldCredit - discount);
  }, [cartTotals.grossCartTotal, enableOldGold, oldGoldTotals.totalCredit, discountAmount]);

  const subventionDiscountAmount = useMemo(() => {
    if (planType !== 'PLAN' || !subventionPercentage || subventionPercentage <= 0) return 0;
    return Math.round(cartTotals.grossCartTotal * (subventionPercentage / 100));
  }, [planType, subventionPercentage, cartTotals.grossCartTotal]);

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

    // 1. Calculate Required Down Payment (either fixed amount or percentage of gross)
    let requiredDownPayment = 0;
    if (planAdvanceAmount > 0) {
      requiredDownPayment = Math.min(commercialGross, planAdvanceAmount);
    } else if (planAdvancePercent > 0) {
      requiredDownPayment = Math.round(commercialGross * (planAdvancePercent / 100));
    } else {
      requiredDownPayment = 0;
    }

    // 2. Deduct Old Gold from Down Payment & compute Net Down Payment to pay today
    let netDownPaymentPayable = 0;
    let oldGoldAppliedToDownPayment = 0;
    let oldGoldSurplusToEMI = 0;
    let totalAdvanceValue = 0;

    if (enableOldGold && oldGoldCredit > 0) {
      if (oldGoldCredit >= requiredDownPayment) {
        // Old gold exceeds or matches required down payment: customer pays ₹0 additional upfront
        netDownPaymentPayable = 0;
        oldGoldAppliedToDownPayment = requiredDownPayment;
        oldGoldSurplusToEMI = oldGoldCredit - requiredDownPayment;
        totalAdvanceValue = oldGoldCredit;
      } else {
        // Old gold is less than required down payment: customer pays the difference
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

    // 3. Calculate remaining balance to be financed over the selected plan duration
    const principalFinanced = Math.max(0, commercialGross - totalAdvanceValue);
    const interestAmount = Math.round(principalFinanced * (planInterestPercent / 100) * (planMonths / 12));
    const totalFinanced = principalFinanced + interestAmount;
    const totalPayableWithPlan = totalAdvanceValue + totalFinanced;
    const totalCustomerCashOutflow = netDownPaymentPayable + totalFinanced;
    const monthlyInstallment = planMonths > 0 ? Math.round(totalFinanced / planMonths) : totalFinanced;

    // 4. Generate Milestones for booking and tracking
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

  // --- WHATSAPP ESTIMATE BUILDER ---
  const constructWhatsAppEstimateMessage = () => {
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

    msg += `🛍️ *SELECTED JEWELLERY (${recalculatedCartItems.length} Items):*\n`;
    recalculatedCartItems.forEach((item, idx) => {
      msg += `*${idx + 1}. ${item.customizationDetails || `${item.purity} ${item.category}`} (${item.purity})*\n`;
      msg += `  • Net Wt: ${item.netWeight}g @ ₹${getPurityRate(item.purity, item.metalColor)}/g\n`;
      if (item.wastagePercentage > 0) msg += `  • Wastage (${item.wastagePercentage}%): ₹${item.wastageValue.toLocaleString('en-IN')}\n`;
      if (item.makingChargesPerGram > 0) msg += `  • Making/Labor: ₹${item.totalLaborValue.toLocaleString('en-IN')} (₹${item.makingChargesPerGram}/g)\n`;
      if (item.stoneCharges > 0) msg += `  • Stones: ₹${item.stoneCharges.toLocaleString('en-IN')}\n`;
      msg += `  • GST (3%): ₹${item.taxAmount.toLocaleString('en-IN')}\n`;
      msg += `  ➡️ *Item Total: ₹${item.finalAmount.toLocaleString('en-IN')}*\n\n`;
    });

    if (enableOldGold && recalculatedOldGoldItems.length > 0) {
      msg += `━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `🪙 *OLD GOLD / SCRAP TRADE-IN VALUE:*\n`;
      recalculatedOldGoldItems.forEach((og, idx) => {
        msg += `  ${idx + 1}. ${og.description} (${og.purity === 'CUSTOM' ? `${og.customPurityPercent}%` : og.purity})\n`;
        msg += `     Net Melt: ${og.netMeltingWeight}g @ ₹${og.ratePerGram}/g\n`;
        msg += `     Credit: ₹${og.exchangeValue.toLocaleString('en-IN')}\n`;
      });
      msg += `  ➡️ *Total Trade-in Credit: -₹${oldGoldTotals.totalCredit.toLocaleString('en-IN')}*\n\n`;
    }

    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `💰 *Gross Jewellery Total:* ₹${cartTotals.grossCartTotal.toLocaleString('en-IN')}\n`;
    if (enableOldGold && oldGoldTotals.totalCredit > 0) {
      msg += `🪙 *Old Gold Trade-in Credit:* -₹${oldGoldTotals.totalCredit.toLocaleString('en-IN')}\n`;
    }
    if (discountAmount > 0) {
      msg += `🏷️ *Showroom Goodwill Discount:* -₹${discountAmount.toLocaleString('en-IN')}\n`;
    }
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `⭐ *NET PAYABLE AMOUNT: ₹${(planType === 'PLAN' ? netPayableAfterSubvention : netPayable).toLocaleString('en-IN')}*\n`;
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
          if (planCalculations.oldGoldSurplusToEMI > 0) {
            msg += `   └ Surplus ₹${planCalculations.oldGoldSurplusToEMI.toLocaleString('en-IN')} Old Gold deducted from EMI balance\n`;
          }
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
      msg += `• Net Customer Cash Outflow: ₹${planCalculations.totalCustomerCashOutflow.toLocaleString('en-IN')}\n`;
      if (rateProtectionEnabled) {
        msg += `🛡️ *Gold Rate Protection:* Locked @ ₹${rate22K}/g\n`;
      }
    }

    msg += `\n📍 *AuraGold Elite Showroom*\n`;
    msg += `📞 *Sales Executive:* ${salesmanName}\n`;
    msg += `_Note: This estimate is valid for today's market rates._`;

    return msg;
  };

  const handleShareWhatsApp = () => {
    let targetPhone = customerContact ? customerContact.trim() : '';
    if (!targetPhone) {
      const phoneInput = prompt("Enter customer's 10-digit WhatsApp number (or leave blank to choose contact in WhatsApp):", "");
      if (phoneInput === null) return;
      if (phoneInput.trim()) {
        targetPhone = phoneInput.trim();
        setCustomerContact(targetPhone);
      }
    }

    const messageText = constructWhatsAppEstimateMessage();
    const encoded = encodeURIComponent(messageText);

    if (targetPhone) {
      const cleanPhone = targetPhone.replace(/[^0-9]/g, '');
      const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
      window.open(`https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encoded}`, '_blank');
    } else {
      window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
    }
  };

  const handleCopyText = () => {
    const text = constructWhatsAppEstimateMessage();
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2500);
  };

  // --- CONVERT TO FORMAL ORDER ---
  const handleConvertEstimateToOrder = () => {
    if (recalculatedCartItems.length === 0) {
      alert("Please add at least one jewellery product to convert into an order.");
      return;
    }

    const orderId = `ORD-${Date.now().toString().slice(-6)}`;
    const initialPayments: any[] = [];
    if (enableOldGold && oldGoldTotals.totalCredit > 0) {
      initialPayments.push({
        id: `PAY-OG-${Date.now()}`,
        amount: oldGoldTotals.totalCredit,
        date: new Date().toISOString().split('T')[0],
        method: 'OLD_GOLD',
        note: `Exchange Credit: ${oldGoldTotals.itemCount} item(s) (${oldGoldTotals.totalNetMeltWeight}g melt)`,
        orderId
      });
    }

    const lastMilestoneDate = planCalculations.milestones.length > 0
      ? planCalculations.milestones[planCalculations.milestones.length - 1].dueDate
      : new Date().toISOString().split('T')[0];

    const newOrder: Order = {
      id: orderId,
      shareToken: Math.random().toString(36).substring(2, 10),
      customerName: customerName || 'Walk-in Customer',
      customerContact: customerContact || '9999999999',
      items: recalculatedCartItems,
      payments: initialPayments,
      totalAmount: cartTotals.grossCartTotal,
      discountAmount: discountAmount,
      goldRateAtBooking: rate22K,
      status: OrderStatus.ACTIVE,
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.username || salesmanName,
      paymentPlan: {
        type: 'MANUAL',
        months: planType === 'PLAN' ? planMonths : 1,
        interestPercentage: planType === 'PLAN' ? planInterestPercent : 0,
        advancePercentage: planType === 'PLAN' ? planAdvancePercent : 100,
        goldRateProtection: planType === 'PLAN' ? rateProtectionEnabled : false,
        protectionLimit: settings.goldRateProtectionMax || 500,
        protectionRateBooked: rate22K,
        protectionDeadline: lastMilestoneDate,
        milestones: planCalculations.milestones,
        protectionStatus: (planType === 'PLAN' && rateProtectionEnabled) ? ProtectionStatus.ACTIVE : ProtectionStatus.NONE
      }
    };

    if (onConvertToOrder) {
      onConvertToOrder(newOrder);
    } else {
      setConversionSuccess(orderId);
      alert(`Estimate converted to Order ${orderId} successfully!`);
    }
  };

  // --- SAVE & LOAD ESTIMATES ---
  const handleSaveEstimate = () => {
    const currentEstimate: SalesmanEstimate = {
      id: estimateId,
      customerName: customerName || 'Walk-in Client',
      customerContact: customerContact || '',
      customerCity,
      date: new Date().toISOString(),
      items: recalculatedCartItems,
      oldGoldItems: enableOldGold ? recalculatedOldGoldItems : [],
      goldRate22K: rate22K,
      goldRate24K: rate24K,
      goldRate18K: rate18K,
      silverRate: rateSilver,
      discountAmount,
      taxRate,
      totalJewelryValue: cartTotals.subTotalPreTax,
      totalGstAmount: cartTotals.totalGst,
      grossCartAmount: cartTotals.grossCartTotal,
      totalOldGoldCredit: enableOldGold ? oldGoldTotals.totalCredit : 0,
      netPayableAmount: netPayable,
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

    const updated = [currentEstimate, ...savedEstimates.filter(e => e.id !== estimateId)].slice(0, 20);
    setSavedEstimates(updated);
    localStorage.setItem('auragold_saved_estimates', JSON.stringify(updated));
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
    <div className="space-y-5 pb-36 animate-fadeIn max-w-4xl mx-auto px-2 sm:px-4">
      
      {/* 1. TOP SHOWROOM HEADER & CONTROL STRIP */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 text-white flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
            <Calculator size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-serif font-black text-lg sm:text-xl text-slate-900 tracking-tight">
                Salesman Calculator
              </h1>
              <span className="bg-amber-100 text-amber-900 text-[10px] font-black uppercase px-2 py-0.5 rounded-full font-mono">
                {estimateId}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Interactive mobile wizard for instant jewellery quotation
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto flex-wrap">
          <button
            type="button"
            onClick={() => setCustomerViewActive(!customerViewActive)}
            className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-xs ${
              customerViewActive 
                ? 'bg-emerald-600 text-white ring-2 ring-emerald-500/30' 
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {customerViewActive ? <Eye size={13} /> : <EyeOff size={13} />}
            <span>{customerViewActive ? 'Showroom' : 'Showcase'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSavedQuotesModal(true)}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <Bookmark size={13} />
            <span>Saved ({savedEstimates.length})</span>
          </button>

          <button
            type="button"
            onClick={handleResetCalculator}
            className="px-3 py-2 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
            title="Reset to fresh calculation"
          >
            <RotateCcw size={13} />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* 2. WIZARD STEP NAVIGATOR */}
      <WizardStepNav
        currentStep={currentStep}
        setCurrentStep={setCurrentStep}
        cartItemCount={recalculatedCartItems.length}
        enableOldGold={enableOldGold}
        oldGoldItemCount={recalculatedOldGoldItems.length}
        netPayableAmount={planType === 'PLAN' ? netPayableAfterSubvention : netPayable}
      />

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
      ) : (
        <>
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
              onSaveEstimate={handleSaveEstimate}
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
        }}
      />

    </div>
  );
};

export default SalesmanCalculator;
