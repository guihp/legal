import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // No console noise in production bundles; useful in dev
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary capturou um erro:', error, errorInfo);
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center p-6 text-white">
          <div className="max-w-md w-full bg-gray-900/80 border border-gray-700 rounded-xl p-6 text-center">
            <h1 className="text-xl font-semibold mb-2">Ocorreu um erro inesperado</h1>
            <p className="text-gray-300 mb-4">Tente recarregar a página. Se o problema persistir, verifique o console do navegador.</p>
            {import.meta.env.DEV && this.state.error && (
              <div className="text-left bg-red-900/20 border border-red-800 rounded-lg p-3 text-red-200 text-sm mb-4 overflow-auto max-h-48">
                <div className="font-mono whitespace-pre-wrap">
                  {this.state.error.message}
                </div>
              </div>
            )}
            <button
              onClick={this.handleReload}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              Recarregar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}


