import { ChevronDown, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useState } from 'react';

type AiConfigGeralSectionProps = {
  aiEnabled: boolean;
  isManager: boolean;
  isOfficialApi: boolean;
  togglingAi: boolean;
  updating: boolean;
  activationBlockers: string[];
  canEnableAi: boolean;
  onToggleAi: (checked: boolean) => void;
};

export function AiConfigGeralSection({
  aiEnabled,
  isManager,
  isOfficialApi,
  togglingAi,
  updating,
  activationBlockers,
  canEnableAi,
  onToggleAi,
}: AiConfigGeralSectionProps) {
  const [tipOpen, setTipOpen] = useState(false);

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="pb-3 p-4 sm:p-5">
          <CardTitle className="text-base text-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Ativar assistente IA
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            {isOfficialApi
              ? 'API Oficial Meta — o WhatsApp já está integrado. Basta completar os textos e ativar.'
              : 'Liga ou desliga a IA no atendimento real do WhatsApp da sua imobiliária.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0 sm:p-5 sm:pt-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-border bg-muted/40 p-3.5">
            <div className="min-w-0">
              <Label className="text-sm text-foreground">Assistente IA ativa</Label>
              <p className="text-xs text-muted-foreground mt-1">
                {aiEnabled
                  ? 'A IA responde automaticamente aos clientes no WhatsApp'
                  : 'Desativada — apenas atendimento humano'}
              </p>
            </div>
            <Switch
              checked={aiEnabled}
              disabled={!isManager || togglingAi || updating}
              onCheckedChange={onToggleAi}
              className="data-[state=checked]:bg-emerald-500 shrink-0 self-start sm:self-center"
            />
          </div>

          {!aiEnabled && isOfficialApi && (
            <p className="text-xs text-blue-700 dark:text-blue-400/90 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2">
              Não é necessário conectar WhatsApp em Conexões — empresas com API Oficial já usam o
              número vinculado à Meta automaticamente.
            </p>
          )}

          {!aiEnabled && activationBlockers.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-sm text-amber-950 dark:text-amber-100/90">
              <p className="font-medium text-amber-900 dark:text-amber-200 mb-1.5">
                Para ativar a IA, complete:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-amber-900/80 dark:text-amber-100/80 text-sm">
                {activationBlockers.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {!aiEnabled && canEnableAi && (
            <p className="text-xs text-emerald-700 dark:text-emerald-400/90">
              Tudo pronto — você pode ativar a assistente IA.
            </p>
          )}
        </CardContent>
      </Card>

      <Collapsible open={tipOpen} onOpenChange={setTipOpen}>
        <Alert className="bg-muted/30 border-border">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 text-left"
            >
              <span className="text-sm font-medium text-foreground">
                Como as alterações entram em vigor
              </span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                  tipOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <AlertDescription className="mt-2 text-muted-foreground">
              Depois que você salvar, quem entrar em contato pela primeira vez ou iniciar uma
              conversa nova costuma ser atendido já com essas informações. Quem já está numa
              conversa aberta no WhatsApp pode levar um tempinho para “pegar” tudo que mudou — é
              normal, porque a assistente lembra do que já foi dito naquela conversa.
            </AlertDescription>
          </CollapsibleContent>
        </Alert>
      </Collapsible>
    </div>
  );
}
