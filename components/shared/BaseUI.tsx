import React, { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

// 1. The Standard Card (Luxury/POS Style)
export interface CardProps {
  children?: ReactNode;
  className?: string;
  onClick?: () => void;
  noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className = '', onClick, noPadding = false }) => (
  <div 
    onClick={onClick} 
    className={`bg-white rounded-[2.5rem] border border-slate-100 shadow-sm transition-all duration-300 
                ${onClick ? 'cursor-pointer active:scale-[0.98] hover:shadow-xl hover:border-amber-100' : ''} 
                ${noPadding ? '' : 'p-6 md:p-8'} 
                ${className}`}
  >
    {children}
  </div>
);

// 2. Status Badge (Universal Luxury)
export interface BadgeProps {
  label: string;
  variant?: 'success' | 'warning' | 'danger' | 'neutral' | 'info' | 'luxury';
  icon?: any;
}

export const Badge: React.FC<BadgeProps> = ({ label, variant = 'neutral', icon: Icon }) => {
  const styles = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    warning: 'bg-amber-50 text-amber-700 border-amber-100',
    danger: 'bg-rose-50 text-rose-700 border-rose-100',
    neutral: 'bg-slate-100 text-slate-600 border-slate-200',
    info: 'bg-blue-50 text-blue-700 border-blue-100',
    luxury: 'bg-slate-900 text-amber-400 border-slate-800 shadow-sm'
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${styles[variant]}`}>
      {Icon && <Icon size={12} />}
      {label}
    </span>
  );
};

// 3. Primary/Secondary Actions (Refined)
export interface ButtonProps {
  children?: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'gold';
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, onClick, variant = 'primary', disabled, loading, className = '', size = 'md', fullWidth = false
}) => {
  const base = "font-black uppercase tracking-[0.15em] rounded-2xl flex items-center justify-center gap-2 transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:active:scale-100";
  
  const variants = {
    primary: "bg-slate-900 text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800 hover:shadow-xl",
    secondary: "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300",
    gold: "bg-amber-600 text-white shadow-lg shadow-amber-600/20 hover:bg-amber-700",
    danger: "bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100",
    ghost: "bg-transparent text-slate-500 hover:bg-slate-50"
  };

  const sizes = {
    sm: "text-[9px] px-4 py-2",
    md: "text-[11px] px-6 py-4",
    lg: "text-xs px-8 py-5"
  };

  return (
    <button 
      onClick={onClick} 
      disabled={disabled || loading} 
      className={`${base} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {loading ? <Loader2 size={size === 'sm' ? 14 : 18} className="animate-spin" /> : children}
    </button>
  );
};

// 4. Section Header (Modern Typography)
export const SectionHeader: React.FC<{ title: string; subtitle?: string; action?: ReactNode }> = ({ title, subtitle, action }) => (
  <div className="flex justify-between items-end mb-6 px-1">
    <div>
      <h3 className="font-black text-slate-900 text-xs uppercase tracking-[0.3em] leading-none mb-2">{title}</h3>
      {subtitle && <p className="text-sm text-slate-400 font-medium">{subtitle}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

// 5. Action Zone (The Mobile Sticky Bar Refinement)
export const ActionZone: React.FC<{ children?: ReactNode }> = ({ children }) => (
  <div className="fixed bottom-[84px] left-0 right-0 p-4 bg-gradient-to-t from-white via-white/95 to-transparent z-30 lg:static lg:bg-none lg:p-0">
    <div className="max-w-4xl mx-auto flex gap-3">
      {children}
    </div>
  </div>
);