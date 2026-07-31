import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  subtitle: string;
  saving?: boolean;
  canSave?: boolean;
  canDiscard?: boolean;
  onDiscard: () => void;
  onSave: () => void;
};

export function ConfigurationsToolbar({
  subtitle,
  saving,
  canSave,
  canDiscard,
  onDiscard,
  onSave,
}: Props) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl lg:text-[1.75rem] font-semibold tracking-tight text-foreground">
          Configurações
        </h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-2xl">{subtitle}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onDiscard}
          disabled={!canDiscard || saving}
          className="rounded-xl border-border bg-card shadow-sm h-9"
        >
          Descartar
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onSave}
          disabled={!canSave || saving}
          className="btn-on-emerald rounded-xl h-9 bg-emerald-800 text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 shadow-sm"
          style={{ color: '#ffffff' }}
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Salvar alterações
        </Button>
      </div>
    </div>
  );
}
