import React, { useState, useMemo } from 'react';
import { 
  Search, X, Bookmark, Calendar, User, Phone, Gem, Trash2, 
  ArrowUpRight, Share2, Copy, Printer, Check, Filter, Coins,
  Clock, Sparkles, ChevronRight, Eye
} from 'lucide-react';
import { SalesmanEstimate, JewelryDetail } from '../../types';

interface EstimateSearchModalProps {
  show: boolean;
  onClose: () => void;
  savedEstimates: SalesmanEstimate[];
  onLoadEstimate: (est: SalesmanEstimate) => void;
  onDeleteEstimate: (id: string) => void;
  onPrintEstimate?: (est: SalesmanEstimate) => void;
  onShareWhatsApp?: (est: SalesmanEstimate) => void;
}

export const EstimateSearchModal: React.FC<EstimateSearchModalProps> = ({
  show,
  onClose,
  savedEstimates,
  onLoadEstimate,
  onDeleteEstimate,
  onPrintEstimate,
  onShareWhatsApp
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'TODAY' | 'WEEK' | 'OLD_GOLD' | 'HIGH_VALUE' | 'PLAN'>('ALL');
  const [sortBy, setSortBy] = useState<'NEWEST' | 'OLDEST' | 'AMOUNT_DESC' | 'AMOUNT_ASC' | 'NAME_ASC'>('NEWEST');
  const [previewEstimate, setPreviewEstimate] = useState<SalesmanEstimate | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filter & Search Logic
  const filteredEstimates = useMemo(() => {
    let list = [...savedEstimates];
    const query = searchQuery.trim().toLowerCase();

    // 1. Search Query Filter (ID, Name, Contact, Items, Purity, City)
    if (query) {
      list = list.filter(est => {
        const idMatch = est.id.toLowerCase().includes(query) || est.id.replace(/\D/g, '').includes(query);
        const nameMatch = (est.customerName || '').toLowerCase().includes(query);
        const contactMatch = (est.customerContact || '').replace(/\D/g, '').includes(query.replace(/\D/g, '')) || (est.customerContact || '').toLowerCase().includes(query);
        const cityMatch = (est.customerCity || '').toLowerCase().includes(query);
        const itemMatch = (est.items || []).some(i => 
          (i.customizationDetails || '').toLowerCase().includes(query) ||
          (i.category || '').toLowerCase().includes(query) ||
          (i.purity || '').toLowerCase().includes(query)
        );
        const oldGoldMatch = (est.oldGoldItems || []).some(og =>
          (og.description || '').toLowerCase().includes(query) ||
          (og.purity || '').toLowerCase().includes(query)
        );
        return idMatch || nameMatch || contactMatch || cityMatch || itemMatch || oldGoldMatch;
      });
    }

    // 2. Preset Filter Pills
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    if (filterType === 'TODAY') {
      list = list.filter(est => {
        const estDate = new Date(est.date).toISOString().split('T')[0];
        return estDate === todayStr;
      });
    } else if (filterType === 'WEEK') {
      list = list.filter(est => new Date(est.date) >= oneWeekAgo);
    } else if (filterType === 'OLD_GOLD') {
      list = list.filter(est => (est.totalOldGoldCredit || 0) > 0 || (est.oldGoldItems && est.oldGoldItems.length > 0));
    } else if (filterType === 'HIGH_VALUE') {
      list = list.filter(est => (est.netPayableAmount || 0) >= 100000);
    } else if (filterType === 'PLAN') {
      list = list.filter(est => est.paymentPlan && est.paymentPlan.months && est.paymentPlan.months > 1);
    }

    // 3. Sorting
    list.sort((a, b) => {
      if (sortBy === 'NEWEST') {
        return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
      }
      if (sortBy === 'OLDEST') {
        return new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime();
      }
      if (sortBy === 'AMOUNT_DESC') {
        return (b.netPayableAmount || 0) - (a.netPayableAmount || 0);
      }
      if (sortBy === 'AMOUNT_ASC') {
        return (a.netPayableAmount || 0) - (b.netPayableAmount || 0);
      }
      if (sortBy === 'NAME_ASC') {
        return (a.customerName || '').localeCompare(b.customerName || '');
      }
      return 0;
    });

    return list;
  }, [savedEstimates, searchQuery, filterType, sortBy]);

  const handleCopyEstimateDetails = (est: SalesmanEstimate) => {
    const summary = `Quotation ${est.id} for ${est.customerName || 'Client'}: Net Payable ₹${(est.netPayableAmount || 0).toLocaleString('en-IN')} (${est.items?.length || 1} items). 22K Rate: ₹${est.goldRate22K}/g.`;
    navigator.clipboard.writeText(summary);
    setCopiedId(est.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col space-y-4">
        
        {/* Modal Header */}
        <div className="flex justify-between items-center pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-700 flex items-center justify-center font-black">
              <Bookmark size={20} />
            </div>
            <div>
              <h3 className="font-serif font-black text-slate-900 text-base sm:text-lg flex items-center gap-2">
                <span>Search Saved Estimates</span>
                <span className="bg-amber-100 text-amber-900 text-xs font-black px-2.5 py-0.5 rounded-full font-mono">
                  {savedEstimates.length}
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Instant search by Quote #, Customer Name, Phone, or Jewellery Item
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search & Filter Controls */}
        <div className="space-y-2.5 shrink-0">
          {/* Main Search Input */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by quote # (e.g. EST-123456 or 123), customer name, phone, necklace, bangles..."
              className="w-full pl-11 pr-10 py-3 bg-slate-50 focus:bg-white border border-slate-200 focus:border-amber-500 rounded-2xl text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Quick Filter Badges & Sort Selector */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs">
            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setFilterType('ALL')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                  filterType === 'ALL'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All ({savedEstimates.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('TODAY')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                  filterType === 'TODAY'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setFilterType('WEEK')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                  filterType === 'WEEK'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                This Week
              </button>
              <button
                type="button"
                onClick={() => setFilterType('HIGH_VALUE')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                  filterType === 'HIGH_VALUE'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                &gt; ₹1 Lakh
              </button>
              <button
                type="button"
                onClick={() => setFilterType('OLD_GOLD')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                  filterType === 'OLD_GOLD'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                With Old Gold
              </button>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <span className="text-slate-400 text-[11px] font-bold">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-slate-100 border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-700 outline-none"
              >
                <option value="NEWEST">Newest First</option>
                <option value="OLDEST">Oldest First</option>
                <option value="AMOUNT_DESC">Highest Amount</option>
                <option value="AMOUNT_ASC">Lowest Amount</option>
                <option value="NAME_ASC">Customer (A-Z)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results List (Scrollable Area) */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-[220px]">
          {filteredEstimates.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                <Search size={22} />
              </div>
              <h4 className="font-bold text-slate-700 text-sm">No Estimates Found</h4>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                {searchQuery 
                  ? `No quotation matched "${searchQuery}". Try searching by customer mobile or quote number.`
                  : "No estimates have been created or saved yet."}
              </p>
            </div>
          ) : (
            filteredEstimates.map((est) => {
              const itemCount = est.items?.length || 1;
              const hasOldGold = (est.totalOldGoldCredit || 0) > 0;
              const formattedDate = new Date(est.date).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
              });

              return (
                <div
                  key={est.id}
                  className="bg-slate-50 hover:bg-amber-50/40 border border-slate-200 hover:border-amber-300 rounded-2xl p-4 transition-all space-y-3"
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    {/* Customer & Quote Header */}
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-black bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md">
                          {est.id}
                        </span>
                        <h4 className="font-bold text-slate-900 text-sm">
                          {est.customerName || 'Walk-in Client'}
                        </h4>
                        {est.customerContact && (
                          <span className="text-slate-500 font-mono text-xs flex items-center gap-1">
                            <Phone size={11} />
                            <span>{est.customerContact}</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          <span>{formattedDate}</span>
                        </span>
                        <span>•</span>
                        <span>{itemCount} {itemCount === 1 ? 'Item' : 'Items'}</span>
                        <span>•</span>
                        <span>22K: ₹{est.goldRate22K}/g</span>
                        {hasOldGold && (
                          <>
                            <span>•</span>
                            <span className="text-emerald-700 font-bold flex items-center gap-1">
                              <Coins size={11} />
                              <span>-₹{(est.totalOldGoldCredit || 0).toLocaleString('en-IN')} Old Gold</span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Net Payable Price Display */}
                    <div className="text-left sm:text-right shrink-0">
                      <span className="text-[10px] font-black uppercase text-slate-400 block">
                        Net Payable Amount
                      </span>
                      <span className="text-base sm:text-lg font-black text-amber-700 font-mono">
                        ₹{(est.netPayableAmount || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  {/* Items Snippet */}
                  {est.items && est.items.length > 0 && (
                    <div className="bg-white/80 border border-slate-200/80 rounded-xl p-2.5 text-xs text-slate-600 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {est.items.slice(0, 3).map((item, i) => (
                          <span key={i} className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md text-[11px] font-bold text-slate-700">
                            <Gem size={10} className="text-amber-600" />
                            <span>{item.customizationDetails || `${item.purity} ${item.category}`} ({item.netWeight}g)</span>
                          </span>
                        ))}
                        {est.items.length > 3 && (
                          <span className="text-[11px] text-slate-400 font-bold">
                            +{est.items.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Quick Action Buttons */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/70 gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPreviewEstimate(est)}
                        className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors"
                        title="View complete component breakdown"
                      >
                        <Eye size={13} />
                        <span>Breakdown</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopyEstimateDetails(est)}
                        className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors"
                        title="Copy summary"
                      >
                        {copiedId === est.id ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                        <span>{copiedId === est.id ? 'Copied' : 'Copy'}</span>
                      </button>

                      {onPrintEstimate && (
                        <button
                          type="button"
                          onClick={() => onPrintEstimate(est)}
                          className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors"
                          title="Print Customer Slip"
                        >
                          <Printer size={13} />
                          <span>Print Slip</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Delete estimate ${est.id}?`)) {
                            onDeleteEstimate(est.id);
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                        title="Delete estimate"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onLoadEstimate(est);
                        onClose();
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-slate-900 to-slate-800 hover:from-black hover:to-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm active:scale-98 transition-all ml-auto"
                    >
                      <span>Load into Calculator</span>
                      <ArrowUpRight size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info bar */}
        <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500 shrink-0">
          <span>Showing {filteredEstimates.length} of {savedEstimates.length} estimates</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors"
          >
            Close Search
          </button>
        </div>
      </div>

      {/* Nested Preview Drawer / Modal */}
      {previewEstimate && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div>
                <span className="font-mono text-xs font-black bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md">
                  {previewEstimate.id}
                </span>
                <h3 className="font-black text-slate-900 text-base mt-1">
                  {previewEstimate.customerName || 'Walk-in Client'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewEstimate(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-2xl space-y-1.5">
                <div className="flex justify-between text-slate-600">
                  <span>Gross Jewellery Value:</span>
                  <span className="font-bold text-slate-900">₹{(previewEstimate.grossCartAmount || 0).toLocaleString('en-IN')}</span>
                </div>
                {previewEstimate.totalOldGoldCredit > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Old Gold Trade-in Credit:</span>
                    <span className="font-bold">-₹{previewEstimate.totalOldGoldCredit.toLocaleString('en-IN')}</span>
                  </div>
                )}
                {previewEstimate.discountAmount > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Goodwill Discount:</span>
                    <span className="font-bold">-₹{previewEstimate.discountAmount.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-slate-200 flex justify-between font-black text-amber-800 text-sm">
                  <span>Net Payable Amount:</span>
                  <span>₹{(previewEstimate.netPayableAmount || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase text-slate-500 block">
                  Jewellery Ornaments ({previewEstimate.items?.length || 0})
                </span>
                {previewEstimate.items?.map((it, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl border border-slate-200 bg-white space-y-1">
                    <div className="flex justify-between font-bold text-slate-800">
                      <span>{it.customizationDetails || `${it.purity} ${it.category}`}</span>
                      <span className="text-amber-700">₹{it.finalAmount.toLocaleString('en-IN')}</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Net: {it.netWeight}g • VA: {it.wastagePercentage}% • Making: ₹{it.makingChargesPerGram}/g • GST: ₹{it.taxAmount}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex gap-2">
              <button
                type="button"
                onClick={() => setPreviewEstimate(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
              >
                Close Preview
              </button>
              <button
                type="button"
                onClick={() => {
                  onLoadEstimate(previewEstimate);
                  setPreviewEstimate(null);
                  onClose();
                }}
                className="flex-1 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider"
              >
                Load to Calculator
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
