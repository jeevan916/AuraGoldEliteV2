import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, Globe, ExternalLink, ArrowRight, 
  Loader2, RefreshCw, ArrowUpRight, ArrowDownRight,
  Calculator, Zap, Lock, Calendar, Target, AlertTriangle, Wallet
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { io } from 'socket.io-client';
import { Order, OrderStatus, GlobalSettings } from '../types';

interface MarketIntelligenceProps {
  orders: Order[];
  settings: GlobalSettings;
}

type Timeframe = 'TODAY' | '3D' | '5D' | '1W' | '15D' | '1M';
type MetalType = 'GOLD' | 'SILVER';

const API_BASE = process.env.VITE_API_BASE_URL || '';

const MarketIntelligence: React.FC<MarketIntelligenceProps> = ({ orders, settings }) => {
  const [timeframe, setTimeframe] = useState<Timeframe>('1W');
  const [metal, setMetal] = useState<MetalType>('GOLD');
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

    // Real-time listener
    const socket = io(API_BASE, {
        path: '/socket.io',
        transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
        console.log("[MarketIntel] Socket Connected");
    });

    socket.on('rate_update', (data: any) => {
        console.log("[MarketIntel] Real-time rate received:", data);
        fetchHistory(); // Reload history to include the new point
    });

    return () => {
        socket.disconnect();
    };
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
          rate: metal === 'GOLD' ? parseFloat(h.rate22k) : parseFloat(h.rateSilver || 90),
          fullDate: new Date(h.recorded_at).toLocaleString()
      }));
  }, [history, timeframe, metal]);

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
      const activeOrders = orders.filter(o => 
          o.status !== OrderStatus.DELIVERED && 
          o.status !== OrderStatus.CANCELLED &&
          // Filter logic for exposure based on metal type
          (metal === 'GOLD' 
              ? (!o.items.some(i => i.metalColor === 'Silver')) 
              : (o.items.some(i => i.metalColor === 'Silver'))
          )
      );
      
      let totalWeight = 0;
      let totalBookedValue = 0;
      let totalUnpaidBalance = 0;

      activeOrders.forEach(o => {
          const relevantItems = o.items.filter(i => metal === 'GOLD' ? i.metalColor !== 'Silver' : i.metalColor === 'Silver');
          const weight = relevantItems.reduce((acc, i) => acc + i.netWeight, 0);
          totalWeight += weight;
          
          if (weight > 0) {
              const paid = o.payments.reduce((acc, p) => acc + p.amount, 0);
              const balance = o.totalAmount - paid;
              totalUnpaidBalance += balance; // Simplified allocation for mixed orders
              
              // Use booking rate logic
              totalBookedValue += weight * o.goldRateAtBooking; 
          }
      });

      const currentRate = metal === 'GOLD' ? settings.currentGoldRate22K : settings.currentSilverRate;
      const avgBookingRate = totalWeight > 0 ? (totalBookedValue / totalWeight) : currentRate;
      
      const unpaidWeight = totalWeight > 0 ? (totalUnpaidBalance / (totalBookedValue / totalWeight)) : 0;
      const currentCostOfUnpaid = totalUnpaidBalance > 0 ? (totalUnpaidBalance / avgBookingRate) * currentRate : 0;
      const exposurePL = totalUnpaidBalance - currentCostOfUnpaid;

      return {
          totalWeight,
          avgBookingRate,
          totalUnpaidBalance,
          currentCostOfUnpaid,
          exposurePL,
          activeOrderCount: activeOrders.length
      };
  }, [orders, settings, metal]);

  // --- PREDICTIVE CASH FLOW ENGINE (Deterministic AI) ---
  const cashFlowForecast = useMemo(() => {
      const today = new Date();
      today.setHours(0,0,0,0);

      const buckets = {
          d3: { raw: 0, projected: 0, label: '3 Days' },
          d7: { raw: 0, projected: 0, label: '7 Days' },
          d15: { raw: 0, projected: 0, label: '15 Days' },
          nextWeek: { raw: 0, projected: 0, label: 'Next Week' }, // Day 8-14
          longTerm: { raw: 0, projected: 0, label: 'After 30 Days' }
      };

      orders.forEach(order => {
          if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.DELIVERED) return;

          // Risk Heuristic Calculation
          let riskScore = 0.95; // Start with 95% confidence
          
          // 1. History Penalty: Does this order have OTHER overdue milestones?
          const hasOverdue = order.paymentPlan.milestones.some(m => 
              m.status !== 'PAID' && new Date(m.dueDate) < today
          );
          if (hasOverdue) riskScore -= 0.15; // 15% penalty for existing delinquency

          // 2. High Value Penalty
          if (order.totalAmount > 100000) riskScore -= 0.05; // 5% volatility for large sums

          // 3. New Customer Penalty (No history)
          const isNew = order.payments.length === 0;
          if (isNew) riskScore -= 0.05;

          order.paymentPlan.milestones.forEach(m => {
              if (m.status === 'PAID') return;

              const dueDate = new Date(m.dueDate);
              const diffTime = dueDate.getTime() - today.getTime();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              
              // Only count future or today
              if (diffDays < 0) return; 

              const amt = m.targetAmount;
              const wAmt = amt * Math.max(0.1, riskScore); // Floor at 10% confidence

              if (diffDays <= 3) {
                  buckets.d3.raw += amt;
                  buckets.d3.projected += wAmt;
              }
              if (diffDays <= 7) {
                  buckets.d7.raw += amt;
                  buckets.d7.projected += wAmt;
              }
              if (diffDays <= 15) {
                  buckets.d15.raw += amt;
                  buckets.d15.projected += wAmt;
              }
              if (diffDays > 7 && diffDays <= 14) {
                  buckets.nextWeek.raw += amt;
                  buckets.nextWeek.projected += wAmt;
              }
              if (diffDays > 30) {
                  buckets.longTerm.raw += amt;
                  buckets.longTerm.projected += wAmt;
              }
          });
      });

      return buckets;
  }, [orders]);

  if (loading) {
      return (
          <div className="h-full flex flex-col items-center justify-center space-y-4 py-20">
              <Loader2 className="animate-spin text-amber-500" size={48} />
              <p className="text-slate-400 font-black uppercase tracking-widest text-sm">Connecting to Sagar Jewellers...</p>
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
           <p className="text-sm text-slate-500 font-medium">Internal Analytics & Sagar Jewellers Official Feed</p>
        </div>
        <div className="flex gap-4">
            <div className="flex bg-slate-100 p-1 rounded-2xl shadow-inner">
                <button 
                    onClick={() => setMetal('GOLD')}
                    className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${metal === 'GOLD' ? 'bg-amber-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    GOLD
                </button>
                <button 
                    onClick={() => setMetal('SILVER')}
                    className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${metal === 'SILVER' ? 'bg-slate-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    SILVER 999
                </button>
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
      </div>

      {/* NEW: PREDICTIVE CASH FLOW (FULL WIDTH) */}
      <div className="bg-gradient-to-r from-indigo-50 via-white to-indigo-50 p-6 rounded-[2rem] border border-indigo-100 shadow-sm relative overflow-hidden">
          <div className="flex items-center gap-3 mb-6 relative z-10">
              <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl"><Wallet size={24} /></div>
              <div>
                  <h3 className="font-black text-slate-800 text-lg">Predictive Cash Flow Matrix</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                      Probability-Weighted Inflow • Heuristic Engine Active
                  </p>
              </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 relative z-10">
              {Object.values(cashFlowForecast).map((bucket: { raw: number; projected: number; label: string }, idx) => {
                  const confidence = bucket.raw > 0 ? (bucket.projected / bucket.raw) * 100 : 100;
                  const isLowConfidence = confidence < 80;

                  return (
                      <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:border-indigo-200 transition-all group">
                          <div>
                              <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-2 flex justify-between">
                                  {bucket.label}
                                  {bucket.raw > 0 && (
                                      <span className={`text-[8px] px-1.5 rounded ${isLowConfidence ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'}`}>
                                          {Math.round(confidence)}% Prob.
                                      </span>
                                  )}
                              </p>
                              <p className="text-xl font-black text-slate-800">₹{Math.round(bucket.projected).toLocaleString()}</p>
                              {bucket.raw > 0 && (
                                  <p className="text-[9px] text-slate-400 mt-1 line-through decoration-rose-300">
                                      Demand: ₹{bucket.raw.toLocaleString()}
                                  </p>
                              )}
                          </div>
                          {bucket.raw > 0 && (
                              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
                                  <div 
                                      className={`h-full rounded-full transition-all duration-1000 ${isLowConfidence ? 'bg-amber-400' : 'bg-indigo-500'}`} 
                                      style={{ width: `${confidence}%` }}
                                  ></div>
                              </div>
                          )}
                      </div>
                  );
              })}
          </div>
          
          <div className="absolute top-0 right-0 opacity-5 pointer-events-none">
              <Target size={200} />
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* 2. GRANULAR CHART (COL-SPAN 8) */}
          <div className="lg:col-span-8 space-y-6">
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl relative overflow-hidden">
                  <div className="flex justify-between items-start mb-8 relative z-10">
                      <div>
                          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">
                              {metal === 'GOLD' ? 'Standard 22K (Sagar Spot)' : 'Fine Silver 999 (Sagar Spot)'}
                          </p>
                          <div className="flex items-center gap-4">
                              <h3 className="text-4xl font-black text-slate-900">
                                  ₹{metal === 'GOLD' ? settings.currentGoldRate22K.toLocaleString() : settings.currentSilverRate.toLocaleString()}
                              </h3>
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
                                    <stop offset="5%" stopColor={metal === 'GOLD' ? "#f59e0b" : "#64748b"} stopOpacity={0.2}/>
                                    <stop offset="95%" stopColor={metal === 'GOLD' ? "#f59e0b" : "#64748b"} stopOpacity={0}/>
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
                                domain={['dataMin - 50', 'dataMax + 50']} 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{fontSize: 9, fontWeight: 'bold', fill: '#94a3b8'}}
                                orientation="right"
                            />
                            <Tooltip 
                                contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', padding: '15px'}}
                                labelStyle={{fontWeight: 'black', color: '#1e293b', marginBottom: '5px', fontSize: '10px', textTransform: 'uppercase'}}
                                itemStyle={{fontSize: '14px', fontWeight: 'bold', color: metal === 'GOLD' ? '#f59e0b' : '#64748b'}}
                            />
                            <Area 
                                type="monotone" 
                                dataKey="rate" 
                                stroke={metal === 'GOLD' ? "#f59e0b" : "#64748b"} 
                                strokeWidth={4}
                                fillOpacity={1} 
                                fill="url(#colorRate)" 
                                animationDuration={1500}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                  </div>
              </div>

              {/* OFFICIAL SOURCE LINK ONLY */}
              <div>
                  <a 
                      href="http://www.sagarjewellers.co.in/" target="_blank" rel="noreferrer"
                      className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:border-amber-400 transition-all group flex items-center justify-between"
                  >
                      <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-amber-500 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                              <Lock size={20} />
                          </div>
                          <div>
                              <h4 className="font-black text-slate-800 text-sm">Sagar Jewellers</h4>
                              <p className="text-[10px] text-slate-500 leading-tight">Official Spot Rate Source (Nagpur)</p>
                          </div>
                      </div>
                      <ArrowRight className="text-slate-300 group-hover:text-amber-500 -rotate-45 group-hover:rotate-0 transition-all" size={20} />
                  </a>
              </div>
          </div>

          {/* 3. BOOKING EXPOSURE (COL-SPAN 4) */}
          <div className="lg:col-span-4 space-y-6">
              <div className={`rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden border ${metal === 'GOLD' ? 'bg-slate-900 border-slate-800' : 'bg-slate-700 border-slate-600'}`}>
                  <div className="relative z-10 space-y-8">
                      <div className="flex items-center gap-3">
                          <div className={`p-3 rounded-2xl ${metal === 'GOLD' ? 'bg-amber-500/20 text-amber-500' : 'bg-white/20 text-white'}`}><Zap size={24} /></div>
                          <div>
                              <h4 className="font-black text-lg">Active {metal === 'SILVER' ? 'Silver 999' : 'Gold'} Exposure</h4>
                              <p className="text-[10px] uppercase font-bold opacity-60 tracking-[0.2em]">Risk Analysis</p>
                          </div>
                      </div>

                      <div className="space-y-6">
                          <ExposureStat 
                            label={`Total Booked ${metal}`} 
                            value={`${activeAnalytics.totalWeight.toFixed(3)} g`} 
                            sub={`Across ${activeAnalytics.activeOrderCount} ongoing orders`}
                          />
                          <ExposureStat 
                            label="Avg. Booking Rate" 
                            value={`₹${Math.round(activeAnalytics.avgBookingRate).toLocaleString()}`} 
                            sub="Contractual standard"
                          />
                          <ExposureStat 
                            label="Unpaid Balance Cost" 
                            value={`₹${Math.round(activeAnalytics.currentCostOfUnpaid).toLocaleString()}`} 
                            sub={`Replacement value at current rates`}
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
                      </div>
                  </div>
                  <div className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-[100px] ${metal === 'GOLD' ? 'bg-amber-500/5' : 'bg-white/5'}`}></div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-start gap-4">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><Calculator size={20} /></div>
                  <div>
                      <h4 className="font-bold text-slate-800 text-sm">Hedge Recommendation</h4>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                          Based on {activeAnalytics.totalWeight.toFixed(1)}g total exposure, we recommend maintaining a 20% liquid bullion reserve.
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
        <p className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-60">{label}</p>
        <p className="text-xl font-black text-white">{value}</p>
        <p className="text-[10px] font-medium opacity-50">{sub}</p>
    </div>
);

export default MarketIntelligence;