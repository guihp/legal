import type { PortfolioSlice, TypeSlice } from './helpers';

type Props = {
  total: number;
  slices: PortfolioSlice[];
  types: TypeSlice[];
};

export function DashboardPortfolioCard({ total, slices, types }: Props) {
  const maxCount = Math.max(...slices.map((s) => s.count), 1);

  return (
    <div className="rounded-2xl border border-border/70 bg-white dark:bg-card shadow-sm p-4 sm:p-5 h-full flex flex-col">
      <div className="flex items-baseline justify-between gap-2 mb-4">
        <h3 className="text-sm font-semibold text-foreground">Portfólio por situação</h3>
        <span className="text-xs text-muted-foreground tabular-nums">{total} imóveis</span>
      </div>

      <ul className="space-y-3.5 flex-1">
        {slices.map((s) => (
          <li key={s.key} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="inline-flex items-center gap-2 text-foreground min-w-0">
                <span className={`h-2 w-2 rounded-full shrink-0 ${s.dotClass}`} aria-hidden />
                <span className="truncate">{s.label}</span>
              </span>
              <span className="tabular-nums text-muted-foreground shrink-0">
                {s.count}{' '}
                <span className="text-foreground/70 font-medium">{s.pct}%</span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${s.barClass}`}
                style={{ width: `${Math.max(2, Math.round((s.count / maxCount) * 100))}%` }}
              />
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-5 pt-4 border-t border-border/60 space-y-2">
        {types.map((t) => (
          <div key={t.label} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t.label}</span>
            <span className="tabular-nums font-medium text-foreground">{t.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
