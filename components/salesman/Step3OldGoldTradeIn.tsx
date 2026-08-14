import React from 'react';
import { Coins, Plus, Trash2, Edit2, Scale, CheckCircle2, ShieldCheck, ArrowRight, X } from 'lucide-react';
import { OldGoldExchangeItem } from '../../types';

interface Step3OldGoldTradeInProps {
  enableOldGold: boolean;
  setEnableOldGold: (enable: boolean) => void;
  oldGoldItems: OldGoldExchangeItem[];
  recalculatedOldGoldItems: OldGoldExchangeItem[];
  oldGoldTotals: {
    itemCount: number;
    totalGrossWeight: number;
    totalNetMeltWeight: number;
    totalFineWeight: number;
    totalCredit: number;
  };
  netWeightDifference: number;
  onOpenAddOldGoldModal: () => void;
  onEditOldGoldItem: (item: OldGoldExchangeItem) => void;
  onDeleteOldGoldItem: (id: string) => void;
}

export const Step3OldGoldTradeIn: React.FC<Step3OldGoldTradeInProps> = ({
  enableOldGold,
  setEnableOldGold,
  oldGoldItems,
  recalculatedOldGoldItems,
  oldGoldTotals,
  netWeightDifference,
  onOpenAddOldGoldModal,
  onEditOldGoldItem,
  onDeleteOldGoldItem,
}) => {
  return (
    <div className="space-y-5 animate-fadeIn">
      {/* 1. TRADE-IN CHOICE CARDS */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-700 flex items-center justify-center font-black">
            <Coins size={20} />
          </div>
          <div>
            <h3 className="font-black text-slate-900 text-base">Old Gold / Silver Scrap Trade-in</h3>
            <p className="text-xs text-slate-500">Is the customer exchanging old jewellery against this purchase?</p>
          </div>
        </div>

        {/* 2 Big Choice Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={() => setEnableOldGold(false)}
            className={`p-4 rounded-2xl border-2 text-left flex items-start justify-between transition-all ${
              !enableOldGold
                ? 'border-slate-900 bg-slate-900 text-white shadow-md'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
            }`}
          >
            <div>
              <span className="font-black text-sm block">No Old Gold Trade-in</span>
              <span className={`text-xs block mt-0.5 ${!enableOldGold ? 'text-slate-300' : 'text-slate-500'}`}>
                Straight purchase with direct cash / bank / EMI payment
              </span>
            </div>
            {!enableOldGold && <CheckCircle2 size={20} className="text-amber-400 shrink-0 mt-0.5" />}
          </button>

          <button
            type="button"
            onClick={() => {
              setEnableOldGold(true);
              if (recalculatedOldGoldItems.length === 0) {
                onOpenAddOldGoldModal();
              }
            }}
            className={`p-4 rounded-2xl border-2 text-left flex items-start justify-between transition-all ${
              enableOldGold
                ? 'border-amber-600 bg-amber-50 text-amber-900 shadow-md ring-2 ring-amber-500/20'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-amber-300'
            }`}
          >
            <div>
              <span className="font-black text-sm block">Yes, Include Old Gold Exchange</span>
              <span className="text-xs text-amber-700 block mt-0.5">
                Valuate scrap weight, assayed purity & adjust as down payment credit
              </span>
            </div>
            {enableOldGold && <CheckCircle2 size={20} className="text-amber-700 shrink-0 mt-0.5" />}
          </button>
        </div>
      </div>

      {/* 2. OLD GOLD ITEMS LIST (WHEN ENABLED) */}
      {enableOldGold && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex justify-between items-center bg-amber-100/70 border border-amber-200 px-5 py-3.5 rounded-2xl">
            <div>
              <span className="text-xs font-black uppercase text-amber-950 block">Trade-in Scrap Items</span>
              <span className="text-[11px] text-amber-800">
                {recalculatedOldGoldItems.length} item(s) • Total Credit:{' '}
                <strong className="text-amber-950 font-black">₹{oldGoldTotals.totalCredit.toLocaleString('en-IN')}</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={onOpenAddOldGoldModal}
              className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Plus size={14} />
              <span>Add Scrap Item</span>
            </button>
          </div>

          {recalculatedOldGoldItems.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 border border-dashed border-amber-300 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-amber-100 text-amber-800 flex items-center justify-center">
                <Scale size={24} />
              </div>
              <h4 className="font-bold text-slate-800 text-sm">No Old Gold Items Added Yet</h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Add the customer's scrap gold or silver with gross weight, deductions, and purity test.
              </p>
              <button
                type="button"
                onClick={onOpenAddOldGoldModal}
                className="px-5 py-2.5 bg-amber-700 text-white rounded-xl text-xs font-black uppercase tracking-wider inline-flex items-center gap-2 shadow-sm"
              >
                <Plus size={14} />
                <span>Add Old Gold Item</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {recalculatedOldGoldItems.map((item, idx) => (
                <div
                  key={item.id}
                  className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 hover:border-amber-300 shadow-sm space-y-2.5 transition-all"
                >
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-900 text-[10px] font-black flex items-center justify-center">
                          #{idx + 1}
                        </span>
                        <h4 className="font-black text-slate-900 text-sm">{item.description}</h4>
                        <span className="bg-slate-100 text-slate-800 text-[10px] font-black uppercase px-2 py-0.5 rounded-md">
                          {item.metalType} • {item.purity === 'CUSTOM' ? `${item.customPurityPercent}% Purity` : item.purity}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                        <span>Gross: <strong className="text-slate-800">{item.grossWeight}g</strong></span>
                        <span>Dirt/Stone: <strong className="text-slate-800">-{item.deductionWeight}g</strong></span>
                        <span>Net Melt: <strong className="text-amber-800">{item.netMeltingWeight}g</strong></span>
                        <span>Fine Metal: <strong className="text-slate-800">{item.fineGoldWeight}g</strong></span>
                        <span>Rate: <strong className="text-slate-800">₹{item.ratePerGram}/g</strong></span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-black uppercase text-slate-400 block">Exchange Value</span>
                      <span className="text-base font-black text-emerald-600 block">
                        ₹{item.exchangeValue.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-end items-center gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => onEditOldGoldItem(item)}
                      className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-amber-700 rounded-lg text-xs font-bold flex items-center gap-1"
                    >
                      <Edit2 size={13} />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteOldGoldItem(item.id)}
                      className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg text-xs font-bold flex items-center gap-1"
                    >
                      <Trash2 size={13} />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              ))}

              {/* Old Gold Trade-in Valuation Summary Box */}
              <div className="bg-gradient-to-br from-amber-500 to-amber-700 text-white rounded-3xl p-5 sm:p-6 shadow-lg space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black uppercase tracking-wider text-amber-100">Total Trade-in Valuation Credit</span>
                  <span className="text-2xl font-black text-white">₹{oldGoldTotals.totalCredit.toLocaleString('en-IN')}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-amber-400/40 text-center">
                  <div className="bg-amber-800/30 p-2 rounded-xl">
                    <span className="text-[10px] text-amber-100 block">Total Gross Wt</span>
                    <span className="font-black text-white text-xs">{oldGoldTotals.totalGrossWeight}g</span>
                  </div>
                  <div className="bg-amber-800/30 p-2 rounded-xl">
                    <span className="text-[10px] text-amber-100 block">Net Melt Wt</span>
                    <span className="font-black text-white text-xs">{oldGoldTotals.totalNetMeltWeight}g</span>
                  </div>
                  <div className="bg-amber-800/30 p-2 rounded-xl">
                    <span className="text-[10px] text-amber-100 block">Net Metal Diff</span>
                    <span className="font-black text-white text-xs">
                      {netWeightDifference >= 0 ? `+${netWeightDifference}g` : `${netWeightDifference}g`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
