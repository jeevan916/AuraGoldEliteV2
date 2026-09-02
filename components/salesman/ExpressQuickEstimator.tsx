import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Sparkles, Zap, Scale, ReceiptIndianRupee, Send, Copy, 
  Printer, ArrowRight, RefreshCw, Edit3, User, Phone, CheckCircle2,
  Percent, Coins, Plus, Eye, Check, ChevronDown, ChevronUp, Gem,
  RotateCcw, Bookmark, Keyboard, Maximize2, Minimize2, Delete,
  Sliders, MessageSquare, ShoppingBag
} from 'lucide-react';
import { JewelryDetail, ProductionStatus } from '../../types';
import { ComponentBreakdownCard } from './ComponentBreakdownCard';

interface ExpressQuickEstimatorProps {
  // Current Rates
  rate24K: number;
  rate22K: number;
  rate18K: number;
  rate14K: number;
  rateSilver: number;
  onOpenRateModal: () => void;
  onRefreshRates?: () => Promise<void>;
  refreshingRates?: boolean;

  // Customer State
  customerName: string;
  setCustomerName: (name: string) => void;
  customerContact: string;
  setCustomerContact: (contact: string) => void;
  customerCity: string;
  setCustomerCity: (city: string) => void;

  // Estimate State
  estimateId: string;
  discountAmount: number;
  setDiscountAmount: (amt: number) => void;
  taxRate: number;

  // Old Gold in Express Mode
  enableOldGold: boolean;
  setEnableOldGold: (val: boolean) => void;
  oldGoldGrossWeight: number;
  oldGoldPurity: string;
  setOldGoldGrossWeight: (val: number) => void;
  setOldGoldPurity: (val: string) => void;
  oldGoldRate: number;
  setOldGoldRate: (val: number) => void;
  oldGoldCredit: number;

  // Actions
  onAddToCart: (item: JewelryDetail) => void;
  onShareWhatsApp: (item?: JewelryDetail) => void;
  onCopyQuote: (item?: JewelryDetail) => void;
  onToggleCustomerView: (item?: JewelryDetail) => void;
  onPrintSlip: (item?: JewelryDetail) => void;
  onConvertEstimateToOrder: (item?: JewelryDetail) => void;
  onSaveEstimateManual?: () => void;
  onExpressItemChange?: (item: JewelryDetail) => void;
  copiedText: boolean;
  autoSaveStatus: 'SAVED' | 'SAVING' | 'IDLE';

  // Fullscreen state
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export type CalcField = 
  | 'grossWeight'
  | 'stoneWeight'
  | 'makingPercent'
  | 'customRate'
  | 'stoneCharges'
  | 'discountAmount'
  | 'oldGoldGrossWeight'
  | 'oldGoldRate'
  | 'otherCharges';

const CATEGORIES = [
  { id: 'Ring', label: 'Ring', defaultMakingPct: 12, icon: '💍' },
  { id: 'Chain', label: 'Chain', defaultMakingPct: 10, icon: '📿' },
  { id: 'Necklace', label: 'Necklace', defaultMakingPct: 14, icon: '✨' },
  { id: 'Bangles', label: 'Bangles', defaultMakingPct: 12, icon: '🪙' },
  { id: 'Earrings', label: 'Earrings', defaultMakingPct: 14, icon: '💎' },
  { id: 'Bracelet', label: 'Bracelet', defaultMakingPct: 12, icon: '⚡' },
  { id: 'Pendant', label: 'Pendant', defaultMakingPct: 12, icon: '🌟' },
  { id: 'Coin', label: 'Coin', defaultMakingPct: 3, icon: '🥇' },
  { id: 'Silver', label: 'Silver Article', defaultMakingPct: 15, icon: '🥈' },
];

export const ExpressQuickEstimator: React.FC<ExpressQuickEstimatorProps> = ({
  rate24K,
  rate22K,
  rate18K,
  rate14K,
  rateSilver,
  onOpenRateModal,
  onRefreshRates,
  refreshingRates = false,
  customerName,
  setCustomerName,
  customerContact,
  setCustomerContact,
  customerCity,
  setCustomerCity,
  estimateId,
  discountAmount,
  setDiscountAmount,
  taxRate,
  enableOldGold,
  setEnableOldGold,
  oldGoldGrossWeight,
  setOldGoldGrossWeight,
  oldGoldPurity,
  setOldGoldPurity,
  oldGoldRate,
  setOldGoldRate,
  oldGoldCredit,
  onAddToCart,
  onShareWhatsApp,
  onCopyQuote,
  onToggleCustomerView,
  onPrintSlip,
  onConvertEstimateToOrder,
  onSaveEstimateManual,
  onExpressItemChange,
  copiedText,
  autoSaveStatus,
  isFullscreen = false,
  onToggleFullscreen
}) => {
  // Main Product States
  const [category, setCategory] = useState('Ring');
  const [purity, setPurity] = useState<'24K' | '22K' | '18K' | '14K' | '925' | '999'>('22K');
  const [customTitle, setCustomTitle] = useState('');
  const [customRate, setCustomRate] = useState<string>('');
  const [isEditingRate, setIsEditingRate] = useState(false);

  // Weights & percentages as precise string buffers (allows typing decimals like "10.", "10.500")
  const [grossWeight, setGrossWeight] = useState<string>('6.0');
  const [stoneWeight, setStoneWeight] = useState<string>('0.5');

  // Making Charges (%) - Pure making percentage (Majuri skipped completely)
  const [makingPercent, setMakingPercent] = useState<string>('12');

  // Additional charges
  const [stoneCharges, setStoneCharges] = useState<string>('0');
  const [otherCharges, setOtherCharges] = useState<string>('45'); // Standard Hallmarking

  // String buffers for discount & old gold
  const [discountStr, setDiscountStr] = useState<string>(discountAmount ? String(discountAmount) : '0');
  const [oldGoldWeightStr, setOldGoldWeightStr] = useState<string>(oldGoldGrossWeight ? String(oldGoldGrossWeight) : '0');
  const [oldGoldRateStr, setOldGoldRateStr] = useState<string>(oldGoldRate ? String(oldGoldRate) : '');

  // Active Keypad Field (Focus)
  const [activeField, setActiveField] = useState<CalcField>('grossWeight');

  // Computed Values
  const numericGross = parseFloat(grossWeight) || 0;
  const numericStone = parseFloat(stoneWeight) || 0;
  const netWeight = Math.max(0, Number((numericGross - numericStone).toFixed(3)));

  // Benchmark default rate for purity
  const defaultRate = (() => {
    if (purity === '925') return Math.round(rateSilver * 0.925);
    if (purity === '999') return rateSilver;
    if (purity === '24K') return rate24K;
    if (purity === '22K') return rate22K;
    if (purity === '18K') return rate18K;
    if (purity === '14K') return rate14K;
    return rate22K;
  })();

  const numericCustomRate = parseFloat(customRate) || 0;
  const activeRate = numericCustomRate > 0 ? numericCustomRate : defaultRate;

  // Financial Calculations (Skip Majuri completely, use Making % of Metal Value)
  const baseMetalValue = Math.round(netWeight * activeRate);

  const numericMakingPct = parseFloat(makingPercent) || 0;
  const makingChargesValue = Math.round(baseMetalValue * (numericMakingPct / 100));

  const numericStoneCharges = parseFloat(stoneCharges) || 0;
  const numericOtherCharges = parseFloat(otherCharges) || 45;

  const subTotalPreTax = baseMetalValue + makingChargesValue + numericStoneCharges + numericOtherCharges;
  const taxAmount = Math.round(subTotalPreTax * (taxRate / 100));
  const grossFinalAmount = subTotalPreTax + taxAmount;

  const totalDeductions = (enableOldGold ? oldGoldCredit : 0) + (discountAmount || 0);
  const netPayableAmount = Math.max(0, grossFinalAmount - totalDeductions);

  // Real-time complete JewelryDetail object representing currently configured item
  const currentJewelryItem: JewelryDetail = useMemo(() => ({
    id: `ITEM-EXPRESS-${Date.now()}`,
    category,
    metalColor: purity.includes('925') || purity.includes('999') ? 'Silver' : 'Yellow Gold',
    grossWeight: numericGross || netWeight,
    netWeight,
    wastagePercentage: numericMakingPct,
    wastageValue: makingChargesValue,
    makingChargesPerGram: 0,
    totalLaborValue: 0,
    stoneCharges: numericStoneCharges,
    stoneDetails: numericStone > 0 ? `${numericStone}g Stone Weight` : '',
    otherCharges: numericOtherCharges,
    purity: purity as any,
    taxAmount,
    baseMetalValue,
    finalAmount: grossFinalAmount,
    customizationDetails: customTitle.trim() || `${purity} ${category} (${netWeight}g)`,
    productionStatus: ProductionStatus.DESIGNING,
    photoUrls: []
  }), [
    category, purity, numericGross, netWeight, numericMakingPct, makingChargesValue,
    numericStoneCharges, numericStone, numericOtherCharges, taxAmount, baseMetalValue,
    grossFinalAmount, customTitle
  ]);

  // Synchronize item state with parent calculator continuously
  useEffect(() => {
    onExpressItemChange?.(currentJewelryItem);
  }, [currentJewelryItem, onExpressItemChange]);

  // Category Selector Handler
  const handleSelectCategory = (catId: string) => {
    setCategory(catId);
    const found = CATEGORIES.find(c => c.id === catId);
    if (found) {
      setMakingPercent(String(found.defaultMakingPct));
    }
  };

  // Convert to JewelryDetail item for Cart
  const handleAddCurrentToCart = () => {
    if (netWeight <= 0) {
      alert("Please enter a valid gold weight (Gross / Net weight > 0).");
      return;
    }

    const newItem: JewelryDetail = {
      ...currentJewelryItem,
      id: `ITEM-${Date.now()}`
    };

    onAddToCart(newItem);
  };

  // --- KEYPAD DATA HANDLING (String Preserving) ---
  const getCurrentFieldValue = (field: CalcField): string => {
    switch (field) {
      case 'grossWeight': return grossWeight;
      case 'stoneWeight': return stoneWeight;
      case 'makingPercent': return makingPercent;
      case 'customRate': return isEditingRate ? customRate : (customRate !== '' ? customRate : String(activeRate));
      case 'discountAmount': return discountStr;
      case 'oldGoldGrossWeight': return oldGoldWeightStr;
      case 'oldGoldRate': return oldGoldRateStr !== '' ? oldGoldRateStr : (oldGoldRate ? String(oldGoldRate) : '');
      case 'stoneCharges': return stoneCharges;
      case 'otherCharges': return otherCharges;
      default: return '';
    }
  };

  const applyFieldValue = useCallback((field: CalcField, strVal: string) => {
    switch (field) {
      case 'grossWeight':
        setGrossWeight(strVal);
        break;
      case 'stoneWeight':
        setStoneWeight(strVal);
        break;
      case 'makingPercent':
        setMakingPercent(strVal);
        break;
      case 'customRate':
        setIsEditingRate(true);
        setCustomRate(strVal);
        break;
      case 'discountAmount':
        setDiscountStr(strVal);
        setDiscountAmount(parseFloat(strVal) || 0);
        break;
      case 'oldGoldGrossWeight':
        setOldGoldWeightStr(strVal);
        setOldGoldGrossWeight(parseFloat(strVal) || 0);
        break;
      case 'oldGoldRate':
        setOldGoldRateStr(strVal);
        setOldGoldRate(parseFloat(strVal) || 0);
        break;
      case 'stoneCharges':
        setStoneCharges(strVal);
        break;
      case 'otherCharges':
        setOtherCharges(strVal);
        break;
    }
  }, [setDiscountAmount, setOldGoldGrossWeight, setOldGoldRate]);

  const handleKeypadPress = useCallback((key: string) => {
    const currentVal = getCurrentFieldValue(activeField);
    let strVal = currentVal === undefined || currentVal === null ? '' : String(currentVal);

    if (key === '.') {
      if (!strVal.includes('.')) {
        strVal = strVal === '' ? '0.' : strVal + '.';
      }
    } else if (key === '00') {
      if (strVal === '' || strVal === '0') {
        strVal = '0';
      } else {
        strVal = strVal + '00';
      }
    } else {
      if (strVal === '0' && key !== '.') {
        strVal = key;
      } else {
        strVal = strVal + key;
      }
    }

    applyFieldValue(activeField, strVal);
  }, [activeField, applyFieldValue, grossWeight, stoneWeight, makingPercent, isEditingRate, customRate, activeRate, discountStr, oldGoldWeightStr, oldGoldRateStr, stoneCharges, otherCharges]);

  const handleKeypadBackspace = useCallback(() => {
    const currentVal = getCurrentFieldValue(activeField);
    let strVal = currentVal === undefined || currentVal === null ? '' : String(currentVal);

    if (strVal.length > 0) {
      strVal = strVal.slice(0, -1);
      applyFieldValue(activeField, strVal);
    }
  }, [activeField, applyFieldValue, grossWeight, stoneWeight, makingPercent, isEditingRate, customRate, activeRate, discountStr, oldGoldWeightStr, oldGoldRateStr, stoneCharges, otherCharges]);

  const handleKeypadClear = useCallback(() => {
    applyFieldValue(activeField, '');
  }, [activeField, applyFieldValue]);

  const handleKeypadQuickAdd = useCallback((amount: number) => {
    const currentVal = getCurrentFieldValue(activeField);
    const num = parseFloat(String(currentVal)) || 0;
    const nextVal = Number((num + amount).toFixed(3));
    applyFieldValue(activeField, String(nextVal));
  }, [activeField, applyFieldValue, grossWeight, stoneWeight, makingPercent, isEditingRate, customRate, activeRate, discountStr, oldGoldWeightStr, oldGoldRateStr, stoneCharges, otherCharges]);

  // Field cycling
  const fieldOrder: CalcField[] = [
    'grossWeight',
    'stoneWeight',
    'makingPercent',
    'customRate',
    'stoneCharges',
    'discountAmount'
  ];

  const handleNextField = () => {
    const idx = fieldOrder.indexOf(activeField);
    if (idx !== -1 && idx < fieldOrder.length - 1) {
      setActiveField(fieldOrder[idx + 1]);
    } else {
      setActiveField(fieldOrder[0]);
    }
  };

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not capture if user is typing into an explicit text input (e.g. name or notes)
      const targetTag = (e.target as HTMLElement)?.tagName;
      if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || targetTag === 'SELECT') return;

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleKeypadPress(e.key);
      } else if (e.key === '.') {
        e.preventDefault();
        handleKeypadPress('.');
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleKeypadBackspace();
      } else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        handleKeypadClear();
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleNextField();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeypadPress, handleKeypadBackspace, handleKeypadClear]);

  // Quick increment buttons according to active field
  const isWeightActive = activeField === 'grossWeight' || activeField === 'stoneWeight' || activeField === 'oldGoldGrossWeight';
  const isPercentActive = activeField === 'makingPercent';

  return (
    <div className="space-y-4 animate-fadeIn max-w-5xl mx-auto">
      
      {/* 1. TOP STATUS STRIP (Apple Clean Glass Bar) */}
      <div className="bg-white/95 backdrop-blur-md rounded-2xl px-4 py-2.5 border border-slate-200/80 shadow-2xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-xs shadow-xs">
            <Zap size={14} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black font-mono text-slate-900">{estimateId}</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Calculator
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onRefreshRates && (
            <button
              type="button"
              onClick={() => onRefreshRates()}
              disabled={refreshingRates}
              className="p-1.5 text-slate-500 hover:text-amber-800 bg-slate-100 hover:bg-amber-50 rounded-xl transition-colors"
              title="Refresh Market Rates"
            >
              <RefreshCw size={13} className={refreshingRates ? 'animate-spin' : ''} />
            </button>
          )}

          <button
            type="button"
            onClick={onOpenRateModal}
            className="text-xs font-bold text-amber-950 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 px-2.5 py-1 rounded-xl transition-all flex items-center gap-1.5"
          >
            <Edit3 size={11} className="text-amber-700" />
            <span>22K: ₹{rate22K.toLocaleString('en-IN')}</span>
          </button>

          {onToggleFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1 transition-all ${
                isFullscreen
                  ? 'bg-amber-500 text-slate-950 font-black'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Mode"}
            >
              {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
              <span className="hidden sm:inline">{isFullscreen ? 'Exit' : 'Full'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onToggleCustomerView(currentJewelryItem)}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1"
          >
            <Eye size={12} />
            <span className="hidden sm:inline">Showcase</span>
          </button>
        </div>
      </div>

      {/* 2. MAIN 2-PANEL CALCULATOR BODY */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        
        {/* LEFT COLUMN: THE PHYSICAL COMPACT CALCULATOR DEVICE */}
        <div className="lg:col-span-7 bg-[#1C1C1E] text-white rounded-3xl p-4 sm:p-5 shadow-2xl border border-slate-800 space-y-4">
          
          {/* CALCULATOR SCREEN (Apple iOS Style OLED Display) */}
          <div className="bg-[#000000]/90 rounded-2xl p-4 border border-white/10 space-y-2">
            {/* Live Formula Tape */}
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 overflow-x-auto scrollbar-none">
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="text-amber-400 font-bold">{purity} {category}</span>
                <span>•</span>
                <span>{netWeight}g net @ ₹{activeRate.toLocaleString('en-IN')}/g</span>
                <span>+</span>
                <span>Making ({numericMakingPct}%) ₹{makingChargesValue.toLocaleString('en-IN')}</span>
                {numericStoneCharges > 0 && <span>+ Stones ₹{numericStoneCharges.toLocaleString('en-IN')}</span>}
                <span>+ GST 3%</span>
                {totalDeductions > 0 && <span className="text-rose-400">- ₹{totalDeductions.toLocaleString('en-IN')}</span>}
              </div>
            </div>

            {/* Big Main Readout */}
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-xs font-mono font-bold text-amber-500 uppercase tracking-widest">
                Net Total
              </span>
              <div className="text-right">
                <span className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-white">
                  ₹{netPayableAmount.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Active Input Parameter Display Line */}
            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                Editing: <strong className="text-white uppercase font-bold">
                  {activeField === 'grossWeight' && 'Gross Weight'}
                  {activeField === 'stoneWeight' && 'Less / Stone Wt'}
                  {activeField === 'makingPercent' && 'Making Charges (%)'}
                  {activeField === 'customRate' && 'Gold Rate'}
                  {activeField === 'stoneCharges' && 'Stone Charges'}
                  {activeField === 'discountAmount' && 'Discount'}
                  {activeField === 'oldGoldGrossWeight' && 'Scrap Gold Wt'}
                  {activeField === 'oldGoldRate' && 'Scrap Rate'}
                  {activeField === 'otherCharges' && 'Other Charges'}
                </strong>
              </span>
              <span className="bg-white/15 px-2.5 py-0.5 rounded-lg font-mono font-black text-amber-300">
                {getCurrentFieldValue(activeField) !== '' ? getCurrentFieldValue(activeField) : '0'} 
                {isWeightActive ? ' g' : isPercentActive ? ' %' : ' ₹'}
              </span>
            </div>
          </div>

          {/* PURITY FUNCTION KEYS (Top Row of Calculator) */}
          <div className="grid grid-cols-5 gap-1.5">
            {[
              { id: '22K', label: '22K 916', rate: rate22K },
              { id: '24K', label: '24K Pure', rate: rate24K },
              { id: '18K', label: '18K 750', rate: rate18K },
              { id: '14K', label: '14K', rate: rate14K },
              { id: '925', label: 'Silver', rate: Math.round(rateSilver * 0.925) },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPurity(p.id as any);
                  setCustomRate('');
                  setIsEditingRate(false);
                }}
                className={`py-2 px-1 rounded-xl text-center transition-all ${
                  purity === p.id
                    ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                    : 'bg-[#2C2C2E] text-slate-300 hover:bg-[#3A3A3C] font-bold'
                }`}
              >
                <span className="text-xs block leading-none">{p.label}</span>
                <span className="text-[9px] opacity-75 font-mono mt-0.5 block">₹{p.rate}</span>
              </button>
            ))}
          </div>

          {/* CATEGORY FUNCTION STRIP */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleSelectCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
                  category === cat.id
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'bg-[#2C2C2E] text-slate-300 hover:bg-[#3A3A3C]'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          {/* PARAMETER SELECTOR TABS (What keying into - Clean 6 Tabs, No Majuri) */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
            {/* 1. Gross Wt */}
            <button
              type="button"
              onClick={() => setActiveField('grossWeight')}
              className={`p-2 rounded-xl text-left transition-all ${
                activeField === 'grossWeight'
                  ? 'bg-amber-500/20 border-2 border-amber-400 text-white'
                  : 'bg-[#2C2C2E] border border-white/5 text-slate-300 hover:bg-[#3A3A3C]'
              }`}
            >
              <span className="text-[9px] uppercase font-bold text-slate-400 block">Gross Wt</span>
              <span className="text-xs font-black font-mono text-white">{grossWeight !== '' ? grossWeight : '0'}g</span>
            </button>

            {/* 2. Less / Stone */}
            <button
              type="button"
              onClick={() => setActiveField('stoneWeight')}
              className={`p-2 rounded-xl text-left transition-all ${
                activeField === 'stoneWeight'
                  ? 'bg-amber-500/20 border-2 border-amber-400 text-white'
                  : 'bg-[#2C2C2E] border border-white/5 text-slate-300 hover:bg-[#3A3A3C]'
              }`}
            >
              <span className="text-[9px] uppercase font-bold text-slate-400 block">Less Wt</span>
              <span className="text-xs font-black font-mono text-white">{stoneWeight !== '' ? stoneWeight : '0'}g</span>
            </button>

            {/* 3. Making % */}
            <button
              type="button"
              onClick={() => setActiveField('makingPercent')}
              className={`p-2 rounded-xl text-left transition-all ${
                activeField === 'makingPercent'
                  ? 'bg-amber-500/20 border-2 border-amber-400 text-white'
                  : 'bg-[#2C2C2E] border border-white/5 text-slate-300 hover:bg-[#3A3A3C]'
              }`}
            >
              <span className="text-[9px] uppercase font-bold text-slate-400 block">Making %</span>
              <span className="text-xs font-black font-mono text-amber-400">{makingPercent !== '' ? makingPercent : '0'}%</span>
            </button>

            {/* 4. Gold Rate */}
            <button
              type="button"
              onClick={() => setActiveField('customRate')}
              className={`p-2 rounded-xl text-left transition-all ${
                activeField === 'customRate'
                  ? 'bg-amber-500/20 border-2 border-amber-400 text-white'
                  : 'bg-[#2C2C2E] border border-white/5 text-slate-300 hover:bg-[#3A3A3C]'
              }`}
            >
              <span className="text-[9px] uppercase font-bold text-slate-400 block">Rate / g</span>
              <span className="text-xs font-black font-mono text-white">₹{activeRate}</span>
            </button>

            {/* 5. Stones ₹ */}
            <button
              type="button"
              onClick={() => setActiveField('stoneCharges')}
              className={`p-2 rounded-xl text-left transition-all ${
                activeField === 'stoneCharges'
                  ? 'bg-amber-500/20 border-2 border-amber-400 text-white'
                  : 'bg-[#2C2C2E] border border-white/5 text-slate-300 hover:bg-[#3A3A3C]'
              }`}
            >
              <span className="text-[9px] uppercase font-bold text-slate-400 block">Stones ₹</span>
              <span className="text-xs font-black font-mono text-white">₹{stoneCharges !== '' ? stoneCharges : '0'}</span>
            </button>

            {/* 6. Discount */}
            <button
              type="button"
              onClick={() => setActiveField('discountAmount')}
              className={`p-2 rounded-xl text-left transition-all ${
                activeField === 'discountAmount'
                  ? 'bg-rose-500/20 border-2 border-rose-400 text-white'
                  : 'bg-[#2C2C2E] border border-white/5 text-slate-300 hover:bg-[#3A3A3C]'
              }`}
            >
              <span className="text-[9px] uppercase font-bold text-rose-300 block">Discount</span>
              <span className="text-xs font-black font-mono text-rose-400">₹{discountStr !== '' ? discountStr : '0'}</span>
            </button>
          </div>

          {/* NUMBER PAD ALWAYS VISIBLE & INTEGRATED (Apple iOS 4x5 Layout) */}
          <div className="space-y-2 pt-1">
            
            {/* Quick Increment Row */}
            <div className="grid grid-cols-4 gap-2">
              {isWeightActive ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleKeypadQuickAdd(0.1)}
                    className="py-2 bg-[#2C2C2E] hover:bg-[#3A3A3C] active:scale-95 text-amber-300 rounded-xl text-xs font-mono font-bold transition-all"
                  >
                    +0.1g
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeypadQuickAdd(0.5)}
                    className="py-2 bg-[#2C2C2E] hover:bg-[#3A3A3C] active:scale-95 text-amber-300 rounded-xl text-xs font-mono font-bold transition-all"
                  >
                    +0.5g
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeypadQuickAdd(1.0)}
                    className="py-2 bg-[#2C2C2E] hover:bg-[#3A3A3C] active:scale-95 text-amber-300 rounded-xl text-xs font-mono font-bold transition-all"
                  >
                    +1.0g
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeypadQuickAdd(5.0)}
                    className="py-2 bg-[#2C2C2E] hover:bg-[#3A3A3C] active:scale-95 text-amber-300 rounded-xl text-xs font-mono font-bold transition-all"
                  >
                    +5.0g
                  </button>
                </>
              ) : isPercentActive ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleKeypadQuickAdd(1)}
                    className="py-2 bg-[#2C2C2E] hover:bg-[#3A3A3C] active:scale-95 text-amber-300 rounded-xl text-xs font-mono font-bold transition-all"
                  >
                    +1%
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeypadQuickAdd(2)}
                    className="py-2 bg-[#2C2C2E] hover:bg-[#3A3A3C] active:scale-95 text-amber-300 rounded-xl text-xs font-mono font-bold transition-all"
                  >
                    +2%
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeypadQuickAdd(5)}
                    className="py-2 bg-[#2C2C2E] hover:bg-[#3A3A3C] active:scale-95 text-amber-300 rounded-xl text-xs font-mono font-bold transition-all"
                  >
                    +5%
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeypadQuickAdd(10)}
                    className="py-2 bg-[#2C2C2E] hover:bg-[#3A3A3C] active:scale-95 text-amber-300 rounded-xl text-xs font-mono font-bold transition-all"
                  >
                    +10%
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleKeypadQuickAdd(50)}
                    className="py-2 bg-[#2C2C2E] hover:bg-[#3A3A3C] active:scale-95 text-amber-300 rounded-xl text-xs font-mono font-bold transition-all"
                  >
                    +₹50
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeypadQuickAdd(100)}
                    className="py-2 bg-[#2C2C2E] hover:bg-[#3A3A3C] active:scale-95 text-amber-300 rounded-xl text-xs font-mono font-bold transition-all"
                  >
                    +₹100
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeypadQuickAdd(500)}
                    className="py-2 bg-[#2C2C2E] hover:bg-[#3A3A3C] active:scale-95 text-amber-300 rounded-xl text-xs font-mono font-bold transition-all"
                  >
                    +₹500
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeypadPress('00')}
                    className="py-2 bg-[#2C2C2E] hover:bg-[#3A3A3C] active:scale-95 text-slate-300 rounded-xl text-xs font-mono font-bold transition-all"
                  >
                    00
                  </button>
                </>
              )}
            </div>

            {/* Apple Calculator 4-Column Keypad Grid */}
            <div className="grid grid-cols-4 gap-2">
              {/* Row 1 */}
              <button
                type="button"
                onClick={handleKeypadClear}
                className="h-12 bg-[#505054] hover:bg-[#636366] active:scale-95 text-white font-bold text-base rounded-2xl transition-all"
              >
                C
              </button>
              <button
                type="button"
                onClick={handleKeypadBackspace}
                className="h-12 bg-[#505054] hover:bg-[#636366] active:scale-95 text-white flex items-center justify-center rounded-2xl transition-all"
                title="Backspace"
              >
                <Delete size={18} />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isPercentActive) {
                    handleKeypadQuickAdd(1);
                  } else if (isWeightActive) {
                    handleKeypadQuickAdd(1.0);
                  } else {
                    handleKeypadQuickAdd(100);
                  }
                }}
                className="h-12 bg-[#505054] hover:bg-[#636366] active:scale-95 text-amber-300 font-bold text-xs rounded-2xl transition-all font-mono"
              >
                {isPercentActive ? '+1%' : isWeightActive ? '+1.0g' : '+100'}
              </button>
              <button
                type="button"
                onClick={handleNextField}
                className="h-12 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl transition-all flex items-center justify-center gap-1"
              >
                <span>Next</span>
                <ArrowRight size={14} />
              </button>

              {/* Row 2: 7, 8, 9 */}
              {['7', '8', '9'].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleKeypadPress(d)}
                  className="h-12 bg-[#2C2C2E] hover:bg-[#3A3A3C] active:bg-[#48484A] active:scale-95 text-white font-mono font-bold text-xl rounded-2xl transition-all shadow-xs"
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setEnableOldGold(!enableOldGold);
                  if (!enableOldGold) setActiveField('oldGoldGrossWeight');
                }}
                className={`h-12 font-bold text-[11px] rounded-2xl transition-all flex flex-col items-center justify-center ${
                  enableOldGold ? 'bg-emerald-600 text-white' : 'bg-[#2C2C2E] text-slate-400 hover:bg-[#3A3A3C]'
                }`}
              >
                <span>🪙 Scrap</span>
                <span className="text-[9px] font-mono">{enableOldGold ? `₹${oldGoldCredit}` : 'Off'}</span>
              </button>

              {/* Row 3: 4, 5, 6 */}
              {['4', '5', '6'].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleKeypadPress(d)}
                  className="h-12 bg-[#2C2C2E] hover:bg-[#3A3A3C] active:bg-[#48484A] active:scale-95 text-white font-mono font-bold text-xl rounded-2xl transition-all shadow-xs"
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                onClick={() => onConvertEstimateToOrder(currentJewelryItem)}
                className="h-12 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition-all flex flex-col items-center justify-center shadow-xs"
              >
                <span>Book</span>
                <span className="text-[9px] opacity-80">Order</span>
              </button>

              {/* Row 4: 1, 2, 3 */}
              {['1', '2', '3'].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleKeypadPress(d)}
                  className="h-12 bg-[#2C2C2E] hover:bg-[#3A3A3C] active:bg-[#48484A] active:scale-95 text-white font-mono font-bold text-xl rounded-2xl transition-all shadow-xs"
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                onClick={() => onShareWhatsApp(currentJewelryItem)}
                className="h-12 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl transition-all flex items-center justify-center gap-1 shadow-xs"
                title="Send Live WhatsApp Quote"
              >
                <Send size={13} />
                <span>Quote</span>
              </button>

              {/* Row 5: 0, ., +Cart, Print */}
              <button
                type="button"
                onClick={() => handleKeypadPress('0')}
                className="h-12 bg-[#2C2C2E] hover:bg-[#3A3A3C] active:bg-[#48484A] active:scale-95 text-white font-mono font-bold text-xl rounded-2xl transition-all shadow-xs"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => handleKeypadPress('.')}
                className="h-12 bg-[#2C2C2E] hover:bg-[#3A3A3C] active:bg-[#48484A] active:scale-95 text-white font-mono font-bold text-xl rounded-2xl transition-all shadow-xs"
              >
                .
              </button>
              <button
                type="button"
                onClick={() => handleAddCurrentToCart()}
                className="h-12 bg-slate-700 hover:bg-slate-600 active:scale-95 text-white font-bold text-xs rounded-2xl transition-all flex items-center justify-center gap-1"
                title="Add item to multi-item cart"
              >
                <Plus size={13} />
                <span>Cart</span>
              </button>
              <button
                type="button"
                onClick={() => onPrintSlip(currentJewelryItem)}
                className="h-12 bg-slate-700 hover:bg-slate-600 active:scale-95 text-white font-bold text-xs rounded-2xl transition-all flex items-center justify-center gap-1"
                title="Print Estimate Slip"
              >
                <Printer size={13} />
                <span>Slip</span>
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: COMPACT LIVE BREAKDOWN & CUSTOMER WHATSAPP TAPE */}
        <div className="lg:col-span-5 space-y-3">
          
          {/* Transparent Live Calculation Card */}
          <ComponentBreakdownCard
            grossWeight={numericGross}
            netWeight={netWeight}
            stoneWeight={numericStone}
            purity={purity}
            ratePerGram={activeRate}
            baseMetalValue={baseMetalValue}
            wastagePercentage={numericMakingPct}
            wastageValue={makingChargesValue}
            makingChargesPerGram={0}
            makingChargeType="PERCENT"
            makingChargePercent={0}
            totalLaborValue={0}
            stoneCharges={numericStoneCharges}
            otherCharges={numericOtherCharges}
            oldGoldCredit={enableOldGold ? oldGoldCredit : 0}
            discountAmount={discountAmount}
            subTotalPreTax={subTotalPreTax}
            taxRate={taxRate}
            taxAmount={taxAmount}
            finalAmount={netPayableAmount}
            title={`${purity} ${category} Estimate`}
            subtitle="Transparent live pricing breakdown"
            category={category}
          />

          {/* Quick Customer Phone & Name Input */}
          <div className="bg-white rounded-3xl p-4 border border-slate-200/90 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <User size={13} className="text-amber-500" />
                <span>Customer Details (WhatsApp)</span>
              </span>
              <button
                type="button"
                onClick={() => onCopyQuote(currentJewelryItem)}
                className="text-[10px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-xl"
              >
                <Copy size={11} />
                <span>{copiedText ? 'Copied!' : 'Copy Text'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="relative">
                <User size={13} className="absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Customer Name"
                  className="w-full text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-2xl pl-8 pr-3 py-2 outline-none focus:bg-white focus:border-amber-500"
                />
              </div>

              <div className="relative">
                <Phone size={13} className="absolute left-3 top-3 text-slate-400" />
                <input
                  type="tel"
                  value={customerContact}
                  onChange={(e) => setCustomerContact(e.target.value)}
                  placeholder="10-digit WhatsApp"
                  className="w-full text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-2xl pl-8 pr-3 py-2 outline-none focus:bg-white focus:border-amber-500 font-mono"
                />
              </div>
            </div>

            {/* Quick 1-Tap Action Bar */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                onClick={() => onShareWhatsApp(currentJewelryItem)}
                className="py-2.5 px-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 shadow-sm transition-all"
              >
                <Send size={13} />
                <span>WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => onPrintSlip(currentJewelryItem)}
                className="py-2.5 px-2 bg-slate-900 hover:bg-black active:scale-95 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
              >
                <Printer size={13} />
                <span>Print Slip</span>
              </button>

              <button
                type="button"
                onClick={() => onConvertEstimateToOrder(currentJewelryItem)}
                className="py-2.5 px-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 shadow-sm transition-all"
              >
                <CheckCircle2 size={13} />
                <span>Book Order</span>
              </button>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
