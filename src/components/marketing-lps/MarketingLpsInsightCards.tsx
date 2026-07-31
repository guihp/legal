import { cn } from '@/lib/utils';
import {
  type LpRow,
  type TrafficSource,
  conversionPct,
  daysSince,
  propertyTitle,
  resolveLpStatus,
} from './helpers';

type Props = {
  topPerformers: LpRow[];
  attention: LpRow[];
  traffic: TrafficSource[];
  onVerRelatorio: () => void;
  onAttentionAction: (row: LpRow, action: 'publicar' | 'reativar' | 'divulgar') => void;
};

function attentionMeta(row: LpRow): { reason: string; action: 'publicar' | 'reativar' | 'divulgar'; label: string; dot: string } {
  const status = resolveLpStatus(row);
  const days = daysSince(row.updated_at);
  if (status === 'rascunho') {
    return {
      reason: `rascunho há ${days || 1} dia${days === 1 ? '' : 's'} · sem link no vitrine`,
      action: 'publicar',
      label: 'Publicar',
      dot: 'bg-amber-500',
    };
  }
  if (status === 'despublicada') {
    return {
      reason: `despublicada · ${Number(row.views) || 0} views históricas`,
      action: 'reativar',
      label: 'Reativar',
      dot: 'bg-rose-400',
    };
  }
  return {
    reason: 'publicada · baixa divulgação no vitrine',
    action: 'divulgar',
    label: 'Divulgar',
    dot: 'bg-sky-400',
  };
}

export function MarketingLpsInsightCards({
  topPerformers,
  attention,
  traffic,
  onVerRelatorio,
  onAttentionAction,
}: Props) {
  const maxTraffic = Math.max(1, ...traffic.map((t) => t.views));

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Melhor desempenho */}
      <div className="rounded-2xl border border-border bg-card shadow-sm p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h2 className="text-sm font-semibold text-foreground">LPs com melhor desempenho</h2>
          <button
            type="button"
            onClick={onVerRelatorio}
            className="text-sm font-medium text-emerald-800 hover:text-emerald-700 dark:text-emerald-400"
          >
            Ver relatório
          </button>
        </div>
        {topPerformers.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Sem dados de desempenho ainda.</p>
        ) : (
          <ul className="space-y-3">
            {topPerformers.map((row, i) => {
              const views = Number(row.views) || 0;
              const leads = Number(row.leadsCount) || 0;
              const conv = conversionPct(views, leads);
              return (
                <li key={row.id} className="flex items-center gap-3 min-w-0">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{propertyTitle(row)}</p>
                    <p className="text-xs text-muted-foreground font-mono truncate">/imovel/{row.slug}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold tabular-nums text-foreground">{views}</p>
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      {conv.toString().replace('.', ',')}% conv.
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Precisam de atenção */}
      <div className="rounded-2xl border border-border bg-card shadow-sm p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">Precisam de atenção</h2>
        {attention.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Nenhuma LP precisa de atenção agora.</p>
        ) : (
          <ul className="space-y-3">
            {attention.map((row) => {
              const meta = attentionMeta(row);
              return (
                <li key={row.id} className="flex items-start gap-2.5 min-w-0">
                  <span className={cn('mt-1.5 h-2 w-2 rounded-full shrink-0', meta.dot)} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{propertyTitle(row)}</p>
                    <p className="text-xs text-muted-foreground">{meta.reason}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onAttentionAction(row, meta.action)}
                    className="text-sm font-medium text-emerald-800 hover:text-emerald-700 dark:text-emerald-400 shrink-0"
                  >
                    {meta.label}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Tráfego — dark emerald */}
      <div
        className="rounded-2xl shadow-sm p-4 sm:p-5"
        style={{ backgroundColor: '#14532d' }}
      >
        <h2 className="text-sm font-semibold mb-4" style={{ color: '#ffffff' }}>
          Tráfego das LPs (30 dias)
        </h2>
        <ul className="space-y-3.5">
          {traffic.map((src) => {
            const pct = Math.round((src.views / maxTraffic) * 100);
            return (
              <li key={src.key}>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,0.9)' }}>
                    {src.label}
                  </span>
                  <span className="text-sm font-semibold tabular-nums" style={{ color: '#ffffff' }}>
                    {src.views} views
                  </span>
                </div>
                <div
                  className="h-1.5 rounded-full overflow-hidden"
                  style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
                >
                  <div
                    className={cn('h-full rounded-full', src.barClass)}
                    style={{ width: `${Math.max(src.views > 0 ? 8 : 0, pct)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-5 text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
          Cards do site vitrine só viram link quando a LP do imóvel está publicada.
        </p>
      </div>
    </div>
  );
}
