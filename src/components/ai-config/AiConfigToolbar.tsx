import { History, Loader2, Save, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  saving?: boolean;
  canSave?: boolean;
  onHistory: () => void;
  onTest: () => void;
  onSave: () => void;
};

export function AiConfigToolbar({ saving, canSave, onHistory, onTest, onSave }: Props) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl lg:text-[1.75rem] font-semibold tracking-tight text-foreground">
          Configuração da IA
        </h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
          Textos, contexto e regras que a assistente usa no WhatsApp. Conversas novas já entram
          com as informações atualizadas; conversas abertas podem levar alguns minutos.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onHistory}
          className="rounded-xl border-border bg-card shadow-sm h-9"
        >
          <History className="mr-2 h-4 w-4" />
          Ver histórico
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onTest}
          className="rounded-xl border-border bg-card shadow-sm h-9"
        >
          <Sparkles className="mr-2 h-4 w-4" />
          Testar IA
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onSave}
          disabled={!canSave || saving}
          className="btn-on-emerald rounded-xl h-9 bg-emerald-800 text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 shadow-sm"
          style={{ color: '#ffffff' }}
        >
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Salvar alterações
        </Button>
      </div>
    </div>
  );
}
