
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
      {/* Live Rate Hero Card */}
      <div className={`p-6 rounded-[24px] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg transition-all ${(!currentRates?.k24 || currentRates.k24 === 0) ? 'bg-rose-600 text-white shadow-rose-200/50' : 'bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-amber-500/30'}`}>
        <div>
           <div className="flex items-center gap-2 mb-2 opacity-90">
             {(!currentRates?.k24 || currentRates.k24 === 0) ? <AlertTriangle size={16} /> : <Zap size={16} className="text-amber-100 fill-amber-100" />}
             <span className="text-[11px] font-black uppercase tracking-widest">Live Market Rates</span>
           </div>
           
           <div className="flex items-baseline gap-4">
              {(!currentRates?.k24 || currentRates.k24 === 0) ? (
                  <p className="text-xl font-bold">Offline</p>
              ) : (
                  <>
                    <div>
                      <span className="text-4xl font-black tracking-tighter">₹{currentRates?.k22?.toLocaleString()}</span>
                      <span className="text-sm font-bold opacity-80 ml-1">/ 22K</span>
                    </div>
                    <div className="opacity-80">
                      <span className="text-lg font-bold">₹{currentRates?.k24?.toLocaleString()}</span>
                      <span className="text-[10px] font-bold ml-1">/ 24K</span>
                    </div>
                  </>
              )}
           </div>
        </div>
        
        <button 
          onClick={handleManualSync} 
          disabled={isSyncing}
          className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 backdrop-blur-sm transition-all self-end md:self-center"
        >
           <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} /> {isSyncing ? 'Syncing...' : 'Sync Now'}
        </button>
      </div>

      {/* Snap Scroll Stats for Mobile */}
      <div className="flex overflow-x-auto gap-4 pb-4 -mx-4 px-4 snap-x no-scrollbar md:grid md:grid-cols-4 md:mx-0 md:px-0 md:pb-0">
        <StatCard 
          icon={<DollarSign className="text-amber-600 w-6 h-6" />} 
          label="Total Order Value" 
          value={`₹${stats.totalSales.toLocaleString()}`} 
          bg="bg-amber-50"
        />
        <StatCard 
          icon={<ShoppingBag className="text-blue-600 w-6 h-6" />} 
          label="Active Orders" 
          value={stats.activeOrders.toString()} 
          bg="bg-blue-50"
        />
        <StatCard 
          icon={<Clock className="text-rose-600 w-6 h-6" />} 
          label="Overdue Plans" 
          value={stats.overdueCount.toString()} 
          bg="bg-rose-50"
          valueColor={stats.overdueCount > 0 ? 'text-rose-600' : 'text-slate-900'}
        />
        <StatCard 
          icon={<TrendingUp className="text-emerald-600 w-6 h-6" />} 
          label="Total Collected" 
          value={`₹${stats.collectedAmount.toLocaleString()}`} 
          bg="bg-emerald-50"
          valueColor="text-emerald-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AI Insight Card */}
        <div className="lg:col-span-2 bg-white p-6 rounded-[24px] shadow-sm space-y-4">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="text-amber-500" size={20} />
              <h3 className="font-bold text-lg text-slate-800 tracking-tight">AI Recovery Intel</h3>
            </div>
            <button 
              onClick={handleAnalyzeRisk}
              disabled={loadingRisk}
              className="p-2 bg-slate-100 rounded-full text-slate-500 hover:text-amber-600 active:bg-slate-200 transition-colors"
            >
              <RefreshCw size={16} className={loadingRisk ? 'animate-spin' : ''} />
            </button>
          </div>
          
          <div className="bg-slate-50 p-6 rounded-2xl min-h-[160px]">
            {loadingRisk ? (
              <div className="flex flex-col items-center justify-center h-full space-y-3 py-4">
                <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Consulting Gemini...</p>
              </div>
            ) : (
              <div className="text-[15px] text-slate-700 leading-relaxed font-medium">
                {riskAnalysis || "No overdue risks detected. Tap refresh to scan again."}
              </div>
            )}
          </div>
        </div>

        {/* Chart Card */}
        <div className="bg-white p-6 rounded-[24px] shadow-sm">
          <h3 className="font-bold text-lg mb-6 flex items-center gap-2 tracking-tight text-slate-800">
            <BarChartIcon size={20} className="text-blue-500" /> Recent Flows
          </h3>
          <div className="h-48 w-full" style={{ minHeight: '12rem' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                <Tooltip 
                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: 'bold'}} 
                  cursor={{fill: '#f8fafc'}}
                />
                <Bar dataKey="total" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="paid" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value, bg, valueColor = 'text-slate-900' }: any) => (
  <div className="min-w-[85vw] md:min-w-0 snap-center bg-white p-6 rounded-[24px] shadow-sm flex items-center gap-4 border border-slate-50/50">
    <div className={`p-4 rounded-2xl ${bg}`}>{icon}</div>
    <div>
      <p className="text-xs text-slate-500 font-bold uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-black tracking-tight ${valueColor}`}>{value}</p>
    </div>
  </div>
);

export default Dashboard;
