import type { BrokerRow } from './helpers';

type Props = {
  brokers: BrokerRow[];
  onOpenTeam: () => void;
};

export function DashboardBrokersTable({ brokers, onOpenTeam }: Props) {
  const maxConv = Math.max(...brokers.map((b) => b.conversionPct), 1);

  return (
    <div className="rounded-2xl border border-border/70 bg-white dark:bg-card shadow-sm p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">Desempenho por corretor</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Leads atendidos, visitas e fechamentos no período.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenTeam}
          className="text-sm font-medium text-emerald-800 hover:text-emerald-700 dark:text-emerald-400 shrink-0"
        >
          Ver time completo
        </button>
      </div>

      {brokers.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Nenhum corretor com atividade no período.
        </p>
      ) : (
        <div className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground border-b border-border/60">
                <th className="text-left font-semibold py-2.5 pr-3">Corretor</th>
                <th className="text-right font-semibold py-2.5 px-2">Leads</th>
                <th className="text-right font-semibold py-2.5 px-2">Visitas</th>
                <th className="text-right font-semibold py-2.5 px-2">Fechamentos</th>
                <th className="text-left font-semibold py-2.5 px-2 w-[28%]">Conversão</th>
                <th className="text-right font-semibold py-2.5 pl-2">VGV</th>
              </tr>
            </thead>
            <tbody>
              {brokers.map((b) => {
                const barW = Math.max(4, Math.round((b.conversionPct / maxConv) * 100));
                const barColor =
                  b.conversionPct <= 0
                    ? 'bg-rose-400'
                    : b.conversionPct < 1.5
                      ? 'bg-sky-500'
                      : 'bg-emerald-600';
                return (
                  <tr key={b.id} className="border-b border-border/40 last:border-0">
                    <td className="py-3.5 pr-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${b.avatarClass}`}
                        >
                          {b.initials}
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">{b.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{b.roleLabel}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-2 text-right tabular-nums text-foreground">{b.leads}</td>
                    <td className="py-3.5 px-2 text-right tabular-nums text-foreground">{b.visitas}</td>
                    <td className="py-3.5 px-2 text-right tabular-nums text-foreground">{b.fechamentos}</td>
                    <td className="py-3.5 px-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden min-w-[48px]">
                          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${barW}%` }} />
                        </div>
                        <span className="tabular-nums text-xs text-muted-foreground w-10 text-right">
                          {b.conversionPct.toLocaleString('pt-BR')}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 pl-2 text-right tabular-nums font-medium text-foreground whitespace-nowrap">
                      {b.vgvLabel}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
