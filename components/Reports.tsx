
import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area, Legend 
} from 'recharts';
import { Activity, PieChart as PieIcon, BarChart3 } from 'lucide-react';
import { Order } from '../types';

interface ReportsProps {
  orders: Order[];
}

const COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899'];

const Reports: React.FC<ReportsProps> = ({ orders }) => {
  const categoryDataMap = orders.reduce((acc, o) => {
    o.items.forEach(item => {
      acc[item.category] = (acc[item.category] || 0) + item.finalAmount;
    });
    return acc;
  }, {} as Record<string, number>);
  
  const categoryData = Object.entries(categoryDataMap).map(([name, value]) => ({ name, value }));

  const paymentStats = orders.reduce((acc, o) => {
    const paid = o.payments.reduce((sum, p) => sum + p.amount, 0);
    const total = o.totalAmount;
    acc.totalDue += total;
    acc.totalCollected += paid;
    return acc;
  }, { totalDue: 0, totalCollected: 0 });

  const last15Days = [...Array(15)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dailyTotal = orders
      .filter(o => o.createdAt.startsWith(dateStr))
      .reduce((sum, o) => sum + o.totalAmount, 0);
    return { date: dateStr.split('-').slice(1).reverse().join('/'), amount: dailyTotal };
  }).reverse();

  const allMilestones = orders.flatMap(o => o.paymentPlan.milestones);
  const milestoneStats = {
    paid: allMilestones.filter(m => m.status === 'PAID').length,
    overdue: allMilestones.filter(m => m.status !== 'PAID' && new Date(m.dueDate) < new Date()).length,
    upcoming: allMilestones.filter(m => m.status !== 'PAID' && new Date(m.dueDate) >= new Date()).length
  };

  const milestoneData = [
    { name: 'Paid', count: milestoneStats.paid },
    { name: 'Overdue', count: milestoneStats.overdue },
    { name: 'Upcoming', count: milestoneStats.upcoming }
  ];

  const totalRelevantMilestones = (milestoneStats.paid + milestoneStats.overdue) || 1;
  const avgOutstanding = Math.round((paymentStats.totalDue - paymentStats.totalCollected) / (orders.length || 1));

  return (
    <div className="space-y-8 pb-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl border shadow-sm">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <Activity className="text-amber-500" /> Daily Revenue (Last 15 Days)
          </h3>
          <div className="h-72 w-full" style={{ minHeight: '18rem' }}>
            <ResponsiveContainer width="100%" height="100%" minHeight={250}>
              <AreaChart data={last15Days}>
                <defs>
                  <linearGradient id="colorAmt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                <Area type="monotone" dataKey="amount" stroke="#f59e0b" fillOpacity={1} fill="url(#colorAmt)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border shadow-sm">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <PieIcon className="text-blue-500" /> Sales by Category
          </h3>
          <div className="h-72 flex flex-col md:flex-row items-center justify-around w-full" style={{ minHeight: '18rem' }}>
            <div className="h-full w-full md:w-1/2">
              <ResponsiveContainer width="100%" height="100%" minHeight={250}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {categoryData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS[index % COLORS.length]}}></div>
                  <span className="text-xs font-medium text-slate-600">{entry.name}: ₹{entry.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="bg-white p-6 rounded-2xl border shadow-sm">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <BarChart3 className="text-rose-500" /> Milestone Health
          </h3>
          <div className="h-64 w-full" style={{ minHeight: '16rem' }}>
            <ResponsiveContainer width="100%" height="100%" minHeight={200}>
              <BarChart data={milestoneData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={80} />
                <Tooltip />
                <Bar dataKey="count" radius={[0, 10, 10, 0]}>
                  {milestoneData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.name === 'Paid' ? '#10b981' : entry.name === 'Overdue' ? '#ef4444' : '#3b82f6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-2 bg-slate-900 text-white p-8 rounded-3xl relative overflow-hidden">
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div>
              <h3 className="text-xl font-bold mb-2">Collection Efficiency</h3>
              <p className="text-slate-400 text-sm mb-6">Real-time status of your accounts receivable.</p>
            </div>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="text-xs uppercase font-bold text-slate-500 tracking-widest mb-1">On-Time Rate</p>
                <p className="text-4xl font-black text-emerald-400">
                  {Math.round((milestoneStats.paid / totalRelevantMilestones) * 100)}%
                </p>
              </div>
              <div>
                <p className="text-xs uppercase font-bold text-slate-500 tracking-widest mb-1">Avg. Outstanding</p>
                <p className="text-4xl font-black text-amber-400">
                  ₹{avgOutstanding.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          <div className="absolute right-[-40px] bottom-[-40px] w-64 h-64 bg-amber-500 opacity-10 rounded-full blur-3xl"></div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
