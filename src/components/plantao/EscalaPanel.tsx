import { useMemo, useState } from 'react';
import { Copy, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { TimePicker } from './TimePicker';
import {
  DIAS_SEMANA,
  type EscalaConfig,
  computeDayHours,
  computeWeeklyStats,
  formatHoursPt,
  getDayMapFromSlots,
} from './helpers';

export type ScheduleItem = {
  id: string;
  name: string;
};

type Props = {
  schedules: ScheduleItem[];
  selectedCalendarId: string;
  onSelectCalendar: (id: string) => void;
  cfg: EscalaConfig;
  canEdit: boolean;
  isDirty: boolean;
  isSaving: boolean;
  isManager: boolean;
  onToggleDay: (dia: string, works: boolean) => void;
  onSetDayTime: (dia: string, field: 'inicio' | 'fim', value: string) => void;
  onSave: () => void;
  onCopyFrom: (sourceCalendarId: string) => void;
  onApplyDefaultAll: () => void;
  onDisableWeekend: () => void;
  onOpenConfigure: () => void;
};

function DayHoursBar({ hours, active }: { hours: number; active: boolean }) {
  const maxHours = 12;
  const pct = active ? Math.min(100, (hours / maxHours) * 100) : 0;
  const isShort = active && hours > 0 && hours < 8;

  return (
    <div className="mt-3 flex items-center gap-2">
      <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            !active && 'w-0',
            active && (isShort ? 'bg-amber-400' : 'bg-emerald-600'),
          )}
          style={{ width: active ? `${pct}%` : '0%' }}
        />
      </div>
      {active ? (
        <span className="text-xs tabular-nums text-muted-foreground shrink-0">
          {formatHoursPt(hours)} h
        </span>
      ) : (
        <span className="text-xs tabular-nums text-muted-foreground/50 shrink-0">0 h</span>
      )}
    </div>
  );
}

export function EscalaPanel({
  schedules,
  selectedCalendarId,
  onSelectCalendar,
  cfg,
  canEdit,
  isDirty,
  isSaving,
  isManager,
  onToggleDay,
  onSetDayTime,
  onSave,
  onCopyFrom,
  onApplyDefaultAll,
  onDisableWeekend,
  onOpenConfigure,
}: Props) {
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [copySourceId, setCopySourceId] = useState('');

  const dayMap = useMemo(() => getDayMapFromSlots(cfg.slots), [cfg.slots]);
  const { totalHours, daysCount } = useMemo(() => computeWeeklyStats(cfg.slots), [cfg.slots]);

  const ownerName = cfg.assignedUserName || 'Não vinculado';
  const otherSchedules = schedules.filter((s) => s.id !== selectedCalendarId);

  if (schedules.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card shadow-sm p-6">
        <p className="text-sm text-muted-foreground">Nenhuma agenda encontrada para configurar escala.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="border-b border-border/70 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2 flex-1">
            <Select value={selectedCalendarId} onValueChange={onSelectCalendar}>
              <SelectTrigger className="rounded-xl bg-background border-border max-w-full h-10 font-medium">
                <SelectValue placeholder="Selecione um calendário" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {schedules.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!isManager}
                onClick={() => {
                  if (isManager) onOpenConfigure();
                }}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground',
                  isManager && 'hover:bg-muted/70 cursor-pointer',
                  !isManager && 'cursor-default',
                )}
                title={isManager ? 'Configurar responsável' : undefined}
              >
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                {ownerName}
              </button>
              <span className="text-sm text-muted-foreground">
                {daysCount} dia{daysCount !== 1 ? 's' : ''} · {formatHoursPt(totalHours)} h por semana
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!isDirty ? (
              <Badge
                variant="outline"
                className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
              >
                Escala salva
              </Badge>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl border-border bg-card shadow-sm h-9"
              disabled={!canEdit || otherSchedules.length === 0}
              onClick={() => {
                setCopySourceId(otherSchedules[0]?.id || '');
                setCopyDialogOpen(true);
              }}
            >
              <Copy className="mr-1.5 h-4 w-4" />
              Copiar de outro
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!canEdit || isSaving}
              onClick={onSave}
              className="btn-on-emerald rounded-xl h-9 bg-emerald-800 text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 shadow-sm"
              style={{ color: '#ffffff' }}
            >
              {isSaving ? 'Salvando…' : 'Salvar escala'}
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {DIAS_SEMANA.map((d) => {
          const info = dayMap[d];
          const active = !!info?.works;
          const inicio = (info?.start as string) || '09:00';
          const fim = (info?.end as string) || '18:00';
          const dayHours = active ? computeDayHours(inicio, fim) : 0;

          return (
            <div
              key={d}
              className={cn(
                'rounded-xl border border-border bg-card p-3 transition-colors shadow-sm',
                !active && 'opacity-80',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">{d}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">Trabalha</span>
                  <Switch
                    checked={active}
                    disabled={!canEdit}
                    onCheckedChange={(v) => onToggleDay(d, v)}
                    className="data-[state=checked]:bg-emerald-700 data-[state=unchecked]:bg-input"
                  />
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Início
                  </label>
                  <TimePicker
                    value={inicio}
                    disabled={!canEdit || !active}
                    onChange={(val) => onSetDayTime(d, 'inicio', val)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Fim
                  </label>
                  <TimePicker
                    value={fim}
                    disabled={!canEdit || !active}
                    onChange={(val) => onSetDayTime(d, 'fim', val)}
                  />
                </div>
              </div>

              <DayHoursBar hours={dayHours} active={active} />
            </div>
          );
        })}
      </div>

      <div className="border-t border-border/70 px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between bg-[#F3F0E8]/60 dark:bg-muted/20">
        <p className="text-sm text-foreground">
          <span className="font-medium">Total semanal</span>{' '}
          <span className="text-muted-foreground">
            {formatHoursPt(totalHours)} h · {daysCount} dia{daysCount !== 1 ? 's' : ''} de plantão
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canEdit}
            className="rounded-xl border-border bg-card shadow-sm text-xs sm:text-sm h-9"
            onClick={onApplyDefaultAll}
          >
            Aplicar 09:00–18:00 em todos
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canEdit}
            className="rounded-xl border-border bg-card shadow-sm text-xs sm:text-sm h-9"
            onClick={onDisableWeekend}
          >
            Desligar fim de semana
          </Button>
        </div>
      </div>

      <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
        <DialogContent className="rounded-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle>Copiar escala de outro calendário</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={copySourceId} onValueChange={setCopySourceId}>
              <SelectTrigger className="rounded-xl bg-background border-border">
                <SelectValue placeholder="Selecione a origem" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {otherSchedules.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setCopyDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={!copySourceId}
                className="btn-on-emerald rounded-xl bg-emerald-800 text-white hover:bg-emerald-700"
                style={{ color: '#ffffff' }}
                onClick={() => {
                  onCopyFrom(copySourceId);
                  setCopyDialogOpen(false);
                }}
              >
                Copiar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
