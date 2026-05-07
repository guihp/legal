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
    <div className="space-y-3 rounded-md border border-gray-700 bg-gray-900/30 p-3">
      {schedule.map((day) => (
        <div key={day.dayKey} className="rounded-md border border-gray-700 p-3">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-medium text-gray-200">{day.label}</p>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={day.closed}
                onCheckedChange={(checked) => onChangeDay(day.dayKey, { closed: checked === true })}
                disabled={disabled}
                id={`closed-${day.dayKey}`}
              />
              <Label htmlFor={`closed-${day.dayKey}`} className="text-sm text-gray-300">
                Fechado neste dia
              </Label>
            </div>
          </div>

          {!day.closed && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label className="text-xs text-gray-400">Abre as</Label>
                <Input
                  type="time"
                  value={day.openTime}
                  onChange={(e) => onChangeDay(day.dayKey, { openTime: e.target.value })}
                  disabled={disabled}
                  className="bg-gray-900/50 border-gray-600 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-gray-400">Fecha para almoco</Label>
                <Input
                  type="time"
                  value={day.lunchStart}
                  onChange={(e) => onChangeDay(day.dayKey, { lunchStart: e.target.value })}
                  disabled={disabled}
                  className="bg-gray-900/50 border-gray-600 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-gray-400">Reabre apos almoco</Label>
                <Input
                  type="time"
                  value={day.lunchEnd}
                  onChange={(e) => onChangeDay(day.dayKey, { lunchEnd: e.target.value })}
                  disabled={disabled}
                  className="bg-gray-900/50 border-gray-600 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-gray-400">Fecha as</Label>
                <Input
                  type="time"
                  value={day.closeTime}
                  onChange={(e) => onChangeDay(day.dayKey, { closeTime: e.target.value })}
                  disabled={disabled}
                  className="bg-gray-900/50 border-gray-600 text-white"
                />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
