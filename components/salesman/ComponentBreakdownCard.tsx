import React from 'react';
import { 
  ReceiptIndianRupee, Scale, Sparkles, Gem, ShieldCheck, 
  Percent, Coins, Check, ArrowRight
} from 'lucide-react';

interface ComponentBreakdownCardProps {
  grossWeight: number;
  netWeight: number;
  stoneWeight?: number;
  purity: string;
  metalColor?: string;
  ratePerGram: number;
  baseMetalValue: number;
  wastagePercentage: number;
  wastageValue: number;
  makingChargesPerGram: number;
  makingChargeType?: 'PER_GRAM' | 'PERCENT';
  makingChargePercent?: number;
  totalLaborValue: number;
  stoneCharges: number;
  otherCharges: number;
  oldGoldCredit?: number;
  discountAmount?: number;
  subTotalPreTax: number;
  taxRate?: number;
  taxAmount: number;
  finalAmount: number;
  title?: string;
  subtitle?: string;
  category?: string;
}

export const ComponentBreakdownCard: React.FC<ComponentBreakdownCardProps> = ({
  grossWeight,
  netWeight,
  stoneWeight = Math.max(0, Number((grossWeight - netWeight).toFixed(3))),
  purity,
  metalColor = 'Yellow Gold',
  ratePerGram,
  baseMetalValue,
  wastagePercentage,
  wastageValue,
  makingChargesPerGram,
  makingChargeType = 'PER_GRAM',
  makingChargePercent = 0,
  totalLaborValue,
  stoneCharges,
  otherCharges,
  oldGoldCredit = 0,
  discountAmount = 0,
  subTotalPreTax,
  taxRate = 3,
  taxAmount,
  finalAmount,
  title = "Calculation Summary",
  subtitle = "Instant transparent gold price breakdown",
  category = "Jewellery"
}) => {
  return (
    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-amber-200/80 shadow-md shadow-amber-500/5 space-y-4">
      {/* Header */}
      <div className="flex justify-between items-start pb-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-800 flex items-center justify-center font-black">
            <ReceiptIndianRupee size={20} />
          </div>
          <div>
            <h3 className="font-serif font-black text-slate-900 text-base">{title}</h3>
            <p className="text-xs text-slate-500">{purity} {category} • ₹{ratePerGram.toLocaleString('en-IN')}/g</p>
          </div>
        </div>

        <span className="bg-amber-100 text-amber-900 text-xs font-black px-3 py-1 rounded-full font-mono">
          {netWeight > 0 ? `${netWeight}g` : '0g'} Net
        </span>
      </div>

      {/* Itemized Line Items Table */}
      <div className="space-y-2.5 text-sm">
        {/* 1. Gold Metal Value */}
        <div className="bg-amber-50/60 border border-amber-200/70 rounded-2xl p-3 space-y-1">
          <div className="flex justify-between items-center text-slate-800">
            <span className="text-xs font-bold flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
              <span>Gold Metal Value</span>
            </span>
            <span className="font-bold font-mono text-slate-950 text-sm">
              ₹{baseMetalValue.toLocaleString('en-IN')}
            </span>
          </div>
          <p className="text-[11px] text-amber-800 font-medium pl-4">
            Calculation: <span className="font-mono font-bold">{netWeight}g</span> (Net Wt) × <span className="font-mono font-bold">₹{ratePerGram.toLocaleString('en-IN')}</span>/g ({purity})
          </p>
        </div>

        {/* 2. Crafting Breakdown: Making Charges */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2">
          <div className="flex justify-between items-center text-slate-800 pb-1.5 border-b border-slate-200/80">
            <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Sparkles size={13} className="text-amber-600" />
              <span>Making Charges</span>
            </span>
            <span className="font-bold font-mono text-slate-900 text-sm">
              ₹{(wastageValue + totalLaborValue).toLocaleString('en-IN')}
            </span>
          </div>

          {/* Row A: Making Charges / Labour */}
          <div className="space-y-0.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-700 font-semibold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0" />
                <span>Making Charges ({wastagePercentage}%)</span>
              </span>
              <span className="font-bold font-mono text-slate-900">
                ₹{wastageValue.toLocaleString('en-IN')}
              </span>
            </div>
            <p className="text-[10.5px] text-slate-500 font-medium pl-3">
              Formula: {wastagePercentage}% of ₹{baseMetalValue.toLocaleString('en-IN')} (Gold Value)
            </p>
          </div>

          {/* Row B: Majuri (Only if applicable) */}
          {totalLaborValue > 0 && (
            <div className="space-y-0.5 pt-1 border-t border-slate-200/50">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-700 font-semibold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0" />
                  <span>
                    Majuri {makingChargeType === 'PERCENT' ? `(${makingChargePercent}%)` : `(₹${makingChargesPerGram}/g)`}
                  </span>
                </span>
                <span className="font-bold font-mono text-slate-900">
                  ₹{totalLaborValue.toLocaleString('en-IN')}
                </span>
              </div>
              <p className="text-[10.5px] text-slate-500 font-medium pl-3">
                {makingChargeType === 'PERCENT' 
                  ? `Formula: ${makingChargePercent}% of ₹${baseMetalValue.toLocaleString('en-IN')}`
                  : `Formula: ₹${makingChargesPerGram}/g × ${netWeight}g (Net Wt)`}
              </p>
            </div>
          )}
        </div>

        {/* 3. Stones & Extra Charges (If any) */}
        {(stoneCharges > 0 || otherCharges > 0) && (
          <div className="flex justify-between items-center text-slate-700 bg-slate-50 border border-slate-200/70 px-3 py-2 rounded-xl">
            <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Gem size={13} className="text-emerald-600" />
              <span>Stones & Hallmarking</span>
            </span>
            <span className="font-bold font-mono text-slate-900 text-xs">
              ₹{(stoneCharges + otherCharges).toLocaleString('en-IN')}
            </span>
          </div>
        )}

        {/* 4. GST */}
        <div className="flex justify-between items-center text-slate-700 bg-slate-50 border border-slate-200/70 px-3 py-2 rounded-xl">
          <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <Percent size={13} className="text-slate-500" />
            <span>GST ({taxRate}% on Pre-Tax Total)</span>
          </span>
          <span className="font-bold font-mono text-slate-900 text-xs">
            ₹{taxAmount.toLocaleString('en-IN')}
          </span>
        </div>

        {/* 5. Old Gold Trade-in Credit (If any) */}
        {oldGoldCredit > 0 && (
          <div className="flex justify-between items-center text-emerald-800 bg-emerald-50/80 px-3 py-2 rounded-xl border border-emerald-200/70">
            <span className="text-xs font-bold flex items-center gap-1.5">
              <Coins size={14} className="text-emerald-600" />
              <span>Old Gold Exchange Credit</span>
            </span>
            <span className="font-black font-mono text-xs">
              -₹{oldGoldCredit.toLocaleString('en-IN')}
            </span>
          </div>
        )}

        {/* 6. Goodwill Discount (If any) */}
        {discountAmount > 0 && (
          <div className="flex justify-between items-center text-rose-800 bg-rose-50/80 px-3 py-2 rounded-xl border border-rose-200/70">
            <span className="text-xs font-bold flex items-center gap-1.5">
              <Percent size={14} className="text-rose-600" />
              <span>Showroom Goodwill Discount</span>
            </span>
            <span className="font-black font-mono text-xs">
              -₹{discountAmount.toLocaleString('en-IN')}
            </span>
          </div>
        )}
      </div>

      {/* Prominent Total Card */}
      <div className="bg-gradient-to-br from-amber-500/10 via-amber-600/10 to-amber-700/5 border border-amber-300 rounded-2xl p-4 flex justify-between items-center">
        <div>
          <span className="text-[11px] font-black uppercase tracking-wider text-amber-900 block">
            Total Net Amount
          </span>
          <span className="text-[10px] text-amber-700 font-medium">
            Including all taxes & charges
          </span>
        </div>
        <div className="text-right">
          <span className="text-2xl sm:text-3xl font-serif font-black text-amber-950 font-mono tracking-tight">
            ₹{finalAmount.toLocaleString('en-IN')}
          </span>
        </div>
      </div>
    </div>
  );
};
