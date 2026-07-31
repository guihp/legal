import { Contrast } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { swatchContrastLevel, type ContrastLevel } from './helpers';

type ColorField = {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** Optional paired bg for accurate contrast; otherwise swatch vs white/black */
  contrastBg?: string;
};

type Props = {
  themeColor: string;
  titleColor: string;
  headerBg: string;
  headerFg: string;
  headerMuted: string;
  headerTagline: string;
  useCompanyFont: boolean;
  settingsFontHint: string | null;
  onThemeColor: (v: string) => void;
  onTitleColor: (v: string) => void;
  onHeaderBg: (v: string) => void;
  onHeaderFg: (v: string) => void;
  onHeaderMuted: (v: string) => void;
  onHeaderTagline: (v: string) => void;
  onUseCompanyFont: (v: boolean) => void;
  onRestoreDefaults: () => void;
};

function ContrastBadge({ level }: { level: ContrastLevel }) {
  if (level === 'fail' || level === 'A') {
    return (
      <span className="rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        {level === 'fail' ? '!' : 'A'}
      </span>
    );
  }
  return (
    <span
      className={cn(
        'rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        level === 'AAA'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
          : 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300',
      )}
    >
      {level}
    </span>
  );
}

function ColorRow({ label, value, onChange }: ColorField) {
  const level = swatchContrastLevel(value);
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <label className="relative h-10 w-10 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-border shadow-sm">
          <span className="absolute inset-0" style={{ backgroundColor: value || '#ccc' }} />
          <input
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000'}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-xl border-border bg-background h-10 font-mono text-sm flex-1"
        />
        <ContrastBadge level={level} />
      </div>
    </div>
  );
}

export function SiteVitrineAppearanceCard({
  themeColor,
  titleColor,
  headerBg,
  headerFg,
  headerMuted,
  headerTagline,
  useCompanyFont,
  settingsFontHint,
  onThemeColor,
  onTitleColor,
  onHeaderBg,
  onHeaderFg,
  onHeaderMuted,
  onHeaderTagline,
  onUseCompanyFont,
  onRestoreDefaults,
}: Props) {
  return (
    <section
      id="sv-aparencia"
      className="scroll-mt-24 rounded-2xl border border-border/70 bg-card p-5 sm:p-6 shadow-sm space-y-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
            <Contrast className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Aparência</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Cores, subtítulo e tipografia</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRestoreDefaults}
          className="text-sm font-medium text-emerald-800 hover:text-emerald-700 dark:text-emerald-400 shrink-0"
        >
          Restaurar padrão
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ColorRow label="Cor principal" value={themeColor} onChange={onThemeColor} />
        <ColorRow label="Cor do título (hero)" value={titleColor} onChange={onTitleColor} />
        <ColorRow label="Fundo do menu" value={headerBg} onChange={onHeaderBg} />
        <ColorRow label="Texto principal" value={headerFg} onChange={onHeaderFg} />
        <ColorRow label="Texto secundário" value={headerMuted} onChange={onHeaderMuted} />
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Subtítulo sob o nome
        </label>
        <Input
          value={headerTagline}
          onChange={(e) => onHeaderTagline(e.target.value)}
          placeholder="Imóveis selecionados"
          className="rounded-xl border-border bg-background h-11"
        />
      </div>

      <div className="rounded-xl border border-border/70 bg-muted/30 px-4 py-3.5 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Usar tipografia da marca</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Fonte atual: {settingsFontHint || '…'}
          </p>
        </div>
        <Switch
          checked={useCompanyFont}
          onCheckedChange={(v) => onUseCompanyFont(v)}
          className="data-[state=checked]:bg-emerald-700"
        />
      </div>
    </section>
  );
}
