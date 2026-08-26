import React from 'react';
import { Sparkles, Printer, X, ShieldCheck, Gem, Phone, MapPin, Calendar, ReceiptIndianRupee } from 'lucide-react';
import { SalesmanEstimate, JewelryDetail, GlobalSettings } from '../../types';

interface QuotationPrintSlipProps {
  show: boolean;
  onClose: () => void;
  estimate: SalesmanEstimate | null;
  settings?: GlobalSettings;
}

export const QuotationPrintSlip: React.FC<QuotationPrintSlipProps> = ({
  show,
  onClose,
  estimate,
  settings
}) => {
  if (!show || !estimate) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = new Date(estimate.date || Date.now()).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col my-auto">
        
        {/* Top Floating Action Bar (Hidden when printed) */}
        <div className="p-4 bg-slate-900 text-white rounded-t-3xl flex justify-between items-center print:hidden">
          <div className="flex items-center gap-2">
            <ReceiptIndianRupee size={18} className="text-amber-400" />
            <span className="text-xs font-black uppercase tracking-wider">Customer Quotation Slip</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Printer size={14} />
              <span>Print Quotation</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-xl"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Printable Certificate Document Area */}
        <div className="p-6 sm:p-8 space-y-6 overflow-y-auto text-slate-900 bg-white" id="printable-quotation-slip">
          {/* Jeweller Header */}
          <div className="flex justify-between items-start border-b-2 border-amber-500/30 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center font-serif font-black text-base">
                  A
                </div>
                <h2 className="font-serif font-black text-xl text-slate-900 tracking-tight">
                  AURAGOLD ELITE JEWELLERS
                </h2>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Govt. Certified BIS 916 Hallmark Jewellery Showroom
              </p>
              <p className="text-[10px] text-slate-400">
                GSTIN: 27AABCU9603R1ZM • Standard BIS HUID Hallmarking
              </p>
            </div>

            <div className="text-right">
              <span className="bg-amber-100 text-amber-900 text-xs font-black px-3 py-1 rounded-full font-mono">
                {estimate.id}
              </span>
              <p className="text-[11px] text-slate-500 mt-1.5">{formattedDate}</p>
            </div>
          </div>

          {/* Customer & Benchmark Strip */}
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
            <div>
              <span className="text-[10px] font-black uppercase text-slate-400 block">Customer Information</span>
              <h4 className="font-black text-slate-900 text-sm mt-0.5">
                {estimate.customerName || 'Walk-in Valued Client'}
              </h4>
              {estimate.customerContact && (
                <p className="text-slate-600 font-mono mt-0.5">Phone: {estimate.customerContact}</p>
              )}
              {estimate.customerCity && (
                <p className="text-slate-500 mt-0.5">{estimate.customerCity}</p>
              )}
            </div>

            <div className="text-right">
              <span className="text-[10px] font-black uppercase text-slate-400 block">Today's Benchmark Rates</span>
              <p className="text-slate-800 font-bold mt-0.5">
                22K Gold (916): <strong className="font-mono text-amber-800">₹{estimate.goldRate22K}/g</strong>
              </p>
              <p className="text-slate-600 text-[11px]">
                24K Pure: <span className="font-mono">₹{estimate.goldRate24K}/g</span> • 18K: <span className="font-mono">₹{estimate.goldRate18K}/g</span>
              </p>
            </div>
          </div>

          {/* Itemized Table */}
          <div className="space-y-2">
            <span className="text-xs font-black uppercase tracking-wider text-slate-700 block">
              Itemized Jewellery Valuation Breakdown
            </span>
            <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-slate-700 font-black text-[11px] uppercase border-b border-slate-200">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">Item Description</th>
                    <th className="p-3">Gross / Net Wt</th>
                    <th className="p-3">VA / Making</th>
                    <th className="p-3 text-right">Taxable</th>
                    <th className="p-3 text-right">Total (3% GST)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {estimate.items?.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                      <td className="p-3">
                        <span className="font-bold text-slate-900 block">
                          {item.customizationDetails || `${item.purity} ${item.category}`}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {item.purity} Gold • Hallmark Inscribed
                        </span>
                      </td>
                      <td className="p-3 font-mono">
                        <span className="font-bold text-amber-900">{item.netWeight}g Net</span>
                        <span className="text-[10px] text-slate-400 block">{item.grossWeight}g Gross</span>
                      </td>
                      <td className="p-3 text-[11px] text-slate-600">
                        <span>{item.wastagePercentage}% VA</span>
                        <span className="text-[10px] text-slate-400 block">₹{item.makingChargesPerGram}/g</span>
                      </td>
                      <td className="p-3 text-right font-mono text-slate-800">
                        ₹{(item.finalAmount - (item.taxAmount || 0)).toLocaleString('en-IN')}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-amber-900">
                        ₹{item.finalAmount.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Old Gold Trade-in & Financials */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Gross Jewellery Value (incl. GST):</span>
              <span className="font-bold font-mono text-slate-900">₹{(estimate.grossCartAmount || 0).toLocaleString('en-IN')}</span>
            </div>

            {estimate.totalOldGoldCredit > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Less: Old Gold Scrap Trade-in:</span>
                <span className="font-bold font-mono">-₹{estimate.totalOldGoldCredit.toLocaleString('en-IN')}</span>
              </div>
            )}

            {estimate.discountAmount > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>Less: Showroom Goodwill Discount:</span>
                <span className="font-bold font-mono">-₹{estimate.discountAmount.toLocaleString('en-IN')}</span>
              </div>
            )}

            <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm font-black text-amber-950">
              <span>Net Customer Payable Amount:</span>
              <span className="text-base sm:text-lg font-mono">
                ₹{(estimate.netPayableAmount || 0).toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Footer Terms & Guarantee */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-[10px] text-slate-500">
            <div>
              <p className="font-bold text-slate-700">Terms & Conditions:</p>
              <p>• Gold rates are indicative and locked upon formal order booking / advance payment.</p>
              <p>• 100% Guaranteed BIS Hallmarked purity with lifetime buyback guarantee.</p>
            </div>
            <div className="text-right shrink-0">
              <span className="font-bold text-slate-700 block">Authorized Signature</span>
              <div className="h-8 border-b border-slate-300 w-32 mt-1"></div>
              <span className="text-[9px] text-slate-400 mt-0.5 block">{estimate.salesmanName || 'Showroom Executive'}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
