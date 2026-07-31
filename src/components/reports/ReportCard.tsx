import { Download, Eye, MoreHorizontal, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { ReportCardModel } from './helpers';

type Props = {
  card: ReportCardModel;
  exporting?: boolean;
  onExport: () => void;
  onPreview: () => void;
};

export function ReportCard({ card, exporting, onExport, onPreview }: Props) {
  const Icon = card.icon;

  return (
    <div className="rounded-2xl border border-border/70 bg-white dark:bg-card shadow-sm p-4 sm:p-5 flex flex-col min-w-0">
      <div className="flex items-start gap-3 min-w-0">
        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
            card.iconBg,
            card.iconColor,
          )}
        >
          <Icon className="h-5 w-5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-foreground truncate">{card.title}</h3>
            {card.badge === 'GESTOR' ? (
              <span className="inline-flex items-center rounded-full bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                Gestor
              </span>
            ) : null}
            {card.badge === 'ADMIN' ? (
              <span className="inline-flex items-center rounded-full bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                Admin
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">{card.description}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {card.metrics.map((m) => (
          <div
            key={m.label}
            className="rounded-xl bg-muted/50 dark:bg-muted/30 px-2.5 py-2.5 text-center min-w-0"
          >
            <p className="text-sm sm:text-base font-semibold tabular-nums text-foreground truncate">
              {m.value}
            </p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground truncate">
              {m.label}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full shrink-0',
            card.updatedTone === 'fresh' ? 'bg-emerald-500' : 'bg-amber-400',
          )}
          aria-hidden
        />
        <span className="truncate">
          {card.updatedLabel} · {card.pages} páginas
        </span>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={onExport}
          disabled={exporting}
          className="btn-on-emerald flex-1 rounded-xl h-9 bg-emerald-800 text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 shadow-sm"
          style={{ color: '#ffffff' }}
        >
          {exporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Exportar PDF
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onPreview}
          className="flex-1 rounded-xl h-9 border-border bg-card shadow-sm"
        >
          <Eye className="mr-2 h-4 w-4" />
          Pré-visualizar
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="rounded-xl h-9 w-9 border-border bg-card shadow-sm shrink-0"
              aria-label="Mais ações"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-xl">
            <DropdownMenuItem onClick={onExport}>Baixar novamente</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
