import React from 'react';
import { 
  Sparkles, ShieldCheck, Scale, Gem, ReceiptIndianRupee, 
  HelpCircle, CheckCircle2, Info, ArrowRight, Percent, Award
} from 'lucide-react';
import { JewelryDetail } from '../../types';

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
  totalLaborValue: number;
  stoneCharges: number;
  otherCharges: number;
  subTotalPreTax: number;
  taxRate?: number;
  taxAmount: number;
  finalAmount: number;
  title?: string;
  subtitle?: string;
  isCompact?: boolean;
  showVisualComposition?: boolean;
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
  totalLaborValue,
  stoneCharges,
  otherCharges,
  subTotalPreTax,
  taxRate = 3,
  taxAmount,
  finalAmount,
  title = "Transparent Price Breakdown",
  subtitle = "Official 100% Itemized Component Valuation",
  isCompact = false,
  showVisualComposition = true
}) => {
  // Calculate percentage composition for customer visual bar
  const total = finalAmount || 1;
  const goldPct = Math.min(100, Math.max(0, Math.round((baseMetalValue / total) * 100)));
  const wastagePct = Math.min(100, Math.max(0, Math.round((wastageValue / total) * 100)));
  const makingPct = Math.min(100, Math.max(0, Math.round((totalLaborValue / total) * 100)));
  const stonePct = Math.min(100, Math.max(0, Math.round((stoneCharges / total) * 100)));
  const taxPct = Math.min(100, Math.max(0, Math.round((taxAmount / total) * 100)));

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex justify-between items-start pb-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-700 flex items-center justify-center font-black">
            <ReceiptIndianRupee size={20} />
          </div>
          <div>
            <h3 className="font-serif font-black text-slate-900 text-base">{title}</h3>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>
        </div>

        <div className="text-right">
          <span className="bg-amber-100 text-amber-900 text-[10px] font-black uppercase px-2.5 py-1 rounded-full">
            {purity} • ₹{ratePerGram.toLocaleString('en-IN')}/g
          </span>
        </div>
      </div>

      {/* Visual Composition Bar */}
      {showVisualComposition && finalAmount > 0 && (
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2">
          <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-slate-500">
            <span>Price Composition</span>
            <span className="text-amber-800 font-bold">100% Transparent</span>
          </div>

          {/* Progress bar segments */}
          <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
            <div 
              style={{ width: `${goldPct}%` }} 
              className="bg-amber-500 h-full transition-all" 
              title={`Gold Metal: ${goldPct}%`}
            />
            <div 
              style={{ width: `${wastagePct}%` }} 
              className="bg-amber-600/80 h-full transition-all" 
              title={`Wastage/VA: ${wastagePct}%`}
            />
            <div 
              style={{ width: `${makingPct}%` }} 
              className="bg-indigo-500 h-full transition-all" 
              title={`Making/Labor: ${makingPct}%`}
            />
            {stoneCharges > 0 && (
              <div 
                style={{ width: `${stonePct}%` }} 
                className="bg-emerald-500 h-full transition-all" 
                title={`Stones: ${stonePct}%`}
              />
            )}
            <div 
              style={{ width: `${taxPct}%` }} 
              className="bg-slate-400 h-full transition-all" 
              title={`GST 3%: ${taxPct}%`}
            />
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 text-[10px] text-slate-600 font-bold flex-wrap pt-0.5">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Gold Metal ({goldPct}%)</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-600/80" />
              <span>VA / Wastage ({wastagePct}%)</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
              <span>Labor ({makingPct}%)</span>
            </span>
            {stoneCharges > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Stones ({stonePct}%)</span>
              </span>
            )}
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span>GST ({taxPct}%)</span>
            </span>
          </div>
        </div>
      )}

      {/* Itemized Grid Breakdown */}
      <div className="space-y-2 text-xs">
        {/* 1. Base Metal Row */}
        <div className="p-3 rounded-2xl bg-amber-50/50 border border-amber-200/70 flex justify-between items-center gap-2">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="font-bold text-slate-900">1. Pure Gold Metal Value</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 pl-3.5">
              Net Weight <strong className="text-amber-900">{netWeight}g</strong> (Gross {grossWeight}g {stoneWeight > 0 ? `- Less ${stoneWeight}g stones` : ''}) × ₹{ratePerGram.toLocaleString('en-IN')}/g
            </p>
          </div>
          <span className="font-mono font-black text-sm text-amber-950 shrink-0">
            ₹{baseMetalValue.toLocaleString('en-IN')}
          </span>
        </div>

        {/* 2. Wastage / VA Row */}
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex justify-between items-center gap-2">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-600" />
              <span className="font-bold text-slate-800">2. Wastage / Value Addition (VA)</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 pl-3.5">
              {wastagePercentage}% on gold metal value (unavoidable design loss & purification)
            </p>
          </div>
          <span className="font-mono font-black text-sm text-slate-900 shrink-0">
            ₹{wastageValue.toLocaleString('en-IN')}
          </span>
        </div>

        {/* 3. Making / Craftsmanship Charges */}
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex justify-between items-center gap-2">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
              <span className="font-bold text-slate-800">3. Artisan & Making Charges</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 pl-3.5">
              ₹{makingChargesPerGram}/gram × {netWeight}g net gold craftsmanship
            </p>
          </div>
          <span className="font-mono font-black text-sm text-slate-900 shrink-0">
            ₹{totalLaborValue.toLocaleString('en-IN')}
          </span>
        </div>

        {/* 4. Stone / Diamond Charges (if any) */}
        {stoneCharges > 0 && (
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex justify-between items-center gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="font-bold text-slate-800">4. Stones / Diamonds / Pearls</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 pl-3.5">
                Precious gems & setting valuation
              </p>
            </div>
            <span className="font-mono font-black text-sm text-slate-900 shrink-0">
              ₹{stoneCharges.toLocaleString('en-IN')}
            </span>
          </div>
        )}

        {/* 5. Hallmarking & Certification */}
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex justify-between items-center gap-2">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span className="font-bold text-slate-800">5. BIS Hallmarking & Certification</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 pl-3.5">
              Govt. HUID Laser Inscription & BIS 916 Certification
            </p>
          </div>
          <span className="font-mono font-black text-sm text-slate-900 shrink-0">
            ₹{(otherCharges || 45).toLocaleString('en-IN')}
          </span>
        </div>

        {/* Subtotal Pre-Tax */}
        <div className="p-3 rounded-2xl bg-slate-100/80 border border-slate-200 flex justify-between items-center gap-2">
          <span className="font-bold text-slate-700 pl-3.5">Subtotal (Pre-Tax):</span>
          <span className="font-mono font-bold text-sm text-slate-800">
            ₹{subTotalPreTax.toLocaleString('en-IN')}
          </span>
        </div>

        {/* 6. Statutory GST */}
        <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200 flex justify-between items-center gap-2">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-700" />
              <span className="font-bold text-amber-900">6. Statutory GST ({taxRate}%)</span>
            </div>
            <p className="text-[11px] text-amber-700/80 mt-0.5 pl-3.5">
              CGST ({taxRate / 2}%) + SGST ({taxRate / 2}%) on total taxable value
            </p>
          </div>
          <span className="font-mono font-black text-sm text-amber-900 shrink-0">
            ₹{taxAmount.toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      {/* Final Total Hero Banner */}
      <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 text-white rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <span className="text-[10px] font-black uppercase text-amber-200 tracking-wider block">
            Final All-Inclusive Amount
          </span>
          <span className="text-xs text-amber-100">
            Includes pure gold, crafting, hallmarking & 3% GST
          </span>
        </div>
        <div className="text-left sm:text-right">
          <span className="text-2xl sm:text-3xl font-serif font-black tracking-tight text-white font-mono">
            ₹{finalAmount.toLocaleString('en-IN')}
          </span>
        </div>
      </div>
    </div>
  );
};
