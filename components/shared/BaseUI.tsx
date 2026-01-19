import React, { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

// 1. The Standard Card (iOS/POS Style)
export interface CardProps {
  children?: ReactNode;
  className?: string;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, className = '', onClick }) => (
  <div onClick={onClick} className={`bg-white rounded-2xl border border-slate-100 shadow-sm ${onClick ? 'cursor-pointer active:scale-[0.99] transition-transform' : ''} ${className}`}>
    {children}
  </div>
);

// 2. Status Badge (Universal)
export interface BadgeProps {
  label: string;
  variant?: 'success' | 'warning' | 'danger' | 'neutral' | 'info';
  icon?: any;
}

export const Badge: React.FC<BadgeProps> = ({ label, variant = 'neutral', icon: Icon }) => {
  const styles = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    warning: 'bg-amber-50 text-amber-700 border-amber-100',
    danger: 'bg-rose-50 text-rose-700 border-rose-100',
    neutral: 'bg-slate-100 text-slate-600 border-slate-200',
    info: 'bg-blue-50 text-blue-700 border-blue-100'
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${styles[variant]}`}>
      {Icon && <Icon size={10} />}
      {label}
    </span>
  );
};

// 3. Primary/Secondary Actions
export interface ButtonProps {
  children?: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({ 
  children, onClick, variant = 'primary', disabled, loading, className = '', size = 'md' 
}) => {
  const base = "font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100";
  
  const variants = {
    primary: "bg-slate-900 text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800",
    secondary: "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50",
    danger: "bg-rose-50 text-rose-600 hover:bg-rose-100",
    ghost: "bg-transparent text-slate-500 hover:bg-slate-100"
  };

  const sizes = {
    sm: "text-[9px] px-3 py-1.5",
    md: "text-xs px-4 py-3",
    lg: "text-sm px-6 py-4"
  };

  return (
    <button onClick={onClick} disabled={disabled || loading} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}>
      {loading ? <Loader2 size={size === 'sm' ? 12 : 16} className="animate-spin" /> : children}
    </button>
  );
};

// 4. Action Zone (The Mobile Sticky Bar)
export const ActionZone: React.FC<{ children?: ReactNode }> = ({ children }) => (
  <div className="fixed bottom-[84px] left-0 right-0 p-4 bg-gradient-to-t from-white via-white/95 to-transparent z-30 lg:static lg:bg-none lg:p-0">
    <div className="max-w-4xl mx-auto flex gap-3">
      {children}
    </div>
  </div>
);

// 5. Section Header
export const SectionHeader: React.FC<{ title: string; subtitle?: string; action?: ReactNode }> = ({ title, subtitle, action }) => (
  <div className="flex justify-between items-end mb-4 px-1">
    <div>
      <h3 className="font-black text-slate-800 text-sm uppercase tracking-wide">{title}</h3>
      {subtitle && <p className="text-xs text-slate-400 font-medium mt-0.5">{subtitle}</p>}
    </div>
    {action}
  </div>
);