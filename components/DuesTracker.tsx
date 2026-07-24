import React, { useState, useMemo } from 'react';
import { 
  Search, Filter, Calendar, ChevronRight, X, RefreshCw, 
  TrendingUp, IndianRupee, AlertTriangle, Clock, ArrowUpDown, 
  Download, HelpCircle
} from 'lucide-react';
import { Order, OrderStatus } from '../types';

interface DuesTrackerProps {
  orders: Order[];
  onViewOrder: (id: string) => void;
}

type SortField = 'date' | 'amount' | 'amountDue' | 'unpaidDays';
type SortOrder = 'asc' | 'desc';

export const DuesTracker: React.FC<DuesTrackerProps> = ({ orders, onViewOrder }) => {
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [minDuesAmount, setMinDuesAmount] = useState<number | ''>('');
  const [minUnpaidDays, setMinUnpaidDays] = useState<number | ''>('');
  
  const [sortField, setSortField] = useState<SortField>('unpaidDays');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const today = useMemo(() => new Date(), []);

  // Compute calculated dues data for each order that has unpaid amount
  const ordersWithDues = useMemo(() => {
    return orders
      .filter(order => order.status !== OrderStatus.CANCELLED)
      .map(order => {
        const totalAmount = order.totalAmount || 0;
        const totalPaid = order.payments ? order.payments.reduce((sum, p) => sum + p.amount, 0) : 0;
        const amountDue = Math.max(0, totalAmount - totalPaid);

        // Find last payment date, or fallback to order creation date
        let lastPaymentDate = new Date(order.createdAt);
        if (order.payments && order.payments.length > 0) {
          const paymentDates = order.payments.map(p => new Date(p.date).getTime());
          const maxDate = Math.max(...paymentDates);
          lastPaymentDate = new Date(maxDate);
        }

        // Calculate unpaid days from last payment or creation
        const diffTime = Math.abs(today.getTime() - lastPaymentDate.getTime());
        const unpaidDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        return {
          order,
          totalAmount,
          totalPaid,
          amountDue,
          lastPaymentDate,
          unpaidDays,
        };
      })
      .filter(item => item.amountDue > 0); // Only track active dues
  }, [orders, today]);

  // Apply search, filters, and sort
  const filteredAndSortedDues = useMemo(() => {
    return ordersWithDues
      .filter(item => {
        // Search filter (customer name or order ID)
        if (search) {
          const q = search.toLowerCase();
          const matchesName = item.order.customerName.toLowerCase().includes(q);
          const matchesId = item.order.id.toLowerCase().includes(q);
          if (!matchesName && !matchesId) return false;
        }

        // Date range filter (Order Creation / Booking Date)
        if (dateRange.start) {
          const bookingDateStr = item.order.createdAt.substring(0, 10);
          if (bookingDateStr < dateRange.start) return false;
        }
        if (dateRange.end) {
          const bookingDateStr = item.order.createdAt.substring(0, 10);
          if (bookingDateStr > dateRange.end) return false;
        }

        // Minimum amount due filter
        if (minDuesAmount !== '') {
          if (item.amountDue < minDuesAmount) return false;
        }

        // Minimum unpaid days filter
        if (minUnpaidDays !== '') {
          if (item.unpaidDays < minUnpaidDays) return false;
        }

        return true;
      })
      .sort((a, b) => {
        let comparison = 0;
        if (sortField === 'date') {
          comparison = new Date(a.order.createdAt).getTime() - new Date(b.order.createdAt).getTime();
        } else if (sortField === 'amount') {
          comparison = a.totalAmount - b.totalAmount;
        } else if (sortField === 'amountDue') {
          comparison = a.amountDue - b.amountDue;
        } else if (sortField === 'unpaidDays') {
          comparison = a.unpaidDays - b.unpaidDays;
        }

        return sortOrder === 'asc' ? comparison : -comparison;
      });
  }, [ordersWithDues, search, dateRange, minDuesAmount, minUnpaidDays, sortField, sortOrder]);

  // Calculate totals of filtered list
  const totals = useMemo(() => {
    return filteredAndSortedDues.reduce(
      (acc, item) => {
        acc.totalValue += item.totalAmount;
        acc.totalPaid += item.totalPaid;
        acc.totalDue += item.amountDue;
        acc.avgUnpaidDays += item.unpaidDays;
        return acc;
      },
      { totalValue: 0, totalPaid: 0, totalDue: 0, avgUnpaidDays: 0 }
    );
  }, [filteredAndSortedDues]);

  const avgUnpaidDaysValue = useMemo(() => {
    if (filteredAndSortedDues.length === 0) return 0;
    return Math.round(totals.avgUnpaidDays / filteredAndSortedDues.length);
  }, [filteredAndSortedDues, totals]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const clearFilters = () => {
    setSearch('');
    setDateRange({ start: '', end: '' });
    setMinDuesAmount('');
    setMinUnpaidDays('');
  };

  const hasFilters = search || dateRange.start || dateRange.end || minDuesAmount !== '' || minUnpaidDays !== '';

  return (
    <div className="space-y-6 animate-fadeIn pb-24" id="dues-tracker-root">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4" id="dues-tracker-header">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <TrendingUp className="text-rose-600" /> Admin Dues Dashboard
          </h2>
          <p className="text-sm text-slate-500 font-medium">Detailed list-wise tracking of order dues, aging analytics, and unpaid aging cycles.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-rose-50 border border-rose-100 text-rose-700 text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-xl">
            Admin Only
          </span>
        </div>
      </div>

      {/* Totals Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="dues-summary-cards">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-slate-600 shrink-0">
            <IndianRupee size={20} />
          </div>
          <div>
            <p className="text-[10px] uppercase font-black tracking-wider text-slate-400">Total Booked Value</p>
            <p className="text-xl font-black text-slate-800">₹{Math.round(totals.totalValue).toLocaleString('en-IN')}</p>
            <p className="text-[10px] text-slate-400 font-bold">From filtered accounts</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
            <TrendingUp size={20} />
          </div>
          <div>
            <p className="text-[10px] uppercase font-black tracking-wider text-slate-400">Total Collected</p>
            <p className="text-xl font-black text-emerald-600">₹{Math.round(totals.totalPaid).toLocaleString('en-IN')}</p>
            <p className="text-[10px] text-emerald-500 font-bold">
              {totals.totalValue > 0 ? `${Math.round((totals.totalPaid / totals.totalValue) * 100)}% Collection Rate` : '0%'}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div>
            <p className="text-[10px] uppercase font-black tracking-wider text-slate-400">Total Outstanding</p>
            <p className="text-xl font-black text-rose-600">₹{Math.round(totals.totalDue).toLocaleString('en-IN')}</p>
            <p className="text-[10px] text-rose-500 font-bold">
              {filteredAndSortedDues.length} pending orders
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-[10px] uppercase font-black tracking-wider text-slate-400">Avg. Aging Cycle</p>
            <p className="text-xl font-black text-slate-800">{avgUnpaidDaysValue} Days</p>
            <p className="text-[10px] text-slate-400 font-bold">Since last transaction</p>
          </div>
        </div>
      </div>

      {/* Main Filter Panel */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden" id="dues-filters-container">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col xl:flex-row gap-4 items-stretch xl:items-center">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search customer name or order ID..."
              className="w-full pl-12 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none font-medium text-sm transition-all"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Quick Date Range */}
          <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200 p-1.5 rounded-xl">
            <div className="flex items-center gap-1.5 px-2 border-r border-slate-100 shrink-0">
              <Calendar size={14} className="text-slate-400" />
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Booking Date</span>
            </div>
            <input 
              type="date" 
              className="bg-transparent text-xs font-bold text-slate-600 outline-none p-1"
              value={dateRange.start}
              onChange={e => setDateRange({...dateRange, start: e.target.value})}
            />
            <span className="text-slate-300">-</span>
            <input 
              type="date" 
              className="bg-transparent text-xs font-bold text-slate-600 outline-none p-1"
              value={dateRange.end}
              onChange={e => setDateRange({...dateRange, end: e.target.value})}
            />
          </div>

          {/* Amount and Aging Limits */}
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-xl flex-1 sm:w-44">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Min Dues</span>
              <input 
                type="number" 
                placeholder="₹ Amount"
                className="bg-transparent text-xs font-bold text-slate-700 outline-none w-full text-right"
                value={minDuesAmount}
                onChange={e => setMinDuesAmount(e.target.value ? Number(e.target.value) : '')}
              />
            </div>

            <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-xl flex-1 sm:w-44">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Min Aging</span>
              <input 
                type="number" 
                placeholder="Days"
                className="bg-transparent text-xs font-bold text-slate-700 outline-none w-full text-right"
                value={minUnpaidDays}
                onChange={e => setMinUnpaidDays(e.target.value ? Number(e.target.value) : '')}
              />
            </div>
          </div>

          {/* Clear Button */}
          {hasFilters && (
            <button 
              onClick={clearFilters}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 rounded-xl text-xs font-black uppercase tracking-wider transition-colors shrink-0"
            >
              <X size={14} /> Clear
            </button>
          )}
        </div>

        {/* Data List Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-[10px] font-black uppercase text-slate-400 tracking-[0.1em] border-b border-slate-100">
                <th className="px-6 py-4">Customer Details</th>
                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100/50 transition-colors" onClick={() => toggleSort('date')}>
                  <div className="flex items-center gap-1">
                    Booking Date
                    <ArrowUpDown size={12} className={sortField === 'date' ? 'text-amber-500' : 'text-slate-300'} />
                  </div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100/50 transition-colors" onClick={() => toggleSort('amount')}>
                  <div className="flex items-center gap-1">
                    Order Value
                    <ArrowUpDown size={12} className={sortField === 'amount' ? 'text-amber-500' : 'text-slate-300'} />
                  </div>
                </th>
                <th className="px-6 py-4">Collected</th>
                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100/50 transition-colors" onClick={() => toggleSort('amountDue')}>
                  <div className="flex items-center gap-1">
                    Amount Due
                    <ArrowUpDown size={12} className={sortField === 'amountDue' ? 'text-amber-500' : 'text-slate-300'} />
                  </div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100/50 transition-colors" onClick={() => toggleSort('unpaidDays')}>
                  <div className="flex items-center gap-1">
                    Unpaid Days Aging
                    <ArrowUpDown size={12} className={sortField === 'unpaidDays' ? 'text-amber-500' : 'text-slate-300'} />
                  </div>
                </th>
                <th className="px-6 py-4 text-right">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAndSortedDues.map((item, index) => {
                // Determine styling based on severity of delay
                let delayBadgeColor = 'bg-slate-50 text-slate-600 border-slate-100';
                if (item.unpaidDays > 30) {
                  delayBadgeColor = 'bg-rose-50 text-rose-700 border-rose-100 animate-pulse';
                } else if (item.unpaidDays > 14) {
                  delayBadgeColor = 'bg-amber-50 text-amber-700 border-amber-100';
                } else if (item.unpaidDays > 7) {
                  delayBadgeColor = 'bg-blue-50 text-blue-700 border-blue-100';
                }

                return (
                  <tr key={item.order.id} className="hover:bg-slate-50/50 transition-all group">
                    <td className="px-6 py-5">
                      <div>
                        <p className="font-bold text-slate-800 leading-none mb-1.5">{item.order.customerName}</p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                          <span>{item.order.id}</span>
                          <span>•</span>
                          <span className="font-sans font-bold">{item.order.customerContact}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-xs font-bold text-slate-600">
                        {new Date(item.order.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                      </span>
                    </td>
                    <td className="px-6 py-5 font-bold text-slate-800 text-sm">
                      ₹{Math.round(item.totalAmount).toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-emerald-600">
                          ₹{Math.round(item.totalPaid).toLocaleString('en-IN')}
                        </span>
                        <span className="text-[9px] text-slate-400 font-bold">
                          {item.totalAmount > 0 ? `${Math.round((item.totalPaid / item.totalAmount) * 100)}%` : '0%'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-sm font-black text-rose-600">
                        ₹{Math.round(item.amountDue).toLocaleString('en-IN')}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${delayBadgeColor}`}>
                          {item.unpaidDays === 0 ? 'Active Today' : `${item.unpaidDays} Days Delay`}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <button 
                        onClick={() => onViewOrder(item.order.id)}
                        className="p-1.5 bg-white border border-slate-200 text-slate-400 rounded-xl hover:text-amber-600 hover:border-amber-200 hover:shadow-sm transition-all"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredAndSortedDues.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-24 text-center">
                    <div className="max-w-xs mx-auto space-y-3 opacity-60">
                      <AlertTriangle className="w-12 h-12 text-slate-400 mx-auto" />
                      <p className="font-bold text-slate-500 uppercase tracking-widest text-xs">
                        No outstanding dues found
                      </p>
                      {hasFilters && (
                        <button 
                          onClick={clearFilters}
                          className="text-[10px] font-black text-rose-500 hover:text-rose-700 flex items-center gap-1 mx-auto uppercase"
                        >
                          <RefreshCw size={10} /> Reset filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
