import React from 'react';
import { User, Phone, MapPin, Search, RefreshCw, Edit3, TrendingUp, ShieldCheck, Check, Sparkles } from 'lucide-react';
import { Customer } from '../../types';

interface Step1CustomerRatesProps {
  customerName: string;
  setCustomerName: (name: string) => void;
  customerContact: string;
  setCustomerContact: (contact: string) => void;
  customerCity: string;
  setCustomerCity: (city: string) => void;
  customers: Customer[];
  showCustomerSearch: boolean;
  setShowCustomerSearch: (show: boolean) => void;
  rate24K: number;
  rate22K: number;
  rate18K: number;
  rate14K: number;
  rateSilver: number;
  isCustomRate: boolean;
  refreshingRates: boolean;
  onRefreshRates?: () => Promise<void>;
  onOpenRateModal: () => void;
}

export const Step1CustomerRates: React.FC<Step1CustomerRatesProps> = ({
  customerName,
  setCustomerName,
  customerContact,
  setCustomerContact,
  customerCity,
  setCustomerCity,
  customers,
  showCustomerSearch,
  setShowCustomerSearch,
  rate24K,
  rate22K,
  rate18K,
  rate14K,
  rateSilver,
  isCustomRate,
  refreshingRates,
  onRefreshRates,
  onOpenRateModal,
}) => {
  return (
    <div className="space-y-5 animate-fadeIn">
      {/* 1. CUSTOMER PROFILE CARD */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-black">
              <User size={18} />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">Customer Details</h3>
              <p className="text-xs text-slate-500">Provide customer info for personalized quotation</p>
            </div>
          </div>

          {customers.length > 0 && (
            <button
              type="button"
              onClick={() => setShowCustomerSearch(!showCustomerSearch)}
              className="text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <Search size={14} />
              <span>{showCustomerSearch ? 'Hide Search' : 'Select Existing'}</span>
            </button>
          )}
        </div>

        {/* Existing Customers Quick Picker */}
        {showCustomerSearch && customers.length > 0 && (
          <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl space-y-2 animate-fadeIn">
            <span className="text-[10px] font-black uppercase text-slate-500 block">
              Registered Showroom Customers ({customers.length}):
            </span>
            <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
              {customers.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => {
                    setCustomerName(c.name);
                    setCustomerContact(c.phone);
                    if (c.address) setCustomerCity(c.address);
                    setShowCustomerSearch(false);
                  }}
                  className="w-full text-left px-3 py-2 bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-300 rounded-xl text-xs flex justify-between items-center transition-colors"
                >
                  <span className="font-bold text-slate-800">{c.name}</span>
                  <span className="text-slate-500 font-mono text-[11px]">{c.phone}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Mobile keyboard friendly inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 block">
              Customer Full Name
            </label>
            <div className="relative">
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Smt. Priya Sharma"
                className="w-full text-sm font-bold text-slate-900 bg-slate-50 focus:bg-white border border-slate-200 focus:border-amber-500 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-amber-400/20 transition-all outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 block">
              WhatsApp / Mobile No.
            </label>
            <div className="relative">
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={12}
                value={customerContact}
                onChange={(e) => setCustomerContact(e.target.value)}
                placeholder="e.g. 9876543210"
                className="w-full text-sm font-bold text-slate-900 bg-slate-50 focus:bg-white border border-slate-200 focus:border-amber-500 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-amber-400/20 transition-all outline-none font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 block">
              City / Showroom Branch
            </label>
            <div className="relative">
              <input
                type="text"
                value={customerCity}
                onChange={(e) => setCustomerCity(e.target.value)}
                placeholder="e.g. Mumbai / Bandra"
                className="w-full text-sm font-bold text-slate-900 bg-slate-50 focus:bg-white border border-slate-200 focus:border-amber-500 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-amber-400/20 transition-all outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. TODAY'S BENCHMARK RATES CARD */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-md border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-black">
              <TrendingUp size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-white text-base">Today's Benchmark Rates</h3>
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  isCustomRate ? 'bg-amber-500/30 text-amber-300 border border-amber-400/30' : 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/30'
                }`}>
                  {isCustomRate ? 'Custom Override' : 'Live Sync'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Base metal pricing applied across all jewellery & scrap exchange</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onRefreshRates && (
              <button
                type="button"
                onClick={onRefreshRates}
                disabled={refreshingRates}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={13} className={refreshingRates ? 'animate-spin' : ''} />
                <span>Sync Rates</span>
              </button>
            )}
            <button
              type="button"
              onClick={onOpenRateModal}
              className="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Edit3 size={13} />
              <span>Override Rates</span>
            </button>
          </div>
        </div>

        {/* Rate Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3">
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3 text-center">
            <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider block">22K Gold (916)</span>
            <span className="text-lg sm:text-xl font-black text-white block mt-0.5">₹{rate22K.toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-slate-400 block">per gram</span>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3 text-center">
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block">24K Pure Gold</span>
            <span className="text-lg sm:text-xl font-black text-white block mt-0.5">₹{rate24K.toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-slate-400 block">per gram (99.9%)</span>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3 text-center">
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block">18K Gold</span>
            <span className="text-lg sm:text-xl font-black text-white block mt-0.5">₹{rate18K.toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-slate-400 block">Diamond (75.0%)</span>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3 text-center">
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block">14K Gold</span>
            <span className="text-lg sm:text-xl font-black text-white block mt-0.5">₹{rate14K.toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-slate-400 block">58.5% Purity</span>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3 text-center col-span-2 sm:col-span-1">
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block">Silver (999)</span>
            <span className="text-lg sm:text-xl font-black text-white block mt-0.5">₹{rateSilver.toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-slate-400 block">per gram</span>
          </div>
        </div>
      </div>
    </div>
  );
};
