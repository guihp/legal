import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type TimePickerProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

const pad2 = (n: number) => String(n).padStart(2, '0');

export function TimePicker({ value, onChange, disabled }: TimePickerProps) {
  const times: string[] = [];
  for (let h = 8; h <= 19; h++) {
    for (const m of [0, 30]) {
      times.push(`${pad2(h)}:${pad2(m)}`);
    }
  }

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        className={`rounded-lg bg-background border-border text-foreground h-9 text-sm font-mono mt-1 ${disabled ? 'opacity-50' : ''}`}
      >
        <SelectValue placeholder="—:—" />
      </SelectTrigger>
      <SelectContent className="bg-popover border-border max-h-64 rounded-xl">
        {times.map((t) => (
          <SelectItem key={t} value={t} className="font-mono">
            {t}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
