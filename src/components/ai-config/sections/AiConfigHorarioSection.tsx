import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { DaySchedule } from '@/lib/businessHours';
import { cn } from '@/lib/utils';
import { applyHoursToAll, dayRangeLabel, openDaysCount, SECTION_NAV } from '../helpers';
import type { AiConfigFormState } from '../constants';

type Props = {
  form: AiConfigFormState;
  isManager: boolean;
  onChange: (patch: Partial<AiConfigFormState>) => void;
  onChangeDay: (dayKey: string, patch: Partial<DaySchedule>) => void;
};

export function AiConfigHorarioSection({ form, isManager, onChange, onChangeDay }: Props) {
  const meta = SECTION_NAV.find((s) => s.id === 'horario')!;
  const Icon = meta.Icon;
  const openDays = openDaysCount(form.businessHoursSchedule);

  const applyAll = () => {
    if (!isManager) return;
    onChange({ businessHoursSchedule: applyHoursToAll(form.businessHoursSchedule) });
  };

  return (
    <div className="rounded-2xl border border-border/70 bg-white dark:bg-card p-4 sm:p-5 shadow-sm space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <span
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
              meta.iconBg,
            )}
          >
            <Icon className={cn('h-4 w-4', meta.iconClass)} />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">{meta.label}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {openDays} dia{openDays === 1 ? '' : 's'} aberto
              {openDays === 1 ? '' : 's'} · fora do horário a IA informa retorno humano
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={!isManager}
          onClick={applyAll}
          className="text-sm font-medium text-emerald-800 hover:underline disabled:opacity-50 dark:text-emerald-400 shrink-0 self-start sm:self-center"
        >
          Aplicar 09:00–18:00 em todos
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/70">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="bg-[#F7F5F0]/90 dark:bg-muted/40 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              <th className="text-left font-semibold px-3 py-2.5">Dia</th>
              <th className="text-left font-semibold px-2 py-2.5">Abre</th>
              <th className="text-left font-semibold px-2 py-2.5">Almoço início</th>
              <th className="text-left font-semibold px-2 py-2.5">Almoço fim</th>
              <th className="text-left font-semibold px-2 py-2.5">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {form.businessHoursSchedule.map((day) => {
              const closed = day.closed;
              return (
                <tr
                  key={day.dayKey}
                  className={cn(
                    'border-t border-border/60',
                    closed && 'opacity-55',
                  )}
                >
                  <td className="px-3 py-2.5 align-middle">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={!closed}
                        disabled={!isManager}
                        onCheckedChange={(checked) =>
                          onChangeDay(day.dayKey, {
                            closed: checked !== true,
                            ...(checked === true && !day.openTime
                              ? {
                                  openTime: '09:00',
                                  lunchStart: '12:00',
                                  lunchEnd: '13:00',
                                  closeTime: '18:00',
                                }
                              : {}),
                          })
                        }
                        id={`open-${day.dayKey}`}
                      />
                      <div className="min-w-0">
                        <Label
                          htmlFor={`open-${day.dayKey}`}
                          className="text-sm font-medium text-foreground mb-0 cursor-pointer"
                        >
                          {day.label}
                        </Label>
                        <p className="text-[11px] text-muted-foreground">
                          {day.label} {dayRangeLabel(day)}
                        </p>
                      </div>
                    </div>
                  </td>
                  {(
                    [
                      ['openTime', day.openTime],
                      ['lunchStart', day.lunchStart],
                      ['lunchEnd', day.lunchEnd],
                      ['closeTime', day.closeTime],
                    ] as const
                  ).map(([key, value]) => (
                    <td key={key} className="px-2 py-2 align-middle">
                      <Input
                        type="time"
                        value={closed ? '' : value}
                        disabled={!isManager || closed}
                        onChange={(e) => onChangeDay(day.dayKey, { [key]: e.target.value })}
                        className="h-9 rounded-lg bg-white dark:bg-background border-border/80 shadow-sm text-sm"
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Fora do horário a assistente segue respondendo, mas informa o prazo de retorno humano.
      </p>

      {!isManager && (
        <p className="text-sm text-muted-foreground italic">
          Apenas administradores e gestores podem editar estas configurações.
        </p>
      )}
    </div>
  );
}
