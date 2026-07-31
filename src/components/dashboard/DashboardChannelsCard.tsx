import type { ChannelRow } from './helpers';

type Props = {
  total: number;
  rows: ChannelRow[];
  monthly: { label: string; value: number }[];
};

export function DashboardChannelsCard({ total, rows, monthly }: Props) {
  const maxCount = Math.max(...rows.map((r) => r.count), 1);
  const maxMonth = Math.max(...monthly.map((m) => m.value), 1);

  return (
    <div className="rounded-2xl border border-border/70 bg-white dark:bg-card shadow-sm p-4 sm:p-5 h-full flex flex-col">
      <div className="flex items-baseline justify-between gap-2 mb-4">
        <h3 className="text-sm font-semibold text-foreground">Entrada de leads por canal</h3>
        <span className="text-xs text-muted-foreground tabular-nums">{total} leads no período</span>
      </div>

      <ul className="space-y-3 flex-1">
        {rows.length === 0 ? (
          <li className="text-sm text-muted-foreground py-6 text-center">Sem leads no período</li>
        ) : (
          rows.map((r) => (
            <li key={r.key} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-foreground truncate">{r.label}</span>
                <span className="tabular-nums shrink-0 flex items-center gap-2">
                  <span className="font-medium text-foreground">{r.count}</span>
                  {r.deltaPct != null ? (
                    <span
                      className={
                        r.deltaPct > 0
                          ? 'text-emerald-700 text-xs'
                          : r.deltaPct < 0
                            ? 'text-rose-600 text-xs'
                            : 'text-muted-foreground text-xs'
                      }
                    >
                      {r.deltaPct > 0 ? '+' : ''}
                      {r.deltaPct}%
                    </span>
                  ) : null}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full ${r.barClass}`}
                  style={{ width: `${Math.max(3, Math.round((r.count / maxCount) * 100))}%` }}
                />
              </div>
            </li>
          ))
        )}
      </ul>

      <div className="mt-5 pt-3 border-t border-border/50">
        <div className="flex items-end gap-1 h-12">
          {monthly.map((m) => (
            <div key={m.label} className="flex-1 flex flex-col items-center gap-1 min-w-0">
              <div
                className="w-full rounded-sm bg-emerald-600/70"
                style={{ height: `${Math.max(4, Math.round((m.value / maxMonth) * 100))}%` }}
                title={`${m.label}: ${m.value}`}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-1 mt-1">
          {monthly.map((m) => (
            <span key={m.label} className="flex-1 text-center text-[9px] text-muted-foreground truncate">
              {m.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
