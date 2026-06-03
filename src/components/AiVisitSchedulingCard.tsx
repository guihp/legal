import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, HelpCircle, Info, Loader2, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useCompanyUsers } from '@/hooks/useCompanyUsers';
import {
  BROKER_PRIORITY_TIER_OPTIONS,
  brokerPriorityTierToScore,
  configsEqual,
  DEFAULT_AI_VISIT_SCHEDULING_CONFIG,
  DEFAULT_BROKER_PRIORITY_SCORE,
  isAiVisitSchedulingApiActive,
  MODE_DESCRIPTIONS,
  MODE_LABELS,
  PRIORITY_CRITERION_LABELS,
  scoreToBrokerPriorityTier,
  type AiVisitSchedulingConfig,
  type BrokerPriorityTier,
  type PriorityCriterion,
  type VisitBrokerAssignmentMode,
} from '@/lib/aiVisitScheduling';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const tooltipContentClass =
  'max-w-md whitespace-normal border-gray-600 bg-gray-900 text-gray-100 text-xs leading-relaxed px-3 py-2';

const TOOLTIP_PRIORITY_NUMERIC =
  'Para cada corretor, escolha Alta, Média ou Baixa. Na hora da visita, entre quem está de plantão e com horário livre, a assistente prioriza quem está como Alta; se empatar, usa a fila rotativa.';

/** Base + selected styles use ! to override Toggle default data-[state=on]:bg-accent */
const TIER_TOGGLE_BASE =
  'h-8 min-w-[3.25rem] px-3 text-xs font-semibold border transition-all ' +
  'border-gray-300 bg-white text-gray-800 shadow-sm hover:bg-gray-100 hover:border-gray-400 ' +
  'dark:border-gray-600 dark:bg-gray-950 dark:text-gray-400 dark:hover:border-gray-500 dark:hover:bg-gray-900 dark:hover:text-gray-200';

const TIER_TOGGLE_SELECTED: Record<BrokerPriorityTier, string> = {
  high:
    'data-[state=on]:!border-emerald-600 data-[state=on]:!bg-emerald-600 data-[state=on]:!text-white data-[state=on]:shadow-md ' +
    'dark:data-[state=on]:!border-emerald-300 dark:data-[state=on]:!bg-emerald-500 dark:data-[state=on]:!text-white ' +
    'dark:data-[state=on]:ring-2 dark:data-[state=on]:ring-emerald-400/70 dark:data-[state=on]:ring-offset-2 dark:data-[state=on]:ring-offset-gray-950',
  medium:
    'data-[state=on]:!border-blue-600 data-[state=on]:!bg-blue-600 data-[state=on]:!text-white data-[state=on]:shadow-md ' +
    'dark:data-[state=on]:!border-blue-300 dark:data-[state=on]:!bg-blue-500 dark:data-[state=on]:!text-white ' +
    'dark:data-[state=on]:ring-2 dark:data-[state=on]:ring-blue-400/70 dark:data-[state=on]:ring-offset-2 dark:data-[state=on]:ring-offset-gray-950',
  low:
    'data-[state=on]:!border-slate-600 data-[state=on]:!bg-slate-600 data-[state=on]:!text-white data-[state=on]:shadow-md ' +
    'dark:data-[state=on]:!border-zinc-200 dark:data-[state=on]:!bg-zinc-200 dark:data-[state=on]:!text-gray-900 ' +
    'dark:data-[state=on]:ring-2 dark:data-[state=on]:ring-zinc-300/80 dark:data-[state=on]:ring-offset-2 dark:data-[state=on]:ring-offset-gray-950',
};

const TOOLTIP_PRIORITY_PLANTAO =
  'Usa a ordem dos corretores na escala do Plantão (tela Plantão). Na prática, tenta o primeiro da lista que estiver de plantão e livre no horário.';

const TOOLTIP_PRIORITY_LEAST_BUSY =
  'Prioriza o corretor que tiver menos visitas já marcadas naquele mesmo dia, para equilibrar a carga da equipe.';

function LabelWithHelp({ label, tooltip, htmlFor }: { label: string; tooltip: string; htmlFor?: string }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Label className="text-foreground mb-0" htmlFor={htmlFor}>
        {label}
      </Label>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex rounded-full text-gray-500 hover:text-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
            aria-label={`Ajuda: ${label}`}
          >
            <HelpCircle className="h-4 w-4 shrink-0" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className={tooltipContentClass}>
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

type Props = {
  companyId: string | undefined;
  isManager: boolean;
  initialConfig: AiVisitSchedulingConfig;
  onSave: (config: Omit<AiVisitSchedulingConfig, 'updatedAt'>) => Promise<boolean>;
  externalSaving?: boolean;
};

export function AiVisitSchedulingCard({
  companyId,
  isManager,
  initialConfig,
  onSave,
  externalSaving = false,
}: Props) {
  const { users, loading: loadingUsers, loadUsers } = useCompanyUsers();
  const [saved, setSaved] = useState<AiVisitSchedulingConfig>(initialConfig);
  const [draft, setDraft] = useState<AiVisitSchedulingConfig>(initialConfig);
  const [saving, setSaving] = useState(false);

  const eligibleBrokers = useMemo(
    () =>
      users.filter(
        (u) => u.isActive && (u.role === 'corretor' || u.role === 'gestor')
      ),
    [users]
  );

  useEffect(() => {
    setSaved(initialConfig);
    setDraft(initialConfig);
  }, [initialConfig]);

  useEffect(() => {
    if (!companyId || draft.mode !== 'priority' || draft.priorityCriterion !== 'numeric') return;
    loadUsers(undefined, ['corretor', 'gestor'], false);
  }, [companyId, draft.mode, draft.priorityCriterion, loadUsers]);

  useEffect(() => {
    if (draft.mode !== 'priority' || draft.priorityCriterion !== 'numeric') return;
    if (!eligibleBrokers.length) return;
    setDraft((prev) => {
      const next = { ...prev.brokerPriorities };
      let changed = false;
      for (const b of eligibleBrokers) {
        if (next[b.id] === undefined) {
          next[b.id] = DEFAULT_BROKER_PRIORITY_SCORE;
          changed = true;
        }
      }
      return changed ? { ...prev, brokerPriorities: next } : prev;
    });
  }, [eligibleBrokers, draft.mode, draft.priorityCriterion]);

  const hasChanges = companyId ? !configsEqual(draft, saved) : false;
  const apiActive = isAiVisitSchedulingApiActive();

  const setMode = (mode: VisitBrokerAssignmentMode) => {
    setDraft((p) => ({ ...p, mode }));
  };

  const setPriorityCriterion = (priorityCriterion: PriorityCriterion) => {
    setDraft((p) => ({ ...p, priorityCriterion }));
  };

  const setBrokerPriorityTier = (userId: string, tier: BrokerPriorityTier) => {
    setDraft((p) => ({
      ...p,
      brokerPriorities: {
        ...p.brokerPriorities,
        [userId]: brokerPriorityTierToScore(tier),
      },
    }));
  };

  const handleSave = async () => {
    if (!companyId || !isManager) return;
    setSaving(true);
    try {
      const payload = {
        mode: draft.mode,
        priorityCriterion: draft.priorityCriterion,
        brokerPriorities: draft.brokerPriorities,
      };
      const ok = await onSave(payload);
      if (ok) {
        const next = { ...payload, updatedAt: new Date().toISOString() };
        setSaved(next);
        setDraft(next);
        toast.success('Preferências de agendamento salvas.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="bg-card border-border shadow-sm dark:bg-gray-800/50 dark:border-gray-700">
      <CardHeader>
        <div className="flex items-start gap-3">
          <CalendarClock className="h-6 w-6 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div>
            <CardTitle className="text-foreground">Agendamento de visitas (IA)</CardTitle>
            <CardDescription className="text-muted-foreground mt-1">
              Define como a assistente deve escolher o corretor quando marcar uma visita. Vale para
              toda a empresa.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {apiActive && (
          <Alert className="border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100">
            <Info className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <AlertTitle className="text-emerald-950 dark:text-emerald-100 font-medium">
              Regra ativa na assistente
            </AlertTitle>
            <AlertDescription className="text-emerald-900/90 dark:text-emerald-200/90 text-sm">
              O que você salvar aqui passa a valer automaticamente em cada visita agendada pela
              assistente no WhatsApp.
            </AlertDescription>
          </Alert>
        )}

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950 space-y-2 dark:border-blue-500/20 dark:bg-blue-500/5 dark:text-gray-300">
          <p className="font-medium text-blue-900 dark:text-gray-200">Dica para o modo prioridade</p>
          <p className="leading-relaxed">
            Só entram corretores de <strong className="text-blue-950 dark:text-gray-100">plantão</strong> naquele dia e
            horário, com agenda livre. O mais simples é definir uma{' '}
            <strong className="text-blue-950 dark:text-gray-100">prioridade para cada corretor</strong> (mais abaixo):
            quem estiver como Alta recebe a visita primeiro; se empatar, vale a fila rotativa. Se preferir seguir a
            ordem da escala, use a opção &quot;Ordem na escala do Plantão&quot;.
          </p>
        </div>

        <fieldset disabled={!isManager} className="space-y-4 disabled:opacity-60">
          <Label className="text-foreground">Como escolher o corretor da visita</Label>
          <RadioGroup
            value={draft.mode}
            onValueChange={(v) => setMode(v as VisitBrokerAssignmentMode)}
            className="space-y-3"
          >
            {(['queue', 'priority', 'manual'] as const).map((mode) => (
              <div
                key={mode}
                className="flex gap-3 rounded-lg border border-border bg-muted/30 p-4 hover:bg-muted/50 transition-colors dark:border-gray-700/80 dark:bg-transparent dark:hover:bg-gray-900/40"
              >
                <RadioGroupItem value={mode} id={`visit-mode-${mode}`} className="mt-1" />
                <div className="space-y-1 min-w-0">
                  <Label htmlFor={`visit-mode-${mode}`} className="text-foreground cursor-pointer font-medium">
                    {MODE_LABELS[mode]}
                  </Label>
                  <p className="text-sm text-muted-foreground leading-relaxed">{MODE_DESCRIPTIONS[mode]}</p>
                </div>
              </div>
            ))}
          </RadioGroup>
        </fieldset>

        {draft.mode === 'priority' && (
          <div className="space-y-4 pl-1 border-l-2 border-blue-400/60 ml-1 pl-4 dark:border-blue-500/30">
            <LabelWithHelp
              label="Regra de prioridade"
              tooltip="Como a assistente decide entre os corretores de plantão com horário livre naquele momento."
            />
            <RadioGroup
              value={draft.priorityCriterion}
              onValueChange={(v) => setPriorityCriterion(v as PriorityCriterion)}
              disabled={!isManager}
              className="space-y-2"
            >
              <div className="flex items-start gap-2">
                <RadioGroupItem value="numeric" id="prio-numeric" className="mt-1" />
                <div>
                  <Label htmlFor="prio-numeric" className="text-foreground cursor-pointer">
                    {PRIORITY_CRITERION_LABELS.numeric}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">{TOOLTIP_PRIORITY_NUMERIC}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <RadioGroupItem value="plantao_order" id="prio-plantao" className="mt-1" />
                <div>
                  <Label htmlFor="prio-plantao" className="text-foreground cursor-pointer">
                    {PRIORITY_CRITERION_LABELS.plantao_order}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">{TOOLTIP_PRIORITY_PLANTAO}</p>
                </div>
              </div>
              <div className="flex items-start gap-2 opacity-70">
                <RadioGroupItem
                  value="least_busy"
                  id="prio-least"
                  className="mt-1"
                  disabled={!apiActive || !isManager}
                />
                <div>
                  <Label htmlFor="prio-least" className="text-foreground cursor-pointer">
                    {PRIORITY_CRITERION_LABELS.least_busy}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {apiActive
                      ? TOOLTIP_PRIORITY_LEAST_BUSY
                      : 'Em breve: priorizar quem tiver menos visitas no mesmo dia.'}
                  </p>
                </div>
              </div>
            </RadioGroup>

            {draft.priorityCriterion === 'numeric' && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Escolha o nível de prioridade de cada corretor nas visitas agendadas pela
                  assistente.
                </p>
                {loadingUsers ? (
                  <div className="flex items-center gap-2 text-gray-500 text-sm py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando corretores...
                  </div>
                ) : eligibleBrokers.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">
                    Nenhum corretor ou gestor ativo encontrado para configurar prioridades.
                  </p>
                ) : (
                  <div className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm dark:border-gray-700/80 dark:bg-transparent dark:shadow-none">
                    <div className="hidden sm:grid sm:grid-cols-[1fr_auto] gap-3 px-4 py-2.5 bg-gray-100 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wide dark:bg-gray-900/80 dark:border-gray-700/80 dark:text-gray-500 dark:font-medium">
                      <span>Corretor</span>
                      <span className="text-right pr-1">Prioridade na visita</span>
                    </div>
                    <ul className="max-h-72 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-700/60">
                      {eligibleBrokers.map((b) => {
                        const score = draft.brokerPriorities[b.id] ?? DEFAULT_BROKER_PRIORITY_SCORE;
                        const tier = scoreToBrokerPriorityTier(score);
                        return (
                          <li
                            key={b.id}
                            className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 sm:gap-4 items-center px-4 py-3 bg-white hover:bg-gray-50 transition-colors dark:bg-gray-900/30 dark:hover:bg-gray-900/50"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate dark:text-gray-100">
                                {b.fullName}
                              </p>
                              <p className="text-xs text-muted-foreground sm:hidden mt-0.5">
                                Prioridade na visita
                              </p>
                            </div>
                            <ToggleGroup
                              type="single"
                              variant="outline"
                              value={tier}
                              onValueChange={(v) => {
                                if (v) setBrokerPriorityTier(b.id, v as BrokerPriorityTier);
                              }}
                              disabled={!isManager}
                              className="flex flex-wrap justify-start sm:justify-end gap-1.5"
                              aria-label={`Prioridade de ${b.fullName}`}
                            >
                              {BROKER_PRIORITY_TIER_OPTIONS.map((opt) => {
                                const isSelected = tier === opt.id;
                                return (
                                  <ToggleGroupItem
                                    key={opt.id}
                                    value={opt.id}
                                    aria-pressed={isSelected}
                                    className={cn(
                                      TIER_TOGGLE_BASE,
                                      TIER_TOGGLE_SELECTED[opt.id],
                                      !isSelected && 'dark:opacity-60'
                                    )}
                                  >
                                    {opt.label}
                                  </ToggleGroupItem>
                                );
                              })}
                            </ToggleGroup>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-200 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 dark:bg-gray-900/60 dark:border-gray-700/80 dark:text-gray-500">
                      {BROKER_PRIORITY_TIER_OPTIONS.map((opt) => (
                        <span key={opt.id}>
                          <span
                            className={cn(
                              'font-semibold dark:font-medium',
                              opt.id === 'high' && 'text-emerald-700 dark:text-emerald-400',
                              opt.id === 'medium' && 'text-blue-700 dark:text-blue-400',
                              opt.id === 'low' && 'text-slate-600 dark:text-gray-400'
                            )}
                          >
                            {opt.label}
                          </span>
                          {' — '}
                          {opt.hint}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {draft.priorityCriterion === 'plantao_order' && (
              <p className="text-sm text-muted-foreground">
                Organize a ordem dos corretores em{' '}
                <strong className="text-foreground">Plantão → Escala do Plantão</strong>. A assistente
                tentará o primeiro da lista que estiver de plantão e com horário livre.
              </p>
            )}
          </div>
        )}

        {draft.mode === 'manual' && (
          <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground space-y-2 dark:border-gray-700 dark:bg-gray-900/40">
            <p className="text-foreground font-medium">Como funciona</p>
            <ol className="list-decimal list-inside space-y-1 leading-relaxed">
              <li>A assistente combina data e horário da visita com o cliente no WhatsApp.</li>
              <li>A visita fica registrada na agenda, ainda sem corretor definido.</li>
              <li>Você ou um gestor escolhe qual corretor fará a visita depois do agendamento.</li>
            </ol>
          </div>
        )}

        {!isManager && (
          <p className="text-sm text-gray-500 italic">
            Apenas administradores e gestores podem alterar estas preferências.
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          {saved.updatedAt && (
            <p className="text-xs text-gray-500">
              Última alteração salva em{' '}
              {new Date(saved.updatedAt).toLocaleString('pt-BR', {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
            </p>
          )}
          <Button
            type="button"
            onClick={handleSave}
            disabled={!isManager || !companyId || !hasChanges || saving || externalSaving}
            className="bg-blue-600 hover:bg-blue-700 ml-auto"
          >
            {saving || externalSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Salvar agendamento
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
