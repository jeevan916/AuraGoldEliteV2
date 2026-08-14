import React from 'react';
import { Sparkles, Plus, Trash2, Edit2, ChevronDown, ChevronUp, Layers, Gem, Scale, Check } from 'lucide-react';
import { JewelryDetail } from '../../types';

interface Step2JewelryCartProps {
  cartItems: JewelryDetail[];
  recalculatedCartItems: JewelryDetail[];
  cartTotals: {
    totalGrossWeight: number;
    totalNetWeight: number;
    totalMetalValue: number;
    totalWastageValue: number;
    totalMakingValue: number;
    totalStoneValue: number;
    totalOtherCharges: number;
    subTotalPreTax: number;
    totalGst: number;
    grossCartTotal: number;
  };
  expandedBifurcationId: string | null;
  setExpandedBifurcationId: (id: string | null) => void;
  onOpenAddItemModal: () => void;
  onEditItem: (item: JewelryDetail) => void;
  onDeleteItem: (id: string) => void;
}

export const Step2JewelryCart: React.FC<Step2JewelryCartProps> = ({
  cartItems,
  recalculatedCartItems,
  cartTotals,
  expandedBifurcationId,
  setExpandedBifurcationId,
  onOpenAddItemModal,
  onEditItem,
  onDeleteItem,
}) => {
  return (
    <div className="space-y-5 animate-fadeIn">
      {/* 1. TOP SUMMARY & ADD PRODUCT BUTTON */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-700 flex items-center justify-center font-black">
            <Sparkles size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-slate-900 text-base">Selected Jewellery Items</h3>
              <span className="bg-amber-100 text-amber-900 text-xs font-black px-2.5 py-0.5 rounded-full">
                {recalculatedCartItems.length} {recalculatedCartItems.length === 1 ? 'Item' : 'Items'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Gross Wt: <span className="font-bold text-slate-800">{cartTotals.totalGrossWeight}g</span> • Net Gold Wt: <span className="font-bold text-amber-700">{cartTotals.totalNetWeight}g</span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenAddItemModal}
          className="w-full sm:w-auto px-5 py-3.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-amber-600/20 active:scale-98 transition-all"
        >
          <Plus size={16} strokeWidth={3} />
          <span>Add Jewellery Product</span>
        </button>
      </div>

      {/* 2. CART ITEMS LIST */}
      {recalculatedCartItems.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 border border-dashed border-slate-300 text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
            <Gem size={26} />
          </div>
          <h4 className="font-black text-slate-800 text-base">Your Estimate Cart is Empty</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Click the button below to add gold or silver ornaments with live rate making charges and wastage calculations.
          </p>
          <button
            type="button"
            onClick={onOpenAddItemModal}
            className="px-6 py-3 bg-amber-600 text-white rounded-2xl text-xs font-black uppercase tracking-wider inline-flex items-center gap-2 shadow-md hover:bg-amber-700 transition-colors"
          >
            <Plus size={16} />
            <span>Add First Jewellery Item</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3.5">
          {recalculatedCartItems.map((item, idx) => {
            const isExpanded = expandedBifurcationId === item.id;
            return (
              <div
                key={item.id}
                className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 hover:border-amber-300 shadow-sm transition-all space-y-3"
              >
                {/* Header Row */}
                <div className="flex justify-between items-start gap-3">
                  <div className="flex items-start gap-3">
                    <span className="w-7 h-7 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-black shrink-0 mt-0.5">
                      #{idx + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-black text-slate-900 text-sm sm:text-base">
                          {item.customizationDetails || `${item.purity} ${item.category}`}
                        </h4>
                        <span className="bg-amber-100 text-amber-900 font-black text-[10px] uppercase px-2 py-0.5 rounded-md">
                          {item.purity} • {item.category}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                        <span>Gross: <strong className="text-slate-800">{item.grossWeight}g</strong></span>
                        <span>Net: <strong className="text-amber-800">{item.netWeight}g</strong></span>
                        {item.stoneCharges ? (
                          <span>Stones: <strong className="text-indigo-700">₹{item.stoneCharges.toLocaleString('en-IN')}</strong></span>
                        ) : null}
                        <span>VA/Making: <strong className="text-slate-800">{item.wastagePercentage}% + ₹{item.makingChargesPerGram}/g</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-black uppercase text-slate-400 block">Item Total (incl. GST)</span>
                    <span className="text-base sm:text-lg font-black text-amber-700 block">
                      ₹{item.finalAmount.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Expanded Cost Breakdown */}
                {isExpanded && (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs space-y-2 animate-fadeIn">
                    <span className="text-[10px] font-black uppercase text-slate-500 block">
                      Official Cost Bifurcation Breakdown:
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-500 block">Base Metal Value</span>
                        <span className="font-black text-slate-800">₹{item.baseMetalValue.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-500 block">Wastage / VA ({item.wastagePercentage}%)</span>
                        <span className="font-black text-slate-800">₹{item.wastageValue.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-500 block">Making Charges (₹{item.makingChargesPerGram}/g)</span>
                        <span className="font-black text-slate-800">₹{item.totalLaborValue.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-500 block">Stones / Diamonds</span>
                        <span className="font-black text-slate-800">₹{(item.stoneCharges || 0).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-500 block">Hallmark & Other Charges</span>
                        <span className="font-black text-slate-800">₹{(item.otherCharges || 45).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                        <span className="text-[10px] text-amber-700 block font-bold">GST (3%)</span>
                        <span className="font-black text-amber-900">₹{item.taxAmount.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Card Actions Footer */}
                <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setExpandedBifurcationId(isExpanded ? null : item.id)}
                    className="text-[11px] font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 transition-colors"
                  >
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    <span>{isExpanded ? 'Hide Bifurcation' : 'View Price Breakdown'}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onEditItem(item)}
                      className="p-2 hover:bg-slate-100 text-slate-600 hover:text-amber-700 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors"
                    >
                      <Edit2 size={13} />
                      <span className="hidden sm:inline">Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteItem(item.id)}
                      className="p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors"
                    >
                      <Trash2 size={13} />
                      <span className="hidden sm:inline">Remove</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. CART GRAND TOTAL STRIP */}
      {recalculatedCartItems.length > 0 && (
        <div className="bg-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-md border border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-center sm:text-left">
            <span className="text-[11px] font-black uppercase text-amber-400 tracking-wider block">Gross Jewellery Cart Total</span>
            <p className="text-xs text-slate-400 mt-0.5">
              Includes pre-tax value ₹{cartTotals.subTotalPreTax.toLocaleString('en-IN')} + 3% GST ₹{cartTotals.totalGst.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="text-center sm:text-right">
            <span className="text-2xl sm:text-3xl font-black text-amber-300">
              ₹{cartTotals.grossCartTotal.toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
