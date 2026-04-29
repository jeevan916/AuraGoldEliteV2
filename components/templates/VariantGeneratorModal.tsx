import React, { useState } from 'react';
import { X, Loader2, Sparkles } from 'lucide-react';

interface VariantGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  trigger: any;
  onGenerate: (goal: string) => void;
  isGenerating: boolean;
}

export const VariantGeneratorModal: React.FC<VariantGeneratorModalProps> = ({ 
  isOpen, onClose, trigger, onGenerate, isGenerating 
}) => {
  const [goal, setGoal] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Sparkles className="text-amber-500" /> Generate Variant: {trigger.label}
          </h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <textarea 
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="E.g., Make this message more urgent and focus on the deadline..."
          className="w-full p-3 border border-slate-200 rounded-xl text-sm mb-4 h-32"
        />
        <button 
          onClick={() => onGenerate(goal)}
          disabled={isGenerating || !goal}
          className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isGenerating ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
          Generate Variant
        </button>
      </div>
    </div>
  );
};