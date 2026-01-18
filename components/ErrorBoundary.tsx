
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, Trash2, CloudOff } from 'lucide-react';

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
      // Force reload ignoring cache
      window.location.href = window.location.href;
  }

  public render() {
    if (this.state.hasError) {
      const isChunkError = this.state.error?.message?.includes("Loading chunk") || 
                           this.state.error?.message?.includes("dynamically imported module");

      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-slate-100">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${isChunkError ? 'bg-amber-50 text-amber-500' : 'bg-rose-50 text-rose-500'}`}>
              {isChunkError ? <CloudOff size={40} /> : <AlertTriangle size={40} />}
            </div>
            
            <h1 className="text-2xl font-black text-slate-800 mb-2">
                {isChunkError ? "Update Available" : "App Encountered an Issue"}
            </h1>
            
            <p className="text-slate-500 mb-6 text-sm leading-relaxed">
              {isChunkError 
                ? "A new version of AuraGold has been deployed. Please reload to get the latest features." 
                : "Critical startup error detected. This is usually caused by corrupted local data."}
            </p>
            
            {!isChunkError && (
                <div className="bg-slate-50 p-4 rounded-xl text-xs font-mono text-left mb-6 text-slate-600 border border-slate-200 overflow-auto max-h-32 shadow-inner">
                    {this.state.error?.message || "Unknown Error"}
                </div>
            )}

            <div className="space-y-3">
                <button 
                    onClick={this.handleReload}
                    className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-lg"
                >
                    <RefreshCcw size={16} /> {isChunkError ? "Update & Reload" : "Try Reloading"}
                </button>
                
                {!isChunkError && (
                    <button 
                        onClick={this.handleReset}
                        className="w-full bg-rose-50 text-rose-600 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-rose-100 transition-all border border-rose-100"
                    >
                        <Trash2 size={16} /> Reset App Data
                    </button>
                )}
            </div>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
