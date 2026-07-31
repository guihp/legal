import React from 'react';
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary capturou um erro:', error, errorInfo);
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.assign('/');
  };

  render() {
    if (this.state.hasError) {
      const detail = this.state.error?.message?.trim();

      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[#F7F5F0] dark:bg-background text-foreground">
          <div className="max-w-md w-full rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-6 w-6" aria-hidden />
            </div>

            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Algo deu errado
            </h1>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Não foi possível carregar esta tela. Tente recarregar a página. Se o problema
              continuar, volte e tente novamente em instantes.
            </p>

            {detail ? (
              <div
                role="alert"
                className="mt-5 rounded-xl border border-border bg-muted/60 dark:bg-muted/40 px-3.5 py-3 text-left"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground mb-1.5">
                  Detalhe técnico
                </p>
                <pre className="font-mono text-xs leading-relaxed text-foreground whitespace-pre-wrap break-words max-h-40 overflow-auto">
                  {detail}
                </pre>
              </div>
            ) : null}

            <div className="mt-6 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-center gap-2.5">
              <Button type="button" variant="outline" onClick={this.handleBack} className="rounded-xl">
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>
              <Button type="button" onClick={this.handleReload} className="rounded-xl">
                <RefreshCw className="h-4 w-4" />
                Recarregar
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
