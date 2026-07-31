import { Copy, ExternalLink, MoreHorizontal, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  type LpRow,
  type LpStatus,
  categoryBadge,
  formatLpUpdatedAt,
  listingCode,
  performanceBarPct,
  propertyAddress,
  propertyTitle,
  resolveLpStatus,
  statusLabel,
  thumbUrl,
} from './helpers';

type Props = {
  rows: LpRow[];
  totalCount: number;
  loading?: boolean;
  maxViews: number;
  onOpen: (row: LpRow) => void;
  onCopy: (row: LpRow) => void;
  onGoProperties: () => void;
  /** When true, skip outer card chrome (parent already provides it). */
  embedded?: boolean;
};

function StatusPill({ status }: { status: LpStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        status === 'publicada' && 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
        status === 'rascunho' && 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
        status === 'despublicada' && 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300',
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          status === 'publicada' && 'bg-emerald-600',
          status === 'rascunho' && 'bg-amber-500',
          status === 'despublicada' && 'bg-rose-500',
        )}
        aria-hidden
      />
      {statusLabel(status)}
    </span>
  );
}

function Thumb({ row }: { row: LpRow }) {
  const src = thumbUrl(row);
  return (
    <div className="h-11 w-11 shrink-0 rounded-lg overflow-hidden bg-muted border border-border/60">
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div
          className="h-full w-full flex items-center justify-center"
          style={{
            backgroundImage:
              'repeating-linear-gradient(135deg, #e7e5e0 0 6px, #f3f1ec 6px 12px)',
          }}
        >
          <Building2 className="h-4 w-4 text-muted-foreground/70" />
        </div>
      )}
    </div>
  );
}

export function MarketingLpsTable({
  rows,
  totalCount,
  loading,
  maxViews,
  onOpen,
  onCopy,
  onGoProperties,
  embedded,
}: Props) {
  const shell = embedded
    ? 'overflow-hidden'
    : 'rounded-2xl border border-border bg-card shadow-sm overflow-hidden';

  if (loading) {
    return (
      <div className={cn(shell, 'py-16 text-center text-muted-foreground')}>
        Carregando…
      </div>
    );
  }

  if (rows.length === 0 && totalCount === 0) {
    return (
      <div className={cn(shell, 'py-16 px-6 text-center text-muted-foreground')}>
        Nenhuma landing page cadastrada ainda. Publique uma LP a partir do card do imóvel em Propriedades.
      </div>
    );
  }

  return (
    <div className={shell}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-border/70">
              {['Imóvel', 'Slug (URL)', 'Status', 'Desempenho', 'Atualização', 'Ações'].map((h) => (
                <th
                  key={h}
                  className={cn(
                    'px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground text-left',
                    h === 'Ações' && 'text-right',
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  Nenhuma LP neste filtro.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const status = resolveLpStatus(r);
                const badge = categoryBadge(r.imoveisvivareal?.tipo_imovel, r.imoveisvivareal?.tipo_categoria);
                const views = Number(r.views) || 0;
                const leads = Number(r.leadsCount) || 0;
                const bar = performanceBarPct(views, maxViews);
                return (
                  <tr key={r.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <Thumb row={r} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-foreground truncate max-w-[14rem]">
                              {propertyTitle(r)}
                            </span>
                            <span
                              className={cn(
                                'inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase',
                                badge.className,
                              )}
                            >
                              {badge.label}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate max-w-[18rem] mt-0.5">
                            {propertyAddress(r)}
                          </p>
                          <p className="text-[11px] text-muted-foreground/80 mt-0.5 tabular-nums">
                            {listingCode(r)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[13px] text-emerald-700 dark:text-emerald-400">
                        /imovel/{r.slug}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={status} />
                    </td>
                    <td className="px-4 py-3 min-w-[9rem]">
                      <p className="text-sm text-foreground tabular-nums">
                        {views} views · {leads} leads
                      </p>
                      <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden max-w-[8rem]">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            status === 'publicada' ? 'bg-emerald-600' : 'bg-muted-foreground/40',
                          )}
                          style={{ width: `${bar}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-foreground tabular-nums">{formatLpUpdatedAt(r.updated_at)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">—</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                          onClick={() => onOpen(r)}
                          title="Abrir LP"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                          onClick={() => onCopy(r)}
                          title="Copiar link"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl">
                            <DropdownMenuItem onClick={() => onOpen(r)}>Abrir landing page</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onCopy(r)}>Copiar URL</DropdownMenuItem>
                            <DropdownMenuItem onClick={onGoProperties}>Editar em Propriedades</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-t border-border/60 bg-[#F7F5F0]/60 dark:bg-muted/20">
        <p className="text-xs text-muted-foreground">
          Exibindo {rows.length} de {totalCount} landing pages
        </p>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> Publicada
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Rascunho
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Despublicada
          </span>
        </div>
      </div>
    </div>
  );
}
