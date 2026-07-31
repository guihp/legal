type FunnelStage = {
  key: string;
  label: string;
  count: number;
  conversionPct: number | null;
  barClass: string;
  barWidth: number;
};

type Props = {
  stages: FunnelStage[];
  conversionTotalPct: number;
  cycleDays: number | null;
  unassigned: number;
  onOpenPipeline: () => void;
};

export function DashboardFunnelCard({
  stages,
  conversionTotalPct,
  cycleDays,
  unassigned,
  onOpenPipeline,
}: Props) {
  return (
    <div className="rounded-2xl border border-border/70 bg-white dark:bg-card shadow-sm p-4 sm:p-5 h-full flex flex-col">
      <div className="flex items-baseline justify-between gap-2 mb-4">
        <h3 className="text-sm font-semibold text-foreground">Funil do período</h3>
        <button
          type="button"
          onClick={onOpenPipeline}
          className="text-sm font-medium text-emerald-800 hover:text-emerald-700 dark:text-emerald-400"
        >
          Abrir pipeline
        </button>
      </div>

      <ul className="space-y-3 flex-1">
        {stages.map((s) => (
          <li key={s.key} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-foreground truncate">{s.label}</span>
              <span className="tabular-nums shrink-0 flex items-center gap-2">
                <span className="font-semibold text-foreground">{s.count}</span>
                {s.conversionPct != null ? (
                  <span className="text-xs text-muted-foreground">{s.conversionPct}%</span>
                ) : null}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted/70 overflow-hidden">
              <div
                className={`h-full rounded-full ${s.barClass}`}
                style={{ width: `${s.barWidth}%` }}
              />
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-5 pt-4 border-t border-border/60 grid grid-cols-3 gap-2">
        <div>
          <p className="text-base font-semibold tabular-nums text-foreground">
            {conversionTotalPct.toLocaleString('pt-BR')}%
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mt-0.5">
            Conversão total
          </p>
        </div>
        <div>
          <p className="text-base font-semibold tabular-nums text-foreground">
            {cycleDays != null ? `${cycleDays} d` : '—'}
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mt-0.5">
            Ciclo médio
          </p>
        </div>
        <div>
          <p className="text-base font-semibold tabular-nums text-foreground">{unassigned}</p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mt-0.5">
            Leads sem corretor
          </p>
        </div>
      </div>
    </div>
  );
}
