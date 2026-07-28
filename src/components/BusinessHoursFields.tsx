import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { DaySchedule } from '@/lib/businessHours';

type BusinessHoursFieldsProps = {
  schedule: DaySchedule[];
  onChangeDay: (dayKey: string, patch: Partial<DaySchedule>) => void;
  disabled?: boolean;
};

export function BusinessHoursFields({ schedule, onChangeDay, disabled }: BusinessHoursFieldsProps) {
  return (
    <div className="space-y-3 rounded-md border border-border bg-muted/40 p-3">
      {schedule.map((day) => (
        <div key={day.dayKey} className="rounded-md border border-border bg-background p-3">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-medium text-foreground">{day.label}</p>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={day.closed}
                onCheckedChange={(checked) => onChangeDay(day.dayKey, { closed: checked === true })}
                disabled={disabled}
                id={`closed-${day.dayKey}`}
              />
              <Label htmlFor={`closed-${day.dayKey}`} className="text-sm text-muted-foreground">
                Fechado neste dia
              </Label>
            </div>
          </div>

          {!day.closed && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Abre as</Label>
                <Input
                  type="time"
                  value={day.openTime}
                  onChange={(e) => onChangeDay(day.dayKey, { openTime: e.target.value })}
                  disabled={disabled}
                  className="bg-background border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Fecha para almoco</Label>
                <Input
                  type="time"
                  value={day.lunchStart}
                  onChange={(e) => onChangeDay(day.dayKey, { lunchStart: e.target.value })}
                  disabled={disabled}
                  className="bg-background border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Reabre apos almoco</Label>
                <Input
                  type="time"
                  value={day.lunchEnd}
                  onChange={(e) => onChangeDay(day.dayKey, { lunchEnd: e.target.value })}
                  disabled={disabled}
                  className="bg-background border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Fecha as</Label>
                <Input
                  type="time"
                  value={day.closeTime}
                  onChange={(e) => onChangeDay(day.dayKey, { closeTime: e.target.value })}
                  disabled={disabled}
                  className="bg-background border-border text-foreground"
                />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
