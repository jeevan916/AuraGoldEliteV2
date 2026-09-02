import React from 'react';
import { Delete, ChevronLeft, ChevronRight, X, Check, Sparkles } from 'lucide-react';

export type KeypadTargetField = 
  | 'grossWeight'
  | 'stoneWeight'
  | 'makingCharge'
  | 'makingPercent'
  | 'wastagePercentage'
  | 'customRate'
  | 'stoneCharges'
  | 'otherCharges'
  | 'discountAmount'
  | 'oldGoldGrossWeight'
  | 'oldGoldRate'
  | 'customerContact';

interface IOSKeypadProps {
  activeField: KeypadTargetField | null;
  activeFieldLabel: string;
  currentValue: number | string | '';
  onKeyPress: (key: string) => void;
  onClear: () => void;
  onBackspace: () => void;
  onQuickAdd: (amount: number) => void;
  onNextField?: () => void;
  onPrevField?: () => void;
  onClose?: () => void;
  unit?: string;
}

export const IOSKeypad: React.FC<IOSKeypadProps> = ({
  activeField,
  activeFieldLabel,
  currentValue,
  onKeyPress,
  onClear,
  onBackspace,
  onQuickAdd,
  onNextField,
  onPrevField,
  onClose,
  unit = ''
}) => {
  if (!activeField) return null;

  const isWeightField = activeField === 'grossWeight' || activeField === 'stoneWeight' || activeField === 'oldGoldGrossWeight';
  const isPercentField = activeField === 'makingPercent' || activeField === 'wastagePercentage';
  const isCurrencyField = activeField === 'makingCharge' || activeField === 'customRate' || activeField === 'discountAmount' || activeField === 'oldGoldRate' || activeField === 'stoneCharges' || activeField === 'otherCharges';

  return (
    <div className="bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-3xl shadow-xl p-3 sm:p-4 transition-all animate-fadeIn">
      {/* Top Header / Active Field Indicator */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
            Editing: <strong className="text-slate-900">{activeFieldLabel}</strong>
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Current Live Digits Display */}
          <div className="bg-slate-100/90 px-3 py-1 rounded-xl text-right font-mono font-black text-xs text-slate-900 min-w-[70px]">
            {currentValue !== '' && currentValue !== undefined ? currentValue : '0'} {unit}
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
              title="Close Keypad"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Quick Add Increment Strip */}
      <div className="grid grid-cols-4 gap-1.5 mb-2.5">
        {isWeightField && (
          <>
            <button
              type="button"
              onClick={() => onQuickAdd(0.1)}
              className="py-1.5 px-2 bg-amber-50 hover:bg-amber-100 active:scale-95 text-amber-900 rounded-xl text-[11px] font-bold font-mono transition-all text-center border border-amber-200/60"
            >
              +0.1g
            </button>
            <button
              type="button"
              onClick={() => onQuickAdd(0.5)}
              className="py-1.5 px-2 bg-amber-50 hover:bg-amber-100 active:scale-95 text-amber-900 rounded-xl text-[11px] font-bold font-mono transition-all text-center border border-amber-200/60"
            >
              +0.5g
            </button>
            <button
              type="button"
              onClick={() => onQuickAdd(1.0)}
              className="py-1.5 px-2 bg-amber-50 hover:bg-amber-100 active:scale-95 text-amber-900 rounded-xl text-[11px] font-bold font-mono transition-all text-center border border-amber-200/60"
            >
              +1.0g
            </button>
            <button
              type="button"
              onClick={() => onQuickAdd(5.0)}
              className="py-1.5 px-2 bg-amber-50 hover:bg-amber-100 active:scale-95 text-amber-900 rounded-xl text-[11px] font-bold font-mono transition-all text-center border border-amber-200/60"
            >
              +5.0g
            </button>
          </>
        )}

        {isPercentField && (
          <>
            <button
              type="button"
              onClick={() => onQuickAdd(1)}
              className="py-1.5 px-2 bg-amber-50 hover:bg-amber-100 active:scale-95 text-amber-900 rounded-xl text-[11px] font-bold font-mono transition-all text-center border border-amber-200/60"
            >
              +1%
            </button>
            <button
              type="button"
              onClick={() => onQuickAdd(2)}
              className="py-1.5 px-2 bg-amber-50 hover:bg-amber-100 active:scale-95 text-amber-900 rounded-xl text-[11px] font-bold font-mono transition-all text-center border border-amber-200/60"
            >
              +2%
            </button>
            <button
              type="button"
              onClick={() => onQuickAdd(5)}
              className="py-1.5 px-2 bg-amber-50 hover:bg-amber-100 active:scale-95 text-amber-900 rounded-xl text-[11px] font-bold font-mono transition-all text-center border border-amber-200/60"
            >
              +5%
            </button>
            <button
              type="button"
              onClick={() => onQuickAdd(10)}
              className="py-1.5 px-2 bg-amber-50 hover:bg-amber-100 active:scale-95 text-amber-900 rounded-xl text-[11px] font-bold font-mono transition-all text-center border border-amber-200/60"
            >
              +10%
            </button>
          </>
        )}

        {isCurrencyField && (
          <>
            <button
              type="button"
              onClick={() => onQuickAdd(50)}
              className="py-1.5 px-2 bg-amber-50 hover:bg-amber-100 active:scale-95 text-amber-900 rounded-xl text-[11px] font-bold font-mono transition-all text-center border border-amber-200/60"
            >
              +₹50
            </button>
            <button
              type="button"
              onClick={() => onQuickAdd(100)}
              className="py-1.5 px-2 bg-amber-50 hover:bg-amber-100 active:scale-95 text-amber-900 rounded-xl text-[11px] font-bold font-mono transition-all text-center border border-amber-200/60"
            >
              +₹100
            </button>
            <button
              type="button"
              onClick={() => onQuickAdd(500)}
              className="py-1.5 px-2 bg-amber-50 hover:bg-amber-100 active:scale-95 text-amber-900 rounded-xl text-[11px] font-bold font-mono transition-all text-center border border-amber-200/60"
            >
              +₹500
            </button>
            <button
              type="button"
              onClick={() => onKeyPress('00')}
              className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 rounded-xl text-[11px] font-bold font-mono transition-all text-center"
            >
              00
            </button>
          </>
        )}
      </div>

      {/* iOS Keypad Grid: 3x4 layout */}
      <div className="grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'].map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => onKeyPress(digit)}
            className="h-11 sm:h-12 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 active:scale-96 text-slate-900 font-sans font-bold text-lg rounded-2xl flex items-center justify-center transition-all shadow-2xs"
          >
            {digit}
          </button>
        ))}

        {/* Backspace Button */}
        <button
          type="button"
          onClick={onBackspace}
          className="h-11 sm:h-12 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 active:scale-96 text-rose-700 rounded-2xl flex items-center justify-center transition-all border border-rose-200/60 shadow-2xs"
          title="Backspace"
        >
          <Delete size={18} />
        </button>
      </div>

      {/* Bottom Action Controls: Clear, Prev, Next, Done */}
      <div className="grid grid-cols-4 gap-1.5 mt-2.5 pt-2 border-t border-slate-100">
        <button
          type="button"
          onClick={onClear}
          className="py-2.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-xl text-xs font-bold transition-all text-center"
        >
          Clear
        </button>

        {onPrevField && (
          <button
            type="button"
            onClick={onPrevField}
            className="py-2.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-0.5"
            title="Previous Field"
          >
            <ChevronLeft size={14} />
            <span>Prev</span>
          </button>
        )}

        {onNextField && (
          <button
            type="button"
            onClick={onNextField}
            className="py-2.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-0.5"
            title="Next Field"
          >
            <span>Next</span>
            <ChevronRight size={14} />
          </button>
        )}

        <button
          type="button"
          onClick={onClose}
          className="py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 shadow-sm"
        >
          <Check size={14} />
          <span>Done</span>
        </button>
      </div>
    </div>
  );
};
