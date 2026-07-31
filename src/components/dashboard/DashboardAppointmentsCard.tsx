import type { AppointmentRow } from './helpers';

type Props = {
  items: AppointmentRow[];
  onOpenAgenda: () => void;
};

export function DashboardAppointmentsCard({ items, onOpenAgenda }: Props) {
  return (
    <div className="rounded-2xl border border-border/70 bg-white dark:bg-card shadow-sm p-4 sm:p-5 h-full flex flex-col">
      <div className="flex items-baseline justify-between gap-2 mb-4">
        <h3 className="text-sm font-semibold text-foreground">Próximos compromissos</h3>
        <button
          type="button"
          onClick={onOpenAgenda}
          className="text-sm font-medium text-emerald-800 hover:text-emerald-700 dark:text-emerald-400"
        >
          Ver agenda
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center flex-1">
          Nenhum compromisso nos próximos dias.
        </p>
      ) : (
        <ul className="space-y-3 flex-1">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-border/60 bg-[#F7F5F0]/60 dark:bg-muted/20 px-3.5 py-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground tabular-nums">
                    {item.timeLabel}{' '}
                    <span className="opacity-70">{item.dayLabel}</span>
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground truncate">{item.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground truncate">{item.detail}</p>
                </div>
                <span
                  className={
                    item.status === 'confirmada'
                      ? 'shrink-0 text-[10px] font-semibold uppercase tracking-wide rounded-md px-2 py-1 bg-emerald-100 text-emerald-800'
                      : item.status === 'a_confirmar'
                        ? 'shrink-0 text-[10px] font-semibold uppercase tracking-wide rounded-md px-2 py-1 bg-amber-100 text-amber-900'
                        : 'shrink-0 text-[10px] font-semibold uppercase tracking-wide rounded-md px-2 py-1 bg-muted text-muted-foreground'
                  }
                >
                  {item.statusLabel}
                </span>
              </div>
              {item.canConfirm ? (
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={onOpenAgenda}
                    className="text-sm font-medium text-emerald-800 hover:text-emerald-700"
                  >
                    Confirmar
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
