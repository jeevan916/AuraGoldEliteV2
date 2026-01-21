
import React from 'react';

export const PricingField = ({ label, value, onChange, isSilver = false }: any) => (
    <div className="relative group">
        <label className="text-[10px] font-black uppercase text-slate-400 mb-1.5 block tracking-widest ml-1">{label}</label>
        <div className="relative">
            <span className={`absolute left-4 top-1/2 -translate-y-1/2 font-black ${isSilver ? 'text-slate-400' : 'text-amber-500'}`}>₹</span>
            <input 
                type="number" 
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-8 pr-4 font-black text-xl text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-amber-500 transition-all"
                value={value}
                onChange={e => onChange(parseFloat(e.target.value))}
            />
        </div>
    </div>
);

export const ConfigInput = ({ label, value, onChange, type = "text" }: any) => (
    <div>
        <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block ml-1">{label}</label>
        <input 
            type={type}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all placeholder:text-slate-300"
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            placeholder="Not Configured"
        />
    </div>
);
