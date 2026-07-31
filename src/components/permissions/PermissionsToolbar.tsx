import { History, Loader2, RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PAGE_SUBTITLE } from './constants';

type Props = {
  saving?: boolean;
  onAudit: () => void;
  onRestore: () => void;
  onSave: () => void;
};

export function PermissionsToolbar({ saving, onAudit, onRestore, onSave }: Props) {
  return (
    <div className="space-y-3">
      <div className="min-w-0">
        <h1 className="text-2xl lg:text-[1.75rem] font-semibold tracking-tight text-foreground">
          Permissões
        </h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-3xl">{PAGE_SUBTITLE}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAudit}
          className="rounded-xl border-border bg-card shadow-sm h-9"
        >
          <History className="mr-2 h-4 w-4" />
          Ver auditoria
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRestore}
          disabled={saving}
          className="rounded-xl border-border bg-card shadow-sm h-9"
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Restaurar padrão
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onSave}
          disabled={saving}
          className="btn-on-emerald rounded-xl h-9 bg-emerald-800 text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 shadow-sm"
          style={{ color: '#ffffff' }}
        >
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Salvar permissões
        </Button>
      </div>
    </div>
  );
}
