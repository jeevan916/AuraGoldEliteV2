
import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, Globe, BarChart2, ExternalLink, ArrowRight, DollarSign, 
  Newspaper, Loader2, RefreshCw, Scale, ShieldAlert, ArrowUpRight, ArrowDownRight,
  Calculator, History, Clock, Zap
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Order, OrderStatus, GlobalSettings } from '../types';

interface MarketIntelligenceProps {
  orders: Order[];
  settings: GlobalSettings;
}

type Timeframe = 'TODAY' | '3D' | '5D' | '1W' | '15D' | '1M';

const MarketIntelligence: React.FC<MarketIntelligenceProps> = ({ orders, settings }) => {
  const [timeframe, setTimeframe] = useState<Timeframe>('1W');
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistory = async () => {
    setRefreshing(true);
    try {
        const res = await fetch('/api/rates/history');
        const data = await res.json();
        if (data.success) {
            // Re-order to chronological for Recharts
            setHistory(data.data.reverse());
        }
    } catch (e) {
        console.error("Failed to load rate history", e);
    } finally {
        setLoading(false);
        setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // --- CHART LOGIC ---
  const chartData = useMemo(() => {
      if (!history.length) return [];
      const now = new Date();
      let cutoff = new Date();

      switch(timeframe) {
          case 'TODAY': cutoff.setHours(0,0,0,0); break;
          case '3D': cutoff.setDate(now.getDate() - 3); break;
          case '5D': cutoff.setDate(now.getDate() - 5); break;
          case '1W': cutoff.setDate(now.getDate() - 7); break;
          case '15D': cutoff.setDate(now.getDate() - 15); break;
          case '1M': cutoff.setDate(now.getDate() - 30); break;
      }

      return history.filter(h => new Date(h.recorded_at) >= cutoff).map(h => ({
          time: timeframe === 'TODAY' 
            ? new Date(h.recorded_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
            : new Date(h.recorded_at).toLocaleDateString([], {day: 'numeric', month: 'short'}),
          rate: parseFloat(h.rate22k),
          fullDate: new Date(h.recorded_at).toLocaleString()
      }));
  }, [history, timeframe]);

  const stats = useMemo(() => {
      if (chartData.length < 2) return { change: 0, pct: 0 };
      const start = chartData[0].rate;
      const end = chartData[chartData.length - 1].rate;
      const change = end - start;
      const pct = (change / start) * 100;
      return { change, pct };
  }, [chartData]);

  // --- ONGOING ORDERS ANALYSIS ---
  const activeAnalytics = useMemo(() => {
      const activeOrders = orders.filter(o => o.status !== OrderStatus.DELIVERED && o.status !== OrderStatus.CANCELLED);
      
      let totalGoldWeight = 0;
      let totalBookedMetalValue = 0;
      let totalUnpaidBalance = 0;

      activeOrders.forEach(o => {
          const weight = o.items.reduce((acc, i) => acc + i.netWeight, 0);
          totalGoldWeight += weight;
          
          const paid = o.payments.reduce((acc, p) => acc + p.amount, 0);
          const balance = o.totalAmount - paid;
          totalUnpaidBalance += balance;

          // Estimate the portion of gold weight that is "unpaid"
          // Formula: (Unpaid Balance / Total Order Value) * Total Order Gold Weight
          // Note: Using 22K normalized booking rates for simplicity
          totalBookedMetalValue += weight * o.goldRateAtBooking;
      });

      const avgBookingRate = totalGoldWeight > 0 ? (totalBookedMetalValue / totalGoldWeight) : settings.currentGoldRate22K;
      
      // Calculate exposure:
      // Weight of gold equivalent to the unpaid amount at their BOOKED rates
      const unpaidGoldWeight = totalGoldWeight > 0 ? (totalUnpaidBalance / (totalBookedMetalValue / totalGoldWeight)) : 0;
      const currentCostOfUnpaidGold = totalUnpaidBalance > 0 ? (totalUnpaidBalance / avgBookingRate) * settings.currentGoldRate22K : 0;
      const exposurePL = totalUnpaidBalance - currentCostOfUnpaidGold;

      return {
          totalGoldWeight,
          avgBookingRate,
          totalUnpaidBalance,
          currentCostOfUnpaidGold,
          exposurePL,
          activeOrderCount: activeOrders.length
      };
  }, [orders, settings]);

  if (loading) {
      return (
          <div className="h-full flex flex-col items-center justify-center space-y-4 py-20">
              <Loader2 className="animate-spin text-amber-500" size={48} />
              <p className="text-slate-400 font-black uppercase tracking-widest text-sm">Synchronizing Market Data...</p>
          </div>
      );
  }

  return (
    <div className="space-y-8 animate-fadeIn pb-32">
      
      {/* 1. TOP FINANCIAL STRIP */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-slate-200 pb-6">
        <div>
           <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3">
             <Globe className="text-blue-500" /> Market Intelligence
           </h2>
           <p className="text-sm text-slate-500 font-medium">Internal Analytics & Bullion Volatility Monitor</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-2xl w-full md:w-auto overflow-x-auto shadow-inner">
            {(['TODAY', '3D', '5D', '1W', '15D', '1M'] as Timeframe[]).map(t => (
                <button 
                    key={t} onClick={() => setTimeframe(t)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${timeframe === t ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    {t}
                </button>
            ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* 2. GRANULAR CHART (COL-SPAN 8) */}
          <div className="lg:col-span-8 space-y-6">
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl relative overflow-hidden">
                  <div className="flex justify-between items-start mb-8 relative z-10">
                      <div>
                          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Standard 22K (Live History)</p>
                          <div className="flex items-center gap-4">
                              <h3 className="text-4xl font-black text-slate-900">₹{settings.currentGoldRate22K.toLocaleString()}</h3>
                              <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black ${stats.change >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                  {stats.change >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                  {Math.abs(stats.change).toFixed(2)} ({Math.abs(stats.pct).toFixed(2)}%)
                              </div>
                          </div>
                      </div>
                      <button onClick={fetchHistory} disabled={refreshing} className="p-3 bg-slate-50 rounded-2xl text-slate-400 hover:text-amber-500 transition-all active:rotate-180">
                         <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
                      </button>
                  </div>

                  <div className="h-80 w-full relative z-10">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis 
                                dataKey="time" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{fontSize: 9, fontWeight: 'bold', fill: '#94a3b8'}} 
                                minTickGap={30}
                            />
                            <YAxis 
                                domain={['dataMin - 100', 'dataMax + 100']} 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{fontSize: 9, fontWeight: 'bold', fill: '#94a3b8'}}
                                orientation="right"
                            />
                            <Tooltip 
                                contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', padding: '15px'}}
                                labelStyle={{fontWeight: 'black', color: '#1e293b', marginBottom: '5px', fontSize: '10px', textTransform: 'uppercase'}}
                                itemStyle={{fontSize: '14px', fontWeight: 'bold', color: '#f59e0b'}}
                            />
                            <Area 
                                type="monotone" 
                                dataKey="rate" 
                                stroke="#f59e0b" 
                                strokeWidth={4}
                                fillOpacity={1} 
                                fill="url(#colorRate)" 
                                animationDuration={1500}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                  </div>
              </div>

              {/* NEWS LINKS RE-STYLIZED */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <MarketLink url="https://www.moneycontrol.com/commodity/gold-price.html" title="MCX Futures" desc="Real-time Indian commodity exchange data." />
                  <MarketLink url="https://ibjarates.com/" title="IBJA Official" desc="Official benchmark for Indian Jewelers." />
              </div>
          </div>

          {/* 3. BOOKING EXPOSURE (COL-SPAN 4) */}
          <div className="lg:col-span-4 space-y-6">
              <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden border border-slate-800">
                  <div className="relative z-10 space-y-8">
                      <div className="flex items-center gap-3">
                          <div className="p-3 bg-amber-500/20 text-amber-500 rounded-2xl"><Zap size={24} /></div>
                          <div>
                              <h4 className="font-black text-lg">Active Exposure</h4>
                              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-[0.2em]">Risk Analysis</p>
                          </div>
                      </div>

                      <div className="space-y-6">
                          <ExposureStat 
                            label="Total Booked Gold" 
                            value={`${activeAnalytics.totalGoldWeight.toFixed(3)} g`} 
                            sub={`Across ${activeAnalytics.activeOrderCount} ongoing orders`}
                          />
                          <ExposureStat 
                            label="Avg. Booking Rate" 
                            value={`₹${Math.round(activeAnalytics.avgBookingRate).toLocaleString()}`} 
                            sub="Contractual standard"
                          />
                          <ExposureStat 
                            label="Unpaid Balance Cost" 
                            value={`₹${Math.round(activeAnalytics.currentCostOfUnpaidGold).toLocaleString()}`} 
                            sub={`Replacement value at ₹${settings.currentGoldRate22K}/g`}
                          />
                      </div>

                      <div className={`p-6 rounded-3xl border ${activeAnalytics.exposurePL >= 0 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
                          <div className="flex justify-between items-center">
                              <div>
                                  <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Estimated P/L</p>
                                  <p className="text-2xl font-black">₹{Math.round(activeAnalytics.exposurePL).toLocaleString()}</p>
                              </div>
                              {activeAnalytics.exposurePL >= 0 ? <TrendingUp size={32} /> : <ArrowDownRight size={32} />}
                          </div>
                          <p className="text-[9px] font-bold mt-2 opacity-80 leading-relaxed italic">
                              {activeAnalytics.exposurePL >= 0 
                                ? "*Market drop: Jeweler saves on replacement cost for unpaid balances." 
                                : "*Market rise: Future replacement cost is higher than contractual balance."}
                          </p>
                      </div>
                  </div>
                  <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-[100px]"></div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-start gap-4">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><Calculator size={20} /></div>
                  <div>
                      <h4 className="font-bold text-slate-800 text-sm">Hedge Recommendation</h4>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                          Based on {activeAnalytics.totalGoldWeight.toFixed(1)}g total exposure, we recommend maintaining a 20% liquid bullion reserve.
                      </p>
                  </div>
              </div>
          </div>

      </div>
    </div>
  );
};

const ExposureStat = ({ label, value, sub }: any) => (
    <div>
        <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">{label}</p>
        <p className="text-xl font-black text-white">{value}</p>
        <p className="text-[10px] font-medium text-slate-400">{sub}</p>
    </div>
);

const MarketLink = ({ url, title, desc }: any) => (
    <a 
        href={url} target="_blank" rel="noreferrer"
        className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:border-amber-400 transition-all group flex items-center justify-between"
    >
        <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-amber-500 transition-colors">
                <ExternalLink size={20} />
            </div>
            <div>
                <h4 className="font-black text-slate-800 text-sm">{title}</h4>
                <p className="text-[10px] text-slate-500 leading-tight">{desc}</p>
            </div>
        </div>
        <ArrowRight className="text-slate-300 group-hover:text-amber-500 -rotate-45 group-hover:rotate-0 transition-all" size={20} />
    </a>
);

export default MarketIntelligence;
