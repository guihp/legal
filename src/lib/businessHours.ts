export type DaySchedule = {
  dayKey: string;
  label: string;
  closed: boolean;
  openTime: string;
  lunchStart: string;
  lunchEnd: string;
  closeTime: string;
};

export const DEFAULT_BUSINESS_SCHEDULE: DaySchedule[] = [
  { dayKey: 'monday', label: 'Segunda', closed: false, openTime: '08:00', lunchStart: '12:00', lunchEnd: '13:00', closeTime: '18:00' },
  { dayKey: 'tuesday', label: 'Terca', closed: false, openTime: '08:00', lunchStart: '12:00', lunchEnd: '13:00', closeTime: '18:00' },
  { dayKey: 'wednesday', label: 'Quarta', closed: false, openTime: '08:00', lunchStart: '12:00', lunchEnd: '13:00', closeTime: '18:00' },
  { dayKey: 'thursday', label: 'Quinta', closed: false, openTime: '08:00', lunchStart: '12:00', lunchEnd: '13:00', closeTime: '18:00' },
  { dayKey: 'friday', label: 'Sexta', closed: false, openTime: '08:00', lunchStart: '12:00', lunchEnd: '13:00', closeTime: '18:00' },
  { dayKey: 'saturday', label: 'Sabado', closed: false, openTime: '08:00', lunchStart: '', lunchEnd: '', closeTime: '12:00' },
  { dayKey: 'sunday', label: 'Domingo', closed: true, openTime: '', lunchStart: '', lunchEnd: '', closeTime: '' },
];

export function parseBusinessHours(value: string | null | undefined): DaySchedule[] {
  if (!value) return DEFAULT_BUSINESS_SCHEDULE;

  try {
    const parsed = JSON.parse(value) as { days?: DaySchedule[] };
    if (!Array.isArray(parsed.days)) return DEFAULT_BUSINESS_SCHEDULE;

    return DEFAULT_BUSINESS_SCHEDULE.map((defaultDay) => {
      const savedDay = parsed.days?.find((day) => day.dayKey === defaultDay.dayKey);
      if (!savedDay) return defaultDay;
      return { ...defaultDay, ...savedDay };
    });
  } catch {
    return DEFAULT_BUSINESS_SCHEDULE;
  }
}

export function serializeBusinessHours(schedule: DaySchedule[]): string {
  return JSON.stringify({ days: schedule });
}

const SHORT_DAY: Record<string, string> = {
  monday: 'Seg',
  tuesday: 'Ter',
  wednesday: 'Qua',
  thursday: 'Qui',
  friday: 'Sex',
  saturday: 'Sab',
  sunday: 'Dom',
};

function formatOpenRange(d: DaySchedule): string {
  const lunch =
    d.lunchStart?.trim() && d.lunchEnd?.trim()
      ? `${d.openTime}-${d.lunchStart}, ${d.lunchEnd}-${d.closeTime}`
      : `${d.openTime}-${d.closeTime}`;
  return lunch;
}

function segmentForDay(d: DaySchedule): string {
  const s = SHORT_DAY[d.dayKey] ?? d.label.slice(0, 3);
  if (d.closed) return `${s} fechado`;
  return `${s} ${formatOpenRange(d)}`;
}

/** Uma linha enxuta para prompts — alinhada ao que o banco grava em business_hours_summary. */
export function formatBusinessHoursForPrompt(schedule: DaySchedule[]): string {
  const order = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
  const byKey = Object.fromEntries(schedule.map((d) => [d.dayKey, d])) as Record<string, DaySchedule>;
  return order.map((k) => byKey[k]).filter(Boolean).map(segmentForDay).join(' | ');
}
