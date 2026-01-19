import React, { useState } from 'react';
import { Zap, ArrowRight, CheckCircle2, BrainCircuit, TrendingUp, BookOpen, RefreshCw, Loader2, FileText, ShoppingBag, CreditCard, Users } from 'lucide-react';
import { Order, OrderStatus } from '../types';
import { Card, SectionHeader, Badge, Button } from './shared/BaseUI';
import { PaymentWidget } from './clusters/PaymentWidget';
import { MainView } from '../App';

interface DashboardProps {
  orders: Order[];
  currentRates?: { k24: number, k22: number };
  onRefreshRates?: () => Promise<void>;
  onNavigate: (view: MainView) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ orders, currentRates, onRefreshRates, onNavigate }) => {
  const today = new Date().toISOString().split('T')[0];
  const [refreshing, setRefreshing] = useState(false);
  
  const liveOrders = orders.filter(o => o.status !== OrderStatus.DELIVERED && o.status !== OrderStatus.CANCELLED);
  const criticalOrders = liveOrders.filter(o => 
    o.paymentPlan.milestones.some(m => m.status !== 'PAID' && m.dueDate <= today)
  );

  const handleRefresh = async () => {
      if (onRefreshRates) {
          setRefreshing(true);
          await onRefreshRates();
          setRefreshing(false);
      }
  };

  const totalOutstanding = liveOrders.reduce((acc, o) => {
    const paid = o.payments.reduce((p, c) => p + c.amount, 0);
    return acc + (o.totalAmount - paid);
  }, 0);

  return (
    <div className="space-y-10 pb-24 animate-fadeIn max-w-6xl mx-auto">
      {/* Hero AI Section */}
      <div className="bg-slate-900 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-[3rem] p-8 md:p-12 text-white relative overflow-hidden shadow-2xl border border-white/5">
        <div className="relative z-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h3 className="font-serif font-black text-2xl md:text-3xl text-amber-400 mb-2">
                        Financial Intelligence
                    </h3>
                    <p className="text-slate-400 text-sm font-medium max-w-md leading-relaxed">
                        AuraGold Engine is currently monitoring <span className="text-white font-bold">{liveOrders.length} active contracts</span> for compliance.
                    </p>
                </div>
                <Button 
                    variant="gold"
                    onClick={() => onNavigate('STRATEGY')} 
                    className="px-8"
                >
                    Assurance Center <ArrowRight size={14} className="ml-1" />
                </Button>
            </div>
            
            <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
                 <StatBox label="Collections Due" value={criticalOrders.length} color="text-rose-400" />
                 <StatBox label="Outstanding Revenue" value={`₹${(totalOutstanding / 100000).toFixed(1)}L`} color="text-amber-400" />
                 <StatBox label="Active Orders" value={liveOrders.length} color="text-blue-400" />
                 <StatBox label="Templates Active" value="12" color="text-emerald-400" />
            </div>
        </div>
        
        {/* Background Decorative Element */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-[100px] -mr-40 -mt-40"></div>
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-blue-500/5 rounded-full blur-[100px] -ml-20 -mb-20"></div>
      </div>

      {/* Market & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         <Card className="lg:col-span-1 bg-white flex flex-col justify-between">
            <div className="flex justify-between items-start mb-6">
                <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                    <TrendingUp size={24} />
                </div>
                <button 
                  onClick={handleRefresh} 
                  disabled={refreshing} 
                  className="p-2 text-slate-300 hover:text-amber-500 transition-colors bg-slate-50 rounded-xl"
                >
                    {refreshing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                </button>
            </div>
            <div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-2">Live Standard 22K</p>
                <div className="flex items-baseline gap-2">
                    <h4 className="text-4xl font-black text-slate-900 tracking-tighter">
                        ₹{currentRates?.k22?.toLocaleString()}
                    </h4>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">/ Gram</span>
                </div>
                <p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest mt-2 flex items-center gap-1">
                    <CheckCircle2 size={10} /> Market Verified
                </p>
            </div>
         </Card>

         <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
            <QuickAction onClick={() => onNavigate('ORDER_BOOK')} icon={BookOpen} label="Registry" color="bg-blue-50 text-blue-600" />
            <QuickAction onClick={() => onNavigate('CUSTOMERS')} icon={Users} label="Clients" color="bg-emerald-50 text-emerald-600" />
            <QuickAction onClick={() => onNavigate('COLLECTIONS')} icon={CreditCard} label="Payments" color="bg-rose-50 text-rose-600" />
            <QuickAction onClick={() => onNavigate('STRATEGY')} icon={BrainCircuit} label="AI Strategy" color="bg-indigo-50 text-indigo-600" />
         </div>
      </div>

      {/* Priority Queue */}
      <div className="space-y-6">
        <SectionHeader 
          title="Priority Collection Queue" 
          subtitle="Milestones requiring immediate merchant intervention" 
          action={<Badge label={`${criticalOrders.length} Overdue`} variant="danger" />} 
        />
        
        {criticalOrders.length === 0 ? (
            <Card className="bg-slate-50/50 border-dashed border-2 border-slate-200 py-16 flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm text-emerald-500 mb-4">
                    <CheckCircle2 size={32} />
                </div>
                <p className="font-black text-slate-400 uppercase tracking-[0.2em] text-[10px]">Registry is Healthly</p>
            </Card>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {criticalOrders.slice(0, 4).map(order => (
                    <div key={order.id} className="animate-fadeIn">
                        <PaymentWidget order={order} variant="COMPACT" onPaymentRecorded={() => {}} />
                    </div>
                ))}
            </div>
        )}
      </div>

      {/* Primary Action */}
      <div className="pt-4">
          <button 
            onClick={() => onNavigate('ORDER_NEW')}
            className="w-full bg-slate-900 group relative overflow-hidden text-white py-6 rounded-[2rem] font-black uppercase tracking-[0.3em] text-xs flex items-center justify-center gap-4 shadow-2xl active:scale-[0.98] transition-all"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-500/10 to-amber-500/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
            <Zap size={20} className="text-amber-500" /> Start New Jewelry Booking
          </button>
      </div>
    </div>
  );
};

const StatBox = ({ label, value, color }: { label: string, value: string | number, color: string }) => (
    <div className="bg-white/5 border border-white/10 p-5 rounded-2xl backdrop-blur-sm">
        <p className="text-[9px] uppercase font-black text-slate-500 tracking-[0.2em] mb-2">{label}</p>
        <p className={`text-2xl font-black ${color} tracking-tight`}>{value}</p>
    </div>
);

const QuickAction = ({ onClick, icon: Icon, label, color }: any) => (
    <button 
      onClick={onClick} 
      className="bg-white border border-slate-100 p-6 rounded-[2rem] flex flex-col items-center justify-center gap-3 transition-all hover:shadow-xl hover:border-amber-100 active:scale-95 group"
    >
        <div className={`p-4 rounded-2xl transition-transform group-hover:scale-110 ${color}`}>
            <Icon size={24} />
        </div>
        <span className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 group-hover:text-slate-900">{label}</span>
    </button>
);

export default Dashboard;