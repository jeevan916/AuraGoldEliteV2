import React from 'react';
import { 
  User, Sparkles, Coins, ReceiptIndianRupee, 
  ArrowLeft, ArrowRight, CheckCircle2, ShoppingBag 
} from 'lucide-react';

interface WizardStepNavProps {
  currentStep: number;
  setCurrentStep: (step: number) => void;
  cartItemCount: number;
  enableOldGold: boolean;
  oldGoldItemCount: number;
  netPayableAmount: number;
  onFinish?: () => void;
}

export const WizardStepNav: React.FC<WizardStepNavProps> = ({
  currentStep,
  setCurrentStep,
  cartItemCount,
  enableOldGold,
  oldGoldItemCount,
  netPayableAmount,
}) => {
  const steps = [
    {
      id: 1,
      title: 'Customer & Rates',
      shortTitle: 'Rates',
      icon: User,
      badge: null,
    },
    {
      id: 2,
      title: 'Jewellery Cart',
      shortTitle: 'Jewellery',
      icon: Sparkles,
      badge: cartItemCount > 0 ? `${cartItemCount}` : null,
    },
    {
      id: 3,
      title: 'Old Gold Scrap',
      shortTitle: 'Old Gold',
      icon: Coins,
      badge: enableOldGold && oldGoldItemCount > 0 ? `${oldGoldItemCount}` : null,
    },
    {
      id: 4,
      title: 'Payment & Quote',
      shortTitle: 'Quotation',
      icon: ReceiptIndianRupee,
      badge: `₹${(netPayableAmount / 1000).toFixed(0)}k`,
    },
  ];

  return (
    <>
      {/* 1. TOP STEP NAVIGATION TABS */}
      <div className="bg-white rounded-3xl p-2.5 sm:p-3 border border-slate-200 shadow-sm">
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
          {steps.map((s) => {
            const Icon = s.icon;
            const isActive = currentStep === s.id;
            const isCompleted = currentStep > s.id;

            return (
              <button
                type="button"
                key={s.id}
                onClick={() => setCurrentStep(s.id)}
                className={`py-2.5 px-2 sm:px-3 rounded-2xl flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 transition-all relative ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-md'
                    : isCompleted
                    ? 'bg-amber-50 text-amber-900 hover:bg-amber-100/70 border border-amber-200/50'
                    : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-100'
                }`}
              >
                <div className="relative">
                  <Icon size={16} className={isActive ? 'text-amber-400' : isCompleted ? 'text-amber-700' : 'text-slate-400'} />
                  {isCompleted && (
                    <span className="absolute -top-1.5 -right-2 text-[9px] text-amber-700 font-black">
                      ✓
                    </span>
                  )}
                </div>

                <div className="text-center sm:text-left leading-tight">
                  <span className="hidden sm:block text-[9px] font-black uppercase tracking-wider opacity-70">
                    Step {s.id}
                  </span>
                  <span className="text-[11px] sm:text-xs font-black truncate max-w-[80px] sm:max-w-none block">
                    <span className="sm:hidden">{s.shortTitle}</span>
                    <span className="hidden sm:inline">{s.title}</span>
                  </span>
                </div>

                {s.badge && (
                  <span
                    className={`hidden sm:inline-block text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                      isActive ? 'bg-amber-400 text-slate-950' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {s.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Linear Step Indicator */}
        <div className="w-full bg-slate-100 h-1 rounded-full mt-2.5 overflow-hidden">
          <div
            className="bg-amber-600 h-full transition-all duration-300 rounded-full"
            style={{ width: `${(currentStep / 4) * 100}%` }}
          />
        </div>
      </div>

      {/* 2. STICKY BOTTOM BAR (MOBILE THUMB CONTROLS & DESKTOP STEPPING) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-2xl p-3 sm:p-4 animate-slideUp">
        <div className="max-w-5xl mx-auto flex justify-between items-center gap-3">
          {/* Quick Net Payable Peek */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-black shrink-0">
              <ShoppingBag size={18} />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">
                Live Net Payable
              </span>
              <span className="text-sm sm:text-base font-black text-slate-900 block">
                ₹{netPayableAmount.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-2">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep - 1)}
                className="px-4 py-2.5 sm:py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <ArrowLeft size={15} />
                <span className="hidden sm:inline">Back</span>
              </button>
            )}

            {currentStep < 4 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep + 1)}
                className="px-5 sm:px-6 py-2.5 sm:py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs sm:text-sm font-black uppercase tracking-wider flex items-center gap-2 shadow-md transition-all active:scale-98"
              >
                <span>
                  {currentStep === 1
                    ? 'Jewellery Cart →'
                    : currentStep === 2
                    ? 'Old Gold Scrap →'
                    : 'Payment & Quote →'}
                </span>
                <ArrowRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="px-5 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-2xl text-xs sm:text-sm font-black uppercase tracking-wider flex items-center gap-2 shadow-md"
              >
                <span>Complete Quotation</span>
                <CheckCircle2 size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
