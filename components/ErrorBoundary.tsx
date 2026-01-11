import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReset = () => {
      if(confirm("This will clear all local data (Orders, Customers, Settings) to fix the crash. Are you sure?")) {
          localStorage.clear();
          window.location.reload();
      }
  }

  private handleReload = () => {
      window.location.reload();
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-rose-100">
            <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle size={40} />
            </div>
            <h1 className="text-2xl font-black text-slate-800 mb-2">App Failed to Launch</h1>
            <p className="text-slate-500 mb-6 text-sm">
              Critical startup error detected. This is usually caused by corrupted local data.
            </p>
            
            <div className="bg-slate-50 p-4 rounded-xl text-xs font-mono text-left mb-6 text-slate-600 border border-slate-200 overflow-auto max-h-32 shadow-inner">
                {this.state.error?.message || "Unknown Error"}
            </div>

            <div className="space-y-3">
                <button 
                    onClick={this.handleReload}
                    className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all"
                >
                    <RefreshCcw size={16} /> Try Reloading
                </button>
                <button 
                    onClick={this.handleReset}
                    className="w-full bg-rose-50 text-rose-600 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-rose-100 transition-all border border-rose-100"
                >
                    <Trash2 size={16} /> Reset App Data
                </button>
            </div>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}