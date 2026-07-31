import { Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { truncateSessionId } from './helpers';

type Props = {
  aiEnabled: boolean;
  instancia: string;
  sessionId: string;
  onCopySession: () => void;
};

export function AiTestStatusBar({
  aiEnabled,
  instancia,
  sessionId,
  onCopySession,
}: Props) {
  return (
    <div className="rounded-xl border border-border/70 bg-white/80 dark:bg-card/80 px-3 py-2.5 sm:px-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 min-w-0 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 text-foreground">
          <span
            className={cn(
              'h-2 w-2 rounded-full shrink-0',
              aiEnabled ? 'bg-emerald-500' : 'bg-amber-500',
            )}
            aria-hidden
          />
          <span className="font-medium">
            {aiEnabled ? 'IA ativa em produção' : 'IA desativada em produção'}
          </span>
        </span>

        <span className="hidden sm:inline text-border">·</span>

        <span className="min-w-0">
          Instância{' '}
          <code className="rounded bg-muted/70 px-1.5 py-0.5 text-[12px] font-mono text-foreground">
            {instancia || '—'}
          </code>
        </span>

        <span className="hidden sm:inline text-border">·</span>

        <span className="inline-flex items-center gap-1.5 min-w-0">
          <span>
            Sessão{' '}
            <code className="rounded bg-muted/70 px-1.5 py-0.5 text-[12px] font-mono text-foreground">
              {truncateSessionId(sessionId)}
            </code>
          </span>
          {sessionId ? (
            <button
              type="button"
              onClick={onCopySession}
              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800 hover:underline dark:text-emerald-400"
            >
              <Copy className="h-3 w-3" />
              copiar
            </button>
          ) : null}
        </span>
      </div>
    </div>
  );
}
