
import React from 'react';
import WebFrame from './WebFrame';
import { TrendingUp, Globe, DollarSign, BarChart2 } from 'lucide-react';

const MarketIntelligence: React.FC = () => {
  return (
    <div className="space-y-6 h-full flex flex-col animate-fadeIn">
      <div className="flex justify-between items-end shrink-0">
        <div>
           <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
             <Globe className="text-blue-500" /> Market Intelligence
           </h2>
           <p className="text-sm text-slate-500">Live feeds from external markets via AllOrigins Proxy.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
         <div className="flex flex-col gap-4 h-full">
            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex items-center gap-3 shrink-0">
               <div className="p-2 bg-amber-200 text-amber-800 rounded-lg"><TrendingUp size={20}/></div>
               <div>
                  <h3 className="font-bold text-amber-900">Live Gold Spot (Kitco)</h3>
                  <p className="text-xs text-amber-700">Real-time international spot prices.</p>
               </div>
            </div>
            {/* Using Kitco's live chart which usually blocks iframes, but works via Proxy text fetch */}
            <div className="flex-1 min-h-[400px]">
               <WebFrame 
                 url="https://www.kitco.com/charts/livegold.html" 
                 title="Kitco Live Gold Charts" 
                 height="100%"
                 refreshInterval={60}
               />
            </div>
         </div>

         <div className="flex flex-col gap-4 h-full">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center gap-3 shrink-0">
               <div className="p-2 bg-slate-200 text-slate-800 rounded-lg"><BarChart2 size={20}/></div>
               <div>
                  <h3 className="font-bold text-slate-900">Economic Calendar</h3>
                  <p className="text-xs text-slate-500">Global events affecting bullion prices.</p>
               </div>
            </div>
            <div className="flex-1 min-h-[400px]">
               {/* Example of another useful resource for jewelers */}
               <WebFrame 
                 url="https://www.fxstreet.com/economic-calendar/widget" 
                 title="FXStreet Economic Calendar" 
                 height="100%"
               />
            </div>
         </div>
      </div>
      
      <div className="bg-white p-4 rounded-2xl border shadow-sm shrink-0">
          <h4 className="font-bold text-sm text-slate-800 mb-2">Why use this view?</h4>
          <p className="text-xs text-slate-500">
             External financial websites often block direct embedding to prevent clickjacking (X-Frame-Options: DENY). 
             This module uses the <strong>AllOrigins Proxy</strong> component to fetch the raw HTML server-side and render it securely within your dashboard, 
             giving you a single pane of glass for all market data without opening new tabs.
          </p>
      </div>
    </div>
  );
};

export default MarketIntelligence;
