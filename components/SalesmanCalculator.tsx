import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calculator, Plus, Trash2, Edit2, Share2, Printer, Sparkles, Check, 
  ArrowRight, Coins, RefreshCw, Layers, ShieldCheck, Percent, 
  ReceiptIndianRupee, Scale, ChevronDown, ChevronUp, Eye, EyeOff, 
  CheckCircle2, AlertCircle, Send, FileText, Smartphone, Info, Copy, X,
  Gem, User, Phone, MapPin, Tag, Calendar, Download, Bookmark, RotateCcw,
  Sliders, Award, CheckCircle, HelpCircle
} from 'lucide-react';
import { 
  GlobalSettings, JewelryDetail, ProductionStatus, Purity, 
  PaymentPlan, PaymentPlanTemplate, Customer, AuthUser, Order, OrderStatus,
  OldGoldExchangeItem, SalesmanEstimate, ProtectionStatus
} from '../types';
import { INITIAL_PLAN_TEMPLATES } from '../constants';
import { Card, Badge, Button, SectionHeader } from './shared/BaseUI';
import { goldRateService } from '../services/goldRateService';

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
  
  // Available Range-Based Payment Schemes (Source of truth from PlanManager or constants)
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
  const [subventionNote, setSubventionNote] = useState<string>('2% Subvention Discount Applied');
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

    // 1. Pure Metal Value (Net Weight * Rate)
    const baseMetalValue = Math.round(net * currentRate);

    // 2. Wastage / Value Addition (VA)
    const wastagePct = Number(item.wastagePercentage) || 0;
    const wastageValue = Math.round(baseMetalValue * (wastagePct / 100));

    // 3. Making / Craftsmanship Charges
    const makingPerGram = Number(item.makingChargesPerGram) || 0;
    const totalLaborValue = Math.round(makingPerGram * net);

    // 4. Stones & Gemstones
    const stoneCharges = Number(item.stoneCharges) || 0;

    // 5. Hallmark & Other Fees (HUID)
    const otherCharges = Number(item.otherCharges) || 45;

    // Subtotal before statutory taxes
    const preTaxTotal = baseMetalValue + wastageValue + totalLaborValue + stoneCharges + otherCharges;

    // 6. GST (3%)
    const taxAmount = Math.round(preTaxTotal * (taxRate / 100));

    // Final Item Total
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

  // --- OLD GOLD RECALCULATIONS (SYNCS BENCHMARK APP RATES & CUSTOM PURITY) ---
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

  // Subvention Discount / Subsidy calculation
  const subventionDiscountAmount = useMemo(() => {
    if (planType !== 'PLAN' || !subventionPercentage || subventionPercentage <= 0) return 0;
    return Math.round(cartTotals.grossCartTotal * (subventionPercentage / 100));
  }, [planType, subventionPercentage, cartTotals.grossCartTotal]);

  // Effective net after subvention subsidy
  const netPayableAfterSubvention = useMemo(() => {
    return Math.max(0, netPayable - subventionDiscountAmount);
  }, [netPayable, subventionDiscountAmount]);

  // Net Metal Weight Differential
  const netWeightDifference = useMemo(() => {
    const oldWeight = enableOldGold ? oldGoldTotals.totalNetMeltWeight : 0;
    return Number((cartTotals.totalNetWeight - oldWeight).toFixed(3));
  }, [cartTotals.totalNetWeight, enableOldGold, oldGoldTotals.totalNetMeltWeight]);

  // --- PAYMENT PLAN & INSTALLMENT CALCULATIONS (WITH RANGE-BASED SCHEMES & SUBVENTIONS) ---
  const planCalculations = useMemo(() => {
    let calculatedAdvance = 0;
    const oldGoldCredit = enableOldGold ? oldGoldTotals.totalCredit : 0;
    
    if (useOldGoldAsAdvance && oldGoldCredit > 0) {
      calculatedAdvance = oldGoldCredit;
    } else {
      calculatedAdvance = planAdvanceAmount > 0 
        ? planAdvanceAmount 
        : Math.round(netPayableAfterSubvention * (planAdvancePercent / 100));
    }

    const principalFinanced = Math.max(0, netPayableAfterSubvention - (useOldGoldAsAdvance ? 0 : calculatedAdvance));
    const interestAmount = Math.round(principalFinanced * (planInterestPercent / 100) * (planMonths / 12));
    const totalPayableWithPlan = (useOldGoldAsAdvance ? 0 : calculatedAdvance) + principalFinanced + interestAmount;
    const monthlyInstallment = planMonths > 0 ? Math.round((principalFinanced + interestAmount) / planMonths) : principalFinanced;

    // Generate monthly milestones schedule
    const milestones = [];
    const today = new Date();
    
    // Initial Advance Milestone
    if (calculatedAdvance > 0) {
      milestones.push({
        id: `M-ADV-${Date.now()}`,
        dueDate: today.toISOString().split('T')[0],
        targetAmount: calculatedAdvance,
        cumulativeTarget: calculatedAdvance,
        status: (useOldGoldAsAdvance ? 'PAID' : 'PENDING') as 'PAID' | 'PENDING',
        warningCount: 0,
        description: useOldGoldAsAdvance ? 'Down Payment (Old Gold Exchange Credit)' : 'Initial Advance Payment'
      });
    }

    let runningSum = calculatedAdvance;
    for (let i = 1; i <= planMonths; i++) {
      const dueDate = new Date(today);
      dueDate.setMonth(today.getMonth() + i);
      runningSum += monthlyInstallment;
      
      milestones.push({
        id: `M-${i}-${Date.now()}`,
        dueDate: dueDate.toISOString().split('T')[0],
        targetAmount: monthlyInstallment,
        cumulativeTarget: runningSum,
        status: 'PENDING' as 'PENDING',
        warningCount: 0,
        description: `Installment ${i} of ${planMonths}`
      });
    }

    return {
      advancePaid: calculatedAdvance,
      principalFinanced,
      interestAmount,
      totalPayableWithPlan,
      monthlyInstallment,
      subventionSavings: subventionDiscountAmount,
      milestones
    };
  }, [netPayableAfterSubvention, enableOldGold, oldGoldTotals.totalCredit, useOldGoldAsAdvance, planAdvanceAmount, planAdvancePercent, planInterestPercent, planMonths, subventionDiscountAmount]);

  // Handle Apply Range-Based Scheme Template
  const handleApplyTemplate = (tpl: PaymentPlanTemplate) => {
    setSelectedTemplateId(tpl.id);
    setSelectedPlanName(tpl.name);
    setPlanMonths(tpl.months);
    setPlanAdvancePercent(tpl.advancePercentage);
    setPlanInterestPercent(tpl.interestPercentage);
    setSubventionPercentage(tpl.subventionPercentage || 0);
    setSubventionNote(tpl.subventionNote || '');
    setPlanType('PLAN');
  };

  // --- ITEM FORM HANDLERS ---
  const handleOpenAddItem = (presetCategory?: string) => {
    setEditingItemId(null);
    setItemForm({
      category: presetCategory || 'Ring',
      metalColor: 'Yellow Gold',
      purity: '22K',
      grossWeight: presetCategory === 'Necklace' ? 20.0 : presetCategory === 'Bangles' ? 24.0 : presetCategory === 'Chain' ? 12.0 : 5.5,
      netWeight: presetCategory === 'Necklace' ? 19.0 : presetCategory === 'Bangles' ? 24.0 : presetCategory === 'Chain' ? 12.0 : 5.0,
      wastagePercentage: 10,
      makingChargesPerGram: 550,
      stoneCharges: 0,
      stoneDetails: '',
      otherCharges: 45,
      customizationDetails: ''
    });
    setShowItemModal(true);
  };

  const handleOpenEditItem = (item: JewelryDetail) => {
    setEditingItemId(item.id);
    setItemForm({ ...item });
    setShowItemModal(true);
  };

  const handleSaveItemForm = () => {
    const gross = parseFloat(itemForm.grossWeight as any) || 0;
    const net = parseFloat(itemForm.netWeight as any) || gross;
    if (net <= 0) {
      alert("Please enter a valid net weight greater than 0.");
      return;
    }

    const calculated = calculateItemBifurcation(itemForm);

    const newItem: JewelryDetail = {
      id: editingItemId || `ITEM-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      category: itemForm.category || 'Jewellery',
      metalColor: itemForm.metalColor as any || 'Yellow Gold',
      purity: itemForm.purity as any || '22K',
      grossWeight: calculated.grossWeight,
      netWeight: calculated.netWeight,
      wastagePercentage: calculated.wastagePercentage,
      wastageValue: calculated.wastageValue,
      makingChargesPerGram: calculated.makingChargesPerGram,
      totalLaborValue: calculated.totalLaborValue,
      stoneCharges: calculated.stoneCharges,
      stoneDetails: itemForm.stoneDetails || '',
      otherCharges: calculated.otherCharges,
      taxAmount: calculated.taxAmount,
      baseMetalValue: calculated.baseMetalValue,
      finalAmount: calculated.finalAmount,
      customizationDetails: itemForm.customizationDetails || `${itemForm.purity} ${itemForm.category}`,
      productionStatus: ProductionStatus.DESIGNING,
      photoUrls: itemForm.photoUrls || []
    };

    if (editingItemId) {
      setCartItems(prev => prev.map(i => i.id === editingItemId ? newItem : i));
    } else {
      setCartItems(prev => [...prev, newItem]);
    }

    setShowItemModal(false);
  };

  // Fixed delete item: removes item cleanly without blocking
  const handleDeleteItem = (id: string) => {
    setCartItems(prev => prev.filter(i => i.id !== id));
  };

  // Quick inline update for an item in the cart (for instant responsive sliders/inputs)
  const handleQuickUpdateItem = (id: string, updates: Partial<JewelryDetail>) => {
    setCartItems(prev => prev.map(item => {
      if (item.id === id) {
        const merged = { ...item, ...updates };
        const calc = calculateItemBifurcation(merged);
        return {
          ...merged,
          baseMetalValue: calc.baseMetalValue,
          wastageValue: calc.wastageValue,
          totalLaborValue: calc.totalLaborValue,
          taxAmount: calc.taxAmount,
          finalAmount: calc.finalAmount
        };
      }
      return item;
    }));
  };

  // --- OLD GOLD FORM HANDLERS ---
  const handleOpenAddOldGold = () => {
    setEditingOldGoldId(null);
    setOldGoldForm({
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
    setEnableOldGold(true);
    setShowOldGoldModal(true);
  };

  const handleOpenEditOldGold = (item: OldGoldExchangeItem) => {
    setEditingOldGoldId(item.id);
    setOldGoldForm({ ...item });
    setShowOldGoldModal(true);
  };

  const handleSaveOldGoldForm = () => {
    const gross = parseFloat(oldGoldForm.grossWeight as any) || 0;
    const deduction = parseFloat(oldGoldForm.deductionWeight as any) || 0;
    const netMelt = Math.max(0, gross - deduction);
    if (netMelt <= 0) {
      alert("Please enter a valid old gold gross weight.");
      return;
    }

    const lossPct = parseFloat(oldGoldForm.meltingLossPercentage as any) || 0;
    const netAfterLoss = netMelt * (1 - lossPct / 100);
    
    let purityFraction = 0.916;
    if (oldGoldForm.metalType === 'SILVER') {
      purityFraction = oldGoldForm.purity === '925' ? 0.925 : 0.80;
    } else {
      if (oldGoldForm.purity === '24K') purityFraction = 0.999;
      else if (oldGoldForm.purity === '22K') purityFraction = 0.916;
      else if (oldGoldForm.purity === '20K') purityFraction = 0.833;
      else if (oldGoldForm.purity === '18K') purityFraction = 0.750;
      else if (oldGoldForm.purity === '14K') purityFraction = 0.585;
      else if (oldGoldForm.purity === 'CUSTOM') purityFraction = (parseFloat(oldGoldForm.customPurityPercent as any) || 91.6) / 100;
    }

    const fineWeight = Number((netAfterLoss * purityFraction).toFixed(3));
    const defaultBenchmarkRate = getOldGoldBenchmarkRate(oldGoldForm.metalType || 'GOLD', oldGoldForm.purity || '22K', oldGoldForm.customPurityPercent);
    const rate = parseFloat(oldGoldForm.ratePerGram as any) || defaultBenchmarkRate;
    const exchangeVal = Math.round(netAfterLoss * rate);

    const newOldGoldItem: OldGoldExchangeItem = {
      id: editingOldGoldId || `OG-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      description: oldGoldForm.description || 'Customer Old Gold Scrap',
      metalType: oldGoldForm.metalType || 'GOLD',
      grossWeight: gross,
      deductionWeight: deduction,
      netMeltingWeight: netMelt,
      purity: oldGoldForm.purity || '22K',
      customPurityPercent: oldGoldForm.customPurityPercent,
      meltingLossPercentage: lossPct,
      fineGoldWeight: fineWeight,
      ratePerGram: rate,
      exchangeValue: exchangeVal
    };

    if (editingOldGoldId) {
      setOldGoldItems(prev => prev.map(i => i.id === editingOldGoldId ? newOldGoldItem : i));
    } else {
      setOldGoldItems(prev => [...prev, newOldGoldItem]);
    }

    setShowOldGoldModal(false);
  };

  // Quick inline update for old gold items
  const handleQuickUpdateOldGold = (id: string, updates: Partial<OldGoldExchangeItem>) => {
    setOldGoldItems(prev => prev.map(item => {
      if (item.id === id) {
        const merged = { ...item, ...updates };
        const gross = Number(merged.grossWeight) || 0;
        const deduction = Number(merged.deductionWeight) || 0;
        const netMelt = Math.max(0, gross - deduction);
        const lossPct = Number(merged.meltingLossPercentage) || 0;
        const netAfterLoss = netMelt * (1 - lossPct / 100);
        
        let purityFraction = 0.916;
        if (merged.metalType === 'SILVER') {
          if (merged.purity === '925') purityFraction = 0.925;
          else if (merged.purity === '800') purityFraction = 0.800;
          else if (merged.purity === 'CUSTOM') purityFraction = (Number(merged.customPurityPercent) || 92.5) / 100;
          else purityFraction = 0.999;
        } else {
          if (merged.purity === '24K') purityFraction = 0.999;
          else if (merged.purity === '22K') purityFraction = 0.916;
          else if (merged.purity === '20K') purityFraction = 0.833;
          else if (merged.purity === '18K') purityFraction = 0.750;
          else if (merged.purity === '14K') purityFraction = 0.585;
          else if (merged.purity === 'CUSTOM') purityFraction = (Number(merged.customPurityPercent) || 91.6) / 100;
        }

        const fineWeight = Number((netAfterLoss * purityFraction).toFixed(3));
        const defaultRate = getOldGoldBenchmarkRate(merged.metalType, merged.purity, merged.customPurityPercent);
        const rate = Number(merged.ratePerGram) || defaultRate;
        const exchangeValue = Math.round(netAfterLoss * rate);

        return {
          ...merged,
          netMeltingWeight: Number(netMelt.toFixed(3)),
          fineGoldWeight: fineWeight,
          ratePerGram: rate,
          exchangeValue
        };
      }
      return item;
    }));
  };

  // Fixed delete old gold: removes without error
  const handleDeleteOldGold = (id: string) => {
    setOldGoldItems(prev => {
      const next = prev.filter(i => i.id !== id);
      if (next.length === 0) setEnableOldGold(false);
      return next;
    });
  };

  // --- WHATSAPP ESTIMATE GENERATOR ---
  const constructWhatsAppEstimateMessage = () => {
    const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    let msg = `✨ *AURAGOLD JEWELLERS — ESTIMATE QUOTATION* ✨\n`;
    msg += `📋 *Quote ID:* ${estimateId}\n`;
    msg += `📅 *Date:* ${dateStr}\n`;
    if (customerName) msg += `👤 *Customer:* ${customerName} ${customerContact ? `(${customerContact})` : ''}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📈 *TODAY'S BENCHMARK RATES:*\n`;
    msg += `• 22K (916 Hallmark): ₹${rate22K.toLocaleString('en-IN')}/g\n`;
    msg += `• 24K Pure Gold: ₹${rate24K.toLocaleString('en-IN')}/g\n`;
    msg += `• 18K Diamond Gold: ₹${rate18K.toLocaleString('en-IN')}/g\n`;
    msg += `• Silver: ₹${rateSilver.toLocaleString('en-IN')}/g\n\n`;

    msg += `🛍️ *SELECTED JEWELLERY (${recalculatedCartItems.length} Items):*\n`;
    recalculatedCartItems.forEach((item, idx) => {
      msg += `*${idx + 1}. ${item.customizationDetails || item.category} (${item.purity})*\n`;
      msg += `  • Net Wt: ${item.netWeight}g @ ₹${getPurityRate(item.purity, item.metalColor)}/g\n`;
      msg += `  • Wastage (${item.wastagePercentage}%): ₹${item.wastageValue.toLocaleString('en-IN')}\n`;
      msg += `  • Making/Labor: ₹${item.totalLaborValue.toLocaleString('en-IN')} (₹${item.makingChargesPerGram}/g)\n`;
      if (item.stoneCharges > 0) msg += `  • Stones: ₹${item.stoneCharges.toLocaleString('en-IN')}\n`;
      msg += `  • GST (3%): ₹${item.taxAmount.toLocaleString('en-IN')}\n`;
      msg += `  ➡️ *Item Total: ₹${item.finalAmount.toLocaleString('en-IN')}*\n\n`;
    });

    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `💰 *Gross Jewellery Total:* ₹${cartTotals.grossCartTotal.toLocaleString('en-IN')}\n`;

    if (enableOldGold && recalculatedOldGoldItems.length > 0) {
      msg += `\n🔄 *OLD GOLD EXCHANGE (${recalculatedOldGoldItems.length} Items):*\n`;
      recalculatedOldGoldItems.forEach((og, idx) => {
        msg += `  ${idx + 1}) ${og.description} (${og.purity})\n`;
        msg += `     Gross: ${og.grossWeight}g | Net Melt: ${og.netMeltingWeight}g @ ₹${og.ratePerGram}/g\n`;
        msg += `     Credit: -₹${og.exchangeValue.toLocaleString('en-IN')}\n`;
      });
      msg += `✨ *Total Old Gold Deduction:* *-₹${oldGoldTotals.totalCredit.toLocaleString('en-IN')}*\n`;
    }

    if (discountAmount > 0) {
      msg += `🏷️ *Special Discount:* -₹${discountAmount.toLocaleString('en-IN')}\n`;
    }

    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `⭐ *NET PAYABLE AMOUNT: ₹${netPayable.toLocaleString('en-IN')}*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;

    if (planType === 'PLAN') {
      msg += `\n💳 *PAYMENT SCHEME: ${selectedPlanName || `${planMonths} Months EMI Plan`}*\n`;
      if (subventionPercentage > 0) {
        msg += `🌟 *Merchant Subvention Benefit:* ${subventionPercentage}% (Saved ₹${planCalculations.subventionSavings.toLocaleString('en-IN')})\n`;
      }
      msg += `• Down Payment: ₹${planCalculations.advancePaid.toLocaleString('en-IN')} ${useOldGoldAsAdvance && oldGoldTotals.totalCredit > 0 ? '(Covered by Old Gold Credit)' : ''}\n`;
      msg += `• Financed Principal: ₹${planCalculations.principalFinanced.toLocaleString('en-IN')} (${planInterestPercent}% interest)\n`;
      msg += `• Monthly Installment: *₹${planCalculations.monthlyInstallment.toLocaleString('en-IN')}/month* (${planMonths} Milestones)\n`;
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
      if (phoneInput === null) return; // User cancelled
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
      // Launch WhatsApp directly on the salesman device (WhatsApp Web or Native App)
      window.open(`https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encoded}`, '_blank');
    } else {
      // Launch WhatsApp with prefilled message to select any contact on salesman device
      window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
    }
  };

  const handleCopyText = () => {
    const text = constructWhatsAppEstimateMessage();
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2500);
  };

  // --- CONVERT TO FORMAL ORDER & BOOK ---
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
    <div className="space-y-6 pb-28 animate-fadeIn max-w-5xl mx-auto">
      
      {/* 1. COMPACT HERO HEADER & TOP CONTROLS */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 text-white flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
            <Calculator size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-serif font-black text-xl text-slate-900 tracking-tight">Jewellery Estimate Desk</h1>
              <span className="bg-amber-100 text-amber-900 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider">
                {estimateId}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Live rate pricing, cost breakdown & scrap gold exchange
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <button
            onClick={() => setCustomerViewActive(!customerViewActive)}
            className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm ${
              customerViewActive 
                ? 'bg-emerald-600 text-white ring-2 ring-emerald-500/30' 
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
            title="Toggle customer presentation mode"
          >
            {customerViewActive ? <Eye size={14} /> : <EyeOff size={14} />}
            <span>{customerViewActive ? 'Showroom Mode' : 'Customer Showcase'}</span>
          </button>

          <button
            onClick={() => setShowSavedQuotesModal(true)}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <Bookmark size={14} />
            <span>Saved ({savedEstimates.length})</span>
          </button>

          <button
            onClick={handleSaveEstimate}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <Download size={14} />
            <span>Save</span>
          </button>

          <button
            onClick={handleResetCalculator}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-rose-600 rounded-xl transition-colors"
            title="Reset Calculation"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* 2. INTERACTIVE LIVE RATES BAR */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-50/50 to-orange-50/20 border border-amber-200/80 rounded-3xl p-4 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm shrink-0">
            <Coins size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-900 uppercase tracking-wider">Today's Gold & Silver Benchmark</span>
              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                isCustomRate ? 'bg-amber-200 text-amber-900' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {isCustomRate ? 'Custom Rate' : 'Live Showroom Rate'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">Calculations automatically recalculate across all karats</p>
          </div>
        </div>

        {/* Rates Chips */}
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          <div className="bg-white border-2 border-amber-400 px-3 py-1.5 rounded-xl shadow-xs">
            <span className="text-[9px] font-black uppercase text-amber-800 block">22K (916 Hallmarked)</span>
            <span className="font-black text-slate-900 text-sm">₹{rate22K.toLocaleString('en-IN')}<span className="text-[10px] font-normal text-slate-400">/g</span></span>
          </div>

          <div className="bg-white border border-slate-200 px-3 py-1.5 rounded-xl">
            <span className="text-[9px] font-bold uppercase text-slate-400 block">24K Pure</span>
            <span className="font-bold text-slate-800 text-xs">₹{rate24K.toLocaleString('en-IN')}<span className="text-[9px] font-normal text-slate-400">/g</span></span>
          </div>

          <div className="bg-white border border-slate-200 px-3 py-1.5 rounded-xl">
            <span className="text-[9px] font-bold uppercase text-slate-400 block">18K (750)</span>
            <span className="font-bold text-slate-800 text-xs">₹{rate18K.toLocaleString('en-IN')}<span className="text-[9px] font-normal text-slate-400">/g</span></span>
          </div>

          <div className="bg-white border border-slate-200 px-3 py-1.5 rounded-xl">
            <span className="text-[9px] font-bold uppercase text-slate-400 block">Silver (1g)</span>
            <span className="font-bold text-slate-800 text-xs">₹{rateSilver.toLocaleString('en-IN')}<span className="text-[9px] font-normal text-slate-400">/g</span></span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={async () => {
                setRefreshingRates(true);
                if (onRefreshRates) await onRefreshRates();
                else {
                  const r = await goldRateService.fetchLiveRate();
                  if (r.success) {
                    setRate24K(r.rate24K || 7500);
                    setRate22K(r.rate22K || 6875);
                    setRate18K(r.rate18K || 5625);
                    setRate14K(Math.round((r.rate24K || 7500) * 0.585));
                    setRateSilver(r.silver || 92);
                    setIsCustomRate(false);
                  }
                }
                setRefreshingRates(false);
              }}
              disabled={refreshingRates}
              className="p-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl transition-colors"
              title="Sync Live Rates"
            >
              <RefreshCw size={14} className={refreshingRates ? 'animate-spin text-amber-600' : ''} />
            </button>

            <button
              onClick={() => setShowRateModal(true)}
              className="px-2.5 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors"
              title="Set Custom Quotation Rate"
            >
              <Sliders size={13} />
              <span className="hidden sm:inline">Override</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. CUSTOMER DETAILS (COMPACT & CLEAN) */}
      {!customerViewActive && (
        <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <User size={16} className="text-amber-500" />
              <span className="text-xs font-bold text-slate-800">Customer Details</span>
              <span className="text-[10px] text-slate-400">(Optional for Walk-ins)</span>
            </div>

            {customers.length > 0 && (
              <button 
                onClick={() => setShowCustomerSearch(!showCustomerSearch)}
                className="text-xs font-bold text-amber-600 hover:underline"
              >
                {showCustomerSearch ? 'Close Search' : 'Select Existing Client'}
              </button>
            )}
          </div>

          {showCustomerSearch && (
            <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl max-h-40 overflow-y-auto space-y-1">
              <p className="text-[9px] font-bold uppercase text-slate-400 mb-1">Pick a registered client:</p>
              {customers.slice(0, 6).map(c => (
                <button
                  key={c.id}
                  onClick={() => {
                    setCustomerName(c.name);
                    setCustomerContact(c.contact);
                    setShowCustomerSearch(false);
                  }}
                  className="w-full text-left p-1.5 rounded-lg hover:bg-white text-xs flex justify-between items-center text-slate-700 transition-colors"
                >
                  <span className="font-bold">{c.name}</span>
                  <span className="text-[10px] text-slate-400">{c.contact}</span>
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
            <input
              type="text"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              placeholder="Customer Name"
              className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <div className="relative">
              <Phone size={13} className="absolute left-3 top-3 text-slate-400" />
              <input
                type="tel"
                value={customerContact}
                onChange={e => setCustomerContact(e.target.value)}
                placeholder="WhatsApp Number (for instant estimate)"
                className="w-full text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div className="relative">
              <MapPin size={13} className="absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={customerCity}
                onChange={e => setCustomerCity(e.target.value)}
                placeholder="City / Location"
                className="w-full text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* 4. NEW JEWELLERY SELECTION (CUSTOMER-FRIENDLY INTERACTIVE CARDS) */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="text-amber-500" size={20} />
              <h2 className="font-black text-base text-slate-900">Selected Jewellery Products</h2>
              <span className="bg-slate-900 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                {recalculatedCartItems.length} {recalculatedCartItems.length === 1 ? 'Item' : 'Items'}
              </span>
            </div>
            <p className="text-xs text-slate-500">Live itemized calculation with metal, wastage, making, stone & GST</p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => handleOpenAddItem('Ring')}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-md transition-all active:scale-95"
            >
              <Plus size={16} />
              <span>Add Product</span>
            </button>
          </div>
        </div>

        {/* Empty State */}
        {recalculatedCartItems.length === 0 ? (
          <div className="text-center py-10 px-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl space-y-3">
            <Sparkles className="mx-auto text-slate-300" size={36} />
            <h3 className="font-bold text-slate-800 text-sm">No Jewellery Items in Estimate</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Add products using standard jewellery presets below or custom specifications:
            </p>
            <div className="flex justify-center gap-2 flex-wrap pt-2">
              {['Ring', 'Necklace', 'Bangles', 'Chain', 'Earrings'].map(cat => (
                <button
                  key={cat}
                  onClick={() => handleOpenAddItem(cat)}
                  className="px-3.5 py-1.5 bg-white border border-slate-200 hover:border-amber-400 text-slate-700 text-xs font-bold rounded-xl transition-all shadow-xs"
                >
                  + {cat}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {recalculatedCartItems.map((item, index) => {
              const isExpanded = expandedBifurcationId === item.id;
              const itemRate = getPurityRate(item.purity, item.metalColor);

              return (
                <div 
                  key={item.id} 
                  className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 transition-all hover:border-slate-300 shadow-xs space-y-3"
                >
                  {/* Main Item Row */}
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-black text-xs shrink-0 mt-0.5">
                        #{index + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-slate-900 text-sm">{item.customizationDetails || `${item.purity} ${item.category}`}</h3>
                          <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-md">
                            {item.purity} • {item.metalColor}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Net Weight: <strong className="text-slate-800">{item.netWeight}g</strong> @ ₹{itemRate}/g | VA/Wastage: <strong>{item.wastagePercentage}%</strong> | Making: <strong>₹{item.makingChargesPerGram}/g</strong>
                          {item.stoneCharges > 0 && <span> | Stones: <strong>₹{item.stoneCharges.toLocaleString('en-IN')}</strong></span>}
                        </p>
                      </div>
                    </div>

                    {/* Price & Action Buttons */}
                    <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto border-t md:border-t-0 pt-2 md:pt-0 border-slate-200">
                      <div className="text-right">
                        <span className="text-[9px] font-black uppercase text-slate-400 block">Item Total (Inc. 3% GST)</span>
                        <span className="font-black text-slate-900 text-lg">₹{item.finalAmount.toLocaleString('en-IN')}</span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setExpandedBifurcationId(isExpanded ? null : item.id)}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors ${
                            isExpanded ? 'bg-amber-100 text-amber-800' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                          title="Toggle Detailed Cost Breakdown"
                        >
                          <Layers size={13} />
                          <span className="hidden sm:inline">{isExpanded ? 'Hide' : 'Breakdown'}</span>
                          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>

                        <button
                          onClick={() => handleOpenEditItem(item)}
                          className="p-2 bg-white border border-slate-200 text-slate-600 hover:text-amber-600 hover:bg-slate-100 rounded-xl transition-colors"
                          title="Edit Item Details"
                        >
                          <Edit2 size={14} />
                        </button>

                        {/* DELETE BUTTON FIXED */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteItem(item.id);
                          }}
                          className="p-2 bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                          title="Remove Item from Estimate"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Interactive Quick Steppers on the Card (Clutter-Free) */}
                  {!customerViewActive && (
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-slate-400">Net Wt:</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleQuickUpdateItem(item.id, { netWeight: Math.max(0.1, Number((item.netWeight - 0.5).toFixed(3))) })}
                            className="w-6 h-6 rounded-md bg-slate-100 text-slate-700 font-black hover:bg-slate-200 flex items-center justify-center"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={item.netWeight}
                            onChange={e => handleQuickUpdateItem(item.id, { netWeight: parseFloat(e.target.value) || 0.1 })}
                            className="w-16 text-center font-black text-slate-800 border border-slate-200 rounded-md py-0.5 text-xs"
                          />
                          <button
                            onClick={() => handleQuickUpdateItem(item.id, { netWeight: Number((item.netWeight + 0.5).toFixed(3)) })}
                            className="w-6 h-6 rounded-md bg-slate-100 text-slate-700 font-black hover:bg-slate-200 flex items-center justify-center"
                          >
                            +
                          </button>
                          <span className="text-[10px] text-slate-400">g</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-slate-400">VA (Wastage):</span>
                        <div className="flex items-center gap-1">
                          {[8, 10, 12, 14].map(pct => (
                            <button
                              key={pct}
                              onClick={() => handleQuickUpdateItem(item.id, { wastagePercentage: pct })}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                item.wastagePercentage === pct ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {pct}%
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-slate-400">Making:</span>
                        <input
                          type="number"
                          step="50"
                          min="0"
                          value={item.makingChargesPerGram || ''}
                          onChange={e => handleQuickUpdateItem(item.id, { makingChargesPerGram: parseFloat(e.target.value) || 0 })}
                          placeholder="₹/g"
                          className="w-16 text-center font-bold text-slate-800 border border-slate-200 rounded-md py-0.5 text-xs"
                        />
                        <span className="text-[10px] text-slate-400">₹/g</span>
                      </div>
                    </div>
                  )}

                  {/* Expanded Detailed Breakdown */}
                  {isExpanded && (
                    <div className="p-3.5 bg-white rounded-xl border border-slate-200 text-xs space-y-2 animate-fadeIn">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Detailed Formula Calculation:</span>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                        <div className="p-2 bg-slate-50 rounded-lg">
                          <span className="text-[9px] text-slate-400 block font-bold uppercase">1. Metal Value</span>
                          <span className="font-black text-slate-800">₹{item.baseMetalValue.toLocaleString('en-IN')}</span>
                          <span className="text-[8px] text-slate-400 block">{item.netWeight}g × ₹{itemRate}</span>
                        </div>
                        <div className="p-2 bg-slate-50 rounded-lg">
                          <span className="text-[9px] text-slate-400 block font-bold uppercase">2. Wastage (VA)</span>
                          <span className="font-black text-slate-800">₹{item.wastageValue.toLocaleString('en-IN')}</span>
                          <span className="text-[8px] text-slate-400 block">{item.wastagePercentage}% of Metal</span>
                        </div>
                        <div className="p-2 bg-slate-50 rounded-lg">
                          <span className="text-[9px] text-slate-400 block font-bold uppercase">3. Making Charges</span>
                          <span className="font-black text-slate-800">₹{item.totalLaborValue.toLocaleString('en-IN')}</span>
                          <span className="text-[8px] text-slate-400 block">₹{item.makingChargesPerGram}/g</span>
                        </div>
                        <div className="p-2 bg-slate-50 rounded-lg">
                          <span className="text-[9px] text-slate-400 block font-bold uppercase">4. Stones & Misc</span>
                          <span className="font-black text-slate-800">₹{((item.stoneCharges || 0) + (item.otherCharges || 0)).toLocaleString('en-IN')}</span>
                          <span className="text-[8px] text-slate-400 block">Hallmark Included</span>
                        </div>
                        <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                          <span className="text-[9px] text-emerald-800 block font-bold uppercase">5. GST (3%)</span>
                          <span className="font-black text-emerald-900">₹{item.taxAmount.toLocaleString('en-IN')}</span>
                          <span className="text-[8px] text-emerald-600 block">Statutory Tax</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Cart Subtotals Bar */}
        {recalculatedCartItems.length > 0 && (
          <div className="bg-slate-100 rounded-2xl p-4 flex flex-wrap justify-between items-center gap-3">
            <div className="flex items-center gap-5 text-xs">
              <div>
                <span className="text-[9px] font-black uppercase text-slate-400 block">Total Net Weight</span>
                <span className="font-bold text-slate-800 text-sm">{cartTotals.totalNetWeight}g</span>
              </div>
              <div>
                <span className="text-[9px] font-black uppercase text-slate-400 block">Total VA & Making</span>
                <span className="font-bold text-slate-800 text-sm">₹{(cartTotals.totalMakingValue + cartTotals.totalWastageValue).toLocaleString('en-IN')}</span>
              </div>
              <div>
                <span className="text-[9px] font-black uppercase text-slate-400 block">GST (3%)</span>
                <span className="font-bold text-slate-800 text-sm">₹{cartTotals.totalGst.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-black uppercase text-slate-400 block">Gross Jewellery Bill</span>
              <span className="font-black text-slate-900 text-xl">₹{cartTotals.grossCartTotal.toLocaleString('en-IN')}</span>
            </div>
          </div>
        )}
      </div>

      {/* 5. OLD GOLD EXCHANGE ENGINE (INTERACTIVE & EASY TOGGLE) */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex justify-between items-center pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
              <Coins size={16} />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900">Customer Old Gold & Scrap Exchange</h3>
              <p className="text-xs text-slate-500">Deduct customer's old gold ornaments directly from the new bill</p>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-xs font-bold text-slate-700 hidden sm:inline">Exchanging Old Gold?</span>
            <input
              type="checkbox"
              checked={enableOldGold}
              onChange={e => {
                const val = e.target.checked;
                setEnableOldGold(val);
                if (val && oldGoldItems.length === 0) {
                  handleOpenAddOldGold();
                }
              }}
              className="w-5 h-5 text-amber-600 rounded focus:ring-amber-500 cursor-pointer"
            />
          </label>
        </div>

        {enableOldGold && (
          <div className="space-y-4 animate-fadeIn">
            {recalculatedOldGoldItems.length === 0 ? (
              <div className="text-center py-6 px-4 bg-amber-50/60 border border-dashed border-amber-300 rounded-2xl space-y-2">
                <p className="text-xs font-bold text-amber-900">No old gold items added yet.</p>
                <button
                  onClick={handleOpenAddOldGold}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-sm inline-flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  <span>Add Old Gold Ornaments</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {recalculatedOldGoldItems.map((og, idx) => (
                  <div 
                    key={og.id}
                    className="bg-amber-50/50 border border-amber-200 rounded-2xl p-3.5 flex flex-col md:flex-row justify-between items-start md:items-center gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-amber-200 text-amber-900 flex items-center justify-center font-black text-xs shrink-0 mt-0.5">
                        G{idx + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-900 text-sm">{og.description}</h4>
                          <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-md">
                            {og.purity === 'CUSTOM' ? `Custom ${og.customPurityPercent}%` : og.purity} {og.metalType === 'SILVER' ? 'Silver' : 'Gold'}
                          </span>
                          {og.fineGoldWeight ? (
                            <span className="bg-emerald-100 text-emerald-900 text-[9px] font-bold px-1.5 py-0.5 rounded">
                              {og.fineGoldWeight}g Fine
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Gross: <strong>{og.grossWeight}g</strong> | Stones/Dirt: <strong>-{og.deductionWeight}g</strong> | Net Melt: <strong className="text-amber-900">{og.netMeltingWeight}g</strong> | Loss: <strong>{og.meltingLossPercentage}%</strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto border-t md:border-t-0 pt-2 md:pt-0 border-amber-200/60">
                      <div className="text-right">
                        <span className="text-[9px] font-black uppercase text-amber-800 block">Rate @ ₹{og.ratePerGram.toLocaleString('en-IN')}/g</span>
                        <span className="font-black text-emerald-700 text-base">-₹{og.exchangeValue.toLocaleString('en-IN')}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditOldGold(og)}
                          className="p-2 bg-white border border-amber-200 text-slate-600 hover:text-amber-800 rounded-xl transition-colors"
                          title="Edit Old Gold Item"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteOldGold(og.id)}
                          className="p-2 bg-white border border-amber-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                          title="Delete Old Gold Item"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="flex justify-between items-center pt-2">
                  <button
                    onClick={handleOpenAddOldGold}
                    className="text-xs font-black text-amber-700 hover:text-amber-800 flex items-center gap-1 uppercase"
                  >
                    <Plus size={14} /> <span>Add Another Old Item</span>
                  </button>

                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-600">Total Old Gold Deduction: </span>
                    <span className="font-black text-emerald-700 text-lg">-₹{oldGoldTotals.totalCredit.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 6. CLUTTER-FREE NET FINANCIAL SETTLEMENT CARD */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl space-y-5">
        <div className="flex justify-between items-center pb-3 border-b border-slate-800">
          <div>
            <h3 className="font-black text-lg text-white flex items-center gap-2">
              <ReceiptIndianRupee className="text-amber-400" />
              <span>Final Bill & Settlement</span>
            </h3>
            <p className="text-xs text-slate-400">Total payable after exchange deductions and showroom discounts</p>
          </div>

          <span className="text-xs font-black uppercase bg-slate-800 text-amber-400 px-3 py-1.5 rounded-xl border border-slate-700">
            Net Wt: {netWeightDifference >= 0 ? `+${netWeightDifference}g` : `${netWeightDifference}g`}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Box 1: New Jewellery */}
          <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 space-y-1.5 text-xs">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">1. New Jewellery Total</span>
            <div className="flex justify-between text-slate-300">
              <span>Pure Metal Value:</span>
              <span className="font-bold">₹{cartTotals.totalMetalValue.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>VA + Making + Stones:</span>
              <span className="font-bold">₹{(cartTotals.totalMakingValue + cartTotals.totalWastageValue + cartTotals.totalStoneValue).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>GST (3%):</span>
              <span className="font-bold">₹{cartTotals.totalGst.toLocaleString('en-IN')}</span>
            </div>
            <div className="pt-2 border-t border-slate-700 flex justify-between font-black text-sm text-white">
              <span>Gross Total:</span>
              <span>₹{cartTotals.grossCartTotal.toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* Box 2: Deductions */}
          <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 space-y-2 text-xs">
            <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider block">2. Deductions & Credits</span>
            <div className="flex justify-between text-emerald-400 font-bold">
              <span>Old Gold Credit:</span>
              <span>-₹{(enableOldGold ? oldGoldTotals.totalCredit : 0).toLocaleString('en-IN')}</span>
            </div>
            
            <div className="pt-1">
              <label className="text-[10px] text-slate-400 block mb-1">Special Discount (₹):</label>
              <input
                type="number"
                min="0"
                value={discountAmount || ''}
                onChange={e => setDiscountAmount(parseFloat(e.target.value) || 0)}
                placeholder="₹ 0"
                className="w-full text-xs font-bold text-white bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Box 3: Net Payable */}
          <div className="bg-gradient-to-br from-amber-500 to-amber-700 p-5 rounded-2xl text-white shadow-lg flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-black uppercase text-amber-200 tracking-widest block">3. Net Amount Payable</span>
              <p className="text-3xl font-black mt-1">₹{netPayable.toLocaleString('en-IN')}</p>
              <p className="text-xs text-amber-100 mt-1">
                {enableOldGold && oldGoldTotals.totalCredit > 0 ? 'Includes gold exchange deduction' : 'Full settlement value'}
              </p>
            </div>

            <div className="pt-3 border-t border-amber-400/40 flex justify-between items-center text-xs font-bold">
              <span>Status:</span>
              <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] uppercase">Quotation Ready</span>
            </div>
          </div>
        </div>
      </div>

      {/* 7. RANGE-BASED PAYMENT SCHEMES & SUBVENTIONS / EMI SIMULATOR */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-black">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900">Range-Based Payment Schemes & Subventions</h3>
              <p className="text-xs text-slate-500">Official showroom installment schemes with subsidy subventions and rate protection</p>
            </div>
          </div>

          {/* Clean Option Switcher */}
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setPlanType('FULL')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                planType === 'FULL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              100% Full Payment
            </button>
            <button
              onClick={() => setPlanType('PLAN')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                planType === 'PLAN' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Installment Scheme
            </button>
          </div>
        </div>

        {planType === 'PLAN' && (
          <div className="space-y-5 animate-fadeIn">
            {/* RANGE CATEGORY FILTER PILLS */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  Select Purchase Range Scheme:
                </span>
                <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                  Cart Amount: ₹{cartTotals.grossCartTotal.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'ALL', label: `All Schemes (${activePlanTemplates.length})` },
                  { id: '10K_50K', label: '₹10k - ₹50k (Starter)' },
                  { id: '50K_120K', label: '₹50k - ₹120k (Mid-Range)' },
                  { id: '120K_PLUS', label: '₹120k+ (VIP Segment)' },
                  { id: 'CUSTOM', label: '⚙️ Custom Parameters' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedRangeFilter(tab.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      selectedRangeFilter === tab.id
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* SCHEMES CARDS GRID */}
            {selectedRangeFilter !== 'CUSTOM' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {activePlanTemplates
                  .filter(tpl => {
                    if (selectedRangeFilter === '10K_50K') {
                      return (tpl.minPurchaseAmount || 0) <= 50000 && (tpl.maxPurchaseAmount || Infinity) <= 80000;
                    }
                    if (selectedRangeFilter === '50K_120K') {
                      return (tpl.minPurchaseAmount || 0) >= 40000 && (tpl.maxPurchaseAmount || Infinity) <= 150000;
                    }
                    if (selectedRangeFilter === '120K_PLUS') {
                      return (tpl.minPurchaseAmount || 0) >= 100000;
                    }
                    return true;
                  })
                  .map(tpl => {
                    const isSelected = selectedTemplateId === tpl.id;
                    const isEligible = cartTotals.grossCartTotal >= (tpl.minPurchaseAmount || 0) && cartTotals.grossCartTotal <= (tpl.maxPurchaseAmount || Infinity);
                    
                    // Quick simulated monthly for this template
                    const subventionDisc = Math.round(cartTotals.grossCartTotal * ((tpl.subventionPercentage || 0) / 100));
                    const effNet = Math.max(0, netPayable - subventionDisc);
                    const adv = Math.round(effNet * (tpl.advancePercentage / 100));
                    const princ = Math.max(0, effNet - (useOldGoldAsAdvance && enableOldGold && oldGoldTotals.totalCredit > 0 ? 0 : adv));
                    const intAmt = Math.round(princ * (tpl.interestPercentage / 100) * (tpl.months / 12));
                    const estMonthly = tpl.months > 0 ? Math.round((princ + intAmt) / tpl.months) : princ;

                    return (
                      <div
                        key={tpl.id}
                        onClick={() => handleApplyTemplate(tpl)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                          isSelected
                            ? 'bg-amber-50/80 border-amber-500 shadow-md ring-2 ring-amber-400/40'
                            : 'bg-white border-slate-200 hover:border-amber-300 hover:bg-slate-50/60'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex justify-between items-start gap-1.5">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <h4 className="font-black text-slate-900 text-sm">{tpl.name}</h4>
                                {isSelected && (
                                  <span className="bg-amber-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase">
                                    Active
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-500 font-bold block mt-0.5">
                                {tpl.minPurchaseAmount ? `₹${(tpl.minPurchaseAmount/1000)}k` : '₹0'} - {tpl.maxPurchaseAmount && tpl.maxPurchaseAmount < 1000000 ? `₹${(tpl.maxPurchaseAmount/1000)}k` : '₹10L+'}
                              </span>
                            </div>

                            <span className="bg-slate-100 text-slate-800 text-[10px] font-black px-2 py-1 rounded-lg">
                              {tpl.months} Months
                            </span>
                          </div>

                          {isEligible && (
                            <div className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 text-[9px] font-black px-2 py-0.5 rounded-md border border-emerald-200">
                              <CheckCircle size={11} /> <span>Eligible for this cart amount</span>
                            </div>
                          )}

                          {tpl.subventionPercentage && tpl.subventionPercentage > 0 ? (
                            <div className="bg-amber-100/70 border border-amber-300 text-amber-900 p-2 rounded-xl text-[10px] font-bold space-y-0.5">
                              <div className="flex items-center gap-1 font-black">
                                <Sparkles size={12} className="text-amber-600" />
                                <span>{tpl.subventionPercentage}% Merchant Subvention</span>
                              </div>
                              <p className="text-[9px] text-amber-800 font-normal">
                                {tpl.subventionNote || 'Showroom absorbs interest cost for customer'}
                              </p>
                            </div>
                          ) : null}

                          <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-600 pt-1">
                            <div>Down Payment: <strong className="text-slate-900">{tpl.advancePercentage}%</strong></div>
                            <div>Interest: <strong className="text-slate-900">{tpl.interestPercentage}% p.a.</strong></div>
                          </div>
                        </div>

                        <div className="pt-3 mt-3 border-t border-slate-100 flex justify-between items-center">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Estimated EMI</span>
                          <span className="font-black text-slate-900 text-sm">
                            ₹{estMonthly.toLocaleString('en-IN')}<span className="text-[10px] text-slate-500 font-normal">/mo</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : null}

            {/* CUSTOM PARAMETERS PANEL (IF CUSTOM FILTER IS SELECTED OR DESIRED) */}
            {selectedRangeFilter === 'CUSTOM' && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4 animate-fadeIn">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <h4 className="text-xs font-black uppercase text-slate-900">Custom Payment Parameters</h4>
                  <span className="text-[10px] text-slate-500">Fine-tune down payment, subvention subsidy, and tenure</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Tenure (Months)</label>
                    <input
                      type="number"
                      min="1"
                      max="36"
                      value={planMonths}
                      onChange={e => {
                        setPlanMonths(parseInt(e.target.value) || 1);
                        setSelectedPlanName(`Custom (${e.target.value} Months)`);
                      }}
                      className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Down Payment (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={planAdvancePercent}
                      onChange={e => setPlanAdvancePercent(parseFloat(e.target.value) || 0)}
                      className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Subvention Subsidy (%)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="10"
                      value={subventionPercentage}
                      onChange={e => {
                        const val = parseFloat(e.target.value) || 0;
                        setSubventionPercentage(val);
                        setSubventionNote(val > 0 ? `${val}% Special Merchant Subvention` : '');
                      }}
                      className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-3 py-2 text-amber-700"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Interest Rate (%)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="24"
                      value={planInterestPercent}
                      onChange={e => setPlanInterestPercent(parseFloat(e.target.value) || 0)}
                      className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-3 py-2"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* SUBVENTION SAVINGS BANNER */}
            {subventionPercentage > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl flex items-center justify-between gap-3 text-emerald-900 text-xs">
                <div className="flex items-center gap-2 font-bold">
                  <Award size={18} className="text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-black">Subvention Benefit Applied: </span>
                    <span>{subventionNote || `${subventionPercentage}% Showroom Subsidy`}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] font-bold text-emerald-700 block">Customer Savings:</span>
                  <span className="text-sm font-black text-emerald-800">
                    -₹{planCalculations.subventionSavings.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            )}

            {/* SIMULATED INSTALLMENT RESULT BOX */}
            <div className="bg-gradient-to-r from-amber-500 to-amber-700 text-white rounded-3xl p-5 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <span className="text-[10px] font-black uppercase text-amber-200 tracking-widest block">
                  Active Scheme: {selectedPlanName || `${planMonths} Months Installment Scheme`}
                </span>
                <p className="text-3xl font-black mt-1">
                  ₹{planCalculations.monthlyInstallment.toLocaleString('en-IN')}
                  <span className="text-xs font-normal text-amber-100"> / month ({planMonths} Milestones)</span>
                </p>
                <p className="text-xs text-amber-100 mt-1">
                  Financed Principal: ₹{planCalculations.principalFinanced.toLocaleString('en-IN')} • Interest: ₹{planCalculations.interestAmount.toLocaleString('en-IN')}
                </p>
              </div>

              <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-amber-400/40">
                <div className="text-right">
                  <span className="text-[10px] font-bold text-amber-200 uppercase block">Down Payment:</span>
                  <span className="text-xl font-black text-white">
                    ₹{planCalculations.advancePaid.toLocaleString('en-IN')}
                  </span>
                  {enableOldGold && oldGoldTotals.totalCredit > 0 && useOldGoldAsAdvance && (
                    <span className="block text-[10px] text-emerald-200 font-bold">(Covered by Old Gold Credit)</span>
                  )}
                </div>

                <div className="bg-white/20 p-2 rounded-2xl text-center">
                  <span className="text-[9px] font-bold uppercase block text-amber-100">Gold Rate Lock</span>
                  <span className="text-xs font-black">₹{rate22K}/g</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 8. BOTTOM ACTION BAR (CONVERT, WHATSAPP, PRINT) */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={handleCopyText}
            className="flex-1 sm:flex-none px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
          >
            {copiedText ? <Check className="text-emerald-600" size={16} /> : <Copy size={16} />}
            <span>{copiedText ? 'Copied' : 'Copy Quote'}</span>
          </button>

          <button
            onClick={handleShareWhatsApp}
            className="flex-1 sm:flex-none px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
            title="Open quotation in WhatsApp directly on your device"
          >
            <Smartphone size={16} />
            <span>Send on WhatsApp</span>
          </button>
        </div>

        <div className="w-full sm:w-auto">
          <button
            onClick={handleConvertEstimateToOrder}
            className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-amber-500 to-amber-700 hover:from-amber-600 hover:to-amber-800 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all active:scale-95"
          >
            <CheckCircle2 size={16} />
            <span>Convert to Order & Book</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* SUCCESS POPUP AFTER CONVERSION */}
      {conversionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex justify-between items-center text-emerald-900 font-bold text-xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-600" />
            <span>Order #{conversionSuccess} successfully created and booked!</span>
          </div>
          <button 
            onClick={() => setConversionSuccess(null)}
            className="text-emerald-700 font-black hover:underline text-[10px] uppercase"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* --- MODAL 1: ADD / EDIT PRODUCT MODAL --- */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Sparkles size={18} className="text-amber-500" />
                <span>{editingItemId ? 'Edit Jewellery Product' : 'Add Jewellery Product'}</span>
              </h3>
              <button onClick={() => setShowItemModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Item Title / Description</label>
                <input
                  type="text"
                  value={itemForm.customizationDetails || ''}
                  onChange={e => setItemForm({ ...itemForm, customizationDetails: e.target.value })}
                  placeholder="e.g. 22K Antique Temple Choker Necklace"
                  className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Category</label>
                  <select
                    value={itemForm.category}
                    onChange={e => setItemForm({ ...itemForm, category: e.target.value })}
                    className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5"
                  >
                    <option value="Ring">Ring</option>
                    <option value="Necklace">Necklace / Choker</option>
                    <option value="Bangles">Bangles / Kada</option>
                    <option value="Chain">Gold Chain</option>
                    <option value="Earrings">Earrings / Jhumka</option>
                    <option value="Bracelet">Bracelet</option>
                    <option value="Pendant">Pendant</option>
                    <option value="Mangalsutra">Mangalsutra</option>
                    <option value="Coin">Gold / Silver Coin</option>
                    <option value="Silver Article">Silver Article</option>
                    <option value="Custom">Custom Order</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Purity & Metal</label>
                  <select
                    value={itemForm.purity}
                    onChange={e => setItemForm({ ...itemForm, purity: e.target.value as any })}
                    className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5"
                  >
                    <option value="24K">24K Gold (99.9% Pure)</option>
                    <option value="22K">22K Gold (91.6% Hallmark)</option>
                    <option value="18K">18K Gold (75.0% Diamond)</option>
                    <option value="14K">14K Gold (58.5%)</option>
                    <option value="925">925 Sterling Silver</option>
                    <option value="999">999 Fine Silver</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Gross Weight (g)</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={itemForm.grossWeight || ''}
                    onChange={e => {
                      const g = parseFloat(e.target.value) || 0;
                      setItemForm(prev => ({ 
                        ...prev, 
                        grossWeight: g,
                        netWeight: prev?.stoneDetails ? prev.netWeight : g
                      }));
                    }}
                    className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-amber-700 block mb-1">Net Weight (g) *Required</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={itemForm.netWeight || ''}
                    onChange={e => setItemForm({ ...itemForm, netWeight: parseFloat(e.target.value) || 0 })}
                    className="w-full text-xs font-black text-amber-900 bg-amber-50/70 border border-amber-300 rounded-xl px-3.5 py-2.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Wastage / VA (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={itemForm.wastagePercentage || ''}
                    onChange={e => setItemForm({ ...itemForm, wastagePercentage: parseFloat(e.target.value) || 0 })}
                    className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Making Charges (₹/g)</label>
                  <input
                    type="number"
                    step="10"
                    min="0"
                    value={itemForm.makingChargesPerGram || ''}
                    onChange={e => setItemForm({ ...itemForm, makingChargesPerGram: parseFloat(e.target.value) || 0 })}
                    className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Stone Charges (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={itemForm.stoneCharges || ''}
                    onChange={e => setItemForm({ ...itemForm, stoneCharges: parseFloat(e.target.value) || 0 })}
                    className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Stone Details</label>
                  <input
                    type="text"
                    value={itemForm.stoneDetails || ''}
                    onChange={e => setItemForm({ ...itemForm, stoneDetails: e.target.value })}
                    placeholder="e.g. CZ 1.200g, Ruby"
                    className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex gap-2">
              <button
                onClick={() => setShowItemModal(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveItemForm}
                className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all"
              >
                Save Product
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 2: ADD / EDIT OLD GOLD ITEM MODAL --- */}
      {showOldGoldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-amber-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Coins size={18} className="text-amber-600" />
                <span>{editingOldGoldId ? 'Edit Old Gold Exchange Item' : 'Add Old Gold Exchange Item'}</span>
              </h3>
              <button onClick={() => setShowOldGoldModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Item Description</label>
                <input
                  type="text"
                  value={oldGoldForm.description || ''}
                  onChange={e => setOldGoldForm({ ...oldGoldForm, description: e.target.value })}
                  placeholder="e.g. Old 22K Broken Chain with Locket"
                  className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Metal Type</label>
                  <select
                    value={oldGoldForm.metalType}
                    onChange={e => {
                      const newMetal = e.target.value as 'GOLD' | 'SILVER';
                      const defaultPurity = newMetal === 'SILVER' ? '925' : '22K';
                      const benchmarkRate = getOldGoldBenchmarkRate(newMetal, defaultPurity, oldGoldForm.customPurityPercent);
                      setOldGoldForm({ 
                        ...oldGoldForm, 
                        metalType: newMetal,
                        purity: defaultPurity,
                        ratePerGram: benchmarkRate
                      });
                    }}
                    className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5"
                  >
                    <option value="GOLD">Gold Exchange</option>
                    <option value="SILVER">Silver Scrap Exchange</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Purity / Karat</label>
                  <select
                    value={oldGoldForm.purity}
                    onChange={e => {
                      const newPurity = e.target.value;
                      const benchmarkRate = getOldGoldBenchmarkRate(oldGoldForm.metalType || 'GOLD', newPurity, oldGoldForm.customPurityPercent);
                      setOldGoldForm({ 
                        ...oldGoldForm, 
                        purity: newPurity,
                        ratePerGram: benchmarkRate
                      });
                    }}
                    className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5"
                  >
                    {oldGoldForm.metalType === 'SILVER' ? (
                      <>
                        <option value="999">999 Fine Silver (99.9%)</option>
                        <option value="925">925 Sterling Silver (92.5%)</option>
                        <option value="800">80% Silver Anklets / Utensils</option>
                        <option value="CUSTOM">Custom Purity %</option>
                      </>
                    ) : (
                      <>
                        <option value="24K">24K Pure Gold (99.9%)</option>
                        <option value="22K">22K Standard Hallmark (91.6%)</option>
                        <option value="20K">20K Gold (83.3%)</option>
                        <option value="18K">18K Diamond Jewellery (75.0%)</option>
                        <option value="14K">14K Modern Gold (58.5%)</option>
                        <option value="CUSTOM">Custom Purity % (Tested / Assayed)</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* CUSTOM PURITY PERCENT INPUT (IF SELECTED 'CUSTOM') */}
              {oldGoldForm.purity === 'CUSTOM' && (
                <div className="bg-amber-50/70 border border-amber-200 p-3.5 rounded-2xl space-y-2 animate-fadeIn">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black uppercase text-amber-900 block">
                      Custom Assayed Purity (%):
                    </label>
                    <span className="text-[10px] font-bold text-amber-800">
                      Benchmark: ₹{getOldGoldBenchmarkRate(oldGoldForm.metalType || 'GOLD', 'CUSTOM', oldGoldForm.customPurityPercent)}/g
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      max="100"
                      value={oldGoldForm.customPurityPercent || ''}
                      onChange={e => {
                        const val = parseFloat(e.target.value) || 0;
                        const benchmark = getOldGoldBenchmarkRate(oldGoldForm.metalType || 'GOLD', 'CUSTOM', val);
                        setOldGoldForm({
                          ...oldGoldForm,
                          customPurityPercent: val,
                          ratePerGram: benchmark
                        });
                      }}
                      placeholder="e.g. 88.50"
                      className="w-full text-xs font-black text-amber-900 bg-white border border-amber-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="text-xs font-black text-amber-900">%</span>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(oldGoldForm.metalType === 'SILVER' ? [99.9, 92.5, 80.0, 70.0, 60.0] : [99.9, 91.6, 88.0, 84.5, 75.0, 58.5]).map(pct => (
                      <button
                        type="button"
                        key={pct}
                        onClick={() => {
                          const benchmark = getOldGoldBenchmarkRate(oldGoldForm.metalType || 'GOLD', 'CUSTOM', pct);
                          setOldGoldForm({
                            ...oldGoldForm,
                            customPurityPercent: pct,
                            ratePerGram: benchmark
                          });
                        }}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                          oldGoldForm.customPurityPercent === pct
                            ? 'bg-amber-600 text-white'
                            : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Gross Weight (g)</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={oldGoldForm.grossWeight || ''}
                    onChange={e => setOldGoldForm({ ...oldGoldForm, grossWeight: parseFloat(e.target.value) || 0 })}
                    className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Stone/Dirt Deduction (g)</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={oldGoldForm.deductionWeight || ''}
                    onChange={e => setOldGoldForm({ ...oldGoldForm, deductionWeight: parseFloat(e.target.value) || 0 })}
                    className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Melting / Testing Loss (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={oldGoldForm.meltingLossPercentage ?? 1}
                    onChange={e => setOldGoldForm({ ...oldGoldForm, meltingLossPercentage: parseFloat(e.target.value) || 0 })}
                    className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-black uppercase text-amber-700 block">Exchange Rate (₹/g)</label>
                    <button
                      type="button"
                      onClick={() => {
                        const benchmark = getOldGoldBenchmarkRate(oldGoldForm.metalType || 'GOLD', oldGoldForm.purity || '22K', oldGoldForm.customPurityPercent);
                        setOldGoldForm({ ...oldGoldForm, ratePerGram: benchmark });
                      }}
                      className="text-[9px] text-amber-700 hover:underline font-bold"
                    >
                      Reset Benchmark
                    </button>
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={oldGoldForm.ratePerGram || ''}
                    onChange={e => setOldGoldForm({ ...oldGoldForm, ratePerGram: parseFloat(e.target.value) || 0 })}
                    className="w-full text-xs font-black text-amber-900 bg-amber-50 border border-amber-300 rounded-xl px-3.5 py-2.5"
                  />
                </div>
              </div>

              {/* LIVE VALUATION SUMMARY CARD IN MODAL */}
              {(() => {
                const g = parseFloat(oldGoldForm.grossWeight as any) || 0;
                const d = parseFloat(oldGoldForm.deductionWeight as any) || 0;
                const netM = Math.max(0, g - d);
                const loss = parseFloat(oldGoldForm.meltingLossPercentage as any) || 0;
                const netAfter = netM * (1 - loss / 100);
                const r = parseFloat(oldGoldForm.ratePerGram as any) || 0;
                const estCredit = Math.round(netAfter * r);

                let pFrac = 0.916;
                if (oldGoldForm.metalType === 'SILVER') {
                  if (oldGoldForm.purity === '925') pFrac = 0.925;
                  else if (oldGoldForm.purity === '800') pFrac = 0.800;
                  else if (oldGoldForm.purity === 'CUSTOM') pFrac = (parseFloat(oldGoldForm.customPurityPercent as any) || 92.5) / 100;
                  else pFrac = 0.999;
                } else {
                  if (oldGoldForm.purity === '24K') pFrac = 0.999;
                  else if (oldGoldForm.purity === '22K') pFrac = 0.916;
                  else if (oldGoldForm.purity === '20K') pFrac = 0.833;
                  else if (oldGoldForm.purity === '18K') pFrac = 0.750;
                  else if (oldGoldForm.purity === '14K') pFrac = 0.585;
                  else if (oldGoldForm.purity === 'CUSTOM') pFrac = (parseFloat(oldGoldForm.customPurityPercent as any) || 91.6) / 100;
                }
                const fineWt = Number((netAfter * pFrac).toFixed(3));

                return (
                  <div className="bg-slate-900 text-white rounded-2xl p-3.5 text-xs space-y-1.5 border border-slate-800">
                    <div className="flex justify-between text-slate-400">
                      <span>Net Melt Weight (Gross - Dirt):</span>
                      <span className="font-bold text-white">{netM.toFixed(3)}g</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Net after {loss}% loss & Fine Wt:</span>
                      <span className="font-bold text-amber-300">{netAfter.toFixed(3)}g ({fineWt}g fine)</span>
                    </div>
                    <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                      <span className="font-bold text-slate-300">Estimated Exchange Credit:</span>
                      <span className="text-base font-black text-emerald-400">₹{estCredit.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="pt-3 border-t border-slate-100 flex gap-2">
              <button
                onClick={() => setShowOldGoldModal(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveOldGoldForm}
                className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all"
              >
                Save Old Gold Credit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 3: RATE OVERRIDE MODAL --- */}
      {showRateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Custom Gold & Silver Rates</h3>
              <button onClick={() => setShowRateModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase text-amber-900 block mb-1">Standard 22K (916) Rate (₹/g)</label>
                <input
                  type="number"
                  value={rate22K}
                  onChange={e => {
                    const r = parseFloat(e.target.value) || 0;
                    setRate22K(r);
                    setRate24K(Math.round(r * (99.9 / 91.6)));
                    setRate18K(Math.round(r * (75.0 / 91.6)));
                    setRate14K(Math.round(r * (58.5 / 91.6)));
                    setIsCustomRate(true);
                  }}
                  className="w-full text-sm font-black text-amber-900 bg-amber-50 border border-amber-300 rounded-xl px-3.5 py-2.5"
                />
                <span className="text-[9px] text-slate-400 mt-1 block">Auto-scales 24K, 18K & 14K proportionally</span>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Silver Rate (₹/g)</label>
                <input
                  type="number"
                  value={rateSilver}
                  onChange={e => {
                    setRateSilver(parseFloat(e.target.value) || 0);
                    setIsCustomRate(true);
                  }}
                  className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex gap-2">
              <button
                onClick={() => {
                  setIsCustomRate(false);
                  setRate24K(settings.currentGoldRate24K || 7500);
                  setRate22K(settings.currentGoldRate22K || 6875);
                  setRate18K(settings.currentGoldRate18K || 5625);
                  setRateSilver(settings.currentSilverRate || 92);
                  setShowRateModal(false);
                }}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
              >
                Reset to Live
              </button>
              <button
                onClick={() => setShowRateModal(false)}
                className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase"
              >
                Apply Rates
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 4: SAVED ESTIMATES MODAL --- */}
      {showSavedQuotesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Bookmark size={18} className="text-amber-500" />
                <span>Saved Estimate Quotations ({savedEstimates.length})</span>
              </h3>
              <button onClick={() => setShowSavedQuotesModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={20} />
              </button>
            </div>

            {savedEstimates.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">No saved estimates found in this browser.</p>
            ) : (
              <div className="space-y-2.5">
                {savedEstimates.map(est => (
                  <div key={est.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex justify-between items-center gap-3">
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs">{est.customerName || 'Walk-in Client'}</h4>
                      <p className="text-[10px] text-slate-500">
                        {est.id} • {new Date(est.date).toLocaleDateString('en-IN')} • {est.items?.length || 1} Item(s)
                      </p>
                      <p className="text-xs font-black text-amber-700 mt-0.5">
                        Net: ₹{est.netPayableAmount.toLocaleString('en-IN')}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleLoadEstimate(est)}
                        className="px-3 py-1.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase hover:bg-slate-800 transition-colors"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => {
                          const updated = savedEstimates.filter(e => e.id !== est.id);
                          setSavedEstimates(updated);
                          localStorage.setItem('auragold_saved_estimates', JSON.stringify(updated));
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default SalesmanCalculator;
