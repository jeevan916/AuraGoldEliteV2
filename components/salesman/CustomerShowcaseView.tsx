import React from 'react';
import { Sparkles, EyeOff, ShieldCheck, CheckCircle2, Award, Gem, Coins, ArrowRight, Wallet, CheckCircle } from 'lucide-react';
import { JewelryDetail } from '../../types';

interface CustomerShowcaseViewProps {
  customerName: string;
  estimateId: string;
  rate22K: number;
  recalculatedCartItems: JewelryDetail[];
  grossCartTotal: number;
  enableOldGold: boolean;
  oldGoldCredit: number;
  discountAmount: number;
  netPayable: number;
  planType: 'FULL' | 'PLAN';
  selectedPlanName: string;
  planMonths: number;
  planCalculations: {
    requiredDownPayment?: number;
    oldGoldCredit?: number;
    netDownPaymentPayable?: number;
    oldGoldAppliedToDownPayment?: number;
    oldGoldSurplusToEMI?: number;
    totalAdvanceValue?: number;
    advancePaid: number;
    cashAdvance?: number;
    oldGoldAdvance?: number;
    principalFinanced: number;
    interestAmount?: number;
    totalFinanced?: number;
    totalPayableWithPlan?: number;
    totalCustomerCashOutflow?: number;
    monthlyInstallment: number;
    subventionSavings: number;
  };
  onCloseShowcase: () => void;
}

export const CustomerShowcaseView: React.FC<CustomerShowcaseViewProps> = ({
  customerName,
  estimateId,
  rate22K,
  recalculatedCartItems,
  grossCartTotal,
  enableOldGold,
  oldGoldCredit,
  discountAmount,
  netPayable,
  planType,
  selectedPlanName,
  planMonths,
  planCalculations,
  onCloseShowcase,
}) => {
  const oldGoldHasValue = enableOldGold && oldGoldCredit > 0;
  const requiredDown = planCalculations.requiredDownPayment ?? planCalculations.advancePaid;
  const netDownToPay = planCalculations.netDownPaymentPayable ?? (
    oldGoldHasValue
      ? (oldGoldCredit >= requiredDown ? 0 : requiredDown - oldGoldCredit)
      : requiredDown
  );
  const oldGoldSurplus = planCalculations.oldGoldSurplusToEMI ?? (
    oldGoldHasValue && oldGoldCredit > requiredDown ? oldGoldCredit - requiredDown : 0
  );

  return (
    <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-amber-500/30 shadow-2xl space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-b border-slate-800">
        <div>
          <span className="text-[10px] font-black uppercase text-amber-400 tracking-widest block">
            AuraGold Elite Showroom Presentation
          </span>
          <h2 className="text-xl sm:text-2xl font-serif font-black text-white mt-1">
            {customerName ? `Quotation for ${customerName}` : 'Custom Jewellery Quotation'}
          </h2>
          <span className="text-xs text-slate-400">{estimateId} • Benchmark 22K: ₹{rate22K.toLocaleString('en-IN')}/g</span>
        </div>

        <button
          type="button"
          onClick={onCloseShowcase}
          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
        >
          <EyeOff size={14} />
          <span>Exit Showcase</span>
        </button>
      </div>

      {/* Selected Ornaments Preview */}
      <div className="space-y-3">
        <span className="text-xs font-black uppercase text-slate-400 tracking-wider block">
          Selected Ornaments ({recalculatedCartItems.length})
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {recalculatedCartItems.map((item) => (
            <div
              key={item.id}
              className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 flex justify-between items-center"
            >
              <div>
                <h4 className="font-bold text-white text-sm">
                  {item.customizationDetails || `${item.purity} ${item.category}`}
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Net Wt: <strong className="text-amber-300">{item.netWeight}g</strong> • Purity:{' '}
                  <strong className="text-slate-200">{item.purity}</strong>
                </p>
              </div>
              <span className="text-base font-black text-amber-300 font-mono">
                ₹{item.finalAmount.toLocaleString('en-IN')}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Commercial Summary Box */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="flex justify-between text-xs sm:text-sm text-slate-300">
          <span>Gross Jewellery Value:</span>
          <span className="font-bold text-white font-mono">₹{grossCartTotal.toLocaleString('en-IN')}</span>
        </div>

        {oldGoldHasValue && (
          <div className="flex justify-between text-xs sm:text-sm text-emerald-400">
            <span className="flex items-center gap-1">
              <Coins size={14} />
              <span>Old Gold Trade-in Credit:</span>
            </span>
            <span className="font-bold font-mono">-₹{oldGoldCredit.toLocaleString('en-IN')}</span>
          </div>
        )}

        {discountAmount > 0 && (
          <div className="flex justify-between text-xs sm:text-sm text-rose-400">
            <span>Showroom Goodwill Discount:</span>
            <span className="font-bold font-mono">-₹{discountAmount.toLocaleString('en-IN')}</span>
          </div>
        )}

        <div className="pt-3 border-t border-slate-800 flex justify-between items-center">
          <div>
            <span className="text-xs uppercase font-black tracking-wider text-amber-400 block">
              Net Valuation
            </span>
            <span className="text-[11px] text-slate-400">All statutory taxes & hallmarking included</span>
          </div>
          <span className="text-2xl sm:text-3xl font-black text-amber-300 font-mono">
            ₹{netPayable.toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      {/* Installment Scheme Presentation (if active) */}
      {planType === 'PLAN' && (
        <div className="bg-gradient-to-br from-indigo-950/90 via-slate-900 to-amber-950/40 border border-amber-500/40 rounded-3xl p-6 space-y-5 shadow-lg">
          <div className="flex justify-between items-center pb-3 border-b border-indigo-900">
            <div className="flex items-center gap-2">
              <ShieldCheck size={20} className="text-amber-400" />
              <div>
                <span className="font-black text-base text-white">{selectedPlanName || `${planMonths} Months EMI Plan`}</span>
                <span className="text-[11px] text-indigo-300 block">Zero-penalty easy monthly payment scheme</span>
              </div>
            </div>
            <span className="text-xs font-black text-amber-300 bg-amber-950/80 px-3 py-1 rounded-xl border border-amber-700">
              Gold Locked @ ₹{rate22K.toLocaleString('en-IN')}/g
            </span>
          </div>

          {/* Down Payment & Old Gold Deduction Step Breakdown */}
          <div className="bg-slate-900/80 rounded-2xl p-4 sm:p-5 border border-indigo-800 space-y-3">
            <span className="text-[10px] font-black uppercase text-indigo-300 tracking-wider block">
              Down Payment & Trade-in Breakdown
            </span>

            <div className="space-y-2 text-xs sm:text-sm">
              <div className="flex justify-between text-slate-300">
                <span>1. Scheme Down Payment Required:</span>
                <span className="font-bold text-white font-mono">₹{requiredDown.toLocaleString('en-IN')}</span>
              </div>

              {oldGoldHasValue && (
                <div className="flex justify-between text-emerald-400">
                  <span className="flex items-center gap-1.5">
                    <Coins size={14} />
                    <span>2. Less: Old Gold Scrap Trade-in:</span>
                  </span>
                  <span className="font-bold font-mono">-₹{oldGoldCredit.toLocaleString('en-IN')}</span>
                </div>
              )}

              <div className="pt-2 border-t border-slate-800 flex justify-between items-center bg-indigo-900/30 p-3 rounded-xl">
                <div>
                  <span className="text-xs font-black text-amber-300 uppercase tracking-wide block">
                    3. Net Down Payment to Pay Today:
                  </span>
                  <span className="text-[11px] text-slate-300">
                    {netDownToPay > 0 ? 'Payable today via Cash / UPI / Card' : 'Fully covered by Old Gold trade-in!'}
                  </span>
                </div>

                <div>
                  {netDownToPay > 0 ? (
                    <span className="text-xl sm:text-2xl font-black text-amber-300 font-mono">
                      ₹{netDownToPay.toLocaleString('en-IN')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-emerald-600 text-white font-black text-xs uppercase tracking-wider">
                      <CheckCircle size={14} />
                      <span>₹0 (Fully Covered)</span>
                    </span>
                  )}
                </div>
              </div>

              {oldGoldSurplus > 0 && (
                <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-800 text-[11px] text-emerald-300">
                  ✨ <strong>Surplus Trade-in Benefit:</strong> The remaining ₹{oldGoldSurplus.toLocaleString('en-IN')} Old Gold value is automatically deducted from your remaining EMI balance!
                </div>
              )}
            </div>
          </div>

          {/* 3 Metric Cards for EMI Plan */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800">
              <span className="text-[10px] text-indigo-300 block uppercase font-bold">Net Down Payment Today</span>
              <span className="text-lg font-black text-amber-300 block mt-0.5 font-mono">
                ₹{netDownToPay.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {netDownToPay === 0 ? '✓ No cash payment needed' : 'Due at booking'}
              </span>
            </div>

            <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800">
              <span className="text-[10px] text-indigo-300 block uppercase font-bold">Monthly Installment</span>
              <span className="text-lg font-black text-emerald-400 block mt-0.5 font-mono">
                ₹{planCalculations.monthlyInstallment.toLocaleString('en-IN')}/mo
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                ({planMonths} monthly milestones)
              </span>
            </div>

            <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800">
              <span className="text-[10px] text-indigo-300 block uppercase font-bold">Remaining Financed Balance</span>
              <span className="text-lg font-black text-white block mt-0.5 font-mono">
                ₹{planCalculations.principalFinanced.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Split over {planMonths} months
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
