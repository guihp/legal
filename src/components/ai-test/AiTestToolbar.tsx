import { Loader2, RotateCcw, Save, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  clearing?: boolean;
  onConfigure: () => void;
  onNewSession: () => void;
  onSaveScenario: () => void;
};

export function AiTestToolbar({ clearing, onConfigure, onNewSession, onSaveScenario }: Props) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl lg:text-[1.75rem] font-semibold tracking-tight text-foreground">
          Testar IA
        </h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
          Simule uma conversa de WhatsApp com a IA. Cada sessão usa um ID único e não altera leads,
          pipeline nem dados reais do CRM.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onConfigure}
          className="rounded-xl border-border bg-card shadow-sm h-9"
        >
          <Settings2 className="mr-2 h-4 w-4" />
          Configurar IA
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onNewSession}
          disabled={clearing}
          className="rounded-xl border-border bg-card shadow-sm h-9"
        >
          {clearing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="mr-2 h-4 w-4" />
          )}
          Nova sessão
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onSaveScenario}
          className="btn-on-emerald rounded-xl h-9 bg-emerald-800 text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 shadow-sm"
          style={{ color: '#ffffff' }}
        >
          <Save className="mr-2 h-4 w-4" />
          Salvar como cenário
        </Button>
      </div>
    </div>
  );
}
