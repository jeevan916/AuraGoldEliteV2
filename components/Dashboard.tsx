
import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
} from 'recharts';
import { TrendingUp, DollarSign, Clock, Sparkles, RefreshCw, Zap, AlertTriangle, ShoppingBag, BarChart as BarChartIcon } from 'lucide-react';
import { Order, OrderStatus } from '../types';
import { geminiService } from '../services/geminiService';
import { goldRateService } from '../services/goldRateService';

interface DashboardProps {
  orders: Order[];
  currentRates?: { k24: number, k22: number };
}

const Dashboard: React.FC<DashboardProps> = ({ orders, currentRates }) => {
  const [riskAnalysis, setRiskAnalysis] = useState<string | null>(null);
  const [loadingRisk, setLoadingRisk] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const stats = {
    totalSales: orders.reduce((acc, o) => acc + o.totalAmount, 0),
    activeOrders: orders.filter(o => o.status === OrderStatus.ACTIVE).length,
    overdueCount: orders.filter(o => o.status === OrderStatus.OVERDUE).length,
    collectedAmount: orders.reduce((acc, o) => acc + o.payments.reduce((pAcc, p) => pAcc + p.amount, 0), 0)
  };

  const chartData = orders.slice(-7).map(o => ({
    name: o.customerName.split(' ')[0],
    total: o.totalAmount,
    paid: o.payments.reduce((acc, p) => acc + p.amount, 0)
  }));

  const overdueOrders = orders.filter(o => o.status === OrderStatus.OVERDUE);

  const handleAnalyzeRisk = async () => {
    if (overdueOrders.length === 0) {
      setRiskAnalysis("No active collection risks. All customer payments are on track.");
      return;
    }
    setLoadingRisk(true);
    try {
      const analysis = await geminiService.analyzeCollectionRisk(overdueOrders);
      setRiskAnalysis(analysis);
    } catch (error) {
      setRiskAnalysis("Failed to generate risk analysis. Please try again later.");
    } finally {
      setLoadingRisk(false);
    }
  };

  const handleManualSync = async () => {
      setIsSyncing(true);
      await goldRateService.fetchLiveRate(true);
      window.location.reload(); 
  };

  useEffect(() => {
    if (overdueOrders.length > 0 && !riskAnalysis) {
      handleAnalyzeRisk();
    }
  }, [overdueOrders.length]);

  return (
    <div className="space-y-6">
      {/* Live Rate Strip */}
      <div className={`px-6 py-3 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-lg animate-fadeIn ${(!currentRates?.k24 || currentRates.k24 === 0) ? 'bg-rose-600 text-white shadow-rose-100' : 'bg-amber-600 text-white shadow-amber-100'}`}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-lg">
            {(!currentRates?.k24 || currentRates.k24 === 0) ? <AlertTriangle size={18} /> : <Zap size={18} className="text-amber-200" />}
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-70 leading-none mb-1">Live Market Rates</p>
            <div className="flex gap-4">
              {(!currentRates?.k24 || currentRates.k24 === 0) ? (
                  <p className="text-sm font-bold">Connection Failed / Offline</p>
              ) : (
                  <>
                    <p className="text-sm font-black">24K: ₹{currentRates?.k24?.toLocaleString()}/g</p>
                    <p className="text-sm font-black opacity-80">22K: ₹{currentRates?.k22?.toLocaleString()}/g</p>
                  </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleManualSync} 
            disabled={isSyncing}
            className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all"
          >
             <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} /> {isSyncing ? 'Syncing...' : 'Retry Sync'}
          </button>
          
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${currentRates?.k24 ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`}></div>
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">
              {currentRates?.k24 ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="p-3 bg-amber-50 rounded-lg"><DollarSign className="text-amber-600 w-6 h-6" /></div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Total Order Value</p>
            <p className="text-2xl font-bold">₹{stats.totalSales.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="p-3 bg-blue-50 rounded-lg"><ShoppingBag className="text-blue-600 w-6 h-6" /></div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Active Orders</p>
            <p className="text-2xl font-bold">{stats.activeOrders}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="p-3 bg-rose-50 rounded-lg"><Clock className="text-rose-600 w-6 h-6" /></div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Overdue Plans</p>
            <p className={`text-2xl font-bold ${stats.overdueCount > 0 ? 'text-rose-600' : ''}`}>
              {stats.overdueCount}
            </p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 rounded-lg"><TrendingUp className="text-emerald-600 w-6 h-6" /></div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Total Collected</p>
            <p className="text-2xl font-bold text-emerald-600">₹{stats.collectedAmount.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl border shadow-sm space-y-4">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="text-amber-500" />
              <h3 className="font-bold text-lg">AI Recovery Intelligence</h3>
            </div>
            <button 
              onClick={handleAnalyzeRisk}
              disabled={loadingRisk}
              className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-amber-600 hover:text-amber-700 disabled:opacity-50"
            >
              <RefreshCw size={14} className={loadingRisk ? 'animate-spin' : ''} />
              Re-Analyze
            </button>
          </div>
          
          <div className="bg-slate-50 p-6 rounded-2xl min-h-[200px] border border-slate-100">
            {loadingRisk ? (
              <div className="flex flex-col items-center justify-center h-40 space-y-4">
                <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Consulting Gemini AI...</p>
              </div>
            ) : (
              <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                {riskAnalysis || "No analysis available. Click refresh to scan overdue orders."}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border shadow-sm">
          <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
            <BarChartIcon size={18} className="text-blue-500" /> Recent Flows
          </h3>
          <div className="h-48 w-full" style={{ minHeight: '12rem' }}>
            <ResponsiveContainer width="100%" height="100%" minHeight={150}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                <YAxis hide />
                <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                <Bar dataKey="total" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="paid" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 flex justify-between text-[10px] font-black uppercase text-slate-400 tracking-widest">
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500"></div> Order Value</div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Collected</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
