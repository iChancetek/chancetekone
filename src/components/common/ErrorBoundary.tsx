'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  onReset?: () => void;
  title?: string;
  description?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback(this.state.error || new Error('Unknown error'), this.handleReset);
      }
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="p-6 rounded-3xl glass-panel border border-amber-500/30 bg-amber-950/20 text-white my-4 shadow-2xl animate-in fade-in duration-300">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="flex-1 space-y-2">
              <h3 className="text-base font-bold text-white">
                {this.props.title || 'Catalog View Temporarily Interrupted'}
              </h3>
              <p className="text-xs text-neutral-300">
                {this.props.description ||
                  'An unexpected rendering issue occurred while displaying the catalog or search results. Your data is completely safe.'}
              </p>
              {this.state.error && (
                <div className="p-3 rounded-xl bg-black/50 border border-white/10 text-[11px] font-mono text-amber-300/80 break-words max-h-28 overflow-y-auto">
                  {this.state.error.message}
                </div>
              )}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={this.handleReset}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-xs flex items-center gap-2 shadow-lg transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset & Reload View</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

