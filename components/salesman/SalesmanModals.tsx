import React from 'react';
import { 
  X, Gem, Coins, Bookmark, Trash2, Edit3, Sparkles, Scale, Check 
} from 'lucide-react';
import { JewelryDetail, OldGoldExchangeItem, SalesmanEstimate } from '../../types';

interface SalesmanModalsProps {
  // Item Modal
  showItemModal: boolean;
  setShowItemModal: (show: boolean) => void;
  editingItemId: string | null;
  itemForm: Partial<JewelryDetail>;
  setItemForm: React.Dispatch<React.SetStateAction<Partial<JewelryDetail>>>;
  onSaveItemForm: () => void;

  // Old Gold Modal
  showOldGoldModal: boolean;
  setShowOldGoldModal: (show: boolean) => void;
  editingOldGoldId: string | null;
  oldGoldForm: Partial<OldGoldExchangeItem>;
  setOldGoldForm: React.Dispatch<React.SetStateAction<Partial<OldGoldExchangeItem>>>;
  onSaveOldGoldForm: () => void;
  getOldGoldBenchmarkRate: (metalType: 'GOLD' | 'SILVER', purity: string, customPurity?: number) => number;

  // Rate Modal
  showRateModal: boolean;
  setShowRateModal: (show: boolean) => void;
  rate22K: number;
  setRate22K: (r: number) => void;
  rate24K: number;
  setRate24K: (r: number) => void;
  rate18K: number;
  setRate18K: (r: number) => void;
  rate14K: number;
  setRate14K: (r: number) => void;
  rateSilver: number;
  setRateSilver: (r: number) => void;
  setIsCustomRate: (isCustom: boolean) => void;
  defaultSettings24K: number;
  defaultSettings22K: number;
  defaultSettings18K: number;
  defaultSettingsSilver: number;

  // Saved Estimates Modal
  showSavedQuotesModal: boolean;
  setShowSavedQuotesModal: (show: boolean) => void;
  savedEstimates: SalesmanEstimate[];
  onLoadEstimate: (est: SalesmanEstimate) => void;
  onDeleteSavedEstimate: (id: string) => void;
}

export const SalesmanModals: React.FC<SalesmanModalsProps> = ({
  showItemModal,
  setShowItemModal,
  editingItemId,
  itemForm,
  setItemForm,
  onSaveItemForm,

  showOldGoldModal,
  setShowOldGoldModal,
  editingOldGoldId,
  oldGoldForm,
  setOldGoldForm,
  onSaveOldGoldForm,
  getOldGoldBenchmarkRate,

  showRateModal,
  setShowRateModal,
  rate22K,
  setRate22K,
  rate24K,
  setRate24K,
  rate18K,
  setRate18K,
  rate14K,
  setRate14K,
  rateSilver,
  setRateSilver,
  setIsCustomRate,
  defaultSettings24K,
  defaultSettings22K,
  defaultSettings18K,
  defaultSettingsSilver,

  showSavedQuotesModal,
  setShowSavedQuotesModal,
  savedEstimates,
  onLoadEstimate,
  onDeleteSavedEstimate,
}) => {
  return (
    <>
      {/* --- MODAL 1: ADD / EDIT JEWELLERY ITEM MODAL --- */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <Gem size={18} className="text-amber-600" />
                <span>{editingItemId ? 'Edit Jewellery Product' : 'Add Jewellery Product'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowItemModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                  Item Title / Description
                </label>
                <input
                  type="text"
                  value={itemForm.customizationDetails || ''}
                  onChange={(e) => setItemForm({ ...itemForm, customizationDetails: e.target.value })}
                  placeholder="e.g. 22K Antique Temple Choker Necklace"
                  className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Category</label>
                  <select
                    value={itemForm.category}
                    onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
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
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Purity & Metal</label>
                  <select
                    value={itemForm.purity}
                    onChange={(e) => setItemForm({ ...itemForm, purity: e.target.value as any })}
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
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Gross Weight (g)</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={itemForm.grossWeight || ''}
                    onChange={(e) => {
                      const g = parseFloat(e.target.value) || 0;
                      setItemForm((prev) => ({
                        ...prev,
                        grossWeight: g,
                        netWeight: prev?.stoneDetails ? prev.netWeight : g,
                      }));
                    }}
                    className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-amber-700 block mb-1">
                    Net Weight (g) *Required
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={itemForm.netWeight || ''}
                    onChange={(e) => setItemForm({ ...itemForm, netWeight: parseFloat(e.target.value) || 0 })}
                    className="w-full text-xs font-black text-amber-900 bg-amber-50/70 border border-amber-300 rounded-xl px-3.5 py-2.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Wastage / VA (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={itemForm.wastagePercentage || ''}
                    onChange={(e) => setItemForm({ ...itemForm, wastagePercentage: parseFloat(e.target.value) || 0 })}
                    className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Making Charges (₹/g)</label>
                  <input
                    type="number"
                    step="10"
                    min="0"
                    value={itemForm.makingChargesPerGram || ''}
                    onChange={(e) => setItemForm({ ...itemForm, makingChargesPerGram: parseFloat(e.target.value) || 0 })}
                    className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Stone Charges (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={itemForm.stoneCharges || ''}
                    onChange={(e) => setItemForm({ ...itemForm, stoneCharges: parseFloat(e.target.value) || 0 })}
                    className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Stone Details</label>
                  <input
                    type="text"
                    value={itemForm.stoneDetails || ''}
                    onChange={(e) => setItemForm({ ...itemForm, stoneDetails: e.target.value })}
                    placeholder="e.g. CZ 1.200g, Ruby"
                    className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex gap-2">
              <button
                type="button"
                onClick={() => setShowItemModal(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onSaveItemForm}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-amber-100">
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <Coins size={18} className="text-amber-600" />
                <span>{editingOldGoldId ? 'Edit Old Gold Exchange Item' : 'Add Old Gold Exchange Item'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowOldGoldModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Item Description</label>
                <input
                  type="text"
                  value={oldGoldForm.description || ''}
                  onChange={(e) => setOldGoldForm({ ...oldGoldForm, description: e.target.value })}
                  placeholder="e.g. Old 22K Broken Chain with Locket"
                  className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Metal Type</label>
                  <select
                    value={oldGoldForm.metalType}
                    onChange={(e) => {
                      const newMetal = e.target.value as 'GOLD' | 'SILVER';
                      const defaultPurity = newMetal === 'SILVER' ? '925' : '22K';
                      const benchmarkRate = getOldGoldBenchmarkRate(newMetal, defaultPurity, oldGoldForm.customPurityPercent);
                      setOldGoldForm({
                        ...oldGoldForm,
                        metalType: newMetal,
                        purity: defaultPurity,
                        ratePerGram: benchmarkRate,
                      });
                    }}
                    className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5"
                  >
                    <option value="GOLD">Gold Exchange</option>
                    <option value="SILVER">Silver Scrap Exchange</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Purity / Karat</label>
                  <select
                    value={oldGoldForm.purity}
                    onChange={(e) => {
                      const newPurity = e.target.value;
                      const benchmarkRate = getOldGoldBenchmarkRate(oldGoldForm.metalType || 'GOLD', newPurity, oldGoldForm.customPurityPercent);
                      setOldGoldForm({
                        ...oldGoldForm,
                        purity: newPurity,
                        ratePerGram: benchmarkRate,
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

              {/* CUSTOM PURITY PERCENT INPUT */}
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
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        const benchmark = getOldGoldBenchmarkRate(oldGoldForm.metalType || 'GOLD', 'CUSTOM', val);
                        setOldGoldForm({
                          ...oldGoldForm,
                          customPurityPercent: val,
                          ratePerGram: benchmark,
                        });
                      }}
                      placeholder="e.g. 88.50"
                      className="w-full text-xs font-black text-amber-900 bg-white border border-amber-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="text-xs font-black text-amber-900">%</span>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(oldGoldForm.metalType === 'SILVER' ? [99.9, 92.5, 80.0, 70.0, 60.0] : [99.9, 91.6, 88.0, 84.5, 75.0, 58.5]).map((pct) => (
                      <button
                        type="button"
                        key={pct}
                        onClick={() => {
                          const benchmark = getOldGoldBenchmarkRate(oldGoldForm.metalType || 'GOLD', 'CUSTOM', pct);
                          setOldGoldForm({
                            ...oldGoldForm,
                            customPurityPercent: pct,
                            ratePerGram: benchmark,
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
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Gross Weight (g)</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={oldGoldForm.grossWeight || ''}
                    onChange={(e) => setOldGoldForm({ ...oldGoldForm, grossWeight: parseFloat(e.target.value) || 0 })}
                    className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Stone/Dirt Deduction (g)</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={oldGoldForm.deductionWeight || ''}
                    onChange={(e) => setOldGoldForm({ ...oldGoldForm, deductionWeight: parseFloat(e.target.value) || 0 })}
                    className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Melting / Testing Loss (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={oldGoldForm.meltingLossPercentage ?? 1}
                    onChange={(e) => setOldGoldForm({ ...oldGoldForm, meltingLossPercentage: parseFloat(e.target.value) || 0 })}
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
                    onChange={(e) => setOldGoldForm({ ...oldGoldForm, ratePerGram: parseFloat(e.target.value) || 0 })}
                    className="w-full text-xs font-black text-amber-900 bg-amber-50 border border-amber-300 rounded-xl px-3.5 py-2.5"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex gap-2">
              <button
                type="button"
                onClick={() => setShowOldGoldModal(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onSaveOldGoldForm}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-2xl max-w-sm w-full space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base">Custom Benchmark Rates</h3>
              <button
                type="button"
                onClick={() => setShowRateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase text-amber-900 block mb-1">
                  Standard 22K (916) Rate (₹/g)
                </label>
                <input
                  type="number"
                  value={rate22K}
                  onChange={(e) => {
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
                  onChange={(e) => {
                    setRateSilver(parseFloat(e.target.value) || 0);
                    setIsCustomRate(true);
                  }}
                  className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsCustomRate(false);
                  setRate24K(defaultSettings24K);
                  setRate22K(defaultSettings22K);
                  setRate18K(defaultSettings18K);
                  setRateSilver(defaultSettingsSilver);
                  setShowRateModal(false);
                }}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
              >
                Reset Live
              </button>
              <button
                type="button"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <Bookmark size={18} className="text-amber-500" />
                <span>Saved Quotations ({savedEstimates.length})</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowSavedQuotesModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            {savedEstimates.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">No saved estimates found in this browser.</p>
            ) : (
              <div className="space-y-2.5">
                {savedEstimates.map((est) => (
                  <div
                    key={est.id}
                    className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex justify-between items-center gap-3"
                  >
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
                        type="button"
                        onClick={() => onLoadEstimate(est)}
                        className="px-3 py-1.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase hover:bg-slate-800 transition-colors"
                      >
                        Load
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteSavedEstimate(est.id)}
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
    </>
  );
};
