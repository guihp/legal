import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  Calendar,
  Sun,
  Moon,
  AlertTriangle
} from 'lucide-react';
import { TimeWindows, DayOfWeek } from '@/lib/dispatch/types';
import { validateTimeWindow } from '@/lib/dispatch/utils';

interface TimeWindowEditorProps {
  value: TimeWindows;
  onChange: (timeWindows: TimeWindows) => void;
  disabled?: boolean;
}

const dayLabels: Record<DayOfWeek, string> = {
  [DayOfWeek.MONDAY]: 'Segunda',
  [DayOfWeek.TUESDAY]: 'Terça',
  [DayOfWeek.WEDNESDAY]: 'Quarta',
  [DayOfWeek.THURSDAY]: 'Quinta',
  [DayOfWeek.FRIDAY]: 'Sexta',
  [DayOfWeek.SATURDAY]: 'Sábado',
  [DayOfWeek.SUNDAY]: 'Domingo'
};

const dayOrder: DayOfWeek[] = [
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
  DayOfWeek.SUNDAY
];

export function TimeWindowEditor({
  value,
  onChange,
  disabled = false
}: TimeWindowEditorProps) {
  
  const handleDayToggle = (day: DayOfWeek) => {
    if (disabled) return;

    const currentDay = value[day];
    const newTimeWindows = {
      ...value,
      [day]: {
        start: currentDay?.start || '09:00',
        end: currentDay?.end || '18:00',
        enabled: !currentDay?.enabled
      }
    };
    
    onChange(newTimeWindows);
  };

  const handleTimeChange = (day: DayOfWeek, field: 'start' | 'end', newTime: string) => {
    if (disabled) return;

    const currentDay = value[day];
    if (!currentDay?.enabled) return;

    const newTimeWindows = {
      ...value,
      [day]: {
        ...currentDay,
        [field]: newTime
      }
    };

    onChange(newTimeWindows);
  };

  const getValidationError = (day: DayOfWeek): string | null => {
    const dayConfig = value[day];
    if (!dayConfig?.enabled) return null;

    const errors = validateTimeWindow(dayConfig);
    return errors.length > 0 ? errors[0] : null;
  };

  const activeDays = dayOrder.filter(day => value[day]?.enabled).length;
  const totalHours = dayOrder.reduce((total, day) => {
    const dayConfig = value[day];
    if (!dayConfig?.enabled) return total;

    const startMinutes = timeToMinutes(dayConfig.start);
    const endMinutes = timeToMinutes(dayConfig.end);
    const dayHours = Math.max(0, (endMinutes - startMinutes) / 60);
    
    return total + dayHours;
  }, 0);

  return (
    <Card className="bg-gray-900/50 border-gray-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-white text-sm flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Horários de Funcionamento
          <Badge variant="outline" className="bg-blue-500/20 text-blue-300 border-blue-400/50">
            {activeDays} dia{activeDays !== 1 ? 's' : ''} • {totalHours.toFixed(1)}h/semana
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Resumo */}
        <div className="grid grid-cols-2 gap-4 p-3 bg-gray-800/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-400">Dias ativos:</span>
            <span className="text-sm text-white font-medium">{activeDays}/7</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-400">Total horas:</span>
            <span className="text-sm text-white font-medium">{totalHours.toFixed(1)}h</span>
          </div>
        </div>

        {/* Controles rápidos */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setBusinessHours()}
            disabled={disabled}
            className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sun className="w-3 h-3 inline mr-1" />
            Comercial (9h-18h)
          </button>
          <button
            type="button"
            onClick={() => setExtendedHours()}
            disabled={disabled}
            className="px-3 py-1 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Moon className="w-3 h-3 inline mr-1" />
            Estendido (8h-20h)
          </button>
          <button
            type="button"
            onClick={() => setWeekendOff()}
            disabled={disabled}
            className="px-3 py-1 text-xs bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Sem fins de semana
          </button>
        </div>

        {/* Grid de dias */}
        <div className="space-y-3">
          {dayOrder.map(day => {
            const dayConfig = value[day];
            const isEnabled = dayConfig?.enabled || false;
            const validationError = getValidationError(day);
            const isWeekend = day === DayOfWeek.SATURDAY || day === DayOfWeek.SUNDAY;

            return (
              <div
                key={day}
                className={`p-4 rounded-lg border transition-colors ${
                  isEnabled 
                    ? 'bg-emerald-500/10 border-emerald-500/30' 
                    : 'bg-gray-800/50 border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={() => handleDayToggle(day)}
                      disabled={disabled}
                      className="data-[state=checked]:bg-emerald-600"
                    />
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${isEnabled ? 'text-white' : 'text-gray-400'}`}>
                        {dayLabels[day]}
                      </span>
                      {isWeekend && (
                        <Badge variant="outline" className="bg-orange-500/20 text-orange-300 border-orange-400/50 text-xs">
                          Fim de semana
                        </Badge>
                      )}
                    </div>
                  </div>

                  {validationError && (
                    <div className="flex items-center gap-1 text-red-400">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-xs">{validationError}</span>
                    </div>
                  )}
                </div>

                {isEnabled && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Início</label>
                      <Input
                        type="time"
                        value={dayConfig?.start || '09:00'}
                        onChange={(e) => handleTimeChange(day, 'start', e.target.value)}
                        disabled={disabled}
                        className={`bg-gray-900/50 border-gray-700 text-white ${
                          validationError ? 'border-red-500' : ''
                        }`}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Fim</label>
                      <Input
                        type="time"
                        value={dayConfig?.end || '18:00'}
                        onChange={(e) => handleTimeChange(day, 'end', e.target.value)}
                        disabled={disabled}
                        className={`bg-gray-900/50 border-gray-700 text-white ${
                          validationError ? 'border-red-500' : ''
                        }`}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Aviso se nenhum dia ativo */}
        {activeDays === 0 && (
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-400">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">
                Nenhum dia ativo! Configuração não funcionará sem horários definidos.
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  // Funções auxiliares
  function timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
  }

  function setBusinessHours() {
    const businessTimeWindows: TimeWindows = {};
    
    // Segunda a sexta: 9h-18h
    [DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY]
      .forEach(day => {
        businessTimeWindows[day] = { start: '09:00', end: '18:00', enabled: true };
      });
    
    // Sábado: 9h-14h
    businessTimeWindows[DayOfWeek.SATURDAY] = { start: '09:00', end: '14:00', enabled: true };
    
    // Domingo: desabilitado
    businessTimeWindows[DayOfWeek.SUNDAY] = { enabled: false };
    
    onChange(businessTimeWindows);
  }

  function setExtendedHours() {
    const extendedTimeWindows: TimeWindows = {};
    
    // Segunda a sexta: 8h-20h
    [DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY]
      .forEach(day => {
        extendedTimeWindows[day] = { start: '08:00', end: '20:00', enabled: true };
      });
    
    // Sábado: 8h-16h
    extendedTimeWindows[DayOfWeek.SATURDAY] = { start: '08:00', end: '16:00', enabled: true };
    
    // Domingo: 10h-16h
    extendedTimeWindows[DayOfWeek.SUNDAY] = { start: '10:00', end: '16:00', enabled: true };
    
    onChange(extendedTimeWindows);
  }

  function setWeekendOff() {
    const weekdayTimeWindows: TimeWindows = { ...value };
    
    // Desabilitar fins de semana
    weekdayTimeWindows[DayOfWeek.SATURDAY] = { enabled: false };
    weekdayTimeWindows[DayOfWeek.SUNDAY] = { enabled: false };
    
    onChange(weekdayTimeWindows);
  }
}
