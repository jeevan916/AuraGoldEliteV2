import React, { useState } from 'react';
import { 
  ReceiptIndianRupee, Percent, CheckCircle2, ShieldCheck, Smartphone, 
  Printer, Copy, Bookmark, Send, Sparkles, Check, Info, Sliders, Award, Layers,
  Calendar, ChevronDown, ChevronUp, ArrowRight, Coins, DollarSign, Wallet,
  CheckCircle, ArrowDownRight, AlertCircle
} from 'lucide-react';
import { PaymentPlanTemplate, ProtectionStatus } from '../../types';

interface Step4PaymentQuotationProps {
  grossCartTotal: number;
  enableOldGold: boolean;
  oldGoldCredit: number;
  discountAmount: number;
  setDiscountAmount: (amt: number) => void;
  netPayable: number;
  subventionDiscountAmount: number;
  netPayableAfterSubvention: number;
  planType: 'FULL' | 'PLAN';
  setPlanType: (type: 'FULL' | 'PLAN') => void;
  activePlanTemplates: PaymentPlanTemplate[];
  selectedRangeFilter: 'ALL' | '10K_50K' | '50K_120K' | '120K_PLUS' | 'CUSTOM';
  setSelectedRangeFilter: (filter: 'ALL' | '10K_50K' | '50K_120K' | '120K_PLUS' | 'CUSTOM') => void;
  selectedTemplateId: string;
  setSelectedTemplateId: (id: string) => void;
  selectedPlanName: string;
  setSelectedPlanName: (name: string) => void;
  planMonths: number;
  setPlanMonths: (months: number) => void;
  planAdvancePercent: number;
  setPlanAdvancePercent: (pct: number) => void;
  planAdvanceAmount: number;
  setPlanAdvanceAmount: (amt: number) => void;
  useOldGoldAsAdvance: boolean;
  setUseOldGoldAsAdvance: (use: boolean) => void;
  planInterestPercent: number;
  setPlanInterestPercent: (pct: number) => void;
  subventionPercentage: number;
  setSubventionPercentage: (pct: number) => void;
  rateProtectionEnabled: boolean;
  setRateProtectionEnabled: (enabled: boolean) => void;
  planCalculations: {
    requiredDownPayment?: number;
    oldGoldCredit?: number;
    netDownPaymentPayable?: number;
    oldGoldAppliedToDownPayment?: number;
    oldGoldSurplusToEMI?: number;
    totalAdvanceValue?: number;
    advancePaid: number;
    cashAdvance: number;
    oldGoldAdvance?: number;
    principalFinanced: number;
    interestAmount: number;
    totalFinanced?: number;
    totalPayableWithPlan: number;
    totalCustomerCashOutflow?: number;
    monthlyInstallment: number;
    subventionSavings: number;
    milestones: any[];
  };
  rate22K: number;
  copiedText: boolean;
  onShareWhatsApp: () => void;
  onCopyText: () => void;
  onConvertEstimateToOrder: () => void;
  onSaveEstimate: () => void;
  onToggleCustomerView: () => void;
  customerViewActive: boolean;
}

export const Step4PaymentQuotation: React.FC<Step4PaymentQuotationProps> = ({
  grossCartTotal,
  enableOldGold,
  oldGoldCredit,
  discountAmount,
  setDiscountAmount,
  netPayable,
  subventionDiscountAmount,
  netPayableAfterSubvention,
  planType,
  setPlanType,
  activePlanTemplates,
  selectedRangeFilter,
  setSelectedRangeFilter,
  selectedTemplateId,
  setSelectedTemplateId,
  selectedPlanName,
  setSelectedPlanName,
  planMonths,
  setPlanMonths,
  planAdvancePercent,
  setPlanAdvancePercent,
  planAdvanceAmount,
  setPlanAdvanceAmount,
  useOldGoldAsAdvance,
  setUseOldGoldAsAdvance,
  planInterestPercent,
  setPlanInterestPercent,
  subventionPercentage,
  setSubventionPercentage,
  rateProtectionEnabled,
  setRateProtectionEnabled,
  planCalculations,
  rate22K,
  copiedText,
  onShareWhatsApp,
  onCopyText,
  onConvertEstimateToOrder,
  onSaveEstimate,
  onToggleCustomerView,
  customerViewActive,
}) => {
  const [showMilestonesTable, setShowMilestonesTable] = useState(false);
  const [customAdvanceMode, setCustomAdvanceMode] = useState<'PERCENT' | 'AMOUNT'>('PERCENT');

  const finalEffectivePayable = planType === 'PLAN' ? netPayableAfterSubvention : netPayable;
  const oldGoldHasValue = enableOldGold && oldGoldCredit > 0;
  
  const commercialGross = Math.max(0, grossCartTotal - (discountAmount || 0) - subventionDiscountAmount);
  const requiredDownPayment = planCalculations.requiredDownPayment ?? (
    planAdvanceAmount > 0 
      ? Math.min(commercialGross, planAdvanceAmount) 
      : Math.round(commercialGross * (planAdvancePercent / 100))
  );
  const oldGoldVal = enableOldGold ? oldGoldCredit : 0;
  const netDownPaymentToPay = planCalculations.netDownPaymentPayable ?? (
    oldGoldVal >= requiredDownPayment ? 0 : Math.max(0, requiredDownPayment - oldGoldVal)
  );
  const oldGoldSurplus = planCalculations.oldGoldSurplusToEMI ?? (
    oldGoldVal > requiredDownPayment ? oldGoldVal - requiredDownPayment : 0
  );
  const principalFinanced = planCalculations.principalFinanced;
  const totalFinancedAmount = planCalculations.totalFinanced ?? (principalFinanced + planCalculations.interestAmount);
  const totalCashToPay = planCalculations.totalCustomerCashOutflow ?? (netDownPaymentToPay + totalFinancedAmount);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. COMMERCIAL BILLING SUMMARY HERO */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white rounded-3xl p-6 sm:p-7 shadow-xl border border-slate-800 space-y-5">
        <div className="flex justify-between items-center pb-4 border-b border-slate-800">
          <div>
            <span className="text-[10px] font-black uppercase text-amber-400 tracking-widest block">Final Commercial Valuation</span>
            <h3 className="text-xl font-black text-white mt-0.5">Net Settlement Summary</h3>
          </div>
          <span className="text-xs font-bold bg-slate-800 text-slate-300 px-3 py-1.5 rounded-xl border border-slate-700">
            Benchmark 22K: ₹{rate22K.toLocaleString('en-IN')}/g
          </span>
        </div>

        {/* Calculation Lines */}
        <div className="space-y-2.5 text-xs sm:text-sm">
          <div className="flex justify-between text-slate-300">
            <span>Gross Jewellery Cart Total (incl. 3% GST):</span>
            <span className="font-bold text-white">₹{grossCartTotal.toLocaleString('en-IN')}</span>
          </div>

          {oldGoldHasValue && (
            <div className="flex justify-between text-emerald-400">
              <span className="flex items-center gap-1.5">
                <Coins size={14} />
                <span>Old Gold / Scrap Trade-in Credit:</span>
              </span>
              <span className="font-bold">-₹{oldGoldCredit.toLocaleString('en-IN')}</span>
            </div>
          )}

          {discountAmount > 0 && (
            <div className="flex justify-between text-rose-400">
              <span>Showroom Goodwill Discount:</span>
              <span className="font-bold">-₹{discountAmount.toLocaleString('en-IN')}</span>
            </div>
          )}

          {planType === 'PLAN' && subventionDiscountAmount > 0 && (
            <div className="flex justify-between text-amber-300">
              <span>Merchant Subvention Subsidy ({subventionPercentage}%):</span>
              <span className="font-bold">-₹{subventionDiscountAmount.toLocaleString('en-IN')}</span>
            </div>
          )}

          <div className="pt-3 border-t border-slate-700 flex justify-between items-center">
            <div>
              <span className="text-xs uppercase font-black tracking-wider text-amber-400 block">
                Net Payable Amount
              </span>
              <span className="text-[11px] text-slate-400">
                {planType === 'PLAN' ? 'Balance split between Upfront Down Payment & EMIs' : 'Direct full settlement balance'}
              </span>
            </div>
            <span className="text-2xl sm:text-3xl font-black text-amber-300 tracking-tight">
              ₹{finalEffectivePayable.toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      </div>

      {/* 2. DISCOUNT & ADJUSTMENTS BAR */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-black text-xs">
            <Percent size={15} />
          </div>
          <div>
            <h4 className="font-black text-slate-900 text-xs uppercase tracking-wider">Showroom Goodwill Discount</h4>
            <p className="text-[11px] text-slate-500">Apply custom flat price reduction</p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Quick preset chips */}
          <div className="hidden sm:flex items-center gap-1">
            {[500, 1000, 2000, 5000].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setDiscountAmount(amt)}
                className={`px-2 py-1 text-[10px] font-bold rounded-lg transition-colors ${
                  discountAmount === amt ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                ₹{amt.toLocaleString('en-IN')}
              </button>
            ))}
          </div>

          <div className="relative flex-1 sm:w-40">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₹</span>
            <input
              type="number"
              min="0"
              value={discountAmount || ''}
              onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
              placeholder="0"
              className="w-full pl-7 pr-3 py-2 text-xs font-black text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500"
            />
          </div>
          {discountAmount > 0 && (
            <button
              type="button"
              onClick={() => setDiscountAmount(0)}
              className="px-2.5 py-2 text-[11px] font-bold text-slate-400 hover:text-slate-700 bg-slate-100 rounded-xl"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* 3. PAYMENT SCHEME / EMI SIMULATOR */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-black">
              <ReceiptIndianRupee size={18} />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">Payment Method & Scheme</h3>
              <p className="text-xs text-slate-500">Choose between immediate full settlement or milestone installment scheme</p>
            </div>
          </div>

          {/* Full vs Plan Switch */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setPlanType('FULL')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                planType === 'FULL' ? 'bg-white text-slate-900 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Full Payment
            </button>
            <button
              type="button"
              onClick={() => setPlanType('PLAN')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                planType === 'PLAN' ? 'bg-indigo-600 text-white shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Installment Plan
            </button>
          </div>
        </div>

        {planType === 'PLAN' && (
          <div className="space-y-6 pt-1 animate-fadeIn">
            
            {/* 3.1 PRESET SCHEME TEMPLATES */}
            <div>
              <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider block mb-2.5">
                Popular Showroom Schemes
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {activePlanTemplates.map((tpl) => {
                  const isSelected = selectedTemplateId === tpl.id;
                  const tplSubvention = Math.round(grossCartTotal * ((tpl.subventionPercentage || 0) / 100));
                  const tplCommercial = Math.max(0, grossCartTotal - (discountAmount || 0) - tplSubvention);
                  const tplReqDown = Math.round(tplCommercial * (tpl.advancePercentage / 100));
                  const tplOldGold = enableOldGold ? oldGoldCredit : 0;
                  const tplNetDown = tplOldGold >= tplReqDown ? 0 : tplReqDown - tplOldGold;
                  const tplTotalAdvance = Math.max(tplReqDown, tplOldGold);
                  const tplPrincipal = Math.max(0, tplCommercial - tplTotalAdvance);
                  const tplInterest = Math.round(tplPrincipal * (tpl.interestPercentage / 100) * (tpl.months / 12));
                  const tplTotalFin = tplPrincipal + tplInterest;
                  const tplMonthly = tpl.months > 0 ? Math.round(tplTotalFin / tpl.months) : tplTotalFin;

                  return (
                    <button
                      type="button"
                      key={tpl.id}
                      onClick={() => {
                        setSelectedTemplateId(tpl.id);
                        setSelectedPlanName(tpl.name);
                        setPlanMonths(tpl.months);
                        setPlanAdvancePercent(tpl.advancePercentage);
                        setPlanAdvanceAmount(0);
                        setPlanInterestPercent(tpl.interestPercentage);
                        setSubventionPercentage(tpl.subventionPercentage || 0);
                        setRateProtectionEnabled(tpl.goldRateProtection ?? true);
                      }}
                      className={`p-4 rounded-2xl border-2 text-left transition-all relative ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/70 shadow-sm ring-1 ring-indigo-500/30'
                          : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-black text-slate-900 text-xs">{tpl.name}</span>
                        {isSelected && <CheckCircle2 size={16} className="text-indigo-600 shrink-0" />}
                      </div>

                      <div className="mt-2 space-y-1 text-[11px] text-slate-600">
                        <p>Tenure: <strong className="text-slate-900">{tpl.months} Months</strong> ({tpl.interestPercentage}% int.)</p>
                        <p>
                          Plan Down Payment: <strong className="text-slate-900">₹{tplReqDown.toLocaleString('en-IN')}</strong> ({tpl.advancePercentage}%)
                        </p>
                        {enableOldGold && oldGoldCredit > 0 && (
                          <p className="text-emerald-700 font-bold flex items-center gap-1">
                            <span>Old Gold Deducted:</span>
                            <span>-₹{oldGoldCredit.toLocaleString('en-IN')}</span>
                          </p>
                        )}
                        <p className="font-black text-indigo-950">
                          {enableOldGold && oldGoldCredit > 0 ? (
                            tplNetDown > 0 ? (
                              <span className="text-amber-800">Net Down to Pay: ₹{tplNetDown.toLocaleString('en-IN')}</span>
                            ) : (
                              <span className="text-emerald-600">Net Down: ₹0 (100% Covered)</span>
                            )
                          ) : (
                            <span>Down Payment: ₹{tplReqDown.toLocaleString('en-IN')}</span>
                          )}
                        </p>
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-slate-200/80 flex justify-between items-center">
                        <span className="text-[10px] uppercase font-black text-slate-400">Monthly EMI</span>
                        <span className="text-xs font-black text-indigo-700">₹{tplMonthly.toLocaleString('en-IN')}/mo</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3.2 DEDICATED DOWN PAYMENT & OLD GOLD DEDUCTION BREAKDOWN CARD */}
            <div className="bg-gradient-to-br from-amber-50/90 via-orange-50/50 to-indigo-50/80 rounded-3xl p-5 sm:p-6 border-2 border-amber-300/80 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-amber-200/80">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                    <Wallet size={16} />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 text-sm">
                      Down Payment & Old Gold Deduction
                    </h4>
                    <p className="text-[11px] text-slate-600">
                      Transparent step-by-step upfront settlement calculation
                    </p>
                  </div>
                </div>

                {oldGoldHasValue && (
                  <span className="text-xs font-black text-emerald-800 bg-emerald-100/90 px-3 py-1 rounded-xl border border-emerald-300 flex items-center gap-1">
                    <Coins size={14} />
                    <span>Old Gold Appraised: ₹{oldGoldCredit.toLocaleString('en-IN')}</span>
                  </span>
                )}
              </div>

              {/* Step-by-Step Mathematical Flow */}
              <div className="space-y-3 bg-white/90 rounded-2xl p-4 sm:p-5 border border-amber-200 shadow-xs">
                
                {/* 1. Required Down Payment */}
                <div className="flex justify-between items-center text-xs sm:text-sm text-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-[10px] font-black">
                      1
                    </span>
                    <span className="font-bold text-slate-900">
                      Plan Required Down Payment ({planAdvancePercent}%):
                    </span>
                  </div>
                  <span className="font-black text-slate-900 text-sm sm:text-base">
                    ₹{requiredDownPayment.toLocaleString('en-IN')}
                  </span>
                </div>

                {/* 2. Less Old Gold Credit */}
                {oldGoldHasValue && (
                  <div className="flex justify-between items-center text-xs sm:text-sm text-emerald-700">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[10px] font-black">
                        2
                      </span>
                      <span className="font-bold">
                        Less: Old Gold Scrap Trade-in Credit:
                      </span>
                    </div>
                    <span className="font-black text-emerald-700 text-sm sm:text-base">
                      -₹{oldGoldCredit.toLocaleString('en-IN')}
                    </span>
                  </div>
                )}

                {/* Divider */}
                <div className="border-t-2 border-dashed border-amber-300/80 my-2 pt-2">
                  
                  {/* 3. Net Down Payment To Pay Today */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-amber-100/70 p-3.5 rounded-xl border border-amber-300">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px] font-black">
                          3
                        </span>
                        <span className="text-xs uppercase font-black tracking-wider text-amber-950 block">
                          Net Down Payment to Pay Today:
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-900 pl-7">
                        {netDownPaymentToPay > 0 ? (
                          <span>Customer pays <strong>₹{netDownPaymentToPay.toLocaleString('en-IN')}</strong> upfront via Cash / UPI / Card today.</span>
                        ) : (
                          <span className="text-emerald-800 font-bold">
                            🎉 Old Gold covers 100% of down payment. No upfront cash required today!
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="pl-7 sm:pl-0">
                      {netDownPaymentToPay > 0 ? (
                        <span className="text-xl sm:text-2xl font-black text-amber-950 font-mono">
                          ₹{netDownPaymentToPay.toLocaleString('en-IN')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-600 text-white font-black text-xs uppercase tracking-wider shadow-xs">
                          <CheckCircle size={14} />
                          <span>₹0 Upfront Due</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* If Old Gold exceeds required down payment */}
                  {oldGoldSurplus > 0 && (
                    <div className="mt-2.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2">
                      <Sparkles size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-emerald-950 font-black">
                          Old Gold Surplus Benefit (₹{oldGoldSurplus.toLocaleString('en-IN')}):
                        </strong>
                        <p className="text-[11px] text-emerald-800 mt-0.5">
                          Since your Old Gold value (₹{oldGoldCredit.toLocaleString('en-IN')}) exceeds the {planAdvancePercent}% down payment requirement (₹{requiredDownPayment.toLocaleString('en-IN')}), the extra ₹{oldGoldSurplus.toLocaleString('en-IN')} is deducted directly from the remaining EMI balance, reducing your monthly payments!
                        </p>
                      </div>
                    </div>
                  )}

                  {/* 4. Remaining Balance in Selected Plan Duration */}
                  <div className="mt-3 pt-3 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 text-xs text-slate-700">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 flex items-center justify-center text-[10px] font-black">
                        4
                      </span>
                      <span className="font-bold text-slate-900">
                        Remaining Financed Balance in Selected Plan Duration ({planMonths} Months):
                      </span>
                    </div>
                    <div className="text-right pl-7 sm:pl-0">
                      <span className="font-black text-indigo-900 text-sm">
                        ₹{principalFinanced.toLocaleString('en-IN')}
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        ({planMonths} monthly EMIs of ₹{planCalculations.monthlyInstallment.toLocaleString('en-IN')}/mo)
                      </span>
                    </div>
                  </div>

                </div>
              </div>

              {/* Down Payment Quick Customizer Controls */}
              <div className="space-y-3 pt-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-black text-slate-700 uppercase text-[10px] tracking-wider">
                    Adjust Down Payment Target:
                  </span>
                  <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-slate-200 text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => {
                        setCustomAdvanceMode('PERCENT');
                        setPlanAdvanceAmount(0);
                      }}
                      className={`px-2.5 py-1 rounded-lg ${customAdvanceMode === 'PERCENT' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600'}`}
                    >
                      Percentage (%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomAdvanceMode('AMOUNT')}
                      className={`px-2.5 py-1 rounded-lg ${customAdvanceMode === 'AMOUNT' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600'}`}
                    >
                      Custom Cash (₹)
                    </button>
                  </div>
                </div>

                {customAdvanceMode === 'PERCENT' ? (
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                    {[10, 15, 20, 25, 30, 40, 50].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => {
                          setPlanAdvancePercent(pct);
                          setPlanAdvanceAmount(0);
                        }}
                        className={`py-1.5 rounded-xl text-xs font-black transition-all ${
                          planAdvancePercent === pct && planAdvanceAmount === 0
                            ? 'bg-slate-900 text-white shadow-xs ring-1 ring-slate-800'
                            : 'bg-white text-slate-700 border border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₹</span>
                    <input
                      type="number"
                      min="0"
                      value={planAdvanceAmount || ''}
                      onChange={(e) => setPlanAdvanceAmount(parseFloat(e.target.value) || 0)}
                      placeholder="Enter custom target down payment amount"
                      className="w-full pl-7 pr-3 py-2 text-xs font-black text-slate-900 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}
              </div>

              {/* Custom Adjusters: Tenure & Interest & Rate Lock */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-amber-200/80 text-xs">
                {/* Tenure */}
                <div>
                  <span className="text-[10px] uppercase font-black text-slate-500 block mb-1">Tenure (Months)</span>
                  <div className="grid grid-cols-4 gap-1">
                    {[3, 6, 9, 12].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPlanMonths(m)}
                        className={`py-1.5 rounded-lg text-xs font-black transition-all ${
                          planMonths === m ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white text-slate-700 border border-slate-200'
                        }`}
                      >
                        {m}M
                      </button>
                    ))}
                  </div>
                </div>

                {/* Interest Rate */}
                <div>
                  <span className="text-[10px] uppercase font-black text-slate-500 block mb-1">Interest Rate (% p.a.)</span>
                  <div className="grid grid-cols-3 gap-1">
                    {[0, 2, 4].map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => setPlanInterestPercent(rate)}
                        className={`py-1.5 rounded-lg text-xs font-black transition-all ${
                          planInterestPercent === rate ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white text-slate-700 border border-slate-200'
                        }`}
                      >
                        {rate === 0 ? '0% Free' : `${rate}%`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Gold Rate Protection */}
                <div>
                  <span className="text-[10px] uppercase font-black text-slate-500 block mb-1">Gold Rate Protection</span>
                  <button
                    type="button"
                    onClick={() => setRateProtectionEnabled(!rateProtectionEnabled)}
                    className={`w-full py-1.5 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
                      rateProtectionEnabled
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-white text-slate-600 border border-slate-200'
                    }`}
                  >
                    <ShieldCheck size={14} />
                    <span>{rateProtectionEnabled ? 'Rate Locked' : 'Unlocked'}</span>
                  </button>
                </div>
              </div>

            </div>

            {/* 3.3 LIVE EMI BREAKDOWN RESULT CARD (Indigo) */}
            <div className="bg-indigo-950 text-white rounded-3xl p-5 sm:p-6 border border-indigo-900 shadow-lg space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-indigo-900">
                <span className="text-xs font-black uppercase text-indigo-300 tracking-wider">
                  Payment Scheme Live Breakdown
                </span>
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1">
                  <ShieldCheck size={14} />
                  <span>Gold Locked @ ₹{rate22K.toLocaleString('en-IN')}/g</span>
                </span>
              </div>

              {/* 4 Major Metric Blocks */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                {/* 1. Net Down Payment Due Today */}
                <div className="bg-indigo-900/40 p-3.5 rounded-2xl border border-indigo-800/60">
                  <span className="text-indigo-300 block text-[10px] uppercase font-bold">Net Down Payment Today</span>
                  <span className="text-base sm:text-lg font-black text-amber-300 block mt-0.5 font-mono">
                    ₹{netDownPaymentToPay.toLocaleString('en-IN')}
                  </span>
                  {oldGoldHasValue ? (
                    <span className="text-[10px] text-emerald-300 mt-1 block">
                      {netDownPaymentToPay === 0 ? '✓ 100% Covered by Old Gold' : `(After -₹${oldGoldCredit.toLocaleString('en-IN')} Old Gold)`}
                    </span>
                  ) : (
                    <span className="text-[10px] text-indigo-300 mt-1 block">{planAdvancePercent}% Initial Advance</span>
                  )}
                </div>

                {/* 2. Financed Balance */}
                <div className="bg-indigo-900/40 p-3.5 rounded-2xl border border-indigo-800/60">
                  <span className="text-indigo-300 block text-[10px] uppercase font-bold">Financed Balance</span>
                  <span className="text-base sm:text-lg font-black text-white block mt-0.5 font-mono">
                    ₹{principalFinanced.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-indigo-300 mt-1 block">
                    {planInterestPercent === 0 ? '0% Zero Interest' : `+ ₹${planCalculations.interestAmount.toLocaleString('en-IN')} interest`}
                  </span>
                </div>

                {/* 3. Monthly Installment (EMI) */}
                <div className="bg-indigo-900/40 p-3.5 rounded-2xl border border-indigo-800/60">
                  <span className="text-indigo-300 block text-[10px] uppercase font-bold">Monthly Installment</span>
                  <span className="text-lg font-black text-emerald-400 block mt-0.5 font-mono">
                    ₹{planCalculations.monthlyInstallment.toLocaleString('en-IN')}/mo
                  </span>
                  <span className="text-[10px] text-slate-300 mt-1 block">
                    {planMonths} monthly milestones
                  </span>
                </div>

                {/* 4. Total Customer Cash Outflow */}
                <div className="bg-indigo-900/40 p-3.5 rounded-2xl border border-indigo-800/60">
                  <span className="text-indigo-300 block text-[10px] uppercase font-bold">Customer Cash Outflow</span>
                  <span className="text-base sm:text-lg font-black text-white block mt-0.5 font-mono">
                    ₹{totalCashToPay.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-indigo-300 mt-1 block">
                    Down Payment + EMIs
                  </span>
                </div>
              </div>

              {/* Reconciliation Status Bar */}
              <div className="pt-2 border-t border-indigo-900/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-[11px] text-indigo-200">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                  <span>
                    Total Valuation: Down Payment (₹{planCalculations.totalAdvanceValue?.toLocaleString('en-IN') || planCalculations.advancePaid.toLocaleString('en-IN')}) + EMIs (₹{totalFinancedAmount.toLocaleString('en-IN')}) = <strong className="text-white font-black">₹{planCalculations.totalPayableWithPlan.toLocaleString('en-IN')}</strong>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowMilestonesTable(!showMilestonesTable)}
                  className="px-2.5 py-1 bg-indigo-900/80 hover:bg-indigo-800 text-indigo-200 hover:text-white rounded-lg font-bold flex items-center gap-1 transition-colors"
                >
                  <Calendar size={12} />
                  <span>{showMilestonesTable ? 'Hide Schedule' : `View ${planCalculations.milestones.length} Milestones`}</span>
                  {showMilestonesTable ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
              </div>

              {/* 3.4 COLLAPSIBLE MILESTONES TABLE */}
              {showMilestonesTable && (
                <div className="mt-3 bg-slate-900 rounded-2xl p-4 border border-indigo-800/80 space-y-3 animate-fadeIn">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                    Detailed Milestone Schedule & Due Dates
                  </span>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase font-bold">
                          <th className="pb-2">Milestone / Due Date</th>
                          <th className="pb-2">Description</th>
                          <th className="pb-2 text-right">Target Amount</th>
                          <th className="pb-2 text-right">Cumulative</th>
                          <th className="pb-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-200">
                        {planCalculations.milestones.map((m, idx) => (
                          <tr key={m.id || idx} className="hover:bg-slate-800/40">
                            <td className="py-2.5 font-mono text-[11px] text-slate-300">
                              {m.dueDate}
                            </td>
                            <td className="py-2.5 font-medium text-white">
                              {m.description || `Milestone #${idx}`}
                            </td>
                            <td className="py-2.5 text-right font-black text-amber-300 font-mono">
                              ₹{m.targetAmount.toLocaleString('en-IN')}
                            </td>
                            <td className="py-2.5 text-right font-mono text-[11px] text-slate-400">
                              ₹{m.cumulativeTarget.toLocaleString('en-IN')}
                            </td>
                            <td className="py-2.5 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                m.status === 'PAID' 
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' 
                                  : 'bg-amber-950 text-amber-400 border border-amber-800'
                              }`}>
                                {m.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 4. PRIMARY SHOWROOM ACTION BUTTONS */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Award size={18} className="text-amber-600" />
          <h4 className="font-black text-slate-900 text-sm">Quotation Actions & Booking</h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Direct WhatsApp Share (Salesman Device) */}
          <button
            type="button"
            onClick={onShareWhatsApp}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-md shadow-emerald-600/20 active:scale-98 transition-all"
            title="Open quotation in WhatsApp on salesman phone"
          >
            <Smartphone size={18} />
            <span>Send on WhatsApp</span>
          </button>

          {/* Book / Convert to Order */}
          <button
            type="button"
            onClick={onConvertEstimateToOrder}
            className="w-full py-4 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-2xl text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-md shadow-amber-600/20 active:scale-98 transition-all"
          >
            <CheckCircle2 size={18} />
            <span>Book / Convert to Order</span>
          </button>
        </div>

        {/* Secondary Utility Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCopyText}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              {copiedText ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              <span>{copiedText ? 'Copied to Clipboard!' : 'Copy Summary'}</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <Printer size={14} />
              <span>Print Quote</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSaveEstimate}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <Bookmark size={14} />
              <span>Save Draft Quote</span>
            </button>

            <button
              type="button"
              onClick={onToggleCustomerView}
              className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                customerViewActive
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Sparkles size={14} />
              <span>Customer Showcase</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
