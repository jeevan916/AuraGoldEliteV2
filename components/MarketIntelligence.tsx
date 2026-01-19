
import React from 'react';
import { TrendingUp, Globe, BarChart2, ArrowRight, DollarSign, Newspaper, Calendar } from 'lucide-react';

const MarketIntelligence: React.FC = () => {
  const marketResources = [
    {
      id: 'kitco',
      title: 'Kitco Live Gold',
      desc: 'Real-time international spot prices & charts.',
      url: 'https://www.kitco.com/charts/livegold.html',
      icon: TrendingUp,
      color: 'bg-amber-50 text-amber-700'
    },
    {
      id: 'fxstreet',
      title: 'Economic Calendar',
      desc: 'Global events affecting bullion prices.',
      url: 'https://www.fxstreet.com/economic-calendar',
      icon: Calendar,
      color: 'bg-blue-50 text-blue-700'
    },
    {
      id: 'moneycontrol',
      title: 'MoneyControl Commodities',
      desc: 'MCX India Gold/Silver futures.',
      url: 'https://www.moneycontrol.com/commodity/gold-price.html',
      icon: DollarSign,
      color: 'bg-emerald-50 text-emerald-700'
    },
    {
      id: 'ibja',
      title: 'IBJA Rates',
      desc: 'Indian Bullion and Jewellers Association.',
      url: 'https://ibjarates.com/',
      icon: BarChart2,
      color: 'bg-indigo-50 text-indigo-700'
    }
  ];

  return (
    <div className="space-y-8 h-full flex flex-col animate-fadeIn pb-24">
      <div className="flex justify-between items-end shrink-0">
        <div>
           <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
             <Globe className="text-blue-500" /> Market Intelligence
           </h2>
           <p className="text-sm text-slate-500">Live feeds and economic indicators.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         {marketResources.map(res => (
             <a 
                key={res.id} 
                href={res.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-lg hover:border-amber-200 transition-all group relative overflow-hidden"
             >
                <div className="flex items-start justify-between relative z-10">
                    <div className="flex items-center gap-4">
                        <div className={`p-4 rounded-2xl ${res.color}`}>
                            <res.icon size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 text-lg group-hover:text-amber-600 transition-colors">{res.title}</h3>
                            <p className="text-xs text-slate-500 font-medium mt-1">{res.desc}</p>
                        </div>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-full text-slate-400 group-hover:bg-amber-500 group-hover:text-white transition-all">
                        <ArrowRight size={20} className="-rotate-45 group-hover:rotate-0 transition-transform" />
                    </div>
                </div>
                <div className="absolute bottom-0 right-0 w-32 h-32 bg-slate-50 rounded-full blur-3xl group-hover:bg-amber-50 transition-colors"></div>
             </a>
         ))}
      </div>

      <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] relative overflow-hidden shadow-xl mt-auto">
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                  <h4 className="text-xl font-bold mb-2 flex items-center gap-2">
                      <Newspaper size={20} className="text-emerald-400"/> Market News
                  </h4>
                  <p className="text-slate-400 text-sm">
                      Access the latest bullion news directly from trusted sources.
                      We redirected direct embedding to ensure stability and security.
                  </p>
              </div>
              <a 
                href="https://www.gold.org/goldhub/research" 
                target="_blank"
                rel="noreferrer"
                className="bg-white text-slate-900 px-6 py-3 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-emerald-400 transition-colors shadow-lg whitespace-nowrap"
              >
                  Read GoldHub Reports
              </a>
          </div>
          <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl"></div>
      </div>
    </div>
  );
};

export default MarketIntelligence;
