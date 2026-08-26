import React, { useState, useEffect } from 'react';
import { 
  Sparkles, Zap, Scale, Gem, ReceiptIndianRupee, Send, Copy, 
  Printer, ArrowRight, RefreshCw, Edit3, User, Phone, CheckCircle2,
  Percent, ShieldCheck, Coins, Plus, Eye, Check, ChevronDown, ChevronUp
} from 'lucide-react';
import { JewelryDetail, OldGoldExchangeItem, ProductionStatus } from '../../types';
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

  // Actions
  onAddToCart: (item: JewelryDetail) => void;
  onShareWhatsApp: () => void;
  onCopyQuote: () => void;
  onToggleCustomerView: () => void;
  onPrintSlip: () => void;
  onConvertEstimateToOrder: () => void;
  copiedText: boolean;
  autoSaveStatus: 'SAVED' | 'SAVING' | 'IDLE';
}

const POPULAR_CATEGORIES = [
  { id: 'Ring', label: 'Ring', defaultWastage: 10, defaultMaking: 550 },
  { id: 'Necklace', label: 'Necklace / Choker', defaultWastage: 12, defaultMaking: 650 },
  { id: 'Bangles', label: 'Bangles / Kada', defaultWastage: 9, defaultMaking: 450 },
  { id: 'Chain', label: 'Gold Chain', defaultWastage: 8, defaultMaking: 350 },
  { id: 'Earrings', label: 'Earrings / Jhumka', defaultWastage: 11, defaultMaking: 550 },
  { id: 'Bracelet', label: 'Bracelet', defaultWastage: 10, defaultMaking: 500 },
  { id: 'Mangalsutra', label: 'Mangalsutra', defaultWastage: 10, defaultMaking: 550 },
  { id: 'Pendant', label: 'Pendant', defaultWastage: 9, defaultMaking: 450 },
  { id: 'Coin', label: 'Gold / Silver Coin', defaultWastage: 2, defaultMaking: 150 },
  { id: 'Silver Article', label: 'Silver Article', defaultWastage: 5, defaultMaking: 200 },
];

const WASTAGE_PRESETS = [8, 10, 12, 14, 16];
const MAKING_PRESETS = [350, 450, 550, 650, 800];

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
  onAddToCart,
  onShareWhatsApp,
  onCopyQuote,
  onToggleCustomerView,
  onPrintSlip,
  onConvertEstimateToOrder,
  copiedText,
  autoSaveStatus
}) => {
  // Fast Form State
  const [category, setCategory] = useState('Ring');
  const [customTitle, setCustomTitle] = useState('');
  const [purity, setPurity] = useState<'24K' | '22K' | '18K' | '14K' | '925' | '999'>('22K');
  const [metalColor, setMetalColor] = useState('Yellow Gold');
  const [grossWeight, setGrossWeight] = useState<number>(6.000);
  const [stoneWeight, setStoneWeight] = useState<number>(0.500);
  const [wastagePercentage, setWastagePercentage] = useState<number>(10);
  const [makingChargesPerGram, setMakingChargesPerGram] = useState<number>(550);
  const [stoneCharges, setStoneCharges] = useState<number>(0);
  const [stoneDetails, setStoneDetails] = useState('');
  const [otherCharges, setOtherCharges] = useState<number>(45); // Standard Hallmarking
  const [showAdvancedFields, setShowAdvancedFields] = useState(false);

  // Auto calculate Net Weight
  const netWeight = Math.max(0, Number((grossWeight - (stoneWeight || 0)).toFixed(3)));

  // Get active benchmark rate for the chosen purity
  const getPurityRate = () => {
    if (purity === '925') return Math.round(rateSilver * 0.925);
    if (purity === '999') return rateSilver;
    if (purity === '24K') return rate24K;
    if (purity === '22K') return rate22K;
    if (purity === '18K') return rate18K;
    if (purity === '14K') return rate14K;
    return rate22K;
  };

  const activeRate = getPurityRate();

  // Instant Component Calculations
  const baseMetalValue = Math.round(netWeight * activeRate);
  const wastageValue = Math.round(baseMetalValue * (wastagePercentage / 100));
  const totalLaborValue = Math.round(makingChargesPerGram * netWeight);
  const subTotalPreTax = baseMetalValue + wastageValue + totalLaborValue + (stoneCharges || 0) + (otherCharges || 0);
  const taxAmount = Math.round(subTotalPreTax * (taxRate / 100));
  const grossFinalAmount = subTotalPreTax + taxAmount;
  const netPayableAmount = Math.max(0, grossFinalAmount - (discountAmount || 0));

  // Handle Category selection
  const handleSelectCategory = (catId: string) => {
    setCategory(catId);
    const found = POPULAR_CATEGORIES.find(c => c.id === catId);
    if (found) {
      setWastagePercentage(found.defaultWastage);
      setMakingChargesPerGram(found.defaultMaking);
    }
  };

  // Convert to JewelryDetail object for multi-item cart
  const handleAddCurrentToCart = () => {
    if (netWeight <= 0) {
      alert("Please enter a valid Gross and Net gold weight.");
      return;
    }

    const newItem: JewelryDetail = {
      id: `ITEM-${Date.now()}`,
      category,
      metalColor,
      grossWeight: grossWeight || netWeight,
      netWeight,
      wastagePercentage,
      wastageValue,
      makingChargesPerGram,
      totalLaborValue,
      stoneCharges: stoneCharges || 0,
      stoneDetails,
      otherCharges: otherCharges || 45,
      purity: purity as any,
      taxAmount,
      baseMetalValue,
      finalAmount: grossFinalAmount,
      customizationDetails: customTitle.trim() || `${purity} ${category} (Gross ${grossWeight}g / Net ${netWeight}g)`,
      productionStatus: ProductionStatus.DESIGNING,
      photoUrls: []
    };

    onAddToCart(newItem);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. TOP LIVE RATE & CUSTOMER QUICK STRIP */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Left: Customer Info (Compact) */}
        <div className="md:col-span-7 bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-3">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <User size={13} className="text-amber-600" />
              <span>Customer Identification</span>
            </span>
            {autoSaveStatus === 'SAVED' && (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 size={11} />
                <span>Auto-saved</span>
              </span>
            )}
            {autoSaveStatus === 'SAVING' && (
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                <span>Saving...</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer Full Name (Optional)"
                className="w-full text-xs font-bold text-slate-900 bg-slate-50 focus:bg-white border border-slate-200 focus:border-amber-500 rounded-xl px-3 py-2.5 outline-none"
              />
            </div>
            <div>
              <input
                type="tel"
                inputMode="numeric"
                value={customerContact}
                onChange={(e) => setCustomerContact(e.target.value)}
                placeholder="WhatsApp / Mobile No."
                className="w-full text-xs font-bold text-slate-900 bg-slate-50 focus:bg-white border border-slate-200 focus:border-amber-500 rounded-xl px-3 py-2.5 outline-none font-mono"
              />
            </div>
          </div>
        </div>

        {/* Right: Live Benchmark Rates Strip */}
        <div className="md:col-span-5 bg-gradient-to-br from-amber-500/10 via-amber-600/5 to-slate-50 rounded-3xl p-4 sm:p-5 border border-amber-200 shadow-sm flex flex-col justify-between gap-2">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 flex items-center gap-1">
              <Sparkles size={12} />
              <span>Today's Gold Benchmark</span>
            </span>
            <div className="flex items-center gap-1">
              {onRefreshRates && (
                <button
                  type="button"
                  onClick={() => onRefreshRates()}
                  disabled={refreshingRates}
                  className="p-1 text-amber-800 hover:text-amber-950 rounded-lg hover:bg-amber-100/50 transition-colors"
                  title="Refresh Live Rates"
                >
                  <RefreshCw size={13} className={refreshingRates ? 'animate-spin' : ''} />
                </button>
              )}
              <button
                type="button"
                onClick={onOpenRateModal}
                className="text-[10px] font-bold text-amber-800 bg-amber-100/80 hover:bg-amber-200 px-2 py-0.5 rounded-md transition-colors"
              >
                Edit Rates
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5 text-center">
            <div className="bg-white/80 rounded-xl p-1.5 border border-amber-200/60 shadow-2xs">
              <span className="text-[9px] font-black uppercase text-amber-800 block">22K (916)</span>
              <span className="text-xs font-black text-slate-900 font-mono">₹{rate22K}</span>
            </div>
            <div className="bg-white/80 rounded-xl p-1.5 border border-amber-200/60 shadow-2xs">
              <span className="text-[9px] font-black uppercase text-amber-800 block">24K Pure</span>
              <span className="text-xs font-black text-slate-900 font-mono">₹{rate24K}</span>
            </div>
            <div className="bg-white/80 rounded-xl p-1.5 border border-amber-200/60 shadow-2xs">
              <span className="text-[9px] font-black uppercase text-amber-800 block">18K (750)</span>
              <span className="text-xs font-black text-slate-900 font-mono">₹{rate18K}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. MAIN 2-COLUMN WORKSPACE: LEFT INPUTS / RIGHT LIVE BREAKDOWN */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: FAST PRODUCT & WEIGHT CALCULATOR */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-5">
            
            {/* Header */}
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black shadow-sm shadow-amber-500/20">
                  <Zap size={18} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Express Estimator</h3>
                  <p className="text-xs text-slate-500">Live rate instant quotation calculator</p>
                </div>
              </div>

              <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-xl">
                {purity} @ ₹{activeRate}/g
              </span>
            </div>

            {/* Category Quick Chips */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                Jewellery Category
              </label>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {POPULAR_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleSelectCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                      category === cat.id
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Purity & Metal Selection */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                Metal Purity & Standard
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {[
                  { id: '22K', label: '22K (916)', rate: rate22K },
                  { id: '24K', label: '24K (999)', rate: rate24K },
                  { id: '18K', label: '18K (750)', rate: rate18K },
                  { id: '14K', label: '14K (585)', rate: rate14K },
                  { id: '925', label: '925 Silver', rate: Math.round(rateSilver * 0.925) },
                  { id: '999', label: '999 Fine', rate: rateSilver },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPurity(p.id as any)}
                    className={`p-2.5 rounded-2xl border text-center transition-all ${
                      purity === p.id
                        ? 'bg-amber-50 border-amber-500 text-amber-950 font-black shadow-xs ring-2 ring-amber-400/20'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 font-bold'
                    }`}
                  >
                    <span className="text-xs block">{p.label}</span>
                    <span className="text-[10px] text-slate-500 font-mono block mt-0.5">₹{p.rate}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Weights Input: Gross, Less/Stone, Auto Net */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Scale size={14} className="text-amber-600" />
                  <span>Weight Measurements (Grams)</span>
                </span>
                <span className="text-xs font-bold text-amber-800">
                  Net Gold: <strong className="font-mono text-sm">{netWeight}g</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Gross Weight */}
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                    Gross Wt (g)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={grossWeight || ''}
                    onChange={(e) => setGrossWeight(parseFloat(e.target.value) || 0)}
                    placeholder="0.000"
                    className="w-full text-base font-black text-slate-900 bg-white border border-slate-300 focus:border-amber-500 rounded-xl px-3 py-2.5 outline-none font-mono"
                  />
                </div>

                {/* Less / Stone Weight */}
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                    Less / Stone Wt (g)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={stoneWeight || ''}
                    onChange={(e) => setStoneWeight(parseFloat(e.target.value) || 0)}
                    placeholder="0.000"
                    className="w-full text-base font-bold text-slate-800 bg-white border border-slate-300 focus:border-amber-500 rounded-xl px-3 py-2.5 outline-none font-mono"
                  />
                </div>

                {/* Net Gold Weight (Computed) */}
                <div className="bg-amber-100/60 border border-amber-300 rounded-xl p-2.5 text-center flex flex-col justify-center">
                  <span className="text-[10px] font-black uppercase text-amber-900 block">
                    Calculated Net Gold
                  </span>
                  <span className="text-lg font-black text-amber-950 font-mono mt-0.5">
                    {netWeight} g
                  </span>
                </div>
              </div>
            </div>

            {/* Wastage / Value Addition (VA) */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Wastage / Value Addition (VA %)
                </label>
                <span className="text-xs font-bold text-slate-700">
                  {wastagePercentage}% = <strong className="font-mono text-amber-800">₹{wastageValue.toLocaleString('en-IN')}</strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 flex-1 overflow-x-auto pb-0.5">
                  {WASTAGE_PRESETS.map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setWastagePercentage(pct)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                        wastagePercentage === pct
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>

                <div className="w-24 shrink-0">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={wastagePercentage || ''}
                    onChange={(e) => setWastagePercentage(parseFloat(e.target.value) || 0)}
                    placeholder="Custom %"
                    className="w-full text-xs font-bold text-center bg-slate-50 border border-slate-300 rounded-xl px-2 py-2"
                  />
                </div>
              </div>
            </div>

            {/* Making Charges (₹/g) */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Craftsmanship / Making Charges (₹/g)
                </label>
                <span className="text-xs font-bold text-slate-700">
                  ₹{makingChargesPerGram}/g = <strong className="font-mono text-slate-900">₹{totalLaborValue.toLocaleString('en-IN')}</strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 flex-1 overflow-x-auto pb-0.5">
                  {MAKING_PRESETS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setMakingChargesPerGram(amt)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                        makingChargesPerGram === amt
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      ₹{amt}
                    </button>
                  ))}
                </div>

                <div className="w-24 shrink-0">
                  <input
                    type="number"
                    step="50"
                    min="0"
                    value={makingChargesPerGram || ''}
                    onChange={(e) => setMakingChargesPerGram(parseFloat(e.target.value) || 0)}
                    placeholder="₹/g"
                    className="w-full text-xs font-bold text-center bg-slate-50 border border-slate-300 rounded-xl px-2 py-2"
                  />
                </div>
              </div>
            </div>

            {/* Optional / Advanced Details Accordion (Stones, Title, Hallmark, Goodwill Discount) */}
            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAdvancedFields(!showAdvancedFields)}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center justify-between w-full py-1.5"
              >
                <span>Optional: Stones, Custom Description & Discounts</span>
                {showAdvancedFields ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {showAdvancedFields && (
                <div className="pt-3 space-y-3 animate-fadeIn">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                      Custom Item Title / Description
                    </label>
                    <input
                      type="text"
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      placeholder={`e.g. 22K Traditional ${category} with Ruby Stone`}
                      className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                        Stone / Diamond Charges (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={stoneCharges || ''}
                        onChange={(e) => setStoneCharges(parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                        Showroom Goodwill Discount (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={discountAmount || ''}
                        onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="w-full text-xs font-bold text-rose-700 bg-rose-50/50 border border-rose-200 rounded-xl px-3 py-2.5"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Quick Action Buttons Toolbar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <button
              type="button"
              onClick={onShareWhatsApp}
              className="py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm active:scale-98 transition-all"
            >
              <Send size={14} />
              <span>WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={onCopyQuote}
              className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              {copiedText ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              <span>{copiedText ? 'Copied' : 'Copy Quote'}</span>
            </button>

            <button
              type="button"
              onClick={onToggleCustomerView}
              className="py-3 bg-slate-900 hover:bg-black text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm active:scale-98 transition-all"
            >
              <Eye size={14} />
              <span>Showcase</span>
            </button>

            <button
              type="button"
              onClick={onPrintSlip}
              className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Printer size={14} />
              <span>Print Slip</span>
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: TRANSPARENT COMPONENT BREAKDOWN & TOTAL CARD */}
        <div className="lg:col-span-5 space-y-4">
          <ComponentBreakdownCard
            grossWeight={grossWeight}
            netWeight={netWeight}
            stoneWeight={stoneWeight}
            purity={purity}
            metalColor={metalColor}
            ratePerGram={activeRate}
            baseMetalValue={baseMetalValue}
            wastagePercentage={wastagePercentage}
            wastageValue={wastageValue}
            makingChargesPerGram={makingChargesPerGram}
            totalLaborValue={totalLaborValue}
            stoneCharges={stoneCharges || 0}
            otherCharges={otherCharges || 45}
            subTotalPreTax={subTotalPreTax}
            taxRate={taxRate}
            taxAmount={taxAmount}
            finalAmount={netPayableAmount}
            title="Live Price Valuation"
            subtitle={`${purity} ${category} • BIS Hallmarked`}
            showVisualComposition={true}
          />

          {/* Add to Multi-Item Cart & Convert to Order Actions */}
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={handleAddCurrentToCart}
              className="w-full py-3.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-amber-600/20 active:scale-98 transition-all"
            >
              <Plus size={16} strokeWidth={3} />
              <span>Add to Multi-Item Estimate Cart</span>
            </button>

            <button
              type="button"
              onClick={onConvertEstimateToOrder}
              className="w-full py-3.5 bg-slate-900 hover:bg-black text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm active:scale-98 transition-all"
            >
              <span>Convert to Booking Order</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
